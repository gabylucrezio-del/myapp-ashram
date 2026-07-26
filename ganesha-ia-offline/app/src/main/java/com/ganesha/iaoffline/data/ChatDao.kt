package com.ganesha.iaoffline.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatDao {
  @Query("SELECT * FROM conversations ORDER BY updatedAt DESC")
  fun observeConversations(): Flow<List<ConversationEntity>>

  @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY orderIndex ASC")
  fun observeMessages(conversationId: String): Flow<List<MessageEntity>>

  @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY orderIndex ASC")
  suspend fun getMessages(conversationId: String): List<MessageEntity>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertConversation(conversation: ConversationEntity)

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertMessages(messages: List<MessageEntity>)

  @Query("DELETE FROM messages WHERE conversationId = :conversationId")
  suspend fun deleteMessages(conversationId: String)

  @Query("DELETE FROM conversations WHERE id = :conversationId")
  suspend fun deleteConversation(conversationId: String)

  @Query("SELECT * FROM user_main_memory WHERE id = :id LIMIT 1")
  fun observeMainMemory(id: String = UserMainMemoryEntity.DEFAULT_ID): Flow<UserMainMemoryEntity?>

  @Query("SELECT * FROM user_main_memory WHERE id = :id LIMIT 1")
  suspend fun getMainMemory(id: String = UserMainMemoryEntity.DEFAULT_ID): UserMainMemoryEntity?

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertMainMemory(memory: UserMainMemoryEntity)

  @Query("SELECT * FROM memory_items ORDER BY updatedAt DESC")
  fun observeMemoryItems(): Flow<List<MemoryItemEntity>>

  @Query("SELECT * FROM memory_items ORDER BY updatedAt DESC")
  suspend fun getMemoryItems(): List<MemoryItemEntity>

  @Query("SELECT * FROM memory_items WHERE enabled = 1 ORDER BY updatedAt DESC")
  suspend fun getEnabledMemoryItems(): List<MemoryItemEntity>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertMemoryItem(memory: MemoryItemEntity)

  @Query("UPDATE memory_items SET enabled = :enabled, updatedAt = :updatedAt WHERE id IN (:ids)")
  suspend fun setMemoryItemsEnabled(ids: List<String>, enabled: Boolean, updatedAt: Long)

  @Query("SELECT * FROM assistant_settings WHERE id = :id LIMIT 1")
  fun observeAssistantSettings(id: String = AssistantSettingsEntity.DEFAULT_ID): Flow<AssistantSettingsEntity?>

  @Query("SELECT * FROM assistant_settings WHERE id = :id LIMIT 1")
  suspend fun getAssistantSettings(id: String = AssistantSettingsEntity.DEFAULT_ID): AssistantSettingsEntity?

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertAssistantSettings(settings: AssistantSettingsEntity)

  @Transaction
  suspend fun replaceConversationMessages(
    conversation: ConversationEntity,
    messages: List<MessageEntity>,
  ) {
    upsertConversation(conversation)
    deleteMessages(conversation.id)
    if (messages.isNotEmpty()) {
      insertMessages(messages)
    }
  }
}
