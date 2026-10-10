/**
 * Neon → Sheets backup: events + attendance mirror.
 *
 * After the Neon migration, Apps Script is the backup, not the primary.
 * These actions copy Neon rows back into their sheets so the spreadsheet
 * stays a readable mirror and a flag-flip fallback target. Students are
 * deliberately out of scope: the roster moves once per school year and is
 * never part of this backup.
 *
 * Merge semantics everywhere: rows are matched by key and updated in place
 * or appended; sheet-only rows are counted but never deleted, so a backup
 * run can never destroy manual sheet edits. An empty rows array leaves the
 * tab untouched (reported as skipped) rather than wiping it.
 *
 * Scale note: updates use the existing per-cell `setCell`/`appendRow`
 * primitives instead of bulk `setValues` because backup traffic is tens of
 * rows (events + one event's scans per call), not thousands. If attendance
 * ever grows past that, switch the update loop to a single range write.
 */
var Backup = {
  /**
   * Milliseconds for a sheet timestamp cell, or NaN when unparseable.
   * Sheets hands date-formatted cells back as Date objects, plain serial
   * numbers, or the verbatim strings the app wrote — all three occur.
   *
   * Wall-time strings are parsed as Asia/Manila explicitly BEFORE any
   * Date.parse fallback: Date.parse would read them in the container's
   * local zone, which is only coincidentally correct when that happens to
   * be Manila. ISO strings (unambiguous offsets) go through Date.parse.
   *
   * @param {*} value
   * @returns {number}
   */
  instantMs: function (value) {
    if (value instanceof Date) return value.getTime()
    if (typeof value === "number") {
      // Sheets serial: days since 1899-12-30.
      return Math.round((value - 25569) * 86400 * 1000)
    }
    var text = String(value || "").trim()
    if (!text) return NaN
    // Sheet wall time "MM/dd/yyyy HH:mm:ss" in Asia/Manila (no DST there,
    // so a fixed +8 offset is exact, not an approximation).
    var match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text)
    if (match) {
      return (
        Date.UTC(
          Number(match[3]),
          Number(match[1]) - 1,
          Number(match[2]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6] || 0)
        ) -
        8 * 3600 * 1000
      )
    }
    return Date.parse(text)
  },

  /**
   * Canonical sheet text for any timestamp shape: "MM/dd/yyyy HH:mm:ss" in
   * Asia/Manila. Unparseable input passes through verbatim so a weird value
   * is never destroyed — it just compares unequal and gets rewritten with
   * whatever Neon sent.
   *
   * @param {*} value
   * @returns {string}
   */
  sheetTimestamp: function (value) {
    if (typeof value === "string" && value.trim() === "") return ""
    var ms = Backup.instantMs(value)
    if (isNaN(ms)) return String(value || "")
    return Utilities.formatDate(
      new Date(ms),
      Session.getScriptTimeZone(),
      Config.TIME_FORMAT
    )
  },

  /**
   * Upserts event rows into the Events sheet, matched by event id.
   *
   * @param {Object[]} events - SchoolEvent-shaped rows from Neon.
   * @returns {{inserted:number,updated:number,untouched:number,sheetOnly:number}}
   */
  upsertEvents: function (events) {
    if (!Array.isArray(events)) {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "events must be an array.")
    }
    Sheets.ensureSheet(Config.EVENTS_SHEET)
    Sheets.ensureHeaders(Config.EVENTS_SHEET, Config.EVENTS_HEADERS)
    var columns = Config.COLUMNS.EVENTS
    var data = Sheets.getValues(Config.EVENTS_SHEET)
    var rowById = {}
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var id = String(data[i][columns.ID] || "").trim()
      if (id) rowById[id] = i + 1
    }
    var seen = {}
    var report = { inserted: 0, updated: 0, untouched: 0, sheetOnly: 0 }
    for (var e = 0; e < events.length; e++) {
      var event = events[e] || {}
      var eventId = Validators.requireString(event, "id", "Event ID", Config.MAX_EVENT_NAME_LENGTH)
      var row = [
        eventId,
        Validators.requireString(event, "name", "Event name", Config.MAX_EVENT_NAME_LENGTH),
        String(event.date || ""),
        String(event.status || Config.DEFAULT_EVENT_STATUS),
        String(event.sheetName || eventId),
        String(event.location || ""),
        String(event.description || ""),
        String(event.orgId || ""),
        String(event.time || ""),
      ]
      seen[eventId] = true
      var at = rowById[eventId]
      if (!at) {
        Sheets.appendRow(Config.EVENTS_SHEET, row)
        report.inserted++
        continue
      }
      var current = data[at - 1]
      var changed = false
      for (var c = 0; c < row.length; c++) {
        if (String(current[c] || "") !== row[c]) {
          Sheets.setCell(Config.EVENTS_SHEET, at, c + 1, row[c])
          changed = true
        }
      }
      if (changed) report.updated++
      else report.untouched++
    }
    for (var key in rowById) {
      if (!seen[key]) report.sheetOnly++
    }
    return report
  },

  /**
   * Upserts one event's scans into its EVT tab, matched by srcode (one row
   * per srcode per event — duplicates cannot exist on either side).
   *
   * @param {string} eventId
   * @param {{srcode:string,scannedAt:string}[]} rows - Neon attendance rows.
   * @returns {{inserted:number,updated:number,untouched:number,sheetOnly:number,skipped:boolean}}
   */
  upsertAttendance: function (eventId, rows) {
    var event = Events.assertById(eventId)
    if (!Array.isArray(rows)) {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "rows must be an array.")
    }
    var sheetName = event.sheetName
    var tab = Sheets.sheetByName(sheetName)
    var sheetOnly = 0
    if (tab) {
      var existing = Sheets.getValues(sheetName)
      for (var s = Config.ROW_START - 1; s < existing.length; s++) {
        if (String(existing[s][Config.COLUMNS.ATTENDANCE.SRCODE] || "").trim()) sheetOnly++
      }
    }
    if (rows.length === 0) {
      return { inserted: 0, updated: 0, untouched: 0, sheetOnly: sheetOnly, skipped: true }
    }
    Sheets.ensureSheet(sheetName)
    Sheets.writeHeaders(sheetName, Config.ATTENDANCE_HEADERS)
    var data = Sheets.getValues(sheetName)
    var rowBySrcode = {}
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var code = String(data[i][Config.COLUMNS.ATTENDANCE.SRCODE] || "").trim()
      if (code) rowBySrcode[code] = i + 1
    }
    var seen = {}
    var report = { inserted: 0, updated: 0, untouched: 0, sheetOnly: 0, skipped: false }
    for (var r = 0; r < rows.length; r++) {
      var scan = rows[r] || {}
      var srcode = Validators.requireString(scan, "srcode", "SRCODE", Config.MAX_SRCODE_LENGTH)
      // Always stored sheet-formatted: this also heals rows a previous
      // backup wrote as raw ISO.
      var want = Backup.sheetTimestamp(scan.scannedAt)
      seen[srcode] = true
      var at = rowBySrcode[srcode]
      if (at === 0) {
        // Duplicate srcode inside one payload; already written above.
        report.untouched++
        continue
      }
      if (!at) {
        Sheets.appendRow(sheetName, [want, srcode])
        rowBySrcode[srcode] = 0
        report.inserted++
        continue
      }
      var current = data[at - 1][Config.COLUMNS.ATTENDANCE.TIMESTAMP]
      if (Backup.sheetTimestamp(current) === want) {
        report.untouched++
      } else {
        Sheets.setCell(sheetName, at, Config.COLUMNS.ATTENDANCE.TIMESTAMP + 1, want)
        report.updated++
      }
    }
    for (var key in rowBySrcode) {
      if (!seen[key]) report.sheetOnly++
    }
    return report
  },

  /**
   * API handler for "backupEvents".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleBackupEvents: function (body) {
    if (!body || !Array.isArray(body.events)) {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "events must be an array.")
    }
    return Responses.ok("Events backup complete.", {
      report: Backup.upsertEvents(body.events),
    })
  },

  /**
   * API handler for "backupAttendance".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleBackupAttendance: function (body) {
    var eventId = Validators.requireString(body || {}, "eventId", "Event ID")
    if (!body || !Array.isArray(body.rows)) {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "rows must be an array.")
    }
    return Responses.ok("Attendance backup complete.", {
      report: Backup.upsertAttendance(eventId, body.rows),
    })
  },
}
