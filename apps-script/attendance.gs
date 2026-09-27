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
   * 1-based row of an existing attendance entry, or -1.
   *
   * @param {string} eventId
   * @param {string} srcode
   * @returns {number}
   */
  findRow: function (eventId, srcode) {
    return Sheets.findRowByValue(eventId, Config.COLUMNS.ATTENDANCE.SRCODE, srcode)
  },

  /**
   * Records attendance for one student, enforcing status and integrity rules.
   *
   * @param {string} eventId
   * @param {string} srcode
   * @returns {{ timestamp: string, student: Student }}
   */
  record: function (eventId, srcode) {
    var event = Events.assertById(eventId)
    Events.assertCanRecord(event)
    var student = Students.assertExists(srcode)
    if (Attendance.findRow(eventId, srcode) > 0) {
      throw new AppError(
        Responses.CODES.DUPLICATE_ATTENDANCE,
        "Student has already attended this event."
      )
    }
    var timestamp = Attendance.now()
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
    var row = Attendance.findRow(eventId, srcode)
    var result = { present: row > 0 }
    if (student) result.student = student
    if (row > 0) {
      result.timestamp = Models.formatDateTime(
        Sheets.getCell(event.sheetName, row, Config.COLUMNS.ATTENDANCE.TIMESTAMP + 1)
      )
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
    var result = Attendance.record(eventId, srcode)
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