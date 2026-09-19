/**
 * Domain models and row-to-object mappers.
 *
 * Google Apps Script does not support type imports, so these JSDoc typedefs
 * document the shape of the objects exchanged with the Next.js client. The
 * mappers convert raw spreadsheet rows into stable domain objects.
 */

/**
 * @typedef {Object} Student
 * @property {string} srcode
 * @property {string} name
 * @property {string} college
 * @property {string} program
 * @property {string} yearLevel
 * @property {string} gender
 */

/**
 * @typedef {Object} SchoolEvent
 * @property {string} id
 * @property {string} name
 * @property {string} date
 * @property {string} status
 * @property {string} sheetName
 */

/**
 * @typedef {Object} AttendanceRecord
 * @property {string} timestamp
 * @property {string} srcode
 * @property {string} name
 * @property {string} college
 * @property {string} program
 * @property {string} yearLevel
 * @property {string} gender
 */

var Models = {
  studentFromRow: function (row) {
    var columns = Config.COLUMNS.MASTERLIST;
    return {
      srcode: String(row[columns.SRCODE] || "").trim(),
      name: String(row[columns.FULL_NAME] || "").trim(),
      college: String(row[columns.COLLEGE] || "").trim(),
      program: String(row[columns.PROGRAM] || "").trim(),
      yearLevel: String(row[columns.YEAR_LEVEL] || "").trim(),
      gender: String(row[columns.GENDER] || "").trim(),
    }
  },

  eventFromRow: function (row) {
    if (!row) return null
    var columns = Config.COLUMNS.EVENTS
    var id = String(row[columns.ID] || "").trim()
    if (!id) return null
    return {
      id: id,
      name: String(row[columns.NAME] || ""),
      date: String(row[columns.DATE] || ""),
      status: String(row[columns.STATUS] || Config.DEFAULT_EVENT_STATUS),
      sheetName: String(row[columns.SHEET_NAME] || id),
    }
  },

  /**
   * Builds an AttendanceRecord (attendance row joined with student data).
   *
   * @param {string[]} row - The attendance sheet row: [timestamp, srcode].
   * @param {Student} [student] - The matched student, used for the join.
   * @returns {AttendanceRecord}
   */
  attendanceRecordFromRow: function (row, student) {
    var columns = Config.COLUMNS.ATTENDANCE
    var source = student || {}
    return {
      timestamp: String(row[columns.TIMESTAMP] || ""),
      srcode: String(row[columns.SRCODE] || "").trim(),
      name: String(source.name || ""),
      college: String(source.college || ""),
      program: String(source.program || ""),
      yearLevel: String(source.yearLevel || ""),
      gender: String(source.gender || ""),
    }
  },
}