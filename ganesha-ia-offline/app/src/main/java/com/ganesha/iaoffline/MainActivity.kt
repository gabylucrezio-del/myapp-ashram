package com.ganesha.iaoffline

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.ganesha.iaoffline.data.ConversationEntity
import com.ganesha.iaoffline.data.LocalMessage
import com.ganesha.iaoffline.data.AssistantSettingsEntity
import com.ganesha.iaoffline.data.MemoryItemEntity
import com.ganesha.iaoffline.llm.ModelDiagnostic
import com.ganesha.iaoffline.ui.ChatViewModel
import java.util.Locale
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  private val viewModel: ChatViewModel by viewModels()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      MaterialTheme(
        colorScheme =
          lightColorScheme(
            primary = Color(0xFF674188),
            onPrimary = Color.White,
            primaryContainer = Color(0xFFE9D8FD),
            onPrimaryContainer = Color(0xFF241232),
            secondary = Color(0xFF2F6F62),
            onSecondary = Color.White,
            secondaryContainer = Color(0xFFD7F2E8),
            tertiary = Color(0xFFB7791F),
            background = Color(0xFFFFFBF4),
            surface = Color(0xFFFFFBF4),
            surfaceVariant = Color(0xFFF0E7DA),
            onSurfaceVariant = Color(0xFF5F564A),
          )
      ) {
        Surface(modifier = Modifier.fillMaxSize()) {
          GaneshaChatApp(viewModel)
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GaneshaChatApp(viewModel: ChatViewModel) {
  val context = LocalContext.current
  val uiState by viewModel.uiState.collectAsState()
  val conversations by viewModel.conversations.collectAsState()
  val drawerState = rememberDrawerState(DrawerValue.Closed)
  val scope = rememberCoroutineScope()
  var selectedTab by remember { mutableStateOf(0) }
  var showPromptPreview by remember { mutableStateOf(false) }
  var showVoiceWarning by remember { mutableStateOf(false) }
  var isListening by remember { mutableStateOf(false) }
  var voiceMuted by remember { mutableStateOf(false) }
  var voiceDiagnostic by remember {
    mutableStateOf("El reconocimiento de voz puede depender del sistema del teléfono.")
  }
  val speechRecognizer =
    remember {
      if (SpeechRecognizer.isRecognitionAvailable(context)) {
        SpeechRecognizer.createSpeechRecognizer(context)
      } else {
        null
      }
    }
  val textToSpeech =
    remember {
      TextToSpeech(context) { status ->
        if (status == TextToSpeech.SUCCESS) {
          // Locale is applied after initialization by LaunchedEffect.
        }
      }
    }
  val audioPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      if (!granted) {
        voiceDiagnostic = "Permiso de micrófono denegado."
        showVoiceWarning = true
      }
    }
  val modelPicker =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
      if (uri != null) viewModel.loadModel(uri)
    }

  DisposableEffect(Unit) {
    onDispose {
      speechRecognizer?.destroy()
      textToSpeech.stop()
      textToSpeech.shutdown()
    }
  }

  LaunchedEffect(uiState.assistantSettings?.language) {
    textToSpeech.language = Locale("es", "ES")
  }

  LaunchedEffect(uiState.messages.lastOrNull()?.id, uiState.assistantSettings?.voiceModeEnabled, voiceMuted) {
    val last = uiState.messages.lastOrNull()
    if (
      last?.role == "assistant" &&
        uiState.assistantSettings?.voiceModeEnabled == true &&
        !voiceMuted
    ) {
      textToSpeech.speak(last.content, TextToSpeech.QUEUE_FLUSH, null, last.id)
    }
  }

  fun startListening() {
    if (uiState.assistantSettings?.voiceModeEnabled != true) {
      voiceDiagnostic = "Activa el modo voz desde Parámetros."
      showVoiceWarning = true
      return
    }
    if (speechRecognizer == null) {
      voiceDiagnostic = "El reconocimiento de voz no está disponible en este teléfono."
      showVoiceWarning = true
      return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
      return
    }
    voiceDiagnostic = "El reconocimiento de voz puede depender del sistema del teléfono."
    speechRecognizer.setRecognitionListener(
      object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
          isListening = true
        }

        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() {
          isListening = false
        }

        override fun onError(error: Int) {
          isListening = false
          voiceDiagnostic = "No pude reconocer la voz. El reconocimiento puede depender del sistema del teléfono."
          showVoiceWarning = true
        }

        override fun onResults(results: Bundle?) {
          isListening = false
          val spoken =
            results
              ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
              ?.firstOrNull()
              .orEmpty()
          if (spoken.isNotBlank()) viewModel.sendVoiceText(spoken)
        }

        override fun onPartialResults(partialResults: Bundle?) = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit
      }
    )
    val intent =
      Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
        .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES")
        .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
    speechRecognizer.startListening(intent)
  }

  fun stopListening() {
    speechRecognizer?.stopListening()
    isListening = false
  }

  ModalNavigationDrawer(
    drawerState = drawerState,
    drawerContent = {
      HistoryDrawer(
        conversations = conversations,
        onNewChat = {
          viewModel.newChat()
          scope.launch { drawerState.close() }
        },
        onOpenConversation = {
          viewModel.openConversation(it)
          scope.launch { drawerState.close() }
        },
        onDeleteConversation = viewModel::deleteConversation,
      )
    },
  ) {
    Scaffold(
      modifier = Modifier.fillMaxSize(),
      contentWindowInsets = WindowInsets(0, 0, 0, 0),
      topBar = {
        TopAppBar(
          title = { Text("Ganesha IA Offline") },
        )
      },
      bottomBar = {
        MessageComposer(
          input = uiState.input,
          isGenerating = uiState.isGenerating,
          voiceEnabled = uiState.assistantSettings?.voiceModeEnabled == true,
          isListening = isListening,
          voiceMuted = voiceMuted,
          onInputChanged = viewModel::updateInput,
          onSend = viewModel::sendMessage,
          onMic = ::startListening,
          onStopListening = ::stopListening,
          onToggleMute = { voiceMuted = !voiceMuted },
        )
      },
    ) { padding ->
      Column(
        modifier =
          Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(padding)
      ) {
        MainTabs(
          selectedTab = selectedTab,
          onTabSelected = { index ->
            selectedTab = index
            when (index) {
              0 -> scope.launch { drawerState.open() }
              1 -> viewModel.setMemoryEditorVisible(true)
              2 -> viewModel.setParametersEditorVisible(true)
              3 -> modelPicker.launch(arrayOf("*/*"))
              4 -> viewModel.setModelDiagnosticVisible(true)
            }
          },
        )
        ModelStatus(modelPath = uiState.modelPath, memoryWarning = uiState.memoryWarning)
        MessageList(messages = uiState.messages, modifier = Modifier.weight(1f).fillMaxWidth())
      }
    }
  }

  if (uiState.showMemoryEditor) {
    MainMemoryDialog(
      content = uiState.mainMemory,
      enabled = uiState.mainMemoryEnabled,
      onDismiss = { viewModel.setMemoryEditorVisible(false) },
      onSave = viewModel::saveMainMemory,
    )
  }

  if (uiState.showParametersEditor) {
    AssistantParametersDialog(
      settings = uiState.assistantSettings,
      onDismiss = { viewModel.setParametersEditorVisible(false) },
      onSave = viewModel::saveAssistantSettings,
    )
  }

  if (uiState.showModelDiagnostic) {
    ModelDiagnosticDialog(
      diagnostic = uiState.modelDiagnostic,
      mainMemory = uiState.mainMemory,
      memoryItems = uiState.memoryItems,
      voiceDiagnostic = voiceDiagnostic,
      onTestMemory = viewModel::testSaveMemory,
      onTestVoice = {
        voiceDiagnostic = "El reconocimiento de voz puede depender del sistema del teléfono."
        showVoiceWarning = true
      },
      onShowPrompt = { showPromptPreview = true },
      onDismiss = { viewModel.setModelDiagnosticVisible(false) },
    )
  }

  if (showPromptPreview) {
    PromptPreviewDialog(prompt = uiState.lastPrompt, onDismiss = { showPromptPreview = false })
  }

  if (showVoiceWarning) {
    AlertDialog(
      onDismissRequest = { showVoiceWarning = false },
      title = { Text("Modo voz") },
      text = { Text(voiceDiagnostic) },
      confirmButton = {
        Button(onClick = { showVoiceWarning = false }) { Text("Aceptar") }
      },
    )
  }
}

