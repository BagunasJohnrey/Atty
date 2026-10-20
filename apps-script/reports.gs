/**
 * Attendance reporting.
 *
 * Reports join attendance with the Masterlist at read time, so student data
 * is never duplicated into event sheets.
 */
var Reports = {
  /** Facets that narrow the report, mirroring the attendance table. */
  FILTER_FIELDS: ["college", "program", "yearLevel", "gender"],

  /**
   * Trims and lowercases facet filters; blanks mean "no filter".
   *
   * @param {Object} [filters]
   * @returns {Object}
   */
  normalizeFilters: function (filters) {
    var normalized = {}
    for (var i = 0; i < Reports.FILTER_FIELDS.length; i++) {
      var field = Reports.FILTER_FIELDS[i]
      var value = filters && filters[field]
      normalized[field] = value ? String(value).trim().toLowerCase() : ""
    }
    return normalized
  },

  /**
   * @param {Object} filters - Output of normalizeFilters.
   * @returns {boolean}
   */
  hasFilters: function (filters) {
    for (var i = 0; i < Reports.FILTER_FIELDS.length; i++) {
      if (filters[Reports.FILTER_FIELDS[i]]) return true
    }
    return false
  },

  /**
   * Case-insensitive exact match for every active facet.
   *
   * @param {Object} record
   * @param {Object} filters - Output of normalizeFilters.
   * @returns {boolean}
   */
  matches: function (record, filters) {
    for (var i = 0; i < Reports.FILTER_FIELDS.length; i++) {
      var field = Reports.FILTER_FIELDS[i]
      if (!filters[field]) continue
      if (String(record[field] || "").trim().toLowerCase() !== filters[field]) {
        return false
      }
    }
    return true
  },

  /**
   * Counts students in the Masterlist matching the active facets, so a
   * filtered report measures its rate against the filtered roster rather
   * than the whole campus.
   *
   * @param {Object} filters - Output of normalizeFilters.
   * @returns {number}
   */
  countStudents: function (filters) {
    var index = Students.index()
    var count = 0
    for (var srcode in index) {
      if (Reports.matches(index[srcode], filters)) count++
    }
    return count
  },

  /**
   * Builds the full report for an event.
   *
   * @param {string} eventId
   * @param {Object} [filters] - Optional college/program/yearLevel/gender.
   * @returns {Object}
   */
  get: function (eventId, filters) {
    var event = Events.assertById(eventId)
    var attendance = Attendance.list(eventId)
    var active = Reports.normalizeFilters(filters)
    var filtered = Reports.hasFilters(active)
    var scoped = filtered ? [] : attendance
    if (filtered) {
      for (var f = 0; f < attendance.length; f++) {
        if (Reports.matches(attendance[f], active)) scoped.push(attendance[f])
      }
    }
    var totalStudents = filtered ? Reports.countStudents(active) : Students.count()
    var totalScans = scoped.length
    var presentSrcodes = {}
    for (var i = 0; i < scoped.length; i++) {
      presentSrcodes[scoped[i].srcode] = true
    }
    var totalPresent = Object.keys(presentSrcodes).length
    var totalAbsent = Math.max(0, totalStudents - totalPresent)
    // Overall groups count distinct students (first scan wins), so shares
    // never exceed 100% on multi-day events.
    var seenSrcodes = {}
    var distinct = []
    for (var d = 0; d < scoped.length; d++) {
      if (!seenSrcodes[scoped[d].srcode]) {
        seenSrcodes[scoped[d].srcode] = true
        distinct.push(scoped[d])
      }
    }

    var byDay = {}
    var dayOrder = []
    for (var j = 0; j < scoped.length; j++) {
      var day = Attendance.dayKey(scoped[j].timestamp)
      if (!byDay[day]) {
        byDay[day] = []
        dayOrder.push(day)
      }
      byDay[day].push(scoped[j])
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
    var filters = {
      college: Validators.optionalString(body, "college", "College", 160),
      program: Validators.optionalString(body, "program", "Program", 160),
      yearLevel: Validators.optionalString(body, "yearLevel", "Year level", 160),
      gender: Validators.optionalString(body, "gender", "Gender", 160),
    }
    return Responses.ok("Attendance report generated.", {
      report: Reports.get(eventId, filters),
    })
  },
}