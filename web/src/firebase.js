import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyAXmRKx05nNsLum2qAtaoDPrSQhsBD7e3A",
  authDomain: "ashramganesha.firebaseapp.com",
  databaseURL: "https://ashramganesha-default-rtdb.firebaseio.com",
  projectId: "ashramganesha",
  storageBucket: "ashramganesha.firebasestorage.app",
  appId: "1:579067179872:web:ashramganesha",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
