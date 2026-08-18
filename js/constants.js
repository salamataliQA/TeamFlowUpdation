/** Shared enums, labels, and permission catalog. */

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  MEMBER: "member",
};

export const COMPANY_NAME = "Siznam & Co.";
export const PRODUCT_NAME = "Siznam & Co.";
export const PRODUCT_SUBTITLE = "Team Occupancy";
export const DASHBOARD_HEADING = "Siznam & Co. — Team Occupancy";
export const DEFAULT_DESIGNATION = "QA Engineer";

export const PAGE_TITLES = {
  dashboard: "Dashboard",
  team: "Team Members",
  projects: "Projects",
  assignments: "Assignments",
  reports: "Reports",
  extra: "Extra Hours",
  audit: "Audit Logs",
  settings: "Settings",
};

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"];
export const ASSIGNMENT_STATUSES = ["active", "paused", "completed", "cancelled"];
export const MEMBER_STATUSES = ["active", "inactive"];

export const OCCUPANCY_FILTERS = [
  { id: "all", label: "All" },
  { id: "full", label: "Fully Occupied" },
  { id: "available", label: "Available" },
  { id: "near", label: "Near Capacity" },
  { id: "overloaded", label: "Over Capacity" },
  { id: "none", label: "No Project" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

export const SORT_OPTIONS = [
  { id: "name", label: "Name" },
  { id: "occupied", label: "Occupied Hours" },
  { id: "available", label: "Available Hours" },
  { id: "utilization", label: "Utilization" },
  { id: "projects", label: "Number of Projects" },
];

export const REPORT_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "thisWeek", label: "This Week" },
  { id: "lastWeek", label: "Last Week" },
  { id: "thisMonth", label: "This Month" },
  { id: "custom", label: "Custom Range" },
];

export const PERMISSIONS = [
  {
    key: "createProject",
    label: "Create Projects",
    description: "Allow managers to create new projects.",
  },
  {
    key: "editProject",
    label: "Edit Projects",
    description: "Allow managers to update project details and status.",
  },
  {
    key: "archiveProject",
    label: "Archive Projects",
    description: "Allow managers to archive projects.",
  },
  {
    key: "assignMember",
    label: "Assign Work",
    description: "Allow managers to create date-based project assignments.",
  },
  {
    key: "editAssignmentHours",
    label: "Edit Assignment Hours",
    description: "Allow managers to change allocated hours.",
  },
  {
    key: "removeAssignment",
    label: "Remove Assignments",
    description: "Allow managers to pause or remove assignments.",
  },
  {
    key: "allowOverCapacity",
    label: "Allow Over Capacity",
    description: "Allow assignments that exceed a member's daily capacity.",
  },
  {
    key: "manageExtraHours",
    label: "Manage Extra Hours",
    description: "Allow managers to add or edit extra hours. Admin always can.",
  },
  {
    key: "viewAuditLogs",
    label: "View Audit Logs",
    description: "Allow managers to view the activity log.",
  },
  {
    key: "manageTeam",
    label: "Manage Team",
    description: "Allow managers to add or edit team members.",
  },
];

export const DEFAULT_MANAGER_PERMISSIONS = {
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
};

export const ADMIN_PERMISSIONS = Object.fromEntries(
  PERMISSIONS.map((item) => [item.key, true])
);

export const AUDIT_ACTIONS = {
  CREATE_MEMBER: "CREATE_MEMBER",
  UPDATE_MEMBER: "UPDATE_MEMBER",
  MEMBER_DEACTIVATED: "MEMBER_DEACTIVATED",
  MEMBER_REACTIVATED: "MEMBER_REACTIVATED",
  DISABLE_MEMBER: "MEMBER_DEACTIVATED",
  CREATE_PROJECT: "CREATE_PROJECT",
  UPDATE_PROJECT: "UPDATE_PROJECT",
  ARCHIVE_PROJECT: "ARCHIVE_PROJECT",
  CREATE_ASSIGNMENT: "CREATE_ASSIGNMENT",
  UPDATE_ASSIGNMENT: "UPDATE_ASSIGNMENT",
  REMOVE_ASSIGNMENT: "REMOVE_ASSIGNMENT",
  PAUSE_ASSIGNMENT: "PAUSE_ASSIGNMENT",
  RESUME_ASSIGNMENT: "RESUME_ASSIGNMENT",
  ADD_EXTRA_HOURS: "ADD_EXTRA_HOURS",
  UPDATE_EXTRA_HOURS: "UPDATE_EXTRA_HOURS",
  REMOVE_EXTRA_HOURS: "REMOVE_EXTRA_HOURS",
  CHANGE_PERMISSION: "PERMISSION_CHANGED",
  ROLE_CHANGED: "ROLE_CHANGED",
  CREATE_MANAGER: "CREATE_MANAGER",
  CREATE_MEMBER_USER: "CREATE_MEMBER_USER",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
};

export const MAX_HOURS = 24;
export const DEFAULT_CAPACITY = 8;
export const AUDIT_PAGE_SIZE = 25;

export const DEMO_CREDENTIALS = {
  admin: { email: "admin@siznam.local", password: "Siznam!admin" },
  manager: { email: "manager@siznam.local", password: "Siznam!manager" },
  member: { email: "member@siznam.local", password: "Siznam!member" },
};
