import { generateFlutterCode } from "./flutterGenerator.js";

const slug = (value, fallback = "item") => String(value || fallback)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/([a-z])([A-Z])/g, "$1_$2")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_|_$/g, "") || fallback;

const pascal = (value, fallback = "Item") => slug(value, fallback)
  .split("_")
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");

const dartString = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const flutterColor = (value) => {
  if (!value || value === "transparent") return "Colors.transparent";
  const hex = String(value).replace("#", "");
  if (hex.length === 6) return `const Color(0xFF${hex.toUpperCase()})`;
  if (hex.length === 8) return `const Color(0x${hex.toUpperCase()})`;
  return "Colors.transparent";
};

export function validateFlutterProject(builderJson) {
  const warnings = [];
  const errors = [];
  const screens = builderJson.screens || [];
  const startScreenId = builderJson.startScreenId || builderJson.activeScreenId;
  const routeNames = screens.map((screen) => routeForScreen(screen));
  const duplicateRoutes = routeNames.filter((route, index) => routeNames.indexOf(route) !== index);
  const tables = (builderJson.dataSources || []).flatMap((source) => source.tables || []);
  const tableIds = new Set(tables.map((table) => table.id));
  const usedTables = new Set(screens.flatMap((screen) => (screen.components || []).map((component) => component.props?.dataTable).filter(Boolean)));
  const firebaseUsed = (builderJson.dataSources || []).some((source) => source.type === "firebase") || hasAction(builderJson, ["saveToFirebase", "readFromFirebase"]);
  const android = normalizeAndroidConfig(builderJson);
  const hasGoogleServices = (builderJson.resources || []).some((resource) => resource.name === "google-services.json");

  if (!android.appName.trim()) errors.push("El nombre Android de la app no puede estar vacio.");
  if (!isValidPackageName(android.packageName)) errors.push("Package name Android invalido. Usa formato com.usuario.miapp.");
  if (!startScreenId || !screens.some((screen) => screen.id === startScreenId)) {
    errors.push("Falta configurar una pantalla inicial valida.");
  }
  if (duplicateRoutes.length > 0) {
    errors.push(`Hay rutas duplicadas: ${Array.from(new Set(duplicateRoutes)).join(", ")}.`);
  }
  usedTables.forEach((tableId) => {
    if (!tableIds.has(tableId)) warnings.push(`La tabla usada "${tableId}" no existe en Datos.`);
  });
  if (firebaseUsed) {
    warnings.push("Firebase esta usado o seleccionado. Configura firebase_options.dart y credenciales antes de compilar.");
    if (!hasGoogleServices) warnings.push("Firebase esta activado pero falta google-services.json en Recursos.");
  }
  if (!android.appIconResourceId) warnings.push("No hay icono de app seleccionado. Se usara configuracion default de Flutter.");

  return { errors, warnings };
}

export function generateFlutterProject(builderJson) {
  const validation = validateFlutterProject(builderJson);
  const screens = builderJson.screens || [];
  const tables = (builderJson.dataSources || []).flatMap((source) => (source.tables || []).map((table) => ({ ...table, sourceType: source.type })));
  const projectName = slug(builderJson.projectName, "ganflow_app");
  const dependencies = detectDependencies(builderJson);
  const android = normalizeAndroidConfig(builderJson);
  const files = [];

  files.push(file("lib/main.dart", generateMainDart()));
  files.push(file("lib/app.dart", generateAppDart(builderJson)));
  files.push(file("lib/theme/app_theme.dart", generateThemeDart(builderJson.theme)));
  files.push(file("lib/routes/app_routes.dart", generateRoutesDart(screens, builderJson)));
  files.push(file("lib/services/local_database_service.dart", generateLocalDatabaseService(tables)));
  files.push(file("lib/services/firebase_service.dart", generateFirebaseService()));
  files.push(file("lib/services/api_service.dart", generateApiService()));
  files.push(file("lib/widgets/generated_component.dart", generateReusableWidget()));
  files.push(file("lib/flows/generated_flows.dart", generateFlowsDart(builderJson)));
  files.push(...generateAndroidFiles(builderJson, android));
  files.push(file("pubspec.yaml", generatePubspec(projectName, dependencies, builderJson.resources || [], android)));
  files.push(file("README.md", generateReadme(builderJson, dependencies, validation, android)));
  files.push(file("assets/images/.gitkeep", ""));
  files.push(file("assets/icons/.gitkeep", ""));
  files.push(...resourceFiles(builderJson.resources || []));

  screens.forEach((screen) => {
    files.push(file(`lib/screens/${slug(screen.name, "screen")}_screen.dart`, generateScreenDart(screen)));
  });

  tables.forEach((table) => {
    files.push(file(`lib/models/${slug(singular(table.name || table.id), "model")}.dart`, generateModelDart(table)));
  });

  return { files, validation, projectName };
}

