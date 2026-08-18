import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { AUDIT_ACTIONS, DEMO_CREDENTIALS } from "./constants.js";
import { auth, firebaseConfig, isFirebaseConfigured, BOOTSTRAP_ADMIN_EMAIL } from "./firebase-config.js";
import { store } from "./store.js";
import { pagePath } from "./utils.js";

const SESSION_KEY = "teamflow.session";
let currentUser = null;
const authListeners = new Set();

function emitUser() {
  authListeners.forEach((fn) => fn(currentUser));
}

function persistDemoSession(user) {
  const safe = { ...user };
  delete safe.password;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
}

function readDemoSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function onUserChange(callback) {
  authListeners.add(callback);
  callback(currentUser);
  return () => authListeners.delete(callback);
}

export class AccountInactiveError extends Error {
  constructor(message = "Account Inactive") {
    super(message);
    this.name = "AccountInactiveError";
    this.code = "account-inactive";
  }
}

export const ACCOUNT_INACTIVE_MESSAGE =
  "Your account has been deactivated by an administrator. Please contact your administrator if you believe this is a mistake.";

async function assertAccountActive(user) {
  if (!user) return;
  if (user.active === false) {
    throw new AccountInactiveError(ACCOUNT_INACTIVE_MESSAGE);
  }
  if (user.role !== "member" || !user.memberId) return;
  const member = await store.getMemberById(user.memberId);
  if (!member || member.active === false) {
    throw new AccountInactiveError(ACCOUNT_INACTIVE_MESSAGE);
  }
}

async function rejectInactiveSession() {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  if (isFirebaseConfigured && auth) await signOut(auth);
  window.location.href = `${pagePath("login.html")}?reason=inactive`;
}

export function getCurrentUser() {
  return currentUser;
}

export function isAdmin(user = currentUser) {
  return user?.role === "admin" && user?.active !== false;
}

export function isManager(user = currentUser) {
  return user?.role === "manager" && user?.active !== false;
}

export function isMember(user = currentUser) {
  return user?.role === "member" && user?.active !== false;
}

export function isStaff(user = currentUser) {
  return isAdmin(user) || isManager(user);
}

export async function logAudit(action, extra = {}) {
  if (!currentUser) return;
  try {
    await store.writeAudit({
      action,
      performedBy: currentUser.id,
      performedByName: currentUser.name || "Unknown",
      targetMemberId: extra.targetMemberId || "",
      targetMemberName: extra.targetMemberName || "",
      projectId: extra.projectId || "",
      projectName: extra.projectName || "",
      oldValue: extra.oldValue ?? null,
      newValue: extra.newValue ?? null,
    });
  } catch (error) {
    console.warn("Audit log failed", error);
  }
}

export async function login(email, password) {
  if (!isFirebaseConfigured) {
    const user = store.getDemoUser(email.trim(), password);
    if (!user) {
      throw new Error("Invalid email or password.");
    }
    const { password: _pw, ...safe } = user;
    await assertAccountActive(safe);
    currentUser = safe;
    persistDemoSession(safe);
    emitUser();
    await logAudit(AUDIT_ACTIONS.LOGIN);
    return currentUser;
  }

  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  let profile = await store.getUserById(credential.user.uid);
  if (
    !profile &&
    credential.user.email &&
    credential.user.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
  ) {
    await store.addUser(credential.user.uid, {
      name: credential.user.displayName || "Admin",
      email: credential.user.email,
      role: "admin",
      memberId: "",
      permissions: {},
      active: true,
    });
    profile = await store.getUserById(credential.user.uid);
  }
  if (!profile) {
    await signOut(auth);
    throw new Error("This account has not been provisioned. Ask an admin to create your Siznam & Co. profile.");
  }
  if (profile.active === false) {
    await signOut(auth);
    throw new AccountInactiveError(ACCOUNT_INACTIVE_MESSAGE);
  }
  const sessionUser = { ...profile, id: credential.user.uid, email: credential.user.email };
  try {
    await assertAccountActive(sessionUser);
  } catch (error) {
    await signOut(auth);
    throw error;
  }
  currentUser = sessionUser;
  emitUser();
  await logAudit(AUDIT_ACTIONS.LOGIN);
  return currentUser;
}

export async function logout() {
  await logAudit(AUDIT_ACTIONS.LOGOUT);
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  if (isFirebaseConfigured && auth) await signOut(auth);
  emitUser();
  window.location.href = pagePath("login.html");
}

export async function resetPassword(email) {
  if (!isFirebaseConfigured) {
    throw new Error(`Demo mode does not send email. Use ${DEMO_CREDENTIALS.admin.email} or ${DEMO_CREDENTIALS.manager.email}.`);
  }
  await sendPasswordResetEmail(auth, email.trim());
}

export async function createAuthUser(email, password, profile) {
  if (!isFirebaseConfigured) {
    return store.addUser({
      email,
      password,
      memberId: profile.memberId || "",
      ...profile,
    });
  }

  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await store.addUser(credential.user.uid, {
    email,
    memberId: profile.memberId || "",
    ...profile,
    active: true,
  });
  await signOut(secondaryAuth);
  return { id: credential.user.uid, email, ...profile };
}

export function requireAuth() {
  return new Promise((resolve) => {
    if (!isFirebaseConfigured) {
      currentUser = readDemoSession();
      emitUser();
      if (!currentUser) {
        window.location.href = pagePath("login.html");
        return;
      }
      assertAccountActive(currentUser).then(() => resolve(currentUser)).catch(() => rejectInactiveSession());
      return;
    }

    onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        currentUser = null;
        window.location.href = pagePath("login.html");
        return;
      }
      const profile = await store.getUserById(firebaseUser.uid);
      if (!profile || profile.active === false) {
        await rejectInactiveSession();
        return;
      }
      currentUser = { ...profile, id: firebaseUser.uid, email: firebaseUser.email };
      try {
        await assertAccountActive(currentUser);
      } catch {
        await rejectInactiveSession();
        return;
      }
      emitUser();
      resolve(currentUser);
    });
  });
}

export function redirectIfLoggedIn() {
  if (!isFirebaseConfigured) {
    if (readDemoSession()) window.location.href = pagePath("dashboard.html");
    return;
  }
  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) window.location.href = pagePath("dashboard.html");
  });
}

export async function requireStaff() {
  const user = await requireAuth();
  if (isMember(user)) {
    window.location.href = pagePath("dashboard.html");
    return new Promise(() => {});
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!isAdmin(user)) {
    window.location.href = pagePath("dashboard.html");
    return new Promise(() => {});
  }
  return user;
}
