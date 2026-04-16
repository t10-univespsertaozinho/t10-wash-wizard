import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

function getConfigFromEnvOrStorage() {
  const fromEnv = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const fromStorage = {
    apiKey: localStorage.getItem('t10_firebase_apiKey') || '',
    authDomain: localStorage.getItem('t10_firebase_authDomain') || '',
    projectId: localStorage.getItem('t10_firebase_projectId') || '',
    storageBucket: localStorage.getItem('t10_firebase_storageBucket') || '',
    messagingSenderId: localStorage.getItem('t10_firebase_messagingSenderId') || '',
    appId: localStorage.getItem('t10_firebase_appId') || '',
  };

  return {
    apiKey: fromEnv.apiKey || fromStorage.apiKey,
    authDomain: fromEnv.authDomain || fromStorage.authDomain,
    projectId: fromEnv.projectId || fromStorage.projectId,
    storageBucket: fromEnv.storageBucket || fromStorage.storageBucket,
    messagingSenderId: fromEnv.messagingSenderId || fromStorage.messagingSenderId,
    appId: fromEnv.appId || fromStorage.appId,
  };
}

let firebaseConfig: ReturnType<typeof getConfigFromEnvOrStorage>;
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function isFirebaseConfigured(): boolean {
  const config = getConfigFromEnvOrStorage();
  return !!config.apiKey && config.apiKey.length > 10;
}

export function initializeFirebase() {
  firebaseConfig = getConfigFromEnvOrStorage();
  
  if (!app && isFirebaseConfigured()) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app, auth, db };
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    initializeFirebase();
  }
  return auth!;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    initializeFirebase();
  }
  return db!;
}

export function getFirebaseConfig() {
  return getConfigFromEnvOrStorage();
}