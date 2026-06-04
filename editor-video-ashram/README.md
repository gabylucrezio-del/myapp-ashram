# Editor Ashram

App Android con React + Capacitor 6 para crear videos simples tipo CapCut, enfocada en reels, cursos, satsang, yoga, meditacion, Ayurveda y coaching espiritual.

## MVP incluido

- Crear proyecto en 9:16, 16:9 o 1:1.
- Importar uno o varios videos del dispositivo.
- Preview responsive para celular y tablet.
- Timeline con clips en orden.
- Seleccionar clip, recortar inicio/final, dividir, borrar y reordenar.
- Logo PNG con posicion, tamano y opacidad.
- Texto/subtitulos manuales basicos.
- Ajuste de volumen/mute por clip.
- Transiciones y efectos registrados como datos del proyecto.
- Panel de exportacion con plan FFmpeg nativo y fallback WebM de vista previa cuando el WebView lo soporte.
- Timeline liviana para Android: no procesa video en tiempo real, no genera miniaturas por frame y guarda cortes/textos como metadata.

## Ejecutar en desarrollo

```powershell
npm install
npm run dev
```

## Preparar Android

```powershell
npm install
npm run build
npm run android:add
npm run android:sync
npm run android:open
```

Luego compilar el APK desde Android Studio. El proyecto incluye `android/local.properties` apuntando al SDK local detectado en esta maquina.

## Exportacion MP4

La estructura esta preparada para FFmpeg nativo con Capacitor. Ver:

```text
android-native-notes/FFMPEG_NATIVE_PLAN.md
```

`FFmpeg.wasm` no se usa como dependencia inicial porque en Android WebView puede ser pesado e inestable para videos largos. La app separa preview, metadata de edicion y exportacion final. `src/services/exportPlan.js` genera el JSON liviano para exportar luego con FFmpeg nativo mediante Capacitor.
