import { createZipBlob } from "./zipBuilder.js";

export const BUILD_SERVER_LIMITS = {
  maxProjectBytes: 25 * 1024 * 1024,
  maxLogBytes: 512 * 1024,
};

export function createBuildPayload({ builderJson, flutterProject, mode = "release" }) {
  const zipBlob = createZipBlob(flutterProject.files);
  return {
    mode,
    projectName: flutterProject.projectName,
    packageName: builderJson.androidConfig?.packageName || "com.ganflow.app",
    androidConfig: builderJson.androidConfig || {},
    assets: builderJson.resources || [],
    projectZip: zipBlob,
    size: zipBlob.size,
  };
}

export async function sendBuildToServer({ endpoint, payload }) {
  if (!endpoint) throw new Error("Falta configurar la URL del servidor de compilacion.");
  if (payload.size > BUILD_SERVER_LIMITS.maxProjectBytes) {
    throw new Error("El proyecto supera el tamano maximo permitido para compilar en servidor.");
  }

  const form = new FormData();
  form.append("mode", payload.mode);
  form.append("projectName", payload.projectName);
  form.append("packageName", payload.packageName);
  form.append("androidConfig", JSON.stringify(payload.androidConfig));
  form.append("assets", JSON.stringify(payload.assets));
  form.append("project", payload.projectZip, `${payload.projectName}.zip`);

  const response = await fetch(endpoint, { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "El servidor no pudo compilar el APK.");
  return data;
}

export const BUILD_SERVER_ARCHITECTURE = [
  "GanFlow Web exporta JSON y proyecto Flutter.",
  "El servidor crea una carpeta temporal aislada por build.",
  "El servidor valida tamano, package name, permisos, assets e iconos.",
  "El servidor ejecuta flutter pub get y flutter build apk --release.",
  "El servidor devuelve APK debug/release, logs y errores.",
  "El servidor limpia archivos temporales al finalizar.",
];
