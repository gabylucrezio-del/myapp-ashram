import json
import mimetypes
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import requests

try:
    from PIL import Image
except ImportError:
    Image = None


IMAGEN_EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp"}
PDF_EXTENSIONES = {".pdf"}


def cargar_firebase_storage_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    bucket = datos["project_info"]["storage_bucket"]
    return bucket


STORAGE_BUCKET = cargar_firebase_storage_config()


class StorageError(Exception):
    pass


def inicializar_firebase_storage():
    return {
        "bucket": STORAGE_BUCKET,
        "upload_url": f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}/o",
    }


def validar_imagen(ruta_archivo):
    extension = Path(ruta_archivo).suffix.lower()
    if extension not in IMAGEN_EXTENSIONES:
        raise StorageError("La portada debe ser JPG, JPEG, PNG o WEBP.")


def validar_pdf(ruta_archivo):
    extension = Path(ruta_archivo).suffix.lower()
    if extension not in PDF_EXTENSIONES:
        raise StorageError("El archivo del libro debe ser PDF.")


def optimizar_imagen(ruta_archivo, ancho_maximo=1000, calidad=82):
    validar_imagen(ruta_archivo)

    if Image is None:
        return ruta_archivo, _content_type(ruta_archivo), False

    origen = Path(ruta_archivo)
    destino = Path(tempfile.gettempdir()) / f"myashram_{uuid.uuid4().hex}.webp"

    with Image.open(origen) as imagen:
        imagen.thumbnail((ancho_maximo, ancho_maximo), Image.Resampling.LANCZOS)
        if imagen.mode not in ("RGB", "RGBA"):
            imagen = imagen.convert("RGB")
        imagen.save(destino, "WEBP", quality=calidad, method=6)

    return str(destino), "image/webp", True


def subir_imagen(ruta_archivo, id_token=None, carpeta="biblioteca/portadas"):
    ruta_subida, content_type, borrar_temporal = optimizar_imagen(ruta_archivo)
    try:
        nombre = f"{carpeta}/{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex}.webp"
        return subir_archivo(
            ruta_archivo=ruta_subida,
            ruta_storage=nombre,
            content_type=content_type,
            id_token=id_token,
        )
    finally:
        if borrar_temporal and os.path.exists(ruta_subida):
            os.remove(ruta_subida)


def subir_pdf(ruta_archivo, id_token=None, carpeta="biblioteca/pdfs"):
    validar_pdf(ruta_archivo)
    nombre = f"{carpeta}/{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex}.pdf"
    return subir_archivo(
        ruta_archivo=ruta_archivo,
        ruta_storage=nombre,
        content_type="application/pdf",
        id_token=id_token,
    )


def subir_archivo(ruta_archivo, ruta_storage, content_type=None, id_token=None):
    if not os.path.exists(ruta_archivo):
        raise StorageError("No se encontro el archivo seleccionado.")

    content_type = content_type or _content_type(ruta_archivo)
    headers = {
        "Content-Type": content_type,
    }
    if id_token:
        headers["Authorization"] = f"Bearer {id_token}"

    with open(ruta_archivo, "rb") as archivo:
        contenido = archivo.read()

    respuesta = requests.post(
        (
            f"{inicializar_firebase_storage()['upload_url']}"
            f"?uploadType=media&name={quote(ruta_storage, safe='')}"
        ),
        data=contenido,
        headers=headers,
        timeout=120,
    )

    if not respuesta.ok:
        raise StorageError(_mensaje_error_firebase(respuesta))

    datos = respuesta.json()
    token_descarga = datos.get("downloadTokens") or datos.get("metadata", {}).get("firebaseStorageDownloadTokens")
    if not token_descarga:
        raise StorageError("Firebase Storage subio el archivo, pero no devolvio token de descarga.")

    return {
        "url": obtener_url_descarga(ruta_storage, token_descarga),
        "path": ruta_storage,
        "content_type": content_type,
    }


def obtener_url_descarga(ruta_storage, token_descarga):
    ruta_codificada = quote(ruta_storage, safe="")
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}/o/"
        f"{ruta_codificada}?alt=media&token={token_descarga}"
    )


def eliminar_archivo(ruta_storage, id_token=None):
    if not ruta_storage:
        return True

    headers = {}
    if id_token:
        headers["Authorization"] = f"Bearer {id_token}"

    ruta_codificada = quote(ruta_storage, safe="")
    respuesta = requests.delete(
        f"{inicializar_firebase_storage()['upload_url']}/{ruta_codificada}",
        headers=headers,
        timeout=30,
    )

    if respuesta.status_code in (200, 204, 404):
        return True

    raise StorageError(_mensaje_error_firebase(respuesta))


def _content_type(ruta_archivo):
    return mimetypes.guess_type(ruta_archivo)[0] or "application/octet-stream"


def _mensaje_error_firebase(respuesta):
    try:
        datos = respuesta.json()
        mensaje = datos.get("error", {}).get("message") or respuesta.text
    except ValueError:
        mensaje = respuesta.text
    if "permission" in mensaje.lower() or "unauthorized" in mensaje.lower():
        mensaje = (
            f"{mensaje}. Revisa las reglas de Firebase Storage y vuelve a iniciar sesion "
            "si la app estuvo abierta mucho tiempo."
        )
    return f"Firebase Storage rechazo la operacion: {mensaje}"