function file(path, content) {
  return { path, content };
}

function resourceFiles(resources) {
  return resources
    .filter((resource) => resource.dataUrl)
    .map((resource) => {
      const folder = resourceFolder(resource);
      return file(`assets/${folder}/${slugFile(resource.name)}`, dataUrlToBytes(resource.dataUrl));
    });
}

function resourceFolder(resource) {
  if (resource.type?.startsWith("image/")) return "images";
  if (resource.type?.includes("icon") || /\.(svg|ico)$/i.test(resource.name || "")) return "icons";
  if (resource.type?.startsWith("video/")) return "videos";
  if (resource.type?.startsWith("audio/")) return "audios";
  return "files";
}

function slugFile(name) {
  const parts = String(name || "asset").split(".");
  const extension = parts.length > 1 ? `.${parts.pop().replace(/[^a-z0-9]/gi, "").toLowerCase()}` : "";
  return `${slug(parts.join("."), "asset")}${extension}`;
}

function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function normalizeAndroidConfig(builderJson) {
  return {
    appName: builderJson.androidConfig?.appName || builderJson.projectName || "GanFlow",
    packageName: builderJson.androidConfig?.packageName || "com.ganflow.app",
    version: builderJson.androidConfig?.version || "1.0.0",
    buildNumber: Number(builderJson.androidConfig?.buildNumber) || 1,
    appIconResourceId: builderJson.androidConfig?.appIconResourceId || "",
    splashResourceId: builderJson.androidConfig?.splashResourceId || "",
    orientation: builderJson.androidConfig?.orientation || "portrait",
    permissions: {
      internet: true,
      camera: false,
      gallery: false,
      location: false,
      microphone: false,
      notifications: false,
      storage: false,
      ...(builderJson.androidConfig?.permissions || {}),
    },
  };
}

function isValidPackageName(value) {
  return /^([a-z][a-z0-9_]*\.)+[a-z][a-z0-9_]*$/.test(value || "");
}

function generateAndroidFiles(builderJson, android) {
  const resources = builderJson.resources || [];
  const icon = resources.find((resource) => resource.id === android.appIconResourceId);
  const splash = resources.find((resource) => resource.id === android.splashResourceId);
  const googleServices = resources.find((resource) => resource.name === "google-services.json");
  const files = [
    file("android/settings.gradle", generateAndroidSettings()),
    file("android/build.gradle", generateAndroidRootBuildGradle()),
    file("android/app/build.gradle", generateAndroidAppBuildGradle(android, Boolean(googleServices))),
    file("android/app/src/main/AndroidManifest.xml", generateAndroidManifest(android)),
    file("android/app/src/main/kotlin/.gitkeep", ""),
    file("android/app/src/main/res/drawable/launch_background.xml", generateLaunchBackground()),
    file("android/app/src/main/res/values/styles.xml", generateAndroidStyles()),
    file("android/app/src/main/res/values/strings.xml", `<resources>\n    <string name=\"app_name\">${escapeXml(android.appName)}</string>\n</resources>\n`),
    file("android/app/src/main/res/mipmap-hdpi/.gitkeep", ""),
    file("android/app/src/main/res/mipmap-mdpi/.gitkeep", ""),
    file("android/app/src/main/res/mipmap-xhdpi/.gitkeep", ""),
    file("android/app/src/main/res/mipmap-xxhdpi/.gitkeep", ""),
    file("android/app/src/main/res/mipmap-xxxhdpi/.gitkeep", ""),
  ];
  if (icon?.dataUrl) files.push(file(`assets/icons/${slugFile(icon.name)}`, dataUrlToBytes(icon.dataUrl)));
  if (splash?.dataUrl) files.push(file(`assets/images/${slugFile(splash.name)}`, dataUrlToBytes(splash.dataUrl)));
  if (googleServices?.dataUrl) files.push(file("android/app/google-services.json", dataUrlToBytes(googleServices.dataUrl)));
  return files;
}

function generateAndroidSettings() {
  return `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = 'GeneratedApp'
include ':app'
`;
}

function generateAndroidRootBuildGradle() {
  return `plugins {
    id 'com.android.application' version '8.5.2' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.24' apply false
    id 'com.google.gms.google-services' version '4.4.2' apply false
}
`;
}

