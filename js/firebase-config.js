/**
 * Firebase initialization for project teamflowupdation.
 * Web API keys are expected in the client; access is enforced by Auth + Firestore rules.
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBbQvT0IqVs3Ddh2pMaiDeB6YQL-vPlT7M",
  authDomain: "teamflowupdation.firebaseapp.com",
  projectId: "teamflowupdation",
  storageBucket: "teamflowupdation.firebasestorage.app",
  messagingSenderId: "232878061937",
  appId: "1:232878061937:web:9c4feb4998a00813cd1ed0",
  measurementId: "G-8DDPZ46N8M",
};

/** Must match bootstrapEmail() in firestore.rules */
export const BOOTSTRAP_ADMIN_EMAIL = "admin@siznam.co";

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID"
);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
