module.exports = async function runClassroomAcceptance(hostPage, baseUrl) {
  const browser = hostPage.context().browser();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const otherContext = await browser.newContext();
  const page = await context.newPage();
  const other = await otherContext.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const session = () => page.evaluate(() => window.PN_APP.getSession());
  const nav = target => page.locator(`button[data-page="${target}"]`).first().click();
  const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const start = Date.now();
  async function login(target, name) {
    await target.locator("#client-id").fill(name);
    await target.locator("#password").fill("collections");
    await target.locator('#login-form button[type="submit"]').click();
    await target.locator("#institution-name").fill("Alder Quay Public Library");
    await target.locator("#audience").fill("Harbour residents, families and local researchers");
    await target.locator("#category").selectOption("public-library");
    await target.locator("#department").fill("Community Collections");
    await target.locator("#priorities").fill("Local reading, science literacy and community history");
    await target.locator('#institution-form button[type="submit"]').click();
  }
  async function select(id) {
    await nav("catalog");
    await page.locator("#catalog-search").fill(id);
    await page.locator(`button[data-add-id="${id}"]`).click();
  }
  async function forward(id) {
    const before = await page.locator("#dashboard-committed").innerText();
    await page.locator(`button[data-forward-order="${id}"]`).click();
    assert((await session()).orders.find(order => order.id === id).status === "submitted", "Forwarding failed");
    assert(await page.locator("#dashboard-committed").innerText() === before, "Submission committed funds");
    await nav("technical-services");
    await page.locator(`button[data-ts-action="review"][data-requisition-id="${id}"]`).click();
  }
  try {
    await page.goto(baseUrl);
    await page.waitForFunction(() => window.PN_ACQUISITIONS?.getCatalogCount() === 1500);
    const loadMs = Date.now() - start;
    await login(page, "pn004-student-qa");
    const setupMs = Date.now() - start - loadMs;
    assert(await page.locator("#dashboard-allocation").innerText() === "$5,000.00", "Wrong initial allocation");
    await nav("catalog");
    assert(await page.locator("#catalog-results tr").count() === 20, "Catalog rendered more than one page");
    assert(await page.locator("#catalog-page-indicator").innerText() === "Page 1 of 75", "Wrong pagination");
    await page.locator("#catalog-next").click();
    assert(await page.locator("#catalog-page-indicator").innerText() === "Page 2 of 75", "Next page failed");
    await page.locator("#catalog-search").fill("coastal");
    await page.locator("#catalog-category").selectOption("Adult nonfiction");
    await page.locator("#catalog-format").selectOption("Print book");
    await page.locator("#catalog-min-price").fill("10");
    await page.locator("#catalog-max-price").fill("40");
    await page.locator("#catalog-sort").selectOption("price-desc");
    const filtered = await page.evaluate(() => {
      const start = performance.now();
      const records = window.PN_ACQUISITIONS.getCatalogRecords();
      const result = window.PN_ACQUISITIONS.filterCatalog(records, {
        query: "coastal", category: "Adult nonfiction", format: "Print book",
        minPriceCents: 1000, maxPriceCents: 4000, sort: "price-desc"
      });
      return { ids: result.map(item => item.id), prices: result.map(item => item.unitPriceCents), ms: performance.now() - start };
    });
    assert(filtered.ids.length > 0 && filtered.prices.every((price, i, values) => !i || values[i - 1] >= price), "Combined filters/price sort failed");
    assert((await page.locator("#catalog-count").innerText()).startsWith(`${filtered.ids.length} result`), "UI filter count differs");
    for (const sort of ["price-asc", "price-desc", "title-asc", "title-desc"]) {
      await page.locator("#catalog-sort").selectOption(sort);
      const sorted = await page.evaluate(sort => {
        const records = window.PN_ACQUISITIONS.filterCatalog(window.PN_ACQUISITIONS.getCatalogRecords(), { sort });
        return records.every((item, index) => {
          if (!index) return true;
          const previous = records[index - 1];
          return sort === "price-asc" ? previous.unitPriceCents <= item.unitPriceCents :
            sort === "price-desc" ? previous.unitPriceCents >= item.unitPriceCents :
              sort === "title-asc" ? previous.title.localeCompare(item.title) <= 0 :
                previous.title.localeCompare(item.title) >= 0;
        });
      }, sort);
      assert(sorted, `${sort} order failed`);
    }
    await page.locator("button[data-detail-id]").first().click();
    await page.locator("#catalog-detail").waitFor({ state: "visible" });
    assert(/fictional|simulated/i.test(await page.locator("#detail-content").innerText()), "Missing simulated provenance");
    await page.keyboard.press("Escape");
    assert(await page.locator("#catalog-detail").isHidden(), "Keyboard dialog dismissal failed");
    await page.locator('#catalog-filters button[type="reset"]').click();
    await page.waitForFunction(() => document.querySelector("#catalog-count").textContent.startsWith("1500 results"));
    const catalog = await (await page.request.get(new URL("data/catalog.json", baseUrl).href)).json();
    const firstItems = ["PN0101", "PN0102", "PN0103"].map(id => catalog.find(item => item.id === id));
    for (const item of firstItems) await select(item.id);
    await nav("order-worksheet");
    const collection = page.locator('#worksheet-lines select[data-field="collectionCode"]');
    await collection.nth(0).selectOption("JF");
    await collection.nth(1).selectOption("ANF");
    await collection.nth(2).selectOption("ANF");
    for (const fund of await page.locator('#worksheet-lines select[data-field="fundCode"]').all()) {
      await fund.selectOption("GENERAL");
    }
    const proposed = firstItems.reduce((sum, item) => sum + item.unitPriceCents, 0);
    assert(await page.locator("#worksheet-proposed").innerText() === money(proposed), "Incorrect integer-cent worksheet total");
    await page.locator("#save-requisition").click();
    const id = (await session()).activeRequisitionId;
    assert(await page.locator("#worksheet-committed").innerText() === "$0.00", "Saving committed funds");
    await forward(id);
    let order = (await session()).orders.find(order => order.id === id);
    assert(order.status === "returned", "Incorrect assignment was not returned");
    assert(order.correspondence[0].errors.some(error => error.code === "incompatible_collection"), "Wrong Doris finding");
    const original = JSON.stringify(order.submissionAttempts[0].snapshot);
    assert(await page.locator("#dashboard-committed").innerText() === "$0.00", "Return committed funds");
    await page.locator(`button[data-ts-action="correct"][data-requisition-id="${id}"]`).click();
    await collection.nth(0).selectOption("AF");
    await page.locator("#save-requisition").click();
    await page.locator("#resubmit-requisition").click();
    await nav("technical-services");
    await page.locator(`button[data-ts-action="review"][data-requisition-id="${id}"]`).click();
    order = (await session()).orders.find(order => order.id === id);
    assert(order.status === "processed" && order.submissionAttempts.length === 2, "Corrected revision failed");
    assert(JSON.stringify(order.submissionAttempts[0].snapshot) === original, "Original snapshot changed");
    await nav("order-worksheet");
    await page.locator("#new-requisition").click();
    const next = catalog.find(item => item.id === "PN0104");
    await select(next.id);
    await nav("order-worksheet");
    await page.locator('#worksheet-lines select[data-field="collectionCode"]').selectOption("AF");
    await page.locator("#save-requisition").click();
    const secondId = (await session()).activeRequisitionId;
    await forward(secondId);
    const total = proposed + next.unitPriceCents;
    assert((await session()).orders.every(order => order.status === "processed"), "Second requisition failed");
    assert(await page.locator("#dashboard-committed").innerText() === money(total), "Cumulative commitments incorrect");
    assert(await page.locator("#dashboard-available").innerText() === money(500000 - total), "Remaining funds incorrect");
    const before = JSON.stringify((await session()).orders);
    await page.reload();
    await page.waitForFunction(() => window.PN_ACQUISITIONS?.getCatalogCount() === 1500);
    assert(JSON.stringify((await session()).orders) === before, "Refresh changed history");
    assert(await page.locator(".correspondence-notice").count() === 3, "Refresh lost correspondence");

    await other.goto(baseUrl);
    await other.waitForFunction(() => window.PN_ACQUISITIONS?.getCatalogCount() === 1500);
    assert(await other.locator("#login-panel").isVisible(), "Private context inherited another student's session");
    await login(other, "pn004-student-qa");
    assert(await other.locator("#dashboard-committed").innerText() === "$0.00", "Same client ID shared spending");
    const otherBefore = await other.evaluate(() => JSON.stringify(window.PN_APP.getSession()));
    const responsive = [];
    for (const width of [1440, 1366, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const target of ["dashboard", "catalog", "order-worksheet", "technical-services"]) {
        await nav(target);
        const layout = await page.evaluate(() => ({
          viewport: innerWidth, width: document.documentElement.scrollWidth,
          regions: [...document.querySelectorAll(".panel:not([hidden]) .table-wrap")].map(region => ({
            scrollable: region.scrollWidth > region.clientWidth,
            keyboard: region.tabIndex === 0,
            width: region.getBoundingClientRect().width
          }))
        }));
        assert(layout.width <= layout.viewport + 1, `${width}px: ${target} overflows page`);
        assert(layout.regions.every(region => region.keyboard && region.width <= width), "Table not keyboard-scrollable");
      }
      responsive.push({ width, passed: true });
    }
    await nav("catalog");
    await page.locator("#catalog-search").fill("PN0101");
    await page.locator('button[data-detail-id="PN0101"]').click();
    await page.keyboard.press("Tab");
    await page.locator("#close-detail").focus();
    const focusStyle = await page.locator("#close-detail").evaluate(element => getComputedStyle(element).outlineStyle);
    assert(focusStyle !== "none", "No visible keyboard focus");
    await page.keyboard.press("Escape");
    await nav("dashboard");
    const preserved = JSON.stringify(await session());
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator("#reset-simulation").click();
    assert(JSON.stringify(await session()) === preserved, "Cancelled reset changed state");
    // A sentinel is used only to verify storage isolation, never to seed the student scenario.
    await page.evaluate(() => localStorage.setItem("pn004-unrelated-qa", "preserve"));
    page.once("dialog", dialog => {
      assert(dialog.message().includes("correspondence") && dialog.message().includes("budget history"), "Reset warning incomplete");
      return dialog.accept();
    });
    await page.locator("#reset-simulation").click();
    assert(await page.locator("#login-panel").isVisible(), "Reset did not return to login");
    assert(await session() === null, "Reset kept session");
    assert(await page.evaluate(() => localStorage.getItem("pn004-unrelated-qa")) === "preserve", "Reset erased unrelated data");
    assert(await other.evaluate(() => JSON.stringify(window.PN_APP.getSession())) === otherBefore, "Reset affected independent browser");
    await page.reload();
    await login(page, "pn004-student-qa");
    const reset = await session();
    assert(reset.orders.length === 0 && reset.cart.length === 0, "Reset kept exercise history");
    assert(await page.locator("#dashboard-available").innerText() === "$5,000.00", "Reset did not restore allocation");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Narrow profile form overflowed");
    assert(errors.length === 0, errors.join("; "));
    return {
      freshStudentWorkflow: true, processedRequisitions: 2, correspondence: 3,
      committedCents: total, availableCents: 500000 - total, loadMs, setupMs,
      combinedFilterMs: filtered.ms, catalogCount: catalog.length,
      responsive, keyboardDialog: true, independentPrivateContexts: true,
      resetCancellation: true, resetIsolation: true, resetStartingConditions: true,
      consoleErrors: errors
    };
  } finally {
    await context.close();
    await otherContext.close();
  }
};
