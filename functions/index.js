const admin = require("firebase-admin");
const functions = require("firebase-functions");

admin.initializeApp();

const ADMIN_EMAIL = "gabriel@ashramganesha.com";

exports.notifyAdminOnChatMessage = functions.database
  .ref("/chat/{uid}/mensajes/{messageId}")
  .onCreate(async (snapshot, context) => {
    const message = snapshot.val();

    if (!message || message.rol !== "usuario") {
      return null;
    }

    const tokensSnapshot = await admin.database().ref("/admin_fcm_tokens").once("value");
    const tokensData = tokensSnapshot.val() || {};
    const tokens = Object.values(tokensData)
      .map((item) => (typeof item === "string" ? item : item.token))
      .filter(Boolean);

    if (!tokens.length) {
      await admin.database().ref("/admin_push_events").push({
        tipo: "chat",
        estado: "sin_tokens_admin",
        admin_email: ADMIN_EMAIL,
        usuario_email: message.remitente_email || "",
        uid: context.params.uid,
        message_id: context.params.messageId,
        fecha: new Date().toISOString(),
      });
      return null;
    }

    const body = message.remitente_email
      ? `${message.remitente_email} quiere comunicarse contigo.`
      : "Un usuario quiere comunicarse contigo.";

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Nueva consulta en Ashram Ganesha",
        body,
      },
      data: {
        tipo: "chat",
        uid: context.params.uid,
        message_id: context.params.messageId,
      },
    });

    await admin.database().ref("/admin_push_events").push({
      tipo: "chat",
      estado: "enviado",
      admin_email: ADMIN_EMAIL,
      usuario_email: message.remitente_email || "",
      uid: context.params.uid,
      message_id: context.params.messageId,
      fecha: new Date().toISOString(),
    });

    return null;
  });
