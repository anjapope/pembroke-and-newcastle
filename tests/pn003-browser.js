/* Run from the application's /pembroke-and-newcastle/ page with the test client only. */
window.runPN003BrowserTests = async function () {
  "use strict";
  const results = [];
  const errors = [];
  const key = "pn-foundation-session";
  const existing = window.PN_APP.getSession();
  if (existing && !/^pn003[-\w]*qa$/.test(existing.clientId)) {
    throw new Error("Log out of the non-test session before running browser regressions.");
  }
  const originalConfirm = window.confirm;
  const originalSetItem = Storage.prototype.setItem;
  const onError = event => errors.push(event.message || String(event.reason));
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onError);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const get = selector => {
    const element = document.querySelector(selector);
    assert(element, `Missing element: ${selector}`);
    return element;
  };
  const fill = (selector, value) => {
    const element = get(selector);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const click = selector => get(selector).click();
  const session = () => window.PN_APP.getSession();
  const order = id => session().orders.find(entry => entry.id === id);
  const navigate = page => window.PN_APP.navigate(page);
  const record = async (name, body) => {
    await body();
    results.push({ name, passed: true });
  };
  const catalog = window.PN_ACQUISITIONS.getCatalogRecords();
  assert(catalog.length === 1500, "Wait for all 1,500 catalog records before running tests.");

  function login(categoryId = "public-library") {
    if (session()) click("#logout");
    fill("#client-id", "pn003-browser-qa");
    fill("#password", "collections");
    click('#login-form button[type="submit"]');
    fill("#institution-name", "PN-003 Verification Institution");
    fill("#audience", "Researchers, residents, and students");
    fill("#category", categoryId);
    if (get("#department").required) fill("#department", "Collections");
    fill("#priorities", "Institutional research and local collections");
    click('#institution-form button[type="submit"]');
    assert(session().setupComplete, "Institutional setup did not complete.");
  }

  function line(itemId = "PN054", quantity = 1, code = "ANF") {
    const item = catalog.find(entry => entry.id === itemId);
    return {
      catalogId: item.id, title: item.title, quantity,
      unitPriceCents: item.unitPriceCents, extendedPriceCents: item.unitPriceCents * quantity,
      collectionCode: code, fundCode: "GENERAL", selectorNote: ""
    };
  }

  function fixture(id, lines = [line()], overrides = {}) {
    const profile = session();
    const now = new Date().toISOString();
    const snapshot = {
      requisitionId: id, clientId: profile.clientId, submittedAt: now,
      institutionSnapshot: {
        institutionName: profile.institutionName, categoryId: profile.categoryId,
        department: profile.department
      },
      lines, totalCents: lines.reduce((sum, entry) => sum + entry.extendedPriceCents, 0),
      justification: "", financialAcknowledgment: null, ...overrides
    };
    return {
      id, clientId: profile.clientId, createdAt: now, modifiedAt: now,
      submittedAt: now, institutionSnapshot: snapshot.institutionSnapshot,
      status: "submitted", lines: structuredClone(lines), totalCents: snapshot.totalCents,
      justification: snapshot.justification, submittedSnapshot: structuredClone(snapshot),
      submissionAttempts: [{
        revision: 1, submittedAt: now, snapshot: structuredClone(snapshot),
        validationOutcome: null, correspondence: [], financialAcknowledgment: null
      }],
      correspondence: [], processingRecord: null
    };
  }

  function seed(orders) {
    window.PN_APP.updateSession({
      orders, cart: [], activeRequisitionId: null, workingJustification: "", schemaVersion: 3
    });
    navigate("technical-services");
  }

  function review(id) {
    click(`#pending-review-history button[data-ts-action="review"][data-requisition-id="${id}"]`);
  }

  function reviewAgain(id) {
    const button = document.createElement("button");
    button.dataset.tsAction = "review";
    button.dataset.requisitionId = id;
    get("#pending-review-history").append(button);
    button.click();
    button.remove();
  }

  function save(lines, justification = "") {
    window.PN_APP.updateSession({ cart: lines, activeRequisitionId: null, workingJustification: justification });
    navigate("order-worksheet");
    click("#save-requisition");
    const id = session().activeRequisitionId;
    assert(id && order(id).status === "saved", `Saving failed: ${get("#acq-notice").textContent}`);
    return id;
  }

  function forward(id) {
    window.PN_ACQUISITIONS.submitRequisition(id);
    assert(order(id).status === "submitted", `Forwarding failed: ${get("#acq-notice").textContent}`);
    navigate("technical-services");
  }

  try {
    await record("PN-001: all five categories, allocations and required departments", () => {
      for (const institution of window.PN_INSTITUTIONS) {
        login(institution.id);
        assert(get("#department").required === institution.requiresDepartment, "Department rule changed.");
        assert(get("#dashboard-allocation").textContent ===
          new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(institution.annualBudget),
        "Allocation mismatch.");
      }
      login();
    });

    await record("PN-002: catalog search, adding, worksheet save and explicit first-pass review", () => {
      navigate("catalog");
      fill("#catalog-search", "A Year of Hedgerows");
      click('#catalog-results button[data-add-id="PN054"]');
      navigate("order-worksheet");
      fill('#worksheet-lines select[data-field="collectionCode"]', "ANF");
      click("#save-requisition");
      const id = session().activeRequisitionId;
      assert(order(id).status === "saved", "Catalog selection was not saved.");
      forward(id);
      assert(order(id).status === "submitted", "Opening Technical Services processed an order.");
      review(id);
      assert(order(id).status === "processed", "Valid requisition was not processed.");
      assert(get("#dashboard-committed").textContent === "$19.95", "Incorrect committed amount.");
      assert(get("#dashboard-available").textContent === "$4,980.05", "Incorrect remaining amount.");
      assert(order(id).correspondence[0].message.includes("This is the expected outcome"), "Acceptance notice missing.");
      reviewAgain(id);
      assert(order(id).correspondence.length === 1, "Duplicate review created correspondence.");
      const before = JSON.stringify(order(id));
      window.PN_ACQUISITIONS.editRequisition(id);
      window.PN_ACQUISITIONS.submitRequisition(id);
      assert(JSON.stringify(order(id)) === before, "Processed order could be edited or resubmitted.");
    });

    await record("Snapshot is authoritative, not the current worksheet or mutable order copy", () => {
      const id = "PN-QA-0002";
      const entry = fixture(id);
      entry.lines[0].collectionCode = "JF";
      seed([entry]);
      window.PN_APP.updateSession({ cart: [line("PN054", 1, "JF")] });
      review(id);
      assert(order(id).status === "processed", "Review used the mutable worksheet instead of the snapshot.");
      assert(order(id).lines[0].collectionCode === "ANF", "Processed content differs from authoritative snapshot.");
    });

    await record("Return, save corrections, reopen, resubmit same ID and retain both snapshots", () => {
      const id = "PN-QA-0003";
      const entry = fixture(id, [line("PN054", 1, "REF")]);
      entry.submittedAt = "2024-01-01T12:00:00.000Z";
      entry.submittedSnapshot.submittedAt = entry.submittedAt;
      entry.submissionAttempts[0].submittedAt = entry.submittedAt;
      entry.submissionAttempts[0].snapshot.submittedAt = entry.submittedAt;
      seed([entry]);
      review(id);
      const first = JSON.stringify(order(id).submissionAttempts[0].snapshot);
      assert(order(id).status === "returned", "Unconventional assignment was not returned.");
      const reviewedAt = order(id).submissionAttempts[0].validationOutcome.reviewedAt;
      assert(get("#returned-history tr").cells[1].textContent === new Date(reviewedAt).toLocaleString(),
        "Last reviewed shows the submission date instead of the review date.");
      assert(order(id).correspondence[0].errors[0].code === "collection_explanation_required", "Wrong procedural finding.");
      click(`#returned-history button[data-ts-action="correct"][data-requisition-id="${id}"]`);
      fill('#worksheet-lines input[data-field="selectorNote"]', "Used at the local research reference desk.");
      click("#save-requisition");
      navigate("technical-services");
      click(`#returned-history button[data-ts-action="correct"][data-requisition-id="${id}"]`);
      assert(get('#worksheet-lines input[data-field="selectorNote"]').value ===
        "Used at the local research reference desk.", "Reopening discarded saved corrections.");
      click("#resubmit-requisition");
      assert(order(id).status === "submitted" && order(id).submissionAttempts.length === 2, "Explicit resubmission failed.");
      navigate("technical-services");
      review(id);
      assert(order(id).status === "processed", "Explained assignment did not process.");
      assert(order(id).id === id && order(id).correspondence.length === 2, "ID or correspondence history changed.");
      assert(JSON.stringify(order(id).submissionAttempts[0].snapshot) === first, "Original snapshot was mutated.");
      click(`#processed-history button[data-ts-action="details"][data-requisition-id="${id}"]`);
      fill("#requisition-revision", "1");
      assert(get("#requisition-detail-content").textContent.includes("REF"), "Prior revision details are unavailable.");
      click("#close-requisition-detail");
    });

    const invalidCases = [
      ["missing collection", entry => { entry.submissionAttempts[0].snapshot.lines[0].collectionCode = ""; }, "missing_collection_code", "14-C"],
      ["foreign collection", entry => { entry.submissionAttempts[0].snapshot.lines[0].collectionCode = "SPEC"; }, "invalid_collection_code", "14-C"],
      ["incompatible collection", entry => { entry.submissionAttempts[0].snapshot.lines[0].collectionCode = "JF"; }, "incompatible_collection", "14-C"],
      ["invalid quantity", entry => { entry.submissionAttempts[0].snapshot.lines[0].quantity = 0; }, "invalid_quantity", "11-A"],
      ["foreign fund", entry => { entry.submissionAttempts[0].snapshot.lines[0].fundCode = "RESEARCH"; }, "invalid_fund_code", "8-B"],
      ["catalog price", entry => { entry.submissionAttempts[0].snapshot.lines[0].unitPriceCents = 1; }, "catalog_price_mismatch", "11-A"],
      ["stored total", entry => { entry.submissionAttempts[0].snapshot.totalCents = 1; }, "requisition_total_mismatch", "11-A"]
    ];
    for (const [label, change, errorCode, procedure] of invalidCases) {
      await record(`Doris rejection: ${label}, precise finding and procedure`, () => {
        const id = "PN-QA-0004";
        const entry = fixture(id);
        change(entry);
        seed([entry]);
        review(id);
        const found = order(id).submissionAttempts[0].validationOutcome.errors.find(error => error.code === errorCode);
        assert(order(id).status === "returned" && found, `Missing finding: ${errorCode}`);
        assert(found.procedure.includes(`Procedure ${procedure}`) && found.correctiveAction, "Wrong or absent procedure.");
        assert(order(id).correspondence[0].errors.some(error => error.code === errorCode), "Correspondence fabricated the violation.");
        reviewAgain(id);
        assert(order(id).correspondence.length === 1, "Returned order was reviewed twice.");
      });
    }

    await record("Cumulative 80% acknowledgment is persisted at forwarding and not repeated at review", () => {
      seed([]);
      const first = save([line("PN099", 20, "LOCAL")]);
      fill('#worksheet-lines input[data-field="selectorNote"]', "For local exhibition reference.");
      click("#save-requisition");
      forward(first);
      review(first);
      assert(order(first).status === "processed", "Initial expenditure failed.");
      let prompts = 0;
      window.confirm = message => {
        prompts++;
        assert(message.includes("11 months") && message.includes("Projected remaining"), "Incomplete financial warning.");
        return true;
      };
      const second = save([{ ...line("PN099", 3, "LOCAL"), selectorNote: "For local exhibition reference." }]);
      forward(second);
      assert(prompts === 1, "Forwarding did not require a single cumulative acknowledgment.");
      const ack = order(second).submissionAttempts[0].financialAcknowledgment;
      assert(ack.previouslyCommittedCents === 356000 && ack.proposedCents === 53400 &&
        ack.projectedRemainingCents === 90600 && ack.committedPercentage === 81.88 &&
        ack.monthsRemaining === 11, "Incorrect persisted acknowledgment.");
      review(second);
      assert(order(second).status === "processed" && prompts === 1, "Review repeated the same acknowledgment.");
      assert(get("#dashboard-committed").textContent === "$4,094.00", "Multiple commitments were calculated incorrectly.");
    });

    await record("Changed commitment requires a fresh acknowledgment; exact remaining budget is processable", () => {
      const proposed = fixture("PN-QA-0005");
      const committed = 500000 - proposed.totalCents;
      const prior = fixture("PN-QA-0006");
      prior.status = "processed";
      prior.totalCents = committed;
      prior.processingRecord = { totalCents: committed, processedAt: new Date().toISOString(), submissionRevision: 1 };
      proposed.submissionAttempts[0].financialAcknowledgment = {
        acknowledged: true, acknowledgedAt: new Date().toISOString(),
        annualAllocationCents: 500000, previouslyCommittedCents: 0,
        proposedCents: proposed.totalCents, projectedRemainingCents: 500000 - proposed.totalCents,
        committedPercentage: Number((proposed.totalCents / 500000 * 100).toFixed(2)), monthsRemaining: 11
      };
      seed([prior, proposed]);
      let prompts = 0;
      window.confirm = message => { prompts++; assert(message.includes("100%"), "Wrong changed-budget warning."); return true; };
      review(proposed.id);
      assert(order(proposed.id).status === "processed" && prompts === 1, "Fresh acknowledgment was not enforced.");
      assert(get("#dashboard-available").textContent === "$0.00", "Exact-balance processing did not reach zero.");
    });

    await record("Budget overage is returned with exact shortfall, never a negative committed balance", () => {
      const proposed = fixture("PN-QA-0007");
      const prior = fixture("PN-QA-0008");
      prior.status = "processed";
      prior.totalCents = 500000 - proposed.totalCents + 100;
      prior.processingRecord = { totalCents: prior.totalCents, processedAt: new Date().toISOString(), submissionRevision: 1 };
      seed([prior, proposed]);
      review(proposed.id);
      const error = order(proposed.id).correspondence[0].errors.find(entry => entry.code === "budget_overage");
      assert(order(proposed.id).status === "returned" && error.message.includes("$1.00"), "Budget shortfall was not exact.");
    });

    await record("Missing financial acknowledgment can be declined and returned with required action", () => {
      const proposed = fixture("PN-QA-0009", [line("PN099", 23, "LOCAL")]);
      proposed.submissionAttempts[0].snapshot.lines[0].selectorNote = "For local exhibitions.";
      seed([proposed]);
      window.confirm = () => false;
      review(proposed.id);
      assert(order(proposed.id).status === "returned" &&
        order(proposed.id).correspondence[0].errors.some(error => error.code === "missing_financial_acknowledgment"),
      "Declining acknowledgment was not recorded as an outstanding requirement.");
    });

    await record("Storage failure cannot report or commit successful processing", () => {
      const proposed = fixture("PN-QA-0010");
      seed([proposed]);
      const before = localStorage.getItem(key);
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException("Test quota failure", "QuotaExceededError");
        return originalSetItem.call(this, name, value);
      };
      review(proposed.id);
      assert(order(proposed.id).status === "submitted" && localStorage.getItem(key) === before,
        "Failed storage write committed a processing result.");
      assert(get("#acq-notice").textContent.includes("could not be saved"), "Storage failure was not surfaced.");
      Storage.prototype.setItem = originalSetItem;
      review(proposed.id);
      assert(order(proposed.id).status === "processed", "Processing did not recover after storage became available.");
    });

    await record("Unique-object quantity limit is enforced by review", () => {
      const entry = fixture("PN-QA-0011", [line("PN081", 2, "LOCAL")]);
      seed([entry]);
      review(entry.id);
      assert(order(entry.id).status === "returned" &&
        order(entry.id).correspondence[0].errors.some(error => error.code === "invalid_quantity"),
      "Unique object was processed with quantity greater than one.");
    });

    await record("Required department can be corrected without losing the original submission", () => {
      const entry = fixture("PN-QA-0012");
      entry.submissionAttempts[0].snapshot.institutionSnapshot.department = "";
      seed([entry]);
      review(entry.id);
      assert(order(entry.id).status === "returned", "Missing department was not returned.");
      click(`#returned-history button[data-ts-action="correct"][data-requisition-id="${entry.id}"]`);
      click("#save-requisition");
      assert(order(entry.id).institutionSnapshot.department === "Collections", "Saving did not refresh the corrected profile snapshot.");
      click("#resubmit-requisition");
      navigate("technical-services");
      review(entry.id);
      assert(order(entry.id).status === "processed", "Department correction could not be processed.");
      assert(order(entry.id).submissionAttempts[0].snapshot.institutionSnapshot.department === "", "Original department snapshot was overwritten.");
    });

    await record("Legacy PN-002 submitted snapshot migrates once and remains reviewable", () => {
      const entry = fixture("PN-QA-0013");
      delete entry.submissionAttempts;
      delete entry.correspondence;
      delete entry.submittedSnapshot.clientId;
      seed([entry]);
      assert(order(entry.id).submissionAttempts.length === 1 &&
        order(entry.id).submissionAttempts[0].snapshot.clientId === session().clientId,
      "PN-002 submission migration failed.");
      navigate("dashboard");
      navigate("technical-services");
      assert(order(entry.id).submissionAttempts.length === 1, "Migration created duplicate attempts.");
      review(entry.id);
      assert(order(entry.id).status === "processed", "Migrated submission could not be processed.");
    });

    await record("Repeated invalid revisions retain each review and prior content", () => {
      const entry = fixture("PN-QA-0014", [line("PN054", 1, "JF")]);
      seed([entry]);
      review(entry.id);
      const first = JSON.stringify(order(entry.id).submissionAttempts[0].snapshot);
      click(`#returned-history button[data-ts-action="correct"][data-requisition-id="${entry.id}"]`);
      fill('#worksheet-lines input[data-field="selectorNote"]', "This note cannot override an incompatible designation.");
      click("#save-requisition");
      click("#resubmit-requisition");
      navigate("technical-services");
      review(entry.id);
      assert(order(entry.id).status === "returned" && order(entry.id).correspondence.length === 2, "A still-invalid revision was accepted.");
      assert(order(entry.id).submissionAttempts[1].validationOutcome.errors.some(error => error.code === "incompatible_collection"), "Original concern was not retained.");
      assert(JSON.stringify(order(entry.id).submissionAttempts[0].snapshot) === first, "Prior attempt was changed.");
    });

    await record("Threshold return and resubmission reuse the unchanged financial acknowledgment", () => {
      seed([]);
      let prompts = 0;
      window.confirm = () => { prompts++; return true; };
      const id = save([line("PN099", 23, "LOCAL")]);
      forward(id);
      review(id);
      assert(order(id).status === "returned", "Unexplained unconventional assignment was not returned.");
      click(`#returned-history button[data-ts-action="correct"][data-requisition-id="${id}"]`);
      fill('#worksheet-lines input[data-field="selectorNote"]', "Resources for the local exhibition programme.");
      click("#save-requisition");
      click("#resubmit-requisition");
      navigate("technical-services");
      review(id);
      assert(order(id).status === "processed" && prompts === 1, "Unchanged finances forced duplicate confirmation.");
    });

    await record("Archives, museums and schools require a one-time expenditure justification", () => {
      for (const [category, item, quantity, code] of [
        ["archive-special-collections", "PN082", 1, "MSS"],
        ["museum-cultural-heritage", "PN085", 1, "EXHIBIT"],
        ["school-library-media-center", "PN099", 14, "REF"]
      ]) {
        login(category);
        const entry = fixture("PN-QA-0015", [{ ...line(item, quantity, code), selectorNote: "Selected for institutional study." }]);
        seed([entry]);
        review(entry.id);
        assert(order(entry.id).status === "returned" &&
          order(entry.id).correspondence[0].errors.some(error => error.code === "missing_expenditure_justification"),
        `Missing one-time justification was accepted for ${category}.`);
        click(`#returned-history button[data-ts-action="correct"][data-requisition-id="${entry.id}"]`);
        fill("#requisition-justification", "One-time acquisition for the institution's documented collecting programme.");
        click("#save-requisition");
        window.confirm = () => true;
        click("#resubmit-requisition");
        navigate("technical-services");
        review(entry.id);
        assert(order(entry.id).status === "processed", `Justified resubmission failed for ${category}.`);
      }
      login();
    });

    await record("Malformed processing history cannot be treated as an unspent balance", () => {
      const proposed = fixture("PN-QA-0016");
      const prior = fixture("PN-QA-0017");
      prior.status = "processed";
      prior.processingRecord = { totalCents: -1, processedAt: new Date().toISOString(), submissionRevision: 1 };
      seed([prior, proposed]);
      review(proposed.id);
      assert(order(proposed.id).status === "submitted" &&
        get("#acq-notice").textContent.includes("review is unavailable"),
      "Invalid committed history permitted processing.");
      seed([]);
    });

    await record("Malformed local records are surfaced without rendering exceptions", () => {
      window.PN_APP.updateSession({ orders: [null], cart: [], activeRequisitionId: null });
      assert(get("#pending-review-history").textContent.includes("malformed records"),
        "Malformed history was not reported.");
      seed([]);
    });

    await record("Session persistence does not retain mutable caller references", () => {
      const orders = [fixture("PN-QA-0020")];
      seed(orders);
      orders[0].status = "processed";
      orders[0].submissionAttempts[0].snapshot.lines[0].collectionCode = "JF";
      assert(order(orders[0].id).status === "submitted" &&
        order(orders[0].id).submissionAttempts[0].snapshot.lines[0].collectionCode === "ANF",
      "Caller references mutated the persisted session.");
    });

    await record("Category revision cannot create a negative annual balance", () => {
      const prior = fixture("PN-QA-0018");
      prior.status = "processed";
      prior.totalCents = 400000;
      prior.processingRecord = { totalCents: 400000, processedAt: new Date().toISOString(), submissionRevision: 1 };
      seed([prior]);
      navigate("dashboard");
      click("#revise-profile");
      fill("#category", "school-library-media-center");
      click('#institution-form button[type="submit"]');
      assert(session().categoryId === "public-library" &&
        get("#notice").textContent.includes("below the institution's committed expenditure"),
      "Category revision allowed a negative remaining balance.");
      click("#cancel-revision");
      seed([]);
    });

    await record("US-dollar active application, procedure register, correspondence, and no console exceptions", () => {
      const entry = fixture("PN-QA-0019");
      seed([entry]);
      review(entry.id);
      navigate("technical-services");
      const activeText = document.body.textContent;
      assert(!/£|\bGBP\b|budgetPence/.test(activeText), "Legacy GBP values are active.");
      for (const procedure of ["14-C", "8-B", "11-A", "22-D", "3-F"]) {
        assert(get(".procedure-register").textContent.includes(procedure), `Missing procedure ${procedure}`);
      }
      assert(get("#correspondence-history").textContent.includes("Technical Services Clerk II"), "Doris identity missing.");
      assert(errors.length === 0, `Browser exceptions: ${errors.join("; ")}`);
    });

    return { passed: results.length, results, errors, persistenceClient: session().clientId };
  } finally {
    window.confirm = originalConfirm;
    Storage.prototype.setItem = originalSetItem;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onError);
  }
};
