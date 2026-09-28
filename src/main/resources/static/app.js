const state = {
  employees: [],
  shifts: [],
  rosters: [],
  swaps: [],
  csrfToken: '',
  csrfHeaderToken: '',
  role: '',
  activeView: location.hash.slice(1) || 'overview',
  weekOffset: 0,
  rosterDate: '',
  rosterEmployeeId: '',
  rosterStatus: '',
  search: '',
  loading: true,
  error: ''
};

const viewRoot = document.querySelector('#view-root');
const dialog = document.querySelector('#form-dialog');
const form = document.querySelector('#entity-form');
const toast = document.querySelector('#toast');
const titleByView = { overview: 'Overview', roster: 'Roster', team: 'Employees', shifts: 'Shift types', swaps: 'Swap requests' };
let toastTimer;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function greeting() {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return state.role === 'EMPLOYEE' ? salutation : `${salutation}, team`;
}

function dateFromISO(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return 'Not set';
  const date = dateFromISO(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatTime(value) {
  if (!value) return '—';
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return escapeHtml(value);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
}

function avatar(name, index = 0) {
  return `<span class="avatar tone-${index % 4}">${escapeHtml(initials(name))}</span>`;
}

function statusClass(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('reject') || status.includes('declin')) return 'status-rejected';
  if (status.includes('manager')) return 'status-manager';
  if (status.includes('pending')) return 'status-pending';
  if (status.includes('swapped')) return 'status-swapped';
  return '';
}

function statusPill(value) {
  const label = String(value || 'UNKNOWN').replaceAll('_', ' ');
  return `<span class="status-pill ${statusClass(value)}">${escapeHtml(label)}</span>`;
}

async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(['GET', 'HEAD', 'OPTIONS'].includes(method) ? {} : { 'X-XSRF-TOKEN': state.csrfHeaderToken }),
      ...options.headers
    }
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function initializeApp() {
  try {
    const session = await api('/auth/session');
    if (!session.authenticated) {
      location.replace('/login.html');
      return;
    }
    state.csrfToken = session.csrfToken || '';
    state.csrfHeaderToken = state.csrfToken;
    state.role = session.role || '';
    document.body.classList.toggle('employee-account', state.role !== 'MANAGER');
    const managerAccount = state.role === 'MANAGER';
    document.title = managerAccount ? 'ShiftPlanner | Team operations' : 'ShiftPlanner | Employee workspace';
    document.querySelector('#workspace-context').textContent = managerAccount ? 'Operations team' : 'Employee workspace';
    document.querySelector('#sidebar-account-role').textContent = managerAccount ? 'Workspace manager' : 'Employee account';
    document.querySelector('#workspace-footer-label').textContent = managerAccount ? 'Team operations' : 'Employee workspace';
    document.querySelector('#logout-csrf').value = state.csrfToken;
    const email = session.username || '';
    const accountName = email === 'demo@shiftplanner.local' ? 'Demo manager' : email;
    const accountInitials = initials(accountName) || 'DM';
    document.querySelector('#account-name').textContent = accountName;
    document.querySelector('#account-email').textContent = email;
    document.querySelector('#account-toggle').textContent = accountInitials;
    document.querySelector('#sidebar-account-name').textContent = accountName;
    document.querySelector('#sidebar-avatar').textContent = accountInitials;
    document.querySelector('#account-avatar').textContent = accountInitials;
    document.body.classList.remove('auth-checking');
    await loadData();
  } catch (error) {
    location.replace('/login.html');
  }
}

async function loadData() {
  state.loading = true;
  state.error = '';
  render();
  try {
    const [employees, shifts, rosters, swaps] = await Promise.all([
      api('/employees'), api('/shifts'), api('/rosters'), api('/swap-requests')
    ]);
    state.employees = Array.isArray(employees) ? employees : [];
    state.shifts = Array.isArray(shifts) ? shifts : [];
    state.rosters = Array.isArray(rosters) ? rosters : [];
    state.swaps = Array.isArray(swaps) ? swaps : [];
    document.querySelector('#connection-label').textContent = 'Connected';
    document.querySelector('#connection-detail').textContent = 'Workspace data is live';
    document.querySelector('.sync-card').classList.add('is-online');
    document.querySelector('.sync-card').classList.remove('is-error');
  } catch (error) {
    state.error = error.message || 'Unable to load workspace data.';
    document.querySelector('#connection-label').textContent = 'Connection issue';
    document.querySelector('#connection-detail').textContent = 'Could not reach the API';
    document.querySelector('.sync-card').classList.add('is-error');
    document.querySelector('.sync-card').classList.remove('is-online');
  } finally {
    state.loading = false;
    updateNavCounts();
    render();
  }
}

function updateNavCounts() {
  const pending = state.swaps.filter(item => String(item.status).startsWith('PENDING')).length;
  document.querySelector('#roster-nav-count').textContent = state.rosters.length;
  document.querySelector('#swap-nav-count').textContent = pending;
}

function weekDates(offset = 0) {
  const current = dateFromISO(todayISO());
  const mondayOffset = (current.getDay() + 6) % 7;
  current.setDate(current.getDate() - mondayOffset + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(current);
    date.setDate(current.getDate() + index);
    return date;
  });
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function titleForWeek(days) {
  const first = days[0];
  const last = days[6];
  const firstMonth = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(first);
  const lastMonth = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(last);
  return firstMonth === lastMonth ? `${firstMonth} ${first.getDate()}–${last.getDate()}` : `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}`;
}

