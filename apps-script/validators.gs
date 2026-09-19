/**
 * Request body parsing and field validation.
 */
var Validators = {
  /**
   * Parses the web app POST body into a plain object.
   *
   * @param {string} raw
   * @returns {Object}
   */
  parseBody: function (raw) {
    if (!raw || raw.trim() === "") {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "Request body is required.")
    }
    var parsed
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "Request body must be valid JSON.")
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "Request body must be a JSON object.")
    }
    return parsed
  },

  /**
   * Returns a trimmed non-empty string field, or throws.
   *
   * @param {Object} record
   * @param {string} field
   * @param {string} label - Human-readable name used in error messages.
   * @param {number} [maxLength]
   * @returns {string}
   */
  requireString: function (record, field, label, maxLength) {
    var value = record[field]
    if (typeof value !== "string" || value.trim() === "") {
      throw new AppError(Responses.CODES.INVALID_REQUEST, label + " is required.")
    }
    var trimmed = value.trim()
    if (maxLength && trimmed.length > maxLength) {
      throw new AppError(Responses.CODES.INVALID_REQUEST, label + " is too long.")
    }
    return trimmed
  },

  /**
   * Accepts YYYY-MM-DD or MM/DD/YYYY and normalizes to the sheet date format.
   *
   * @param {*} value
   * @returns {string}
   */
  normalizeDate: function (value) {
    if (value instanceof Date) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), Config.DATE_FORMAT)
    }
    if (typeof value !== "string" || value.trim() === "") {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "Event date is required.")
    }
    var text = value.trim()
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
    var parts
    if (match) {
      parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    } else {
      var usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
      if (usMatch) {
        parts = {
          month: Number(usMatch[1]),
          day: Number(usMatch[2]),
          year: Number(usMatch[3]),
        }
      }
    }
    if (!parts || !Validators.isValidDate(parts.year, parts.month, parts.day)) {
      throw new AppError(
        Responses.CODES.INVALID_REQUEST,
        "Event date is invalid. Use MM/DD/YYYY or YYYY-MM-DD."
      )
    }
    var date = new Date(parts.year, parts.month - 1, parts.day)
    return Utilities.formatDate(date, Session.getScriptTimeZone(), Config.DATE_FORMAT)
  },

  /**
   * @param {number} year
   * @param {number} month - 1..12
   * @param {number} day - 1..31
   * @returns {boolean}
   */
  isValidDate: function (year, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return false
    var test = new Date(year, month - 1, day)
    return test.getFullYear() === year && test.getMonth() === month - 1 && test.getDate() === day
  },
}