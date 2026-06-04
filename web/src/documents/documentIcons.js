import { BookOpen, FileText, FileType, Flame, Flower2, Folder, Heart, Leaf, Moon, Music, Sparkles, Star, Sun, Video } from "lucide-react";

export const documentIcons = [
  { id: "folder", label: "Carpeta", icon: Folder },
  { id: "document", label: "Documento", icon: FileText },
  { id: "book", label: "Libro", icon: BookOpen },
  { id: "note", label: "Nota", icon: FileText },
  { id: "leaf", label: "Ayurveda", icon: Leaf },
  { id: "moon", label: "Meditacion", icon: Moon },
  { id: "ganesha", label: "Ganesha", icon: Sparkles },
  { id: "star", label: "Estrella", icon: Star },
  { id: "fire", label: "Fuego", icon: Flame },
  { id: "music", label: "Musica", icon: Music },
  { id: "video", label: "Video", icon: Video },
  { id: "pdf", label: "PDF", icon: FileType },
  { id: "sun", label: "Practica", icon: Sun },
  { id: "heart", label: "Corazon", icon: Heart },
  { id: "flower", label: "Flor", icon: Flower2 },
  { id: "sparkles", label: "Luz", icon: Sparkles },
];

export function iconFor(id, fallback = "document") {
  return documentIcons.find((item) => item.id === id)?.icon || documentIcons.find((item) => item.id === fallback)?.icon || FileText;
}

export function iconLabel(id) {
  return documentIcons.find((item) => item.id === id)?.label || "Icono";
}
