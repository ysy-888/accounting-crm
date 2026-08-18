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

/** How far ahead the upcoming list looks. */
const PAYROLL_UPCOMING_DAYS = 60;

// ── Group card ───────────────────────────────────────────────────────────────

/**
 * Only enabled groups get a card. Which schedules a company runs is set in
 * Edit company details, so there is no toggle here.
 */
function createPayrollGroupCard(company, group) {
  const card = document.createElement("section");
  card.className = "payroll-group is-on";
  card.dataset.schedule = group.schedule;

  const head = document.createElement("div");
  head.className = "payroll-group-head";

  const name = document.createElement("div");
  name.className = "payroll-group-name";
  name.textContent = group.schedule;
  head.appendChild(name);
  card.appendChild(head);

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
  // inline. Only schedules the company actually runs are offered — adding a
  // schedule happens in Edit company details.
  const targets = getEnabledPayrollGroups(company).map(g => g.schedule);
  const move = targets.length > 1 ? document.createElement("select") : null;
  if (move) {
    move.className = "payroll-employee-move";
    move.setAttribute("aria-label", `Move ${employee.name} to another schedule`);
    targets.forEach(schedule => {
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
  }

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

  if (move) actions.appendChild(move);
  actions.appendChild(remove);
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
  title.textContent = "Upcoming";
  section.appendChild(title);

  const from = todayYmd();
  const to = ymd(addDays(new Date(), PAYROLL_UPCOMING_DAYS));
  const tasks = buildPayrollTasks(company, from, to);

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "payroll-employees-empty";
    const configured = getEnabledPayrollGroups(company).filter(isPayrollGroupConfigured);
    empty.textContent = configured.length === 0
      ? "Set a pay schedule to generate the run calendar."
      : "Nothing due in the next 60 days.";
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

  // Without a depositor there is no rule to derive deposit dates from, so no
  // tax tasks get generated — worth saying, since it is silent otherwise.
  if (!String(company.payrollTax ?? "").trim()) {
    const banner = document.createElement("div");
    banner.className = "payroll-depositor is-warning";
    banner.textContent = "No payroll tax schedule set — pick Monthly or Semi-Weekly in Edit company details, or no tax payment tasks will be generated.";
    wrap.appendChild(banner);
  }

  const enabled = getEnabledPayrollGroups(company);

  const groupsTitle = document.createElement("div");
  groupsTitle.className = "company-section-title";
  groupsTitle.textContent = "Pay schedules";
  wrap.appendChild(groupsTitle);

  if (enabled.length === 0) {
    const empty = document.createElement("div");
    empty.className = "payroll-employees-empty";
    empty.textContent = "No pay schedules yet — add one in Edit company details.";
    wrap.appendChild(empty);
  } else {
    const groups = document.createElement("div");
    groups.className = "payroll-groups";
    enabled.forEach(group => groups.appendChild(createPayrollGroupCard(company, group)));
    wrap.appendChild(groups);
  }

  wrap.appendChild(renderUpcomingRuns(company));
  panel.replaceChildren(wrap);
}
