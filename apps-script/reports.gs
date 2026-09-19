/**
 * Attendance reporting.
 *
 * Reports join attendance with the Masterlist at read time, so student data
 * is never duplicated into event sheets.
 */
var Reports = {
  /**
   * Builds the full report for an event.
   *
   * @param {string} eventId
   * @returns {Object}
   */
  get: function (eventId) {
    var event = Events.assertById(eventId)
    var attendance = Attendance.list(eventId)
    var totalStudents = Students.count()
    var totalPresent = attendance.length
    var totalAbsent = Math.max(0, totalStudents - totalPresent)

    return {
      event: event,
      totalStudents: totalStudents,
      totalPresent: totalPresent,
      totalAbsent: totalAbsent,
      attendanceRate: Reports.rate(totalPresent, totalStudents),
      byCollege: Reports.groupBy(attendance, "college"),
      byProgram: Reports.groupBy(attendance, "program"),
      byYearLevel: Reports.groupBy(attendance, "yearLevel"),
      byGender: Reports.groupBy(attendance, "gender"),
    }
  },

  /**
   * Attendance percentage rounded to two decimal places.
   *
   * @param {number} present
   * @param {number} total
   * @returns {number}
   */
  rate: function (present, total) {
    if (total <= 0) return 0
    return Math.round((present / total) * 10000) / 100
  },

  /**
   * Counts attendance records per distinct value of the given field.
   *
   * @param {AttendanceRecord[]} records
   * @param {string} field
   * @returns {Object.<string, number>}
   */
  groupBy: function (records, field) {
    var counts = {}
    for (var i = 0; i < records.length; i++) {
      var key = String(records[i][field] || "Unknown").trim() || "Unknown"
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  },

  /**
   * API handler for "getAttendanceReport".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleReport: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    return Responses.ok("Attendance report generated.", { report: Reports.get(eventId) })
  },
}