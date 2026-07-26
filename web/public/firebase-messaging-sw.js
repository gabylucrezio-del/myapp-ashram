importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA9CNqchVUrsWaOil1r9TDVwUrd2r5psEU",
  authDomain: "ashramganesha.firebaseapp.com",
  databaseURL: "https://ashramganesha-default-rtdb.firebaseio.com",
  projectId: "ashramganesha",
  storageBucket: "ashramganesha.firebasestorage.app",
  messagingSenderId: "579067179872",
  appId: "1:579067179872:web:065d7bd1f03ceb8a6da405",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Ashram Ganesha";
  const options = {
    body: payload.notification?.body || "",
    icon: "/LogoReal.png",
    badge: "/LogoReal.png",
    data: payload.data || {},
    tag: payload.data?.eventId || payload.data?.type || "ashram-admin",
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification.data?.route || "/#admin";
  const targetUrl = new URL(route, self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ("focus" in client) {
        client.navigate(targetUrl);
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  }));
});
