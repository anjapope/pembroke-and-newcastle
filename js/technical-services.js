(function () {
  "use strict";

  const PROCEDURES = Object.freeze({
    "14-C": "Procedure 14-C: Collection Designations, revised March 2009",
    "8-B": "Procedure 8-B: Fund Accounting Codes, revised June 2012",
    "11-A": "Procedure 11-A: Requisition Quantities, revised February 2016",
    "22-D": "Procedure 22-D: Annual Allocation Review, revised January 2024",
    "3-F": "Procedure 3-F: Submission and Resubmission, revised September 2018"
  });
  const JUSTIFICATION_CATEGORIES = new Set([
    "archive-special-collections",
    "museum-cultural-heritage",
    "school-library-media-center"
  ]);
  const pendingBody = document.getElementById("pending-review-history");
  const returnedBody = document.getElementById("returned-history");
  const processedBody = document.getElementById("processed-history");
  const correspondenceList = document.getElementById("correspondence-history");
  const detailDialog = document.getElementById("requisition-detail");
  const detailContent = document.getElementById("requisition-detail-content");
  const detailTitle = document.getElementById("requisition-detail-title");
  const notice = document.getElementById("acq-notice");
  let catalog = [];

  function getSession() {
    return window.PN_APP.getSession();
  }

  function money(cents) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  function addError(errors, code, message, correctiveAction, procedure, line, details = {}) {
    errors.push({
      code,
      requisitionId: details.requisitionId || null,
      lineNumber: line ? line.lineNumber : null,
      catalogId: line ? line.catalogId : null,
      message,
      correctiveAction,
      procedure: PROCEDURES[procedure]
    });
  }

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function classifyCollection(item, code, institution) {
    const material = `${item.materialCategory || ""} ${item.format || ""}`.toLowerCase();
    const id = institution.id;
    const exactPatterns = {
      AF: /\badult fiction\b/,
      ANF: /\badult nonfiction\b|\badult non-fiction\b/,
      JF: /\bjuvenile fiction\b/,
      JNF: /\bjuvenile nonfiction\b|\bjuvenile non-fiction\b/,
      YA: /\byoung adult\b/,
      REF: /\breference\b/,
      AV: /\baudiovisual\b|\baudio\b|\bvideo\b|\bfilm\b/,
      LOCAL: /\blocal history\b|\blocal studies\b/,
      DIGITAL: /\bdigital\b|\belectronic\b|\bebook\b|\be-book\b|\blicensed\b/,
      MONO: /\bmonograph\b|\bacademic book\b|\bscholarly book\b/,
      SERIAL: /\bserial\b|\bjournal\b|\bperiodical\b/,
      ERES: /\belectronic\b|\bdigital\b|\blicensed\b|\bebook\b|\be-book\b/,
      SPEC: /\bspecial collections\b|\bmanuscript\b|\brare book\b|\barchival\b/,
      MEDIA: /\bmedia\b|\baudiovisual\b|\baudio\b|\bvideo\b|\bfilm\b/,
      MSS: /\bmanuscript\b/,
      PHOTO: /\bphotograph\b|\bphotographic\b|\bimage\b/,
      DIG: /\bdigital\b|\belectronic\b|\blicensed\b/,
      ORAL: /\boral histor(y|ies)\b|\binterview\b/,
      EPHEM: /\bephemer(a|al)\b|\bpamphlet\b|\bflyer\b/,
      RARE: /\brare books?\b|\bincunabula\b|\bantiquarian\b/,
      ART: /\bart\b|\bpainting\b|\bsculpture\b|\bdecorative\b/,
      HIST: /\bhistor(y|ical)\b|\bcultural heritage\b/,
      NAT: /\bnatural histor(y|ical)\b|\bspecimen\b|\bbotanical\b|\bzoological\b/,
      ETHNO: /\bethnograph(ic|y)\b|\bindigenous\b/,
      DOC: /\bdocumentary\b|\barchival\b|\bmanuscript\b|\bphotograph\b/,
      EXHIBIT: /\bexhibition\b|\bexhibit\b|\bdisplay\b/,
      E: /\bpicture book\b|\beasy reader\b|\bearly reader\b/,
      CURRICULUM: /\bcurriculum\b|\btextbook\b|\binstructional\b/,
      LITERACY: /\bliteracy\b|\breader\b|\breading\b/
    };
    const pattern = exactPatterns[code];
    if (pattern?.test(material)) return "valid";

    if (code === "JF" && /\badult\b/.test(material) && /\bfiction\b|\bnonfiction\b|\bnon-fiction\b/.test(material)) return "invalid";
    if (code === "JNF" && /\badult\b/.test(material) && /\bfiction\b|\bnonfiction\b|\bnon-fiction\b/.test(material)) return "invalid";
    if (code === "AF" && /\bjuvenile fiction\b|\byoung adult\b/.test(material)) return "invalid";
    if (code === "ANF" && /\bjuvenile\b|\byoung adult\b/.test(material)) return "invalid";
    if (code === "AF" && /\badult\b/.test(material) && /\bnonfiction\b|\bnon-fiction\b/.test(material)) return "invalid";
    if (code === "ANF" && /\badult fiction\b/.test(material)) return "invalid";
    if (code === "JF" && /\bjuvenile nonfiction\b|\bjuvenile non-fiction\b/.test(material)) return "invalid";
    if (code === "JNF" && /\bjuvenile fiction\b/.test(material)) return "invalid";

    if (code === "PHOTO" && /\bfiction\b|\bserial\b|\bebook\b/.test(material)) return "invalid";
    if (code === "MSS" && /\bfiction\b|\bserial\b|\bvideo\b/.test(material)) return "invalid";
    if (code === "ORAL" && /\bfiction\b|\bserial\b|\bpainting\b|\bspecimen\b/.test(material)) return "invalid";

    if (id === "public-library" && code === "LOCAL" &&
        /\bphotograph\b|\barchival\b|\bmanuscript\b|\boral histor(y|ies)\b/.test(material)) return "valid";
    if (id === "museum-cultural-heritage" && code === "EXHIBIT") return "reviewable";
    if (id === "academic-library" && code === "SPEC" &&
        /\brare\b|\bmanuscript\b|\barchival\b|\bhistorical\b/.test(material)) return "valid";
    if (id === "archive-special-collections" && code === "PHOTO" &&
        /\barchive\b|\bhistorical\b/.test(material)) return "reviewable";
    if (code === "AV" && /\bphotograph\b|\bmanuscript\b|\bobject\b/.test(material)) return "reviewable";
    if ((code === "DIG" || code === "DIGITAL" || code === "ERES") &&
        /\bprint\b|\bphysical\b|\bobject\b/.test(material)) return "reviewable";
    if (["AF", "ANF", "JF", "JNF", "YA", "REF", "AV", "LOCAL", "DIGITAL",
      "MONO", "SERIAL", "ERES", "SPEC", "MEDIA", "MSS", "PHOTO", "DIG", "ORAL",
      "EPHEM", "RARE", "ART", "HIST", "NAT", "ETHNO", "DOC", "EXHIBIT", "E",
      "CURRICULUM", "LITERACY"].includes(code)) return "reviewable";
    return "valid";
  }

  function classifyFund(item, code) {
    const material = `${item.materialCategory || ""} ${item.format || ""}`.toLowerCase();
    if (code === "GENERAL") return "valid";
    const expected = {
      YOUTH: /\bjuvenile\b|\byoung adult\b|\bpicture book\b/,
      CURRICULUM: /\bcurriculum\b|\btextbook\b|\binstructional\b/,
      LITERACY: /\bliteracy\b|\breader\b|\breading\b/,
      MEDIA: /\bmedia\b|\baudiovisual\b|\baudio\b|\bvideo\b|\bfilm\b/,
      DIGITAL: /\bdigital\b|\belectronic\b|\blicensed\b|\bebook\b|\be-book\b/,
      ELECTRONIC: /\bdigital\b|\belectronic\b|\blicensed\b|\bebook\b|\be-book\b/,
      LOCAL: /\blocal histor(y|ical)\b|\blocal studies\b/,
      ACCESSION: /\bmanuscript\b|\bphotograph\b|\barchival\b|\bobject\b/,
      PRESERVATION: /\brare\b|\bmanuscript\b|\barchival\b|\bhistorical\b/,
      SPECIAL: /\bspecial collections\b|\brare\b|\bmanuscript\b|\barchival\b/,
      EXHIBITION: /\bexhibition\b|\bexhibit\b|\bdisplay\b/,
      COLLECTIONS: /\bcollection\b|\bart\b|\bhistorical\b|\bspecimen\b/,
      EDUCATION: /\beducation\b|\bcurriculum\b|\binstructional\b/,
      RESEARCH: /\bresearch\b|\bacademic\b|\bscholarly\b/,
      SUBJECT: /\bsubject\b|\bacademic\b|\bscholarly\b/
    };
    return expected[code] && expected[code].test(material) ? "valid" : "reviewable";
  }

  function expectedAcknowledgment(allocationCents, committedCents, proposedCents) {
    const remaining = allocationCents - committedCents - proposedCents;
    const cumulative = committedCents + proposedCents;
    return {
      annualAllocationCents: allocationCents,
      previouslyCommittedCents: committedCents,
      proposedCents,
      projectedRemainingCents: remaining,
      committedPercentage: Number((cumulative / allocationCents * 100).toFixed(2)),
      monthsRemaining: 11
    };
  }

  function matchesAcknowledgment(acknowledgment, expected) {
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

  function validateSnapshot(snapshot, context) {
    context = context || {};
    const errors = [];
    const details = { requisitionId: snapshot?.requisitionId };
    const institutions = context.institutions || window.PN_INSTITUTIONS;
    const institutionSnapshot = snapshot?.institutionSnapshot;
    const institution = institutions.find(item => item.id === institutionSnapshot?.categoryId);
    const allocationCents = institution ? institution.annualBudget * 100 : 0;
    let computedTotalCents = 0;

    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      addError(errors, "invalid_snapshot", "The submitted requisition snapshot is missing or malformed.",
        "Submit a complete requisition through the order worksheet.", "3-F", null, details);
      return { valid: false, errors, computedTotalCents, allocationCents, committedCents: context.committedCents || 0 };
    }

    if (typeof snapshot.requisitionId !== "string" ||
        !/^PN-[A-Z0-9]{1,12}-\d{4,}$/.test(snapshot.requisitionId)) {
      addError(errors, "invalid_requisition_id", "A valid requisition identifier is required.",
        "Use the requisition identifier issued by the application.", "3-F", null, details);
    }
    if (typeof snapshot.clientId !== "string" || !snapshot.clientId.trim() ||
        snapshot.clientId !== context.clientId) {
      addError(errors, "invalid_client_id", "The requisition client identifier is missing or does not match the active client.",
        "Submit the requisition from the correct institutional session.", "3-F", null, details);
    }
    if (!institution || !text(institutionSnapshot?.institutionName)) {
      addError(errors, "invalid_institution", "A valid institutional identity is required for processing.",
        "Provide a recognized institution category and institution name.", "3-F", null, details);
    } else if (institution.requiresDepartment && !text(institutionSnapshot.department)) {
      addError(errors, "missing_department", "The submitted institutional profile is missing its required department.",
        "Provide the department required for this institution category, then resubmit.", "3-F", null, details);
    }
    if (typeof snapshot.submittedAt !== "string" ||
        !Number.isFinite(Date.parse(snapshot.submittedAt))) {
      addError(errors, "missing_submission_timestamp", "A valid submission timestamp is required.",
        "Submit the saved requisition using the application workflow.", "3-F", null, details);
    }
    if (!Array.isArray(snapshot.lines) || snapshot.lines.length === 0) {
      addError(errors, "missing_line_items", "At least one requisition line is required.",
        "Add one or more catalog items before submitting.", "3-F", null, details);
    }

    const itemsById = new Map((context.catalog || []).map(item => [item.id, item]));
    (Array.isArray(snapshot.lines) ? snapshot.lines : []).forEach((line, index) => {
      const lineInfo = {
        lineNumber: index + 1,
        catalogId: line?.catalogId || null
      };
      if (!line || typeof line !== "object" || Array.isArray(line)) {
        addError(errors, "invalid_line", `Requisition line ${index + 1} is malformed.`,
          "Replace the affected line with a valid catalog item.", "3-F", lineInfo, details);
        return;
      }

      const item = itemsById.get(line.catalogId);
      if (!item) {
        addError(errors, "invalid_catalog_reference", `Requisition line ${index + 1} refers to a catalog item that is not available in the active catalog.`,
          "Select an item from the current acquisitions catalog.", "3-F", lineInfo, details);
      }

      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0 ||
          (item && line.quantity > item.maxQuantity)) {
        addError(errors, "invalid_quantity",
          item?.unique
            ? `Line ${index + 1}, ${item.title}: the requested quantity exceeds the number of units available for acquisition.`
            : `Line ${index + 1}${item ? `, ${item.title}` : ""}: quantity must be a positive whole number within the catalog limit.`,
          "Amend the quantity to a positive whole number within the available catalog limit.", "11-A", lineInfo, details);
      }

      if (item && Number.isSafeInteger(line.quantity) && line.quantity > 0) {
        const computedUnit = item.unitPriceCents;
        const extended = computedUnit * line.quantity;
        if (!Number.isSafeInteger(extended) || !Number.isSafeInteger(computedTotalCents + extended)) {
          addError(errors, "unsafe_financial_value", `Line ${index + 1} exceeds safe financial calculation limits.`,
            "Reduce the quantity or select a valid catalog item.", "11-A", lineInfo, details);
        } else {
          computedTotalCents += extended;
        }
        if (line.unitPriceCents !== computedUnit) {
          addError(errors, "catalog_price_mismatch", `Line ${index + 1}, ${item.title}: the submitted unit price does not match the active catalog price.`,
            "Use the current catalog price for this item.", "11-A", lineInfo, details);
        }
        if (line.extendedPriceCents !== extended) {
          addError(errors, "line_total_mismatch", `Line ${index + 1}, ${item.title}: the stored extended price does not match the catalog price and quantity.`,
            "Recalculate the line total and resubmit.", "11-A", lineInfo, details);
        }
      }

      if (!institution) return;
      const allowedCollections = new Map(institution.collectionLines.map(value => [value.code, value]));
      const collectionCode = text(line.collectionCode);
      if (!collectionCode) {
        addError(errors, "missing_collection_code", `Line ${index + 1}${item ? `, ${item.title}` : ""}: the requisition cannot be processed because a required collection designation has been omitted.`,
          "Complete the affected collection designation and resubmit the requisition.", "14-C", lineInfo, details);
      } else if (!allowedCollections.has(collectionCode)) {
        addError(errors, "invalid_collection_code", `Line ${index + 1}: collection code ${collectionCode} is not authorized for ${institution.name}.`,
          "Select a collection line authorized for this institution.", "14-C", lineInfo, details);
      } else if (item) {
        const classification = classifyCollection(item, collectionCode, institution);
        if (classification === "invalid") {
          addError(errors, "incompatible_collection", `Line ${index + 1}, ${item.title}: the collection designation provided does exist. Its existence does not make its use appropriate.`,
            "Correct the designation before resubmission. A selector note cannot override a clearly incompatible assignment.", "14-C", lineInfo, details);
        } else if (classification === "reviewable" && !text(line.selectorNote)) {
          addError(errors, "collection_explanation_required", `Line ${index + 1}, ${item.title}: the designation provided is not the customary assignment for this material.`,
            "Provide a brief selector explanation of the intended collecting purpose, or choose a conventional collection line.", "14-C", lineInfo, details);
        }
      }

      const allowedFunds = new Set(institution.funds.map(value => value.code));
      const fundCode = text(line.fundCode);
      if (!fundCode) {
        addError(errors, "missing_fund_code", `Line ${index + 1}${item ? `, ${item.title}` : ""}: a fund accounting code has been omitted.`,
          "Select a fund code authorized for this institution.", "8-B", lineInfo, details);
      } else if (!allowedFunds.has(fundCode)) {
        addError(errors, "invalid_fund_code", `Line ${index + 1}: fund code ${fundCode} is not authorized for ${institution.name}.`,
          "Select a fund code authorized for this institution.", "8-B", lineInfo, details);
      } else if (item && classifyFund(item, fundCode) === "reviewable" && !text(line.selectorNote)) {
        addError(errors, "fund_explanation_required", `Line ${index + 1}, ${item.title}: the selected specialized fund is not the customary accounting assignment for this material.`,
          "Provide a brief selector explanation or use a more customary fund code.", "8-B", lineInfo, details);
      }

      if (typeof line.selectorNote !== "string" || line.selectorNote.length > 300) {
        addError(errors, "invalid_selector_note", `Line ${index + 1}: the selector note is invalid.`,
          "Use a text note of no more than 300 characters.", "14-C", lineInfo, details);
      }
    });

    if (!Number.isSafeInteger(snapshot.totalCents) ||
        snapshot.totalCents !== computedTotalCents) {
      addError(errors, "requisition_total_mismatch", "The stored requisition total does not equal the recomputed total at current catalog prices.",
        "Recalculate the requisition total from the active catalog and resubmit.", "11-A", null, details);
    }

    const committedCents = Number.isSafeInteger(context.committedCents) && context.committedCents >= 0
      ? context.committedCents
      : 0;
    const availableCents = Math.max(0, allocationCents - committedCents);
    const shortfallCents = computedTotalCents - availableCents;
    if (institution && shortfallCents > 0) {
      addError(errors, "budget_overage",
        `The proposed requisition exceeds the remaining annual allocation by ${money(shortfallCents)}. Technical Services cannot process an expenditure for which funds have not been allocated.`,
        "Revise the requisition total so it does not exceed the available annual balance.", "22-D", null, details);
    }

    if (institution && computedTotalCents > 0 &&
        JUSTIFICATION_CATEGORIES.has(institution.id) &&
        computedTotalCents * 100 >= allocationCents * 80 &&
        !text(snapshot.justification)) {
      addError(errors, "missing_expenditure_justification",
        "The individual requisition represents at least 80% of the annual allocation and requires a nonempty institutional justification.",
        "Provide a brief justification of the one-time expenditure and resubmit.", "22-D", null, details);
    }

    let acknowledgment = context.financialAcknowledgment || snapshot.financialAcknowledgment;
    let financialSummary = null;
    if (institution && computedTotalCents > 0 &&
        (committedCents + computedTotalCents) * 100 >= allocationCents * 80) {
      financialSummary = expectedAcknowledgment(allocationCents, committedCents, computedTotalCents);
      if (!matchesAcknowledgment(acknowledgment, financialSummary)) {
        addError(errors, "missing_financial_acknowledgment",
          `The proposed expenditure would commit ${financialSummary.committedPercentage}% of the annual acquisitions allocation. The required financial acknowledgment has not been recorded.`,
          `Review the projected remaining balance of ${money(financialSummary.projectedRemainingCents)} and confirm that you intend to proceed. Eleven months remain in the fiscal year.`,
          "22-D", null, details);
      }
    }

    if (context.hasPriorProcessingRecord) {
      addError(errors, "already_processed", "A processing record already exists for this requisition.",
        "No further processing or resubmission is permitted.", "3-F", null, details);
    }
    return {
      valid: errors.length === 0,
      errors,
      computedTotalCents,
      allocationCents,
      committedCents,
      availableCents,
      shortfallCents: Math.max(0, shortfallCents),
      financialSummary
    };
  }

  function composeCorrespondence(outcome, requisitionId, reviewDate) {
    const header = "Your purchase order has been reviewed and cannot be processed in its present form.";
    const byCode = {
      missing_collection_code: error => [
        "The requisition cannot be processed because a required collection designation has been omitted.",
        "The collection designation is not an optional administrative convenience.",
        "Please complete the affected field and resubmit the requisition."
      ],
      invalid_collection_code: error => [
        error.message,
        "The collection designation is available to this institution only when its assigned code is authorized for the applicable collection.",
        "Please correct the designation before resubmission."
      ],
      incompatible_collection: error => [
        error.message,
        "Please correct the designation before resubmission."
      ],
      collection_explanation_required: error => [
        "The designation provided is not the customary assignment for this material.",
        "A brief explanation of the intended collecting purpose is required before processing may continue."
      ],
      invalid_quantity: error => [
        error.message,
        "The supplier's inventory cannot be increased by entering a larger number in the quantity field.",
        "Please amend the requisition."
      ],
      budget_overage: error => [
        error.message,
        "Please revise the requisition total."
      ],
      missing_financial_acknowledgment: error => [
        error.message,
        error.correctiveAction
      ]
    };
    const body = outcome.errors.flatMap(error => {
      const lines = byCode[error.code] ? byCode[error.code](error) : [error.message, error.correctiveAction];
      return [`${lines.join("\n")}\n${error.procedure}`];
    });
    const references = [...new Set(outcome.errors.map(error => error.procedure))];
    return {
      requisitionId,
      reviewDate,
      status: "returned",
      message: [header, ...body, "I have retained a record of the original submission.", "Doris", "Technical Services Clerk II"].join("\n\n"),
      errors: outcome.errors.map(error => ({ ...error })),
      procedureReferences: references
    };
  }

  function composeAcceptance(requisitionId, reviewDate) {
    return {
      requisitionId,
      reviewDate,
      status: "processed",
      message: [
        "Your purchase order has been accepted for processing.",
        "All required fields have been completed correctly.",
        "This is the expected outcome of the procedure.",
        "Doris",
        "Technical Services Clerk II"
      ].join("\n\n"),
      errors: [],
      procedureReferences: [PROCEDURES["3-F"], PROCEDURES["22-D"]]
    };
  }

  function processedExpenditures(orders, excludeId) {
    const unique = new Map();
    for (const order of orders) {
      if (order.id === excludeId || order.status !== "processed" || unique.has(order.id)) continue;
      const cents = order.processingRecord?.totalCents;
      if (Number.isSafeInteger(cents) && cents >= 0) unique.set(order.id, cents);
    }
    return [...unique.values()].reduce((sum, cents) => sum + cents, 0);
  }

  function setNotice(message, isError = false) {
    notice.textContent = message;
    notice.dataset.error = String(isError);
    notice.hidden = !message;
  }

  function emptyRow(body, message, columns) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns;
    cell.textContent = message;
    row.append(cell);
    body.replaceChildren(row);
  }

  function cell(value) {
    const td = document.createElement("td");
    td.textContent = value;
    return td;
  }

  function actionButton(label, action, id, style = "button-secondary") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${style} compact-button`;
    button.textContent = label;
    button.dataset.tsAction = action;
    button.dataset.requisitionId = id;
    return button;
  }

  function statusCell(status) {
    const td = cell(status);
    td.className = `status-cell status-${status}`;
    return td;
  }

  function renderTable(body, orders, kind) {
    if (!orders.length) {
      emptyRow(body,
        kind === "pending" ? "No submitted requisitions are awaiting review." :
          kind === "returned" ? "No outstanding corrections." : "No requisitions have been processed.",
        kind === "returned" ? 6 : 7);
      return;
    }
    const rows = [...orders].sort((a, b) => {
      const left = kind === "processed" ? a.processedAt : a.submittedAt || a.createdAt;
      const right = kind === "processed" ? b.processedAt : b.submittedAt || b.createdAt;
      return String(right).localeCompare(String(left));
    }).map(order => {
      const row = document.createElement("tr");
      row.append(cell(order.id));
      const date = kind === "processed" ? order.processedAt : order.submittedAt || order.createdAt;
      row.append(cell(Number.isFinite(Date.parse(date)) ? new Date(date).toLocaleString() : "Date unavailable"));
      if (kind === "returned") {
        row.append(cell(String(order.submissionAttempts?.at(-1)?.validationOutcome?.errors?.length || 0)));
      } else {
        row.append(cell(order.institutionSnapshot?.institutionName || "Institution unavailable"));
        row.append(cell(String(order.lines?.length || 0)));
      }
      row.append(cell(money(order.totalCents || 0)));
      row.append(statusCell(order.status));
      const actions = document.createElement("td");
      const group = document.createElement("div");
      group.className = "table-actions";
      if (kind === "pending") group.append(actionButton("Review by Technical Services", "review", order.id, "button-primary"));
      if (kind === "returned") group.append(actionButton("Edit and correct", "correct", order.id));
      group.append(actionButton("Requisition details", "details", order.id));
      actions.append(group);
      row.append(actions);
      return row;
    });
    body.replaceChildren(...rows);
  }

  function renderCorrespondence(orders) {
    const records = [];
    const recorded = new Set();
    for (const order of orders) {
      for (const attempt of order.submissionAttempts || []) {
        for (const record of attempt.correspondence || []) {
          records.push({ order, attempt, record });
          recorded.add(`${record.requisitionId || order.id}|${record.reviewDate}`);
        }
      }
      for (const record of order.correspondence || []) {
        const key = `${record.requisitionId || order.id}|${record.reviewDate}`;
        if (!recorded.has(key)) {
          records.push({ order, attempt: null, record });
          recorded.add(key);
        }
      }
    }
    records.sort((a, b) => String(b.record.reviewDate).localeCompare(String(a.record.reviewDate)));
    if (!records.length) {
      correspondenceList.textContent = "No Technical Services correspondence has been issued.";
      return;
    }
    const articles = records.map(({ order, attempt, record }) => {
      const article = document.createElement("article");
      article.className = "correspondence-notice";
      article.setAttribute("aria-label", `${order.id} revision ${attempt?.revision || "record"} correspondence`);
      const heading = document.createElement("h4");
      heading.textContent = `${record.requisitionId || order.id} · Revision ${attempt?.revision || "record"} · ${record.status}`;
      const metadata = document.createElement("p");
      metadata.className = "correspondence-metadata";
      metadata.textContent = `Reviewed ${Number.isFinite(Date.parse(record.reviewDate)) ? new Date(record.reviewDate).toLocaleString() : "on an unrecorded date"} · ${record.status}`;
      const message = document.createElement("p");
      message.className = "correspondence-message";
      message.textContent = record.message || "No correspondence text was recorded.";
      article.append(heading, metadata, message);
      if (record.errors?.length) {
        const list = document.createElement("ul");
        list.className = "procedural-findings";
        for (const error of record.errors) {
          const item = document.createElement("li");
          item.textContent = `${error.code}${error.lineNumber ? ` · Line ${error.lineNumber}` : ""}: ${error.message} Required action: ${error.correctiveAction} ${error.procedure}`;
          list.append(item);
        }
        article.append(list);
      }
      return article;
    });
    correspondenceList.replaceChildren(...articles);
  }

  function render() {
    const session = getSession();
    if (!session?.setupComplete || !Array.isArray(session.orders)) {
      emptyRow(pendingBody, "Sign in to view submitted requisitions.", 7);
      emptyRow(returnedBody, "Sign in to view outstanding corrections.", 6);
      emptyRow(processedBody, "Sign in to view processing history.", 7);
      correspondenceList.textContent = "Sign in to view Technical Services correspondence.";
      return;
    }
    renderTable(pendingBody, session.orders.filter(order => order.status === "submitted"), "pending");
    renderTable(returnedBody, session.orders.filter(order => order.status === "returned"), "returned");
    renderTable(processedBody, session.orders.filter(order => order.status === "processed"), "processed");
    renderCorrespondence(session.orders);
  }

  function createAcknowledgment(summary) {
    return {
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
      ...summary
    };
  }

  function reviewRequisition(requisitionId) {
    const session = getSession();
    const requisition = session?.orders.find(order => order.id === requisitionId);
    if (!requisition) {
      setNotice("The requisition is not available in the active session.", true);
      return;
    }
    if (requisition.status !== "submitted") {
      setNotice(requisition.status === "processed"
        ? `${requisition.id} has already been processed. The existing result is shown below.`
        : `${requisition.id} has already been reviewed. The existing result is shown below.`, false);
      render();
      return;
    }
    const attempts = requisition.submissionAttempts || [];
    const attemptIndex = attempts.length - 1;
    const attempt = attempts[attemptIndex];
    if (!attempt || attempt.validationOutcome || attempt.correspondence?.length) {
      setNotice(`${requisition.id} has an existing review record. No duplicate correspondence was created.`, false);
      render();
      return;
    }
    const snapshot = attempt.snapshot;
    const institution = window.PN_INSTITUTIONS.find(item => item.id === snapshot?.institutionSnapshot?.categoryId);
    const allocationCents = institution ? institution.annualBudget * 100 : 0;
    const committedCents = processedExpenditures(session.orders, requisition.id);
    const hasPriorProcessingRecord = Boolean(requisition.processingRecord) ||
      session.orders.some(order => order.id === requisition.id && order.status === "processed");
    const context = {
      catalog,
      institutions: window.PN_INSTITUTIONS,
      clientId: session.clientId,
      committedCents,
      hasPriorProcessingRecord,
      financialAcknowledgment: attempt.financialAcknowledgment || snapshot?.financialAcknowledgment || null
    };
    let outcome = validateSnapshot(snapshot, context);
    let acknowledgment = context.financialAcknowledgment;

    if (outcome.errors.length === 1 &&
        outcome.errors[0].code === "missing_financial_acknowledgment" &&
        outcome.financialSummary) {
      const summary = outcome.financialSummary;
      const prompt = [
        "Early-expenditure acknowledgment is required before this review can proceed.",
        `Annual allocation: ${money(summary.annualAllocationCents)}`,
        `Previously committed funds: ${money(summary.previouslyCommittedCents)}`,
        `Proposed expenditure: ${money(summary.proposedCents)}`,
        `Projected remaining balance: ${money(summary.projectedRemainingCents)}`,
        `${summary.committedPercentage}% of the annual allocation would be committed.`,
        `${summary.monthsRemaining} months remain in the fiscal year.`,
        "Confirm that you intend to proceed."
      ].join("\n");
      if (window.confirm(prompt)) {
        acknowledgment = createAcknowledgment(summary);
        outcome = validateSnapshot(snapshot, { ...context, financialAcknowledgment: acknowledgment });
      }
    }

    const reviewDate = new Date().toISOString();
    const correspondence = outcome.valid
      ? composeAcceptance(requisition.id, reviewDate)
      : composeCorrespondence(outcome, requisition.id, reviewDate);
    const updatedAttempt = {
      ...attempt,
      validationOutcome: {
        valid: outcome.valid,
        errors: outcome.errors.map(error => ({ ...error })),
        computedTotalCents: outcome.computedTotalCents,
        allocationCents: outcome.allocationCents,
        committedCents: outcome.committedCents,
        reviewedAt: reviewDate
      },
      correspondence: [...(attempt.correspondence || []), correspondence],
      financialAcknowledgment: acknowledgment
    };
    const updatedAttempts = attempts.map((entry, index) =>
      index === attemptIndex ? updatedAttempt : entry
    );
    const updated = {
      ...requisition,
      status: outcome.valid ? "processed" : "returned",
      modifiedAt: reviewDate,
      processedAt: outcome.valid ? reviewDate : requisition.processedAt,
      submissionAttempts: updatedAttempts,
      correspondence: [...(requisition.correspondence || []), correspondence],
      processingRecord: outcome.valid
        ? {
          processedAt: reviewDate,
          totalCents: outcome.computedTotalCents,
          submissionRevision: attempt.revision
        }
        : requisition.processingRecord || null
    };
    try {
      window.PN_APP.updateSession({
        orders: session.orders.map(order => order.id === requisition.id ? updated : order),
        schemaVersion: 3
      });
      render();
      setNotice(outcome.valid
        ? `${requisition.id} was processed. Its expenditure is now reflected in the annual budget.`
        : `${requisition.id} was returned for correction. Doris's findings and required actions are recorded below.`, !outcome.valid);
    } catch (error) {
      setNotice(`The review could not be saved. No processing result was recorded. ${error.message}`, true);
    }
  }

  function appendDetailLine(tableBody, line, index) {
    const tr = document.createElement("tr");
    const item = catalog.find(record => record.id === line.catalogId);
    for (const value of [
      String(index + 1),
      item?.title || line.title || "Catalog item unavailable",
      line.catalogId || "",
      String(line.quantity ?? ""),
      money(Number.isSafeInteger(line.unitPriceCents) ? line.unitPriceCents : 0),
      money(Number.isSafeInteger(line.extendedPriceCents) ? line.extendedPriceCents : 0),
      line.collectionCode || "Omitted",
      line.fundCode || "Omitted",
      line.selectorNote || ""
    ]) tr.append(cell(value));
    tableBody.append(tr);
  }

  function showDetails(requisitionId) {
    const order = getSession()?.orders.find(item => item.id === requisitionId);
    if (!order) return;
    const attempt = order.submissionAttempts?.at(-1);
    const snapshot = attempt?.snapshot || order.submittedSnapshot || order;
    detailTitle.textContent = `Requisition details · ${order.id}`;
    const summary = document.createElement("dl");
    summary.className = "requisition-metadata";
    for (const [label, value] of [
      ["Current procedural status", order.status],
      ["Institution", snapshot.institutionSnapshot?.institutionName || order.institutionSnapshot?.institutionName || "Not recorded"],
      ["Department", snapshot.institutionSnapshot?.department || "Not required or not recorded"],
      ["Submitted", snapshot.submittedAt ? new Date(snapshot.submittedAt).toLocaleString() : "Not submitted"],
      ["Total", money(snapshot.totalCents || 0)],
      ["Submission revision", String(attempt?.revision || 0)]
    ]) {
      const pair = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      pair.append(dt, dd);
      summary.append(pair);
    }
    const heading = document.createElement("h3");
    heading.textContent = "Submitted line items";
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "acquisition-table";
    const caption = document.createElement("caption");
    caption.textContent = `${order.id} · revision ${attempt?.revision || "not submitted"}`;
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const label of ["Line", "Item", "Catalog ID", "Quantity", "Unit price", "Extended", "Collection", "Fund", "Selector note"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headerRow.append(th);
    }
    thead.append(headerRow);
    const body = document.createElement("tbody");
    (snapshot.lines || []).forEach((line, index) => appendDetailLine(body, line, index));
    table.append(caption, thead, body);
    wrap.append(table);
    detailContent.replaceChildren(summary, heading, wrap);
    if (order.submissionAttempts?.length > 1) {
      const historyHeading = document.createElement("h3");
      historyHeading.textContent = "Prior submission revisions";
      const history = document.createElement("ol");
      for (const prior of order.submissionAttempts.slice(0, -1)) {
        const li = document.createElement("li");
        li.textContent = `Revision ${prior.revision} · ${new Date(prior.submittedAt).toLocaleString()} · ${prior.snapshot.lines.length} lines · ${money(prior.snapshot.totalCents)} · ${prior.validationOutcome?.valid ? "Processed" : "Returned"}`;
        history.append(li);
      }
      detailContent.append(historyHeading, history);
    }
    detailDialog.showModal();
  }

  function handleActions(event) {
    const button = event.target.closest("button[data-ts-action]");
    if (!button) return;
    const { requisitionId, tsAction } = button.dataset;
    if (tsAction === "review") reviewRequisition(requisitionId);
    if (tsAction === "correct") {
      try {
        window.PN_ACQUISITIONS.editRequisition(requisitionId);
      } catch (error) {
        setNotice(error.message, true);
      }
    }
    if (tsAction === "details") showDetails(requisitionId);
  }

  pendingBody.addEventListener("click", handleActions);
  returnedBody.addEventListener("click", handleActions);
  processedBody.addEventListener("click", handleActions);
  document.getElementById("close-requisition-detail").addEventListener("click", () => detailDialog.close());
  window.addEventListener("pn:session-change", render);
  window.addEventListener("pn:navigate", event => {
    if (event.detail.page === "technical-services") render();
  });
  window.addEventListener("pn:catalog-ready", () => {
    catalog = window.PN_ACQUISITIONS.getCatalogRecords();
    render();
  });
  window.PN_TECHNICAL_SERVICES = Object.freeze({
    validateSnapshot,
    composeCorrespondence,
    classifyCollection,
    classifyFund,
    procedures: PROCEDURES
  });
  if (window.PN_ACQUISITIONS.getCatalogCount() > 0) {
    catalog = window.PN_ACQUISITIONS.getCatalogRecords();
  }
  render();
}());
