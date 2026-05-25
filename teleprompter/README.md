# Teleprompter Ashram

App local e independiente para grabar con camara frontal, texto superpuesto y guiones guardados offline.

## Probar en la computadora

Desde esta carpeta:

```powershell
python -m http.server 5180 --bind 127.0.0.1
```

Abrir:

```text
http://127.0.0.1:5180
```

La camara necesita `localhost` o HTTPS; no conviene abrir `index.html` directo como archivo.

## Datos locales

Los guiones y carpetas se guardan en `localStorage` del navegador. La app tambien permite exportar/importar un `.json` para hacer respaldo o mover los textos a otro dispositivo.

## APK

Esta carpeta es la base para empaquetar como APK mediante una WebView Android o una TWA/PWA. Para compilar en esta maquina falta tener Java/Gradle disponibles en el PATH y validar Flutter/Android SDK.