function generateAndroidAppBuildGradle(android, hasGoogleServices) {
  return `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    ${hasGoogleServices ? "id 'com.google.gms.google-services'" : "// id 'com.google.gms.google-services' // Activar al agregar google-services.json"}
}

android {
    namespace '${android.packageName}'
    compileSdk 35

    defaultConfig {
        applicationId '${android.packageName}'
        minSdk 23
        targetSdk 35
        versionCode ${android.buildNumber}
        versionName '${dartString(android.version)}'
    }

    signingConfigs {
        release {
            // TODO: configurar keystore para release real.
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            shrinkResources false
            signingConfig signingConfigs.debug
        }
    }
}
`;
}

function generateAndroidManifest(android) {
  const permissions = androidPermissions(android.permissions).map((permission) => `    <uses-permission android:name="${permission}" />`).join("\n");
  const orientation = android.orientation === "both" ? "" : `\n            android:screenOrientation="${android.orientation === "landscape" ? "landscape" : "portrait"}"`;
  return `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
${permissions}

    <application
        android:label="${escapeXml(android.appName)}"
        android:name="\${applicationName}"
        android:icon="@mipmap/ic_launcher">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"${orientation}
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <meta-data
                android:name="io.flutter.embedding.android.NormalTheme"
                android:resource="@style/NormalTheme" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <meta-data android:name="flutterEmbedding" android:value="2" />
    </application>
</manifest>
`;
}

function androidPermissions(permissions = {}) {
  const values = [];
  if (permissions.internet) values.push("android.permission.INTERNET");
  if (permissions.camera) values.push("android.permission.CAMERA");
  if (permissions.location) {
    values.push("android.permission.ACCESS_FINE_LOCATION");
    values.push("android.permission.ACCESS_COARSE_LOCATION");
  }
  if (permissions.microphone) values.push("android.permission.RECORD_AUDIO");
  if (permissions.notifications) values.push("android.permission.POST_NOTIFICATIONS");
  if (permissions.storage || permissions.gallery) {
    values.push("android.permission.READ_MEDIA_IMAGES");
    values.push("android.permission.READ_EXTERNAL_STORAGE");
  }
  return values;
}

function generateLaunchBackground() {
  return `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/white" />
</layer-list>
`;
}

