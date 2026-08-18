import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { AUDIT_PAGE_SIZE } from "./constants.js";
import { db, isFirebaseConfigured } from "./firebase-config.js";
import { createDemoState } from "./seed-data.js";
import { uid } from "./utils.js";

const DEMO_KEY = "teamflow.demo.v2";
const listeners = new Set();

function localStampKey(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emit(state) {
  listeners.forEach((fn) => fn(state));
}

function stripPassword(users = []) {
  return users.map(({ password, ...rest }) => rest);
}

class DemoAdapter {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore corrupted storage */
    }
    return createDemoState();
  }

  persist() {
    localStorage.setItem(DEMO_KEY, JSON.stringify(this.state));
    emit(this.snapshot());
  }

  snapshot() {
    return {
      mode: "demo",
      loading: false,
      users: stripPassword(this.state.users),
      members: this.state.members,
      projects: this.state.projects,
      assignments: this.state.assignments,
      extraHours: this.state.extraHours || [],
      settings: this.state.settings,
    };
  }

  subscribe(callback, _options) {
    listeners.add(callback);
    callback(this.snapshot());
    return () => listeners.delete(callback);
  }

  resetDemo() {
    this.state = createDemoState();
    this.persist();
  }

  async writeAudit(entry) {
    this.state.auditLogs.unshift({
      id: uid("log"),
      timestamp: new Date().toISOString(),
      ...entry,
    });
    this.persist();
  }

  async addMember(data) {
    const member = { id: uid("m"), active: true, avatar: "", createdAt: new Date().toISOString(), ...data };
    this.state.members.push(member);
    this.persist();
    return member;
  }

  async updateMember(id, data) {
    this.state.members = this.state.members.map((item) =>
      item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
    );
    this.persist();
  }

  async addProject(data) {
    const project = { id: uid("p"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...data };
    this.state.projects.push(project);
    this.persist();
    return project;
  }

  async updateProject(id, data) {
    this.state.projects = this.state.projects.map((item) =>
      item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
    );
    this.persist();
  }

  async addAssignment(data) {
    const now = new Date().toISOString();
    const assignment = {
      id: uid("a"),
      createdAt: now,
      assignedAt: now,
      updatedAt: now,
      notes: "",
      date: data.date,
      assignedByName: data.assignedByName || "",
      legacy: false,
      ...data,
    };
    this.state.assignments.push(assignment);
    this.persist();
    return assignment;
  }

  async updateAssignment(id, data) {
    this.state.assignments = this.state.assignments.map((item) =>
      item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
    );
    this.persist();
  }

  async addExtraHours(data) {
    if (!this.state.extraHours) this.state.extraHours = [];
    const record = {
      id: uid("e"),
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.state.extraHours.unshift(record);
    this.persist();
    return record;
  }

  async updateExtraHours(id, data) {
    this.state.extraHours = (this.state.extraHours || []).map((item) =>
      item.id === id ? { ...item, ...data } : item
    );
    this.persist();
  }

  async removeExtraHours(id) {
    this.state.extraHours = (this.state.extraHours || []).filter((item) => item.id !== id);
    this.persist();
  }

  async updateSettings(data) {
    this.state.settings = { ...this.state.settings, ...data, updatedAt: new Date().toISOString() };
    this.persist();
    return this.state.settings;
  }

  async updateUser(id, data) {
    this.state.users = this.state.users.map((item) =>
      item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
    );
    this.persist();
  }

  async addUser(data) {
    const user = {
      id: uid("u"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memberId: data.memberId || "",
      ...data,
    };
    this.state.users.push(user);
    this.persist();
    return user;
  }

  async fetchAuditLogs({ action, userId, memberId, projectId, search, from, to, cursor } = {}) {
    let rows = [...this.state.auditLogs].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    if (action) rows = rows.filter((row) => row.action === action);
    if (userId) rows = rows.filter((row) => row.performedBy === userId);
    if (memberId) rows = rows.filter((row) => row.targetMemberId === memberId);
    if (projectId) rows = rows.filter((row) => row.projectId === projectId);
    if (from) rows = rows.filter((row) => localStampKey(row.timestamp) >= from);
    if (to) rows = rows.filter((row) => localStampKey(row.timestamp) <= to);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        [row.performedByName, row.targetMemberName, row.projectName, row.action]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    const start = cursor ? Number(cursor) : 0;
    const page = rows.slice(start, start + AUDIT_PAGE_SIZE);
    return {
      rows: page,
      nextCursor: start + AUDIT_PAGE_SIZE < rows.length ? String(start + AUDIT_PAGE_SIZE) : null,
    };
  }

  getDemoUser(email, password) {
    return this.state.users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase() && user.password === password
    );
  }

  getUserById(id) {
    const user = this.state.users.find((item) => item.id === id);
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
  }

  getMemberById(id) {
    return this.state.members.find((item) => item.id === id) || null;
  }
}

class FirestoreAdapter {
  constructor() {
    this.cache = {
      mode: "firebase",
      loading: true,
      users: [],
      members: [],
      projects: [],
      assignments: [],
      extraHours: [],
      settings: {
        id: "app",
        companyName: "Siznam & Co.",
        defaultDailyCapacity: 8,
        defaultManagerPermissions: {},
        updatedBy: "system",
      },
    };
    this.unsubscribers = [];
    this.readyCount = 0;
    this.expectedReady = 5;
  }

  snapshot() {
    return { ...this.cache };
  }

  subscribe(callback, options = {}) {
    listeners.add(callback);
    this.ensureListeners(options);
    callback(this.snapshot());
    return () => listeners.delete(callback);
  }

  markReady() {
    this.readyCount += 1;
    if (this.readyCount >= this.expectedReady) {
      this.cache.loading = false;
      emit(this.snapshot());
    }
  }

  ensureListeners(options = {}) {
    if (this.unsubscribers.length) return;
    const memberId = options.memberId;
    this.expectedReady = memberId ? 3 : 5;

    const bindQuery = (ref, key) =>
      onSnapshot(ref, (snap) => {
        if (typeof snap.exists === "function") {
          this.cache[key] = snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];
        } else {
          this.cache[key] = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        }
        emit(this.snapshot());
        if (this.cache.loading) this.markReady();
      });

    if (memberId) {
      this.unsubscribers.push(bindQuery(doc(db, "teamMembers", memberId), "members"));
      this.unsubscribers.push(
        onSnapshot(query(collection(db, "assignments"), where("memberId", "==", memberId)), async (snap) => {
          this.cache.assignments = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
          await this.hydrateProjects(this.cache.assignments);
          emit(this.snapshot());
          if (this.cache.loading) this.markReady();
        })
      );
      this.unsubscribers.push(
        bindQuery(query(collection(db, "extraHours"), where("memberId", "==", memberId)), "extraHours")
      );
    } else {
      this.unsubscribers.push(bindQuery(collection(db, "teamMembers"), "members"));
      this.unsubscribers.push(bindQuery(collection(db, "projects"), "projects"));
      this.unsubscribers.push(bindQuery(collection(db, "assignments"), "assignments"));
      this.unsubscribers.push(bindQuery(collection(db, "extraHours"), "extraHours"));
      this.unsubscribers.push(
        onSnapshot(doc(db, "settings", "app"), (snap) => {
          if (snap.exists()) this.cache.settings = { id: snap.id, ...snap.data() };
          emit(this.snapshot());
          if (this.cache.loading) this.markReady();
        })
      );
    }
  }

  async hydrateProjects(assignments = []) {
    const ids = [...new Set(assignments.map((item) => item.projectId).filter(Boolean))];
    const projects = [];
    for (const id of ids) {
      const snap = await getDoc(doc(db, "projects", id));
      if (snap.exists()) projects.push({ id: snap.id, ...snap.data() });
    }
    this.cache.projects = projects;
  }

  async writeAudit(entry) {
    await addDoc(collection(db, "auditLogs"), {
      ...entry,
      timestamp: serverTimestamp(),
    });
  }

  async addMember(data) {
    const ref = await addDoc(collection(db, "teamMembers"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...data };
  }

  async updateMember(id, data) {
    await updateDoc(doc(db, "teamMembers", id), { ...data, updatedAt: serverTimestamp() });
  }

  async addProject(data) {
    const ref = await addDoc(collection(db, "projects"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...data };
  }

  async updateProject(id, data) {
    await updateDoc(doc(db, "projects", id), { ...data, updatedAt: serverTimestamp() });
  }

  async addAssignment(data) {
    const ref = await addDoc(collection(db, "assignments"), {
      ...data,
      createdAt: serverTimestamp(),
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...data };
  }

  async updateAssignment(id, data) {
    await updateDoc(doc(db, "assignments", id), { ...data, updatedAt: serverTimestamp() });
  }

  async addExtraHours(data) {
    const ref = await addDoc(collection(db, "extraHours"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, ...data };
  }

  async updateExtraHours(id, data) {
    await updateDoc(doc(db, "extraHours", id), data);
  }

  async removeExtraHours(id) {
    await deleteDoc(doc(db, "extraHours", id));
  }

  async updateSettings(data) {
    const { id, ...current } = this.cache.settings || {};
    await setDoc(doc(db, "settings", "app"), {
      ...current,
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { ...current, ...data };
  }

  async updateUser(id, data) {
    await updateDoc(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() });
  }

  async addUser(id, data) {
    await setDoc(doc(db, "users", id), {
      memberId: data.memberId || "",
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, ...data };
  }

  async getUserById(id) {
    const snap = await getDoc(doc(db, "users", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async getMemberById(id) {
    const snap = await getDoc(doc(db, "teamMembers", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async listUsers() {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  async fetchAuditLogs({ action, userId, memberId, projectId, search, from, to, cursor } = {}) {
    const constraints = [];
    if (action) constraints.push(where("action", "==", action));
    else if (userId) constraints.push(where("performedBy", "==", userId));
    else if (memberId) constraints.push(where("targetMemberId", "==", memberId));
    else if (projectId) constraints.push(where("projectId", "==", projectId));
    constraints.push(orderBy("timestamp", "desc"));
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(AUDIT_PAGE_SIZE));

    const snap = await getDocs(query(collection(db, "auditLogs"), ...constraints));
    let rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    if (from) rows = rows.filter((row) => localStampKey(row.timestamp) >= from);
    if (to) rows = rows.filter((row) => localStampKey(row.timestamp) <= to);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        [row.performedByName, row.targetMemberName, row.projectName, row.action]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    const last = snap.docs[snap.docs.length - 1] || null;
    return { rows, nextCursor: snap.docs.length === AUDIT_PAGE_SIZE ? last : null };
  }

  async seedDemoData(actor = {}) {
    const state = createDemoState();
    const asTime = (value) => Timestamp.fromDate(new Date(value));
    const actorId = actor.id || "";
    const actorName = actor.name || "Admin";
    const batch = writeBatch(db);
    state.members.forEach((member) => {
      const { id, ...data } = member;
      batch.set(doc(db, "teamMembers", id), {
        ...data,
        createdAt: asTime(data.createdAt),
        updatedAt: asTime(data.updatedAt),
      });
    });
    state.projects.forEach((project) => {
      const { id, ...data } = project;
      batch.set(doc(db, "projects", id), {
        ...data,
        createdBy: actorId,
        createdAt: asTime(data.createdAt),
        updatedAt: asTime(data.updatedAt),
      });
    });
    state.assignments.forEach((assignment) => {
      const { id, ...data } = assignment;
      batch.set(doc(db, "assignments", id), {
        ...data,
        assignedBy: actorId,
        assignedByName: actorName,
        createdAt: asTime(data.createdAt || data.assignedAt),
        assignedAt: asTime(data.assignedAt),
        updatedAt: asTime(data.updatedAt),
      });
    });
    state.extraHours.forEach((row) => {
      const { id, ...data } = row;
      batch.set(doc(db, "extraHours", id), {
        ...data,
        addedBy: actorId,
        addedByName: actorName,
        createdAt: asTime(data.createdAt),
      });
    });
    batch.set(doc(db, "settings", "app"), {
      companyName: state.settings.companyName,
      defaultDailyCapacity: state.settings.defaultDailyCapacity,
      defaultManagerPermissions: state.settings.defaultManagerPermissions,
      updatedAt: asTime(state.settings.updatedAt),
      updatedBy: actorId,
    });
    await batch.commit();

    for (const log of state.auditLogs) {
      const { id, ...data } = log;
      await setDoc(doc(db, "auditLogs", id), {
        ...data,
        performedBy: actorId,
        performedByName: actorName,
        timestamp: asTime(data.timestamp),
      });
    }
  }
}

export const adapter = isFirebaseConfigured ? new FirestoreAdapter() : new DemoAdapter();

export const store = {
  mode: isFirebaseConfigured ? "firebase" : "demo",
  snapshot: () => adapter.snapshot(),
  subscribe: (cb, options) => adapter.subscribe(cb, options),
  getDemoUser: (email, password) => adapter.getDemoUser?.(email, password) || null,
  getUserById: (id) => adapter.getUserById(id),
  getMemberById: (id) => Promise.resolve(adapter.getMemberById?.(id)),
  listUsers: () => adapter.listUsers?.() || Promise.resolve(adapter.state?.users ? stripPassword(adapter.state.users) : []),
  addMember: (data) => adapter.addMember(data),
  updateMember: (id, data) => adapter.updateMember(id, data),
  addProject: (data) => adapter.addProject(data),
  updateProject: (id, data) => adapter.updateProject(id, data),
  addAssignment: (data) => adapter.addAssignment(data),
  updateAssignment: (id, data) => adapter.updateAssignment(id, data),
  addExtraHours: (data) => adapter.addExtraHours(data),
  updateExtraHours: (id, data) => adapter.updateExtraHours(id, data),
  removeExtraHours: (id) => adapter.removeExtraHours(id),
  updateSettings: (data) => adapter.updateSettings(data),
  updateUser: (id, data) => adapter.updateUser(id, data),
  addUser: (id, data) => (data ? adapter.addUser(id, data) : adapter.addUser(id)),
  writeAudit: (entry) => adapter.writeAudit(entry),
  fetchAuditLogs: (opts) => adapter.fetchAuditLogs(opts),
  resetDemo: () => adapter.resetDemo?.(),
  seedDemoData: (actor) => adapter.seedDemoData?.(actor),
};
