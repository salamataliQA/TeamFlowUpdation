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
import { pagePath, withTimeout } from "./utils.js";

const AUTH_READY_TIMEOUT_MS = 10000;
const PROFILE_TIMEOUT_MS = 10000;

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

async function ensureUserProfile(firebaseUser) {
  let profile = await store.getUserById(firebaseUser.uid);
  if (
    !profile &&
    firebaseUser.email &&
    firebaseUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
  ) {
    try {
      await store.addUser(firebaseUser.uid, {
        name: firebaseUser.displayName || "Admin",
        email: firebaseUser.email,
        role: "admin",
        memberId: "",
        permissions: {},
        active: true,
      });
      profile = await store.getUserById(firebaseUser.uid);
    } catch (error) {
      console.error("Unable to create admin profile", error);
      throw Object.assign(new Error("Unable to create your admin profile. Create a Firestore database, deploy security rules, and add this site to Authorized domains."), {
        code: error.code || "profile-create-failed",
        userSafe: true,
      });
    }
  }
  return profile;
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
  const profile = await ensureUserProfile(credential.user);
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

async function waitForFirebaseUser() {
  const ready = typeof auth.authStateReady === "function"
    ? auth.authStateReady()
    : new Promise((resolve, reject) => {
        const unsub = onAuthStateChanged(
          auth,
          () => {
            unsub();
            resolve();
          },
          reject
        );
      });
  await withTimeout(
    ready,
    AUTH_READY_TIMEOUT_MS,
    "Firebase Auth did not respond. Add team-flow-updation.vercel.app under Authentication → Settings → Authorized domains."
  );
  return auth.currentUser;
}

export async function requireAuth() {
  if (!isFirebaseConfigured) {
    currentUser = readDemoSession();
    emitUser();
    if (!currentUser) {
      window.location.replace(pagePath("login.html"));
      return new Promise(() => {});
    }
    try {
      await assertAccountActive(currentUser);
      return currentUser;
    } catch {
      await rejectInactiveSession();
      return new Promise(() => {});
    }
  }

  if (!auth) {
    throw Object.assign(new Error("Firebase Auth is not initialized."), { code: "auth-uninitialized", userSafe: true });
  }

  let firebaseUser;
  try {
    firebaseUser = await waitForFirebaseUser();
  } catch (error) {
    throw Object.assign(
      new Error(
        "Firebase Auth did not respond. Add team-flow-updation.vercel.app under Authentication → Settings → Authorized domains, and confirm Email/Password is enabled."
      ),
      { code: "auth-timeout", userSafe: true, cause: error }
    );
  }

  if (!firebaseUser) {
    currentUser = null;
    window.location.replace(pagePath("login.html"));
    return new Promise(() => {});
  }

  let profile;
  try {
    profile = await withTimeout(
      ensureUserProfile(firebaseUser),
      PROFILE_TIMEOUT_MS,
      "Could not load your profile. Create a Cloud Firestore database for project teamflowupdation and deploy security rules."
    );
  } catch (error) {
    throw Object.assign(
      new Error(
        error.userSafe
          ? error.message
          : "Could not load your profile. Create a Cloud Firestore database for project teamflowupdation and deploy security rules."
      ),
      { code: error.code || "profile-timeout", userSafe: true, cause: error }
    );
  }

  if (!profile || profile.active === false) {
    await rejectInactiveSession();
    return new Promise(() => {});
  }

  currentUser = { ...profile, id: firebaseUser.uid, email: firebaseUser.email };
  try {
    await assertAccountActive(currentUser);
  } catch (error) {
    if (error?.code === "account-inactive") {
      await rejectInactiveSession();
      return new Promise(() => {});
    }
    throw error;
  }
  emitUser();
  return currentUser;
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
