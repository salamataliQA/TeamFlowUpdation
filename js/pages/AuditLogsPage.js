import { AUDIT_ACTIONS } from "../constants.js";
import { can } from "../permissions.js";
import { AuditService } from "../services/UserService.js";
import { emptyState } from "../components.js";
import { bindShell, renderShell } from "../layout.js";
import { store } from "../store.js";
import { escapeHtml, formatDateTime } from "../utils.js";

function humanAction(row) {
  const member = row.targetMemberName || "a team member";
  const project = row.projectName || "a project";
  const map = {
    CREATE_ASSIGNMENT: `Assigned ${member} to ${project}`,
    UPDATE_ASSIGNMENT: `Updated ${member}'s ${project} assignment`,
    REMOVE_ASSIGNMENT: `Removed ${member} from ${project}`,
    PAUSE_ASSIGNMENT: `Paused ${member} on ${project}`,
    RESUME_ASSIGNMENT: `Resumed ${member} on ${project}`,
    ADD_EXTRA_HOURS: `Added extra hours for ${member}`,
    UPDATE_EXTRA_HOURS: `Updated extra hours for ${member}`,
    REMOVE_EXTRA_HOURS: `Removed extra hours for ${member}`,
    CREATE_PROJECT: `Created project ${project}`,
    UPDATE_PROJECT: `Updated project ${project}`,
    ARCHIVE_PROJECT: `Archived project ${project}`,
    CREATE_MEMBER: `Added team member ${member}`,
    UPDATE_MEMBER: `Updated team member ${member}`,
    DISABLE_MEMBER: `Deactivated ${member}`,
    MEMBER_DEACTIVATED: `Deactivated ${member}`,
    MEMBER_REACTIVATED: `Reactivated ${member}`,
    PERMISSION_CHANGED: "Changed a permission",
    ROLE_CHANGED: "Changed a role",
  };
  return map[row.action] || row.action.replaceAll("_", " ").toLowerCase();
}

function details(row) {
  if (!row.newValue) return "—";
  if (row.newValue.allocatedHours != null) {
    const from = row.oldValue?.allocatedHours != null ? `${row.oldValue.allocatedHours}h → ` : "";
    return `${from}${row.newValue.allocatedHours}h · ${row.newValue.status || row.newValue.date || ""}`.trim();
  }
  if (row.newValue.hours != null) {
    return `${row.newValue.hours}h${row.newValue.reason ? ` · ${row.newValue.reason}` : ""}`;
  }
  return Object.entries(row.newValue)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function actionTone(action) {
  if (action.includes("REMOVE") || action.includes("DISABLE") || action.includes("ARCHIVE")) return "danger";
  if (action.includes("PAUSE")) return "paused";
  if (action.includes("CREATE") || action.includes("ASSIGN")) return "success";
  return "info";
}

function table(rows) {
  if (!rows.length) {
    return emptyState({ icon: "scroll-text", title: "No audit events", message: "Activity will appear here as managers make changes." });
  }
  return `
    <div class="card table-wrap">
      <table class="audit-table">
        <thead>
          <tr><th>Date & time</th><th>User</th><th>Action</th><th>Team member</th><th>Project</th><th>Details</th></tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr>
                <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                <td>
                  <strong>${escapeHtml(row.performedByName || "Unknown")}</strong>
                  <div>${escapeHtml(humanAction(row))}</div>
                </td>
                <td><span class="badge ${actionTone(row.action)}">${escapeHtml(row.action)}</span></td>
                <td>${escapeHtml(row.targetMemberName || "—")}</td>
                <td>${escapeHtml(row.projectName || "—")}</td>
                <td>${escapeHtml(details(row))}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

export class AuditLogsPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    this.ui = { search: "", action: "", userId: "", memberId: "", projectId: "", from: "", to: "", cursor: null, rows: [], done: false };
    this.state = { members: [], projects: [], users: [] };
  }

  async load(reset = false) {
    const ui = this.ui;
    if (reset) {
      ui.cursor = null;
      ui.rows = [];
      ui.done = false;
    }
    const page = await AuditService.fetch({
      search: ui.search,
      action: ui.action,
      userId: ui.userId,
      memberId: ui.memberId,
      projectId: ui.projectId,
      from: ui.from,
      to: ui.to,
      cursor: ui.cursor,
    });
    ui.rows = reset ? page.rows : [...ui.rows, ...page.rows];
    ui.cursor = page.nextCursor;
    ui.done = !page.nextCursor;
    this.render();
  }

  render() {
    const app = document.querySelector(this.rootSelector);
    const ui = this.ui;
    const state = this.state;
    const userOptions = [...new Map(
      [...(state.users || []), ...ui.rows.map((row) => ({ id: row.performedBy, name: row.performedByName }))].map((item) => [item.id, item])
    ).values()].filter((item) => item.id && item.name);

    app.innerHTML = renderShell(
      "audit",
      `
      <div class="page-head">
        <div>
          <h2>Audit Logs</h2>
          <p>Who changed occupancy, assignments, and permissions — and when.</p>
        </div>
      </div>
      <div class="filters">
        <input id="q" placeholder="Search logs" value="${escapeHtml(ui.search)}" />
        <select id="user">
          <option value="">All users</option>
          ${userOptions.map((item) => `<option value="${item.id}" ${ui.userId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <select id="action">
          <option value="">All actions</option>
          ${Object.values(AUDIT_ACTIONS).map((action) => `<option value="${action}" ${ui.action === action ? "selected" : ""}>${action}</option>`).join("")}
        </select>
        <select id="member">
          <option value="">All members</option>
          ${(state.members || []).map((item) => `<option value="${item.id}" ${ui.memberId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <select id="project">
          <option value="">All projects</option>
          ${(state.projects || []).map((item) => `<option value="${item.id}" ${ui.projectId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <input type="date" id="from" value="${escapeHtml(ui.from)}" aria-label="From date" />
        <input type="date" id="to" value="${escapeHtml(ui.to)}" aria-label="To date" />
      </div>
      ${table(ui.rows)}
      <div class="pagination">
        <button class="btn secondary" id="more" ${ui.done ? "disabled" : ""}>Load more</button>
      </div>`
    );
    bindShell(state);
    document.querySelector("#q")?.addEventListener("change", (e) => {
      ui.search = e.target.value;
      this.load(true);
    });
    document.querySelector("#user")?.addEventListener("change", (e) => {
      ui.userId = e.target.value;
      this.load(true);
    });
    document.querySelector("#action")?.addEventListener("change", (e) => {
      ui.action = e.target.value;
      this.load(true);
    });
    document.querySelector("#member")?.addEventListener("change", (e) => {
      ui.memberId = e.target.value;
      this.load(true);
    });
    document.querySelector("#project")?.addEventListener("change", (e) => {
      ui.projectId = e.target.value;
      this.load(true);
    });
    document.querySelector("#from")?.addEventListener("change", (e) => {
      ui.from = e.target.value;
      this.load(true);
    });
    document.querySelector("#to")?.addEventListener("change", (e) => {
      ui.to = e.target.value;
      this.load(true);
    });
    document.querySelector("#more")?.addEventListener("click", () => this.load(false));
  }

  async init() {
    if (!can("viewAuditLogs")) {
      document.querySelector(this.rootSelector).innerHTML = renderShell(
        "audit",
        emptyState({ title: "Restricted", message: "You do not have permission to view audit logs." })
      );
      bindShell();
      return;
    }
    store.subscribe((state) => {
      this.state = state;
      this.render();
    });
    await this.load(true);
  }
}
