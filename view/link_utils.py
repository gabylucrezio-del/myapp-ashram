import re
from urllib.parse import parse_qs, urlparse


def obtener_google_drive_id(link):
    if not link:
        return ""

    parsed = urlparse(link)
    query_id = parse_qs(parsed.query).get("id")
    if query_id:
        return query_id[0]

    patrones = [
        r"/file/d/([^/]+)",
        r"/document/d/([^/]+)",
        r"/presentation/d/([^/]+)",
        r"/spreadsheets/d/([^/]+)",
        r"/d/([^/]+)",
    ]

    for patron in patrones:
        encontrado = re.search(patron, link)
        if encontrado:
            return encontrado.group(1)

    return ""


def convertir_link_google_drive(link, tipo="archivo"):
    link_limpio = (link or "").strip()
    if "drive.google.com" not in link_limpio and "docs.google.com" not in link_limpio:
        return link_limpio

    archivo_id = obtener_google_drive_id(link_limpio)
    if not archivo_id:
        return link_limpio

    if tipo == "imagen":
        return f"https://drive.google.com/thumbnail?id={archivo_id}&sz=w1000"

    if tipo == "pdf_viewer":
        return f"https://drive.google.com/file/d/{archivo_id}/preview"

    return f"https://drive.google.com/uc?export=download&id={archivo_id}"