function rosterForWeek(days) {
  const start = isoDate(days[0]);
  const end = isoDate(days[6]);
  return state.rosters.filter(roster => roster.shiftDate >= start && roster.shiftDate <= end);
}

function renderSchedule() {
  const days = weekDates(state.weekOffset);
  const rosters = rosterForWeek(days).filter(item => String(item.status || '').toUpperCase() !== 'CANCELLED');
  const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  return `<div class="panel">
    <div class="panel-head"><div><h2 class="panel-title">Weekly roster</h2><p class="panel-subtitle">A clear view of who's on shift</p></div>
      <div class="week-control"><button type="button" data-week="-1" aria-label="Previous week">‹</button><span>${escapeHtml(titleForWeek(days))}</span><button type="button" data-week="1" aria-label="Next week">›</button></div>
    </div>
    <div class="panel-body"><div class="schedule-grid">${days.map(day => {
      const date = isoDate(day);
      const items = rosters.filter(roster => roster.shiftDate === date);
      return `<div class="day-column"><div class="day-head ${date === todayISO() ? 'is-today' : ''}">${escapeHtml(weekdayFormat.format(day))}<strong>${day.getDate()}</strong></div><div class="day-events">${items.length ? items.slice(0, 4).map((roster, index) => `<div class="schedule-event ${index ? `tone-${['blue', 'amber', 'rose'][index % 3]}` : ''}"><strong>${escapeHtml(roster.employee?.name || 'Unassigned')}</strong><small>${escapeHtml(roster.shift?.name || 'Shift')} · ${escapeHtml(formatTime(roster.shift?.startTime))}</small></div>`).join('') + (items.length > 4 ? `<span class="inline-note">+${items.length - 4} more</span>` : '') : '<span class="empty-day">—</span>'}</div></div>`;
    }).join('')}</div></div>
  </div>`;
}

