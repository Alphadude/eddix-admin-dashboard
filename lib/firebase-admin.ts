import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

/**
 * Firebase Admin SDK Configuration
 * This is used for server-side operations (API routes, server components)
 * NEVER expose this on the client side
 */

// Check if all required environment variables are present
const hasRequiredEnvVars = () => {
  return !!(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
};

let app: App | undefined;
let adminAuth: Auth | undefined;
let adminDb: Firestore | undefined;
let adminStorage: Storage | undefined;

// Only initialize Firebase Admin if environment variables are available
// This prevents build-time errors when deploying to Vercel
if (hasRequiredEnvVars()) {
  if (!getApps().length) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    app = getApps()[0];
  }

  // Export Firebase Admin services
  adminAuth = getAuth(app);
  adminDb = getFirestore(app);
  adminStorage = getStorage(app);
}

// Helper function to ensure services are initialized
const ensureInitialized = () => {
  if (!app || !adminAuth || !adminDb || !adminStorage) {
    throw new Error(
      'Firebase Admin SDK is not initialized. Please check your environment variables: ' +
      'FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY'
    );
  }
};

// Export services with runtime checks
export { adminAuth, adminDb, adminStorage, ensureInitialized };
export default app;