function generateAndroidStyles() {
  return `<resources>
    <style name="LaunchTheme" parent="@android:style/Theme.Light.NoTitleBar">
        <item name="android:windowBackground">@drawable/launch_background</item>
    </style>
    <style name="NormalTheme" parent="@android:style/Theme.Light.NoTitleBar">
        <item name="android:windowBackground">?android:colorBackground</item>
    </style>
</resources>
`;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function generateMainDart() {
  return `import 'package:flutter/material.dart';
import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const GeneratedApp());
}
`;
}

function generateAppDart(builderJson) {
  return `import 'package:flutter/material.dart';
import 'routes/app_routes.dart';
import 'theme/app_theme.dart';

class GeneratedApp extends StatelessWidget {
  const GeneratedApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: '${dartString(builderJson.projectName || "GanFlow")}',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      initialRoute: AppRoutes.initial,
      routes: AppRoutes.routes,
    );
  }
}
`;
}

function generateThemeDart(theme = {}) {
  const colors = {
    primary: "#2563eb",
    secondary: "#14b8a6",
    background: "#f1f5f9",
    surface: "#ffffff",
    text: "#111827",
    border: "#e2e8f0",
    ...(theme.colors || {}),
  };
  const typography = { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400, ...(theme.typography || {}) };
  const radius = theme.shape?.radius ?? 12;
  return `import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: ${flutterColor(colors.primary)},
      primary: ${flutterColor(colors.primary)},
      secondary: ${flutterColor(colors.secondary)},
      surface: ${flutterColor(colors.surface)},
      brightness: brightness,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      fontFamily: '${dartString(typography.fontFamily)}',
      scaffoldBackgroundColor: ${flutterColor(colors.background)},
      colorScheme: colorScheme,
      textTheme: TextTheme(
        bodyMedium: TextStyle(color: ${flutterColor(colors.text)}, fontSize: ${typography.baseSize}.0, fontWeight: FontWeight.w${typography.weight || 400}),
        titleMedium: TextStyle(color: ${flutterColor(colors.text)}, fontSize: ${typography.titleSize}.0, fontWeight: FontWeight.w500),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: ${flutterColor(theme.componentStyles?.buttons?.backgroundColor || colors.primary)},
          foregroundColor: ${flutterColor(theme.componentStyles?.buttons?.color || "#ffffff")},
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(${radius}.0)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: ${flutterColor(colors.surface)},
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(${radius}.0),
          borderSide: BorderSide(color: ${flutterColor(colors.border)}),
        ),
      ),
      cardTheme: CardThemeData(
        color: ${flutterColor(colors.surface)},
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(${radius + 4}.0)),
        elevation: ${theme.effects?.shadow === "none" ? 0 : 2},
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: ${flutterColor(colors.primary)},
        foregroundColor: Colors.white,
        elevation: ${theme.effects?.shadow === "none" ? 0 : 1},
      ),
    );
  }
}
`;
}

function generateRoutesDart(screens, builderJson) {
  const imports = screens.map((screen) => `import '../screens/${slug(screen.name, "screen")}_screen.dart';`).join("\n");
  const routes = screens.map((screen) => `    ${routeConstName(screen)}: (_) => const ${screenClassName(screen)}(),
    '${routeForId(screen.id)}': (_) => const ${screenClassName(screen)}(),`).join("\n");
  const start = screens.find((screen) => screen.id === (builderJson.startScreenId || builderJson.activeScreenId)) || screens[0];
  return `import 'package:flutter/material.dart';
${imports}

class AppRoutes {
  static const initial = ${routeConstName(start)};
${screens.map((screen) => `  static const ${routeFieldName(screen)} = '${routeForScreen(screen)}';`).join("\n")}

  static final routes = <String, WidgetBuilder>{
${routes}
  };
}
`;
}

function generateScreenDart(screen) {
  const components = (screen.components || []).filter((component) => !component.props?.hidden);
  const appBar = screen.settings?.appBar || {};
  const drawer = screen.settings?.drawer || {};
  return `import 'package:flutter/material.dart';
import '../routes/app_routes.dart';
import '../widgets/generated_component.dart';

class ${screenClassName(screen)} extends StatelessWidget {
  const ${screenClassName(screen)}({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: ${drawer.enabled ? generatedProjectDrawer(drawer) : "null"},
      appBar: ${appBar.enabled ? generatedProjectAppBar(appBar, drawer) : "null"},
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final viewportWidth = ${Number(screen.settings?.viewport?.mobile?.width || screen.settings?.width || 390)}.0;
            final viewportHeight = ${Number(screen.settings?.viewport?.mobile?.height || screen.settings?.height || 844)}.0;
            final scale = (constraints.maxWidth / viewportWidth).clamp(0.2, constraints.maxHeight / viewportHeight).toDouble();
            return Center(
              child: Transform.scale(
                scale: scale,
                alignment: Alignment.topCenter,
                child: SizedBox(
                  width: viewportWidth,
                  height: viewportHeight,
                  child: Stack(
                    children: [
${components.map((component) => positionedComponent(component, screen)).join("\n")}
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
`;
}

function generatedProjectAppBar(appBar, drawer = {}) {
  const actions = normalizeMenuItems(appBar.actions).map((action) => `        IconButton(onPressed: () {
${generatedConfiguredAction(action.action, "          ")}
        }, icon: const Icon(Icons.${slug(action.icon, "circle")})),`).join("\n");
  const moreItems = normalizeMenuItems(appBar.moreMenu);
  const popup = appBar.showMore || moreItems.length > 0 ? `        PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert),
          onSelected: (value) {
            switch (value) {
${moreItems.map((item) => `              case '${dartString(item.id)}':
${generatedConfiguredAction(item.action, "                ")}
                break;`).join("\n")}
            }
          },
          itemBuilder: (context) => [
${moreItems.map((item) => `            const PopupMenuItem(value: '${dartString(item.id)}', child: Row(children: [Icon(Icons.${slug(item.icon, "circle")}, size: 18), SizedBox(width: 8), Text('${dartString(item.label)}')])),`).join("\n") || "            const PopupMenuItem(value: 'empty', child: Text('Sin opciones')),"}
          ],
        ),` : "";
  return `AppBar(
        title: Text('${dartString(appBar.title || "")}'),
        centerTitle: ${appBar.titleAlign === "center" ? "true" : "false"},
        backgroundColor: ${flutterColor(appBar.backgroundColor || "#ffffff")},
        foregroundColor: ${flutterColor(appBar.textColor || "#111827")},
        elevation: ${appBar.shadow === false ? "0" : "2"},
        leading: ${appBar.showBack ? "const BackButton()" : drawer?.enabled && appBar.showMenu !== false ? "Builder(builder: (context) => IconButton(onPressed: () => Scaffold.of(context).openDrawer(), icon: const Icon(Icons.menu)))" : "null"},
        actions: [
${actions}
${popup}
        ],
      )`;
}

function generatedProjectDrawer(drawer = {}) {
  const items = normalizeMenuItems(drawer.items);
  return `Drawer(
        child: SafeArea(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
${items.map((item) => `              ListTile(
                leading: const Icon(Icons.${slug(item.icon, "circle")}),
                title: Text('${dartString(item.label)}'),
                onTap: () {
                  Navigator.pop(context);
${generatedConfiguredAction(item.action, "                  ")}
                },
              ),`).join("\n") || "              const ListTile(title: Text('Drawer sin items')),"}
            ],
          ),
        ),
      )`;
}

function positionedComponent(component, screen) {
  const props = component.props || {};
  const appBarHeight = screen.settings?.appBar?.enabled ? Number(screen.settings.appBar.height) || 0 : 0;
  return `            Positioned(
              left: ${(props.x ?? 0).toDouble?.() || Number(props.x || 0)}.0,
              top: ${Math.max(0, Number(props.y || 0) - appBarHeight)}.0,
              width: ${Number(props.width || 120)}.0,
              height: ${Number(props.height || 44)}.0,
              child: GeneratedComponent(
                type: '${dartString(component.type)}',
                text: '${dartString(props.text || component.name || "")}',
                onTap: ${tapAction(component)},
              ),
            ),`;
}

function tapAction(component) {
  const props = component.props || {};
  const action = component.events?.onTap?.find((item) => item.type === "navigateToScreen");
  const target = action?.params?.screenId || props.actionTarget;
  if (props.actionType === "navigate" && target) return `(context) => Navigator.pushNamed(context, '${routeForId(target)}')`;
  if (target) return `(context) => Navigator.pushNamed(context, '${routeForId(target)}')`;
  if (component.events?.onTap?.some((item) => item.type === "showMessage")) {
    const message = component.events.onTap.find((item) => item.type === "showMessage")?.params?.message || "Mensaje";
    return `(context) => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('${dartString(message)}')))`;
  }
  return "null";
}

function generatedConfiguredAction(action = {}, indent = "  ") {
  const type = action.type === "navigateToScreen" ? "navigateTo" : action.type;
  const screen = action.screenId || action.screen || "";
  if (type === "navigateTo" && screen) return `${indent}Navigator.pushNamed(context, '${routeForId(screen)}');`;
  if (type === "showMessage") return `${indent}ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('${dartString(action.message || "Mensaje")}')));`;
  if (type === "openModal") {
    return `${indent}showDialog(
${indent}  context: context,
${indent}  builder: (_) => AlertDialog(content: Text('${dartString(action.message || action.modalId || "Modal")}')),
${indent});`;
  }
  if (type === "openUrl") return `${indent}// TODO: abrir URL ${dartString(action.url || "")}`;
  return `${indent}// Accion AppBar pendiente: ${dartString(type || "accion")}`;
}

function normalizeMenuItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (typeof item === "string") return { id: `item_${index}`, label: item, icon: item, action: { type: "showMessage", message: item } };
    const action = item.action || {};
    return {
      id: item.id || `item_${index}`,
      label: item.label || item.text || item.id || `Opcion ${index + 1}`,
      icon: item.icon || "circle",
      action: {
        ...action,
        type: action.type || item.actionType || "showMessage",
        screen: action.screen || action.screenId || item.screen || item.screenId || "",
        screenId: action.screenId || action.screen || item.screenId || item.screen || "",
        message: action.message || item.message || item.label || "",
        modalId: action.modalId || item.modalId || "",
      },
    };
  });
}

