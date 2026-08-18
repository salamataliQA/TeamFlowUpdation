import { AUDIT_ACTIONS } from "../constants.js";
import { getCurrentUser, isMember, logAudit } from "../auth.js";
import { assertCan, assertStaff, canAssignWork } from "../permissions.js";
import { store } from "../store.js";
import { throwIfInvalid, validateAssignmentPayload } from "../validation.js";

function denyMembers() {
  if (isMember()) {
    const error = new Error("Members cannot change assignments.");
    error.code = "permission-denied";
    throw error;
  }
}

function currentLists() {
  const snap = store.snapshot() || {};
  return {
    members: snap.members || [],
    projects: snap.projects || [],
    assignments: snap.assignments || [],
  };
}

export const AssignmentService = {
  async create(data, meta = {}) {
    denyMembers();
    assertStaff();
    if (!canAssignWork()) assertCan("assignMember");
    throwIfInvalid(validateAssignmentPayload(data, { ...currentLists() }));
    const user = getCurrentUser();
    const { allocatedHoursRaw, ...payload } = data;
    const created = await store.addAssignment({
      ...payload,
      assignedBy: user.id,
      assignedByName: user.name,
      legacy: false,
    });
    await logAudit(AUDIT_ACTIONS.CREATE_ASSIGNMENT, {
      targetMemberId: meta.member?.id || data.memberId,
      targetMemberName: meta.member?.name || "",
      projectId: meta.project?.id || data.projectId,
      projectName: meta.project?.name || "",
      newValue: { allocatedHours: data.allocatedHours, status: data.status, date: data.date },
    });
    return created;
  },
  async update(assignment, data, meta = {}) {
    denyMembers();
    assertCan("editAssignmentHours");
    throwIfInvalid(
      validateAssignmentPayload(
        {
          memberId: data.memberId ?? assignment.memberId,
          projectId: data.projectId ?? assignment.projectId,
          date: data.date ?? assignment.date,
          allocatedHours: data.allocatedHours ?? assignment.allocatedHours,
          status: data.status ?? assignment.status,
        },
        { ...currentLists(), existingId: assignment.id }
      )
    );
    await store.updateAssignment(assignment.id, {
      memberId: data.memberId,
      projectId: data.projectId,
      date: data.date,
      allocatedHours: data.allocatedHours,
      status: data.status,
      notes: data.notes,
    });
    await logAudit(AUDIT_ACTIONS.UPDATE_ASSIGNMENT, {
      targetMemberId: meta.member?.id || assignment.memberId,
      targetMemberName: meta.member?.name || "",
      projectId: meta.project?.id || assignment.projectId,
      projectName: meta.project?.name || "",
      oldValue: { allocatedHours: assignment.allocatedHours, status: assignment.status, date: assignment.date },
      newValue: { allocatedHours: data.allocatedHours ?? assignment.allocatedHours, status: data.status ?? assignment.status, date: data.date ?? assignment.date },
    });
  },
  async setStatus(assignment, status, meta = {}) {
    denyMembers();
    if (status === "cancelled" || status === "removed") assertCan("removeAssignment");
    const next = status === "removed" ? "cancelled" : status;
    await store.updateAssignment(assignment.id, { status: next });
    const action =
      next === "paused"
        ? AUDIT_ACTIONS.PAUSE_ASSIGNMENT
        : next === "active"
          ? AUDIT_ACTIONS.RESUME_ASSIGNMENT
          : AUDIT_ACTIONS.REMOVE_ASSIGNMENT;
    await logAudit(action, {
      targetMemberId: meta.member?.id || assignment.memberId,
      targetMemberName: meta.member?.name || "",
      projectId: meta.project?.id || assignment.projectId,
      projectName: meta.project?.name || "",
      oldValue: { allocatedHours: assignment.allocatedHours, status: assignment.status, date: assignment.date },
      newValue: { allocatedHours: assignment.allocatedHours, status: next, date: assignment.date },
    });
  },
};
