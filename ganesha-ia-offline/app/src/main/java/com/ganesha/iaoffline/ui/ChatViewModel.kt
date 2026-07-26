package com.ganesha.iaoffline.ui

import android.app.Application
import android.net.Uri
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ganesha.iaoffline.data.AppDatabase
import com.ganesha.iaoffline.data.AssistantSettingsEntity
import com.ganesha.iaoffline.data.ChatRepository
import com.ganesha.iaoffline.data.ConversationEntity
import com.ganesha.iaoffline.data.LocalMessage
import com.ganesha.iaoffline.data.MemoryItemEntity
import com.ganesha.iaoffline.data.UserMainMemoryEntity
import com.ganesha.iaoffline.llm.LiteRtLmEngine
import com.ganesha.iaoffline.llm.ModelDiagnostic
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

data class ChatUiState(
  val conversationId: String = UUID.randomUUID().toString(),
  val messages: List<LocalMessage> = emptyList(),
  val input: String = "",
  val isGenerating: Boolean = false,
  val modelPath: String? = null,
  val mainMemory: String = "",
  val mainMemoryEnabled: Boolean = true,
  val memoryItems: List<MemoryItemEntity> = emptyList(),
  val assistantSettings: AssistantSettingsEntity? = null,
  val memoryWarning: String? = null,
  val lastPrompt: String = "",
  val showMemoryEditor: Boolean = false,
  val showParametersEditor: Boolean = false,
  val showModelDiagnostic: Boolean = false,
  val modelDiagnostic: ModelDiagnostic = ModelDiagnostic(),
)

class ChatViewModel(application: Application) : AndroidViewModel(application) {
  private val repository = ChatRepository(AppDatabase.get(application).chatDao())
  private val engine = LiteRtLmEngine(application.applicationContext)
  private var pendingForgetIds: List<String> = emptyList()
  private val _uiState = MutableStateFlow(ChatUiState())
  val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

  val conversations: StateFlow<List<ConversationEntity>> =
    repository
      .observeConversations()
      .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

  init {
    viewModelScope.launch(Dispatchers.IO) {
      repository.ensureDefaultMainMemory()
      repository.ensureDefaultAssistantSettings()
    }
    viewModelScope.launch(Dispatchers.IO) {
      repository.observeMainMemory().collect { memory ->
        _uiState.update {
          it.copy(
            mainMemory = memory?.content.orEmpty(),
            mainMemoryEnabled = memory?.enabled ?: true,
          )
        }
      }
    }
    viewModelScope.launch(Dispatchers.IO) {
      repository.observeMemoryItems().collect { memories ->
        _uiState.update { it.copy(memoryItems = memories) }
      }
    }
    viewModelScope.launch(Dispatchers.IO) {
      repository.observeAssistantSettings().collect { settings ->
        _uiState.update { it.copy(assistantSettings = settings) }
      }
    }
  }

  fun updateInput(value: String) {
    _uiState.update { it.copy(input = value) }
  }

  fun sendVoiceText(value: String) {
    _uiState.update { it.copy(input = value) }
    sendMessage()
  }

  fun newChat() {
    engine.resetConversation()
    _uiState.update {
      it.copy(conversationId = UUID.randomUUID().toString(), messages = emptyList(), input = "")
    }
  }

  fun openConversation(id: String) {
    viewModelScope.launch(Dispatchers.IO) {
      val loaded = repository.loadMessages(id)
      _uiState.update { it.copy(conversationId = id, messages = loaded, input = "") }
      engine.resetConversation()
    }
  }

  fun deleteConversation(id: String) {
    viewModelScope.launch(Dispatchers.IO) {
      repository.deleteConversation(id)
      if (_uiState.value.conversationId == id) {
        newChat()
      }
    }
  }

  fun setMemoryEditorVisible(visible: Boolean) {
    _uiState.update { it.copy(showMemoryEditor = visible) }
  }

  fun setParametersEditorVisible(visible: Boolean) {
    _uiState.update { it.copy(showParametersEditor = visible) }
  }

  fun setModelDiagnosticVisible(visible: Boolean) {
    _uiState.update { it.copy(showModelDiagnostic = visible) }
  }

  fun saveMainMemory(content: String, enabled: Boolean) {
    viewModelScope.launch(Dispatchers.IO) {
      repository.saveMainMemory(content, enabled)
      _uiState.update { it.copy(showMemoryEditor = false) }
    }
  }

