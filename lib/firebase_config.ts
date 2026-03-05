import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guard: only initialize Firebase when env vars are present.
// During `next build` on Vercel the NEXT_PUBLIC_* vars may not be set,
// which causes Firebase to throw auth/invalid-api-key during static prerender.
// With `export const dynamic = "force-dynamic"` in layout.tsx, pages are never
// statically pre-rendered at build time so this guard is a safety net only.
const app = (() => {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
    return !getApps().length ? initializeApp(firebaseConfig) : getApp();
})();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = app ? getAuth(app) : (null as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = app ? getFirestore(app) : (null as any);

export { app, auth, db };