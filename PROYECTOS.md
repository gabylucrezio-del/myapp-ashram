# Proyectos Ashram

## App Ashram
- Tipo: Web app principal.
- Carpeta: `web/`.
- Uso: experiencia principal de Ashram Ganesha.

## Teleprompter
- Tipo: APK Android nativa.
- Carpeta: `teleprompter-apk/`.
- APK debug: `teleprompter-apk/app/build/outputs/apk/debug/app-debug.apk`.
- Uso: teleprompter flotante sobre la camara del celular.

## Estudio Ashram
- Tipo: App web local, empaquetada como APK.
- Carpeta web local: `estudio-ashram/`.
- Carpeta APK: `estudio-ashram-apk/`.
- Uso: organizador local de carpetas, archivos, apuntes, guiones y libros.
- Datos: guarda localmente en el dispositivo/navegador.
- Nota: esta es la app que debe unirse con el teleprompter para trabajar con archivos locales.

## Registro Terapeutico Ashram Ganesha
- Tipo: App web movil, preparada para empaquetar como APK.
- Carpeta: `registro-terapeutico/`.
- URL local de prueba: `http://127.0.0.1:5190`.
- Login demo: `admin@ashram.local` / `ashram`.
- Uso: registro terapeutico profesional para Ayurveda, coaching y acompanamiento espiritual.
- Pantalla principal: botones grandes de `Pacientes`, `Consulta` y `Boticario`.
- Pacientes:
  - Lista en tarjetas.
  - Boton `+` para mostrar el formulario de carga.
  - Permite editar y borrar pacientes.
  - No incluye motivo de consulta en la ficha del paciente; el motivo se carga en cada consulta.
  - Accion rapida de WhatsApp.
- Consulta:
  - Primero muestra lista de pacientes.
  - Al seleccionar un paciente abre la ficha de consulta.
  - Soporta consulta Ayurveda y consulta Coaching.
  - Consultas guardadas con opcion de editar.
  - Incluye flecha volver y soporte para boton atras del celular/navegador.
- Boticario:
  - Vademecum de plantas medicinales argentinas con cualidades ayurvedicas.
  - Lista en tarjetas.
  - Boton `+` para mostrar formulario de carga.
  - Permite foto local de la planta desde celular.
  - Permite editar y borrar plantas.
- Calendario:
  - Tiene grilla mensual local y carga de turnos locales.
  - Preparado para conectar Google Calendar mas adelante.
- Datos:
  - Todo se guarda localmente en el celular/navegador con `localStorage`.
  - Incluye modo offline basico con `manifest.json` y `sw.js`.
  - Incluye exportar/importar respaldo local en JSON.
- Identidad visual:
  - Usa logo real del Ashram copiado como `registro-terapeutico/logo-ashram.webp`.
  - Estetica movil calida, profesional y espiritual.
- Estado: prototipo funcional web movil, listo para seguir puliendo y luego empaquetar como APK.

## Experimentos
- `teleprompter/`: prototipo web local del teleprompter.
- `teleprompter_flet/`: prototipo Flet/Python del teleprompter.
