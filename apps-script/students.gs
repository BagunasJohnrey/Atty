/**
 * Masterlist operations: student lookup, counting, and indexing.
 *
 * The Masterlist sheet is the single source of truth for student data.
 * It is only ever read here; no student data is ever written into event
 * attendance sheets.
 */
var Students = {
  /**
   * @returns {Student[]}
   */
  all: function () {
    var data = Sheets.getValues(Config.MASTERLIST_SHEET)
    var students = []
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var student = Models.studentFromRow(data[i])
      if (student.srcode) students.push(student)
    }
    return students
  },

  /**
   * Maps srcode -> Student for fast repeated lookups (one bulk read).
   *
   * @returns {Object.<string, Student>}
   */
  index: function () {
    var index = {}
    var students = Students.all()
    for (var i = 0; i < students.length; i++) {
      index[students[i].srcode] = students[i]
    }
    return index
  },

  /**
   * @param {string} srcode
   * @returns {Student|null}
   */
  getBySrcode: function (srcode) {
    return Students.index()[srcode] || null
  },

  /**
   * @returns {number}
   */
  count: function () {
    return Sheets.dataRowCount(Config.MASTERLIST_SHEET)
  },

  /**
   * Returns the student or throws when the srcode is unknown.
   *
   * @param {string} srcode
   * @returns {Student}
   */
  assertExists: function (srcode) {
    var student = Students.getBySrcode(srcode)
    if (!student) {
      throw new AppError(Responses.CODES.SRCODE_NOT_FOUND, "SRCODE not found in the Masterlist.")
    }
    return student
  },

  /**
   * API handler for "lookupStudent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleLookup: function (body) {
    var srcode = Validators.requireString(body, "srcode", "SRCODE", Config.MAX_SRCODE_LENGTH)
    return Responses.ok("Student found.", { student: Students.assertExists(srcode) })
  },
}