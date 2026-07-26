export function generateFlutterCode(builderJson) {
  const viewport = builderJson.viewport || { width: 390, height: 720 };
  const theme = normalizeFlutterTheme(builderJson.theme);
  const screens = normalizeScreens(builderJson);
  const variableDeclarations = generateVariableDeclarations(builderJson);
  const dataCode = generateDataCode(builderJson);
  const flowCode = generateFlowCode(builderJson);
  const crudCode = generateCrudCode(builderJson);
  const startScreenId = builderJson.startScreenId || builderJson.activeScreenId || screens[0]?.id;
  const initialRoute = routeForScreen(startScreenId);
  const routes = screens
    .map((screen) => `        '${routeForScreen(screen.id)}': (context) => const ${classNameForScreen(screen)}(),`)
    .join("\n");
  const screenClasses = screens.map((screen) => generateScreenClass(screen, viewport, theme)).join("\n\n");

  const componentTypes = new Set(screens.flatMap((screen) => (screen.components || []).map((component) => component.type)));
  const packageImports = [
    componentTypes.has("qrCode") ? "import 'package:qr_flutter/qr_flutter.dart';" : "",
  ].filter(Boolean).join("\n");

  return `import 'package:flutter/material.dart';
${packageImports}

void main() => runApp(const GeneratedApp());

class GeneratedApp extends StatelessWidget {
  const GeneratedApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: '${escapeDartString(builderJson.projectName || "GanFlow")}',
      theme: ${generateThemeData(theme)},
      initialRoute: '${initialRoute}',
      routes: {
${routes}
      },
    );
  }
}

${screenClasses}

${variableDeclarations}

${dataCode}

${flowCode}

${crudCode}

Future<void> openGeneratedUrl(String url) async {
  debugPrint('Abrir URL pendiente de integrar: $url');
}

Future<void> pickGeneratedImage(String variableName) async {
  debugPrint('Pick image pendiente. Guardar en variable: $variableName');
}

Future<void> saveToLocalDatabase(String table, Map<String, dynamic> fields) async {
  debugPrint('Guardar local pendiente: $table -> $fields');
}

Future<void> readFromLocalDatabase(String table, Map<String, dynamic> filters, String targetVariable) async {
  debugPrint('Leer local pendiente: $table / $filters -> $targetVariable');
}

Future<void> saveToFirebase(String collection, Map<String, dynamic> fields) async {
  debugPrint('Guardar Firebase pendiente: $collection -> $fields');
}

Future<void> readFromFirebase(String collection, Map<String, dynamic> filters, String targetVariable) async {
  debugPrint('Leer Firebase pendiente: $collection / $filters -> $targetVariable');
}
`;
}

function normalizeScreens(builderJson) {
  if (Array.isArray(builderJson.screens) && builderJson.screens.length > 0) {
    return builderJson.screens;
  }

  return [
    {
      id: builderJson.activeScreenId || "screen-home",
      name: "Inicio",
      components: builderJson.components || [],
    },
  ];
}

function normalizeFlutterTheme(theme) {
  const base = {
    name: "Moderno claro",
    mode: "light",
    colors: { primary: "#2563eb", secondary: "#14b8a6", background: "#f1f5f9", surface: "#ffffff", text: "#111827", border: "#e2e8f0" },
    typography: { fontFamily: "Inter", baseSize: 12, titleSize: 18, weight: 400 },
    shape: { radius: 12 },
    effects: { shadow: "soft" },
    spacing: { base: 8 },
    componentStyles: {},
  };
  const merged = {
    ...base,
    ...(theme || {}),
    colors: { ...base.colors, ...(theme?.colors || {}) },
    typography: { ...base.typography, ...(theme?.typography || {}) },
    shape: { ...base.shape, ...(theme?.shape || {}) },
    effects: { ...base.effects, ...(theme?.effects || {}) },
    spacing: { ...base.spacing, ...(theme?.spacing || {}) },
    componentStyles: { ...base.componentStyles, ...(theme?.componentStyles || {}) },
  };
  return merged;
}

function generateThemeData(theme) {
  const radius = toDartNumber(theme.shape.radius);
  return `ThemeData(
        brightness: ${theme.mode === "dark" ? "Brightness.dark" : "Brightness.light"},
        useMaterial3: true,
        fontFamily: '${escapeDartString(theme.typography.fontFamily)}',
        scaffoldBackgroundColor: ${toFlutterColor(theme.colors.background)},
        colorScheme: ColorScheme.fromSeed(
          seedColor: ${toFlutterColor(theme.colors.primary)},
          primary: ${toFlutterColor(theme.colors.primary)},
          secondary: ${toFlutterColor(theme.colors.secondary)},
          surface: ${toFlutterColor(theme.colors.surface)},
          brightness: ${theme.mode === "dark" ? "Brightness.dark" : "Brightness.light"},
        ),
        textTheme: TextTheme(
          bodyMedium: TextStyle(color: ${toFlutterColor(theme.colors.text)}, fontSize: ${toDartNumber(theme.typography.baseSize)}, fontWeight: FontWeight.w${theme.typography.weight || 400}),
          titleMedium: TextStyle(color: ${toFlutterColor(theme.colors.text)}, fontSize: ${toDartNumber(theme.typography.titleSize)}, fontWeight: FontWeight.w500),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: ${toFlutterColor(theme.componentStyles.buttons?.backgroundColor || theme.colors.primary)},
            foregroundColor: ${toFlutterColor(theme.componentStyles.buttons?.color || "#ffffff")},
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(${toDartNumber(theme.componentStyles.buttons?.borderRadius ?? radius)})),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: ${toFlutterColor(theme.componentStyles.inputs?.backgroundColor || theme.colors.surface)},
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(${toDartNumber(theme.componentStyles.inputs?.borderRadius ?? radius)}),
            borderSide: BorderSide(color: ${toFlutterColor(theme.colors.border)}),
          ),
        ),
        cardTheme: CardThemeData(
          color: ${toFlutterColor(theme.componentStyles.cards?.backgroundColor || theme.colors.surface)},
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(${toDartNumber(theme.componentStyles.cards?.borderRadius ?? radius)})),
          elevation: ${theme.effects.shadow === "none" ? "0" : theme.effects.shadow === "medium" ? "4" : "2"},
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: ${toFlutterColor(theme.componentStyles.appbars?.backgroundColor || theme.colors.primary)},
          foregroundColor: ${toFlutterColor(theme.componentStyles.appbars?.color || "#ffffff")},
          elevation: ${theme.effects.shadow === "none" ? "0" : "1"},
        ),
      )`;
}

