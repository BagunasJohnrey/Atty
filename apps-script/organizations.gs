/**
 * Organization registry operations.
 *
 * Organizations are the entities that use the attendance tracker. Each one
 * owns the letterhead identity a report needs — name, email, address, phone,
 * website — so a new customer no longer requires a code change. The Events
 * sheet references an organization by ID; see `Events.create` for why that
 * reference is optional.
 *
 * Structured as a mirror of `events.gs`: bulk reads, an in-memory scan for
 * lookups, and a script lock around ID assignment so two simultaneous creates
 * cannot claim the same number.
 */
var Organizations = {
  /**
   * Active organizations only.
   *
   * Soft-deleted rows are excluded here but NOT by `getById`, because the two
   * callers want opposite things: a picker or list must not offer a deleted
   * organization, while a report letterhead must keep resolving one so that
   * deleting an organization never rewrites the history of its past reports.
   *
   * @param {boolean} [includeDeleted]
   * @returns {Organization[]}
   */
  all: function (includeDeleted) {
    if (!Sheets.sheetByName(Config.ORGANIZATIONS_SHEET)) return []
    var data = Sheets.getValues(Config.ORGANIZATIONS_SHEET)
    var organizations = []
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var organization = Models.organizationFromRow(data[i])
      if (!organization) continue
      if (!includeDeleted && organization.deletedAt) continue
      organizations.push(organization)
    }
    return organizations
  },

  /**
   * Single bulk read, then an in-memory scan for the row.
   *
   * Resolves soft-deleted rows too. See `all` for why the two read paths
   * disagree.
   *
   * @param {string} orgId
   * @returns {Organization|null}
   */
  getById: function (orgId) {
    var target = String(orgId || "").trim()
    if (!target) return null
    var data = Sheets.getValues(Config.ORGANIZATIONS_SHEET)
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      if (String(data[i][Config.COLUMNS.ORGANIZATIONS.ID] || "").trim() === target) {
        return Models.organizationFromRow(data[i])
      }
    }
    return null
  },

  /**
   * @param {string} orgId
   * @returns {Organization}
   */
  assertById: function (orgId) {
    var organization = Organizations.getById(orgId)
    if (!organization) {
      throw new AppError(Responses.CODES.ORG_NOT_FOUND, "Organization not found.")
    }
    return organization
  },

  /**
   * Validates an org reference, treating a blank value as "no organization".
   *
   * The event form does not collect an organization yet, so an empty
   * reference is legitimate rather than an error. A non-empty one must resolve,
   * which is what stops a typo from silently attaching an event to nothing.
   *
   * @param {string} orgId
   */
  assertOptional: function (orgId) {
    var target = String(orgId || "").trim()
    if (!target) return ""
    Organizations.assertById(target)
    return target
  },

  /**
   * Creates an organization row. Only the name is required; the contact
   * fields default to "" so a minimal record is still report-ready.
   *
   * @param {string} name
   * @param {string} [email]
   * @param {string} [address]
   * @param {string} [phone]
   * @param {string} [website]
   * @returns {Organization}
   */
  create: function (name, email, address, phone, website) {
    var lock = LockService.getScriptLock()
    lock.waitLock(10000)
    try {
      Sheets.ensureHeaders(Config.ORGANIZATIONS_SHEET, Config.ORGANIZATIONS_HEADERS)
      var row = [
        Organizations.nextId(),
        name,
        email || "",
        address || "",
        phone || "",
        website || "",
        // Explicit, so the row width always matches ORGANIZATIONS_HEADERS.
        // A new organization is active; "" is what that means.
        "",
      ]
      Sheets.appendRow(Config.ORGANIZATIONS_SHEET, row)
      return Models.organizationFromRow(row)
    } finally {
      lock.releaseLock()
    }
  },

  /**
   * Updates mutable organization fields. Only keys present in the patch are
   * changed; omitted keys keep their values.
   *
   * @param {string} orgId
   * @param {Object} patch - May contain name, email, address, phone, website.
   * @returns {Organization}
   */
  update: function (orgId, patch) {
    var organization = Organizations.assertById(orgId)
    var row = Sheets.findRowByValue(
      Config.ORGANIZATIONS_SHEET,
      Config.COLUMNS.ORGANIZATIONS.ID,
      orgId
    )
    var columns = Config.COLUMNS.ORGANIZATIONS
    if (patch.name !== undefined) {
      organization.name = Validators.requireString(
        patch,
        "name",
        "Organization name",
        Config.MAX_ORG_NAME_LENGTH
      )
    }
    if (patch.email !== undefined) {
      organization.email = Validators.optionalString(
        patch,
        "email",
        "Organization email",
        Config.MAX_ORG_EMAIL_LENGTH
      )
    }
    if (patch.address !== undefined) {
      organization.address = Validators.optionalString(
        patch,
        "address",
        "Organization address",
        Config.MAX_ORG_ADDRESS_LENGTH
      )
    }
    if (patch.phone !== undefined) {
      organization.phone = Validators.optionalString(
        patch,
        "phone",
        "Organization phone",
        Config.MAX_ORG_PHONE_LENGTH
      )
    }
    if (patch.website !== undefined) {
      organization.website = Validators.optionalString(
        patch,
        "website",
        "Organization website",
        Config.MAX_ORG_WEBSITE_LENGTH
      )
    }
    Sheets.setCell(Config.ORGANIZATIONS_SHEET, row, columns.NAME + 1, organization.name)
    Sheets.setCell(Config.ORGANIZATIONS_SHEET, row, columns.EMAIL + 1, organization.email)
    Sheets.setCell(Config.ORGANIZATIONS_SHEET, row, columns.ADDRESS + 1, organization.address)
    Sheets.setCell(Config.ORGANIZATIONS_SHEET, row, columns.PHONE + 1, organization.phone)
    Sheets.setCell(Config.ORGANIZATIONS_SHEET, row, columns.WEBSITE + 1, organization.website)
    return organization
  },

  /**
   * Soft deletes an organization: stamps the Deleted column and keeps the row.
   *
   * The row is kept because events reference it. A hard delete would either
   * break every event pointing here or silently orphan them, and a report
   * letterhead that resolved to nothing would reprint as the default — a
   * quietly wrong document filed for an event that already happened.
   *
   * Idempotent, and a second delete keeps the original stamp so the time of
   * deletion stays the first one.
   *
   * @param {string} orgId
   * @returns {Organization}
   */
  delete: function (orgId) {
    var organization = Organizations.assertById(orgId)
    if (organization.deletedAt) return organization
    var row = Sheets.findRowByValue(
      Config.ORGANIZATIONS_SHEET,
      Config.COLUMNS.ORGANIZATIONS.ID,
      orgId
    )
    var stamp = Models.formatDateTime(new Date())
    Sheets.setCell(
      Config.ORGANIZATIONS_SHEET,
      row,
      Config.COLUMNS.ORGANIZATIONS.DELETED + 1,
      stamp
    )
    organization.deletedAt = stamp
    return organization
  },

  /**
   * Clears the Deleted stamp, returning the organization to the active list.
   * Idempotent; an already-active organization is returned unchanged.
   *
   * @param {string} orgId
   * @returns {Organization}
   */
  restore: function (orgId) {
    var organization = Organizations.assertById(orgId)
    if (!organization.deletedAt) return organization
    var row = Sheets.findRowByValue(
      Config.ORGANIZATIONS_SHEET,
      Config.COLUMNS.ORGANIZATIONS.ID,
      orgId
    )
    Sheets.setCell(
      Config.ORGANIZATIONS_SHEET,
      row,
      Config.COLUMNS.ORGANIZATIONS.DELETED + 1,
      ""
    )
    organization.deletedAt = ""
    return organization
  },

  /**
   * Assembles the next Org ID by scanning existing IDs and incrementing the
   * highest numeric suffix, e.g. ORG-002 -> ORG-003.
   *
   * Scans deleted rows too: an ID is spent once assigned, so reusing ORG-007
   * for a new organization would give two different organizations the same id
   * and make `getById` ambiguous.
   *
   * @returns {string}
   */
  nextId: function () {
    var organizations = Organizations.all(true)
    var maxSequence = 0
    for (var i = 0; i < organizations.length; i++) {
      var match = /^ORG-(\d+)$/i.exec(organizations[i].id)
      if (match) maxSequence = Math.max(maxSequence, Number(match[1]))
    }
    var next = String(maxSequence + 1)
    while (next.length < Config.ID_MIN_DIGITS) next = "0" + next
    return Config.ORG_ID_PREFIX + "-" + next
  },

  /**
   * API handler for "getOrganizations".
   *
   * @returns {Object}
   */
  handleList: function () {
    return Responses.ok("Organizations retrieved successfully.", {
      organizations: Organizations.all(),
    })
  },

  /**
   * API handler for "getOrganization".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleGet: function (body) {
    var orgId = Validators.requireString(body, "orgId", "Organization ID", Config.MAX_ORG_ID_LENGTH)
    return Responses.ok("Organization retrieved successfully.", {
      organization: Organizations.assertById(orgId),
    })
  },

  /**
   * API handler for "createOrganization".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleCreate: function (body) {
    var name = Validators.requireString(body, "name", "Organization name", Config.MAX_ORG_NAME_LENGTH)
    var email = Validators.optionalString(body, "email", "Organization email", Config.MAX_ORG_EMAIL_LENGTH)
    var address = Validators.optionalString(body, "address", "Organization address", Config.MAX_ORG_ADDRESS_LENGTH)
    var phone = Validators.optionalString(body, "phone", "Organization phone", Config.MAX_ORG_PHONE_LENGTH)
    var website = Validators.optionalString(body, "website", "Organization website", Config.MAX_ORG_WEBSITE_LENGTH)
    return Responses.ok("Organization created successfully.", {
      organization: Organizations.create(name, email, address, phone, website),
    })
  },

  /**
   * API handler for "deleteOrganization".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleDelete: function (body) {
    var orgId = Validators.requireString(body, "orgId", "Organization ID", Config.MAX_ORG_ID_LENGTH)
    return Responses.ok("Organization deleted successfully.", {
      organization: Organizations.delete(orgId),
    })
  },

  /**
   * API handler for "restoreOrganization".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleRestore: function (body) {
    var orgId = Validators.requireString(body, "orgId", "Organization ID", Config.MAX_ORG_ID_LENGTH)
    return Responses.ok("Organization restored successfully.", {
      organization: Organizations.restore(orgId),
    })
  },

  /**
   * API handler for "updateOrganization". Accepts any subset of name, email,
   * address, phone, and website; rejects unknown keys so typos fail loudly
   * instead of being silently ignored.
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleUpdate: function (body) {
    var orgId = Validators.requireString(body, "orgId", "Organization ID", Config.MAX_ORG_ID_LENGTH)
    var allowed = ["name", "email", "address", "phone", "website"]
    var patch = {}
    for (var key in body) {
      if (key === "secret" || key === "action" || key === "orgId") continue
      if (allowed.indexOf(key) < 0) {
        throw new AppError(Responses.CODES.INVALID_REQUEST, "Unknown field: " + key)
      }
      patch[key] = body[key]
    }
    return Responses.ok("Organization updated successfully.", {
      organization: Organizations.update(orgId, patch),
    })
  },
}
