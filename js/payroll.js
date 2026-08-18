/**
 * Payroll section on the company detail page.
 *
 * Group-first: one card per schedule (Monthly / Semi-Monthly / Bi-Weekly).
 * Enable the ones the company runs, add employees under each, and the pay
 * calendar config — the bi-weekly anchor — lives on the group, because a
 * company runs one bi-weekly cycle that everyone on it shares.
 *
 * Below the groups, the upcoming runs list shows each pay date with its two
 * tasks: Paystub and Tax Payment.
 */

/** How far ahead the upcoming-runs list looks. */
const PAYROLL_UPCOMING_DAYS = 60;

function describePaySchedule(group) {
  switch (group.schedule) {
    case "Monthly":
      return "Pays the last day of every month.";
    case "Semi-Monthly":
      return "Pays the 15th and the last day of every month.";
    case "Bi-Weekly":
      if (!group.anchorDate) return "Every other week — set the first pay date to start the cycle.";
      return `Every other ${WEEKDAY_NAMES[group.weekday]}, from ${formatTaskDate(group.anchorDate)}.`;
    default:
      return "";
  }
}

// ── Group card ───────────────────────────────────────────────────────────────

function createPayrollGroupCard(company, group) {
  const card = document.createElement("section");
  card.className = "payroll-group" + (group.enabled ? " is-on" : "");
  card.dataset.schedule = group.schedule;

  // Header: name + description + enable switch
  const head = document.createElement("div");
  head.className = "payroll-group-head";

  const text = document.createElement("div");
  const name = document.createElement("div");
  name.className = "payroll-group-name";
  name.textContent = group.schedule;
  const desc = document.createElement("div");
  desc.className = "payroll-group-desc";
  desc.textContent = describePaySchedule(group);
  text.append(name, desc);

  const switchLabel = document.createElement("label");
  switchLabel.className = "switch";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = group.enabled;
  toggle.setAttribute("aria-label", `${group.schedule} payroll for ${company.name}`);
  const track = document.createElement("span");
  track.className = "switch-track";
  const thumb = document.createElement("span");
  thumb.className = "switch-thumb";
  switchLabel.append(toggle, track, thumb);

  toggle.addEventListener("change", async () => {
    try {
      await setPayrollGroupEnabled(company.id, group.schedule, toggle.checked);
      renderPayrollSection(getCompanyById(company.id));
      renderCompaniesTable();
      showIndicator(`${group.schedule} payroll ${toggle.checked ? "enabled" : "disabled"}`, "success");
    } catch (err) {
      toggle.checked = !toggle.checked;
      showIndicator(err.message || "Could not save.", "error");
    }
  });

  head.append(text, switchLabel);
  card.appendChild(head);

  if (!group.enabled) {
    // Keep disabled groups collapsed — their employees are preserved but the
    // detail is noise until the schedule is actually in use.
    if (group.employees.length) {
      const note = document.createElement("div");
      note.className = "payroll-group-note";
      note.textContent = `${group.employees.length} employee${group.employees.length === 1 ? "" : "s"} kept on this schedule.`;
      card.appendChild(note);
    }
    return card;
  }

  if (group.schedule === "Bi-Weekly") card.appendChild(createBiWeeklyAnchorRow(company, group));
  card.appendChild(createEmployeeList(company, group));
  return card;
}

/** Bi-weekly needs a first pay date; the weekday follows from it. */
function createBiWeeklyAnchorRow(company, group) {
  const row = document.createElement("div");
  row.className = "payroll-anchor-row" + (group.anchorDate ? "" : " is-unset");

  const label = document.createElement("label");
  label.className = "payroll-anchor-label";
  label.textContent = "First pay date";

  const input = document.createElement("input");
  input.type = "date";
  input.className = "form-input payroll-anchor-input";
  input.value = group.anchorDate || "";

  const hint = document.createElement("span");
  hint.className = "payroll-anchor-hint";
  const setHint = () => {
    const parsed = parseYmd(input.value);
    hint.textContent = parsed
      ? `Every other ${WEEKDAY_NAMES[parsed.getDay()]} from here.`
      : "Pick the first pay date — every other week counts from it.";
  };
  setHint();

  input.addEventListener("change", async () => {
    if (!input.value) return;
    try {
      await setPayrollGroupAnchor(company.id, group.schedule, input.value);
      renderPayrollSection(getCompanyById(company.id));
      showIndicator("Bi-weekly cycle set", "success");
    } catch (err) {
      showIndicator(err.message || "Could not set the pay date.", "error");
    }
  });
  input.addEventListener("input", setHint);

  label.appendChild(input);
  row.append(label, hint);
  return row;
}

