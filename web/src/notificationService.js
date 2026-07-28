import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { firebaseApp, firestoreDb } from "./firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";
const ADMIN_TOKEN_HASH_KEY = "ashram-admin-fcm-token-hash";
const USER_TOKEN_HASH_KEY = "ashram-user-fcm-token-hash";

export async function notificationSupportState() {
  if (!("Notification" in window)) return { status: "unsupported", label: "No compatibles" };
  const supported = await isSupported().catch(() => false);
  if (!supported) return { status: "unsupported", label: "No compatibles" };
  if (Notification.permission === "granted") return { status: "enabled", label: "Activadas" };
  if (Notification.permission === "denied") return { status: "blocked", label: "Bloqueadas" };
  return { status: "available", label: "Disponibles" };
}

export async function enableAdminNotifications(user) {
  if (!user?.uid) throw new Error("Necesitas iniciar sesion como administrador.");
  return enableNotifications(user, {
    collectionName: "adminNotificationTokens",
    storageKey: ADMIN_TOKEN_HASH_KEY,
    includeEmail: true,
  });
}

export async function disableAdminNotifications(user) {
  return disableNotifications(user, {
    collectionName: "adminNotificationTokens",
    storageKey: ADMIN_TOKEN_HASH_KEY,
  });
}

export async function enableUserNotifications(user) {
  if (!user?.uid) throw new Error("Necesitas iniciar sesion.");
  return enableNotifications(user, {
    collectionName: "userNotificationTokens",
    storageKey: USER_TOKEN_HASH_KEY,
    includeEmail: false,
  });
}

export async function disableUserNotifications(user) {
  return disableNotifications(user, {
    collectionName: "userNotificationTokens",
    storageKey: USER_TOKEN_HASH_KEY,
  });
}

async function enableNotifications(user, { collectionName, storageKey, includeEmail }) {
  if (!("Notification" in window)) throw new Error("Este navegador no soporta notificaciones push.");
  if (Notification.permission === "denied") return { status: "blocked", label: "Bloqueadas" };
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") return { status: "blocked", label: "Bloqueadas" };
  const supported = await isSupported().catch(() => false);
  if (!supported) throw new Error("Este navegador no soporta notificaciones push.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessaging(firebaseApp);
  const tokenOptions = { serviceWorkerRegistration: registration };
  if (VAPID_KEY) tokenOptions.vapidKey = VAPID_KEY;
  const token = await getToken(messaging, tokenOptions);
  if (!token) throw new Error("Firebase no devolvio un token de notificaciones.");
  const tokenHash = await sha256(token);
  localStorage.setItem(storageKey, tokenHash);
  const data = {
    token,
    uid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    userAgent: navigator.userAgent || "",
    enabled: true,
  };
  if (includeEmail) data.email = user.email || "";
  await setDoc(doc(firestoreDb, collectionName, tokenHash), data, { merge: true });
  return { status: "enabled", label: "Activadas" };
}

async function disableNotifications(user, { collectionName, storageKey }) {
  const messaging = await isSupported().then((ok) => ok ? getMessaging(firebaseApp) : null).catch(() => null);
  if (messaging) await deleteToken(messaging).catch(() => false);
  const storedHash = localStorage.getItem(storageKey);
  if (storedHash) await deleteDoc(doc(firestoreDb, collectionName, storedHash)).catch(() => {});
  localStorage.removeItem(storageKey);
  if (user?.uid) {
    const snap = await getDocs(query(collection(firestoreDb, collectionName), where("uid", "==", user.uid)));
    await Promise.all(snap.docs.map((item) => deleteDoc(item.ref).catch(() => {})));
  }
  return notificationSupportState();
}

export async function listenForegroundNotifications(onNotification) {
  const supported = await isSupported().catch(() => false);
  if (!supported) return () => {};
  const messaging = getMessaging(firebaseApp);
  return onMessage(messaging, (payload) => {
    onNotification?.({
      title: payload.notification?.title || "Ashram Ganesha",
      body: payload.notification?.body || "",
      data: payload.data || {},
    });
  });
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
