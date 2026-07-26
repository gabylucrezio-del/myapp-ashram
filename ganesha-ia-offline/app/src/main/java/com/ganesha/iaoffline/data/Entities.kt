package com.ganesha.iaoffline.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "conversations")
data class ConversationEntity(
  @PrimaryKey val id: String,
  val title: String,
  val createdAt: Long,
  val updatedAt: Long,
  val modelPath: String?,
)

@Entity(
  tableName = "messages",
  foreignKeys =
    [
      ForeignKey(
        entity = ConversationEntity::class,
        parentColumns = ["id"],
        childColumns = ["conversationId"],
        onDelete = ForeignKey.CASCADE,
      )
    ],
  indices = [Index("conversationId")],
)
data class MessageEntity(
  @PrimaryKey val id: String,
  val conversationId: String,
  val role: String,
  val content: String,
  val createdAt: Long,
  val orderIndex: Int,
)

@Entity(tableName = "user_main_memory")
data class UserMainMemoryEntity(
  @PrimaryKey val id: String = DEFAULT_ID,
  val content: String,
  val enabled: Boolean,
  val createdAt: Long,
  val updatedAt: Long,
) {
  companion object {
    const val DEFAULT_ID = "default"
  }
}

@Entity(tableName = "memory_items")
data class MemoryItemEntity(
  @PrimaryKey val id: String = java.util.UUID.randomUUID().toString(),
  val title: String,
  val content: String,
  val category: String,
  val enabled: Boolean,
  val createdAt: Long,
  val updatedAt: Long,
)

@Entity(tableName = "assistant_settings")
data class AssistantSettingsEntity(
  @PrimaryKey val id: String = DEFAULT_ID,
  val userName: String,
  val assistantName: String,
  val language: String,
  val responseStyle: String,
  val temperature: Float,
  val maxTokens: Int,
  val mainMemoryEnabled: Boolean,
  val automaticMemoriesEnabled: Boolean,
  val voiceModeEnabled: Boolean,
  val createdAt: Long,
  val updatedAt: Long,
) {
  companion object {
    const val DEFAULT_ID = "default"
  }
}
