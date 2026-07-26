package com.ganesha.iaoffline.data

import android.content.Context
import androidx.room.Database
import androidx.room.migration.Migration
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
  entities =
    [
      ConversationEntity::class,
      MessageEntity::class,
      UserMainMemoryEntity::class,
      MemoryItemEntity::class,
      AssistantSettingsEntity::class,
    ],
  version = 2,
  exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
  abstract fun chatDao(): ChatDao

  companion object {
    @Volatile private var instance: AppDatabase? = null

    fun get(context: Context): AppDatabase =
      instance
        ?: synchronized(this) {
          instance
            ?: Room.databaseBuilder(context, AppDatabase::class.java, "ganesha_ia_offline.db")
              .addMigrations(MIGRATION_1_2)
              .build()
              .also { instance = it }
        }

    private val MIGRATION_1_2 =
      object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
          db.execSQL(
            """
              CREATE TABLE IF NOT EXISTS `memory_items` (
                `id` TEXT NOT NULL,
                `title` TEXT NOT NULL,
                `content` TEXT NOT NULL,
                `category` TEXT NOT NULL,
                `enabled` INTEGER NOT NULL,
                `createdAt` INTEGER NOT NULL,
                `updatedAt` INTEGER NOT NULL,
                PRIMARY KEY(`id`)
              )
            """
              .trimIndent()
          )
          db.execSQL(
            """
              CREATE TABLE IF NOT EXISTS `assistant_settings` (
                `id` TEXT NOT NULL,
                `userName` TEXT NOT NULL,
                `assistantName` TEXT NOT NULL,
                `language` TEXT NOT NULL,
                `responseStyle` TEXT NOT NULL,
                `temperature` REAL NOT NULL,
                `maxTokens` INTEGER NOT NULL,
                `mainMemoryEnabled` INTEGER NOT NULL,
                `automaticMemoriesEnabled` INTEGER NOT NULL,
                `voiceModeEnabled` INTEGER NOT NULL,
                `createdAt` INTEGER NOT NULL,
                `updatedAt` INTEGER NOT NULL,
                PRIMARY KEY(`id`)
              )
            """
              .trimIndent()
          )
        }
      }
  }
}
