/** Demo dataset: Excel occupancy snapshot applied to today's local date. */

import { DEFAULT_DESIGNATION, DEMO_CREDENTIALS } from "./constants.js";
import { addDays, todayKey, weekRange } from "./utils.js";

export const DEMO_USERS = [
  {
    id: "demo-admin",
    name: "Ahmed",
    email: DEMO_CREDENTIALS.admin.email,
    password: DEMO_CREDENTIALS.admin.password,
    role: "admin",
    permissions: {},
    memberId: "",
    active: true,
    createdAt: "2026-01-12T09:00:00.000Z",
    updatedAt: "2026-08-18T08:00:00.000Z",
  },
  {
    id: "demo-manager",
    name: "Sara Khan",
    email: DEMO_CREDENTIALS.manager.email,
    password: DEMO_CREDENTIALS.manager.password,
    role: "manager",
    permissions: {
      createProject: true,
      editProject: true,
      archiveProject: false,
      assignMember: true,
      editAssignmentHours: true,
      removeAssignment: true,
      allowOverCapacity: true,
      manageExtraHours: false,
      viewAuditLogs: true,
      manageTeam: false,
    },
    memberId: "",
    active: true,
    createdAt: "2026-02-03T10:15:00.000Z",
    updatedAt: "2026-08-18T08:00:00.000Z",
  },
  {
    id: "demo-member",
    name: "Abdul Rafay",
    email: DEMO_CREDENTIALS.member.email,
    password: DEMO_CREDENTIALS.member.password,
    role: "member",
    permissions: {},
    memberId: "m-abdul-rafay",
    active: true,
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-08-18T08:00:00.000Z",
  },
];

const MEMBER_NAMES = [
  ["m-moiz", "Moiz", "moiz@siznam.co"],
  ["m-haseeb-akram", "Haseeb Akram", "haseeb.akram@siznam.co"],
  ["m-salamat-ali", "Salamat Ali", "salamat.ali@siznam.co"],
  ["m-waseem-akram", "Waseem Akram", "waseem.akram@siznam.co"],
  ["m-haseeb-ul-hassan", "Haseeb ul Hassan", "haseeb.hassan@siznam.co"],
  ["m-dayyan", "Dayyan", "dayyan@siznam.co"],
  ["m-ahsan", "Ahsan", "ahsan@siznam.co"],
  ["m-abdul-rafay", "Abdul Rafay", "abdul.rafay@siznam.co"],
  ["m-sabhie-sabir", "Sabhie Sabir", "sabhie.sabir@siznam.co"],
  ["m-bilal", "Bilal", "bilal@siznam.co"],
  ["m-ali-raza", "Ali Raza", "ali.raza@siznam.co"],
  ["m-junaid", "Junaid", "junaid@siznam.co"],
  ["m-hamza-rana", "Hamza Rana", "hamza.rana@siznam.co"],
  ["m-awais-aslam", "Awais Aslam", "awais.aslam@siznam.co"],
  ["m-basit-gouri", "Basit Gouri", "basit.gouri@siznam.co"],
  ["m-mehtab-ahmad", "Mehtab Ahmad", "mehtab.ahmad@siznam.co"],
  ["m-umer", "Umer", "umer@siznam.co"],
  ["m-faizan-aziz", "Faizan Aziz", "faizan.aziz@siznam.co"],
  ["m-arslan-rashid", "Arslan Rashid", "arslan.rashid@siznam.co"],
];

export function buildMembers() {
  return MEMBER_NAMES.map(([id, name, email], index) => ({
    id,
    name,
    email,
    designation: DEFAULT_DESIGNATION,
    department: "Quality",
    weeklyCapacity: 8,
    active: true,
    avatar: "",
    createdAt: `2026-03-${String((index % 27) + 1).padStart(2, "0")}T09:00:00.000Z`,
    updatedAt: "2026-08-18T08:30:00.000Z",
  }));
}