function renderOverview() {
  const pendingSwaps = state.swaps.filter(item => String(item.status).startsWith('PENDING'));
  const upcoming = state.rosters.filter(item => item.shiftDate >= todayISO() && String(item.status || '').toUpperCase() !== 'CANCELLED').sort((a, b) => a.shiftDate.localeCompare(b.shiftDate)).slice(0, 4);
  const currentWeek = rosterForWeek(weekDates(0));
  const scheduled = currentWeek.filter(item => String(item.status || '').toUpperCase() !== 'CANCELLED').length;
  const coverage = state.employees.length ? Math.min(100, Math.round((new Set(currentWeek.map(item => item.employee?.id)).size / state.employees.length) * 100)) : 0;
  const assignedEmployees = new Set(currentWeek.filter(item => String(item.status || '').toUpperCase() !== 'CANCELLED').map(item => item.employee?.id).filter(Boolean)).size;
  const todaysShifts = state.rosters.filter(item => item.shiftDate === todayISO() && String(item.status || '').toUpperCase() !== 'CANCELLED');
  const weekDays = weekDates(0);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date());
  const employeeMode = state.role === 'EMPLOYEE';
  const managerCount = state.employees.filter(person => String(person.role).toUpperCase() === 'MANAGER').length;
  const workspaceLabel = employeeMode ? 'EMPLOYEE WORKSPACE' : 'TEAM OPERATIONS';
  const employeeSummary = employeeMode ? `${state.employees.length} employees in the workspace` : `${managerCount} managers across your team`;
  const memberLabel = employeeMode ? 'Employees' : 'Team members';
  const coverageLabel = employeeMode ? 'Employee coverage' : 'Team coverage';
  const scheduledSummary = `${assignedEmployees} of ${state.employees.length} ${employeeMode ? 'employees' : 'team members'} scheduled`;
  const noShiftTitle = employeeMode ? 'No upcoming shifts' : 'No shifts on the calendar';
  const noShiftDescription = employeeMode ? 'Your upcoming shifts will appear here.' : 'Create a roster assignment to see upcoming coverage here.';
  return `<section class="page-heading"><div><span class="eyebrow">${workspaceLabel} / ${escapeHtml(monthLabel.toUpperCase())}</span><h1>${escapeHtml(greeting())}<span style="color:#83a657">.</span></h1><p>Here’s what’s happening across your schedule this week.</p></div><div class="heading-actions"><button class="button button-quiet" type="button" data-action="new-roster"><span class="button-icon">＋</span> Assign shift</button><button class="button button-primary" type="button" data-action="new-employee"><span class="button-icon">＋</span> Add employee</button></div></section>
    ${state.error ? `<div class="error-block"><strong>Couldn’t connect to the workspace</strong><p>${escapeHtml(state.error)}. Check that the Spring Boot app and its database are running, then retry.</p><button class="button button-quiet button-small" type="button" data-action="refresh">Retry connection</button></div>` : ''}
    ${state.loading ? '<div class="loading-state"><span class="loading-label">Loading workspace data…</span><div class="skeleton"></div><div class="skeleton"></div></div>' : `
    <section class="stats-grid" aria-label="Workspace summary">
      <article class="stat-card"><div class="stat-top"><span>${memberLabel}</span><span class="stat-icon">♙</span></div><div class="stat-value">${state.employees.length}</div><div class="stat-note">${employeeSummary}</div></article>
      <article class="stat-card"><div class="stat-top"><span>Shifts this week</span><span class="stat-icon">▦</span></div><div class="stat-value">${scheduled}</div><div class="stat-note">${todaysShifts.length} scheduled for today</div></article>
      <article class="stat-card"><div class="stat-top"><span>${coverageLabel}</span><span class="stat-icon">◉</span></div><div class="stat-value">${coverage}<span style="font-size:14px">%</span></div><div class="stat-note">${scheduledSummary}</div></article>
      <article class="stat-card"><div class="stat-top"><span>Pending swaps</span><span class="stat-icon">⇄</span></div><div class="stat-value">${pendingSwaps.length}</div><div class="stat-note">${pendingSwaps.filter(item => item.status === 'PENDING_MANAGER_APPROVAL').length} awaiting manager review</div></article>
    </section>
    <div class="dashboard-grid"><div class="stack">${renderSchedule()}<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Upcoming shifts</h2><p class="panel-subtitle">The next assignments on your calendar</p></div><button class="text-button" type="button" data-view-link="roster">View roster →</button></div><div class="panel-body">${upcoming.length ? upcoming.map((item, index) => `<div class="list-row">${avatar(item.employee?.name, index)}<div class="list-copy"><strong>${escapeHtml(item.employee?.name || 'Unassigned')}</strong><small>${escapeHtml(item.shift?.name || 'Shift')} · ${escapeHtml(formatDate(item.shiftDate))} · ${escapeHtml(formatTime(item.shift?.startTime))}</small></div>${statusPill(item.status)}</div>`).join('') : emptyState(noShiftTitle, noShiftDescription, '＋', employeeMode ? '' : 'new-roster')}</div></section></div>
    <div class="stack"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Swap requests</h2><p class="panel-subtitle">Requests that need a decision</p></div><button class="text-button" type="button" data-view-link="swaps">See all →</button></div><div class="panel-body">${pendingSwaps.length ? pendingSwaps.slice(0, 4).map((item, index) => `<div class="list-row">${avatar(item.requester?.name, index)}<div class="list-copy"><strong>${escapeHtml(item.requester?.name || (employeeMode ? 'Employee' : 'Teammate'))} <span style="color:#a7b0a8;font-weight:400">→</span> ${escapeHtml(item.colleague?.name || 'Colleague')}</strong><small>${escapeHtml(formatDate(item.requesterRoster?.shiftDate))} · ${escapeHtml(item.requesterRoster?.shift?.name || 'Shift')}</small></div>${statusPill(item.status)}</div>`).join('') : emptyState('All caught up', 'New shift swap requests will appear here.', '✓')}</div></section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Coverage snapshot</h2><p class="panel-subtitle">This week at a glance</p></div><span class="eyebrow">${escapeHtml(titleForWeek(weekDays))}</span></div><div class="panel-body"><div class="coverage-summary"><div class="coverage-line"><span>${coverageLabel}</span><strong>${coverage}%</strong></div><div class="coverage-track"><span style="width:${coverage}%"></span></div><div class="coverage-line"><span>Rostered shifts</span><strong>${scheduled}</strong></div><div class="coverage-line"><span>Shift types</span><strong>${state.shifts.length}</strong></div></div></div></section></div></div>`}`;
}

function emptyState(title, description, symbol = '＋', action = '') {
  return `<div class="empty-state"><span class="empty-symbol">${escapeHtml(symbol)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p>${action ? `<button type="button" class="text-button" data-action="${escapeHtml(action)}">Add now →</button>` : ''}</div>`;
}

function pageHeading(eyebrow, title, description, action, actionLabel) {
  return `<section class="page-heading"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action ? `<div class="heading-actions"><button class="button button-primary" type="button" data-action="${escapeHtml(action)}"><span class="button-icon">＋</span>${escapeHtml(actionLabel)}</button></div>` : ''}</section>`;
}