function themedPropsForComponent(component, theme) {
  const props = component.props || {};
  if (props.useThemeStyle === false) return props;
  const key = {
    button: "buttons",
    text: "texts",
    input: "inputs",
    select: "inputs",
    checkbox: "inputs",
    switch: "inputs",
    card: "cards",
    container: "cards",
    appbar: "appbars",
    list: "lists",
    form: "forms",
  }[component.type] || "cards";
  const style = theme.componentStyles[key] || {};
  return {
    ...props,
    color: style.color || props.color,
    backgroundColor: style.backgroundColor || props.backgroundColor,
    borderRadius: style.borderRadius ?? props.borderRadius,
    fontSize: style.fontSize ?? props.fontSize,
  };
}

function generateScreenClass(screen, viewport, theme) {
  const components = (screen.components || []).filter((component) => !component.props?.hidden);
  const positionedChildren = components.map((component) => generatePositionedComponent(component, screen, theme)).join("\n\n");
  const settings = screen.settings || {};
  const appBar = settings.appBar || {};
  const viewportConfig = normalizeResponsiveViewport(settings.viewport, viewport);
  const baseMode = viewportConfig.mode || "mobile";
  const width = viewportConfig[baseMode]?.width || settings.width || viewport.width;
  const height = viewportConfig[baseMode]?.height || settings.height || viewport.height;

  return `class ${classNameForScreen(screen)} extends StatelessWidget {
  const ${classNameForScreen(screen)}({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ${toFlutterColor(settings.background || theme.colors.background)},
      drawer: ${settings.drawer?.enabled ? generateScreenDrawer(settings.drawer) : "null"},
      appBar: ${appBar.enabled ? generateScreenAppBar(appBar, settings.drawer) : "null"},
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final scale = (constraints.maxWidth / ${toDartNumber(width)}).clamp(0.2, constraints.maxHeight / ${toDartNumber(appBar.enabled ? Math.max(0, height - (Number(appBar.height) || 0)) : height)}).toDouble();
            return Center(
              child: Transform.scale(
                scale: scale,
                alignment: Alignment.topCenter,
                child: SizedBox(
                  width: ${toDartNumber(width)},
                  height: ${toDartNumber(appBar.enabled ? Math.max(0, height - (Number(appBar.height) || 0)) : height)},
                  child: Stack(
                    children: [
${positionedChildren || "                // Agrega componentes en GanFlow para generar widgets."}
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
}`;
}

function generateScreenAppBar(appBar, drawer = {}) {
  const actions = normalizeMenuItems(appBar.actions)
    .map((action) => `          IconButton(onPressed: () {
${generateConfiguredActionDart(action.action, "            ")}
          }, icon: const Icon(Icons.${toFlutterIconName(action.icon)}), tooltip: '${escapeDartString(action.label)}'),`)
    .join("\n");
  const moreItems = normalizeMenuItems(appBar.moreMenu);
  const popup = appBar.showMore || moreItems.length > 0 ? `          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              switch (value) {
${moreItems.map((item) => `                case '${escapeDartString(item.id)}':
${generateConfiguredActionDart(item.action, "                  ")}
                  break;`).join("\n")}
              }
            },
            itemBuilder: (context) => [
${moreItems.map((item) => `              const PopupMenuItem(value: '${escapeDartString(item.id)}', child: Row(children: [Icon(Icons.${toFlutterIconName(item.icon)}, size: 18), SizedBox(width: 8), Text('${escapeDartString(item.label)}')])),`).join("\n") || "              const PopupMenuItem(value: 'empty', child: Text('Sin opciones')),"}
            ],
          ),` : "";
  return `AppBar(
        title: Text('${escapeDartString(appBar.title || "")}'),
        centerTitle: ${appBar.titleAlign === "center" ? "true" : "false"},
        backgroundColor: ${toFlutterColor(appBar.backgroundColor)},
        foregroundColor: ${toFlutterColor(appBar.textColor)},
        elevation: ${appBar.shadow === false ? "0" : "2"},
        leading: ${appBar.showBack ? "const BackButton()" : drawer?.enabled && appBar.showMenu !== false ? "Builder(builder: (context) => IconButton(onPressed: () => Scaffold.of(context).openDrawer(), icon: const Icon(Icons.menu)))" : "null"},
        actions: [
${actions}
${popup}
        ],
      )`;
}

