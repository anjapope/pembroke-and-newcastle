(function () {
  "use strict";

  const PAGE_SIZE = 20;
  const VALID_STATUSES = new Set(["draft", "saved", "submitted", "returned", "processed"]);
  const REQUIRED_JUSTIFICATION_CATEGORIES = new Set([
    "archive-special-collections",
    "museum-cultural-heritage",
    "school-library-media-center"
  ]);
  const directPurchaseMessage = "Direct purchasing privileges are not assigned to your account. Please save your requisition and forward it to Technical Services using the established procedure.";
  const categoryFilter = document.getElementById("catalog-category");
  const formatFilter = document.getElementById("catalog-format");
  const filterForm = document.getElementById("catalog-filters");
  const resultBody = document.getElementById("catalog-results");
  const lineBody = document.getElementById("worksheet-lines");
  const historyBody = document.getElementById("requisition-history");
  const detailDialog = document.getElementById("catalog-detail");
  const detailAddButton = document.getElementById("detail-add");
  const acquisitionNotice = document.getElementById("acq-notice");
  let catalog = [];
  let catalogById = new Map();
  let pageNumber = 1;
  let detailItem = null;
  let dataReady = false;
  let dataError = null;
  let sessionError = null;

  function getSession() {
    return window.PN_APP.getSession();
  }

  function getInstitution(session = getSession()) {
    return session ? window.PN_INSTITUTIONS.find(item => item.id === session.categoryId) : null;
  }

  function showNotice(message, isError = false) {
    acquisitionNotice.textContent = message;
    acquisitionNotice.dataset.error = String(isError);
    acquisitionNotice.hidden = !message;
  }

  function formatMoney(cents) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  function parseCents(value) {
    const text = String(value).trim();
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) return null;
    const [dollars, cents = ""] = text.split(".");
    const amount = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
    return Number.isSafeInteger(amount) ? amount : null;
  }

  function isSafeCents(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  function itemTotal(line) {
    if (!Number.isSafeInteger(line?.quantity) || line.quantity < 1 ||
        !Number.isSafeInteger(line?.unitPriceCents) || line.unitPriceCents < 0) {
      throw new Error("A requisition line contains an invalid quantity or unit price.");
    }
    const total = line.unitPriceCents * line.quantity;
    if (!Number.isSafeInteger(total)) throw new Error("A requisition line exceeds safe price arithmetic limits.");
    return total;
  }

  function linesTotal(lines) {
    const total = lines.reduce((sum, line) => sum + itemTotal(line), 0);
    if (!Number.isSafeInteger(total)) throw new Error("The requisition exceeds safe price arithmetic limits.");
    return total;
  }

  function totalQuantity(lines) {
    return lines.reduce((sum, line) =>
      sum + (Number.isSafeInteger(line?.quantity) && line.quantity > 0 ? line.quantity : 0), 0);
  }

  function worksheetTotal(lines) {
    if (!Array.isArray(lines) || lines.some(line =>
      !Number.isSafeInteger(line?.quantity) || line.quantity < 1 ||
      !Number.isSafeInteger(line?.unitPriceCents) || line.unitPriceCents < 0
    )) return null;
    const total = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
    return Number.isSafeInteger(total) ? total : null;
  }

  function selectedCollectionCodes(institution) {
    return new Set(institution.collectionLines.map(item => item.code));
  }

  function selectedFundCodes(institution) {
    return new Set(institution.funds.map(item => item.code));
  }

  function processedTotal(session = getSession()) {
    if (!session) return 0;
    const processed = new Map();
    for (const requisition of session.orders) {
      if (requisition.status !== "processed" || processed.has(requisition.id)) continue;
      const amount = requisition.processingRecord?.totalCents;
      if (!Number.isSafeInteger(amount) || amount <= 0 ||
          amount !== requisition.totalCents ||
          !Number.isFinite(Date.parse(requisition.processingRecord?.processedAt))) {
        throw new Error("Processing history contains an invalid financial record. Further spending is unavailable.");
      }
      processed.set(requisition.id, amount);
    }
    const total = [...processed.values()].reduce((sum, amount) => sum + amount, 0);
    if (!Number.isSafeInteger(total)) throw new Error("Committed expenditures exceed safe financial calculation limits.");
    return total;
  }

  function budgetDetails(session = getSession()) {
    const institution = getInstitution(session);
    if (!session || !institution) return null;
    const allocationCents = institution.annualBudget * 100;
    const committedCents = processedTotal(session);
    if (committedCents > allocationCents) {
      throw new Error("Processing history exceeds the annual allocation. Correct the saved data before continuing.");
    }
    return {
      allocationCents,
      committedCents,
      availableCents: allocationCents - committedCents
    };
  }

  function refreshBudget() {
    if (sessionError) return false;
    const details = budgetDetails();
    if (!details) return false;
    document.getElementById("dashboard-allocation").textContent = formatMoney(details.allocationCents);
    document.getElementById("dashboard-committed").textContent = formatMoney(details.committedCents);
    document.getElementById("dashboard-available").textContent = formatMoney(details.availableCents);
    renderWorksheet();
    renderHistories();
    return true;
  }

  function isValidCatalogRecord(item) {
    return Boolean(
      item &&
      typeof item.id === "string" && item.id.trim() &&
      typeof item.title === "string" && item.title.trim() &&
      typeof item.creator === "string" &&
      typeof item.materialCategory === "string" && item.materialCategory.trim() &&
      typeof item.format === "string" && item.format.trim() &&
      typeof item.description === "string" &&
      isSafeCents(item.unitPriceCents) && item.unitPriceCents > 0 &&
      Number.isSafeInteger(item.maxQuantity) && item.maxQuantity > 0 &&
      typeof item.unique === "boolean" &&
      (!item.unique || item.maxQuantity === 1)
    );
  }

  function validateStoredLine(line, institution, validateCodes = true) {
    if (!line || typeof line !== "object" || Array.isArray(line)) return false;
    const item = catalogById.get(line.catalogId);
    return Boolean(
      item &&
      Number.isSafeInteger(line.quantity) &&
      line.quantity > 0 && line.quantity <= item.maxQuantity &&
      Number.isSafeInteger(line.unitPriceCents) && line.unitPriceCents === item.unitPriceCents &&
      Number.isSafeInteger(line.extendedPriceCents) && line.extendedPriceCents === line.unitPriceCents * line.quantity &&
      typeof line.collectionCode === "string" && line.collectionCode &&
      typeof line.fundCode === "string" && line.fundCode &&
      (!validateCodes || selectedCollectionCodes(institution).has(line.collectionCode)) &&
      (!validateCodes || selectedFundCodes(institution).has(line.fundCode)) &&
      typeof line.selectorNote === "string"
    );
  }

  function migrateSubmissionHistory(session) {
    let changed = false;
    const orders = session.orders.map(order => {
      if (Array.isArray(order.submissionAttempts)) return order;
      changed = true;
      const attempts = [];
      if (order.submittedSnapshot && typeof order.submittedSnapshot === "object") {
        const snapshot = {
          ...order.submittedSnapshot,
          clientId: order.submittedSnapshot.clientId || order.clientId || session.clientId,
          submittedAt: order.submittedSnapshot.submittedAt || order.submittedAt
        };
        attempts.push({
          revision: 1,
          submittedAt: snapshot.submittedAt,
          snapshot,
          validationOutcome: null,
          correspondence: [],
          financialAcknowledgment: snapshot.financialAcknowledgment || null
        });
      }
      return {
        ...order,
        submissionAttempts: attempts,
        correspondence: Array.isArray(order.correspondence) ? order.correspondence : []
      };
    });
    return { orders, changed };
  }

  function normalizeSession() {
    const session = getSession();
    if (!session || !session.setupComplete) return;
    const institution = getInstitution(session);
    if (!institution) throw new Error("The saved profile has an unknown institution category.");
    if (!Array.isArray(session.cart) || !Array.isArray(session.orders)) {
      throw new Error("Saved requisition data is invalid; the worksheet was not changed.");
    }
    const activeRequisition = session.activeRequisitionId
      ? session.orders.find(order => order.id === session.activeRequisitionId)
      : null;
    if (activeRequisition?.status !== "returned" &&
        session.cart.some(line => !validateStoredLine(line, institution, false))) {
      throw new Error("The saved worksheet contains invalid or outdated line data. No requisition data was changed.");
    }
    const migration = migrateSubmissionHistory(session);
    if (new Set(migration.orders.map(order => order?.id)).size !== migration.orders.length) {
      throw new Error("Saved requisition history contains duplicate requisition identifiers.");
    }
    for (const requisition of migration.orders) {
      if (!requisition || typeof requisition !== "object" ||
          typeof requisition.id !== "string" || !requisition.id ||
          !VALID_STATUSES.has(requisition.status) ||
          !Array.isArray(requisition.lines) ||
          !Number.isSafeInteger(requisition.totalCents) ||
          !Number.isFinite(Date.parse(requisition.createdAt)) ||
          !Number.isFinite(Date.parse(requisition.modifiedAt)) ||
          !Array.isArray(requisition.submissionAttempts) ||
          !Array.isArray(requisition.correspondence)) {
        throw new Error("Saved requisition history contains invalid data. No requisition data was changed.");
      }
      for (const [index, attempt] of requisition.submissionAttempts.entries()) {
        const snapshot = attempt?.snapshot;
        if (!attempt || attempt.revision !== index + 1 ||
            !Number.isFinite(Date.parse(attempt.submittedAt)) ||
            !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) ||
            !Array.isArray(snapshot.lines) ||
            !Array.isArray(attempt.correspondence)) {
          throw new Error("Submission history contains an invalid immutable snapshot.");
        }
      }
      if (["submitted", "returned", "processed"].includes(requisition.status) &&
          !requisition.submissionAttempts.length) {
        throw new Error("A reviewed requisition is missing its original submission record.");
      }
      if (requisition.status === "processed" &&
          (!requisition.processingRecord ||
           !Number.isFinite(Date.parse(requisition.processingRecord.processedAt)) ||
           requisition.processingRecord.totalCents !== requisition.totalCents)) {
        throw new Error("A processed requisition is missing a valid processing record.");
      }
    }

    const updates = {};
    if (session.schemaVersion !== 3) updates.schemaVersion = 3;
    if (migration.changed) updates.orders = migration.orders;
    if (!Number.isSafeInteger(session.requisitionSequence) || session.requisitionSequence < 0) {
      updates.requisitionSequence = session.orders.length;
    }
    if (session.activeRequisitionId !== null && typeof session.activeRequisitionId !== "string") {
      updates.activeRequisitionId = null;
    }
    if (Object.keys(updates).length) window.PN_APP.updateSession(updates);
  }

  function currentLines() {
    const session = getSession();
    return session && Array.isArray(session.cart) ? session.cart : [];
  }

  function currentRequisition() {
    const session = getSession();
    return session?.activeRequisitionId
      ? session.orders.find(order => order.id === session.activeRequisitionId) || null
      : null;
  }

  function isReadOnlyWorksheet() {
    const active = currentRequisition();
    return Boolean(active && ["submitted", "processed"].includes(active.status));
  }

  function makeOptions(select, options, selected, includeMissing = false) {
    select.replaceChildren();
    if (includeMissing && (!selected || !options.some(option => option.code === selected))) {
      const invalid = document.createElement("option");
      invalid.value = "";
      invalid.textContent = "Select a code";
      select.append(invalid);
    }
    for (const option of options) {
      const element = document.createElement("option");
      element.value = option.code;
      element.textContent = `${option.code} — ${option.label}`;
      select.append(element);
    }
    select.value = options.some(option => option.code === selected)
      ? selected
      : (includeMissing ? "" : (options[0]?.code || ""));
  }

  function makeCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }

  function appendEmptyRow(body, message, columnCount) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columnCount;
    cell.textContent = message;
    row.append(cell);
    body.replaceChildren(row);
  }

  function setSelectDisabled(select, disabled) {
    select.disabled = disabled;
    select.classList.toggle("is-disabled", disabled);
  }

  function renderFinancialSummary(lines, institution, budget, readOnly) {
    const proposedCents = worksheetTotal(lines);
    const projectedCents = proposedCents === null ? null : budget.availableCents - proposedCents;
    document.getElementById("worksheet-allocation").textContent = formatMoney(budget.allocationCents);
    document.getElementById("worksheet-committed").textContent = formatMoney(budget.committedCents);
    document.getElementById("worksheet-available").textContent = formatMoney(budget.availableCents);
    document.getElementById("worksheet-proposed").textContent = proposedCents === null ? "Correct invalid quantities" : formatMoney(proposedCents);
    document.getElementById("worksheet-projected").textContent = projectedCents === null ? "Unavailable" : formatMoney(projectedCents);
    document.getElementById("item-count").textContent = `${totalQuantity(lines)} item${totalQuantity(lines) === 1 ? "" : "s"} across ${lines.length} requisition line${lines.length === 1 ? "" : "s"}${readOnly ? " · Submitted requisitions are read-only." : ""}`;

    const thresholdReached = proposedCents !== null &&
      (budget.committedCents + proposedCents) * 100 >= budget.allocationCents * 80;
    const warning = document.getElementById("budget-warning");
    warning.hidden = !lines.length || !thresholdReached;
    warning.textContent = warning.hidden
      ? ""
      : `Early-fiscal-year budget warning: committed spending plus this proposed requisition would use ${formatMoney(budget.committedCents + proposedCents)} of the ${formatMoney(budget.allocationCents)} annual allocation (80% or more). Confirm explicitly before forwarding.`;
    const overspend = document.getElementById("overspend-warning");
    const excess = proposedCents === null ? 0 : proposedCents - budget.availableCents;
    overspend.hidden = !lines.length || (proposedCents !== null && excess <= 0);
    overspend.textContent = overspend.hidden
      ? ""
      : proposedCents === null
        ? "One or more requisition quantities are invalid. Correct them before saving or resubmitting."
        : `This requisition exceeds the available annual balance by ${formatMoney(excess)}. Reduce the proposed expenditure before forwarding; quantities have not been changed.`;

    const justificationRequired = REQUIRED_JUSTIFICATION_CATEGORIES.has(institution.id) &&
      proposedCents !== null && proposedCents * 100 >= budget.allocationCents * 80 && proposedCents > 0;
    const justification = document.getElementById("requisition-justification");
    justification.required = justificationRequired;
    document.getElementById("justification-hint").textContent = justificationRequired
      ? "Required for this institution because this single requisition is at least 80% of the annual allocation."
      : "Optional unless this single requisition reaches 80% of the annual allocation for a school, archive, or museum.";
    const active = currentRequisition();
    const returningCorrections = active?.status === "returned";
    const saveButton = document.getElementById("save-requisition");
    saveButton.disabled = readOnly;
    saveButton.textContent = returningCorrections ? "Save corrections" : "Save requisition";
    const resubmitButton = document.getElementById("resubmit-requisition");
    resubmitButton.hidden = !returningCorrections;
    const savedCorrections = returningCorrections &&
      JSON.stringify(lines) === JSON.stringify(active.lines) &&
      (getSession()?.workingJustification || "") === (active.justification || "");
    resubmitButton.disabled = !savedCorrections;
    resubmitButton.title = savedCorrections
      ? "Submit this corrected revision for a new review."
      : "Save all corrections before resubmitting.";
    document.getElementById("new-requisition").disabled = false;
    document.getElementById("direct-purchase").disabled = false;
  }

  function renderWorksheet() {
    if (sessionError) {
      appendEmptyRow(lineBody, `Requisition data is unavailable: ${sessionError}`, 8);
      return;
    }
    const session = getSession();
    const institution = getInstitution(session);
    const budget = budgetDetails(session);
    if (!session || !session.setupComplete || !institution || !budget) {
      appendEmptyRow(lineBody, "Sign in and complete an institutional profile to prepare requisitions.", 8);
      return;
    }
    const lines = currentLines();
    const readOnly = isReadOnlyWorksheet();
    renderFinancialSummary(lines, institution, budget, readOnly);
    document.getElementById("requisition-justification").disabled = readOnly;
    document.getElementById("requisition-justification").value = session.workingJustification ?? currentRequisition()?.justification ?? "";

    if (!lines.length) {
      appendEmptyRow(lineBody, "No items yet. Browse the catalog and add selections to this worksheet.", 8);
    } else {
      const rows = lines.map((line, index) => {
        const item = catalogById.get(line.catalogId);
        const row = document.createElement("tr");
        const name = document.createElement("td");
        const title = document.createElement("strong");
        title.textContent = item?.title || line.title || "Unknown catalog item";
        const identifier = document.createElement("span");
        identifier.className = "table-subtitle";
        identifier.textContent = item?.id || line.catalogId;
        name.append(title, identifier);
        row.append(name);

        const quantityCell = document.createElement("td");
        const quantity = document.createElement("input");
        quantity.type = "number";
        quantity.min = "1";
        quantity.max = String(item?.maxQuantity || 1);
        quantity.step = "1";
        quantity.value = String(line.quantity);
        quantity.setAttribute("aria-label", `Quantity for ${item?.title || line.catalogId}`);
        quantity.dataset.index = String(index);
        quantity.dataset.field = "quantity";
        quantity.disabled = readOnly;
        quantityCell.append(quantity);
        row.append(quantityCell);
        row.append(makeCell(Number.isSafeInteger(line.unitPriceCents) && line.unitPriceCents >= 0
          ? formatMoney(line.unitPriceCents)
          : "Invalid price"));
        const extendedPrice = worksheetTotal([line]);
        row.append(makeCell(extendedPrice === null ? "Invalid quantity or price" : formatMoney(extendedPrice)));

        const collectionCell = document.createElement("td");
        const collection = document.createElement("select");
        collection.dataset.index = String(index);
        collection.dataset.field = "collectionCode";
        collection.setAttribute("aria-label", `Collection line for ${item?.title || line.catalogId}`);
        makeOptions(collection, institution.collectionLines, line.collectionCode, true);
        setSelectDisabled(collection, readOnly);
        collectionCell.append(collection);
        row.append(collectionCell);

        const fundCell = document.createElement("td");
        const fund = document.createElement("select");
        fund.dataset.index = String(index);
        fund.dataset.field = "fundCode";
        fund.setAttribute("aria-label", `Fund for ${item?.title || line.catalogId}`);
        makeOptions(fund, institution.funds, line.fundCode, true);
        setSelectDisabled(fund, readOnly);
        fundCell.append(fund);
        row.append(fundCell);

        const noteCell = document.createElement("td");
        const note = document.createElement("input");
        note.type = "text";
        note.maxLength = 300;
        note.value = typeof line.selectorNote === "string" ? line.selectorNote : "";
        note.placeholder = "Optional note";
        note.setAttribute("aria-label", `Selector note for ${item?.title || line.catalogId}`);
        note.dataset.index = String(index);
        note.dataset.field = "selectorNote";
        note.disabled = readOnly;
        noteCell.append(note);
        row.append(noteCell);

        const actionCell = document.createElement("td");
        const remove = document.createElement("button");
        remove.className = "button button-secondary compact-button";
        remove.type = "button";
        remove.textContent = "Remove";
        remove.dataset.removeIndex = String(index);
        remove.disabled = readOnly;
        actionCell.append(remove);
        row.append(actionCell);
        return row;
      });
      lineBody.replaceChildren(...rows);
    }

  }

  function readFilters() {
    const minText = document.getElementById("catalog-min-price").value;
    const maxText = document.getElementById("catalog-max-price").value;
    return {
      query: document.getElementById("catalog-search").value.trim().toLocaleLowerCase(),
      category: categoryFilter.value,
      format: formatFilter.value,
      minPriceCents: minText ? parseCents(minText) : null,
      maxPriceCents: maxText ? parseCents(maxText) : null,
      sort: document.getElementById("catalog-sort").value
    };
  }

  function filterCatalog(records, filters) {
    const query = String(filters.query || "").trim().toLocaleLowerCase();
    return records.filter(item => {
      const searchable = [
        item.id, item.title, item.creator, item.catalogGroup, item.materialCategory, item.format,
        item.creationDate, item.publisherDescription, item.description,
        JSON.stringify(item.metadata || {})
      ].join(" ").toLocaleLowerCase();
      return (!query || searchable.includes(query)) &&
        (!filters.category || item.materialCategory === filters.category) &&
        (!filters.format || item.format === filters.format) &&
        (filters.minPriceCents === null || filters.minPriceCents === undefined ||
          item.unitPriceCents >= filters.minPriceCents) &&
        (filters.maxPriceCents === null || filters.maxPriceCents === undefined ||
          item.unitPriceCents <= filters.maxPriceCents);
    }).sort((left, right) => {
      if (filters.sort === "price-asc") return left.unitPriceCents - right.unitPriceCents || left.title.localeCompare(right.title);
      if (filters.sort === "price-desc") return right.unitPriceCents - left.unitPriceCents || left.title.localeCompare(right.title);
      return filters.sort === "title-desc"
        ? right.title.localeCompare(left.title)
        : left.title.localeCompare(right.title);
    });
  }

  function pageCatalog(records, page, pageSize = PAGE_SIZE) {
    if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error("Catalog page size must be a positive whole number.");
    const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    return { items: records.slice(start, start + pageSize), currentPage, totalPages, total: records.length };
  }

  function renderCatalog() {
    if (!dataReady) {
      appendEmptyRow(resultBody, dataError || "Loading the catalog…", 5);
      return;
    }
    const filtered = filterCatalog(catalog, readFilters());
    const result = pageCatalog(filtered, pageNumber);
    pageNumber = result.currentPage;
    document.getElementById("catalog-count").textContent = `${result.total} result${result.total === 1 ? "" : "s"} · ${catalog.length} shared catalog records`;
    document.getElementById("catalog-page-indicator").textContent = `Page ${result.currentPage} of ${result.totalPages}`;
    document.getElementById("catalog-previous").disabled = result.currentPage <= 1;
    document.getElementById("catalog-next").disabled = result.currentPage >= result.totalPages;
    if (!result.items.length) {
      appendEmptyRow(resultBody, "No catalog records match these filters.", 5);
      return;
    }
    const rows = result.items.map(item => {
      const row = document.createElement("tr");
      const titleCell = document.createElement("td");
      const title = document.createElement("strong");
      title.textContent = item.title;
      const creator = document.createElement("span");
      creator.className = "table-subtitle";
      creator.textContent = `${item.creator || "Creator not supplied"} · ${item.id}`;
      titleCell.append(title, creator);
      row.append(titleCell);
      row.append(makeCell(`${item.materialCategory} · ${item.format}`));
      row.append(makeCell(formatMoney(item.unitPriceCents)));
      row.append(makeCell(item.availability));
      const actionCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "table-actions";
      const details = document.createElement("button");
      details.type = "button";
      details.className = "button button-secondary compact-button";
      details.textContent = "Details";
      details.dataset.detailId = item.id;
      const add = document.createElement("button");
      add.type = "button";
      add.className = "button button-primary compact-button";
      add.textContent = "Add";
      add.dataset.addId = item.id;
      actions.append(details, add);
      actionCell.append(actions);
      row.append(actionCell);
      return row;
    });
    resultBody.replaceChildren(...rows);
  }

  function populateCatalogFilters() {
    const categories = [...new Set(catalog.map(item => item.materialCategory))].sort();
    const formats = [...new Set(catalog.map(item => item.format))].sort();
    for (const [select, values] of [[categoryFilter, categories], [formatFilter, formats]]) {
      for (const value of values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.append(option);
      }
    }
  }

  function addToWorksheet(item) {
    const session = getSession();
    const institution = getInstitution(session);
    if (!session?.setupComplete || !institution) throw new Error("Complete an institutional profile before selecting acquisitions.");
    if (isReadOnlyWorksheet()) throw new Error("Submitted requisitions are read-only. Start a new requisition to continue.");
    const lines = currentLines().map(line => ({ ...line }));
    const existing = lines.find(line => line.catalogId === item.id);
    if (existing) {
      if (item.unique || existing.quantity >= item.maxQuantity) {
        throw new Error(`${item.title} is limited to ${item.maxQuantity} ${item.maxQuantity === 1 ? "item" : "copies"}.`);
      }
      existing.quantity += 1;
      existing.extendedPriceCents = itemTotal(existing);
    } else {
      lines.push({
        catalogId: item.id,
        title: item.title,
        quantity: 1,
        unitPriceCents: item.unitPriceCents,
        extendedPriceCents: item.unitPriceCents,
        collectionCode: institution.collectionLines[0].code,
        fundCode: institution.funds[0].code,
        selectorNote: ""
      });
    }
    window.PN_APP.updateSession({ cart: lines });
    renderWorksheet();
    showNotice(`${item.title} added to the worksheet. Assign its collection line and fund before saving.`, false);
  }

  function addMetadataRow(parent, label, value) {
    const wrapper = document.createElement("div");
    const heading = document.createElement("dt");
    heading.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value || "Not supplied";
    wrapper.append(heading, detail);
    parent.append(wrapper);
  }

  function showItemDetails(item, allowAdd = true) {
    detailItem = allowAdd ? item : null;
    document.getElementById("detail-title").textContent = item.title || "Requisition details";
    detailAddButton.hidden = !allowAdd;
    const content = document.getElementById("detail-content");
    const list = document.createElement("dl");
    if (allowAdd) {
      addMetadataRow(list, "Catalog identifier", item.id);
      if (item.catalogGroup) addMetadataRow(list, "Catalog grouping", item.catalogGroup);
      addMetadataRow(list, "Creator / originating organization", item.creator);
      addMetadataRow(list, "Material category", item.materialCategory);
      addMetadataRow(list, "Format", item.format);
      addMetadataRow(list, "Publication / creation date", item.creationDate);
      addMetadataRow(list, "Publisher / provenance", item.publisherDescription);
      addMetadataRow(list, "Description", item.description);
      addMetadataRow(list, "Unit price", formatMoney(item.unitPriceCents));
      addMetadataRow(list, "Availability", item.availability);
      addMetadataRow(list, "Maximum quantity", String(item.maxQuantity));
      addMetadataRow(list, "Record note", item.metadata?.identifierStatus || "Fictional training data");
    } else {
      addMetadataRow(list, "Requisition ID", item.id);
      addMetadataRow(list, "Status", item.status);
      addMetadataRow(list, "Institution snapshot", item.institutionSnapshot?.institutionName || "Not supplied");
      addMetadataRow(list, "Department snapshot", item.institutionSnapshot?.department || "Not applicable");
      addMetadataRow(list, "Created", new Date(item.createdAt).toLocaleString());
      addMetadataRow(list, "Last modified", new Date(item.modifiedAt).toLocaleString());
      addMetadataRow(list, "Requisition total", formatMoney(item.totalCents));
      addMetadataRow(list, "Justification", item.justification || "None supplied");
      const lineSummary = item.lines.map(line => {
        const record = catalogById.get(line.catalogId);
        return `${record?.title || line.title} — ${line.quantity} × ${formatMoney(line.unitPriceCents)}; collection ${line.collectionCode}; fund ${line.fundCode}${line.selectorNote ? `; note: ${line.selectorNote}` : ""}`;
      }).join("\n");
      addMetadataRow(list, "Line items", lineSummary);
      addMetadataRow(list, "Submission snapshot", item.submittedSnapshot ? "Submitted contents are retained as a read-only snapshot." : "Not submitted");
    }
    content.replaceChildren(list);
    detailDialog.showModal();
  }

  function canonicalLine(line) {
    return {
      catalogId: line.catalogId,
      title: catalogById.get(line.catalogId).title,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      extendedPriceCents: itemTotal(line),
      collectionCode: line.collectionCode,
      fundCode: line.fundCode,
      selectorNote: line.selectorNote || ""
    };
  }

  function validationErrors(session, lines, justification) {
    const institution = getInstitution(session);
    const errors = [];
    if (!institution) errors.push("The institution profile is unavailable.");
    if (!lines.length) errors.push("Add at least one catalog item.");
    const seen = new Set();
    for (const line of lines) {
      const item = catalogById.get(line.catalogId);
      if (!item) {
        errors.push(`Catalog item ${line.catalogId} is no longer available.`);
        continue;
      }
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > item.maxQuantity) {
        errors.push(`${item.title}: quantity must be a whole number from 1 to ${item.maxQuantity}.`);
      }
      if (line.unitPriceCents !== item.unitPriceCents) errors.push(`${item.title}: catalog price has changed; remove and re-add the item.`);
      if (!institution || !selectedCollectionCodes(institution).has(line.collectionCode)) errors.push(`${item.title}: select a collection line for this institution.`);
      if (!institution || !selectedFundCodes(institution).has(line.fundCode)) errors.push(`${item.title}: select a fund code for this institution.`);
      if (seen.has(line.catalogId)) errors.push(`${item.title}: duplicate catalog lines are not allowed.`);
      seen.add(line.catalogId);
    }
    if (institution && REQUIRED_JUSTIFICATION_CATEGORIES.has(institution.id) &&
        linesTotal(lines) * 100 >= institution.annualBudget * 100 * 80 &&
        !String(justification || "").trim()) {
      errors.push("Provide a justification for a requisition at least 80% of this institution's annual allocation.");
    }
    return errors;
  }

  function makeRequisitionId(clientId, sequence) {
    const prefix = clientId.toLocaleUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "CLIENT";
    return `PN-${prefix}-${String(sequence).padStart(4, "0")}`;
  }

  function saveRequisition(event) {
    event.preventDefault();
    try {
      const session = getSession();
      const institution = getInstitution(session);
      if (!session?.setupComplete || !institution) throw new Error("Complete an institutional profile before saving a requisition.");
      if (isReadOnlyWorksheet()) throw new Error("Submitted requisitions are read-only.");
      normalizeSession();
      const lines = currentLines().map(canonicalLine);
      const justification = document.getElementById("requisition-justification").value.trim();
      const errors = validationErrors(session, lines, justification);
      if (errors.length) throw new Error(errors.join(" "));

      const now = new Date().toISOString();
      const existing = currentRequisition();
      if (existing && !["saved", "returned"].includes(existing.status)) {
        throw new Error("Only saved or returned requisitions may be edited.");
      }
      const budget = budgetDetails(session);
      let sequence = existing
        ? session.requisitionSequence
        : session.requisitionSequence + 1;
      while (!existing && session.orders.some(order =>
        order.id === makeRequisitionId(session.clientId, sequence)
      )) sequence += 1;
      const requisition = {
        ...existing,
        id: existing?.id || makeRequisitionId(session.clientId, sequence),
        clientId: session.clientId,
        institutionSnapshot: {
          institutionName: session.institutionName,
          categoryId: session.categoryId,
          department: session.department || ""
        },
        createdAt: existing?.createdAt || now,
        modifiedAt: now,
        lines,
        totalCents: linesTotal(lines),
        status: existing?.status || "saved",
        justification,
        budgetSnapshot: {
          annualAllocationCents: budget.allocationCents,
          committedCentsAtSave: budget.committedCents,
          availableCentsAtSave: budget.availableCents
        },
        submittedSnapshot: existing?.submittedSnapshot || null,
        submissionAttempts: existing?.submissionAttempts || [],
        correspondence: existing?.correspondence || [],
        processingRecord: existing?.processingRecord || null
      };
      const orders = session.orders.map(order => order.id === requisition.id ? requisition : order);
      if (!existing) orders.push(requisition);
      window.PN_APP.updateSession({
        orders,
        cart: lines,
        activeRequisitionId: requisition.id,
        workingJustification: justification,
        requisitionSequence: sequence,
        schemaVersion: 3
      });
      renderWorksheet();
      renderHistories();
      showNotice(`${requisition.id} ${existing?.status === "returned" ? "corrections saved" : "saved"}. No funds have been committed.`, false);
    } catch (error) {
      showNotice(error.message, true);
    }
  }

  function financialAcknowledgment(budget, proposedCents, acknowledgedAt = new Date().toISOString()) {
    const cumulativeCents = budget.committedCents + proposedCents;
    return {
      acknowledged: true,
      acknowledgedAt,
      annualAllocationCents: budget.allocationCents,
      previouslyCommittedCents: budget.committedCents,
      proposedCents,
      projectedRemainingCents: budget.availableCents - proposedCents,
      committedPercentage: Number((cumulativeCents / budget.allocationCents * 100).toFixed(2)),
      monthsRemaining: 11
    };
  }

  function acknowledgmentMatches(acknowledgment, expected) {
    return Boolean(
      acknowledgment?.acknowledged === true &&
      acknowledgment.annualAllocationCents === expected.annualAllocationCents &&
      acknowledgment.previouslyCommittedCents === expected.previouslyCommittedCents &&
      acknowledgment.proposedCents === expected.proposedCents &&
      acknowledgment.projectedRemainingCents === expected.projectedRemainingCents &&
      acknowledgment.committedPercentage === expected.committedPercentage &&
      acknowledgment.monthsRemaining === 11 &&
      Number.isFinite(Date.parse(acknowledgment.acknowledgedAt))
    );
  }

  function acknowledgmentPrompt(acknowledgment) {
    return [
      "Early-expenditure acknowledgment",
      `Annual allocation: ${formatMoney(acknowledgment.annualAllocationCents)}`,
      `Previously committed: ${formatMoney(acknowledgment.previouslyCommittedCents)}`,
      `Proposed expenditure: ${formatMoney(acknowledgment.proposedCents)}`,
      `Projected remaining balance: ${formatMoney(acknowledgment.projectedRemainingCents)}`,
      `Projected annual allocation committed: ${acknowledgment.committedPercentage}%`,
      `${acknowledgment.monthsRemaining} months remain in the fiscal year.`,
      "Confirm that you intend to proceed."
    ].join("\n");
  }

  function forwardRequisition(requisitionId) {
    try {
      submitRequisition(requisitionId);
    } catch (error) {
      showNotice(`The requisition could not be submitted. ${error.message}`, true);
    }
  }

  function submitRequisition(requisitionId) {
    normalizeSession();
    const session = getSession();
    const requisition = session?.orders.find(order => order.id === requisitionId);
    if (!requisition || !["saved", "returned"].includes(requisition.status)) {
      showNotice("Only a saved or returned requisition may be submitted. Submitted and processed requisitions cannot be submitted again.", true);
      return;
    }
    if (requisition.status === "returned" && session.activeRequisitionId === requisition.id &&
        (JSON.stringify(session.cart) !== JSON.stringify(requisition.lines) ||
         (session.workingJustification || "") !== (requisition.justification || ""))) {
      throw new Error("Save all corrections before resubmitting.");
    }
    const lines = requisition.lines.map(line => ({ ...line }));
    const errors = validationErrors(session, lines, requisition.justification);
    if (errors.length) {
      showNotice(errors.join(" "), true);
      return;
    }
    const budget = budgetDetails(session);
    const proposedCents = linesTotal(lines);
    const excess = proposedCents - Math.max(0, budget.availableCents);
    if (excess > 0) {
      showNotice(`This requisition exceeds the available balance by ${formatMoney(excess)}. It cannot be forwarded.`, true);
      return;
    }
    const projectedAcknowledgment = financialAcknowledgment(budget, proposedCents);
    const thresholdReached = (budget.committedCents + proposedCents) * 100 >= budget.allocationCents * 80;
    const priorSnapshot = requisition.submittedSnapshot;
    const priorAcknowledgment = priorSnapshot?.financialAcknowledgment;
    const acknowledgmentReusable = priorSnapshot?.totalCents === proposedCents &&
      acknowledgmentMatches(priorAcknowledgment, projectedAcknowledgment);
    let acknowledgment = thresholdReached && acknowledgmentReusable ? priorAcknowledgment : null;
    if (thresholdReached && !acknowledgment) {
      if (!window.confirm(acknowledgmentPrompt(projectedAcknowledgment))) {
        showNotice("Forwarding cancelled. The requisition remains unsubmitted and no funds are committed.", false);
        return;
      }
      acknowledgment = { ...projectedAcknowledgment };
    }
    const now = new Date().toISOString();
    const submittedSnapshot = {
      requisitionId: requisition.id,
      clientId: requisition.clientId,
      submittedAt: now,
      institutionSnapshot: { ...requisition.institutionSnapshot },
      lines: lines.map(line => ({ ...line })),
      totalCents: proposedCents,
      justification: requisition.justification,
      financialAcknowledgment: acknowledgment,
      budgetSnapshot: {
        annualAllocationCents: budget.allocationCents,
        committedCentsAtSubmission: budget.committedCents,
        availableCentsAtSubmission: budget.availableCents
      }
    };
    const attempt = {
      revision: (requisition.submissionAttempts?.length || 0) + 1,
      submittedAt: now,
      snapshot: submittedSnapshot,
      validationOutcome: null,
      correspondence: [],
      financialAcknowledgment: acknowledgment
    };
    const updated = {
      ...requisition,
      status: "submitted",
      modifiedAt: now,
      submittedAt: now,
      submittedSnapshot,
      submissionAttempts: [...(requisition.submissionAttempts || []), attempt],
      correspondence: requisition.correspondence || [],
      processingRecord: null
    };
    window.PN_APP.updateSession({
      orders: session.orders.map(order => order.id === requisition.id ? updated : order),
      cart: [],
      activeRequisitionId: null,
      workingJustification: "",
      schemaVersion: 3
    });
    renderWorksheet();
    renderHistories();
    showNotice(`${requisition.id} has been forwarded to Technical Services and is awaiting review. No approval or processing has occurred.`, false);
  }

  function renderHistoryTable(body, orders) {
    if (!orders.length) {
      appendEmptyRow(body, "No requisitions saved yet.", 6);
      return;
    }
    const rows = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(order => {
      const row = document.createElement("tr");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "text-button";
      open.textContent = order.id;
      open.dataset.viewOrder = order.id;
      const idCell = document.createElement("td");
      idCell.append(open);
      row.append(idCell);
      row.append(makeCell(new Date(order.createdAt).toLocaleDateString()));
      row.append(makeCell(String(totalQuantity(order.lines))));
      row.append(makeCell(formatMoney(order.totalCents)));
      const status = makeCell(order.status);
      status.className = `status-cell status-${order.status}`;
      row.append(status);
      const actions = document.createElement("td");
      const group = document.createElement("div");
      group.className = "table-actions";
      const view = document.createElement("button");
      view.type = "button";
      view.className = "button button-secondary compact-button";
      view.textContent = "View";
      view.dataset.viewOrder = order.id;
      group.append(view);
      if (order.status === "saved" || order.status === "returned") {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "button button-secondary compact-button";
        edit.textContent = order.status === "returned" ? "Edit and correct" : "Edit";
        edit.dataset.editOrder = order.id;
        group.append(edit);
        if (order.status === "saved") {
          const forward = document.createElement("button");
          forward.type = "button";
          forward.className = "button button-primary compact-button";
          forward.textContent = "Forward";
          forward.dataset.forwardOrder = order.id;
          group.append(forward);
        }
      }
      actions.append(group);
      row.append(actions);
      return row;
    });
    body.replaceChildren(...rows);
  }

  function renderHistories() {
    if (sessionError) {
      appendEmptyRow(historyBody, `Requisition history is unavailable: ${sessionError}`, 6);
      return;
    }
    const session = getSession();
    if (!session || !Array.isArray(session.orders)) {
      appendEmptyRow(historyBody, "Requisition history is unavailable.", 6);
      return;
    }
    renderHistoryTable(historyBody, session.orders);
  }

  function editRequisition(requisitionId) {
    const session = getSession();
    const order = session?.orders.find(item => item.id === requisitionId);
    if (!order || !["saved", "returned"].includes(order.status)) {
      showNotice("Only saved or returned requisitions may be edited.", true);
      return;
    }
    window.PN_APP.updateSession({
      cart: order.lines.map(line => ({ ...line })),
      activeRequisitionId: order.id,
      workingJustification: order.justification || ""
    });
    renderWorksheet();
    showNotice(order.status === "returned"
      ? `${order.id} loaded for correction. Save the changes, then explicitly resubmit the requisition.`
      : `${order.id} loaded for editing. Save changes to update the saved requisition.`, false);
    window.PN_APP.navigate("order-worksheet");
  }

  function startNewRequisition() {
    const session = getSession();
    if (!session) return;
    if (currentLines().length && !window.confirm("Clear the current worksheet and start a new requisition? Saved requisitions in history will not be changed.")) return;
    window.PN_APP.updateSession({ cart: [], activeRequisitionId: null, workingJustification: "" });
    renderWorksheet();
    showNotice("Started a new requisition. Saved requisitions remain in history.", false);
  }

  function previewQuantity(event) {
    const control = event.target.closest('input[data-field="quantity"]');
    if (!control || isReadOnlyWorksheet()) return;
    const index = Number(control.dataset.index);
    const lines = currentLines().map(line => ({ ...line }));
    const line = lines[index];
    const item = line && catalogById.get(line.catalogId);
    const value = control.value;
    const quantity = Number(value);
    if (!line || !item || !/^\d+$/.test(value) ||
      !Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.maxQuantity) {
      control.setCustomValidity("Enter a whole-number quantity within this item's available limit.");
      return;
    }

    control.setCustomValidity("");
    line.quantity = quantity;
    line.extendedPriceCents = itemTotal(line);
    const session = getSession();
    const institution = getInstitution(session);
    const budget = budgetDetails(session);
    if (institution && budget) renderFinancialSummary(lines, institution, budget, false);
  }

  function handleLineChange(event) {
    const control = event.target.closest("[data-index][data-field]");
    if (!control || isReadOnlyWorksheet()) return;
    const index = Number(control.dataset.index);
    const field = control.dataset.field;
    const lines = currentLines().map(line => ({ ...line }));
    const line = lines[index];
    if (!line) return;
    try {
      if (field === "quantity") {
        const value = control.value;
        if (!/^\d+$/.test(value)) throw new Error("Quantity must be a positive whole number.");
        const quantity = Number(value);
        const item = catalogById.get(line.catalogId);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.maxQuantity) {
          throw new Error(`${item.title} quantity must be from 1 to ${item.maxQuantity}.`);
        }
        line.quantity = quantity;
        line.extendedPriceCents = itemTotal(line);
      } else if (field === "collectionCode" || field === "fundCode") {
        line[field] = control.value;
      } else if (field === "selectorNote") {
        line.selectorNote = control.value.slice(0, 300);
      }
      window.PN_APP.updateSession({ cart: lines });
      renderWorksheet();
    } catch (error) {
      showNotice(error.message, true);
      renderWorksheet();
    }
  }

  function handleLineRemove(event) {
    const button = event.target.closest("[data-remove-index]");
    if (!button || isReadOnlyWorksheet()) return;
    const index = Number(button.dataset.removeIndex);
    const lines = currentLines().filter((_, lineIndex) => lineIndex !== index);
    window.PN_APP.updateSession({ cart: lines });
    renderWorksheet();
    showNotice("Requisition line removed.", false);
  }

  function handleTableAction(event) {
    const target = event.target.closest("button");
    if (!target) return;
    try {
      if (target.dataset.detailId) {
        const item = catalogById.get(target.dataset.detailId);
        if (item) showItemDetails(item);
      } else if (target.dataset.addId) {
        const item = catalogById.get(target.dataset.addId);
        if (item) addToWorksheet(item);
      } else if (target.dataset.viewOrder) {
        const order = getSession()?.orders.find(item => item.id === target.dataset.viewOrder);
        if (order) window.PN_TECHNICAL_SERVICES.showDetails(order.id);
      } else if (target.dataset.editOrder) {
        editRequisition(target.dataset.editOrder);
      } else if (target.dataset.forwardOrder) {
        forwardRequisition(target.dataset.forwardOrder);
      }
    } catch (error) {
      showNotice(error.message, true);
    }
  }

  function initializeData() {
    fetch("data/catalog.json")
      .then(response => {
        if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
        return response.json();
      })
      .then(records => {
        if (!Array.isArray(records) || records.length < 1 ||
            records.some(item => !isValidCatalogRecord(item)) ||
            new Set(records.map(item => item.id)).size !== records.length) {
          throw new Error("Catalog data is malformed or contains duplicate identifiers.");
        }
        catalog = records;
        catalogById = new Map(catalog.map(item => [item.id, item]));
        dataReady = true;
        populateCatalogFilters();
        renderCatalog();
        window.dispatchEvent(new CustomEvent("pn:catalog-ready"));
        try {
          normalizeSession();
        } catch (error) {
          sessionError = error.message;
          showNotice(error.message, true);
        }
        renderWorksheet();
        renderHistories();
        if (!sessionError) refreshBudget();
      })
      .catch(error => {
        dataError = `The acquisitions catalog could not be loaded: ${error.message}`;
        showNotice(dataError, true);
        renderCatalog();
        if (!sessionError) refreshBudget();
      });
  }

  filterForm.addEventListener("input", () => {
    pageNumber = 1;
    renderCatalog();
  });
  filterForm.addEventListener("submit", event => event.preventDefault());
  filterForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      pageNumber = 1;
      renderCatalog();
    });
  });
  document.getElementById("catalog-previous").addEventListener("click", () => {
    pageNumber -= 1;
    renderCatalog();
  });
  document.getElementById("catalog-next").addEventListener("click", () => {
    pageNumber += 1;
    renderCatalog();
  });
  resultBody.addEventListener("click", handleTableAction);
  lineBody.addEventListener("input", previewQuantity);
  lineBody.addEventListener("change", handleLineChange);
  lineBody.addEventListener("click", handleLineRemove);
  historyBody.addEventListener("click", handleTableAction);
  document.getElementById("justification-form").addEventListener("submit", saveRequisition);
  document.getElementById("requisition-justification").addEventListener("change", event => {
    if (getSession()) window.PN_APP.updateSession({ workingJustification: event.target.value.slice(0, 1200) });
  });
  document.getElementById("new-requisition").addEventListener("click", startNewRequisition);
  document.getElementById("resubmit-requisition").addEventListener("click", () => {
    const active = currentRequisition();
    if (active?.status === "returned") forwardRequisition(active.id);
  });
  document.getElementById("direct-purchase").addEventListener("click", () => showNotice(directPurchaseMessage, true));
  detailAddButton.addEventListener("click", () => {
    try {
      if (detailItem) addToWorksheet(detailItem);
      detailDialog.close();
    } catch (error) {
      showNotice(error.message, true);
    }
  });
  document.getElementById("close-detail").addEventListener("click", () => detailDialog.close());
  detailDialog.addEventListener("close", () => { detailItem = null; });
  window.addEventListener("pn:navigate", event => {
    if (event.detail.page === "catalog") renderCatalog();
    if (event.detail.page === "order-worksheet") {
      renderWorksheet();
      renderHistories();
      showNotice("", false);
    }
    if (event.detail.page === "technical-services") renderHistories();
  });
  window.addEventListener("pn:session-change", () => {
    showNotice("", false);
    if (!dataReady) return;
    try {
      normalizeSession();
      sessionError = null;
      refreshBudget();
    } catch (error) {
      sessionError = error.message;
      showNotice(error.message, true);
      renderWorksheet();
      renderHistories();
    }
  });

  window.PN_ACQUISITIONS = Object.freeze({
    refreshBudget,
    filterCatalog,
    pageCatalog,
    getCatalogCount: () => catalog.length,
    getCatalogRecords: () => catalog.map(item => ({ ...item })),
    validateSession: normalizeSession,
    processedTotal,
    editRequisition,
    submitRequisition: forwardRequisition
  });
  initializeData();
}());
