import { REPORT_PRESETS } from "../constants.js";
import { getCurrentUser, isMember } from "../auth.js";
import { ownMemberId } from "../permissions.js";
import { occupancyLabel } from "../occupancy.js";
import { ReportService } from "../services/ReportService.js";
import { store } from "../store.js";
import { emptyState, kpiSkeleton, renderBadge, showToast } from "../components.js";
import { bindShell, pageActions, renderShell } from "../layout.js";
import { downloadCsv, escapeHtml, formatDateKey, formatHours, todayKey, weekRange } from "../utils.js";

function defaultRange() {
  const week = weekRange(todayKey());
  return { preset: "thisWeek", from: week.start, to: week.end };
}

export class ReportsPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    const initial = defaultRange();
    this.draft = {
      memberId: "",
      preset: initial.preset,
      from: initial.from,
      to: initial.to,
      includeInactive: false,
    };
    this.applied = { ...this.draft };
    this.ui = { openDate: "", loading: false };
    this.state = { members: [], assignments: [], extraHours: [], projects: [] };
  }

  memberOptions(state) {
    const groups = ReportService.reportMembersForDropdown(
      state.members,
      state.assignments,
      state.extraHours || [],
      this.draft.includeInactive
    );
    const option = (item) =>
      `<option value="${item.id}" ${item.id === this.draft.memberId ? "selected" : ""}>${escapeHtml(item.name)}</option>`;
    if (!groups.inactive.length) {
      return groups.active.map(option).join("");
    }
    return `
      <optgroup label="Active Members">${groups.active.map(option).join("")}</optgroup>
      <optgroup label="Inactive Members">${groups.inactive.map(option).join("")}</optgroup>`;
  }

  reports(state) {
    const user = getCurrentUser();
    const applied = this.applied;
    const lockedMemberId = isMember(user)
      ? ownMemberId(user) || state.members.find((item) => item.email === user.email)?.id
      : applied.memberId;
    const range = { from: applied.from, to: applied.to };
    if (lockedMemberId) {
      const member = state.members.find((item) => item.id === lockedMemberId);
      return member ? [ReportService.getMemberReport(member, state.assignments, state.extraHours || [], range.from, range.to)] : [];
    }
    return ReportService.getAllMembersReport(
      state.members,
      state.assignments,
      state.extraHours || [],
      range.from,
      range.to,
      { includeInactive: applied.includeInactive }
    );
  }

  markup(state) {
    const user = getCurrentUser();
    const applied = this.applied;
    const reports = this.ui.loading ? [] : this.reports(state);
    const rangeLabel = `${formatDateKey(applied.from)} → ${formatDateKey(applied.to)}`;
    const summary = reports.length === 1 ? reports[0] : null;
    const empty = !this.ui.loading && reports.length > 0 && reports.every((row) => !row.hasActivity);
    const noRoster = !this.ui.loading && !reports.length;

    return `
      <div class="page-head">
        <div>
          <h2>${isMember(user) ? "My Reports" : "Reports"}</h2>
          <p>Daily occupancy, extra hours, and project breakdown by date.</p>
        </div>
        <div class="actions">
          ${isMember(user) ? "" : pageActions()}
          <button class="btn secondary" id="export-csv">Export CSV</button>
        </div>
      </div>
      <div class="filters">
        ${
          isMember(user)
            ? ""
            : `<label class="field">
                <span>Team Member</span>
                <select id="rep-member">
                  <option value="">All Members</option>
                  ${this.memberOptions(state)}
                </select>
              </label>`
        }
        <label class="field">
          <span>Range</span>
          <select id="rep-preset">
            ${REPORT_PRESETS.map((item) => `<option value="${item.id}" ${this.draft.preset === item.id ? "selected" : ""}>${item.label}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Date From</span>
          <input type="date" id="rep-from" value="${this.draft.from}" ${this.draft.preset !== "custom" ? "disabled" : ""} />
        </label>
        <label class="field">
          <span>Date To</span>
          <input type="date" id="rep-to" value="${this.draft.to}" ${this.draft.preset !== "custom" ? "disabled" : ""} />
        </label>
        ${
          isMember(user)
            ? ""
            : `<label class="toggle" style="padding:8px 0">
                <div><strong>Include inactive members</strong></div>
                <button class="switch ${this.draft.includeInactive ? "is-on" : ""}" id="rep-inactive" role="switch" aria-checked="${this.draft.includeInactive}"></button>
              </label>`
        }
        <button class="btn" id="rep-apply" ${this.ui.loading ? "disabled" : ""}>${this.ui.loading ? "Loading report..." : "Apply Filter"}</button>
        <button class="btn secondary" id="rep-reset">Reset Filters</button>
      </div>
      ${
        this.ui.loading
          ? `${kpiSkeleton()}<p class="empty">Loading report...</p>`
          : empty
            ? emptyState({
                title: "No activity found for the selected filters.",
                message: `Nothing was recorded between ${rangeLabel}. Previous results were cleared.`,
              })
            : noRoster
              ? emptyState({ title: "No report data", message: "No team members match this filter and date range." })
              : `${
                  summary
                    ? `<div class="kpi-grid">
                        <article class="card kpi"><div class="kpi-label">Total Occupied</div><strong>${formatHours(summary.totalOccupied)}</strong></article>
                        <article class="card kpi"><div class="kpi-label">Extra Hours</div><strong>${formatHours(summary.extraHours)}</strong></article>
                        <article class="card kpi"><div class="kpi-label">Average Daily</div><strong>${formatHours(summary.averageDaily)}</strong></article>
                        <article class="card kpi"><div class="kpi-label">Over Capacity Days</div><strong>${summary.overCapacityDays}</strong></article>
                      </div>`
                    : `<div class="kpi-grid">
                        <article class="card kpi"><div class="kpi-label">Members</div><strong>${reports.length}</strong></article>
                        <article class="card kpi"><div class="kpi-label">Total Occupied</div><strong>${formatHours(reports.reduce((sum, item) => sum + item.totalOccupied, 0))}</strong></article>
                        <article class="card kpi"><div class="kpi-label">Extra Hours</div><strong>${formatHours(reports.reduce((sum, item) => sum + item.extraHours, 0))}</strong></article>
                      </div>`
                }
                ${reports
                  .map(
                    (report) => `
                <section class="card table-wrap" style="margin-bottom:16px">
                  <h3 style="padding:16px 16px 0">${escapeHtml(report.member.name)}${report.member.active === false ? " · Inactive" : ""}</h3>
                  <table class="audit-table">
                    <thead><tr><th>Date</th><th>Projects</th><th>Occupied</th><th>Extra</th><th>Capacity</th><th>Status</th></tr></thead>
                    <tbody>
                      ${report.days
                        .map((row) => {
                          const names = row.projects
                            .map((item) => state.projects.find((p) => p.id === item.projectId)?.name)
                            .filter(Boolean)
                            .join(", ");
                          const open = this.ui.openDate === `${report.member.id}:${row.date}`;
                          return `
                            <tr data-expand="${report.member.id}:${row.date}" style="cursor:pointer">
                              <td>${escapeHtml(formatDateKey(row.date))}</td>
                              <td>${escapeHtml(names || "—")}</td>
                              <td>${formatHours(row.occupied)}</td>
                              <td>${formatHours(row.extra)}</td>
                              <td>${formatHours(row.capacity)}</td>
                              <td>${renderBadge(row.status)}</td>
                            </tr>
                            ${
                              open
                                ? `<tr><td colspan="6">
                                    ${row.projects.map((item) => {
                                      const project = state.projects.find((p) => p.id === item.projectId);
                                      return `<div class="stat-row"><span>${escapeHtml(project?.name || "Project")}</span><strong>${formatHours(item.hours)}</strong></div>`;
                                    }).join("") || "<p>No projects</p>"}
                                    <div class="stat-row"><span>Regular occupied</span><strong>${formatHours(row.occupied)}</strong></div>
                                    <div class="stat-row"><span>Extra hours</span><strong>${formatHours(row.extra)}</strong></div>
                                    <div class="stat-row"><span>Total</span><strong>${formatHours(row.totalWork)}</strong></div>
                                  </td></tr>`
                                : ""
                            }`;
                        })
                        .join("")}
                    </tbody>
                  </table>
                </section>`
                  )
                  .join("")}`
      }`;
  }

  applyDraft(state) {
    const error = ReportService.validateReportRange(this.draft.from, this.draft.to);
    if (error) {
      showToast(error, "error");
      return;
    }
    this.ui.loading = true;
    this.paint(state);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.applied = { ...this.draft };
        this.ui.loading = false;
        this.paint(state);
      });
    });
  }

  reset(state) {
    const initial = defaultRange();
    this.draft = {
      memberId: isMember() ? ownMemberId() : "",
      preset: initial.preset,
      from: initial.from,
      to: initial.to,
      includeInactive: false,
    };
    this.applyDraft(state);
  }

  paint(state = this.state) {
    const app = document.querySelector(this.rootSelector);
    const user = getCurrentUser();
    app.innerHTML = renderShell("reports", this.markup(state));
    bindShell(state);
    document.querySelector("#rep-member")?.addEventListener("change", (event) => {
      this.draft.memberId = event.target.value;
    });
    document.querySelector("#rep-preset")?.addEventListener("change", (event) => {
      this.draft.preset = event.target.value;
      const range = ReportService.reportRange(this.draft.preset, this.draft.from, this.draft.to);
      this.draft.from = range.from;
      this.draft.to = range.to;
      this.paint(state);
    });
    document.querySelector("#rep-from")?.addEventListener("change", (event) => {
      this.draft.from = event.target.value;
      this.draft.preset = "custom";
    });
    document.querySelector("#rep-to")?.addEventListener("change", (event) => {
      this.draft.to = event.target.value;
      this.draft.preset = "custom";
    });
    document.querySelector("#rep-inactive")?.addEventListener("click", () => {
      this.draft.includeInactive = !this.draft.includeInactive;
      this.paint(state);
    });
    document.querySelector("#rep-apply")?.addEventListener("click", () => this.applyDraft(state));
    document.querySelector("#rep-reset")?.addEventListener("click", () => this.reset(state));
    document.querySelectorAll("[data-expand]").forEach((row) =>
      row.addEventListener("click", () => {
        this.ui.openDate = this.ui.openDate === row.dataset.expand ? "" : row.dataset.expand;
        this.paint(state);
      })
    );
    document.querySelector("#export-csv")?.addEventListener("click", () => {
      const reports = this.reports(state);
      const rows = [["Member", "Date", "Projects", "Occupied", "Extra", "Capacity", "Status"]];
      reports.forEach((report) => {
        report.days.forEach((day) => {
          rows.push([
            report.member.name,
            day.date,
            day.projects.map((item) => state.projects.find((p) => p.id === item.projectId)?.name).filter(Boolean).join("; "),
            day.occupied,
            day.extra,
            day.capacity,
            occupancyLabel(day.status),
          ]);
        });
      });
      downloadCsv("siznam-occupancy.csv", rows);
    });
    void user;
  }

  init() {
    const user = getCurrentUser();
    const memberId = isMember(user) ? ownMemberId(user) : "";
    if (memberId) {
      this.draft.memberId = memberId;
      this.applied.memberId = memberId;
    }
    store.subscribe((state) => {
      this.state = state;
      this.paint(state);
    }, { memberId });
  }
}
