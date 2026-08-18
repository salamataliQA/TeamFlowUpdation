import { addDays, daysInRange, monthRange, todayKey, weekRange } from "../utils.js";
import {
  calculateDailyOccupiedHours,
  calculateExtraHours,
  calculateOverCapacityHours,
  calculateUtilization,
  computeMemberStats,
  getActiveTeamMembers,
  isActiveMember,
} from "../occupancy.js";

function inDateRange(date, fromKey, toKey) {
  return Boolean(date) && date >= fromKey && date <= toKey;
}

export function reportRange(preset, fromKey, toKey, anchor = todayKey()) {
  if (preset === "today") return { from: anchor, to: anchor };
  if (preset === "yesterday") {
    const day = addDays(anchor, -1);
    return { from: day, to: day };
  }
  if (preset === "thisWeek") {
    const week = weekRange(anchor);
    return { from: week.start, to: week.end };
  }
  if (preset === "lastWeek") {
    const prev = addDays(weekRange(anchor).start, -1);
    const week = weekRange(prev);
    return { from: week.start, to: week.end };
  }
  if (preset === "thisMonth") {
    const month = monthRange(anchor);
    return { from: month.start, to: month.end };
  }
  return { from: fromKey || anchor, to: toKey || anchor };
}

export function validateReportRange(fromKey, toKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) {
    return "Choose a valid start and end date.";
  }
  if (fromKey > toKey) return "Start date cannot be after end date.";
  return "";
}

function scopedRecords(memberId, assignments, extraHours, fromKey, toKey) {
  const assignmentsInRange = assignments.filter(
    (item) => (!memberId || item.memberId === memberId) && inDateRange(item.date, fromKey, toKey)
  );
  const extraInRange = extraHours.filter(
    (item) => (!memberId || item.memberId === memberId) && inDateRange(item.date, fromKey, toKey)
  );
  return { assignmentsInRange, extraInRange };
}

export function memberDailyReport(member, assignments, extraHours, fromKey, toKey) {
  const { assignmentsInRange, extraInRange } = scopedRecords(member.id, assignments, extraHours, fromKey, toKey);
  const days = daysInRange(fromKey, toKey).reverse();
  const rows = days.map((date) => {
    const stats = computeMemberStats(member, assignmentsInRange, extraInRange, date);
    const projects = stats.assignments.map((item) => ({
      assignment: item,
      hours: Number(item.allocatedHours || 0),
      projectId: item.projectId,
    }));
    return {
      date,
      occupied: stats.occupied,
      extra: stats.extra,
      totalWork: stats.totalWork,
      capacity: stats.capacity,
      available: stats.available,
      overCapacity: stats.overCapacity,
      utilization: stats.utilization,
      status: stats.status,
      projects,
      hasActivity: stats.occupied > 0 || stats.extra > 0 || projects.length > 0,
    };
  });
  const occupied = rows.reduce((sum, row) => sum + row.occupied, 0);
  const extra = rows.reduce((sum, row) => sum + row.extra, 0);
  return {
    member,
    fromKey,
    toKey,
    totalOccupied: occupied,
    extraHours: extra,
    averageDaily: rows.length ? Math.round(((occupied + extra) / rows.length) * 10) / 10 : 0,
    overCapacityDays: rows.filter((row) => row.overCapacity > 0).length,
    hasActivity: assignmentsInRange.length > 0 || extraInRange.length > 0,
    days: rows,
  };
}

export function getMemberReport(member, assignments, extraHours, fromKey, toKey) {
  return memberDailyReport(member, assignments, extraHours, fromKey, toKey);
}

export function getAllMembersReport(members, assignments, extraHours, fromKey, toKey, { includeInactive = false } = {}) {
  const roster = includeInactive
    ? members.filter((member) => {
        if (isActiveMember(member)) return true;
        const scoped = scopedRecords(member.id, assignments, extraHours, fromKey, toKey);
        return scoped.assignmentsInRange.length > 0 || scoped.extraInRange.length > 0;
      })
    : getActiveTeamMembers(members);
  return roster.map((member) => getMemberReport(member, assignments, extraHours, fromKey, toKey));
}

export function getDailyOccupancy(member, assignments, extraHours, dateKey) {
  return computeMemberStats(member, assignments, extraHours, dateKey);
}

export function getProjectBreakdown(member, assignments, extraHours, fromKey, toKey) {
  return getMemberReport(member, assignments, extraHours, fromKey, toKey).days.map((row) => ({
    date: row.date,
    projects: row.projects,
  }));
}

export function getExtraHoursReport(memberId, extraHours, fromKey, toKey) {
  return extraHours.filter((item) => (!memberId || item.memberId === memberId) && inDateRange(item.date, fromKey, toKey));
}

export function getWeeklySummary(members, extraHours, dateKey) {
  const { start, end } = weekRange(dateKey);
  const totals = {};
  extraHours.forEach((row) => {
    if (row.date >= start && row.date <= end) {
      totals[row.memberId] = (totals[row.memberId] || 0) + Number(row.hours || 0);
    }
  });
  return getActiveTeamMembers(members)
    .map((member) => ({ member, hours: totals[member.id] || 0 }))
    .sort((a, b) => b.hours - a.hours);
}

export function reportMembersForDropdown(members, assignments, extraHours, includeInactive) {
  const active = getActiveTeamMembers(members).sort((a, b) => a.name.localeCompare(b.name));
  if (!includeInactive) return { active, inactive: [] };
  const inactive = members
    .filter((member) => !isActiveMember(member))
    .filter((member) => {
      const scoped = scopedRecords(member.id, assignments, extraHours, "0000-01-01", "9999-12-31");
      return scoped.assignmentsInRange.length > 0 || scoped.extraInRange.length > 0;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { active, inactive };
}

export const ReportService = {
  reportRange,
  validateReportRange,
  memberDailyReport,
  getMemberReport,
  getAllMembersReport,
  getDailyOccupancy,
  getProjectBreakdown,
  getExtraHoursReport,
  getWeeklySummary,
  reportMembersForDropdown,
  occupiedOnDate: calculateDailyOccupiedHours,
  extraOnDate: calculateExtraHours,
  overCapacity: calculateOverCapacityHours,
  utilization: calculateUtilization,
};
