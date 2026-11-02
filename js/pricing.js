(function (root, factory) {
  const pricing = factory();
  if (typeof module === "object" && module.exports) module.exports = pricing;
  if (root) root.PN_PRICING = Object.freeze(pricing);
}(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";

  function slug(value) {
    return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const FORMAT_DEFINITIONS = Object.freeze({
    paperback: { id: "paperback", name: "Paperback", multiplier: 1 },
    hardcover: { id: "hardcover", name: "Hardcover", multiplier: 1.35 },
    "trade-paperback": { id: "trade-paperback", name: "Trade paperback", multiplier: 1 },
    "mass-market-paperback": { id: "mass-market-paperback", name: "Mass-market paperback", multiplier: 0.75 },
    "large-print-paperback": { id: "large-print-paperback", name: "Large print paperback", multiplier: 1.4 },
    "large-print-hardcover": { id: "large-print-hardcover", name: "Large print hardcover", multiplier: 1.65 },
    "board-book": { id: "board-book", name: "Board book", multiplier: 0.85 },
    "picture-book-paperback": { id: "picture-book-paperback", name: "Picture book paperback", multiplier: 1 },
    "picture-book-hardcover": { id: "picture-book-hardcover", name: "Picture book hardcover", multiplier: 1.35 },
    "early-reader-paperback": { id: "early-reader-paperback", name: "Early reader paperback", multiplier: 1 },
    "early-reader-hardcover": { id: "early-reader-hardcover", name: "Early reader hardcover", multiplier: 1.3 },
    "chapter-book-paperback": { id: "chapter-book-paperback", name: "Chapter book paperback", multiplier: 1 },
    "chapter-book-hardcover": { id: "chapter-book-hardcover", name: "Chapter book hardcover", multiplier: 1.35 },
    "juvenile-nonfiction-paperback": { id: "juvenile-nonfiction-paperback", name: "Juvenile nonfiction paperback", multiplier: 1 },
    "juvenile-nonfiction-hardcover": { id: "juvenile-nonfiction-hardcover", name: "Juvenile nonfiction hardcover", multiplier: 1.35 }
  });

  const DIGITAL_SERVICES = Object.freeze({
    consortium: Object.freeze({ id: "consortium", name: "Digital Lending Consortium", annualFeeCents: 250000 }),
    direct: Object.freeze({ id: "direct", name: "Direct Digital Licensing", annualFeeCents: 75000 }),
    "pay-per-circulation": Object.freeze({ id: "pay-per-circulation", name: "Pay-Per-Circulation Service", annualFeeCents: 0 })
  });

  function getDigitalService(modelId) {
    return Object.hasOwn(DIGITAL_SERVICES, modelId) ? DIGITAL_SERVICES[modelId] : null;
  }

  function digitalServiceFeeCents(enrollment) {
    if (enrollment === null || enrollment === undefined) return 0;
    const service = getDigitalService(enrollment.modelId);
    if (!service || service.annualFeeCents === 0 ||
        enrollment.annualFeeCents !== service.annualFeeCents) {
      throw new Error("The saved digital service enrollment contains an invalid annual fee.");
    }
    return service.annualFeeCents;
  }

  function totalCommittedCents(processedCents, enrollment) {
    if (!Number.isSafeInteger(processedCents) || processedCents < 0) {
      throw new Error("Processed expenditures must be nonnegative whole-cent values.");
    }
    const total = processedCents + digitalServiceFeeCents(enrollment);
    if (!Number.isSafeInteger(total)) throw new Error("Committed expenditures exceed safe financial calculation limits.");
    return total;
  }

  function payPerCirculationEstimate(annualUsage) {
    if (!Number.isSafeInteger(annualUsage) || annualUsage < 0 || annualUsage > 1000000) {
      throw new Error("Annual checkout estimates must be whole numbers from 0 to 1,000,000.");
    }
    const estimate = annualUsage * 300;
    if (!Number.isSafeInteger(estimate)) throw new Error("The usage estimate exceeds safe financial calculation limits.");
    return estimate;
  }

  function getDigitalLicenseTerms(item, formatId) {
    if (!item || typeof item.format !== "string") return null;
    const isEbook = item.format.toLocaleLowerCase() === "ebook" ||
      item.simulatedEditions?.some(edition =>
        edition.id === formatId &&
        typeof edition.name === "string" &&
        edition.name.toLocaleLowerCase() === "ebook"
      );
    if (!isEbook) return null;
    return Object.freeze({
      users: 1,
      termYears: 2,
      checkoutLimit: 26,
      priceCents: item.unitPriceCents
    });
  }

  function pricedFormat(item, definition) {
    return {
      id: definition.id,
      name: definition.name,
      unitPriceCents: Math.round(item.unitPriceCents * definition.multiplier)
    };
  }

  function explicitBookType(item) {
    const metadata = item.metadata || {};
    const knownTypes = ["board-book", "picture-book", "early-reader", "chapter-book", "juvenile-nonfiction"];
    const declared = [metadata.bookType, item.format]
      .filter(value => typeof value === "string")
      .map(value => slug(value));
    const text = `${item.description || ""} ${metadata.intendedUse || ""}`.toLocaleLowerCase();
    return knownTypes.find(type => declared.includes(type) ||
      (type === "picture-book" && /\bpicture book\b/.test(text)) ||
      (type === "early-reader" && /\bearly reader\b/.test(text)) ||
      (type === "chapter-book" && /\bchapter book\b/.test(text)) ||
      (type === "board-book" && /\bboard book\b/.test(text)) ||
      (type === "juvenile-nonfiction" && /\bjuvenile nonfiction\b/.test(text))) || null;
  }

  function getAudienceBookFormats(item) {
    const category = item.materialCategory;
    if (item.format !== "Print book" && item.format !== "Picture book") return null;

    if (category === "Adult fiction" || category === "Adult nonfiction") {
      const definitions = [
        FORMAT_DEFINITIONS["trade-paperback"],
        FORMAT_DEFINITIONS["mass-market-paperback"],
        FORMAT_DEFINITIONS.hardcover
      ];
      const metadata = item.metadata || {};
      const eligible = Array.isArray(metadata.eligibleFormats) ? metadata.eligibleFormats : [];
      if (metadata.largePrint === true || Array.isArray(metadata.largePrintFormats) ||
          eligible.includes("large-print-paperback") || eligible.includes("large-print-hardcover")) {
        const supported = Array.isArray(metadata.largePrintFormats) ? metadata.largePrintFormats : eligible;
        if (metadata.largePrint === true || supported.includes("large-print-paperback")) {
          definitions.push(FORMAT_DEFINITIONS["large-print-paperback"]);
        }
        if (metadata.largePrint === true || supported.includes("large-print-hardcover")) {
          definitions.push(FORMAT_DEFINITIONS["large-print-hardcover"]);
        }
      }
      return definitions.map(definition => pricedFormat(item, definition));
    }

    if (category === "Young adult materials") {
      const definitions = [FORMAT_DEFINITIONS.paperback, FORMAT_DEFINITIONS.hardcover];
      const metadata = item.metadata || {};
      const eligible = Array.isArray(metadata.eligibleFormats) ? metadata.eligibleFormats : [];
      const largePrint = Array.isArray(metadata.largePrintFormats) ? metadata.largePrintFormats : eligible;
      if (metadata.largePrint === true || largePrint.includes("large-print-paperback")) {
        definitions.push(FORMAT_DEFINITIONS["large-print-paperback"]);
      }
      if (metadata.largePrint === true || largePrint.includes("large-print-hardcover")) {
        definitions.push(FORMAT_DEFINITIONS["large-print-hardcover"]);
      }
      return definitions.map(definition => pricedFormat(item, definition));
    }

    if (category !== "Juvenile fiction" && category !== "Juvenile nonfiction") return null;
    const metadata = item.metadata || {};
    const eligible = Array.isArray(metadata.eligibleFormats) ? metadata.eligibleFormats : [];
    const juvenileIds = Object.keys(FORMAT_DEFINITIONS).filter(id =>
      id.startsWith("board-book") || id.startsWith("picture-book-") ||
      id.startsWith("early-reader-") || id.startsWith("chapter-book-") ||
      id.startsWith("juvenile-nonfiction-")
    );
    const declaredFormats = eligible
      .filter(id => juvenileIds.includes(id))
      .map(id => FORMAT_DEFINITIONS[id]);
    if (declaredFormats.length) {
      return declaredFormats.map(definition => pricedFormat(item, definition));
    }
    const bookType = item.format === "Picture book" ? "picture-book" : explicitBookType(item);
    const juvenileFormats = {
      "board-book": [FORMAT_DEFINITIONS["board-book"]],
      "picture-book": [FORMAT_DEFINITIONS["picture-book-paperback"], FORMAT_DEFINITIONS["picture-book-hardcover"]],
      "early-reader": [FORMAT_DEFINITIONS["early-reader-paperback"], FORMAT_DEFINITIONS["early-reader-hardcover"]],
      "chapter-book": [FORMAT_DEFINITIONS["chapter-book-paperback"], FORMAT_DEFINITIONS["chapter-book-hardcover"]],
      "juvenile-nonfiction": [FORMAT_DEFINITIONS["juvenile-nonfiction-paperback"], FORMAT_DEFINITIONS["juvenile-nonfiction-hardcover"]]
    };
    if (category === "Juvenile nonfiction" && !bookType) {
      return juvenileFormats["juvenile-nonfiction"].map(definition => pricedFormat(item, definition));
    }
    return bookType && juvenileFormats[bookType]
      ? juvenileFormats[bookType].map(definition => pricedFormat(item, definition))
      : null;
  }

  function getFormatOptions(item) {
    if (!item || typeof item.format !== "string" ||
        !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0) {
      throw new Error("Cannot determine formats for an invalid catalog item.");
    }
    if (Array.isArray(item.simulatedEditions)) {
      if (!item.simulatedEditions.length) {
        throw new Error("The catalog item does not specify any eligible simulated editions.");
      }
      return item.simulatedEditions.map(edition => {
        if (!edition || typeof edition.id !== "string" || !edition.id ||
            typeof edition.name !== "string" || !edition.name) {
          throw new Error("The catalog item contains an invalid simulated edition.");
        }
        let unitPriceCents;
        if (Number.isSafeInteger(edition.unitPriceCents) && edition.unitPriceCents > 0) {
          unitPriceCents = edition.unitPriceCents;
        } else if (Number.isFinite(edition.multiplier) && edition.multiplier > 0) {
          unitPriceCents = Math.round(item.unitPriceCents * edition.multiplier);
        } else {
          throw new Error(`The simulated edition ${edition.id} has no valid price.`);
        }
        if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents <= 0) {
          throw new Error(`The simulated edition ${edition.id} price is invalid.`);
        }
        return { id: edition.id, name: edition.name, unitPriceCents };
      });
    }
    const audienceFormats = getAudienceBookFormats(item);
    if (audienceFormats) return audienceFormats;
    if (item.format === "Print book") {
      return [
        { id: "paperback", name: "Paperback", unitPriceCents: item.unitPriceCents },
        { id: "hardcover", name: "Hardcover", unitPriceCents: Math.round(item.unitPriceCents * 1.35) }
      ];
    }
    return [{
      id: slug(item.format),
      name: item.format,
      unitPriceCents: item.unitPriceCents
    }];
  }

  function getFormat(item, formatId) {
    const formats = getFormatOptions(item);
    const exact = formats.find(format => format.id === formatId);
    if (exact) return exact;
    if (formatId === "paperback") {
      return formats.find(format => format.id === "trade-paperback" ||
        format.id === "picture-book-paperback" || format.id === "paperback") || null;
    }
    if (formatId === slug(item.format) && item.format === "Picture book") {
      return formats.find(format => format.id === "picture-book-paperback") || null;
    }
    return null;
  }

  function extendedPrice(unitPriceCents, quantity) {
    if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0 ||
        !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error("Price and quantity must be valid whole-cent and whole-number values.");
    }
    const total = unitPriceCents * quantity;
    if (!Number.isSafeInteger(total)) throw new Error("The line total exceeds safe financial calculation limits.");
    return total;
  }

  function projectedRemainingBudget(allocationCents, committedCents, pendingCents) {
    if (![allocationCents, committedCents, pendingCents].every(value =>
      Number.isSafeInteger(value) && value >= 0
    )) throw new Error("Budget amounts must be nonnegative whole-cent values.");
    const remaining = allocationCents - committedCents - pendingCents;
    if (!Number.isSafeInteger(remaining)) throw new Error("The projected budget exceeds safe financial calculation limits.");
    return remaining;
  }

  function mergeLine(lines, item, formatId, quantity) {
    if (!Array.isArray(lines) || !item || !Number.isSafeInteger(item.maxQuantity) ||
        item.maxQuantity < 1 || !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error("A valid cart, catalog item, and positive whole-number quantity are required.");
    }
    const format = getFormat(item, formatId);
    if (!format) throw new Error("Choose an available format for this catalog item.");
    const nextLines = lines.map(line => ({ ...line }));
    const existing = nextLines.find(line =>
      line.catalogId === item.id && line.formatId === format.id
    );
    const itemQuantity = nextLines
      .filter(line => line.catalogId === item.id)
      .reduce((sum, line) => sum + line.quantity, 0);
    const nextQuantity = (existing?.quantity || 0) + quantity;
    if (!Number.isSafeInteger(itemQuantity + quantity) ||
        itemQuantity + quantity > item.maxQuantity ||
        (item.unique && itemQuantity + quantity > 1)) {
      throw new Error(`${item.title} (${format.name}) is limited to ${item.maxQuantity} ${item.maxQuantity === 1 ? "item" : "copies"}.`);
    }
    const extendedPriceCents = extendedPrice(format.unitPriceCents, nextQuantity);
    const line = {
      catalogId: item.id,
      title: item.title,
      formatId: format.id,
      format: format.name,
      quantity: nextQuantity,
      unitPriceCents: format.unitPriceCents,
      extendedPriceCents
    };
    if (existing) Object.assign(existing, line);
    else nextLines.push(line);
    return nextLines;
  }

  return {
    getFormatOptions,
    getFormat,
    extendedPrice,
    projectedRemainingBudget,
    mergeLine,
    getDigitalService,
    digitalServiceFeeCents,
    totalCommittedCents,
    payPerCirculationEstimate,
    getDigitalLicenseTerms
  };
}));