// ── Employees ────────────────────────────────────────────────────────────────

function createEmployeeList(company, group) {
  const wrap = document.createElement("div");
  wrap.className = "payroll-employees";

  const head = document.createElement("div");
  head.className = "payroll-employees-head";
  const title = document.createElement("span");
  title.className = "payroll-employees-title";
  title.textContent = `Employees (${group.employees.length})`;
  head.appendChild(title);
  wrap.appendChild(head);

  if (group.employees.length === 0) {
    const empty = document.createElement("div");
    empty.className = "payroll-employees-empty";
    empty.textContent = "No employees on this schedule yet.";
    wrap.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "payroll-employee-list";
    group.employees.forEach(employee => {
      list.appendChild(createEmployeeRow(company, group, employee));
    });
    wrap.appendChild(list);
  }

  wrap.appendChild(createAddEmployeeRow(company, group));
  return wrap;
}

function createEmployeeRow(company, group, employee) {
  const item = document.createElement("li");
  item.className = "payroll-employee";

  const name = document.createElement("span");
  name.className = "payroll-employee-name";
  name.textContent = employee.name;

  const actions = document.createElement("div");
  actions.className = "payroll-employee-actions";

  // Moving between schedules is common enough (someone goes salaried) to be
  // inline rather than buried in an edit form.
  const move = document.createElement("select");
  move.className = "payroll-employee-move";
  move.setAttribute("aria-label", `Move ${employee.name} to another schedule`);
  PAYROLL_SCHEDULES.forEach(schedule => {
    const option = document.createElement("option");
    option.value = schedule;
    option.textContent = schedule;
    option.selected = schedule === group.schedule;
    move.appendChild(option);
  });
  move.addEventListener("change", async () => {
    try {
      await moveEmployee(company.id, group.schedule, move.value, employee.id);
      renderPayrollSection(getCompanyById(company.id));
      renderCompaniesTable();
      showIndicator(`${employee.name} moved to ${move.value}`, "success");
    } catch (err) {
      showIndicator(err.message || "Could not move employee.", "error");
    }
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "payroll-employee-remove";
  remove.title = `Remove ${employee.name}`;
  remove.setAttribute("aria-label", `Remove ${employee.name}`);
  remove.textContent = "✕";
  remove.addEventListener("click", async () => {
    if (!confirm(`Remove ${employee.name} from ${group.schedule} payroll?`)) return;
    try {
      await removeEmployee(company.id, group.schedule, employee.id);
      renderPayrollSection(getCompanyById(company.id));
      showIndicator(`${employee.name} removed`, "success");
    } catch (err) {
      showIndicator(err.message || "Could not remove employee.", "error");
    }
  });

  actions.append(move, remove);
  item.append(name, actions);
  return item;
}

function createAddEmployeeRow(company, group) {
  const row = document.createElement("div");
  row.className = "payroll-add-employee";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-input";
  input.placeholder = "Add employee…";
  input.autocomplete = "off";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary";
  btn.textContent = "Add";

  const submit = async () => {
    const name = input.value.trim();
    if (!name) return;
    try {
      await addEmployee(company.id, group.schedule, name);
      input.value = "";
      renderPayrollSection(getCompanyById(company.id));
      showIndicator(`${name} added`, "success");
      // Put focus back so several people can be added in a row.
      document.querySelector(`.payroll-group[data-schedule="${CSS.escape(group.schedule)}"] .payroll-add-employee input`)?.focus();
    } catch (err) {
      showIndicator(err.message || "Could not add employee.", "error");
    }
  };

  btn.addEventListener("click", submit);
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    submit();
  });

  row.append(input, btn);
  return row;
}

// ── Upcoming runs ────────────────────────────────────────────────────────────