function generateScreenDrawer(drawer = {}) {
  const items = normalizeMenuItems(drawer.items);
  return `Drawer(
        child: SafeArea(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
${items.map((item) => `              ListTile(
                leading: const Icon(Icons.${toFlutterIconName(item.icon)}),
                title: Text('${escapeDartString(item.label)}'),
                onTap: () {
                  Navigator.pop(context);
${generateConfiguredActionDart(item.action, "                  ")}
                },
              ),`).join("\n") || "              const ListTile(title: Text('Drawer sin items')),"}
            ],
          ),
        ),
      )`;
}

function generatePositionedComponent(component, screen, theme) {
  const props = themedPropsForComponent(component, theme);
  const appBarHeight = screen.settings?.appBar?.enabled ? Number(screen.settings.appBar.height) || 0 : 0;
  const themedComponent = { ...component, props };
  const child = wrapWithConditions(themedComponent, generateWidget(themedComponent, screen));

  return `                Positioned(
                  left: ${toDartNumber(props.x)},
                  top: ${toDartNumber(Math.max(0, Number(props.y || 0) - appBarHeight))},
                  width: ${toDartNumber(props.width)},
                  height: ${toDartNumber(props.height)},
                  child: ${child},
                ),`;
}

function generateWidget(component, screen) {
  const props = component.props || {};
  const rawText = props.formula || props.text || component.name || "";
  const text = conditionalTextExpression(props, rawText);
  const textStyle = `TextStyle(color: ${toFlutterColor(props.color)}, fontSize: ${toDartNumber(props.fontSize)})`;
  const radius = toDartNumber(props.borderRadius);
  const background = toFlutterColor(props.backgroundColor);

  if (component.type === "text") {
    return `Text(
                    ${text},
                    style: ${textStyle},
                  )`;
  }

  if (component.type === "button") {
    return `ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ${background},
                      foregroundColor: ${toFlutterColor(props.color)},
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(${radius}),
                      ),
                    ),
                    onPressed: ${conditionToDart(props.enabledIf) === "true" ? "() {" : conditionToDart(props.enabledIf) + " ? () {"}
${generateActionBody(component, screen, "                      ")}
                    }${conditionToDart(props.enabledIf) === "true" ? "" : " : null"},
                    child: Text(
                      ${text},
                      style: TextStyle(fontSize: ${toDartNumber(props.fontSize)}),
                    ),
                  )`;
  }

  if (component.type === "input") {
    return `TextField(
                    decoration: InputDecoration(
                      hintText: ${text},
                      filled: true,
                      fillColor: ${background},
                      hintStyle: ${textStyle},
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(${radius}),
                      ),
                    ),
                  )`;
  }

  if (component.type === "textarea") {
    return `TextField(
                    maxLines: null,
                    expands: true,
                    decoration: InputDecoration(
                      hintText: ${text},
                      filled: true,
                      fillColor: ${background},
                      hintStyle: ${textStyle},
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(${radius}),
                      ),
                    ),
                  )`;
  }

  if (component.type === "datePicker") {
    return `OutlinedButton.icon(
                    onPressed: () => showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime.tryParse('${escapeDartString(props.minDate || "2000-01-01")}') ?? DateTime(2000),
                      lastDate: DateTime.tryParse('${escapeDartString(props.maxDate || "2100-12-31")}') ?? DateTime(2100),
                    ),
                    icon: const Icon(Icons.calendar_today),
                    label: Text(${text}),
                  )`;
  }

  if (component.type === "timePicker") {
    return `OutlinedButton.icon(
                    onPressed: () => showTimePicker(context: context, initialTime: TimeOfDay.now()),
                    icon: const Icon(Icons.schedule),
                    label: Text(${text}),
                  )`;
  }

  if (component.type === "image") {
    return `ClipRRect(
                    borderRadius: BorderRadius.circular(${radius}),
                    child: Image.network(
                      'https://picsum.photos/600/400',
                      fit: BoxFit.cover,
                    ),
                  )`;
  }

  if (component.type === "container") {
    return decoratedBox(text, textStyle, background, radius);
  }

  if (component.type === "card") {
    return withTapAction(component, screen, `Card(
                    color: ${background},
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(${radius}),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        ${text},
                        style: ${textStyle},
                      ),
                    ),
                  )`);
  }

  if (component.type === "appbar") {
    return `Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: ${background},
                      borderRadius: BorderRadius.circular(${radius}),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(${text}, style: ${textStyle}),
                        const Icon(Icons.search, color: Colors.white),
                      ],
                    ),
                  )`;
  }

  if (component.type === "drawer") {
    return `Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: ${background},
                      borderRadius: BorderRadius.circular(${radius}),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ListTile(leading: Icon(Icons.menu), title: Text('Menu')),
                        ListTile(title: Text('Inicio')),
                        ListTile(title: Text('Perfil')),
                        ListTile(title: Text('Ajustes')),
                      ],
                    ),
                  )`;
  }

  if (component.type === "list") {
    if (props.dataTable) {
      const titleField = props.dataTitleField || "nombre";
      const subtitleField = props.dataSubtitleField || "id";
      return `FutureBuilder<List<Map<String, dynamic>>>(
                    future: loadGeneratedList('${escapeDartString(props.dataTable)}'),
                    builder: (context, snapshot) {
                      final rows = snapshot.data ?? <Map<String, dynamic>>[];
                      return ListView.builder(
                        padding: EdgeInsets.zero,
                        itemCount: rows.length,
                        itemBuilder: (context, index) {
                          final row = rows[index];
                          return ListTile(
                            title: Text('\${row['${escapeDartString(titleField)}'] ?? ''}'),
                            subtitle: Text('\${row['${escapeDartString(subtitleField)}'] ?? ''}'),
                          );
                        },
                      );
                    },
                  )`;
    }

    const items = String(rawText).split("\n").filter(Boolean);
    const tiles = (items.length ? items : ["Elemento 1", "Elemento 2", "Elemento 3"])
      .map((item) => `                        ListTile(title: Text(${dartTextExpression(item)})),`)
      .join("\n");

    return `Container(
                    decoration: BoxDecoration(
                      color: ${background},
                      borderRadius: BorderRadius.circular(${radius}),
                    ),
                    child: ListView(
                      padding: EdgeInsets.zero,
                      children: [
${tiles}
                      ],
                    ),
                  )`;
  }

  if (component.type === "checkbox") {
    return `CheckboxListTile(
                    value: true,
                    onChanged: (_) {},
                    title: Text(${text}, style: ${textStyle}),
                    controlAffinity: ListTileControlAffinity.leading,
                  )`;
  }

  if (component.type === "switch") {
    return `SwitchListTile(
                    value: true,
                    onChanged: (_) {},
                    title: Text(${text}, style: ${textStyle}),
                  )`;
  }

  if (component.type === "slider") {
    return `Slider(
                    min: ${toDartNumber(props.min ?? 0)},
                    max: ${toDartNumber(props.max ?? 100)},
                    divisions: ${Number(props.step) ? Math.max(1, Math.round((Number(props.max ?? 100) - Number(props.min ?? 0)) / Number(props.step))) : "null"},
                    value: ${toDartNumber(props.value ?? 0)},
                    onChanged: (_) {},
                  )`;
  }

  if (component.type === "radioGroup") {
    const radios = optionsFromText(props.options || props.text).map((option) => `                        RadioListTile<String>(value: '${escapeDartString(option)}', groupValue: '${escapeDartString(props.value || option)}', onChanged: (_) {}, title: Text('${escapeDartString(option)}')),`).join("\n");
    return `Column(
                    children: [
${radios}
                    ],
                  )`;
  }

  if (component.type === "select") {
    return `DropdownButtonFormField<String>(
                    value: ${text},
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: ${background},
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(${radius}),
                      ),
                    ),
                    items: [
                      DropdownMenuItem(value: ${text}, child: Text(${text})),
                    ],
                    onChanged: (_) {},
                  )`;
  }

  if (component.type === "tabs") {
    const tabs = optionsFromText(props.tabs || props.text).map((item) => `Tab(text: '${escapeDartString(item)}')`).join(", ");
    return `DefaultTabController(
                    length: ${Math.max(1, optionsFromText(props.tabs || props.text).length)},
                    child: TabBar(tabs: [${tabs || "const Tab(text: 'Tab')"}]),
                  )`;
  }

  if (component.type === "bottomNavigation") {
    const items = optionsFromText(props.items || props.text).map((item) => `BottomNavigationBarItem(icon: const Icon(Icons.circle), label: '${escapeDartString(item)}')`).join(", ");
    return `BottomNavigationBar(
                    currentIndex: ${Number(props.selectedIndex) || 0},
                    onTap: (_) {},
                    items: [${items || "const BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Inicio')"}],
                  )`;
  }

  if (component.type === "floatingActionButton") {
    return `FloatingActionButton(
                    onPressed: () {
${generateActionBody(component, screen, "                      ")}
                    },
                    backgroundColor: ${background},
                    foregroundColor: ${toFlutterColor(props.color)},
                    child: const Icon(Icons.add),
                  )`;
  }

  if (component.type === "divider") {
    return `Divider(
                    color: ${background},
                    thickness: ${toDartNumber(props.height || 1)},
                  )`;
  }

  if (component.type === "avatar") {
    return `CircleAvatar(
                    backgroundColor: ${background},
                    child: Text(
                      ${dartTextExpression(String(props.text || "A").slice(0, 2).toUpperCase())},
                      style: ${textStyle},
                    ),
                  )`;
  }

  if (component.type === "icon") {
    return withTapAction(component, screen, `Icon(
                    Icons.star,
                    color: ${toFlutterColor(props.color)},
                    size: ${toDartNumber(props.fontSize || props.width)},
                  )`);
  }

  if (component.type === "qrCode") {
    return `QrImageView(
                    data: '${escapeDartString(props.value || props.text || "")}',
                    size: ${toDartNumber(props.size || props.width || 120)},
                  )`;
  }

  if (component.type === "webView") {
    return `const Center(
                    child: Text('WebView listo: agrega webview_flutter y carga la URL configurada.'),
                  )`;
  }

  if (component.type === "pdfViewer") {
    return `const Center(
                    child: Text('PDFViewer placeholder: dependencia preparada para visor PDF.'),
                  )`;
  }

  if (component.type === "imagePicker") {
    return `OutlinedButton.icon(
                    onPressed: () => pickGeneratedImage('${escapeDartString(component.id)}'),
                    icon: const Icon(Icons.image),
                    label: Text(${text}),
                  )`;
  }

  if (component.type === "filePicker") {
    return `OutlinedButton.icon(
                    onPressed: () => debugPrint('FilePicker pendiente de integrar'),
                    icon: const Icon(Icons.attach_file),
                    label: Text(${text}),
                  )`;
  }

  if (component.type === "modal" || component.type === "alertDialog") {
    return `OutlinedButton(
                    onPressed: () => showDialog(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: Text('${escapeDartString(props.title || "Modal")}'),
                        content: Text(${text}),
                      ),
                    ),
                    child: Text('${escapeDartString(props.title || component.name || "Modal")}'),
                  )`;
  }

  if (component.type === "video") {
    return `Container(
                    decoration: BoxDecoration(
                      color: ${background},
                      borderRadius: BorderRadius.circular(${radius}),
                    ),
                    child: const Center(
                      child: Icon(Icons.play_circle_fill, color: Colors.white, size: 48),
                    ),
                  )`;
  }

  return decoratedBox(text, textStyle, background, radius);
}

