import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyA9CNqchVUrsWaOil1r9TDVwUrd2r5psEU",
  authDomain: "ashramganesha.firebaseapp.com",
  databaseURL: "https://ashramganesha-default-rtdb.firebaseio.com",
  projectId: "ashramganesha",
  storageBucket: "ashramganesha.firebasestorage.app",
  messagingSenderId: "579067179872",
  appId: "1:579067179872:web:065d7bd1f03ceb8a6da405",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const firebaseApp = initializeApp(firebaseConfig);

export const analyticsPromise = isSupported()
  .then((supported) => (supported && firebaseConfig.measurementId ? getAnalytics(firebaseApp) : null))
  .catch(() => null);
export const auth = getAuth(firebaseApp);
export const db = getDatabase(firebaseApp);
export const firestoreDb = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
