(function () {
  "use strict";

  const STORAGE_KEY = "pn-foundation-session";
  const PAGE_IDS = {
    dashboard: "dashboard-page",
    catalog: "catalog-page",
    "order-worksheet": "order-worksheet-page",
    "technical-services": "technical-services-page"
  };
  const categorySelect = document.getElementById("category");
  const loginPanel = document.getElementById("login-panel");
  const setupPanel = document.getElementById("setup-panel");
  const application = document.getElementById("application");
  const notice = document.getElementById("notice");
  const setupForm = document.getElementById("institution-form");
  const departmentField = document.getElementById("department-field");
  const departmentInput = document.getElementById("department");
  const budgetPreview = document.getElementById("budget-preview");
  let session = null;
  let revisingProfile = false;

  function showNotice(message, isError) {
    notice.textContent = message;
    notice.dataset.error = String(Boolean(isError));
    notice.hidden = !message;
  }

  function getInstitution(categoryId) {
    return window.PN_INSTITUTIONS.find(institution => institution.id === categoryId);
  }

  function formatBudget(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(amount);
  }

  function isValidSession(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      typeof value.clientId === "string" &&
      value.clientId.trim() &&
      Array.isArray(value.cart) &&
      Array.isArray(value.orders) &&
      typeof value.setupComplete === "boolean"
    );
  }

  function loadSession() {
    let stored;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === null) return null;
      const parsed = JSON.parse(stored);
      if (!isValidSession(parsed)) {
        throw new Error("The saved session is not a valid PN-001 session. Log out or clear this site's saved data to continue.");
      }
      return parsed;
    } catch (error) {
      showNotice(error.message || "The saved session could not be read from this browser.", true);
      return null;
    }
  }

  function persist(nextSession) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    session = nextSession;
    window.dispatchEvent(new CustomEvent("pn:session-change"));
    return session;
  }

  function updateSession(updates) {
    if (!session) throw new Error("There is no active session to update.");
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      throw new Error("Session updates must be provided as an object.");
    }
    const nextSession = { ...session, ...updates };
    if (!Array.isArray(nextSession.cart) || !Array.isArray(nextSession.orders)) {
      throw new Error("Session cart and orders must remain arrays.");
    }
    return persist(nextSession);
  }

  function refreshDashboard() {
    if (!session || !session.setupComplete) return false;
    const institution = getInstitution(session.categoryId);
    if (!institution) {
      showNotice("The saved institution category is unavailable. Revise your profile to continue.", true);
      return false;
    }

    document.getElementById("profile-name").textContent = session.institutionName;
    document.getElementById("profile-category").textContent = institution.name;
    document.getElementById("profile-audience").textContent = session.audience;
    document.getElementById("profile-priorities").textContent = session.priorities;
    document.getElementById("profile-budget").textContent = formatBudget(institution.annualBudget);
    document.getElementById("signed-in-client").textContent = `Client ID: ${session.clientId}`;

    const departmentSummary = document.getElementById("department-summary");
    departmentSummary.hidden = !institution.requiresDepartment;
    document.getElementById("profile-department").textContent = session.department || "";
    window.PN_ACQUISITIONS?.refreshBudget();
    return true;
  }

  function navigate(page) {
    if (!Object.hasOwn(PAGE_IDS, page)) {
      throw new Error(`Unknown page: ${page}`);
    }
    if (!session || !session.setupComplete) return false;
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

  function showSetup(profile) {
    loginPanel.hidden = true;
    application.hidden = true;
    setupPanel.hidden = false;
    revisingProfile = Boolean(profile);
    document.getElementById("cancel-revision").hidden = !revisingProfile;
    document.getElementById("setup-heading").textContent = revisingProfile
      ? "Revise your collecting profile"
      : "Build your collecting profile";
    document.getElementById("institution-name").value = profile?.institutionName || "";
    document.getElementById("audience").value = profile?.audience || "";
    categorySelect.value = profile?.categoryId || "";
    departmentInput.value = profile?.department || "";
    document.getElementById("priorities").value = profile?.priorities || "";
    updateCategoryDetails();
  }

  function showApplication(page) {
    loginPanel.hidden = true;
    setupPanel.hidden = true;
    application.hidden = false;
    if (!refreshDashboard()) return;
    navigate(PAGE_IDS[page] ? page : "dashboard");
  }

  function updateCategoryDetails() {
    const institution = getInstitution(categorySelect.value);
    departmentField.hidden = !institution?.requiresDepartment;
    departmentInput.required = Boolean(institution?.requiresDepartment);
    if (!institution?.requiresDepartment) departmentInput.value = "";
    budgetPreview.hidden = !institution;
    document.getElementById("budget-amount").textContent = institution
      ? formatBudget(institution.annualBudget)
      : "";
  }

  function reportError(error) {
    showNotice(error.message || "The requested action could not be completed.", true);
  }

  for (const institution of window.PN_INSTITUTIONS) {
    const option = document.createElement("option");
    option.value = institution.id;
    option.textContent = institution.name;
    categorySelect.append(option);
  }

  document.getElementById("login-form").addEventListener("submit", event => {
    event.preventDefault();
    const clientId = document.getElementById("client-id").value.trim();
    const password = document.getElementById("password").value;
    if (!clientId) {
      showNotice("Enter a nonempty client ID.", true);
      return;
    }
    if (password !== "collections") {
      showNotice("That password is not correct. Use the PN-001 simulation password.", true);
      return;
    }
    try {
      persist({ clientId, setupComplete: false, cart: [], orders: [] });
      showNotice("", false);
      showSetup(null);
    } catch (error) {
      reportError(error);
    }
  });

  categorySelect.addEventListener("change", updateCategoryDetails);

  setupForm.addEventListener("submit", event => {
    event.preventDefault();
    const formData = new FormData(setupForm);
    const categoryId = String(formData.get("categoryId") || "");
    const institution = getInstitution(categoryId);
    const department = String(formData.get("department") || "").trim();
    if (!institution) {
      showNotice("Choose one of the listed institution categories.", true);
      return;
    }
    if (institution.requiresDepartment && !department) {
      showNotice("Enter a department for this institution category.", true);
      departmentInput.focus();
      return;
    }
    const profile = {
      institutionName: String(formData.get("institutionName") || "").trim(),
      audience: String(formData.get("audience") || "").trim(),
      categoryId,
      department: institution.requiresDepartment ? department : "",
      priorities: String(formData.get("priorities") || "").trim(),
      annualBudget: institution.annualBudget,
      setupComplete: true,
      currentPage: "dashboard"
    };
    if (!profile.institutionName || !profile.audience || !profile.priorities) {
      showNotice("Complete the institution name, audience, and collecting priorities.", true);
      return;
    }
    try {
      updateSession(profile);
      showNotice("Your institutional profile has been saved.", false);
      showApplication("dashboard");
    } catch (error) {
      reportError(error);
    }
  });

  document.getElementById("cancel-revision").addEventListener("click", () => {
    showNotice("", false);
    showApplication(session.currentPage || "dashboard");
  });

  document.getElementById("revise-profile").addEventListener("click", () => {
    showNotice("", false);
    showSetup(session);
  });

  document.getElementById("logout").addEventListener("click", () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      session = null;
      window.dispatchEvent(new CustomEvent("pn:session-change"));
      document.getElementById("login-form").reset();
      setupForm.reset();
      application.hidden = true;
      setupPanel.hidden = true;
      loginPanel.hidden = false;
      showNotice("You have been logged out.", false);
      document.getElementById("client-id").focus();
    } catch (error) {
      reportError(error);
    }
  });

  for (const button of document.querySelectorAll("[data-page]")) {
    button.addEventListener("click", () => {
      try {
        if (navigate(button.dataset.page)) showNotice("", false);
      } catch (error) {
        reportError(error);
      }
    });
  }

  session = loadSession();
  if (session?.setupComplete) {
    showApplication(session.currentPage || "dashboard");
  } else if (session) {
    showSetup(session);
  }

  window.PN_APP = Object.freeze({
    getSession: () => session ? JSON.parse(JSON.stringify(session)) : null,
    updateSession,
    refreshDashboard,
    navigate
  });
}());
