# Push notifications

Las notificaciones push del chat se disparan con Firebase Cloud Functions.

Cuando un usuario escribe en:

```text
/chat/{uid}/mensajes/{messageId}
```

la function `notifyAdminOnChatMessage` envia una notificacion FCM al administrador.

## Tokens del administrador

Para que Firebase pueda enviar la push al celular, el token FCM del dispositivo administrador debe estar guardado en:

```text
/admin_fcm_tokens/{deviceId}
```

Formato aceptado:

```json
{
  "token": "FCM_DEVICE_TOKEN"
}
```

Tambien acepta guardar directamente el string del token.

## Deploy

Desde la raiz del proyecto:

```bash
firebase deploy --only functions
```

Si no tenes Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use <project-id>
firebase deploy --only functions
```

## Nota importante

La app movil debe registrar el token FCM del celular administrador y guardarlo en
`/admin_fcm_tokens`. Esa parte depende de como empaquetes la app Flet para Android/iOS.