function renderRoster() {
  const rosters = [...state.rosters].filter(item => {
    const matchesDate = !state.rosterDate || item.shiftDate === state.rosterDate;
    const matchesEmployee = !state.rosterEmployeeId || String(item.employee?.id) === state.rosterEmployeeId;
    const matchesStatus = !state.rosterStatus || String(item.status).toUpperCase() === state.rosterStatus;
    return matchesDate && matchesEmployee && matchesStatus;
  }).sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
  const employeeOptions = [{ value: '', label: 'All team members' }, ...state.employees.map(person => ({ value: person.id, label: person.name }))];
  const statusOptions = [{ value: '', label: 'All statuses' }, ...Array.from(new Set(state.rosters.map(item => String(item.status || 'SCHEDULED').toUpperCase()))).sort().map(status => ({ value: status, label: status.replaceAll('_', ' ') }))];
  return `${pageHeading('SCHEDULE / ASSIGNMENTS', 'Roster', 'Manage shift coverage and keep every assignment in one place.', 'new-roster', 'Assign shift')}
    <div class="toolbar"><div class="toolbar-group"><input class="date-filter" id="roster-date-filter" type="date" aria-label="Filter roster by date" value="${escapeHtml(state.rosterDate)}"><select class="filter-select" id="roster-employee-filter" aria-label="Filter roster by team member">${employeeOptions.map(option => `<option value="${escapeHtml(option.value)}" ${String(option.value) === state.rosterEmployeeId ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select><select class="filter-select" id="roster-status-filter" aria-label="Filter roster by status">${statusOptions.map(option => `<option value="${escapeHtml(option.value)}" ${String(option.value) === state.rosterStatus ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select><button class="button button-quiet button-small" type="button" data-action="clear-roster-filter">Clear filters</button></div><span class="inline-note">${rosters.length} of ${state.rosters.length} assignments</span></div>
    <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>TEAM MEMBER</th><th>DATE</th><th>SHIFT</th><th>HOURS</th><th>STATUS</th><th aria-label="Actions"></th></tr></thead><tbody>${rosters.length ? rosters.map(item => `<tr><td><div class="person-cell">${avatar(item.employee?.name, Number(item.employee?.id || 0))}<div class="person-meta"><strong>${escapeHtml(item.employee?.name || 'Unassigned')}</strong><small>${escapeHtml(item.employee?.department || item.employee?.email || 'Team member')}</small></div></div></td><td>${escapeHtml(formatDate(item.shiftDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))}</td><td><span class="roster-name">${escapeHtml(item.shift?.name || 'Shift')}</span></td><td><span class="shift-time">${escapeHtml(formatTime(item.shift?.startTime))} – ${escapeHtml(formatTime(item.shift?.endTime))}</span></td><td>${statusPill(item.status)}</td><td><div class="table-actions"><button class="row-action is-danger" type="button" data-delete="roster" data-id="${Number(item.id)}" title="Remove assignment" aria-label="Remove assignment">×</button></div></td></tr>`).join('') : `<tr><td colspan="6" class="table-empty">${state.error ? 'Roster data is unavailable.' : 'No assignments match this view.'}</td></tr>`}</tbody></table></div></section>`;
}

function renderTeam() {
  const query = state.search.trim().toLowerCase();
  const people = state.employees.filter(person => `${person.name} ${person.email} ${person.department} ${person.role}`.toLowerCase().includes(query));
  return `${pageHeading('PEOPLE / DIRECTORY', 'Employees', 'Manage employee details and roles across your team.', 'new-employee', 'Add employee')}
    <div class="toolbar"><div class="toolbar-group"><input class="search-field" id="team-search" type="search" placeholder="Search people" aria-label="Search team members" value="${escapeHtml(state.search)}"><span class="inline-note">${people.length} of ${state.employees.length} team members</span></div></div>
    <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>TEAM MEMBER</th><th>DEPARTMENT</th><th>ROLE</th><th>EMAIL</th><th aria-label="Actions"></th></tr></thead><tbody>${people.length ? people.map((person, index) => `<tr><td><div class="person-cell">${avatar(person.name, index)}<div class="person-meta"><strong>${escapeHtml(person.name)}</strong><small>Member #${escapeHtml(person.id)}</small></div></div></td><td>${escapeHtml(person.department || '—')}</td><td>${statusPill(String(person.role || 'EMPLOYEE').toUpperCase())}</td><td>${escapeHtml(person.email)}</td><td><div class="table-actions"><button class="row-action" type="button" data-edit="employee" data-id="${Number(person.id)}" title="Edit team member" aria-label="Edit ${escapeHtml(person.name)}">✎</button><button class="row-action is-danger" type="button" data-delete="employee" data-id="${Number(person.id)}" title="Remove team member" aria-label="Remove ${escapeHtml(person.name)}">×</button></div></td></tr>`).join('') : `<tr><td colspan="5" class="table-empty">${state.employees.length ? 'No team members match your search.' : 'No team members have been added yet.'}</td></tr>`}</tbody></table></div></section>`;
}

function renderShifts() {
  return `${pageHeading('SCHEDULE / SHIFT TYPES', 'Shift types', 'Define the hours your team works and use them in roster assignments.', 'new-shift', 'Add shift type')}
    <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>SHIFT</th><th>START</th><th>END</th><th>DURATION</th><th>ASSIGNED</th><th aria-label="Actions"></th></tr></thead><tbody>${state.shifts.length ? state.shifts.map((shift, index) => {
      const assigned = state.rosters.filter(item => item.shift?.id === shift.id).length;
      return `<tr><td><div class="person-cell">${avatar(shift.name, index)}<div class="person-meta"><strong>${escapeHtml(shift.name)}</strong><small>Shift type #${escapeHtml(shift.id)}</small></div></div></td><td><span class="shift-time">${escapeHtml(formatTime(shift.startTime))}</span></td><td><span class="shift-time">${escapeHtml(formatTime(shift.endTime))}</span></td><td>${escapeHtml(duration(shift.startTime, shift.endTime))}</td><td>${assigned} assignment${assigned === 1 ? '' : 's'}</td><td><div class="table-actions"><button class="row-action" type="button" data-edit="shift" data-id="${Number(shift.id)}" title="Edit shift type" aria-label="Edit ${escapeHtml(shift.name)}">✎</button><button class="row-action is-danger" type="button" data-delete="shift" data-id="${Number(shift.id)}" title="Remove shift type" aria-label="Remove ${escapeHtml(shift.name)}">×</button></div></td></tr>`;
    }).join('') : `<tr><td colspan="6" class="table-empty">No shift types have been created yet.</td></tr>`}</tbody></table></div></section>`;
}

function duration(start, end) {
  if (!start || !end) return '—';
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

function renderSwaps() {
  const managers = state.employees.filter(person => String(person.role).toUpperCase() === 'MANAGER');
  const employeesOptions = state.employees.map(person => `<option value="${Number(person.id)}">${escapeHtml(person.name)} · ${escapeHtml(person.role)}</option>`).join('');
  const requests = [...state.swaps].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return `${pageHeading('PEOPLE / SHIFT SWAPS', 'Swap requests', 'Coordinate shift changes with colleague and manager approvals.', 'new-swap', 'New request')}
    <div class="toolbar"><div class="toolbar-group"><span class="inline-note">${requests.length} request${requests.length === 1 ? '' : 's'} · ${requests.filter(item => String(item.status).startsWith('PENDING')).length} pending</span></div></div>
    ${requests.length ? `<div class="stack"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Approval context</h2><p class="panel-subtitle">Select the employee whose decision you're entering. This project does not have sign-in yet.</p></div></div><div class="panel-body"><div class="actor-controls"><div class="field form-field"><label for="acting-employee">Responding as</label><select id="acting-employee"><option value="">Choose colleague</option>${employeesOptions}</select></div><div class="field form-field"><label for="acting-manager">Approving manager</label><select id="acting-manager"><option value="">Choose manager</option>${managers.map(person => `<option value="${Number(person.id)}">${escapeHtml(person.name)}</option>`).join('')}</select></div></div></div></section>
    <div class="swap-card-list">${requests.map(item => renderSwapCard(item)).join('')}</div></div>` : `<section class="panel">${emptyState('No swap requests yet', 'When a teammate requests a schedule change, it will show up here.', '⇄', 'new-swap')}</section>`}`;
}

function renderSwapCard(item) {
  const colleaguePending = String(item.colleagueStatus).toUpperCase() === 'PENDING';
  const managerPending = String(item.colleagueStatus).toUpperCase() === 'ACCEPTED' && String(item.managerStatus).toUpperCase() === 'PENDING';
  const roster = item.requesterRoster;
  const colleagueRoster = item.colleagueRoster;
  return `<article class="swap-card"><div class="swap-card-top"><div class="swap-people"><strong>${escapeHtml(item.requester?.name || 'Requester')}</strong><span class="swap-arrow">⇄</span><strong>${escapeHtml(item.colleague?.name || 'Colleague')}</strong></div>${statusPill(item.status)}</div>
    <div class="swap-meta"><span>${escapeHtml(formatDate(roster?.shiftDate, { month: 'short', day: 'numeric', year: 'numeric' }))} · ${escapeHtml(roster?.shift?.name || 'Requested shift')}</span>${colleagueRoster ? `<span>↔ ${escapeHtml(formatDate(colleagueRoster.shiftDate))} · ${escapeHtml(colleagueRoster.shift?.name || 'Colleague shift')}</span>` : ''}<span>Submitted ${escapeHtml(formatDate(String(item.createdAt || '').slice(0, 10)))}</span></div>
    ${item.reason ? `<p class="swap-reason">${escapeHtml(item.reason)}</p>` : ''}
    <div class="swap-actions">${colleaguePending ? `<button class="button button-primary button-small" type="button" data-swap-decision="colleague" data-decision="ACCEPT" data-id="${Number(item.id)}" data-colleague="${Number(item.colleague?.id)}">Accept as colleague</button><button class="button button-quiet button-small" type="button" data-swap-decision="colleague" data-decision="DECLINE" data-id="${Number(item.id)}" data-colleague="${Number(item.colleague?.id)}">Decline</button>` : ''}${managerPending ? `<button class="button button-primary button-small" type="button" data-swap-decision="manager" data-decision="APPROVE" data-id="${Number(item.id)}">Approve as manager</button><button class="button button-quiet button-small" type="button" data-swap-decision="manager" data-decision="REJECT" data-id="${Number(item.id)}">Reject</button>` : ''}${!colleaguePending && !managerPending ? `<span class="inline-note">Colleague: ${escapeHtml(item.colleagueStatus)} · Manager: ${escapeHtml(item.managerStatus)}</span>` : ''}</div></article>`;
}

function render() {
  if (!titleByView[state.activeView]) state.activeView = 'overview';
  document.querySelector('#breadcrumb-current').textContent = titleByView[state.activeView];
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('is-active', link.dataset.view === state.activeView));
  if (state.loading && state.activeView !== 'overview') {
    viewRoot.innerHTML = `${pageHeading('WORKSPACE', titleByView[state.activeView], 'Loading your latest workspace data…', '', '')}<div class="loading-state"><span class="loading-label">Loading…</span><div class="skeleton"></div></div>`;
    return;
  }
  if (state.error && state.activeView !== 'overview') {
    viewRoot.innerHTML = `${pageHeading('WORKSPACE', titleByView[state.activeView], 'Workspace data is not available right now.', '', '')}<div class="error-block"><strong>Couldn’t connect to the workspace</strong><p>${escapeHtml(state.error)}. Check that the app and database are running, then retry.</p><button class="button button-quiet button-small" type="button" data-action="refresh">Retry connection</button></div>`;
    return;
  }
  const renderers = { overview: renderOverview, roster: renderRoster, team: renderTeam, shifts: renderShifts, swaps: renderSwaps };
  viewRoot.innerHTML = renderers[state.activeView]();
  const notice = document.querySelector('#notice');
  notice.hidden = !state.error || state.activeView === 'overview';
  notice.innerHTML = state.error ? `${escapeHtml(state.error)} <button type="button" aria-label="Dismiss">×</button>` : '';
}

function setView(view) {
  if (!titleByView[view]) return;
  state.activeView = view;
  state.search = '';
  if (location.hash !== `#${view}`) location.hash = view;
  closeMobileNav();
  toggleAccountMenu(false);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function field(name, label, type = 'text', value = '', options = {}) {
  const id = `field-${name}`;
  const required = options.required === false ? '' : 'required';
  const hint = options.hint ? `<span class="field-hint">${escapeHtml(options.hint)}</span>` : '';
  if (options.choices) {
    return `<div class="form-field"><label for="${id}">${escapeHtml(label)}</label><select id="${id}" name="${escapeHtml(name)}" ${required}>${options.choices.map(choice => `<option value="${escapeHtml(choice.value)}" ${String(value) === String(choice.value) ? 'selected' : ''}>${escapeHtml(choice.label)}</option>`).join('')}</select>${hint}</div>`;
  }
  return `<div class="form-field"><label for="${id}">${escapeHtml(label)}</label><input id="${id}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''} ${required} ${options.min ? `min="${escapeHtml(options.min)}"` : ''}>${hint}</div>`;
}

function selectChoices(items, valueKey, labelFor) {
  return [{ value: '', label: 'Select an option' }, ...items.map(item => ({ value: item[valueKey], label: labelFor(item) }))];
}

function updateSwapChoices() {
  const requesterRosterSelect = document.querySelector('#field-requesterRosterId');
  const colleagueSelect = document.querySelector('#field-colleagueId');
  const colleagueRosterSelect = document.querySelector('#field-colleagueRosterId');
  if (!requesterRosterSelect || !colleagueSelect || !colleagueRosterSelect) return;

  const requesterRoster = state.rosters.find(item => item.id === Number(requesterRosterSelect.value));
  const requesterId = requesterRoster?.employee?.id;
  const selectedColleagueId = colleagueSelect.value;
  const colleagues = state.employees.filter(person => String(person.id) !== String(requesterId ?? ''));
  colleagueSelect.replaceChildren(new Option('Select an option', ''));
  colleagues.forEach(person => colleagueSelect.add(new Option(`${person.name} · ${person.department || person.role}`, person.id)));
  colleagueSelect.value = colleagues.some(person => String(person.id) === selectedColleagueId) ? selectedColleagueId : '';

  const colleagueId = colleagueSelect.value;
  const colleagueRosters = state.rosters.filter(item => String(item.employee?.id) === colleagueId && String(item.status).toUpperCase() !== 'CANCELLED');
  const selectedRosterId = colleagueRosterSelect.value;
  colleagueRosterSelect.replaceChildren(new Option('No shift to trade back', ''));
  colleagueRosters.forEach(item => colleagueRosterSelect.add(new Option(`${formatDate(item.shiftDate)} · ${item.shift?.name || 'Shift'}`, item.id)));
  colleagueRosterSelect.value = colleagueRosters.some(item => String(item.id) === selectedRosterId) ? selectedRosterId : '';
}

function openDialog({ title, eyebrow = 'WORKSPACE', submit = 'Save changes', fields, onSubmit }) {
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-eyebrow').textContent = eyebrow;
  document.querySelector('#dialog-submit').innerHTML = `${escapeHtml(submit)} <span aria-hidden="true">↗</span>`;
  document.querySelector('#dialog-fields').innerHTML = fields;
  form.onsubmit = async event => {
    event.preventDefault();
    const submitButton = document.querySelector('#dialog-submit');
    submitButton.disabled = true;
    try {
      await onSubmit(new FormData(form));
      dialog.close();
      await loadData();
      showToast(`${title.replace(/^(Add|Create|Edit) /, '')} saved successfully.`);
    } catch (error) {
      showToast(error.message || 'The request could not be completed.', true);
    } finally {
      submitButton.disabled = false;
    }
  };
  dialog.showModal();
  if (title === 'New swap request') updateSwapChoices();
}

function formValue(data, key) {
  return String(data.get(key) ?? '').trim();
}

function openEmployeeDialog(person = null) {
  const isEditing = Boolean(person);
  const choices = [{ value: 'EMPLOYEE', label: 'Employee' }, { value: 'MANAGER', label: 'Manager' }];
  if (person?.role && !choices.some(choice => choice.value === person.role)) {
    choices.push({ value: person.role, label: `${person.role} (existing role)` });
  }
  openDialog({
    title: isEditing ? 'Edit employee' : 'Add employee', eyebrow: 'PEOPLE / DIRECTORY', submit: isEditing ? 'Save employee' : 'Add employee',
    fields: `${field('name', 'Full name', 'text', person?.name || '', { placeholder: 'e.g. Jordan Lee' })}${field('email', 'Email address', 'email', person?.email || '', { placeholder: 'jordan@company.com' })}${field('role', 'Role', 'select', person?.role || 'EMPLOYEE', { choices })}${field('department', 'Department', 'text', person?.department || '', { required: false, placeholder: 'e.g. Customer support' })}`,
    onSubmit: data => api(isEditing ? `/employees/${person.id}` : '/employees', { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify({ name: formValue(data, 'name'), email: formValue(data, 'email'), role: formValue(data, 'role'), department: formValue(data, 'department') || null }) })
  });
}

function openShiftDialog(shift = null) {
  const isEditing = Boolean(shift);
  openDialog({
    title: isEditing ? 'Edit shift type' : 'Add shift type', eyebrow: 'SCHEDULE / SHIFT TYPES', submit: isEditing ? 'Save shift' : 'Create shift',
    fields: `${field('name', 'Shift name', 'text', shift?.name || '', { placeholder: 'e.g. Morning shift' })}${field('startTime', 'Start time', 'time', shift?.startTime?.slice(0, 5) || '')}${field('endTime', 'End time', 'time', shift?.endTime?.slice(0, 5) || '', { hint: 'End time can be earlier than start time for overnight shifts.' })}`,
    onSubmit: data => api(isEditing ? `/shifts/${shift.id}` : '/shifts', { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify({ name: formValue(data, 'name'), startTime: `${formValue(data, 'startTime')}:00`, endTime: `${formValue(data, 'endTime')}:00` }) })
  });
}

function openRosterDialog() {
  if (!state.employees.length || !state.shifts.length) {
    showToast('Add a team member and shift type before assigning a shift.', true);
    return;
  }
  openDialog({
    title: 'Assign a shift', eyebrow: 'SCHEDULE / ROSTER', submit: 'Create assignment',
    fields: `${field('employeeId', 'Team member', 'select', '', { choices: selectChoices(state.employees, 'id', person => `${person.name} · ${person.department || person.role}`) })}${field('shiftId', 'Shift type', 'select', '', { choices: selectChoices(state.shifts, 'id', shift => `${shift.name} · ${formatTime(shift.startTime)}–${formatTime(shift.endTime)}`) })}${field('shiftDate', 'Date', 'date', todayISO())}`,
    onSubmit: data => api('/rosters', { method: 'POST', body: JSON.stringify({ shiftDate: formValue(data, 'shiftDate'), employee: { id: Number(formValue(data, 'employeeId')) }, shift: { id: Number(formValue(data, 'shiftId')) }, status: 'SCHEDULED' }) })
  });
}

function openSwapDialog() {
  if (state.employees.length < 2 || !state.rosters.length) {
    showToast('A swap needs at least two team members and one roster assignment.', true);
    return;
  }
  const rosterChoices = selectChoices(state.rosters.filter(item => String(item.status).toUpperCase() !== 'CANCELLED'), 'id', item => `${item.employee?.name || 'Team member'} · ${formatDate(item.shiftDate)} · ${item.shift?.name || 'Shift'}`);
  const colleagueChoices = selectChoices(state.employees, 'id', item => `${item.name} · ${item.department || item.role}`);
  const colleagueRosterChoices = [{ value: '', label: 'No shift to trade back' }];
  openDialog({
    title: 'New swap request', eyebrow: 'PEOPLE / SHIFT SWAPS', submit: 'Submit request',
    fields: `${field('requesterRosterId', 'Your roster assignment', 'select', '', { choices: rosterChoices })}${field('colleagueId', 'Request colleague', 'select', '', { choices: colleagueChoices })}${field('colleagueRosterId', 'Colleague shift to exchange', 'select', '', { choices: colleagueRosterChoices, required: false })}<div class="form-field"><label for="field-reason">Reason</label><textarea id="field-reason" name="reason" placeholder="Add a little context for your teammate" maxlength="500"></textarea></div>`,
    onSubmit: data => {
      const roster = state.rosters.find(item => item.id === Number(formValue(data, 'requesterRosterId')));
      if (!roster) throw new Error('Choose a valid roster assignment.');
      if (Number(roster.employee?.id) === Number(formValue(data, 'colleagueId'))) throw new Error('Choose a colleague other than the assigned team member.');
      const colleagueRosterId = formValue(data, 'colleagueRosterId');
      if (colleagueRosterId) {
        const colleagueRoster = state.rosters.find(item => item.id === Number(colleagueRosterId));
        if (Number(colleagueRoster?.employee?.id) !== Number(formValue(data, 'colleagueId'))) throw new Error('Choose a shift assigned to the selected colleague.');
      }
      return api('/swap-requests', { method: 'POST', body: JSON.stringify({ requester: { id: Number(roster.employee?.id) }, colleague: { id: Number(formValue(data, 'colleagueId')) }, requesterRoster: { id: Number(formValue(data, 'requesterRosterId')) }, ...(colleagueRosterId ? { colleagueRoster: { id: Number(colleagueRosterId) } } : {}), reason: formValue(data, 'reason') || null }) });
    }
  });
}

async function deleteItem(type, id) {
  const labels = { employee: 'team member', shift: 'shift type', roster: 'roster assignment' };
  if (!window.confirm(`Remove this ${labels[type]}? This action cannot be undone.`)) return;
  try {
    await api(`/${type === 'roster' ? 'rosters' : `${type === 'employee' ? 'employees' : 'shifts'}`}/${id}`, { method: 'DELETE' });
    await loadData();
    showToast(`${labels[type][0].toUpperCase()}${labels[type].slice(1)} removed.`);
  } catch (error) {
    showToast(error.message || 'The item could not be removed.', true);
  }
}

async function makeSwapDecision(button) {
  const kind = button.dataset.swapDecision;
  const isColleague = kind === 'colleague';
  const actingId = Number(document.querySelector(isColleague ? '#acting-employee' : '#acting-manager')?.value);
  if (!actingId) {
    showToast(isColleague ? 'Choose the responding colleague above first.' : 'Choose an approving manager above first.', true);
    return;
  }
  if (isColleague && actingId !== Number(button.dataset.colleague)) {
    showToast('Only the colleague on the request can respond.', true);
    return;
  }
  const endpoint = isColleague ? 'colleague-decision' : 'manager-decision';
  const queryKey = isColleague ? 'colleagueId' : 'managerId';
  try {
    await api(`/swap-requests/${button.dataset.id}/${endpoint}?${queryKey}=${actingId}&decision=${button.dataset.decision}`, { method: 'PUT' });
    await loadData();
    showToast(`Swap decision recorded: ${button.dataset.decision.toLowerCase()}.`);
  } catch (error) {
    showToast(error.message || 'The decision could not be saved.', true);
  }
}

function closeMobileNav() {
  document.querySelector('#sidebar').classList.remove('is-open');
  document.querySelector('#mobile-scrim').classList.remove('is-visible');
}

function toggleAccountMenu(forceOpen) {
  const menu = document.querySelector('#account-menu');
  const button = document.querySelector('#account-toggle');
  const open = forceOpen ?? menu.hidden;
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

document.addEventListener('click', event => {
  const viewLink = event.target.closest('[data-view], [data-view-link]');
  if (viewLink) {
    event.preventDefault();
    setView(viewLink.dataset.view || viewLink.dataset.viewLink);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (action) {
    const handlers = { 'new-employee': () => openEmployeeDialog(), 'new-shift': () => openShiftDialog(), 'new-roster': openRosterDialog, 'new-swap': openSwapDialog, refresh: loadData, 'open-employees': () => setView('team'), logout: () => document.querySelector('#logout-form').requestSubmit(), 'clear-roster-filter': () => { state.rosterDate = ''; state.rosterEmployeeId = ''; state.rosterStatus = ''; render(); } };
    if (action.dataset.action === 'logout') toggleAccountMenu(false);
    handlers[action.dataset.action]?.();
    return;
  }
  const edit = event.target.closest('[data-edit]');
  if (edit) {
    const item = (edit.dataset.edit === 'employee' ? state.employees : state.shifts).find(entry => Number(entry.id) === Number(edit.dataset.id));
    if (item) (edit.dataset.edit === 'employee' ? openEmployeeDialog : openShiftDialog)(item);
    return;
  }
  const remove = event.target.closest('[data-delete]');
  if (remove) {
    deleteItem(remove.dataset.delete, Number(remove.dataset.id));
    return;
  }
  const decision = event.target.closest('[data-swap-decision]');
  if (decision) makeSwapDecision(decision);
});

document.addEventListener('input', event => {
  if (event.target.id === 'team-search') {
    const start = event.target.selectionStart;
    state.search = event.target.value;
    render();
    const search = document.querySelector('#team-search');
    search.focus();
    search.setSelectionRange(start, start);
  }
});

document.addEventListener('change', event => {
  if (event.target.id === 'roster-date-filter') {
    state.rosterDate = event.target.value;
    render();
  }
  if (event.target.id === 'roster-employee-filter') {
    state.rosterEmployeeId = event.target.value;
    render();
  }
  if (event.target.id === 'roster-status-filter') {
    state.rosterStatus = event.target.value;
    render();
  }
  if (event.target.id === 'field-requesterRosterId' || event.target.id === 'field-colleagueId') {
    updateSwapChoices();
  }
});

document.addEventListener('click', event => {
  if (event.target.closest('[data-week]')) {
    state.weekOffset += Number(event.target.closest('[data-week]').dataset.week);
    render();
  }
  if (event.target.matches('#notice button')) {
    state.error = '';
    event.target.closest('.notice').hidden = true;
  }
});

document.querySelector('#refresh-button').addEventListener('click', loadData);
document.querySelector('#account-toggle').addEventListener('click', () => toggleAccountMenu());
document.querySelector('.profile-button').addEventListener('click', () => toggleAccountMenu());
document.addEventListener('click', event => {
  if (!event.target.closest('#account-menu, #account-toggle, .profile-button')) toggleAccountMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') toggleAccountMenu(false);
});
document.querySelector('#menu-toggle').addEventListener('click', () => {
  document.querySelector('#sidebar').classList.add('is-open');
  document.querySelector('#mobile-scrim').classList.add('is-visible');
});
document.querySelector('#mobile-scrim').addEventListener('click', closeMobileNav);
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
window.addEventListener('hashchange', () => {
  const view = location.hash.slice(1);
  if (titleByView[view]) { state.activeView = view; render(); }
});

if (state.activeView !== 'overview' && !titleByView[state.activeView]) state.activeView = 'overview';
render();
initializeApp();