/**
 * Add / edit company modal.
 *
 * One form serves both: `openCompanyForm()` with no id creates, with an id
 * edits. Saving returns to whichever view the form was opened from.
 */

let companyFormMode = "create";
let companyFormCompanyId = null;

// ── Field builders ───────────────────────────────────────────────────────────

function fillOwnerSelect() {
  const select = document.getElementById("companyFormOwner");
  if (!select) return;

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— Unassigned —";

  select.replaceChildren(blank, ...getAllOwners().map(owner => {
    const option = document.createElement("option");
    option.value = owner.id;
    option.textContent = owner.name;
    return option;
  }));
}

/** Payroll runs several schedules at once, so these are real checkboxes. */
function fillPayrollCheckboxes() {
  const row = document.getElementById("companyFormPayroll");
  if (!row) return;

  row.replaceChildren(...PAYROLL_SCHEDULES.map(schedule => {
    const label = document.createElement("label");
    label.className = "form-check";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = schedule;
    input.name = "payrollSchedule";

    const box = document.createElement("span");
    box.className = "form-check-box";
    box.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = schedule;

    label.append(input, box, text);
    return label;
  }));
}

function getSelectedPayrollSchedules() {
  return [...document.querySelectorAll('#companyFormPayroll input[name="payrollSchedule"]:checked')]
    .map(input => input.value);
}

/**
 * Single-choice settings render as a small button group rather than a select —
 * there are only two or three options and they read better laid out.
 * Clicking the active button clears it.
 */
function fillToggleButtons(containerId, options, ariaLabel) {
  const row = document.getElementById(containerId);
  if (!row) return;
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", ariaLabel);

  row.replaceChildren(...options.map(value => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "form-toggle-btn";
    btn.dataset.value = value;
    btn.textContent = value;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      const wasActive = btn.classList.contains("is-active");
      row.querySelectorAll(".form-toggle-btn").forEach(other => {
        other.classList.remove("is-active");
        other.setAttribute("aria-pressed", "false");
      });
      if (!wasActive) {
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
      }
    });
    return btn;
  }));
}

