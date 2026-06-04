# FFmpeg nativo para Android

Esta app deja la exportacion centralizada en `src/services/exportService.js`.

## Por que nativo

`FFmpeg.wasm` puede funcionar en navegadores de escritorio, pero en Android WebView suele ser pesado para videos largos, puede quedarse sin memoria y no siempre permite escribir facilmente en la galeria. Para APK conviene un plugin Capacitor nativo que ejecute FFmpeg en Android.

## Plugin sugerido

Crear un plugin Capacitor propio llamado `EditorAshramFfmpeg` o integrar una libreria Android basada en FFmpegKit si esta disponible en tu entorno.

Metodo JS esperado:

```js
EditorAshramFfmpeg.exportProject({
  project,
  outputName,
  resolution,
  format
})
```

Respuesta esperada:

```js
{
  path: "content://...",
  duration: 123.4
}
```

## Flujo MP4 final

1. Copiar videos elegidos a cache de la app.
2. Crear un archivo concat con clips recortados.
3. Escalar y adaptar a 9:16, 16:9 o 1:1.
4. Aplicar logo/textos/subtitulos/audio/transiciones.
5. Guardar en Movies/EditorAshram.
6. Devolver progreso a React.

La primera version web exporta una vista previa WebM si el WebView lo permite. El MP4 definitivo debe pasar por este puente nativo.
