import { AUDIT_ACTIONS } from "../constants.js";
import { logAudit } from "../auth.js";
import { assertCan } from "../permissions.js";
import { store } from "../store.js";
import { getActiveTeamMembers } from "../occupancy.js";
import { throwIfInvalid, validateMemberPayload } from "../validation.js";

async function syncLinkedLogins(memberId, active) {
  try {
    const users = await store.listUsers();
    await Promise.all(
      users
        .filter((user) => user.memberId === memberId)
        .map((user) => store.updateUser(user.id, { active }))
    );
  } catch {
    /* Managers may not list users; login still checks teamMembers.active. */
  }
}

export const TeamService = {
  subscribe(callback, options) {
    return store.subscribe(callback, options);
  },
  getActiveTeamMembers,
  async create(data) {
    assertCan("manageTeam");
    throwIfInvalid(validateMemberPayload(data, store.snapshot()?.members || []));
    const created = await store.addMember({
      designation: data.designation || "QA Engineer",
      active: data.active !== false,
      ...data,
    });
    await logAudit(AUDIT_ACTIONS.CREATE_MEMBER, {
      targetMemberId: created.id,
      targetMemberName: created.name,
      newValue: { name: created.name, designation: created.designation },
    });
    return created;
  },
  async update(member, data) {
    assertCan("manageTeam");
    throwIfInvalid(validateMemberPayload({ ...member, ...data }, store.snapshot()?.members || [], member.id));
    await store.updateMember(member.id, data);
    const becameInactive = data.active === false && member.active !== false;
    const becameActive = data.active === true && member.active === false;
    if (becameInactive || becameActive) {
      await syncLinkedLogins(member.id, Boolean(data.active));
      await logAudit(becameInactive ? AUDIT_ACTIONS.MEMBER_DEACTIVATED : AUDIT_ACTIONS.MEMBER_REACTIVATED, {
        targetMemberId: member.id,
        targetMemberName: data.name || member.name,
        oldValue: { active: member.active !== false },
        newValue: { active: Boolean(data.active) },
      });
      return;
    }
    await logAudit(AUDIT_ACTIONS.UPDATE_MEMBER, {
      targetMemberId: member.id,
      targetMemberName: data.name || member.name,
      oldValue: { name: member.name, designation: member.designation, active: member.active },
      newValue: data,
    });
  },
  async setActive(member, active) {
    return this.update(member, { active: Boolean(active) });
  },
};