@Composable
private fun MainTabs(
  selectedTab: Int,
  onTabSelected: (Int) -> Unit,
) {
  val tabs = listOf("Historial", "Memoria", "Parámetros", "Modelo", "Diagnóstico")
  ScrollableTabRow(
    selectedTabIndex = selectedTab,
    edgePadding = 0.dp,
    modifier = Modifier.fillMaxWidth(),
  ) {
    tabs.forEachIndexed { index, title ->
      Tab(
        selected = selectedTab == index,
        onClick = { onTabSelected(index) },
        text = { Text(title, maxLines = 1) },
      )
    }
  }
}

@Composable
private fun HistoryDrawer(
  conversations: List<ConversationEntity>,
  onNewChat: () -> Unit,
  onOpenConversation: (String) -> Unit,
  onDeleteConversation: (String) -> Unit,
) {
  ModalDrawerSheet {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text("Historial", style = MaterialTheme.typography.titleLarge)
      Button(onClick = onNewChat, modifier = Modifier.fillMaxWidth()) { Text("Nuevo chat") }
      LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items(conversations) { conversation ->
          Row(verticalAlignment = Alignment.CenterVertically) {
            NavigationDrawerItem(
              label = { Text(conversation.title) },
              selected = false,
              onClick = { onOpenConversation(conversation.id) },
              modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { onDeleteConversation(conversation.id) }) { Text("Borrar") }
          }
        }
      }
    }
  }
}

