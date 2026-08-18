import { occupancyRemainHtml, renderAvatar, renderBadge, renderProgress } from "../components.js";
import { can } from "../permissions.js";
import { assignmentActionMenu } from "../components.js";
import { changeAssignmentStatus, openAssignModal } from "../forms.js";
import { escapeHtml, formatDateKey, formatHours, formatPercent, formatTime, relativeDayLabel } from "../utils.js";
import { emptyState } from "../components.js";

export function renderTeamDetails(stats, state, logs = []) {
  const canEdit = can("editAssignmentHours");
  const canRemove = can("removeAssignment");
  const projectCards = stats.allDayAssignments?.length
    ? stats.allDayAssignments
        .map((item) => {
          const project = state.projects.find((p) => p.id === item.projectId);
          return `<article class="card assign-card">
            <header style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <strong>${escapeHtml(project?.name || "Project")}</strong>
              <div style="display:flex;align-items:center;gap:8px">
                ${renderBadge(item.status)}
                ${assignmentActionMenu(item, { canEdit, canRemove })}
              </div>
            </header>
            <div class="stat-row"><span>Date</span><strong>${escapeHtml(item.date || "Needs date")}</strong></div>
            <div class="stat-row"><span>Allocated</span><strong>${formatHours(item.allocatedHours)}</strong></div>
          </article>`;
        })
        .join("")
    : emptyState({
        icon: "folder-open",
        title: "No projects assigned",
        message: "Assign work on this date to start tracking occupancy.",
        actionLabel: can("assignMember") ? "Assign Work" : "",
        actionId: "assign-from-empty",
      });

  return `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px">
      ${renderAvatar(stats.member.name, "lg")}
      <div>
        <h3>${escapeHtml(stats.member.name)}</h3>
        <p>${escapeHtml(stats.member.designation || "QA Engineer")} · ${escapeHtml(stats.member.department || "")}</p>
        <p>${escapeHtml(stats.member.email || "No email")}</p>
      </div>
    </div>
    <h4>Occupancy · ${escapeHtml(formatDateKey(stats.dateKey))}</h4>
    <p class="hours">${formatHours(stats.occupied)} / ${formatHours(stats.capacity)}</p>
    ${renderProgress(stats.utilization, stats.tone)}
    <p>${formatPercent(stats.utilization)} · ${occupancyRemainHtml(stats)}</p>
    <div class="stat-row"><span>Regular occupied</span><strong>${formatHours(stats.occupied)}</strong></div>
    <div class="stat-row"><span>Extra hours</span><strong class="extra-accent">${formatHours(stats.extra)}</strong></div>
    <div class="stat-row"><span>Total work</span><strong>${formatHours(stats.totalWork)}</strong></div>
    <div style="margin:18px 0">${renderBadge(stats.status)}</div>
    <h4>Current projects</h4>
    <div class="project-grid" style="grid-template-columns:1fr;margin-top:10px">${projectCards}</div>
    <h4 style="margin-top:20px">Assignment timeline</h4>
    <div class="timeline">
      ${
        logs.length
          ? logs
              .map(
                (row) => `<div class="timeline-item">
                  <div>
                    <strong>${escapeHtml(relativeDayLabel(row.timestamp))} · ${escapeHtml(formatTime(row.timestamp))}</strong>
                    <p>${escapeHtml((row.action || "").replaceAll("_", " "))} ${escapeHtml(row.projectName || "")}</p>
                    <small>by ${escapeHtml(row.performedByName || "Unknown")}</small>
                  </div>
                </div>`
              )
              .join("")
          : "<p>No assignment history yet.</p>"
      }
    </div>
    ${can("assignMember") ? `<div class="actions" style="margin-top:16px"><button class="btn" data-action="assign">Assign Work</button></div>` : ""}`;
}

export function bindTeamDetails(drawer, state, memberId, dateKey) {
  drawer.root.addEventListener("click", (event) => {
    const menuBtn = event.target.closest("[data-open-menu]");
    if (menuBtn) {
      event.stopPropagation();
      const menu = drawer.root.querySelector(`[data-menu="${menuBtn.dataset.openMenu}"]`);
      menu?.classList.toggle("is-open");
    }
    if (event.target.closest("[data-action=assign], [data-action=assign-from-empty]")) {
      drawer.close();
      openAssignModal(state, { memberId, date: dateKey });
    }
    const edit = event.target.closest("[data-edit-assign]");
    const pause = event.target.closest("[data-pause]");
    const resume = event.target.closest("[data-resume]");
    const remove = event.target.closest("[data-remove]");
    if (edit) {
      const assignment = state.assignments.find((item) => item.id === edit.dataset.editAssign);
      drawer.close();
      openAssignModal(state, { assignment });
    }
    if (pause) changeAssignmentStatus(state, state.assignments.find((item) => item.id === pause.dataset.pause), "paused");
    if (resume) changeAssignmentStatus(state, state.assignments.find((item) => item.id === resume.dataset.resume), "active");
    if (remove) changeAssignmentStatus(state, state.assignments.find((item) => item.id === remove.dataset.remove), "cancelled");
  });
}

export class TeamDetailsPage {
  render(stats, state, logs) {
    return renderTeamDetails(stats, state, logs);
  }
}