function generateReusableWidget() {
  return `import 'package:flutter/material.dart';

typedef GeneratedTap = void Function(BuildContext context);

class GeneratedComponent extends StatelessWidget {
  const GeneratedComponent({
    super.key,
    required this.type,
    required this.text,
    this.onTap,
  });

  final String type;
  final String text;
  final GeneratedTap? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final child = switch (type) {
      'button' => ElevatedButton(onPressed: onTap == null ? null : () => onTap!(context), child: Text(text)),
      'input' => TextField(decoration: InputDecoration(hintText: text)),
      'textarea' => TextField(maxLines: null, expands: true, decoration: InputDecoration(hintText: text)),
      'datePicker' => OutlinedButton.icon(onPressed: () => showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime(2000), lastDate: DateTime(2100)), icon: const Icon(Icons.calendar_today), label: Text(text)),
      'timePicker' => OutlinedButton.icon(onPressed: () => showTimePicker(context: context, initialTime: TimeOfDay.now()), icon: const Icon(Icons.schedule), label: Text(text)),
      'searchInput' => TextField(decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: text)),
      'slider' => Slider(value: 50, min: 0, max: 100, onChanged: (_) {}),
      'select' => DropdownButtonFormField<String>(items: [DropdownMenuItem(value: text, child: Text(text))], onChanged: (_) {}),
      'image' => Container(color: theme.colorScheme.primaryContainer, child: Center(child: Text(text))),
      'list' => ListView(children: text.split('\\n').where((item) => item.isNotEmpty).map((item) => ListTile(title: Text(item))).toList()),
      'dynamicList' => ListView(children: text.split('\\n').where((item) => item.isNotEmpty).map((item) => ListTile(title: Text(item))).toList()),
      'dataTable' => DataTable(columns: const [DataColumn(label: Text('Campo'))], rows: [DataRow(cells: [DataCell(Text(text))])]),
      'card' => Card(child: Padding(padding: const EdgeInsets.all(16), child: Text(text))),
      'appbar' => Container(color: theme.colorScheme.primary, padding: const EdgeInsets.symmetric(horizontal: 16), alignment: Alignment.centerLeft, child: Text(text, style: const TextStyle(color: Colors.white))),
      'switch' => SwitchListTile(value: true, onChanged: (_) {}, title: Text(text)),
      'checkbox' => CheckboxListTile(value: true, onChanged: (_) {}, title: Text(text)),
      'tabs' => DefaultTabController(length: 1, child: TabBar(tabs: [Tab(text: text.isEmpty ? 'Tab' : text)])),
      'bottomNavigation' => BottomNavigationBar(items: [BottomNavigationBarItem(icon: const Icon(Icons.home), label: text.isEmpty ? 'Inicio' : text), const BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Perfil')]),
      'floatingActionButton' => FloatingActionButton(onPressed: onTap == null ? null : () => onTap!(context), child: const Icon(Icons.add)),
      'modal' => OutlinedButton(onPressed: onTap == null ? null : () => onTap!(context), child: Text(text)),
      'alertDialog' => OutlinedButton(onPressed: onTap == null ? null : () => onTap!(context), child: Text(text)),
      'qrCode' => const Center(child: Icon(Icons.qr_code_2, size: 48)),
      'webView' => const Center(child: Text('WebView listo')),
      'pdfViewer' => const Center(child: Text('PDFViewer listo')),
      'imagePicker' => OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.image), label: Text(text)),
      'video' => const Center(child: Icon(Icons.play_circle_fill, size: 48)),
      'videoPlayer' => const Center(child: Icon(Icons.play_circle_fill, size: 48)),
      'audioPlayer' => const Center(child: Icon(Icons.graphic_eq, size: 48)),
      'avatar' => CircleAvatar(child: Text(text.isEmpty ? 'A' : text.substring(0, text.length > 2 ? 2 : text.length))),
      'icon' => const Icon(Icons.star),
      'badge' => Chip(label: Text(text)),
      'chip' => Chip(label: Text(text)),
      'divider' => const Divider(),
      'progressBar' => const LinearProgressIndicator(value: .5),
      'circularProgress' => const CircularProgressIndicator(value: .65),
      _ => Text(text, style: theme.textTheme.bodyMedium),
    };

    if (type == 'button') return child;
    return GestureDetector(onTap: onTap == null ? null : () => onTap!(context), child: child);
  }
}
`;
}

