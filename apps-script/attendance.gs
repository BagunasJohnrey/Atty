/**
 * Attendance operations.
 *
 * Event sheets only ever contain [Timestamp, SRCODE] rows; all student
 * details are joined in from the Masterlist at read time.
 */
var Attendance = {
  /**
   * @returns {string}
   */
  now: function () {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), Config.TIME_FORMAT)
  },

  /**
   * Manila day key (`yyyy-MM-dd`) for a scan timestamp. Both sides of every
   * same-day comparison go through this formatter, so the check holds
   * however the sheet stored the timestamp.
   *
   * @param {*} value - A Date, timestamp string, or epoch millis.
   * @returns {string}
   */
  dayKey: function (value) {
    return Utilities.formatDate(new Date(value), Session.getScriptTimeZone(), "yyyy-MM-dd")
  },

  /**
   * @returns {string} Today's Manila day key.
   */
  todayKey: function () {
    return Attendance.dayKey(new Date())
  },

  /**
   * 1-based row of today's attendance entry, or -1.
   *
   * Only used to fetch the original timestamp for a re-scan. Duplicate
   * detection itself goes through hasAttendance, which reads the two
   * columns in a single range instead of the whole row.
   *
   * @param {string} sheetName - The event's attendance sheet, not the ID.
   * @param {string} srcode
   * @returns {number}
   */
  findRow: function (sheetName, srcode) {
    try {
      var sheet = Sheets.sheetByName(sheetName)
      if (!sheet) return -1
      var lastRow = sheet.getLastRow()
      if (lastRow < Config.ROW_START) return -1
      var values = sheet
        .getRange(Config.ROW_START, 1, lastRow - Config.ROW_START + 1, 2)
        .getValues()
      var target = String(srcode || "").trim()
      var today = Attendance.todayKey()
      for (var i = 0; i < values.length; i++) {
        if (
          String(values[i][Config.COLUMNS.ATTENDANCE.SRCODE] || "").trim() === target &&
          values[i][Config.COLUMNS.ATTENDANCE.TIMESTAMP] &&
          Attendance.dayKey(values[i][Config.COLUMNS.ATTENDANCE.TIMESTAMP]) === today
        ) {
          return Config.ROW_START + i
        }
      }
      return -1
    } catch (error) {
      return -1
    }
  },

  /**
   * Whether an SRCODE already appears in the event's attendance sheet
   * *today* (Manila day).
   *
   * Reads the timestamp and SRCODE columns in one range rather than the
   * whole used range, which is the difference between one narrow read
   * and a full row read on every validate and every record. Returns true
   * on any read failure so a transient error can never be mistaken for
   * "not present" and silently allow a duplicate row.
   *
   * @param {string} sheetName
   * @param {string} srcode
   * @returns {boolean}
   */
  hasAttendance: function (sheetName, srcode) {
    try {
      var sheet = Sheets.sheetByName(sheetName)
      if (!sheet) return false
      var lastRow = sheet.getLastRow()
      if (lastRow < Config.ROW_START) return false
      var values = sheet
        .getRange(Config.ROW_START, 1, lastRow - Config.ROW_START + 1, 2)
        .getValues()
      var target = String(srcode || "").trim()
      var today = Attendance.todayKey()
      for (var i = 0; i < values.length; i++) {
        if (
          String(values[i][Config.COLUMNS.ATTENDANCE.SRCODE] || "").trim() === target &&
          values[i][Config.COLUMNS.ATTENDANCE.TIMESTAMP] &&
          Attendance.dayKey(values[i][Config.COLUMNS.ATTENDANCE.TIMESTAMP]) === today
        ) {
          return true
        }
      }
      return false
    } catch (error) {
      // Fail closed: a duplicate is recoverable, a silently dropped
      // attendance row is not.
      return true
    }
  },

  /**
   * Records attendance for one student, enforcing status and integrity rules.
   * An explicit scan instant attributes offline replays to the day they
   * were taken; live scans omit it and stamp now.
   *
   * @param {string} eventId
   * @param {string} srcode
   * @param {number} [scannedAt] - Device ms epoch for offline replays.
   * @returns {{ timestamp: string, student: Student }}
   */
  record: function (eventId, srcode, scannedAt) {
    var event = Events.assertById(eventId)
    Events.assertCanRecord(event)
    var student = Students.assertExists(srcode)
    if (Attendance.hasAttendance(event.sheetName, srcode)) {
      throw new AppError(
        Responses.CODES.DUPLICATE_ATTENDANCE,
        "Already recorded today."
      )
    }
    var timestamp =
      scannedAt === undefined || scannedAt === null
        ? Attendance.now()
        : Utilities.formatDate(
            new Date(scannedAt),
            Session.getScriptTimeZone(),
            Config.TIME_FORMAT
          )
    Sheets.appendRow(event.sheetName, [timestamp, srcode])
    return { timestamp: timestamp, student: student }
  },

  /**
   * Returns whether a student has attended the event (non-mutating).
   *
   * @param {string} eventId
   * @param {string} srcode
   * @returns {{ present: boolean, timestamp?: string, student?: Student }}
   */
  check: function (eventId, srcode) {
    var event = Events.assertById(eventId)
    var student = Students.getBySrcode(srcode)
    var present = Attendance.hasAttendance(event.sheetName, srcode)
    var result = { present: present }
    if (student) result.student = student
    if (present) {
      var row = Attendance.findRow(event.sheetName, srcode)
      if (row > 0) {
        result.timestamp = Models.formatDateTime(
          Sheets.getCell(event.sheetName, row, Config.COLUMNS.ATTENDANCE.TIMESTAMP + 1)
        )
      }
    }
    return result
  },

  /**
   * Attendance rows for an event, joined with Masterlist student data.
   *
   * @param {string} eventId
   * @returns {AttendanceRecord[]}
   */
  list: function (eventId) {
    var event = Events.assertById(eventId)
    var data = Sheets.getValues(event.sheetName)
    var index = Students.index()
    var records = []
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var srcode = String(data[i][Config.COLUMNS.ATTENDANCE.SRCODE] || "").trim()
      if (!srcode) continue
      var row = [data[i][Config.COLUMNS.ATTENDANCE.TIMESTAMP] || "", srcode]
      records.push(Models.attendanceRecordFromRow(row, index[srcode]))
    }
    return records
  },

  /**
   * API handler for "recordAttendance".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleRecord: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    var srcode = Validators.requireString(body, "srcode", "SRCODE", Config.MAX_SRCODE_LENGTH)
    var scannedAt = body.scannedAt === undefined || body.scannedAt === null
      ? undefined
      : Validators.requireScannedAt(body.scannedAt)
    var result = Attendance.record(eventId, srcode, scannedAt)
    return Responses.ok("Attendance recorded successfully.", result)
  },

  /**
   * API handler for "checkAttendance".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleCheck: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    var srcode = Validators.requireString(body, "srcode", "SRCODE", Config.MAX_SRCODE_LENGTH)
    return Responses.ok("Attendance checked successfully.", { check: Attendance.check(eventId, srcode) })
  },

  /**
   * API handler for "getAttendance".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleList: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    return Responses.ok("Attendance retrieved successfully.", { attendance: Attendance.list(eventId) })
  },
}