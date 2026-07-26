# GanFlow

GanFlow es la primera version de un constructor visual de aplicaciones tipo FlutterFlow, mas simple y pensado como base para generar codigo Flutter mas adelante.

## Uso

```bash
npm install
npm run dev
```

## Estado

MVP funcional:

- React + Vite.
- Tailwind CSS.
- Zustand para manejar el estado.
- dnd-kit para arrastrar componentes.
- Paleta, canvas visual y panel de propiedades.
- Componentes: Texto, Boton, Input, Imagen, Contenedor y Tarjeta.
- Edicion en tiempo real.
- Vista del JSON actual de la pantalla.
- Generador Flutter con vista previa, copia y descarga de `main.dart`.
- Guardado automatico del proyecto completo en `localStorage`.
- Exportacion e importacion de proyectos completos en JSON.
- Paleta compacta con iconos.
- Componentes extra: AppBar, Menu lateral, Lista, Checkbox, Switch, Select, Divider, Avatar, Icono y Video.
- MVP 4: paleta por categorias en dos columnas, seleccion moderna, duplicar/eliminar flotante, capas, bloqueo, ocultar, resize por esquinas, movimiento con flechas, grilla opcional y snap a grilla.
- Fase 5: multiples pantallas, pantalla inicial, plantillas, acciones de navegacion y generador Flutter con rutas por pantalla.
- Fase 6: editor visual de acciones por evento, acciones encadenadas, parametros editables y generacion Flutter de acciones `onTap` con placeholders para URL, imagen, base local y Firebase.
- Fase 7: variables globales, de pantalla y locales; bindings `{{variable}}`, formulas, condiciones `if/else`, `visibleIf`, `enabledIf` y generacion Dart basica para variables y expresiones.
- Fase 8: modulo visual de datos con fuentes Local/Firebase, tablas, campos, relaciones, registros de prueba, bindings de componentes a datos, acciones CRUD y generacion Flutter de modelos/placeholders SQLite-Firebase.
- Reorganizacion UI: panel izquierdo unico con pestanas, modo colapsado, canvas expandido y propiedades compactas por acordeones.
- Fase 9: constructor visual de flujos con canvas de nodos, zoom, pan, seleccion multiple, conexiones validadas y generacion Dart de funciones de flujo.
- Fase 10: generador automatico CRUD desde tablas de Datos, con modal de configuracion, pantallas lista/detalle/crear/editar, flujos CRUD y wrappers Dart.
- Fase 11: temas globales con presets, estilos por tipo de componente, herencia visual en canvas, reaplicacion a pantalla/proyecto y ThemeData Flutter.
- Fase 12: plantillas completas de aplicaciones con galeria, personalizacion rapida, pantallas, tablas, variables, flujos, navegacion y tema recomendado.
- Fase 13: exportacion de proyecto Flutter completo en ZIP con lib organizado, pantallas, modelos, servicios, rutas, tema, flujos, assets, pubspec y README.
- Fase 14: preparacion Android APK con panel de package/version/permisos/icono/splash, Gradle, Manifest, dependencias y README para `flutter build apk --release`.
- AppBar ahora pertenece a la configuracion de cada pantalla, se migra automaticamente desde componentes viejos y se genera dentro del `Scaffold`.
- Fase 15: home "Mis Proyectos" con biblioteca persistida en `localStorage`, crear/abrir/duplicar/renombrar/eliminar/importar/exportar proyectos y modo prueba responsive para ejecutar pantallas, acciones, flujos simples y datos locales simulados.
