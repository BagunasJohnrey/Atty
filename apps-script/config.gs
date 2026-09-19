/**
 * Central configuration for the School Event Attendance System.
 *
 * This module is the single place where sheet names, column layouts,
 * statuses and limits are defined. Everything else in the backend reads
 * these values instead of hardcoding spreadsheet addresses.
 */
var Config = {
  MASTERLIST_SHEET: "Masterlist",
  EVENTS_SHEET: "Events",

  MASTERLIST_HEADERS: ["SRCODE", "Full Name", "College", "Program", "Year Level", "Gender"],
  EVENTS_HEADERS: ["Event ID", "Event Name", "Event Date", "Status", "Sheet Name"],
  ATTENDANCE_HEADERS: ["Timestamp", "SRCODE"],

  STATUS_UPCOMING: "Upcoming",
  STATUS_ACTIVE: "Active",
  STATUS_CLOSED: "Closed",

  DATE_FORMAT: "MM/dd/yyyy",
  TIME_FORMAT: "MM/dd/yyyy HH:mm:ss",

  ID_PREFIX: "EVT",
  ID_MIN_DIGITS: 3,

  DEFAULT_EVENT_STATUS: "Upcoming",
  ROW_START: 2,

  MAX_SRCODE_LENGTH: 20,
  MAX_EVENT_NAME_LENGTH: 150,

  SECRET_PROPERTY: "APPS_SCRIPT_SECRET",
  SPREADSHEET_KEY_PROPERTY: "SPREADSHEET_ID",

  COLUMNS: {
    MASTERLIST: {
      SRCODE: 0,
      FULL_NAME: 1,
      COLLEGE: 2,
      PROGRAM: 3,
      YEAR_LEVEL: 4,
      GENDER: 5,
    },
    EVENTS: {
      ID: 0,
      NAME: 1,
      DATE: 2,
      STATUS: 3,
      SHEET_NAME: 4,
    },
    ATTENDANCE: {
      TIMESTAMP: 0,
      SRCODE: 1,
    },
  },
}