@Composable
private fun ModelStatus(modelPath: String?, memoryWarning: String?) {
  val text = if (modelPath == null) "Sin modelo cargado. Toca Modelo para seleccionar un .litertlm local." else "Modelo cargado offline."
  Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
    Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (!memoryWarning.isNullOrBlank()) {
      Text(text = memoryWarning, color = MaterialTheme.colorScheme.error)
    }
  }
}

@Composable
private fun MessageList(messages: List<LocalMessage>, modifier: Modifier = Modifier) {
  LazyColumn(
    modifier = modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 6.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    if (messages.isEmpty()) {
      item {
        Text(
          text = "Selecciona un modelo local y escribe tu primer mensaje.",
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        )
      }
    }
    items(messages) { message ->
      val isUser = message.role == "user"
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
      ) {
        Text(
          text = message.content,
          modifier =
            Modifier
              .background(
                if (isUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                RoundedCornerShape(8.dp),
              )
              .padding(12.dp)
              .fillMaxWidth(0.86f),
        )
      }
    }
  }
}

@Composable
private fun MessageComposer(
  input: String,
  isGenerating: Boolean,
  voiceEnabled: Boolean,
  isListening: Boolean,
  voiceMuted: Boolean,
  onInputChanged: (String) -> Unit,
  onSend: () -> Unit,
  onMic: () -> Unit,
  onStopListening: () -> Unit,
  onToggleMute: () -> Unit,
) {
  Row(
    modifier =
      Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 10.dp, vertical = 8.dp),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
    verticalAlignment = Alignment.Bottom,
  ) {
    OutlinedTextField(
      value = input,
      onValueChange = onInputChanged,
      modifier = Modifier.weight(1f),
      minLines = 1,
      maxLines = 5,
      placeholder = { Text("Escribe tu mensaje") },
    )
    TextButton(
      enabled = voiceEnabled,
      onClick = if (isListening) onStopListening else onMic,
    ) {
      Text(if (isListening) "Detener" else "Mic")
    }
    TextButton(
      enabled = voiceEnabled,
      onClick = onToggleMute,
    ) {
      Text(if (voiceMuted) "Voz off" else "Silenciar")
    }
    Button(enabled = !isGenerating, onClick = onSend) {
      Text(if (isGenerating) "..." else "Enviar")
    }
  }
}