export const DEMO_PROJECTS = [
  { id: "p-creatingly", name: "Creatingly", color: "#16A34A", status: "active" },
  { id: "p-engagement-agents", name: "Engagement Agents", color: "#2563EB", status: "active" },
  { id: "p-bluepro", name: "BluePro", color: "#7C3AED", status: "active" },
  { id: "p-render-analytics", name: "Render Analytics", color: "#0EA5E9", status: "active" },
  { id: "p-blend-engine", name: "Blend Engine", color: "#F59E0B", status: "active" },
  { id: "p-inbox-superpilot", name: "Inbox SuperPilot", color: "#EC4899", status: "active" },
  { id: "p-mental-happy", name: "Mental Happy", color: "#14B8A6", status: "active" },
  { id: "p-magwitch", name: "Magwitch", color: "#4F46E5", status: "active" },
  { id: "p-shuttle-health", name: "Shuttle Health", color: "#059669", status: "active" },
  { id: "p-red-volcano", name: "Red Volcano", color: "#DC2626", status: "active" },
  { id: "p-animal-booking", name: "Animal Booking", color: "#9333EA", status: "paused" },
  { id: "p-hardline", name: "Hardline", color: "#EA580C", status: "active" },
  { id: "p-sharecase", name: "ShareCase", color: "#0284C7", status: "active" },
  { id: "p-chess", name: "Chess", color: "#65A30D", status: "active" },
  { id: "p-teachally", name: "Teachally", color: "#DB2777", status: "active" },
  { id: "p-sio", name: "SIO", color: "#0F766E", status: "active" },
  { id: "p-meridian", name: "Meridian", color: "#1D4ED8", status: "active" },
  { id: "p-florals", name: "Florals", color: "#E11D48", status: "active" },
  { id: "p-scavenger", name: "Scavenger", color: "#CA8A04", status: "active" },
  { id: "p-kobiton", name: "Kobiton", color: "#7C3AED", status: "active" },
  { id: "p-grip-facility", name: "Grip Facility", color: "#2563EB", status: "active" },
  { id: "p-barbarians", name: "Barbarians", color: "#B45309", status: "active" },
].map((project, index) => ({
  ...project,
  description: `${project.name} engagement tracked for Siznam & Co.`,
  createdBy: "demo-admin",
  createdAt: `2026-04-${String((index % 27) + 1).padStart(2, "0")}T11:00:00.000Z`,
  updatedAt: "2026-08-18T09:00:00.000Z",
}));

function assignment(id, memberId, projectId, allocatedHours, status, date) {
  return {
    id,
    memberId,
    projectId,
    allocatedHours,
    status,
    date,
    assignedBy: "demo-admin",
    assignedByName: "Ahmed",
    createdAt: `${date}T09:00:00.000Z`,
    assignedAt: `${date}T09:00:00.000Z`,
    updatedAt: `${date}T09:00:00.000Z`,
    notes: "",
    legacy: false,
  };
}

export function buildAssignments(today) {
  const yesterday = addDays(today, -1);
  return [
    assignment("a-1", "m-haseeb-akram", "p-creatingly", 8, "active", today),
    assignment("a-2", "m-salamat-ali", "p-engagement-agents", 8, "active", today),
    assignment("a-3", "m-waseem-akram", "p-bluepro", 8, "active", today),
    assignment("a-4", "m-haseeb-ul-hassan", "p-render-analytics", 2, "active", today),
    assignment("a-5", "m-haseeb-ul-hassan", "p-blend-engine", 2, "active", today),
    assignment("a-6", "m-haseeb-ul-hassan", "p-inbox-superpilot", 1, "active", today),
    assignment("a-7", "m-dayyan", "p-mental-happy", 3, "active", today),
    assignment("a-8", "m-ahsan", "p-magwitch", 8, "active", today),
    assignment("a-9", "m-abdul-rafay", "p-magwitch", 8, "active", today),
    assignment("a-9b", "m-abdul-rafay", "p-magwitch", 6, "active", yesterday),
    assignment("a-9c", "m-abdul-rafay", "p-bluepro", 4, "active", yesterday),
    assignment("a-10", "m-sabhie-sabir", "p-shuttle-health", 8, "active", today),
    assignment("a-11", "m-bilal", "p-red-volcano", 8, "active", today),
    assignment("a-12", "m-ali-raza", "p-animal-booking", 8, "paused", today),
    assignment("a-13", "m-ali-raza", "p-engagement-agents", 5, "active", today),
    assignment("a-14", "m-ali-raza", "p-hardline", 3, "active", today),
    assignment("a-15", "m-junaid", "p-sharecase", 6, "active", today),
    assignment("a-16", "m-junaid", "p-chess", 2, "active", today),
    assignment("a-17", "m-hamza-rana", "p-teachally", 8, "active", today),
    assignment("a-18", "m-awais-aslam", "p-sio", 5, "active", today),
    assignment("a-19", "m-awais-aslam", "p-meridian", 5, "active", today),
    assignment("a-20", "m-basit-gouri", "p-florals", 8, "active", today),
    assignment("a-21", "m-mehtab-ahmad", "p-bluepro", 8, "active", today),
    assignment("a-22", "m-umer", "p-scavenger", 5, "active", today),
    assignment("a-23", "m-faizan-aziz", "p-kobiton", 2, "active", today),
    assignment("a-24", "m-faizan-aziz", "p-grip-facility", 2, "active", today),
    assignment("a-25", "m-faizan-aziz", "p-barbarians", 5, "active", today),
  ];
}

