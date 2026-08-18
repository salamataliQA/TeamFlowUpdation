/** Date-based occupancy. Hours are never stored on the member document. */

import { DEFAULT_CAPACITY } from "./constants.js";
import { addDays, roundHours, todayKey, weekRange } from "./utils.js";

export function isCountableStatus(status) {
  return status === "active";
}

export function isOpenAssignment(status) {
  return status !== "cancelled" && status !== "removed";
}

export function assignmentDateKey(assignment) {
  if (assignment?.date && /^\d{4}-\d{2}-\d{2}$/.test(assignment.date)) return assignment.date;
  return null;
}

export function calculateDailyOccupiedHours(memberId, assignments = [], dateKey = todayKey()) {
  return roundHours(
    assignments
      .filter(
        (item) =>
          item.memberId === memberId &&
          isCountableStatus(item.status) &&
          assignmentDateKey(item) === dateKey
      )
      .reduce((sum, item) => sum + Number(item.allocatedHours || 0), 0)
  );
}

export function calculateExtraHours(memberId, extraHours = [], dateKey = todayKey()) {
  return roundHours(
    extraHours
      .filter((item) => item.memberId === memberId && item.date === dateKey)
      .reduce((sum, item) => sum + Number(item.hours || 0), 0)
  );
}

export function calculateAvailableHours(capacity, occupied) {
  return roundHours(Math.max(Number(capacity) - Number(occupied), 0));
}

export function calculateOverCapacityHours(capacity, occupiedOrTotal) {
  return roundHours(Math.max(Number(occupiedOrTotal) - Number(capacity), 0));
}

export function calculateUtilization(occupied, capacity) {
  const cap = Number(capacity) || 0;
  return cap > 0 ? roundHours((Number(occupied) / cap) * 100) : 0;
}

export function calculateWeeklyExtraHours(extraHours = [], dateKey = todayKey(), memberId = "") {
  const { start, end } = weekRange(dateKey);
  return roundHours(
    extraHours
      .filter(
        (item) =>
          (!memberId || item.memberId === memberId) &&
          item.date >= start &&
          item.date <= end
      )
      .reduce((sum, item) => sum + Number(item.hours || 0), 0)
  );
}

export function calculateProjectHours(assignments = [], projectId, dateKey) {
  return roundHours(
    assignments
      .filter(
        (item) =>
          item.projectId === projectId &&
          isCountableStatus(item.status) &&
          (!dateKey || assignmentDateKey(item) === dateKey)
      )
      .reduce((sum, item) => sum + Number(item.allocatedHours || 0), 0)
  );
}

export function isActiveMember(member) {
  return Boolean(member) && member.active !== false;
}

export function getActiveTeamMembers(members = []) {
  return members.filter(isActiveMember);
}

export function occupancyStatus(occupied, capacity, projectCount, memberActive = true, totalWork = occupied) {
  if (!memberActive) return "inactive";
  if (!projectCount && totalWork <= 0) return "none";
  if (totalWork > capacity) return "over";
  if (occupied === capacity) return "full";
  if (occupied >= capacity * 0.8) return "near";
  return "available";
}

export function occupancyLabel(status) {
  return {
    available: "Available",
    near: "Near Capacity",
    full: "Fully Occupied",
    over: "Over Capacity",
    overloaded: "Over Capacity",
    none: "No Project",
    inactive: "Inactive",
  }[status] || "Unknown";
}

export function utilizationTone(percent) {
  if (percent > 100) return "danger";
  if (percent >= 100) return "warning";
  if (percent >= 80) return "warning";
  return "success";
}

export function computeMemberStats(member, assignments = [], extraHours = [], dateKey = todayKey()) {
  const capacity = Number(member.weeklyCapacity ?? DEFAULT_CAPACITY) || DEFAULT_CAPACITY;
  const dayAssignments = assignments.filter(
    (item) => item.memberId === member.id && assignmentDateKey(item) === dateKey && isOpenAssignment(item.status)
  );
  const active = dayAssignments.filter((item) => isCountableStatus(item.status));
  const occupied = calculateDailyOccupiedHours(member.id, assignments, dateKey);
  const extra = calculateExtraHours(member.id, extraHours, dateKey);
  const totalWork = roundHours(occupied + extra);
  const available = calculateAvailableHours(capacity, occupied);
  const overCapacity = calculateOverCapacityHours(capacity, totalWork);
  const utilization = calculateUtilization(totalWork, capacity);
  const status = occupancyStatus(occupied, capacity, active.length, member.active !== false, totalWork);

  return {
    member,
    capacity,
    occupied,
    extra,
    totalWork,
    available,
    overCapacity,
    utilization,
    projectCount: active.length,
    assignments: active,
    allDayAssignments: dayAssignments,
    status,
    tone: utilizationTone(utilization),
    dateKey,
  };
}

