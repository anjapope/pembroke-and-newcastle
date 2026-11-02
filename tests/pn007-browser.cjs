module.exports = async function runAcquisitionsAcceptance(hostPage, baseUrl) {
  const browser = hostPage.context().browser();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const isolatedContext = await browser.newContext();
  const page = await context.newPage();
  const isolatedPage = await isolatedContext.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const session = () => page.evaluate(() => window.PN_APP.getSession());
  const nav = target => page.locator(`button[data-page="${target}"]`).first().click();
  const catalog = await (await page.request.get(new URL("data/catalog.json", baseUrl).href)).json();

  async function configure(id, formatId, quantity) {
    await nav("catalog");
    await page.locator("#catalog-search").fill(id);
    await page.locator(`button[data-add-id="${id}"]`).click();
    await page.locator("#item-format").selectOption(formatId);
    await page.locator("#item-quantity").fill(String(quantity));
    const extended = await page.locator("#item-extended-price").innerText();
    await page.locator("#detail-add").click();
    await page.waitForFunction(() => !document.querySelector("#catalog-detail").open);
    return extended;
  }

  try {
    await page.goto(baseUrl);
    await page.waitForFunction(() => window.PN_ACQUISITIONS?.getCatalogCount() >= 1650);
    assert(await page.locator("#login-panel").count() === 0, "A login screen is still present");
    assert(await page.locator("#institution-form").count() === 0, "An institution setup form is still present");
    assert(await page.locator("#catalog-page").isVisible(), "The catalog is not the entry view");
    assert(!/\bDoris\b/i.test(await page.locator("body").innerText()), "A student-facing Doris reference remains");
    assert(await page.locator("#dashboard-allocation").innerText() === "$5,000.00", "Anonymous allocation is incorrect");
    assert((await session()).clientId === "ANONYMOUS", "Session did not initialize anonymously");

    const target = catalog.find(item => item.id === "PN001");
    assert(await configure(target.id, "hardcover", 2) === "$35.08", "Hardcover extended-price calculation is incorrect");
    assert(await page.locator("#open-cart-count").innerText() === "2", "Quantity was not reflected in the cart count");
    assert(await configure(target.id, "hardcover", 1) === "$17.54", "Configured unit price is incorrect");
    assert((await session()).cart.length === 1 && (await session()).cart[0].quantity === 3,
      "Identical item-format additions did not merge");
    assert(await configure(target.id, "trade-paperback", 1) === "$12.99", "Trade paperback reference price is incorrect");
    assert((await session()).cart.length === 2, "Different formats were not kept as separate lines");

    await page.locator("#header-cart-button").click();
    assert(await page.locator("#cart-subtotal").innerText() === "$65.61", "Cart total did not use configured format prices");
    assert(await page.locator("#cart-remaining").innerText() === "$4,934.39", "Projected balance is incorrect");
    await page.locator("#cart-items input[data-cart-field='quantity']").first().fill("4");
    await page.locator("#cart-items input[data-cart-field='quantity']").first().dispatchEvent("change");
    assert(await page.locator("#cart-subtotal").innerText() === "$83.15", "Cart quantity edit did not recalculate totals");
    await page.locator("#cart-items button[data-remove-cart-id='PN001'][data-remove-format-id='trade-paperback']").click();
    assert((await session()).cart.length === 1, "Removing a format line removed the wrong cart state");
    await page.locator("#close-cart").click();
    await configure(target.id, "trade-paperback", 1);
    assert((await session()).cart.length === 2, "A removed format could not be added again");
    await page.locator("#header-cart-button").click();
    await page.locator("#cart-items button[data-remove-cart-id='PN001'][data-remove-format-id='trade-paperback']").click();
    await page.locator("#close-cart").click();

    await nav("vendors");
    assert(await page.locator("#open-cart-count").innerText() === "4", "Vendor navigation lost cart quantity");
    await page.reload();
    await page.waitForFunction(() => window.PN_ACQUISITIONS?.getCatalogCount() >= 1650);
    assert((await session()).cart.length === 1 && (await session()).cart[0].quantity === 4,
      "Pending selections did not persist across reload");
    await isolatedPage.goto(baseUrl);
    await isolatedPage.waitForFunction(() => window.PN_ACQUISITIONS?.getCatalogCount() >= 1650);
    assert((await isolatedPage.evaluate(() => window.PN_APP.getSession())).cart.length === 0,
      "An independent browser session inherited pending selections");

    await nav("order-worksheet");
    await page.locator("#save-requisition").click();
    const orderId = (await session()).activeRequisitionId;
    assert(orderId, "A reviewed cart could not be saved as a requisition");
    await page.locator(`button[data-forward-order="${orderId}"]`).click();
    assert((await session()).orders.find(order => order.id === orderId).status === "submitted",
      "Saved requisition was not submitted for review");
    await nav("technical-services");
    await page.locator(`button[data-ts-action="review"][data-requisition-id="${orderId}"]`).click();
    assert((await session()).orders.find(order => order.id === orderId).status === "processed",
      "Existing review and processing workflow did not complete");
    assert(await page.locator("#dashboard-committed").innerText() === "$70.16",
      "Format-specific expenditure was not committed accurately");

    await page.setViewportSize({ width: 375, height: 812 });
    await nav("dashboard");
    await nav("catalog");
    await nav("dashboard");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "The compact catalog layout overflows on a narrow viewport");
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#reset-simulation").click();
    assert((await session()).cart.length === 0 && (await session()).orders.length === 0,
      "Reset did not clear requisitions and cart");
    assert(await page.locator("#catalog-page").isVisible(), "Reset did not return to the catalog");
    assert(errors.length === 0, errors.join("; "));
    return {
      anonymousEntry: true,
      variantsAndQuantityMerge: true,
      editableReversibleCart: true,
      isolatedSessionPersistence: true,
      requisitionReview: true,
      reset: true,
      responsiveCatalog: true,
      consoleErrors: errors
    };
  } finally {
    await context.close();
    await isolatedContext.close();
  }
};
