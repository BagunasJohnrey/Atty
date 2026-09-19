/**
 * Request authentication.
 *
 * The web app is invoked by the Next.js server (not by end users), so access
 * is controlled with a shared application secret rather than Google accounts.
 * The secret lives in a Script Property and is compared in constant time.
 */
var Auth = {
  /**
   * @returns {string|null}
   */
  expectedSecret: function () {
    return PropertiesService.getScriptProperties().getProperty(Config.SECRET_PROPERTY)
  },

  /**
   * Throws when the provided secret does not match the stored script property.
   *
   * @param {*} provided
   */
  verify: function (provided) {
    var expected = Auth.expectedSecret()
    if (!expected) {
      throw new AppError(
        Responses.CODES.CONFIGURATION_ERROR,
        "APPS_SCRIPT_SECRET is not configured in the script properties."
      )
    }
    if (typeof provided !== "string" || !Auth.safeCompare(provided, expected)) {
      throw new AppError(Responses.CODES.UNAUTHORIZED, "Invalid or missing API secret.")
    }
  },

  /**
   * Compares two strings without short-circuiting on the first difference.
   *
   * @param {string} provided
   * @param {string} expected
   * @returns {boolean}
   */
  safeCompare: function (provided, expected) {
    if (provided.length !== expected.length) return false
    var result = 0
    for (var i = 0; i < provided.length; i++) {
      result |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
    }
    return result === 0
  },
}