function withTapAction(component, screen, childCode) {
  if (!hasTapActions(component)) return childCode;

  return `GestureDetector(
                    onTap: () {
${generateActionBody(component, screen, "                      ")}
                    },
                    child: ${childCode},
                  )`;
}

function generateActionBody(component, screen, indent) {
  const props = component.props || {};
  const visualActions = component.events?.onTap || [];

  if (visualActions.length > 0) {
    return visualActions.map((action) => generateVisualAction(action, indent)).join("\n");
  }

  if (props.actionType === "navigate" && props.actionTarget) {
    return `${indent}Navigator.pushNamed(context, '${routeForScreen(props.actionTarget)}');`;
  }

  if (props.actionType === "link") {
    return `${indent}debugPrint('Abrir enlace: ${escapeDartString(props.actionUrl || "")}');`;
  }

  if (props.actionType === "message") {
    return `${indent}ScaffoldMessenger.of(context).showSnackBar(
${indent}  const SnackBar(content: Text('${escapeDartString(props.actionMessage || "Mensaje")}')),
${indent});`;
  }

  return `${indent}// Sin accion configurada en ${escapeDartString(screen.name)}.`;
}

function generateConfiguredActionDart(action = {}, indent = "  ") {
  const type = action.type === "navigateToScreen" ? "navigateTo" : action.type;
  const screen = action.screenId || action.screen || "";
  if (type === "navigateTo" && screen) return `${indent}Navigator.pushNamed(context, '${routeForScreen(screen)}');`;
  if (type === "showMessage") {
    return `${indent}ScaffoldMessenger.of(context).showSnackBar(
${indent}  const SnackBar(content: Text('${escapeDartString(action.message || "Mensaje")}')),
${indent});`;
  }
  if (type === "openModal") {
    return `${indent}showDialog(
${indent}  context: context,
${indent}  builder: (_) => AlertDialog(content: Text('${escapeDartString(action.message || action.modalId || "Modal")}')),
${indent});`;
  }
  if (type === "openUrl") return `${indent}openGeneratedUrl('${escapeDartString(action.url || "")}');`;
  return `${indent}debugPrint('Accion AppBar pendiente: ${escapeDartString(type || "accion")}');`;
}

