import { deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where, collection } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { firebaseApp, firestoreDb } from "./firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";
const TOKEN_HASH_KEY = "ashram-admin-fcm-token-hash";

export async function notificationSupportState() {
  if (!VAPID_KEY) return { status: "not-configured", label: "No configuradas" };
  if (!("Notification" in window)) return { status: "unsupported", label: "No compatibles" };
  const supported = await isSupported().catch(() => false);
  if (!supported) return { status: "unsupported", label: "No compatibles" };
  if (Notification.permission === "granted") return { status: "enabled", label: "Activadas" };
  if (Notification.permission === "denied") return { status: "blocked", label: "Bloqueadas" };
  return { status: "available", label: "Disponibles" };
}

export async function enableAdminNotifications(user) {
  if (!user?.uid) throw new Error("Necesitas iniciar sesión como administrador.");
  const support = await notificationSupportState();
  if (support.status === "not-configured") throw new Error("Falta configurar VITE_FIREBASE_VAPID_KEY.");
  if (support.status === "unsupported") throw new Error("Este navegador no soporta notificaciones push.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { status: "blocked", label: "Bloqueadas" };
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Firebase no devolvió un token de notificaciones.");
  const tokenHash = await sha256(token);
  localStorage.setItem(TOKEN_HASH_KEY, tokenHash);
  await setDoc(doc(firestoreDb, "adminNotificationTokens", tokenHash), {
    token,
    uid: user.uid,
    email: user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    userAgent: navigator.userAgent || "",
    enabled: true,
  }, { merge: true });
  return { status: "enabled", label: "Activadas" };
}

export async function disableAdminNotifications(user) {
  const messaging = await isSupported().then((ok) => ok ? getMessaging(firebaseApp) : null).catch(() => null);
  if (messaging) await deleteToken(messaging).catch(() => false);
  const storedHash = localStorage.getItem(TOKEN_HASH_KEY);
  if (storedHash) await deleteDoc(doc(firestoreDb, "adminNotificationTokens", storedHash)).catch(() => {});
  localStorage.removeItem(TOKEN_HASH_KEY);
  if (user?.uid) {
    const snap = await getDocs(query(collection(firestoreDb, "adminNotificationTokens"), where("uid", "==", user.uid)));
    await Promise.all(snap.docs.map((item) => deleteDoc(item.ref).catch(() => {})));
  }
  return notificationSupportState();
}

export async function listenForegroundNotifications(onNotification) {
  if (!VAPID_KEY) return () => {};
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
