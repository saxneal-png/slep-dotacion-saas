import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDqVdTHaB886PG9yWxAoaFTkqu10MUN58g",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dotacionslep.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dotacionslep",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dotacionslep.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1042724678573",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1042724678573:web:f1d25eec38fe513bdf0f24",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-190X7CDHW3"
};

// Inicializar Firebase (Singleton)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicializar Firestore y Auth
export const firestore = getFirestore(app);
export const auth = getAuth(app);

// Analytics deshabilitado por defecto para evitar bloqueo CSP de GTM innecesario
export const analytics: any = null;