export function computeAllMemberStats(members = [], assignments = [], extraHours = [], dateKey = todayKey()) {
  return members.map((member) => computeMemberStats(member, assignments, extraHours, dateKey));
}

export function computeProjectStats(project, assignments = [], members = [], dateKey = "") {
  const relevant = assignments.filter(
    (item) => item.projectId === project.id && isOpenAssignment(item.status) && (!dateKey || assignmentDateKey(item) === dateKey)
  );
  const active = relevant.filter((item) => isCountableStatus(item.status));
  const allocatedHours = roundHours(
    active.reduce((sum, item) => sum + Number(item.allocatedHours || 0), 0)
  );
  const memberIds = new Set(active.map((item) => item.memberId));
  const assignedMembers = [...memberIds]
    .map((id) => {
      const member = members.find((item) => item.id === id);
      const assignment = active.find((item) => item.memberId === id);
      return member
        ? {
            ...member,
            allocatedHours: Number(assignment?.allocatedHours || 0),
            assignmentId: assignment?.id,
            assignmentStatus: assignment?.status,
            assignmentDate: assignment?.date,
          }
        : null;
    })
    .filter(Boolean);

  return {
    project,
    allocatedHours,
    memberCount: assignedMembers.length,
    assignedMembers,
    assignments: relevant,
  };
}

export function computeKpis(members = [], projects = [], assignments = [], extraHours = [], dateKey = todayKey()) {
  const activeMembers = getActiveTeamMembers(members);
  const stats = computeAllMemberStats(activeMembers, assignments, extraHours, dateKey);
  const fullyOccupied = stats.filter((item) => item.status === "full").length;
  const overCapacityCount = stats.filter((item) => item.overCapacity > 0).length;
  const availableCapacity = roundHours(stats.reduce((sum, item) => sum + item.available, 0));
  const allocatedHours = roundHours(stats.reduce((sum, item) => sum + item.occupied, 0));
  const activeIds = new Set(activeMembers.map((item) => item.id));
  const operationalExtra = extraHours.filter((row) => activeIds.has(row.memberId));
  const extraThisWeek = calculateWeeklyExtraHours(operationalExtra, dateKey);
  const extraLastWeek = calculateWeeklyExtraHours(operationalExtra, addDays(weekRange(dateKey).start, -1));
  const extraDelta =
    extraLastWeek > 0 ? roundHours(((extraThisWeek - extraLastWeek) / extraLastWeek) * 100) : extraThisWeek > 0 ? 100 : 0;
  const activeProjects = new Set(
    assignments
      .filter((item) => isCountableStatus(item.status) && assignmentDateKey(item) === dateKey)
      .map((item) => item.projectId)
  ).size;

  return {
    totalMembers: activeMembers.length,
    fullyOccupied,
    fullyOccupiedPct:
      activeMembers.length > 0 ? roundHours((fullyOccupied / activeMembers.length) * 100) : 0,
    availableCapacity,
    overloaded: overCapacityCount,
    overCapacityCount,
    activeProjects,
    allocatedHours,
    extraThisWeek,
    extraLastWeek,
    extraDelta,
  };
}

export function matchesOccupancyFilter(stats, filter) {
  const active = isActiveMember(stats.member);
  if (!filter || filter === "all") return active;
  if (filter === "active") return active;
  if (filter === "inactive") return !active;
  if (!active) return false;
  if (filter === "overloaded") return stats.status === "over";
  return stats.status === filter;
}

export function sortMemberStats(stats, sortKey = "name") {
  const copy = [...stats];
  copy.sort((a, b) => {
    switch (sortKey) {
      case "occupied":
        return b.occupied - a.occupied || a.member.name.localeCompare(b.member.name);
      case "available":
        return b.available - a.available || a.member.name.localeCompare(b.member.name);
      case "utilization":
        return b.utilization - a.utilization || a.member.name.localeCompare(b.member.name);
      case "projects":
        return b.projectCount - a.projectCount || a.member.name.localeCompare(b.member.name);
      default:
        return a.member.name.localeCompare(b.member.name);
    }
  });
  return copy;
}

export const OccupancyService = {
  calculateDailyOccupiedHours,
  calculateAvailableHours,
  calculateOverCapacityHours,
  calculateUtilization,
  calculateExtraHours,
  calculateWeeklyExtraHours,
  calculateProjectHours,
  computeMemberStats,
  computeAllMemberStats,
  computeKpis,
  getActiveTeamMembers,
  isActiveMember,
};