function setToggleButtonValue(containerId, value) {
  document.querySelectorAll(`#${containerId} .form-toggle-btn`).forEach(btn => {
    const active = btn.dataset.value === value;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function getToggleButtonValue(containerId) {
  return document.querySelector(`#${containerId} .form-toggle-btn.is-active`)?.dataset.value ?? "";
}

/** The services with no settings of their own — just on or off. */
const PLAIN_SERVICE_KEYS = SERVICE_KEYS.filter(key => key !== "payroll" && key !== "salesTax");

function fillServiceSwitches() {
  const grid = document.getElementById("companyFormServices");
  if (!grid) return;

  grid.replaceChildren(...PLAIN_SERVICE_KEYS.map(key => {
    const row = document.createElement("div");
    row.className = "form-service";
    row.dataset.service = key;

    const name = document.createElement("span");
    name.className = "form-service-name";
    name.textContent = getServiceLabel(key);

    const label = document.createElement("label");
    label.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "service";
    input.value = key;
    input.setAttribute("aria-label", getServiceLabel(key));
    const track = document.createElement("span");
    track.className = "switch-track";
    const thumb = document.createElement("span");
    thumb.className = "switch-thumb";
    label.append(input, track, thumb);

    input.addEventListener("change", () => row.classList.toggle("is-on", input.checked));

    row.append(name, label);
    return row;
  }));
}

function getSelectedServices() {
  const services = {};
  SERVICE_KEYS.forEach(key => { services[key] = false; });
  document.querySelectorAll('#companyForm input[name="service"]:checked')
    .forEach(input => { services[input.value] = true; });
  return services;
}

/**
 * A service's settings are meaningless when the client hasn't bought it, so
 * switching the service off disables everything nested under it. The values
 * are kept, so switching it back on restores what was there.
 */
function syncServiceBlockState(serviceKey) {
  const block = document.querySelector(`.service-block[data-service="${serviceKey}"]`);
  const toggle = document.querySelector(`#companyForm input[name="service"][value="${serviceKey}"]`);
  const body = document.querySelector(`.service-block-body[data-body-for="${serviceKey}"]`);
  if (!block || !toggle || !body) return;

  const on = toggle.checked;
  block.classList.toggle("is-on", on);
  body.classList.toggle("is-disabled", !on);
  body.querySelectorAll("input, button").forEach(el => { el.disabled = !on; });
}

function syncAllServiceBlockStates() {
  ["payroll", "salesTax"].forEach(syncServiceBlockState);
}

// ── Open / close ─────────────────────────────────────────────────────────────

function setCompanyFormMessage(text, type = "") {
  const el = document.getElementById("companyFormMessage");
  if (!el) return;
  el.textContent = text;
  el.className = "modal-footer-message" + (type ? ` ${type}` : "");
}

function clearCompanyFormErrors() {
  document.getElementById("companyFormName")?.classList.remove("is-invalid");
  const err = document.getElementById("companyFormNameError");
  if (err) err.hidden = true;
  setCompanyFormMessage("");
}

/** Pass a companyId to edit; omit it to create. */
function openCompanyForm(companyId = null) {
  const overlay = document.getElementById("companyFormOverlay");
  if (!overlay) return;

  const company = companyId ? getCompanyById(companyId) : null;
  companyFormMode = company ? "edit" : "create";
  companyFormCompanyId = company?.id ?? null;

  fillOwnerSelect();
  fillPayrollCheckboxes();
  fillServiceSwitches();
  fillToggleButtons("companyFormPayrollTax", PAYROLL_TAX_SCHEDULES, "Payroll tax deposit schedule");
  fillToggleButtons("companyFormSalesTax", SALES_TAX_SCHEDULES, "Sales tax filing schedule");

  const title = document.getElementById("companyFormTitle");
  if (title) title.textContent = company ? "Edit company details" : "Add company";

  const nameInput = document.getElementById("companyFormName");
  if (nameInput) nameInput.value = company?.name ?? "";
  const locationInput = document.getElementById("companyFormLocation");
  if (locationInput) locationInput.value = company?.location ?? "";
  const ownerSelect = document.getElementById("companyFormOwner");
  if (ownerSelect) ownerSelect.value = company?.ownerId ?? "";

  setToggleButtonValue("companyFormPayrollTax", company?.payrollTax ?? "");
  setToggleButtonValue("companyFormSalesTax", company?.salesTax ?? "");

  const selected = new Set(company?.payrollSchedules ?? []);
  document.querySelectorAll('#companyFormPayroll input[name="payrollSchedule"]').forEach(input => {
    input.checked = selected.has(input.value);
  });

  // New companies start with every service on — the common case is a client
  // buying the full package, and unticking is quicker than ticking five.
  document.querySelectorAll('#companyForm input[name="service"]').forEach(input => {
    input.checked = company ? company.services[input.value] === true : true;
    input.closest(".form-service")?.classList.toggle("is-on", input.checked);
  });
  syncAllServiceBlockStates();

  clearCompanyFormErrors();
  overlay.classList.add("open");
  requestAnimationFrame(() => nameInput?.focus());
}

function closeCompanyForm() {
  document.getElementById("companyFormOverlay")?.classList.remove("open");
  companyFormCompanyId = null;
}

function isCompanyFormOpen() {
  return document.getElementById("companyFormOverlay")?.classList.contains("open") === true;
}

// ── Save ─────────────────────────────────────────────────────────────────────

async function saveCompanyForm() {
  const nameInput = document.getElementById("companyFormName");
  const name = (nameInput?.value ?? "").trim();

  if (!name) {
    nameInput?.classList.add("is-invalid");
    const err = document.getElementById("companyFormNameError");
    if (err) err.hidden = false;
    nameInput?.focus();
    return;
  }

  const fields = {
    name,
    ownerId: document.getElementById("companyFormOwner")?.value ?? "",
    location: (document.getElementById("companyFormLocation")?.value ?? "").trim(),
    payrollSchedules: getSelectedPayrollSchedules(),
    payrollTax: getToggleButtonValue("companyFormPayrollTax"),
    salesTax: getToggleButtonValue("companyFormSalesTax"),
    services: getSelectedServices(),
  };

  const saveBtn = document.getElementById("companyFormSaveBtn");
  if (saveBtn) saveBtn.disabled = true;
  setCompanyFormMessage("Saving…");

  try {
    if (companyFormMode === "edit") {
      const updated = await updateCompany(companyFormCompanyId, fields);
      closeCompanyForm();
      applyCompanyFilters();
      // Refresh the detail page in place so the edit is visible immediately.
      if (getCurrentAppView() === "company") openCompanyDetail(updated.id);
      showIndicator("Company updated", "success");
    } else {
      const created = await createCompany(fields);
      closeCompanyForm();
      applyCompanyFilters();
      showIndicator(`${created.name} added`, "success");
      openCompanyDetail(created.id);
    }
  } catch (err) {
    setCompanyFormMessage(err.message || "Could not save.", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ── Detail-page menu ─────────────────────────────────────────────────────────

function closeCompanyDetailMenu() {
  const menu = document.getElementById("companyDetailMenu");
  const btn = document.getElementById("companyDetailMenuBtn");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function initCompanyDetailMenu() {
  const btn = document.getElementById("companyDetailMenuBtn");
  const menu = document.getElementById("companyDetailMenu");
  if (!btn || !menu) return;

  btn.addEventListener("click", e => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("click", e => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    closeCompanyDetailMenu();
  });

  document.getElementById("companyMenuEdit")?.addEventListener("click", () => {
    closeCompanyDetailMenu();
    if (currentCompanyId) openCompanyForm(currentCompanyId);
  });

  document.getElementById("companyMenuDelete")?.addEventListener("click", async () => {
    closeCompanyDetailMenu();
    const company = getCompanyById(currentCompanyId);
    if (!company) return;
    if (!confirm(`Delete ${company.name}? This cannot be undone.`)) return;
    try {
      await deleteCompany(company.id);
      closeCompanyDetail();
      applyCompanyFilters();
      showIndicator(`${company.name} deleted`, "success");
    } catch (err) {
      showIndicator(err.message || "Could not delete company.", "error");
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

function initCompanyForm() {
  initCompanyDetailMenu();

  document.getElementById("addCompanyBtn")?.addEventListener("click", () => openCompanyForm());
  document.getElementById("companyFormSaveBtn")?.addEventListener("click", saveCompanyForm);
  document.getElementById("companyFormCancelBtn")?.addEventListener("click", closeCompanyForm);
  document.getElementById("companyFormCloseBtn")?.addEventListener("click", closeCompanyForm);

  document.getElementById("companyFormName")?.addEventListener("input", clearCompanyFormErrors);

  // Turning a service off greys out everything nested under it.
  document.querySelectorAll('.service-block input[name="service"]').forEach(toggle => {
    toggle.addEventListener("change", () => syncServiceBlockState(toggle.value));
  });

  // Enter submits from any single-line input; the form has no submit button.
  // Buttons and checkboxes keep their own Enter/Space behaviour.
  document.getElementById("companyForm")?.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
    if (e.target.type === "checkbox") return;
    e.preventDefault();
    saveCompanyForm();
  });

  const overlay = document.getElementById("companyFormOverlay");
  overlay?.addEventListener("click", e => {
    if (e.target === overlay) closeCompanyForm();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && isCompanyFormOpen()) closeCompanyForm();
  });
}
