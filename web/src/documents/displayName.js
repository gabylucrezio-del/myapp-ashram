export function getDisplayName(fileName = "") {
  return String(fileName || "").replace(/\.[^/.]+$/, "");
}
