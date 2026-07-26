package com.ganesha.iaoffline.llm

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.ExperimentalApi
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.SamplerConfig
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume

private const val TAG = "GaneshaLiteRtLm"
private val supportedModelExtensions = setOf("litertlm")

data class ModelDiagnostic(
  val uri: String = "",
  val fileName: String = "",
  val extension: String = "",
  val sizeBytes: Long? = null,
  val isExtensionSupported: Boolean = false,
  val recommendedBackend: String = "CPU",
  val status: String = "Sin modelo seleccionado.",
  val error: String? = null,
) {
  val supportedExtensionsLabel: String = supportedModelExtensions.joinToString(", ") { ".$it" }
}

class LiteRtLmEngine(private val context: Context) {
  private var engine: Engine? = null
  private var conversation: Conversation? = null
  var modelPath: String? = null
    private set

  fun inspectModel(uri: Uri): ModelDiagnostic {
    val metadata = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
      val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
      if (cursor.moveToFirst()) {
        val name =
          if (nameIndex >= 0) cursor.getString(nameIndex) else null
        val size =
          if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) cursor.getLong(sizeIndex) else null
        name to size
      } else {
        null to null
      }
    } ?: (null to null)
    val fileName =
      metadata.first?.takeIf { it.isNotBlank() }
        ?: uri.lastPathSegment?.substringAfterLast('/')
        ?: "archivo_desconocido"
    val extension = fileName.substringAfterLast('.', "").lowercase()
    val lowerName = fileName.lowercase()
    val recommendedBackend =
      when {
        "qualcomm" in lowerName || "sm8750" in lowerName || "npu" in lowerName -> "NPU"
        "gpu" in lowerName -> "GPU"
        else -> "CPU"
      }
    val diagnostic =
      ModelDiagnostic(
        uri = uri.toString(),
        fileName = fileName,
        extension = extension.ifBlank { "(sin extension)" },
        sizeBytes = metadata.second,
        isExtensionSupported = extension in supportedModelExtensions,
        recommendedBackend = recommendedBackend,
        status =
          if (extension in supportedModelExtensions) {
            "Archivo listo para cargar."
          } else {
            "El archivo seleccionado no es un modelo LiteRT-LM compatible."
          },
      )
    Log.d(
      TAG,
      "Modelo seleccionado uri=${diagnostic.uri}, nombre=${diagnostic.fileName}, extension=${diagnostic.extension}, tamano=${diagnostic.sizeBytes ?: -1}, backend=${diagnostic.recommendedBackend}",
    )
    return diagnostic
  }

  fun copyModelToInternalStorage(uri: Uri): String {
    val diagnostic = inspectModel(uri)
    if (!diagnostic.isExtensionSupported) {
      error("El archivo seleccionado no es un modelo LiteRT-LM compatible.")
    }
    val fileName = diagnostic.fileName.ifBlank { "modelo.litertlm" }
    val modelsDir = File(context.filesDir, "models").also { it.mkdirs() }
    val target = File(modelsDir, fileName)
    context.contentResolver.openInputStream(uri)?.use { input ->
      target.outputStream().use { output -> input.copyTo(output) }
    } ?: error("No se pudo abrir el modelo seleccionado.")
    return target.absolutePath
  }

  @OptIn(ExperimentalApi::class)
  fun load(modelPath: String) {
    close()
    Log.d(TAG, "Cargando modelo local: $modelPath")
    val backend =
      when {
        "qualcomm" in modelPath.lowercase() || "sm8750" in modelPath.lowercase() ||
          "npu" in modelPath.lowercase() ->
          Backend.NPU(nativeLibraryDir = context.applicationInfo.nativeLibraryDir)
        "gpu" in modelPath.lowercase() -> Backend.GPU()
        else -> Backend.CPU()
      }
    Log.d(TAG, "Backend seleccionado: $backend")
    val newEngine =
      Engine(
        EngineConfig(
          modelPath = modelPath,
          backend = backend,
          maxNumTokens = 2048,
          cacheDir = context.cacheDir.absolutePath,
        )
      )
    newEngine.initialize()
    val newConversation =
      newEngine.createConversation(
        ConversationConfig(
          samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = 0.7),
          systemInstruction = Contents.of(Content.Text("Responde siempre en espanol.")),
        )
      )
    engine = newEngine
    conversation = newConversation
    this.modelPath = modelPath
  }

  suspend fun send(prompt: String): String =
    suspendCancellableCoroutine { continuation ->
      val activeConversation = conversation
      if (activeConversation == null) {
        continuation.resume("Primero selecciona un modelo LiteRT-LM local.")
        return@suspendCancellableCoroutine
      }
      val builder = StringBuilder()
      activeConversation.sendMessageAsync(
        Contents.of(Content.Text(prompt)),
        object : MessageCallback {
          override fun onMessage(message: Message) {
            builder.append(message.toString())
          }

          override fun onDone() {
            if (continuation.isActive) {
              continuation.resume(builder.toString().ifBlank { "No recibi respuesta del modelo." })
            }
          }

          override fun onError(throwable: Throwable) {
            Log.e(TAG, "Error de inferencia", throwable)
            if (continuation.isActive) {
              continuation.resume(
                "El modelo no pudo procesar esta consulta. Revisa el modelo o reinicia la sesion."
              )
            }
          }
        },
      )
      continuation.invokeOnCancellation { activeConversation.cancelProcess() }
    }

  fun resetConversation() {
    val currentEngine = engine ?: return
    conversation?.close()
    conversation =
      currentEngine.createConversation(
        ConversationConfig(
          samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = 0.7),
          systemInstruction = Contents.of(Content.Text("Responde siempre en espanol.")),
        )
      )
  }

  fun close() {
    runCatching { conversation?.close() }
    runCatching { engine?.close() }
    conversation = null
    engine = null
  }
}
