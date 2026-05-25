# Teleprompter Flet

App local en Python/Flet para guardar guiones y usar un modo teleprompter dimensionable.

## Probar

```powershell
python teleprompter_flet\teleprompter_flet.py
```

Los guiones se guardan en `teleprompter_data.json`.

## Nota Android

Flet permite compilar como app normal, pero el permiso nativo de Android para flotar encima de otras apps (`SYSTEM_ALERT_WINDOW`) no queda resuelto solo con Python. Para una APK flotante real sobre la camara nativa hace falta agregar codigo Android nativo o usar el proyecto `teleprompter-apk`.
