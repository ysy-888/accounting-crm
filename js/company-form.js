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

function fillScheduleSelect(selectId, options, blankLabel) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = blankLabel;

  select.replaceChildren(blank, ...options.map(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    return option;
  }));
}

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

    const dot = document.createElement("span");
    dot.className = "form-check-dot";
    dot.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = schedule;

    label.append(input, dot, text);
    return label;
  }));
}

function getSelectedPayrollSchedules() {
  return [...document.querySelectorAll('#companyFormPayroll input[name="payrollSchedule"]:checked')]
    .map(input => input.value);
}

/**
 * Service switches. These live here rather than on the company page so the
 * page itself only shows what the client actually buys.
 */
function fillServiceSwitches() {
  const grid = document.getElementById("companyFormServices");
  if (!grid) return;

  grid.replaceChildren(...SERVICES.map(service => {
    const row = document.createElement("div");
    row.className = "form-service";
    row.dataset.service = service.key;

    const text = document.createElement("div");
    text.className = "form-service-text";
    const name = document.createElement("span");
    name.className = "form-service-name";
    name.textContent = service.label;
    const hint = document.createElement("span");
    hint.className = "form-service-hint";
    hint.textContent = service.hint;
    text.append(name, hint);

    const label = document.createElement("label");
    label.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "service";
    input.value = service.key;
    input.setAttribute("aria-label", service.label);
    const track = document.createElement("span");
    track.className = "switch-track";
    const thumb = document.createElement("span");
    thumb.className = "switch-thumb";
    label.append(input, track, thumb);

    input.addEventListener("change", () => row.classList.toggle("is-on", input.checked));

    row.append(text, label);
    return row;
  }));
}

function getSelectedServices() {
  const services = {};
  SERVICE_KEYS.forEach(key => { services[key] = false; });
  document.querySelectorAll('#companyFormServices input[name="service"]:checked')
    .forEach(input => { services[input.value] = true; });
  return services;
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
  fillScheduleSelect("companyFormPayrollTax", PAYROLL_TAX_SCHEDULES, "— None —");
  fillScheduleSelect("companyFormSalesTax", SALES_TAX_SCHEDULES, "— None —");

  const title = document.getElementById("companyFormTitle");
  if (title) title.textContent = company ? "Edit company details" : "Add company";

  const nameInput = document.getElementById("companyFormName");
  if (nameInput) nameInput.value = company?.name ?? "";
  const locationInput = document.getElementById("companyFormLocation");
  if (locationInput) locationInput.value = company?.location ?? "";
  const ownerSelect = document.getElementById("companyFormOwner");
  if (ownerSelect) ownerSelect.value = company?.ownerId ?? "";
  const payrollTaxSelect = document.getElementById("companyFormPayrollTax");
  if (payrollTaxSelect) payrollTaxSelect.value = company?.payrollTax ?? "";
  const salesTaxSelect = document.getElementById("companyFormSalesTax");
  if (salesTaxSelect) salesTaxSelect.value = company?.salesTax ?? "";

  const selected = new Set(company?.payrollSchedules ?? []);
  document.querySelectorAll('#companyFormPayroll input[name="payrollSchedule"]').forEach(input => {
    input.checked = selected.has(input.value);
  });

  // New companies start with every service on — the common case is a client
  // buying the full package, and unticking is quicker than ticking five.
  document.querySelectorAll('#companyFormServices input[name="service"]').forEach(input => {
    input.checked = company ? company.services[input.value] === true : true;
    input.closest(".form-service")?.classList.toggle("is-on", input.checked);
  });

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
    payrollTax: document.getElementById("companyFormPayrollTax")?.value ?? "",
    salesTax: document.getElementById("companyFormSalesTax")?.value ?? "",
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

  // Enter submits from any single-line input; the form has no submit button.
  document.getElementById("companyForm")?.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.tagName === "TEXTAREA") return;
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