function generateModelDart(table) {
  const className = pascal(singular(table.name || table.id), "Model");
  const fields = (table.fields || []).map((item) => `  final ${dartType(item.type)} ${slug(item.name)};`).join("\n");
  const ctor = (table.fields || []).map((item) => `    required this.${slug(item.name)},`).join("\n");
  const fromJson = (table.fields || []).map((item) => `      ${slug(item.name)}: json['${dartString(item.name)}'] as ${dartType(item.type)}? ?? ${dartDefault(item.type)},`).join("\n");
  const toJson = (table.fields || []).map((item) => `      '${dartString(item.name)}': ${slug(item.name)},`).join("\n");
  return `class ${className} {
${fields}

  const ${className}({
${ctor}
  });

  factory ${className}.fromJson(Map<String, dynamic> json) {
    return ${className}(
${fromJson}
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJson}
    };
  }
}
`;
}

function generateLocalDatabaseService(tables) {
  return `class LocalDatabaseService {
  Future<List<Map<String, dynamic>>> list(String table) async {
    // TODO: conectar sqflite. Tablas conocidas: ${tables.map((table) => table.id).join(", ")}
    return <Map<String, dynamic>>[];
  }

  Future<void> create(String table, Map<String, dynamic> values) async {}
  Future<void> update(String table, String id, Map<String, dynamic> values) async {}
  Future<void> delete(String table, String id) async {}
}
`;
}