function hasTapActions(component) {
  return (component.events?.onTap || []).length > 0 || ["navigate", "link", "message"].includes(component.props?.actionType);
}

function generateVisualAction(action, indent) {
  const params = action.params || {};

  if (action.type === "navigateToScreen" && params.screenId) {
    return `${indent}Navigator.pushNamed(context, '${routeForScreen(params.screenId)}');`;
  }

  if (action.type === "showMessage") {
    return `${indent}ScaffoldMessenger.of(context).showSnackBar(
${indent}  const SnackBar(content: Text('${escapeDartString(params.message || "Mensaje")}')),
${indent});`;
  }

  if (action.type === "openUrl") {
    return `${indent}openGeneratedUrl('${escapeDartString(params.url || "")}');`;
  }

  if (action.type === "pickImage") {
    return `${indent}pickGeneratedImage('${escapeDartString(params.variable || "selectedImage")}');`;
  }

  if (action.type === "setVariable") {
    return `${indent}debugPrint('Set variable ${escapeDartString(params.name || "variable")} = ${escapeDartString(params.value || "")}');`;
  }

  if (action.type === "clearForm") {
    return `${indent}debugPrint('Limpiar formulario: ${escapeDartString(params.formId || "")}');`;
  }

  if (action.type === "showComponent") {
    return `${indent}debugPrint('Mostrar componente: ${escapeDartString(params.componentId || "")}');`;
  }

  if (action.type === "hideComponent") {
    return `${indent}debugPrint('Ocultar componente: ${escapeDartString(params.componentId || "")}');`;
  }

  if (action.type === "openModal") {
    return `${indent}showDialog(
${indent}  context: context,
${indent}  builder: (_) => const AlertDialog(content: Text('Modal generado')),
${indent});`;
  }

  if (action.type === "closeModal") {
    return `${indent}Navigator.of(context).maybePop();`;
  }

  if (action.type === "saveToLocalDatabase") {
    return `${indent}saveToLocalDatabase('${escapeDartString(params.table || "tabla")}', ${toDartMap(params.fields)});`;
  }

  if (action.type === "readFromLocalDatabase") {
    return `${indent}readFromLocalDatabase('${escapeDartString(params.table || "tabla")}', ${toDartMap(params.filters)}, '${escapeDartString(params.targetVariable || "resultado")}');`;
  }

  if (action.type === "saveToFirebase") {
    return `${indent}saveToFirebase('${escapeDartString(params.collection || "coleccion")}', ${toDartMap(params.fields)});`;
  }

  if (action.type === "readFromFirebase") {
    return `${indent}readFromFirebase('${escapeDartString(params.collection || "coleccion")}', ${toDartMap(params.filters)}, '${escapeDartString(params.targetVariable || "resultado")}');`;
  }

  if (action.type === "createRecord") {
    return `${indent}createLocalRecord('${escapeDartString(params.table || "tabla")}', ${toDartMap(params.values)});`;
  }

  if (action.type === "updateRecord") {
    return `${indent}updateLocalRecord('${escapeDartString(params.table || "tabla")}', '${escapeDartString(params.recordId || "")}', ${toDartMap(params.values)});`;
  }

  if (action.type === "deleteRecord") {
    return `${indent}deleteLocalRecord('${escapeDartString(params.table || "tabla")}', '${escapeDartString(params.recordId || "")}');`;
  }

  if (action.type === "getRecord") {
    return `${indent}getLocalRecord('${escapeDartString(params.table || "tabla")}', '${escapeDartString(params.recordId || "")}', '${escapeDartString(params.targetVariable || "registro")}');`;
  }

  if (action.type === "listRecords" || action.type === "filterRecords") {
    return `${indent}listLocalRecords('${escapeDartString(params.table || "tabla")}', ${toDartMap(params.filters)}, '${escapeDartString(params.targetVariable || "registros")}');`;
  }

  return `${indent}debugPrint('Accion pendiente: ${escapeDartString(action.type || "accion")}');`;
}

