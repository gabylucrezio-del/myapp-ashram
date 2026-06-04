const STORAGE_KEY = "editor-ashram-projects";

export function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveProject(project) {
  const projects = loadProjects().filter((item) => item.id !== project.id);
  const snapshot = {
    ...project,
    clips: project.clips.map(({ file, objectUrl, ...clip }) => ({
      ...clip,
      objectUrl: null,
      fileMissing: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([snapshot, ...projects].slice(0, 12)));
}