function generateFirebaseService() {
  return `class FirebaseService {
  Future<void> initialize() async {
    // TODO: Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  }

  Future<List<Map<String, dynamic>>> list(String collection) async => <Map<String, dynamic>>[];
  Future<void> create(String collection, Map<String, dynamic> values) async {}
  Future<void> update(String collection, String id, Map<String, dynamic> values) async {}
  Future<void> delete(String collection, String id) async {}
}
`;
}

function generateApiService() {
  return `class ApiService {
  Future<Map<String, dynamic>> get(String path) async {
    // TODO: conectar HTTP client.
    return <String, dynamic>{};
  }
}
`;
}

function generateFlowsDart(builderJson) {
  const flowNames = (builderJson.flows || []).map((flow) => `  Future<void> ${slug(flow.name || flow.id)}(context) async {
    // TODO: implementar nodos visuales de ${dartString(flow.name || flow.id)}.
  }`).join("\n\n");
  return `class GeneratedFlows {
${flowNames || "  // No hay flujos configurados."}
}
`;
}

function generatePubspec(projectName, dependencies, resources = [], android) {
  const deps = dependencies.map((dep) => `  ${dep}: ${versionForDependency(dep)}`).join("\n");
  const assetFolders = Array.from(new Set(["images", "icons", ...resources.map(resourceFolder)]));
  const icon = resources.find((resource) => resource.id === android.appIconResourceId);
  const splash = resources.find((resource) => resource.id === android.splashResourceId);
  const iconPath = icon ? `assets/icons/${slugFile(icon.name)}` : "assets/icons/app_icon.png";
  const splashPath = splash ? `assets/images/${slugFile(splash.name)}` : "";
  return `name: ${projectName}
description: Proyecto Flutter generado por GanFlow.
publish_to: 'none'
version: ${android.version}+${android.buildNumber}

environment:
  sdk: '>=3.3.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
${deps}

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_launcher_icons: ${versionForDependency("flutter_launcher_icons")}
  flutter_native_splash: ${versionForDependency("flutter_native_splash")}

flutter:
  uses-material-design: true
  assets:
${assetFolders.map((folder) => `    - assets/${folder}/`).join("\n")}

flutter_launcher_icons:
  android: true
  image_path: "${iconPath}"
  min_sdk_android: 23

flutter_native_splash:
  color: "#ffffff"
${splashPath ? `  image: "${splashPath}"` : "  # image: \"assets/images/splash.png\""}
  android: true
`;
}

function generateReadme(builderJson, dependencies, validation, android) {
  return `# ${builderJson.projectName || "GanFlow App"}

Proyecto Flutter completo generado desde GanFlow.

## Instalar

\`\`\`bash
flutter pub get
\`\`\`

## Ejecutar

\`\`\`bash
flutter run
\`\`\`

## Compilar APK Android

\`\`\`bash
flutter pub get
flutter build apk --release
\`\`\`

Package name: \`${android.packageName}\`
Version: \`${android.version}+${android.buildNumber}\`

## Dependencias

${dependencies.length ? dependencies.map((dep) => `- ${dep}`).join("\n") : "- Solo Flutter SDK"}

## Notas

- Las pantallas estan en \`lib/screens\`.
- Los modelos estan en \`lib/models\`.
- Los servicios placeholder estan en \`lib/services\`.
- SQLite usa placeholders en \`LocalDatabaseService\`.
- Firebase requiere configurar \`firebase_options.dart\` si se usan colecciones o autenticacion.
- Android esta configurado en \`android/app/build.gradle\` y \`AndroidManifest.xml\`.
- Para icono: \`dart run flutter_launcher_icons\`.
- Para splash: \`dart run flutter_native_splash:create\`.

## Validaciones

${validation.errors.length ? validation.errors.map((item) => `- ERROR: ${item}`).join("\n") : "- Sin errores bloqueantes."}
${validation.warnings.length ? validation.warnings.map((item) => `- ADVERTENCIA: ${item}`).join("\n") : "- Sin advertencias."}
`;
}