  fun saveAssistantSettings(
    userName: String,
    assistantName: String,
    language: String,
    responseStyle: String,
    temperature: Float,
    maxTokens: Int,
    mainMemoryEnabled: Boolean,
    automaticMemoriesEnabled: Boolean,
    voiceModeEnabled: Boolean,
  ) {
    viewModelScope.launch(Dispatchers.IO) {
      repository.saveAssistantSettings(
        userName = userName,
        assistantName = assistantName,
        language = language,
        responseStyle = responseStyle,
        temperature = temperature,
        maxTokens = maxTokens,
        mainMemoryEnabled = mainMemoryEnabled,
        automaticMemoriesEnabled = automaticMemoriesEnabled,
        voiceModeEnabled = voiceModeEnabled,
      )
      _uiState.update { it.copy(showParametersEditor = false) }
    }
  }

  fun testSaveMemory() {
    viewModelScope.launch(Dispatchers.IO) {
      repository.addMemoryItem("Prueba de memoria creada desde Diagnostico.", "diagnostico")
      appendAssistantMessage("Listo, guardé una memoria de prueba.")
    }
  }

  fun loadModel(uri: Uri) {
    viewModelScope.launch(Dispatchers.IO) {
      val diagnostic = engine.inspectModel(uri)
      _uiState.update { it.copy(modelDiagnostic = diagnostic, showModelDiagnostic = true) }
      if (!diagnostic.isExtensionSupported) {
        appendAssistantMessage("El archivo seleccionado no es un modelo LiteRT-LM compatible.")
        return@launch
      }
      val path =
        runCatching {
            val copiedPath = engine.copyModelToInternalStorage(uri)
            engine.load(copiedPath)
            copiedPath
          }
          .getOrElse { error ->
            _uiState.update {
              it.copy(
                modelDiagnostic =
                  diagnostic.copy(
                    status = "No se pudo crear el motor LiteRT-LM.",
                    error = error.message ?: "Error desconocido",
                  ),
                showModelDiagnostic = true,
              )
            }
            appendAssistantMessage("El archivo seleccionado no es un modelo LiteRT-LM compatible.")
            return@launch
          }
      _uiState.update {
        it.copy(
          modelPath = path,
          modelDiagnostic = diagnostic.copy(status = "Modelo cargado correctamente.", error = null),
          showModelDiagnostic = true,
        )
      }
    }
  }

  fun sendMessage() {
    val text = _uiState.value.input.trim()
    if (text.isBlank() || _uiState.value.isGenerating) return
    viewModelScope.launch(Dispatchers.IO) {
      val userMessage = LocalMessage(role = "user", content = text)
      val withUser = _uiState.value.messages + userMessage
      _uiState.update { it.copy(messages = withUser, input = "", isGenerating = true) }
      persist(withUser)

      val commandReply = handleMemoryCommand(text)
      if (commandReply != null) {
        val assistantMessage = LocalMessage(role = "assistant", content = commandReply)
        val finalMessages = _uiState.value.messages + assistantMessage
        _uiState.update { it.copy(messages = finalMessages, isGenerating = false) }
        persist(finalMessages)
        return@launch
      }

      val mainMemory = repository.getMainMemory()
      val settings = repository.getAssistantSettings()
      val activeMemories =
        if (settings?.automaticMemoriesEnabled != false) repository.getEnabledMemoryItems()
        else emptyList()
      val promptResult = buildPrompt(text, mainMemory, activeMemories, settings)
      _uiState.update {
        it.copy(lastPrompt = promptResult.prompt, memoryWarning = promptResult.warning)
      }
      if (promptResult.warning != null) {
        appendAssistantMessage(promptResult.warning)
      }

      val prompt = promptResult.prompt
      val answer = engine.send(prompt)
      val assistantMessage = LocalMessage(role = "assistant", content = answer)
      val finalMessages = _uiState.value.messages + assistantMessage
      _uiState.update { it.copy(messages = finalMessages, isGenerating = false) }
      persist(finalMessages)
    }
  }

  private suspend fun persist(messages: List<LocalMessage>) {
    repository.saveConversation(
      conversationId = _uiState.value.conversationId,
      modelPath = _uiState.value.modelPath,
      messages = messages,
    )
  }

