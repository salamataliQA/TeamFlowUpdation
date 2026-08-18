import { can } from "../permissions.js";
import { computeProjectStats, isActiveMember } from "../occupancy.js";
import { emptyState, renderAvatar, renderBadge } from "../components.js";
import { escapeHtml, formatHours } from "../utils.js";

export function renderProjectDetails(state, project) {
  const stats = computeProjectStats(project, state.assignments, state.members);
  const assignedMembers = stats.assignedMembers.filter(isActiveMember);
  const rows = assignedMembers.length
    ? assignedMembers
        .map(
          (member) => `
          <article class="card assign-card">
            <div class="member-cell">
              ${renderAvatar(member.name, "sm")}
              <div>
                <strong>${escapeHtml(member.name)}</strong>
                <small>${formatHours(member.allocatedHours)}${member.assignmentDate ? ` · ${escapeHtml(member.assignmentDate)}` : ""}</small>
              </div>
            </div>
            <div class="actions" style="margin-top:10px">
              ${can("editAssignmentHours") ? `<button class="btn secondary" data-edit-assign="${member.assignmentId}">Hours</button>` : ""}
              ${can("removeAssignment") ? `<button class="btn ghost" data-pause="${member.assignmentId}">Pause</button>` : ""}
              ${can("removeAssignment") ? `<button class="btn danger" data-remove="${member.assignmentId}">Remove</button>` : ""}
            </div>
          </article>`
        )
        .join("")
    : emptyState({
        title: "No one assigned",
        message: "Assign a team member to start tracking hours on this project.",
        actionLabel: can("assignMember") ? "Assign Project" : "",
        actionId: "assign",
      });

  return `
    <p>${escapeHtml(project.description || "")}</p>
    <div style="margin:12px 0">${renderBadge(project.status)}</div>
    <div class="stat-row"><span>Total allocated</span><strong>${formatHours(stats.allocatedHours)}</strong></div>
    <div class="stat-row"><span>Team members</span><strong>${assignedMembers.length}</strong></div>
    <h4 style="margin:18px 0 10px">Team</h4>
    <div class="project-grid" style="grid-template-columns:1fr">${rows}</div>
    <div class="actions" style="margin-top:16px">
      ${can("assignMember") ? `<button class="btn" data-action="assign">Add member</button>` : ""}
      ${can("editProject") ? `<button class="btn secondary" data-action="edit">Edit project</button>` : ""}
      ${can("archiveProject") && project.status !== "archived" ? `<button class="btn danger" data-action="archive">Archive</button>` : ""}
    </div>`;
}

export class ProjectDetailsPage {
  render(state, project) {
    return renderProjectDetails(state, project);
  }
}