@Composable
private fun AssistantParametersDialog(
  settings: AssistantSettingsEntity?,
  onDismiss: () -> Unit,
  onSave:
    (
      userName: String,
      assistantName: String,
      language: String,
      responseStyle: String,
      temperature: Float,
      maxTokens: Int,
      mainMemoryEnabled: Boolean,
      automaticMemoriesEnabled: Boolean,
      voiceModeEnabled: Boolean,
    ) -> Unit,
) {
  var userName by remember(settings) { mutableStateOf(settings?.userName ?: "Gabriel") }
  var assistantName by remember(settings) { mutableStateOf(settings?.assistantName ?: "Ganesha IA") }
  var language by remember(settings) { mutableStateOf(settings?.language ?: "Español") }
  var style by remember(settings) {
    mutableStateOf(settings?.responseStyle ?: "Amigo y guia sereno, claro y profesional")
  }
  var temperatureText by remember(settings) { mutableStateOf((settings?.temperature ?: 0.7f).toString()) }
  var maxTokensText by remember(settings) { mutableStateOf((settings?.maxTokens ?: 512).toString()) }
  var mainMemoryEnabled by remember(settings) { mutableStateOf(settings?.mainMemoryEnabled ?: true) }
  var automaticMemoriesEnabled by remember(settings) {
    mutableStateOf(settings?.automaticMemoriesEnabled ?: true)
  }
  var voiceModeEnabled by remember(settings) { mutableStateOf(settings?.voiceModeEnabled ?: false) }
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Parámetros") },
    text = {
      Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        OutlinedTextField(userName, { userName = it }, label = { Text("Nombre del usuario") })
        OutlinedTextField(assistantName, { assistantName = it }, label = { Text("Nombre del asistente") })
        OutlinedTextField(language, { language = it }, label = { Text("Idioma principal") })
        OutlinedTextField(style, { style = it }, label = { Text("Estilo de respuesta") }, minLines = 2)
        OutlinedTextField(
          value = temperatureText,
          onValueChange = { temperatureText = it },
          label = { Text("Temperatura") },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        )
        OutlinedTextField(
          value = maxTokensText,
          onValueChange = { maxTokensText = it },
          label = { Text("Máximo de tokens/respuesta") },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        SettingSwitch("Activar memoria principal", mainMemoryEnabled) { mainMemoryEnabled = it }
        SettingSwitch("Activar memorias automáticas", automaticMemoriesEnabled) {
          automaticMemoriesEnabled = it
        }
        SettingSwitch("Activar modo voz", voiceModeEnabled) { voiceModeEnabled = it }
      }
    },
    confirmButton = {
      Button(
        onClick = {
          onSave(
            userName,
            assistantName,
            language,
            style,
            temperatureText.toFloatOrNull() ?: 0.7f,
            maxTokensText.toIntOrNull() ?: 512,
            mainMemoryEnabled,
            automaticMemoriesEnabled,
            voiceModeEnabled,
          )
        }
      ) {
        Text("Guardar")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) { Text("Cancelar") }
    },
  )
}

