/** AuthService — session, login, and route guards. Page Objects should not talk to Firebase Auth directly. */

export {
  ACCOUNT_INACTIVE_MESSAGE,
  AccountInactiveError,
  createAuthUser,
  getCurrentUser,
  isAdmin,
  isMember,
  logAudit,
  login,
  logout,
  onUserChange,
  redirectIfLoggedIn,
  requireAdmin,
  requireAuth,
  requireStaff,
  resetPassword,
} from "../auth.js";
