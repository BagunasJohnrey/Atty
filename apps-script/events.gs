/**
 * Event registry operations.
 *
 * The Events sheet holds one row per event and each event owns a dedicated
 * attendance sheet named after its Event ID.
 */
var Events = {
  /**
   * @returns {SchoolEvent[]}
   */
  all: function () {
    if (!Sheets.sheetByName(Config.EVENTS_SHEET)) return []
    var data = Sheets.getValues(Config.EVENTS_SHEET)
    var events = []
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var event = Models.eventFromRow(data[i])
      if (event) events.push(event)
    }
    return events
  },

  /**
   * @param {string} eventId
   * @returns {SchoolEvent|null}
   */
  getById: function (eventId) {
    var row = Sheets.findRowByValue(Config.EVENTS_SHEET, Config.COLUMNS.EVENTS.ID, eventId)
    if (row < 0) return null
    var data = Sheets.getValues(Config.EVENTS_SHEET)
    return Models.eventFromRow(data[row - 1])
  },

  /**
   * @param {string} eventId
   * @returns {SchoolEvent}
   */
  assertById: function (eventId) {
    var event = Events.getById(eventId)
    if (!event) throw new AppError(Responses.CODES.EVENT_NOT_FOUND, "Event not found.")
    return event
  },

  /**
   * Throws unless the event currently accepts attendance.
   *
   * @param {SchoolEvent} event
   */
  assertCanRecord: function (event) {
    if (event.status === Config.STATUS_ACTIVE) return
    if (event.status === Config.STATUS_CLOSED) {
      throw new AppError(
        Responses.CODES.EVENT_NOT_ACTIVE,
        "The event is closed and no longer accepts attendance."
      )
    }
    throw new AppError(Responses.CODES.EVENT_NOT_ACTIVE, "The event is not active yet.")
  },

  /**
   * Creates an event, its registry row, and its attendance sheet.
   *
   * @param {string} name
   * @param {string} date
   * @returns {SchoolEvent}
   */
  create: function (name, date) {
    var id = Events.nextIdAfterEnsuringRegistry()
    Sheets.writeHeaders(id, Config.ATTENDANCE_HEADERS)
    Sheets.appendRow(Config.EVENTS_SHEET, [id, name, date, Config.DEFAULT_EVENT_STATUS, id])
    return Models.eventFromRow([id, name, date, Config.DEFAULT_EVENT_STATUS, id])
  },

  /**
   * Ensures the Events registry exists before scanning it for the next ID,
   * so the very first event can be created on a fresh spreadsheet.
   *
   * @returns {string} The next available Event ID.
   */
  nextIdAfterEnsuringRegistry: function () {
    Sheets.writeHeaders(Config.EVENTS_SHEET, Config.EVENTS_HEADERS)
    return Events.nextId()
  },

  /**
   * Assembles the next Event ID by scanning existing IDs and incrementing
   * the highest numeric suffix, e.g. EVT-003 -> EVT-004.
   *
   * @returns {string}
   */
  nextId: function () {
    var events = Events.all()
    var maxSequence = 0
    for (var i = 0; i < events.length; i++) {
      var match = /^EVT-(\d+)$/i.exec(events[i].id)
      if (match) maxSequence = Math.max(maxSequence, Number(match[1]))
    }
    var next = String(maxSequence + 1)
    while (next.length < Config.ID_MIN_DIGITS) next = "0" + next
    return Config.ID_PREFIX + "-" + next
  },

  /**
   * Marks an event as Closed. Attendance records are preserved.
   *
   * @param {string} eventId
   * @returns {SchoolEvent}
   */
  close: function (eventId) {
    var event = Events.assertById(eventId)
    if (event.status === Config.STATUS_CLOSED) return event
    var row = Sheets.findRowByValue(Config.EVENTS_SHEET, Config.COLUMNS.EVENTS.ID, eventId)
    Sheets.setCell(Config.EVENTS_SHEET, row, Config.COLUMNS.EVENTS.STATUS + 1, Config.STATUS_CLOSED)
    event.status = Config.STATUS_CLOSED
    return event
  },

  /**
   * Marks an event as Active so it starts accepting attendance.
   * Closed events cannot be reopened; attendance records are never touched.
   *
   * @param {string} eventId
   * @returns {SchoolEvent}
   */
  open: function (eventId) {
    var event = Events.assertById(eventId)
    if (event.status === Config.STATUS_ACTIVE) return event
    if (event.status === Config.STATUS_CLOSED) {
      throw new AppError(
        Responses.CODES.EVENT_NOT_ACTIVE,
        "The event is closed and cannot be reopened."
      )
    }
    var row = Sheets.findRowByValue(Config.EVENTS_SHEET, Config.COLUMNS.EVENTS.ID, eventId)
    Sheets.setCell(Config.EVENTS_SHEET, row, Config.COLUMNS.EVENTS.STATUS + 1, Config.STATUS_ACTIVE)
    event.status = Config.STATUS_ACTIVE
    return event
  },

  /**
   * API handler for "getEvents".
   *
   * @returns {Object}
   */
  handleList: function () {
    return Responses.ok("Events retrieved successfully.", { events: Events.all() })
  },

  /**
   * API handler for "getEvent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleGet: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    return Responses.ok("Event retrieved successfully.", { event: Events.assertById(eventId) })
  },

  /**
   * API handler for "createEvent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleCreate: function (body) {
    var name = Validators.requireString(body, "name", "Event name", Config.MAX_EVENT_NAME_LENGTH)
    var date = Validators.normalizeDate(body.date)
    return Responses.ok("Event created successfully.", { event: Events.create(name, date) })
  },

  /**
   * API handler for "closeEvent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleClose: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    return Responses.ok("Event closed successfully.", { event: Events.close(eventId) })
  },

  /**
   * API handler for "openEvent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleOpen: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    return Responses.ok("Event opened successfully.", { event: Events.open(eventId) })
  },
}