function toDartMap(value) {
  if (!value) return "<String, dynamic>{}";
  if (typeof value === "object") return jsonToDartMap(value);

  try {
    return jsonToDartMap(JSON.parse(value));
  } catch {
    return `<String, dynamic>{'raw': '${escapeDartString(value)}'}`;
  }
}

function jsonToDartMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "<String, dynamic>{}";
  const entries = Object.entries(value)
    .map(([key, entryValue]) => `'${escapeDartString(key)}': '${escapeDartString(String(entryValue))}'`)
    .join(", ");
  return `<String, dynamic>{${entries}}`;
}

function generateVariableDeclarations(builderJson) {
  const screens = normalizeScreens(builderJson);
  const globalVariables = builderJson.variables?.global || [];
  const localVariables = builderJson.variables?.local || [];
  const screenVariables = screens.flatMap((screen) => screen.variables || []);
  const allVariables = [...globalVariables, ...screenVariables, ...localVariables];

  if (allVariables.length === 0) return "// Variables generadas apareceran aqui.";

  return allVariables
    .map((variable) => `${dartTypeForVariable(variable.type)} ${safeDartName(variable.name)} = ${dartInitialValue(variable)};`)
    .join("\n");
}

function generateDataCode(builderJson) {
  const tables = (builderJson.dataSources || []).flatMap((source) =>
    (source.tables || []).map((table) => ({ ...table, sourceType: source.type })),
  );

  if (tables.length === 0) return "// Modelos de datos generados apareceran aqui.";

  const models = tables.map(generateModelForTable).join("\n\n");
  return `${models}

Future<void> createLocalRecord(String table, Map<String, dynamic> values) async {
  debugPrint('SQLite create pendiente: $table -> $values');
}

Future<void> updateLocalRecord(String table, String id, Map<String, dynamic> values) async {
  debugPrint('SQLite update pendiente: $table / $id -> $values');
}

Future<void> deleteLocalRecord(String table, String id) async {
  debugPrint('SQLite delete pendiente: $table / $id');
}

Future<void> getLocalRecord(String table, String id, String targetVariable) async {
  debugPrint('SQLite get pendiente: $table / $id -> $targetVariable');
}

Future<void> listLocalRecords(String table, Map<String, dynamic> filters, String targetVariable) async {
  debugPrint('SQLite list pendiente: $table / $filters -> $targetVariable');
}

Future<List<Map<String, dynamic>>> loadGeneratedList(String table) async {
  debugPrint('Cargar lista pendiente: $table');
  return <Map<String, dynamic>>[];
}`;
}

function generateFlowCode(builderJson) {
  const flows = builderJson.flows || [];
  if (flows.length === 0) return "// Funciones de flujos generadas apareceran aqui.";

  return flows.map((flow) => {
    const body = (flow.nodes || [])
      .map((node) => generateFlowNodeStatement(node, "  "))
      .join("\n");
    return `Future<void> ${safeDartName(flow.name || flow.id)}Flow(BuildContext context) async {
${body || "  // Flujo sin nodos."}
}`;
  }).join("\n\n");
}