  private suspend fun handleMemoryCommand(text: String): String? {
    val lower = text.lowercase().trim()
    if (pendingForgetIds.isNotEmpty() && lower in setOf("si", "sí", "confirmo", "confirmar", "borrar")) {
      repository.disableMemoryItems(pendingForgetIds)
      pendingForgetIds = emptyList()
      return "Listo, desactivé esas memorias."
    }
    if (pendingForgetIds.isNotEmpty() && lower in setOf("no", "cancelar", "cancela")) {
      pendingForgetIds = emptyList()
      return "De acuerdo, no borré ninguna memoria."
    }

    val rememberPrefixes =
      listOf("recuerda que", "guarda esto en memoria", "esto es importante", "no olvides que")
    val rememberPrefix = rememberPrefixes.firstOrNull { lower.startsWith(it) }
    if (rememberPrefix != null) {
      val content = text.drop(rememberPrefix.length).trim(' ', ':', '.', ',')
      if (content.isBlank()) return "Dime qué quieres que guarde en memoria."
      repository.addMemoryItem(content)
      return "Listo, lo guardé en memoria."
    }

    val forgetPrefixes = listOf("olvida que", "borra de memoria", "elimina de memoria")
    val forgetPrefix = forgetPrefixes.firstOrNull { lower.startsWith(it) }
    if (forgetPrefix != null) {
      val query = text.drop(forgetPrefix.length).trim(' ', ':', '.', ',')
      if (query.isBlank()) return "Dime qué memoria quieres borrar."
      val matches = repository.findMemoryItems(query)
      if (matches.isEmpty()) return "No encontré memorias relacionadas con eso."
      pendingForgetIds = matches.map { it.id }
      val preview = matches.joinToString("\n") { "- ${it.title}" }
      return "Encontré estas memorias relacionadas:\n$preview\n\n¿Confirmas que quieres desactivarlas?"
    }

    if (
      lower.contains("qué recuerdas de mí") ||
        lower.contains("que recuerdas de mi") ||
        lower.contains("qué sabes de mí") ||
        lower.contains("que sabes de mi")
    ) {
      val main = repository.getMainMemory()
      val memories = repository.getEnabledMemoryItems()
      val mainText = main?.content?.takeIf { it.isNotBlank() } ?: "No hay memoria principal cargada."
      val itemsText =
        memories.take(12).joinToString("\n") { "- [${it.category}] ${it.content}" }
          .ifBlank { "No hay memorias importantes activas." }
      return "Memoria principal:\n$mainText\n\nMemorias importantes:\n$itemsText"
    }

    return null
  }

  private fun buildPrompt(
    question: String,
    mainMemory: UserMainMemoryEntity?,
    activeMemories: List<MemoryItemEntity>,
    settings: AssistantSettingsEntity?,
  ): PromptBuildResult {
    val memoryEnabled = mainMemory?.enabled != false && settings?.mainMemoryEnabled != false
    val rawMemory = mainMemory?.content.orEmpty().trim()
    val memoryWarning =
      if (rawMemory.isBlank()) {
        "La memoria principal está vacía. Complétala desde Memoria."
      } else {
        null
      }
    val memoryContent = if (memoryEnabled) rawMemory.take(MAIN_MEMORY_LIMIT) else ""
    val importantMemories =
      activeMemories
        .filter { it.enabled }
        .joinToString("\n") { "- [${it.category}] ${it.title}: ${it.content}" }
        .take(MEMORY_ITEMS_LIMIT)
        .ifBlank { "Sin memorias importantes activas." }
    val userName = settings?.userName?.ifBlank { "Gabriel" } ?: "Gabriel"
    val assistantName = settings?.assistantName?.ifBlank { "Ganesha IA" } ?: "Ganesha IA"
    val language = settings?.language?.ifBlank { "Español" } ?: "Español"
    val style = settings?.responseStyle?.ifBlank { "Claro, sereno y profesional" }
      ?: "Claro, sereno y profesional"
    val temperature = settings?.temperature ?: 0.7f
    val maxTokens = settings?.maxTokens ?: 512
    val prompt =
      """
        MEMORIA PRINCIPAL:
        $memoryContent

        MEMORIAS IMPORTANTES:
        $importantMemories

        PARÁMETROS DEL ASISTENTE:
        Usuario: $userName
        Asistente: $assistantName
        Idioma: $language
        Estilo: $style
        Temperatura: $temperature
        Máximo de tokens/respuesta: $maxTokens

        INSTRUCCIONES:
        Responde siempre en $language.
        Responde usando esta información cuando sea relevante.
        Si el usuario pregunta por algo guardado, usa la memoria.
        No menciones que estas usando memoria salvo que el usuario lo pregunte.
        No inventes datos que no estén en la memoria.

        MENSAJE:
        $question
      """
        .trimIndent()
        .take(PROMPT_LIMIT)

    Log.d(
      TAG,
        "mainMemoryEnabled=$memoryEnabled " +
        "mainMemoryContentLength=${rawMemory.length} " +
        "activeMemoryItemsLength=${importantMemories.length} " +
        "preview=${rawMemory.take(200)} " +
        "promptFinalLength=${prompt.length}",
    )

    return PromptBuildResult(prompt = prompt, warning = memoryWarning)
  }

  private fun appendAssistantMessage(content: String) {
    _uiState.update {
      it.copy(messages = it.messages + LocalMessage(role = "assistant", content = content))
    }
  }

  override fun onCleared() {
    engine.close()
    super.onCleared()
  }

  private data class PromptBuildResult(
    val prompt: String,
    val warning: String?,
  )

  private companion object {
    private const val TAG = "GaneshaPrompt"
    private const val MAIN_MEMORY_LIMIT = 1200
    private const val MEMORY_ITEMS_LIMIT = 2000
    private const val PROMPT_LIMIT = 4000
  }
}
