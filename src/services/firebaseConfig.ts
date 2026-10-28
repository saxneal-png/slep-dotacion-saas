import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyPlaceholderChangeMe',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dotacionslep.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dotacionslep',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'dotacionslep.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1042724678573',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1042724678573:web:placeholder'
};

// Inicializar Firebase (Singleton)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const auth = getAuth(app);