function generateFlowNodeStatement(node, indent) {
  const params = node.params || {};
  if (["onClick", "onLoad", "onChange", "onSubmit"].includes(node.type)) {
    return `${indent}// Evento: ${node.type}`;
  }
  if (node.type === "navigateTo" && params.screenId) {
    return `${indent}Navigator.pushNamed(context, '${routeForScreen(params.screenId)}');`;
  }
  if (node.type === "openModal") {
    return `${indent}showDialog(context: context, builder: (_) => const AlertDialog(content: Text('Modal generado')));`;
  }
  if (node.type === "closeModal") {
    return `${indent}Navigator.of(context).maybePop();`;
  }
  if (node.type === "showMessage" || node.type === "showSnackbar") {
    return `${indent}ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('${escapeDartString(params.message || "Mensaje")}')));`;
  }
  if (node.type === "showDialog") {
    return `${indent}showDialog(context: context, builder: (_) => const AlertDialog(content: Text('${escapeDartString(params.message || "Mensaje")}')));`;
  }
  if (node.type === "pickImage") {
    return `${indent}pickGeneratedImage('${escapeDartString(params.variable || "selectedImage")}');`;
  }
  if (node.type === "takePhoto") {
    return `${indent}debugPrint('Tomar foto pendiente de integrar');`;
  }
  if (node.type === "pickFile") {
    return `${indent}debugPrint('Seleccionar archivo pendiente de integrar');`;
  }
  if (node.type === "setVariable") {
    return `${indent}debugPrint('Set variable ${escapeDartString(params.variable || "")}');`;
  }
  if (node.type === "clearVariable") {
    return `${indent}debugPrint('Clear variable ${escapeDartString(params.variable || "")}');`;
  }
  if (node.type === "incrementVariable") {
    return `${indent}debugPrint('Increment variable ${escapeDartString(params.variable || "")}');`;
  }
  if (node.type === "createRecord") {
    return `${indent}createLocalRecord('${escapeDartString(params.table || "tabla")}', <String, dynamic>{});`;
  }
  if (node.type === "updateRecord") {
    return `${indent}updateLocalRecord('${escapeDartString(params.table || "tabla")}', '', <String, dynamic>{});`;
  }
  if (node.type === "deleteRecord") {
    return `${indent}deleteLocalRecord('${escapeDartString(params.table || "tabla")}', '');`;
  }
  if (node.type === "getRecord") {
    return `${indent}getLocalRecord('${escapeDartString(params.table || "tabla")}', '', 'registro');`;
  }
  if (node.type === "listRecords") {
    return `${indent}listLocalRecords('${escapeDartString(params.table || "tabla")}', <String, dynamic>{}, 'registros');`;
  }
  if (["if", "else", "switch", "forEach"].includes(node.type)) {
    return `${indent}// Logica pendiente: ${node.type}`;
  }
  if (node.type === "customFunction") {
    return `${indent}debugPrint('Funcion personalizada: ${escapeDartString(params.functionName || node.label || "customFunction")}');`;
  }
  return `${indent}debugPrint('Nodo pendiente: ${escapeDartString(node.type)}');`;
}

function generateCrudCode(builderJson) {
  const modules = builderJson.crudModules || [];
  if (modules.length === 0) return "// Modulos CRUD generados apareceran aqui.";

  const tables = (builderJson.dataSources || []).flatMap((source) => source.tables || []);

  return modules.map((module) => {
    const table = tables.find((item) => item.id === module.tableId);
    const tableId = module.tableId || table?.id || "tabla";
    const baseName = upperDartName(module.moduleName || table?.name || tableId);
    const functionName = lowerDartName(module.moduleName || table?.name || tableId);
    const listRoute = module.screenIds?.list ? routeForScreen(module.screenIds.list) : "";
    const detailRoute = module.screenIds?.detail ? routeForScreen(module.screenIds.detail) : "";
    const createRoute = module.screenIds?.create ? routeForScreen(module.screenIds.create) : "";
    const editRoute = module.screenIds?.edit ? routeForScreen(module.screenIds.edit) : "";

    return `Future<List<Map<String, dynamic>>> list${baseName}Records() async {
  return loadGeneratedList('${escapeDartString(tableId)}');
}

Future<void> create${baseName}Record(Map<String, dynamic> values) async {
  await createLocalRecord('${escapeDartString(tableId)}', values);
}

Future<void> update${baseName}Record(String id, Map<String, dynamic> values) async {
  await updateLocalRecord('${escapeDartString(tableId)}', id, values);
}

Future<void> delete${baseName}Record(String id) async {
  await deleteLocalRecord('${escapeDartString(tableId)}', id);
}

void open${baseName}List(BuildContext context) {
  Navigator.pushNamed(context, '${escapeDartString(listRoute)}');
}

void open${baseName}Create(BuildContext context) {
  Navigator.pushNamed(context, '${escapeDartString(createRoute)}');
}

void open${baseName}Detail(BuildContext context) {
  ${detailRoute ? `Navigator.pushNamed(context, '${escapeDartString(detailRoute)}');` : "debugPrint('Detalle no generado para este CRUD.');"}
}

void open${baseName}Edit(BuildContext context) {
  ${editRoute ? `Navigator.pushNamed(context, '${escapeDartString(editRoute)}');` : "debugPrint('Edicion no generada para este CRUD.');"}
}

// Alias compacto para integrar el modulo ${escapeDartString(module.moduleName || tableId)} en acciones personalizadas.
final ${functionName}CrudReady = true;`;
  }).join("\n\n");
}