@Composable
private fun SettingSwitch(
  label: String,
  checked: Boolean,
  onCheckedChange: (Boolean) -> Unit,
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(label)
    Switch(checked = checked, onCheckedChange = onCheckedChange)
  }
}

@Composable
private fun MainMemoryDialog(
  content: String,
  enabled: Boolean,
  onDismiss: () -> Unit,
  onSave: (String, Boolean) -> Unit,
) {
  var draft by remember(content) { mutableStateOf(content) }
  var isEnabled by remember(enabled) { mutableStateOf(enabled) }
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Memoria principal") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Esta memoria se inyecta antes de cada consulta, tambien en chats nuevos.")
        OutlinedTextField(
          value = draft,
          onValueChange = { draft = it },
          minLines = 6,
          label = { Text("Contenido") },
        )
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text("Activada")
          Switch(checked = isEnabled, onCheckedChange = { isEnabled = it })
        }
      }
    },
    confirmButton = {
      Button(onClick = { onSave(draft, isEnabled) }) { Text("Guardar") }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) { Text("Cancelar") }
    },
  )
}

@Composable
private fun ModelDiagnosticDialog(
  diagnostic: ModelDiagnostic,
  mainMemory: String,
  memoryItems: List<MemoryItemEntity>,
  voiceDiagnostic: String,
  onTestMemory: () -> Unit,
  onTestVoice: () -> Unit,
  onShowPrompt: () -> Unit,
  onDismiss: () -> Unit,
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Diagnostico de modelo") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Estado: ${diagnostic.status}")
        Text("Nombre: ${diagnostic.fileName.ifBlank { "Sin archivo" }}")
        Text("Extension: ${diagnostic.extension.ifBlank { "-" }}")
        Text("Tamano: ${diagnostic.sizeBytes?.toReadableSize() ?: "desconocido"}")
        Text("Backend recomendado: ${diagnostic.recommendedBackend}")
        Text("Extensiones admitidas: ${diagnostic.supportedExtensionsLabel}")
        if (diagnostic.uri.isNotBlank()) {
          Text("URI: ${diagnostic.uri}")
        }
        if (!diagnostic.error.isNullOrBlank()) {
          Text("Error: ${diagnostic.error}")
        }
        Text("Memoria principal cargada: ${mainMemory.length} caracteres")
        Text(
          mainMemory.take(300).ifBlank {
            "La memoria principal está vacía. Complétala desde Memoria."
          }
        )
        Text("Memorias activas: ${memoryItems.count { it.enabled }}")
        Text(
          memoryItems
            .filter { it.enabled }
            .take(6)
            .joinToString("\n") { "- ${it.title}" }
            .ifBlank { "No hay memorias activas." }
        )
        Text("Modo voz: $voiceDiagnostic")
      }
    },
    confirmButton = {
      Button(onClick = onDismiss) { Text("Aceptar") }
    },
    dismissButton = {
      Row {
        TextButton(onClick = onShowPrompt) { Text("Ver prompt final") }
        TextButton(onClick = onTestMemory) { Text("Probar guardar memoria") }
        TextButton(onClick = onTestVoice) { Text("Probar modo voz") }
      }
    },
  )
}

@Composable
private fun PromptPreviewDialog(
  prompt: String,
  onDismiss: () -> Unit,
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Prompt final") },
    text = {
      OutlinedTextField(
        value = prompt.ifBlank { "Todavia no hay prompt final. Envia un mensaje primero." },
        onValueChange = {},
        readOnly = true,
        minLines = 8,
        maxLines = 14,
        modifier = Modifier.fillMaxWidth(),
      )
    },
    confirmButton = {
      Button(onClick = onDismiss) { Text("Cerrar") }
    },
  )
}

private fun Long.toReadableSize(): String {
  val kb = this / 1024.0
  val mb = kb / 1024.0
  return if (mb >= 1) {
    "%.2f MB".format(mb)
  } else {
    "%.1f KB".format(kb)
  }
}
