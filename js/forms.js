import { ASSIGNMENT_STATUSES, AUDIT_ACTIONS, DEFAULT_DESIGNATION, MAX_HOURS, PROJECT_STATUSES } from "./constants.js";
import { getCurrentUser, isMember } from "./auth.js";
import { assertCan, can, canAssignWork, canManageExtraHours } from "./permissions.js";
import { computeMemberStats } from "./occupancy.js";
import { AssignmentService } from "./services/AssignmentService.js";
import { ExtraHoursService } from "./services/ExtraHoursService.js";
import { ProjectService } from "./services/ProjectService.js";
import { TeamService } from "./services/TeamService.js";
import { confirmDialog, field, openModal, setFieldErrors, showToast } from "./components.js";
import { escapeHtml, parseNumber, setButtonLoading, todayKey } from "./utils.js";
import { handleError } from "./layout.js";
import {
  firstError,
  validateAssignmentPayload,
  validateExtraHoursPayload,
  validateMemberPayload,
  validateProjectPayload,
} from "./validation.js";

function options(items, selected, labelKey = "name") {
  return items
    .map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item[labelKey] || item.id)}</option>`)
    .join("");
}

export function openMemberModal(state, existing) {
  if (isMember()) throw Object.assign(new Error("Members cannot manage the team."), { code: "permission-denied" });
  assertCan("manageTeam");
  const member = existing || {
    name: "",
    email: "",
    designation: DEFAULT_DESIGNATION,
    department: "Quality",
    weeklyCapacity: state.settings?.defaultDailyCapacity || 8,
    active: true,
    avatar: "",
  };

  openModal({
    title: existing ? "Edit Team Member" : "Add Team Member",
    checkDirty: true,
    body: `
      <div class="form-grid two">
        ${field("Full name", `<input name="name" value="${escapeHtml(member.name)}" required />`)}
        ${field("Email", `<input name="email" type="email" value="${escapeHtml(member.email || "")}" required />`)}
        ${field("Designation", `<input name="designation" value="${escapeHtml(member.designation || DEFAULT_DESIGNATION)}" required />`)}
        ${field("Department", `<input name="department" value="${escapeHtml(member.department || "")}" />`)}
        ${field("Daily capacity (hours)", `<input name="weeklyCapacity" type="number" min="1" max="${MAX_HOURS}" step="0.5" value="${member.weeklyCapacity}" />`)}
        ${field("Status", `<select name="active"><option value="true" ${member.active !== false ? "selected" : ""}>Active</option><option value="false" ${member.active === false ? "selected" : ""}>Inactive</option></select>`)}
      </div>`,
    footer: `<button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-save>${existing ? "Save changes" : "Add Team Member"}</button>`,
    onOpen(root, close, forceClose) {
      root.querySelector("[data-cancel]").addEventListener("click", close);
      root.querySelector("[data-save]").addEventListener("click", async (event) => {
        const form = {
          name: root.querySelector("[name=name]").value.trim(),
          email: root.querySelector("[name=email]").value.trim(),
          designation: root.querySelector("[name=designation]").value.trim(),
          department: root.querySelector("[name=department]").value.trim(),
          weeklyCapacity: parseNumber(root.querySelector("[name=weeklyCapacity]").value, 8),
          active: root.querySelector("[name=active]").value === "true",
          avatar: member.avatar || "",
        };
        const errors = validateMemberPayload(form, state.members || [], existing?.id);
        if (firstError(errors)) {
          setFieldErrors(root, errors);
          return showToast(firstError(errors), "error");
        }
        setButtonLoading(event.currentTarget, true, "Saving...");
        try {
          if (existing) await TeamService.update(existing, form);
          else await TeamService.create(form);
          showToast(existing ? "Team member updated." : "Team member added successfully.");
          forceClose();
        } catch (err) {
          handleError(err, "Unable to save team member.");
        } finally {
          setButtonLoading(event.currentTarget, false);
        }
      });
    },
  });
}

export function openProjectModal(state, existing) {
  if (existing) assertCan("editProject");
  else assertCan("createProject");
  const project = existing || { name: "", description: "", status: "active", color: "#2563EB" };

  openModal({
    title: existing ? "Edit Project" : "Create Project",
    checkDirty: true,
    body: `
      <div class="form-grid">
        ${field("Project name", `<input name="name" value="${escapeHtml(project.name)}" required />`)}
        ${field("Description", `<textarea name="description">${escapeHtml(project.description || "")}</textarea>`)}
        <div class="form-grid two">
          ${field("Status", `<select name="status">${PROJECT_STATUSES.map((status) => `<option value="${status}" ${project.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>`)}
          ${field("Project color", `<input name="color" type="color" value="${project.color || "#2563EB"}" />`)}
        </div>
      </div>`,
    footer: `<button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-save>${existing ? "Save changes" : "Create Project"}</button>`,
    onOpen(root, close, forceClose) {
      root.querySelector("[data-cancel]").addEventListener("click", close);
      root.querySelector("[data-save]").addEventListener("click", async (event) => {
        const form = {
          name: root.querySelector("[name=name]").value.trim(),
          description: root.querySelector("[name=description]").value.trim(),
          status: root.querySelector("[name=status]").value,
          color: root.querySelector("[name=color]").value,
        };
        const errors = validateProjectPayload(form, state.projects || [], existing?.id);
        if (firstError(errors)) {
          setFieldErrors(root, errors);
          return showToast(firstError(errors), "error");
        }
        setButtonLoading(event.currentTarget, true, "Saving...");
        try {
          if (existing) await ProjectService.update(existing, form);
          else await ProjectService.create(form);
          showToast(existing ? "Project updated." : "Project created.");
          forceClose();
        } catch (err) {
          handleError(err, "Unable to save project.");
        } finally {
          setButtonLoading(event.currentTarget, false);
        }
      });
    },
  });
}

export function openAssignModal(state, preset = {}) {
  if (isMember() || !canAssignWork()) {
    return showToast("Only Admin and Manager can assign work.", "error");
  }
  const members = state.members.filter((item) => item.active !== false);
  const projects = state.projects.filter((item) => item.status !== "archived");
  const existing = preset.assignment || null;
  const dateValue = existing?.date || preset.date || todayKey();

  const renderPreview = (root) => {
    const memberId = root.querySelector("[name=memberId]").value;
    const hours = parseNumber(root.querySelector("[name=allocatedHours]").value, 0);
    const date = root.querySelector("[name=date]").value;
    const member = members.find((item) => item.id === memberId);
    if (!member) return;
    const stats = computeMemberStats(
      member,
      state.assignments.filter((item) => item.id !== existing?.id),
      state.extraHours || [],
      date
    );
    const nextOccupied = stats.occupied + hours;
    const nextTotal = nextOccupied + stats.extra;
    const over = Math.max(nextTotal - stats.capacity, 0);
    root.querySelector("[data-preview]").innerHTML = `
      <div>Current daily occupancy<strong>${stats.occupied}h / ${stats.capacity}h</strong></div>
      <div>After assignment<strong>${nextOccupied}h / ${stats.capacity}h</strong></div>
      <div>Extra hours<strong>${stats.extra}h</strong></div>
      <div>${over > 0 ? `Over capacity<strong>+${over}h</strong>` : `Available<strong>${Math.max(stats.capacity - nextOccupied, 0)}h</strong>`}</div>`;
    const warn = root.querySelector("[data-warn]");
    if (over > 0) {
      warn.hidden = false;
      warn.textContent = `This assignment will put the member ${over}h over capacity.`;
    } else {
      warn.hidden = true;
    }
  };

  openModal({
    title: existing ? "Update Assignment" : "Assign Work",
    checkDirty: true,
    body: `
      <div class="form-grid">
        ${field("Team member", `<select name="memberId">${options(members, preset.memberId || existing?.memberId)}</select>`)}
        ${field("Project", `<select name="projectId">${options(projects, preset.projectId || existing?.projectId)}</select>`)}
        ${field("Assignment date", `<input name="date" type="date" value="${dateValue}" required />`)}
        <div class="form-grid two">
          ${field("Hours", `<input name="allocatedHours" type="number" min="0.5" max="${MAX_HOURS}" step="0.5" value="${existing?.allocatedHours ?? 4}" />`)}
          ${field("Status", `<select name="status">${ASSIGNMENT_STATUSES.map((status) => `<option value="${status}" ${(existing?.status || "active") === status ? "selected" : ""}>${status}</option>`).join("")}</select>`)}
        </div>
        ${field("Notes", `<textarea name="notes">${escapeHtml(existing?.notes || "")}</textarea>`)}
        <div class="capacity-preview" data-preview></div>
        <div class="warn-banner" data-warn hidden></div>
      </div>`,
    footer: `<button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-save>${existing ? "Save assignment" : "Assign Work"}</button>`,
    onOpen(root, close, forceClose) {
      renderPreview(root);
      root.querySelectorAll("[name=memberId], [name=allocatedHours], [name=date]").forEach((el) => {
        el.addEventListener("input", () => renderPreview(root));
        el.addEventListener("change", () => renderPreview(root));
      });
      root.querySelector("[data-cancel]").addEventListener("click", close);
      root.querySelector("[data-save]").addEventListener("click", async (event) => {
        const hoursRaw = root.querySelector("[name=allocatedHours]").value;
        const form = {
          memberId: root.querySelector("[name=memberId]").value,
          projectId: root.querySelector("[name=projectId]").value,
          date: root.querySelector("[name=date]").value,
          allocatedHours: parseNumber(hoursRaw, NaN),
          allocatedHoursRaw: hoursRaw,
          status: root.querySelector("[name=status]").value,
          notes: root.querySelector("[name=notes]").value.trim(),
        };
        const errors = validateAssignmentPayload(form, {
          members: state.members || [],
          projects: state.projects || [],
          assignments: state.assignments || [],
          existingId: existing?.id,
        });
        if (firstError(errors)) {
          setFieldErrors(root, errors);
          return showToast(firstError(errors), "error");
        }
        const member = members.find((item) => item.id === form.memberId);
        const project = projects.find((item) => item.id === form.projectId);
        const stats = computeMemberStats(
          member,
          state.assignments.filter((item) => item.id !== existing?.id),
          state.extraHours || [],
          form.date
        );
        const nextTotal = stats.occupied + form.allocatedHours + stats.extra;
        if (form.status === "active" && nextTotal > stats.capacity && !can("allowOverCapacity")) {
          return showToast("You do not have permission to exceed capacity.", "error");
        }
        if (form.status === "active" && nextTotal > stats.capacity) {
          const over = nextTotal - stats.capacity;
          const ok = await confirmDialog({
            title: "Over capacity?",
            message: `This assignment will put ${member.name} ${over}h over capacity. Continue anyway?`,
            confirmText: "Assign anyway",
            danger: true,
          });
          if (!ok) return;
        }
        setButtonLoading(event.currentTarget, true, "Saving assignment...");
        try {
          if (existing) await AssignmentService.update(existing, form, { member, project });
          else await AssignmentService.create(form, { member, project });
          showToast(existing ? "Assignment updated." : "Work assigned successfully.");
          forceClose();
        } catch (err) {
          handleError(err, "Unable to save changes. No changes were applied.");
        } finally {
          setButtonLoading(event.currentTarget, false);
        }
      });
    },
  });
}

export async function changeAssignmentStatus(state, assignment, status) {
  if (isMember()) return showToast("Members cannot change assignments.", "error");
  const member = state.members.find((item) => item.id === assignment.memberId);
  const project = state.projects.find((item) => item.id === assignment.projectId);
  const labels = {
    paused: "Pause this assignment?",
    active: "Resume this assignment?",
    cancelled: "Remove this assignment? It will no longer count toward occupancy.",
    removed: "Remove this assignment? It will no longer count toward occupancy.",
    completed: "Mark this assignment completed?",
  };
  const ok = await confirmDialog({
    title: "Confirm change",
    message: labels[status] || "Update this assignment?",
    confirmText: status === "cancelled" || status === "removed" ? "Remove" : "Continue",
    danger: status === "cancelled" || status === "removed",
  });
  if (!ok) return;
  try {
    await AssignmentService.setStatus(assignment, status, { member, project });
    showToast(status === "paused" ? "Assignment paused." : status === "cancelled" || status === "removed" ? "Assignment removed." : "Assignment updated.");
  } catch (error) {
    handleError(error);
  }
}

export function openExtraHoursModal(state, preset = {}) {
  if (!canManageExtraHours()) return showToast("Only Admin can add extra hours unless a Manager is granted permission.", "error");
  const members = state.members.filter((item) => item.active !== false);
  openModal({
    title: "Add Extra Hours",
    checkDirty: true,
    body: `
      <div class="form-grid">
        ${field("Team member", `<select name="memberId">${options(members, preset.memberId)}</select>`)}
        ${field("Date", `<input name="date" type="date" value="${preset.date || todayKey()}" />`)}
        ${field("Hours", `<input name="hours" type="number" min="0.5" max="${MAX_HOURS}" step="0.5" value="2" />`)}
        ${field("Reason", `<input name="reason" placeholder="Production support" required />`)}
      </div>`,
    footer: `<button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-save>Add Extra Hours</button>`,
    onOpen(root, close, forceClose) {
      root.querySelector("[data-cancel]").addEventListener("click", close);
      root.querySelector("[data-save]").addEventListener("click", async (event) => {
        const hoursRaw = root.querySelector("[name=hours]").value;
        const form = {
          memberId: root.querySelector("[name=memberId]").value,
          date: root.querySelector("[name=date]").value,
          hours: parseNumber(hoursRaw, NaN),
          hoursRaw,
          reason: root.querySelector("[name=reason]").value.trim(),
        };
        const errors = validateExtraHoursPayload(form, { members: state.members || [] });
        if (firstError(errors)) {
          setFieldErrors(root, errors);
          return showToast(firstError(errors), "error");
        }
        const member = members.find((item) => item.id === form.memberId);
        setButtonLoading(event.currentTarget, true, "Adding extra hours...");
        try {
          await ExtraHoursService.add(form, member);
          showToast("Extra hours added.");
          forceClose();
        } catch (error) {
          handleError(error, "Unable to save changes. No changes were applied.");
        } finally {
          setButtonLoading(event.currentTarget, false);
        }
      });
    },
  });
}

void AUDIT_ACTIONS;
void getCurrentUser;
