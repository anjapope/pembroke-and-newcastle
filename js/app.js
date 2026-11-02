(function () {
  "use strict";

  const STORAGE_KEY = "pn-foundation-session";
  const PAGE_IDS = {
    dashboard: "dashboard-page",
    catalog: "catalog-page",
    vendors: "vendors-page",
    "order-worksheet": "order-worksheet-page",
    "technical-services": "technical-services-page",
    "digital-services": "digital-services-page"
  };
  const application = document.getElementById("application");
  const notice = document.getElementById("notice");
  let session = null;

  function showNotice(message, isError = false) {
    notice.textContent = message;
    notice.dataset.error = String(Boolean(isError));
    notice.hidden = !message;
  }

  function getInstitution(categoryId) {
    return window.PN_INSTITUTIONS.find(institution => institution.id === categoryId);
  }

  function defaultSession(previous = {}) {
    const categoryId = getInstitution(previous.categoryId) ? previous.categoryId : "public-library";
    return {
      ...previous,
      clientId: previous.clientId || "ANONYMOUS",
      institutionName: previous.institutionName || "Independent Acquisitions Account",
      categoryId,
      department: previous.department || (getInstitution(categoryId)?.requiresDepartment ? "Collections" : ""),
      audience: typeof previous.audience === "string" ? previous.audience : "",
      priorities: typeof previous.priorities === "string" ? previous.priorities : "",
      setupComplete: true,
      cart: Array.isArray(previous.cart) ? previous.cart : [],
      orders: Array.isArray(previous.orders) ? previous.orders : [],
      digitalServiceModelId: typeof previous.digitalServiceModelId === "string"
        ? previous.digitalServiceModelId
        : "",
      digitalServiceEnrollment: previous.digitalServiceEnrollment ?? null,
      payPerCirculationUsage: Number.isSafeInteger(previous.payPerCirculationUsage) &&
        previous.payPerCirculationUsage >= 0 &&
        previous.payPerCirculationUsage <= 1000000
        ? previous.payPerCirculationUsage
        : 0,
      currentPage: "catalog",
      activeRequisitionId: previous.activeRequisitionId ?? null
    };
  }

  function loadSession() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === null) return defaultSession();
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
          !Array.isArray(parsed.cart) || !Array.isArray(parsed.orders)) {
        throw new Error("Saved acquisition data is malformed. A clean anonymous session has been started.");
      }
      return defaultSession(parsed);
    } catch (error) {
      showNotice(error.message || "Saved acquisition data could not be read; a clean anonymous session has been started.", true);
      return defaultSession();
    }
  }

  function persist(nextSession) {
    const serialized = JSON.stringify(nextSession);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    session = JSON.parse(serialized);
    window.dispatchEvent(new CustomEvent("pn:session-change"));
    return session;
  }

  function updateSession(updates) {
    if (!session) throw new Error("There is no active acquisition session.");
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      throw new Error("Session updates must be provided as an object.");
    }
    const nextSession = { ...session, ...updates };
    if (!Array.isArray(nextSession.cart) || !Array.isArray(nextSession.orders)) {
      throw new Error("Session cart and requisitions must remain arrays.");
    }
    return persist(nextSession);
  }

  function refreshDashboard() {
    if (!session) return false;
    if (!getInstitution(session.categoryId)) {
      showNotice("The active budget allocation is unavailable.", true);
      return false;
    }
    document.getElementById("active-library").textContent = session.institutionName;
    window.PN_ACQUISITIONS?.refreshBudget();
    return true;
  }

  function navigate(page) {
    if (!Object.hasOwn(PAGE_IDS, page)) throw new Error(`Unknown page: ${page}`);
    updateSession({ currentPage: page });
    for (const [pageName, elementId] of Object.entries(PAGE_IDS)) {
      document.getElementById(elementId).hidden = pageName !== page;
    }
    for (const button of document.querySelectorAll("[data-page]")) {
      const selected = button.dataset.page === page;
      button.classList.toggle("is-current", selected);
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    window.dispatchEvent(new CustomEvent("pn:navigate", { detail: { page } }));
    return true;
  }

  document.getElementById("reset-simulation").addEventListener("click", () => {
    if (!window.confirm("Clear this browser's selections, requisitions, and review history? This cannot be undone.")) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      session = defaultSession();
      persist(session);
      document.getElementById("notice").hidden = true;
      document.getElementById("acq-notice").hidden = true;
      refreshDashboard();
      navigate("catalog");
    } catch (error) {
      showNotice(error.message || "The acquisition session could not be reset.", true);
    }
  });

  for (const button of document.querySelectorAll("[data-page]")) {
    button.addEventListener("click", () => {
      try {
        navigate(button.dataset.page);
      } catch (error) {
        showNotice(error.message || "The requested view could not be opened.", true);
      }
    });
  }

  session = loadSession();
  application.hidden = false;
  try {
    persist(session);
    refreshDashboard();
    navigate(session.currentPage || "catalog");
  } catch (error) {
    showNotice(error.message || "The acquisitions portal could not be initialized.", true);
  }

  window.PN_APP = Object.freeze({
    getSession: () => session ? JSON.parse(JSON.stringify(session)) : null,
    updateSession,
    refreshDashboard,
    navigate
  });
}());