function generateModelForTable(table) {
  const className = classNameForData(table.name);
  const fields = (table.fields || []).map((field) => `  final ${dartTypeForField(field.type)} ${safeDartName(field.name)};`).join("\n");
  const constructorFields = (table.fields || []).map((field) => `    required this.${safeDartName(field.name)},`).join("\n");
  const fromJsonFields = (table.fields || []).map((field) => `      ${safeDartName(field.name)}: json['${escapeDartString(field.name)}'] as ${dartTypeForField(field.type)}? ?? ${dartDefaultForField(field.type)},`).join("\n");
  const toJsonFields = (table.fields || []).map((field) => `      '${escapeDartString(field.name)}': ${safeDartName(field.name)},`).join("\n");

  return `class ${className} {
${fields}

  const ${className}({
${constructorFields}
  });

  factory ${className}.fromJson(Map<String, dynamic> json) {
    return ${className}(
${fromJsonFields}
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJsonFields}
    };
  }
}`;
}

function dartTypeForField(type) {
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

function dartDefaultForField(type) {
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

function dartTypeForVariable(type) {
  return {
    string: "String",
    number: "double",
    boolean: "bool",
    date: "DateTime",
    list: "List<dynamic>",
    object: "Map<String, dynamic>",
    image: "String",
  }[type] || "dynamic";
}

function dartInitialValue(variable) {
  const value = variable.initialValue;
  if (variable.type === "number") return Number.isFinite(Number(value)) ? String(Number(value)) : "0";
  if (variable.type === "boolean") return String(value).toLowerCase() === "true" ? "true" : "false";
  if (variable.type === "date") return value ? `DateTime.tryParse('${escapeDartString(value)}') ?? DateTime.now()` : "DateTime.now()";
  if (variable.type === "list") return "[]";
  if (variable.type === "object") return "<String, dynamic>{}";
  return `'${escapeDartString(value || "")}'`;
}

function dartTextExpression(value) {
  const source = String(value || "");
  if (!source.includes("{{")) return `'${escapeDartString(source)}'`;

  const expressionLike = /[+\-*/()]/.test(source.replace(/\{\{[^}]+\}\}/g, ""));
  if (expressionLike) {
    return source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name) => safeDartName(name));
  }

  const interpolation = source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name) => `\${${safeDartName(name)}}`);
  return `'${escapeDartString(interpolation).replace(/\\\$/g, "$")}'`;
}

function optionsFromText(value) {
  return String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function normalizeResponsiveViewport(viewport = {}, fallback = {}) {
  return {
    mode: viewport?.mode || "mobile",
    mobile: { width: 390, height: 844, ...(viewport?.mobile || {}) },
    tablet: { width: 768, height: 1024, ...(viewport?.tablet || {}) },
    desktop: { width: 1280, height: 720, ...(viewport?.desktop || fallback || {}) },
  };
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

function toFlutterIconName(value) {
  const normalized = String(value || "circle")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  return normalized || "circle";
}

function conditionalTextExpression(props, fallbackValue) {
  if (!props.ifExpression) return dartTextExpression(fallbackValue);
  const whenTrue = dartTextExpression(props.formula || props.text || fallbackValue);
  const whenFalse = dartTextExpression(props.elseExpression || "");
  return `${conditionToDart(props.ifExpression)} ? ${whenTrue} : ${whenFalse}`;
}

function conditionToDart(value) {
  if (!value) return "true";
  return String(value)
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name) => safeDartName(name))
    .replace(/\band\b/g, "&&")
    .replace(/\bor\b/g, "||");
}

function wrapWithConditions(component, childCode) {
  const props = component.props || {};
  const visibleCondition = conditionToDart(props.visibleIf);
  if (visibleCondition === "true") return childCode;

  return `Visibility(
                    visible: ${visibleCondition},
                    child: ${childCode},
                  )`;
}

function safeDartName(value) {
  const cleaned = String(value || "variable")
    .replace(/[^\w]/g, "_")
    .replace(/^(\d)/, "_$1");
  return cleaned || "variable";
}

function decoratedBox(text, textStyle, background, radius) {
  return `Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: ${background},
                      borderRadius: BorderRadius.circular(${radius}),
                    ),
                    child: Text(
                      ${text},
                      style: ${textStyle},
                    ),
                  )`;
}

function routeForScreen(screenId) {
  return `/${String(screenId || "screen").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function classNameForScreen(screen) {
  const base = String(screen.name || screen.id || "Screen")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const suffix = String(screen.id || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6);
  const className = `${base || "Screen"}Page${suffix}`;
  return /^[A-Za-z]/.test(className) ? className : `Screen${className}`;
}

function classNameForData(name) {
  const base = String(name || "DataModel")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const className = base || "DataModel";
  return /^[A-Za-z]/.test(className) ? className : `Data${className}`;
}

function upperDartName(value) {
  const name = classNameForData(value);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function lowerDartName(value) {
  const name = upperDartName(value);
  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

function toFlutterColor(value) {
  if (!value || value === "transparent") return "Colors.transparent";

  if (typeof value === "string" && value.startsWith("#")) {
    const hex = value.replace("#", "");
    if (hex.length === 6) return `Color(0xFF${hex.toUpperCase()})`;
    if (hex.length === 8) return `Color(0x${hex.toUpperCase()})`;
  }

  return "Colors.transparent";
}

function toDartNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "0.0";
}

function escapeDartString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
