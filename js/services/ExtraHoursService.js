import { AUDIT_ACTIONS } from "../constants.js";
import { getCurrentUser, isMember, logAudit } from "../auth.js";
import { canManageExtraHours } from "../permissions.js";
import { store } from "../store.js";
import { throwIfInvalid, validateExtraHoursPayload } from "../validation.js";

function assertExtraHoursWrite() {
  if (isMember() || !canManageExtraHours()) {
    const error = new Error("You do not have permission to manage extra hours.");
    error.code = "permission-denied";
    throw error;
  }
}

export const ExtraHoursService = {
  async add(data, member) {
    assertExtraHoursWrite();
    throwIfInvalid(validateExtraHoursPayload(data, { members: store.snapshot()?.members || [] }));
    const user = getCurrentUser();
    const { hoursRaw, ...payload } = data;
    const created = await store.addExtraHours({
      ...payload,
      addedBy: user.id,
      addedByName: user.name,
    });
    await logAudit(AUDIT_ACTIONS.ADD_EXTRA_HOURS, {
      targetMemberId: member?.id || data.memberId,
      targetMemberName: member?.name || "",
      newValue: { hours: data.hours, reason: data.reason, date: data.date },
    });
    return created;
  },
  async update(record, data, member) {
    assertExtraHoursWrite();
    throwIfInvalid(
      validateExtraHoursPayload(
        {
          memberId: data.memberId ?? record.memberId,
          date: data.date ?? record.date,
          hours: data.hours ?? record.hours,
          reason: data.reason ?? record.reason,
        },
        { members: store.snapshot()?.members || [] }
      )
    );
    await store.updateExtraHours(record.id, {
      memberId: data.memberId ?? record.memberId,
      date: data.date ?? record.date,
      hours: data.hours ?? record.hours,
      reason: data.reason ?? record.reason,
    });
    await logAudit(AUDIT_ACTIONS.UPDATE_EXTRA_HOURS, {
      targetMemberId: member?.id || record.memberId,
      targetMemberName: member?.name || "",
      oldValue: { hours: record.hours, reason: record.reason, date: record.date },
      newValue: data,
    });
  },
  async remove(record, member) {
    assertExtraHoursWrite();
    await store.removeExtraHours(record.id);
    await logAudit(AUDIT_ACTIONS.REMOVE_EXTRA_HOURS, {
      targetMemberId: member?.id || record.memberId,
      targetMemberName: member?.name || "",
      oldValue: { hours: record.hours, reason: record.reason, date: record.date },
      newValue: null,
    });
  },
};