function detectDependencies(builderJson) {
  const deps = new Set(["provider"]);
  const sources = builderJson.dataSources || [];
  const actionTypes = allActionTypes(builderJson);
  const componentTypes = new Set((builderJson.screens || []).flatMap((screen) => (screen.components || []).map((component) => component.type)));
  const android = normalizeAndroidConfig(builderJson);
  const permissions = android.permissions || {};
  if (sources.some((source) => source.type === "local") || ["createRecord", "updateRecord", "deleteRecord", "listRecords"].some((item) => actionTypes.has(item))) {
    deps.add("sqflite");
    deps.add("path");
  }
  if (sources.some((source) => source.type === "firebase") || ["saveToFirebase", "readFromFirebase"].some((item) => actionTypes.has(item))) {
    deps.add("firebase_core");
    deps.add("cloud_firestore");
  }
  if (actionTypes.has("firebaseAuth")) deps.add("firebase_auth");
  if (["pickImage", "takePhoto"].some((item) => actionTypes.has(item)) || componentTypes.has("imagePicker") || permissions.camera || permissions.gallery) deps.add("image_picker");
  if (componentTypes.has("qrCode")) deps.add("qr_flutter");
  if (componentTypes.has("webView")) deps.add("webview_flutter");
  if (componentTypes.has("pdfViewer")) deps.add("syncfusion_flutter_pdfviewer");
  if (permissions.location) deps.add("geolocator");
  if (Object.values(permissions).some(Boolean)) deps.add("permission_handler");
  if (["openUrl", "openModal"].some((item) => actionTypes.has(item))) deps.add("url_launcher");
  return Array.from(deps);
}

function versionForDependency(dep) {
  return {
    provider: "^6.1.2",
    sqflite: "^2.3.3",
    path: "^1.9.0",
    firebase_core: "^3.6.0",
    cloud_firestore: "^5.4.4",
    firebase_auth: "^5.3.1",
    image_picker: "^1.1.2",
    qr_flutter: "^4.1.0",
    webview_flutter: "^4.10.0",
    syncfusion_flutter_pdfviewer: "^27.1.58",
    geolocator: "^13.0.1",
    permission_handler: "^11.3.1",
    url_launcher: "^6.3.0",
    flutter_launcher_icons: "^0.14.1",
    flutter_native_splash: "^2.4.1",
  }[dep] || "any";
}

function allActionTypes(builderJson) {
  const types = new Set();
  (builderJson.flows || []).forEach((flow) => (flow.nodes || []).forEach((node) => types.add(node.type)));
  (builderJson.screens || []).forEach((screen) => (screen.components || []).forEach((component) => {
    Object.values(component.events || {}).flat().forEach((action) => types.add(action.type));
  }));
  return types;
}

function hasAction(builderJson, actions) {
  const types = allActionTypes(builderJson);
  return actions.some((action) => types.has(action));
}

function routeForScreen(screen) {
  return `/${slug(screen.name || screen.id, "screen").replace(/_/g, "-")}`;
}

function routeForId(id) {
  return `/${String(id || "screen").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function routeFieldName(screen) {
  return slug(screen.name || screen.id, "screen");
}

function routeConstName(screen) {
  return `AppRoutes.${routeFieldName(screen)}`;
}

function screenClassName(screen) {
  return `${pascal(screen.name || screen.id, "Screen")}Screen`;
}

function singular(value) {
  const text = String(value || "item");
  const lower = text.toLowerCase();
  const irregular = {
    pacientes: "paciente",
    lecciones: "leccion",
    colecciones: "coleccion",
  };
  if (irregular[lower]) return irregular[lower];
  if (text.endsWith("es")) return text.slice(0, -2);
  if (text.endsWith("s")) return text.slice(0, -1);
  return text;
}

function dartType(type) {
  return {
    string: "String",
    number: "double",
    boolean: "bool",
    date: "String",
    image: "String",
    list: "List<dynamic>",
    object: "Map<String, dynamic>",
    relation: "String",
  }[type] || "dynamic";
}

function dartDefault(type) {
  return {
    string: "''",
    number: "0",
    boolean: "false",
    date: "''",
    image: "''",
    list: "<dynamic>[]",
    object: "<String, dynamic>{}",
    relation: "''",
  }[type] || "null";
}

export function generateSingleMainDart(builderJson) {
  return generateFlutterCode(builderJson);
}
