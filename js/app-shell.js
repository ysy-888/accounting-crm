/**
 * View switching and the header menu.
 *
 * Views: "companies" (list) → "company" (full-page detail) → back.
 * The detail page is a real view swap, not a modal, so the whole frame
 * (toolbar, footer pagination) hides with it.
 */

const APP_VIEWS = ["companies", "company", "calendar", "owners"];

let currentAppView = "companies";

function getCurrentAppView() {
  return currentAppView;
}

function isCompaniesViewActive() {
  return currentAppView === "companies";
}

function switchAppView(view) {
  if (!APP_VIEWS.includes(view)) return;
  currentAppView = view;

  const panes = {
    companiesToolbar: view === "companies",
    companiesTableWrap: view === "companies",
    companyDetailView: view === "company",
    calendarWrap: view === "calendar",
    ownersView: view === "owners",
    // Pagination belongs to the list only.
    appFooterEnd: view === "companies",
  };
  Object.entries(panes).forEach(([id, visible]) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !visible;
  });

  // The Companies tab stays selected while a company detail page is open —
  // the detail is a drill-down within that section.
  const tabs = {
    navTabCompanies: view === "companies" || view === "company",
    navTabCalendar: view === "calendar",
    navTabOwners: view === "owners",
  };
  Object.entries(tabs).forEach(([id, active]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-selected", active ? "true" : "false");
  });

  if (view === "companies" && typeof updateCompaniesPaginationUI === "function") {
    updateCompaniesPaginationUI();
  }
  // The grid needs real layout to size its rows, so render on entry.
  if (view === "calendar" && typeof renderCalendar === "function") renderCalendar();
}

// ── Header menu ──────────────────────────────────────────────────────────────

function closeHeaderMenu() {
  const dropdown = document.getElementById("headerMenuDropdown");
  const btn = document.getElementById("headerMenuBtn");
  if (dropdown) dropdown.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function initHeaderMenu() {
  const btn = document.getElementById("headerMenuBtn");
  const dropdown = document.getElementById("headerMenuDropdown");
  if (!btn || !dropdown) return;

  btn.addEventListener("click", e => {
    e.stopPropagation();
    const open = dropdown.hidden;
    dropdown.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("click", e => {
    if (dropdown.hidden) return;
    if (dropdown.contains(e.target) || btn.contains(e.target)) return;
    closeHeaderMenu();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeHeaderMenu();
  });

  document.getElementById("headerMenuExportCsv")?.addEventListener("click", () => {
    closeHeaderMenu();
    exportCompaniesCsv();
  });

  document.getElementById("headerMenuResetData")?.addEventListener("click", async () => {
    closeHeaderMenu();
    if (!confirm("Reset all local data back to the seeded demo companies?")) return;
    setAppLoading(true, "Resetting…");
    await resetDemoData();
    applyCompanyFilters();
    switchAppView("companies");
    setAppLoading(false);
    showIndicator("Demo data reset", "success");
  });
}

// ── CSV export ───────────────────────────────────────────────────────────────

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export whatever the current filters/search have narrowed the list to. */
function exportCompaniesCsv() {
  const rows = typeof filteredCompanies !== "undefined" ? filteredCompanies : getAllCompanies();
  if (!rows.length) {
    showIndicator("Nothing to export", "error");
    return;
  }

  const header = [
    "Company Name", "Owner", "Location", "Payroll", "Payroll Tax", "Sales Tax",
    ...SERVICES.map(s => s.label),
  ];
  const lines = [header.map(csvCell).join(",")];

  rows.forEach(company => {
    lines.push([
      company.name,
      getCompanyOwnerName(company),
      company.location,
      company.payroll,
      company.payrollTax,
      company.salesTax,
      ...SERVICE_KEYS.map(key => (company.services[key] ? "Yes" : "No")),
    ].map(csvCell).join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `companies-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showIndicator(`Exported ${rows.length} companies`, "success");
}

// ── Nav ──────────────────────────────────────────────────────────────────────

function initAppNav() {
  document.getElementById("navTabCompanies")?.addEventListener("click", () => switchAppView("companies"));
  document.getElementById("navTabCalendar")?.addEventListener("click", () => switchAppView("calendar"));
  document.getElementById("navTabOwners")?.addEventListener("click", () => switchAppView("owners"));
  document.getElementById("navLogoDashboard")?.addEventListener("click", () => switchAppView("companies"));

  document.getElementById("refreshBtn")?.addEventListener("click", async () => {
    setAppLoading(true, "Refreshing…");
    await loadAppData();
    applyCompanyFilters();
    setAppLoading(false);
    showIndicator("Refreshed", "success");
  });

  document.getElementById("saveIndicatorDismiss")?.addEventListener("click", clearIndicator);
}
