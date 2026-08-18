/**
 * Company detail — a full-page view, not a modal.
 *
 * Shows the company's list-table fields, a switch per service so you can set
 * what the client is signed up for, and a tab strip over the enabled sections.
 * Section bodies are placeholders for now; each one gets built out in turn.
 */

let currentCompanyId = null;
let currentSectionKey = null;

/**
 * The schedule columns from the Companies table, as the same coloured pills,
 * in the header card. Name / owner / location are already the title and
 * subtitle, so they aren't repeated.
 */
function renderCompanyHeaderPills(company) {
  const wrap = document.getElementById("companyDetailPills");
  if (!wrap) return;

  // Same rule as the table: a schedule only shows when its service is on.
  const groups = ["Payroll", "Payroll Tax", "Sales Tax"]
    .map(label => ({ label, values: getCompanyColumnValues(company, label) }))
    .filter(group => group.values.length > 0);

  if (groups.length === 0) {
    wrap.replaceChildren();
    return;
  }

  wrap.replaceChildren(...groups.map(group => {
    const item = document.createElement("div");
    item.className = "company-pill-group";

    const label = document.createElement("span");
    label.className = "company-pill-label";
    // The same value can appear under two headings (Monthly payroll vs
    // monthly deposits), so each cluster is labelled.
    label.textContent = group.label;
    item.appendChild(label);

    group.values.forEach(value => {
      const pill = document.createElement("span");
      pill.className = "schedule-pill";
      pill.dataset.schedule = value;
      pill.textContent = value;
      item.appendChild(pill);
    });

    return item;
  }));
}

// ── Section tabs ─────────────────────────────────────────────────────────────

function getEnabledServices(company) {
  return SERVICES.filter(service => company.services[service.key]);
}

function renderCompanySectionTabs(company) {
  const tabs = document.getElementById("companySectionTabs");
  if (!tabs) return;

  const enabled = getEnabledServices(company);
  tabs.hidden = enabled.length === 0;

  // The previously selected section may have just been switched off.
  if (!enabled.some(s => s.key === currentSectionKey)) {
    currentSectionKey = enabled[0]?.key ?? null;
  }

  tabs.replaceChildren(...enabled.map(service => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "company-section-tab" + (service.key === currentSectionKey ? " is-active" : "");
    btn.dataset.section = service.key;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", service.key === currentSectionKey ? "true" : "false");
    btn.textContent = service.label;
    btn.addEventListener("click", () => {
      currentSectionKey = service.key;
      renderCompanySectionTabs(company);
    });
    return btn;
  }));

  renderCompanySectionPanel(company);
}

function renderCompanySectionPanel(company) {
  const panel = document.getElementById("companySectionPanel");
  if (!panel) return;

  const service = currentSectionKey ? getServiceMeta(currentSectionKey) : null;

  // Payroll is built; the rest still show the placeholder.
  if (service?.key === "payroll" && typeof renderPayrollSection === "function") {
    renderPayrollSection(company);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "company-section-empty";

  const title = document.createElement("div");
  title.className = "company-section-empty-title";

  const text = document.createElement("div");
  text.className = "company-section-empty-text";

  if (!service) {
    title.textContent = "No services enabled";
    text.textContent = `Open the menu above and pick this client's services to start tracking work for ${company.name}.`;
  } else {
    title.textContent = service.label;
    text.textContent = `${service.hint} This section is next up to be built out.`;
  }

  wrap.append(title, text);
  panel.replaceChildren(wrap);
}

// ── Open / close ─────────────────────────────────────────────────────────────

function openCompanyDetail(companyId) {
  const company = getCompanyById(companyId);
  if (!company) return;

  currentCompanyId = company.id;
  currentSectionKey = null;

  const title = document.getElementById("companyDetailTitle");
  if (title) title.textContent = company.name;

  const subtitle = document.getElementById("companyDetailSubtitle");
  if (subtitle) {
    subtitle.replaceChildren();
    const parts = [getCompanyOwnerName(company), company.location].filter(Boolean);
    parts.forEach((part, i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "•";
        subtitle.appendChild(sep);
      }
      subtitle.appendChild(document.createTextNode(part));
    });
  }

  renderCompanyHeaderPills(company);
  renderCompanySectionTabs(company);

  switchAppView("company");
  document.getElementById("companyDetailView")?.scrollTo({ top: 0 });
}

function closeCompanyDetail() {
  currentCompanyId = null;
  currentSectionKey = null;
  switchAppView("companies");
}

function initCompanyDetail() {
  document.getElementById("companyDetailBackBtn")?.addEventListener("click", closeCompanyDetail);

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (getCurrentAppView() !== "company") return;
    // Let an open popover or modal take Escape first.
    if (!document.getElementById("columnFilterPopover")?.hidden) return;
    if (typeof isCompanyFormOpen === "function" && isCompanyFormOpen()) return;
    closeCompanyDetail();
  });
}
