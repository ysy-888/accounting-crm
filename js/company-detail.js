/**
 * Company detail — a full-page view, not a modal.
 *
 * Shows the company's list-table fields, a switch per service so you can set
 * what the client is signed up for, and a tab strip over the enabled sections.
 * Section bodies are placeholders for now; each one gets built out in turn.
 */

let currentCompanyId = null;
let currentSectionKey = null;

/** Fields mirrored from the Companies table, in table order. */
function getCompanyInfoFields(company) {
  return [
    { label: "Company Name", value: company.name },
    { label: "Owner", value: getCompanyOwnerName(company) },
    { label: "Location", value: company.location },
    { label: "Payroll", value: (company.payrollSchedules ?? []).join(", ") },
    { label: "Payroll Tax", value: company.payrollTax },
    { label: "Sales Tax", value: company.salesTax },
  ];
}

function renderCompanyInfoGrid(company) {
  const grid = document.getElementById("companyInfoGrid");
  if (!grid) return;

  grid.replaceChildren(...getCompanyInfoFields(company).map(field => {
    const cell = document.createElement("div");
    cell.className = "company-info-field";

    const label = document.createElement("span");
    label.className = "company-info-label";
    label.textContent = field.label;

    const value = document.createElement("div");
    const empty = isEmptyValue(field.value);
    value.className = "company-info-value" + (empty ? " is-empty" : "");
    value.textContent = empty ? EMPTY_DISPLAY : field.value;

    cell.append(label, value);
    return cell;
  }));
}

// ── Service toggles ──────────────────────────────────────────────────────────

function createServiceCard(company, service) {
  const card = document.createElement("div");
  card.className = "service-card" + (company.services[service.key] ? " is-on" : "");
  card.dataset.service = service.key;

  const text = document.createElement("div");
  text.className = "service-card-text";

  const name = document.createElement("span");
  name.className = "service-card-name";
  name.textContent = service.label;

  const hint = document.createElement("span");
  hint.className = "service-card-hint";
  hint.textContent = service.hint;

  text.append(name, hint);

  const label = document.createElement("label");
  label.className = "switch";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = company.services[service.key] === true;
  input.setAttribute("aria-label", `${service.label} service for ${company.name}`);

  const track = document.createElement("span");
  track.className = "switch-track";
  const thumb = document.createElement("span");
  thumb.className = "switch-thumb";

  input.addEventListener("change", async () => {
    const enabled = input.checked;
    card.classList.toggle("is-on", enabled);
    try {
      await setCompanyService(company.id, service.key, enabled);
      renderCompanySectionTabs(company);
      renderCompaniesTable();
      showIndicator(`${service.label} ${enabled ? "enabled" : "disabled"}`, "success");
    } catch (err) {
      // Roll the switch back so the UI matches what was actually stored.
      input.checked = !enabled;
      card.classList.toggle("is-on", !enabled);
      showIndicator(err.message || "Could not save service.", "error");
    }
  });

  label.append(input, track, thumb);
  card.append(text, label);
  return card;
}

function renderCompanyServices(company) {
  const grid = document.getElementById("companyServicesGrid");
  if (!grid) return;
  grid.replaceChildren(...SERVICES.map(service => createServiceCard(company, service)));
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

  const wrap = document.createElement("div");
  wrap.className = "company-section-empty";

  const title = document.createElement("div");
  title.className = "company-section-empty-title";

  const text = document.createElement("div");
  text.className = "company-section-empty-text";

  if (!service) {
    title.textContent = "No services enabled";
    text.textContent = `Turn on a service above to start tracking work for ${company.name}.`;
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

  renderCompanyInfoGrid(company);
  renderCompanyServices(company);
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
