package com.ganesha.iaoffline.data

import kotlinx.coroutines.flow.Flow
import java.util.UUID

const val DEFAULT_MAIN_MEMORY_CONTENT =
  "El usuario se llama Gabriel Premananda / Gabriel Lucrezio.\n" +
    "Es terapeuta Ayurveda, astrologo vedico y creador de Ashram Ganesha.\n" +
    "Prefiere respuestas en espanol, claras, serenas, profesionales y con ejemplos simples.\n" +
    "Cuando este confundido, necesita que lo ayuden a volver a su centro con calma.\n" +
    "Le gusta aprender desde la raiz de las cosas.\n" +
    "Su proyecto principal es crear herramientas espirituales, terapeuticas y educativas para ayudar a otras personas."

class ChatRepository(private val dao: ChatDao) {
  fun observeConversations(): Flow<List<ConversationEntity>> = dao.observeConversations()

  fun observeMessages(conversationId: String): Flow<List<MessageEntity>> =
    dao.observeMessages(conversationId)

  fun observeMainMemory(): Flow<UserMainMemoryEntity?> = dao.observeMainMemory()

  suspend fun getMainMemory(): UserMainMemoryEntity? = dao.getMainMemory()

  fun observeMemoryItems(): Flow<List<MemoryItemEntity>> = dao.observeMemoryItems()

  suspend fun getEnabledMemoryItems(): List<MemoryItemEntity> = dao.getEnabledMemoryItems()

  fun observeAssistantSettings(): Flow<AssistantSettingsEntity?> = dao.observeAssistantSettings()

  suspend fun getAssistantSettings(): AssistantSettingsEntity? = dao.getAssistantSettings()

  suspend fun ensureDefaultMainMemory() {
    val existing = dao.getMainMemory()
    if (
      existing != null &&
        (existing.content.contains("Gabriel Premananda", ignoreCase = true) ||
          existing.content.contains("Gabriel Lucrezio", ignoreCase = true))
    ) {
      return
    }
    val now = System.currentTimeMillis()
    dao.upsertMainMemory(
      UserMainMemoryEntity(
        content = DEFAULT_MAIN_MEMORY_CONTENT,
        enabled = true,
        createdAt = existing?.createdAt ?: now,
        updatedAt = now,
      )
    )
  }

  suspend fun ensureDefaultAssistantSettings() {
    if (dao.getAssistantSettings() != null) return
    val now = System.currentTimeMillis()
    dao.upsertAssistantSettings(
      AssistantSettingsEntity(
        userName = "Gabriel",
        assistantName = "Ganesha IA",
        language = "Español",
        responseStyle = "Amigo y guia sereno, claro y profesional",
        temperature = 0.7f,
        maxTokens = 512,
        mainMemoryEnabled = true,
        automaticMemoriesEnabled = true,
        voiceModeEnabled = false,
        createdAt = now,
        updatedAt = now,
      )
    )
  }

  suspend fun saveMainMemory(content: String, enabled: Boolean) {
    val existing = dao.getMainMemory()
    val now = System.currentTimeMillis()
    dao.upsertMainMemory(
      UserMainMemoryEntity(
        content = content.trim(),
        enabled = enabled,
        createdAt = existing?.createdAt ?: now,
        updatedAt = now,
      )
    )
  }

  suspend fun saveAssistantSettings(
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
    val existing = dao.getAssistantSettings()
    val now = System.currentTimeMillis()
    dao.upsertAssistantSettings(
      AssistantSettingsEntity(
        userName = userName.trim().ifBlank { "Gabriel" },
        assistantName = assistantName.trim().ifBlank { "Ganesha IA" },
        language = language.trim().ifBlank { "Español" },
        responseStyle = responseStyle.trim().ifBlank { "Claro, sereno y profesional" },
        temperature = temperature.coerceIn(0f, 1.5f),
        maxTokens = maxTokens.coerceIn(64, 2048),
        mainMemoryEnabled = mainMemoryEnabled,
        automaticMemoriesEnabled = automaticMemoriesEnabled,
        voiceModeEnabled = voiceModeEnabled,
        createdAt = existing?.createdAt ?: now,
        updatedAt = now,
      )
    )
  }

  suspend fun addMemoryItem(content: String, category: String = "general") {
    val cleanContent = content.trim()
    if (cleanContent.isBlank()) return
    val now = System.currentTimeMillis()
    dao.upsertMemoryItem(
      MemoryItemEntity(
        title = cleanContent.take(48),
        content = cleanContent,
        category = category,
        enabled = true,
        createdAt = now,
        updatedAt = now,
      )
    )
  }

  suspend fun findMemoryItems(query: String): List<MemoryItemEntity> {
    val words = query.lowercase().split(Regex("\\s+")).filter { it.length >= 4 }.toSet()
    if (words.isEmpty()) return emptyList()
    return dao.getMemoryItems()
      .filter { item ->
        val haystack = "${item.title} ${item.content} ${item.category}".lowercase()
        words.any { it in haystack }
      }
      .take(5)
  }

  suspend fun disableMemoryItems(ids: List<String>) {
    if (ids.isNotEmpty()) dao.setMemoryItemsEnabled(ids, false, System.currentTimeMillis())
  }

  suspend fun saveConversation(
    conversationId: String,
    modelPath: String?,
    messages: List<LocalMessage>,
  ) {
    val now = System.currentTimeMillis()
    val firstUser = messages.firstOrNull { it.role == "user" }?.content?.take(40)
    dao.replaceConversationMessages(
      ConversationEntity(
        id = conversationId,
        title = firstUser?.ifBlank { null } ?: "Nuevo chat",
        createdAt = now,
        updatedAt = now,
        modelPath = modelPath,
      ),
      messages.mapIndexed { index, message ->
        MessageEntity(
          id = message.id,
          conversationId = conversationId,
          role = message.role,
          content = message.content,
          createdAt = message.createdAt,
          orderIndex = index,
        )
      },
    )
  }

  suspend fun loadMessages(conversationId: String): List<LocalMessage> =
    dao.getMessages(conversationId).map {
      LocalMessage(
        id = it.id,
        role = it.role,
        content = it.content,
        createdAt = it.createdAt,
      )
    }

  suspend fun deleteConversation(conversationId: String) {
    dao.deleteConversation(conversationId)
  }
}

data class LocalMessage(
  val id: String = UUID.randomUUID().toString(),
  val role: String,
  val content: String,
  val createdAt: Long = System.currentTimeMillis(),
)
