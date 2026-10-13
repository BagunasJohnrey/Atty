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
    var totalScans = attendance.length
    var presentSrcodes = {}
    for (var i = 0; i < attendance.length; i++) {
      presentSrcodes[attendance[i].srcode] = true
    }
    var totalPresent = Object.keys(presentSrcodes).length
    var totalAbsent = Math.max(0, totalStudents - totalPresent)
    // Overall groups count distinct students (first scan wins), so shares
    // never exceed 100% on multi-day events.
    var seenSrcodes = {}
    var distinct = []
    for (var d = 0; d < attendance.length; d++) {
      if (!seenSrcodes[attendance[d].srcode]) {
        seenSrcodes[attendance[d].srcode] = true
        distinct.push(attendance[d])
      }
    }

    var byDay = {}
    var dayOrder = []
    for (var j = 0; j < attendance.length; j++) {
      var day = Attendance.dayKey(attendance[j].timestamp)
      if (!byDay[day]) {
        byDay[day] = []
        dayOrder.push(day)
      }
      byDay[day].push(attendance[j])
    }
    dayOrder.sort()
    var days = []
    for (var k = 0; k < dayOrder.length; k++) {
      var records = byDay[dayOrder[k]]
      var daySrcodes = {}
      for (var m = 0; m < records.length; m++) {
        daySrcodes[records[m].srcode] = true
      }
      var dayPresent = Object.keys(daySrcodes).length
      days.push({
        day: dayOrder[k],
        present: dayPresent,
        absent: Math.max(0, totalStudents - dayPresent),
        rate: Reports.rate(dayPresent, totalStudents),
        byCollege: Reports.groupBy(records, "college"),
        byProgram: Reports.groupBy(records, "program"),
        byYearLevel: Reports.groupBy(records, "yearLevel"),
        byGender: Reports.groupBy(records, "gender"),
      })
    }

    return {
      event: event,
      totalStudents: totalStudents,
      totalPresent: totalPresent,
      totalAbsent: totalAbsent,
      attendanceRate: Reports.rate(totalPresent, totalStudents),
      totalScans: totalScans,
      byCollege: Reports.groupBy(distinct, "college"),
      byProgram: Reports.groupBy(distinct, "program"),
      byYearLevel: Reports.groupBy(distinct, "yearLevel"),
      byGender: Reports.groupBy(distinct, "gender"),
      days: days,
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