function extra(id, memberId, hours, date, reason) {
  return {
    id,
    memberId,
    hours,
    date,
    reason,
    addedBy: "demo-admin",
    addedByName: "Ahmed",
    createdAt: `${date}T16:00:00.000Z`,
  };
}

export function buildExtraHours(today) {
  const yesterday = addDays(today, -1);
  const lastWeek = addDays(weekRange(today).start, -2);
  return [
    extra("e-1", "m-abdul-rafay", 2, today, "Production support"),
    extra("e-2", "m-abdul-rafay", 2, yesterday, "Urgent task"),
    extra("e-3", "m-ali-raza", 2, today, "Release support"),
    extra("e-4", "m-ahsan", 4, today, "Client demo prep"),
    extra("e-5", "m-junaid", 3, today, "Hotfix"),
    extra("e-6", "m-faizan-aziz", 1, yesterday, "After-hours QA"),
    extra("e-7", "m-awais-aslam", 2, lastWeek, "Weekend coverage"),
  ];
}

export function buildSettings() {
  return {
    id: "app",
    companyName: "Siznam & Co.",
    defaultDailyCapacity: 8,
    defaultManagerPermissions: {
      createProject: true,
      editProject: true,
      archiveProject: false,
      assignMember: true,
      editAssignmentHours: true,
      removeAssignment: true,
      allowOverCapacity: true,
      manageExtraHours: false,
      viewAuditLogs: true,
      manageTeam: false,
    },
    updatedAt: "2026-08-18T08:00:00.000Z",
    updatedBy: "demo-admin",
  };
}

export function buildAuditLogs(today) {
  return [
    {
      id: "log-1",
      action: "CREATE_ASSIGNMENT",
      performedBy: "demo-admin",
      performedByName: "Ahmed",
      targetMemberId: "m-abdul-rafay",
      targetMemberName: "Abdul Rafay",
      projectId: "p-magwitch",
      projectName: "Magwitch",
      oldValue: null,
      newValue: { allocatedHours: 8, status: "active", date: today },
      timestamp: `${today}T10:42:00.000Z`,
    },
    {
      id: "log-2",
      action: "ADD_EXTRA_HOURS",
      performedBy: "demo-admin",
      performedByName: "Ahmed",
      targetMemberId: "m-abdul-rafay",
      targetMemberName: "Abdul Rafay",
      projectId: "",
      projectName: "",
      oldValue: null,
      newValue: { hours: 2, reason: "Production support", date: today },
      timestamp: `${today}T16:05:00.000Z`,
    },
    {
      id: "log-3",
      action: "PAUSE_ASSIGNMENT",
      performedBy: "demo-admin",
      performedByName: "Ahmed",
      targetMemberId: "m-ali-raza",
      targetMemberName: "Ali Raza",
      projectId: "p-animal-booking",
      projectName: "Animal Booking",
      oldValue: { allocatedHours: 8, status: "active" },
      newValue: { allocatedHours: 8, status: "paused" },
      timestamp: `${today}T11:12:00.000Z`,
    },
  ];
}

export function createDemoState() {
  const today = todayKey();
  return {
    users: structuredClone(DEMO_USERS),
    members: buildMembers(),
    projects: structuredClone(DEMO_PROJECTS),
    assignments: buildAssignments(today),
    extraHours: buildExtraHours(today),
    settings: buildSettings(),
    auditLogs: buildAuditLogs(today),
  };
}