function createTaskCheckbox(task, onChange) {
  const label = document.createElement("label");
  label.className = "payroll-task" + (isTaskComplete(task.id) ? " is-done" : "");
  label.dataset.kind = task.kind;

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = isTaskComplete(task.id);

  const box = document.createElement("span");
  box.className = "payroll-task-box";
  box.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "payroll-task-text";

  const name = document.createElement("span");
  name.className = "payroll-task-name";
  name.textContent = task.label;

  const due = document.createElement("span");
  due.className = "payroll-task-due";
  due.textContent = formatTaskDate(task.dueDate);
  if (task.movedForWeekend) {
    due.classList.add("is-moved");
    due.title = `Falls on ${formatTaskDate(task.date)}, a weekend — due the Friday before.`;
  }

  text.append(name, due);

  cb.addEventListener("change", async () => {
    await setTaskComplete(task.id, cb.checked);
    label.classList.toggle("is-done", cb.checked);
    onChange?.();
  });

  label.append(cb, box, text);
  return label;
}

function renderUpcomingRuns(company) {
  const section = document.createElement("section");
  section.className = "payroll-upcoming";

  const title = document.createElement("div");
  title.className = "company-section-title";
  title.textContent = `Upcoming — next ${PAYROLL_UPCOMING_DAYS} days`;
  section.appendChild(title);

  const from = todayYmd();
  const to = ymd(addDays(new Date(), PAYROLL_UPCOMING_DAYS));
  const tasks = buildPayrollTasks(company, from, to);

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "payroll-employees-empty";
    const configured = getEnabledPayrollGroups(company).filter(isPayrollGroupConfigured);
    empty.textContent = configured.length === 0
      ? "Enable a payroll schedule above to generate the run calendar."
      : "No payroll runs fall in this window.";
    section.appendChild(empty);
    return section;
  }

  // Chronological by due date. Paystubs are per run; a tax deposit can cover
  // several runs at once, so tasks are listed individually rather than nested
  // under a single run.
  const list = document.createElement("div");
  list.className = "payroll-run-list";

  tasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "payroll-run";

    const head = document.createElement("div");
    head.className = "payroll-run-head";

    const date = document.createElement("span");
    date.className = "payroll-run-date";
    date.textContent = formatTaskDate(task.dueDate);

    const pill = document.createElement("span");
    pill.className = "schedule-pill";
    pill.dataset.schedule = task.kind === TASK_KIND_TAX ? task.depositor : task.schedule;
    pill.textContent = task.kind === TASK_KIND_TAX ? `${task.depositor} deposit` : task.schedule;

    const context = document.createElement("span");
    context.className = "payroll-run-count";
    context.textContent = task.kind === TASK_KIND_TAX
      ? describeTaskContext(task)
      : `${task.employeeCount} employee${task.employeeCount === 1 ? "" : "s"}`;

    head.append(date, pill, context);
    card.appendChild(head);

    const taskWrap = document.createElement("div");
    taskWrap.className = "payroll-run-tasks";
    taskWrap.appendChild(createTaskCheckbox(task, () => {
      if (typeof refreshCalendarIfActive === "function") refreshCalendarIfActive();
    }));
    card.appendChild(taskWrap);

    list.appendChild(card);
  });

  section.appendChild(list);
  return section;
}

// ── Section entry point ──────────────────────────────────────────────────────

/** Called by company-detail.js when the Payroll tab is active. */
function renderPayrollSection(company) {
  const panel = document.getElementById("companySectionPanel");
  if (!panel || !company) return;

  const wrap = document.createElement("div");
  wrap.className = "payroll-section";

  const depositor = String(company.payrollTax ?? "").trim();
  const banner = document.createElement("div");
  banner.className = "payroll-depositor";
  if (depositor) {
    banner.innerHTML = `<strong>${escapeHtml(depositor)}</strong> tax depositor — ` +
      (depositor === "Monthly"
        ? "deposits are due the 15th of the following month."
        : "deposits are due the Friday or Wednesday after each pay date.");
  } else {
    banner.classList.add("is-warning");
    banner.textContent = "No payroll tax schedule set — edit the company details to pick Monthly or Semi-Weekly, or tax tasks won't be generated.";
  }
  wrap.appendChild(banner);

  const groupsTitle = document.createElement("div");
  groupsTitle.className = "company-section-title";
  groupsTitle.textContent = "Pay schedules";
  wrap.appendChild(groupsTitle);

  const groups = document.createElement("div");
  groups.className = "payroll-groups";
  (company.payrollGroups ?? []).forEach(group => {
    groups.appendChild(createPayrollGroupCard(company, group));
  });
  wrap.appendChild(groups);

  wrap.appendChild(renderUpcomingRuns(company));
  panel.replaceChildren(wrap);
}
