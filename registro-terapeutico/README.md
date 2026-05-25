# Registro Terapeutico Ashram Ganesha

App web movil pensada para empaquetar luego como APK.

## Probar local

```powershell
python -m http.server 5190 --bind 127.0.0.1
```

Abrir:

```text
http://127.0.0.1:5190
```

## Estado

Incluye entrada directa sin inicio de sesion, estructura navegable, formularios principales, datos locales con `localStorage`, acciones rapidas por paciente, turnos locales, sugerencias para WhatsApp/email y placeholders de Firebase/Supabase + Google Calendar.

Tambien incluye `manifest.json`, `icon.svg` y `sw.js` para modo instalable/offline basico.

## Futuro APK

Puede empaquetarse como WebView Android/TWA o integrarse con Capacitor. La base esta separada de:

- `web/`: app web principal Ashram.
- `teleprompter-apk/`: APK nativa del teleprompter.
