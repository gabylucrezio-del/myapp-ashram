import json
import base64
import os
import re
import tempfile
from urllib.parse import parse_qs, quote, urlparse

import flet as ft
import fitz
import requests

from storage_service import StorageError, eliminar_archivo, subir_imagen, subir_pdf
from view.link_utils import convertir_link_google_drive
from view.ui_helpers import fondo_secundario


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    return datos["project_info"]["firebase_url"]


DATABASE_URL = cargar_firebase_config()


def mostrar_carga_conocimiento(page: ft.Page, volver_administracion):
    mostrar_carga_modulos(
        page=page,
        volver_administracion=volver_administracion,
        coleccion="conocimiento",
        titulo_pantalla="Conocimiento",
        incluir_pdf=True,
    )


def mostrar_carga_ejercicios(page: ft.Page, volver_administracion):
    mostrar_carga_modulos(
        page=page,
        volver_administracion=volver_administracion,
        coleccion="ejercicios",
        titulo_pantalla="Ejercicios",
        incluir_pdf=False,
    )


def mostrar_conocimiento(page: ft.Page, volver_inicio):
    mostrar_modulos_usuario(
        page=page,
        volver_inicio=volver_inicio,
        coleccion="conocimiento",
        titulo_pantalla="Conocimiento",
        permiso_key="permiso_conocimientos",
        etiquetas_key="etiquetas_conocimiento",
        incluir_pdf=True,
    )


def mostrar_ejercicios(page: ft.Page, volver_inicio):
    mostrar_modulos_usuario(
        page=page,
        volver_inicio=volver_inicio,
        coleccion="ejercicios",
        titulo_pantalla="Ejercicios",
        permiso_key="permiso_ejercicios",
        etiquetas_key="etiquetas_ejercicios",
        incluir_pdf=False,
    )


def mostrar_carga_modulos(page, volver_administracion, coleccion, titulo_pantalla, incluir_pdf):
    page.clean()

    estado = {"modulos": {}, "modulo_editando_id": None}
    contenido = ft.Column(expand=True, scroll=ft.ScrollMode.AUTO, spacing=14)

    def mostrar_mensaje(texto, color="#5E5A2E"):
        page.snack_bar = ft.SnackBar(content=ft.Text(texto), bgcolor=color)
        page.snack_bar.open = True
        page.update()

    def cargar_modulos():
        try:
            respuesta = requests.get(f"{DATABASE_URL}/{coleccion}.json")
            estado["modulos"] = respuesta.json() or {} if respuesta.status_code == 200 else {}
        except requests.RequestException:
            estado["modulos"] = {}
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def etiquetas_existentes():
        etiquetas = set()
        for modulo in estado["modulos"].values():
            etiqueta = (modulo.get("etiqueta") or "").strip()
            if etiqueta:
                etiquetas.add(etiqueta)
        return sorted(etiquetas)

    def mostrar_lista():
        estado["modulo_editando_id"] = None
        cargar_modulos()
        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado(titulo_pantalla, volver_administracion),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20),
                    content=ft.Row(
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        controls=[
                            ft.Text(
                                "Modulos cargados",
                                size=20,
                                weight=ft.FontWeight.BOLD,
                                color="#4E4A2A",
                            ),
                            ft.IconButton(
                                icon=ft.Icons.ADD_CIRCLE,
                                icon_color="#5E5A2E",
                                icon_size=34,
                                tooltip="Nuevo modulo",
                                on_click=lambda e: mostrar_formulario(),
                            ),
                        ],
                    ),
                ),
            ]
        )

        if not estado["modulos"]:
            contenido.controls.append(
                ft.Container(
                    padding=20,
                    alignment=ft.alignment.center,
                    content=ft.Text("Todavia no hay modulos cargados.", color="#4E4A2A"),
                )
            )
            page.update()
            return

        grupos = {}
        for modulo_id, modulo in estado["modulos"].items():
            etiqueta = (modulo.get("etiqueta") or "Sin etiqueta").strip()
            grupos.setdefault(etiqueta, []).append((modulo_id, modulo))

        for etiqueta in sorted(grupos):
            contenido.controls.append(
                ft.Container(
                    padding=ft.padding.only(left=20, right=20, top=8),
                    content=ft.Text(etiqueta, size=16, weight=ft.FontWeight.BOLD, color="#5E5A2E"),
                )
            )
            for modulo_id, modulo in sorted(grupos[etiqueta], key=lambda item: (item[1].get("titulo") or "").lower()):
                contenido.controls.append(tarjeta_admin(modulo_id, modulo))

        page.update()

    def tarjeta_admin(modulo_id, modulo):
        imagen = convertir_link_google_drive(modulo.get("imagen", ""), "imagen")
        return ft.Container(
            margin=ft.margin.symmetric(horizontal=20),
            padding=10,
            bgcolor="#FFFDF8",
            border_radius=16,
            border=ft.border.all(width=1, color="#D8C7A0"),
            content=ft.Row(
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
                controls=[
                    ft.Container(
                        width=68,
                        height=68,
                        border_radius=12,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        bgcolor="#F7F1E5",
                        content=ft.Image(src=imagen or "icono_conocimiento.webp", fit=ft.ImageFit.COVER),
                    ),
                    ft.Container(
                        expand=True,
                        padding=ft.padding.only(left=8),
                        content=ft.Column(
                            spacing=3,
                            controls=[
                                ft.Text(modulo.get("titulo", "Sin titulo"), size=14, weight=ft.FontWeight.BOLD, color="#4E4A2A", max_lines=2),
                                ft.Text(modulo.get("descripcion", "")[:80], size=11, color="#5E5A2E", max_lines=2),
                            ],
                        ),
                    ),
                    ft.IconButton(icon=ft.Icons.EDIT, icon_color="#5E5A2E", tooltip="Editar", on_click=lambda e: mostrar_formulario(modulo_id, modulo)),
                    ft.IconButton(icon=ft.Icons.DELETE, icon_color="#A33A2A", tooltip="Borrar", on_click=lambda e: confirmar_borrado(modulo_id, modulo.get("titulo", "modulo"))),
                ],
            ),
        )

    def confirmar_borrado(modulo_id, titulo):
        dialogo = ft.AlertDialog(
            modal=True,
            title=ft.Text("Borrar modulo"),
            content=ft.Text(f"Seguro que quieres borrar '{titulo}'?"),
            actions=[
                ft.TextButton("Cancelar", on_click=lambda e: cerrar_dialogo(dialogo)),
                ft.TextButton("Borrar", on_click=lambda e: borrar_modulo(modulo_id, dialogo)),
            ],
        )
        page.dialog = dialogo
        dialogo.open = True
        page.update()

    def cerrar_dialogo(dialogo):
        dialogo.open = False
        page.update()

    def borrar_modulo(modulo_id, dialogo):
        try:
            respuesta = requests.delete(f"{DATABASE_URL}/{coleccion}/{modulo_id}.json")
            cerrar_dialogo(dialogo)
            if respuesta.status_code == 200:
                modulo_eliminado = estado["modulos"].get(modulo_id, {})
                id_token = page.client_storage.get("id_token")
                for ruta_storage in (modulo_eliminado.get("imagen_path"), modulo_eliminado.get("pdf_path")):
                    try:
                        eliminar_archivo(ruta_storage, id_token=id_token)
                    except StorageError:
                        pass
                mostrar_mensaje("Modulo borrado correctamente.")
                mostrar_lista()
            else:
                mostrar_mensaje("No se pudo borrar el modulo.", "red")
        except requests.RequestException:
            cerrar_dialogo(dialogo)
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def mostrar_formulario(modulo_id=None, modulo=None):
        estado["modulo_editando_id"] = modulo_id
        modulo = modulo or {}
        archivos = {"imagen": None, "pdf": None}

        titulo = campo_texto("Titulo", modulo.get("titulo", ""))
        descripcion = campo_texto("Descripcion", modulo.get("descripcion", ""), multiline=True, min_lines=4, max_lines=6)
        opciones = etiquetas_existentes()
        etiqueta_dropdown = ft.Dropdown(
            label="Etiqueta existente",
            width=320,
            options=[ft.dropdown.Option(etiqueta) for etiqueta in opciones],
            value=modulo.get("etiqueta", "") if modulo.get("etiqueta", "") in opciones else None,
            border_radius=18,
            bgcolor="#FFFDF8",
            border_color="#D8C7A0",
            color="#4E4A2A",
            label_style=ft.TextStyle(color="#5E5A2E"),
        )
        nueva_etiqueta = campo_texto("Crear nueva etiqueta", "" if modulo.get("etiqueta", "") in opciones else modulo.get("etiqueta", ""))
        link_video = campo_texto("Link video", modulo.get("link_video_original") or modulo.get("video", ""))
        imagen_actual = convertir_link_google_drive(modulo.get("imagen", ""), "imagen")
        pdf_actual = convertir_link_google_drive(modulo.get("pdf", ""), "pdf")

        texto_imagen = ft.Text(
            "Imagen actual cargada" if imagen_actual else "Selecciona una imagen",
            size=12,
            color="#5E5A2E",
            text_align=ft.TextAlign.CENTER,
        )
        texto_pdf = ft.Text(
            "PDF actual cargado" if pdf_actual else "Selecciona un PDF",
            size=12,
            color="#5E5A2E",
            text_align=ft.TextAlign.CENTER,
        )
        estado_carga = ft.Text("", size=12, color="#5E5A2E", text_align=ft.TextAlign.CENTER)

        vista_previa = ft.Image(
            src=imagen_actual or "icono_conocimiento.webp",
            width=220,
            height=140,
            fit=ft.ImageFit.COVER,
        )

        picker_imagen = ft.FilePicker()
        picker_pdf = ft.FilePicker()
        page.overlay.extend([picker_imagen, picker_pdf])

        def seleccionar_imagen(e):
            picker_imagen.pick_files(
                allow_multiple=False,
                allowed_extensions=["jpg", "jpeg", "png", "webp"],
            )

        def seleccionar_pdf(e):
            picker_pdf.pick_files(
                allow_multiple=False,
                allowed_extensions=["pdf"],
            )

        def imagen_seleccionada(e):
            if not e.files:
                return
            archivo = e.files[0]
            archivos["imagen"] = archivo.path
            texto_imagen.value = f"{archivo.name} - se optimizara a WebP"
            if archivo.path:
                vista_previa.src = archivo.path
            page.update()

        def pdf_seleccionado(e):
            if not e.files:
                return
            archivo = e.files[0]
            archivos["pdf"] = archivo.path
            texto_pdf.value = archivo.name
            page.update()

        picker_imagen.on_result = imagen_seleccionada
        picker_pdf.on_result = pdf_seleccionado

        def guardar_modulo(e):
            etiqueta = (nueva_etiqueta.value or "").strip() or (etiqueta_dropdown.value or "").strip()
            if not titulo.value.strip():
                mostrar_mensaje("Completa el titulo.", "red")
                return
            if not etiqueta:
                mostrar_mensaje("Selecciona o crea una etiqueta.", "red")
                return

            video_original = link_video.value.strip()
            boton_guardar.disabled = True
            estado_carga.color = "#5E5A2E"
            estado_carga.value = "Optimizando imagen a WebP y subiendo archivos..."
            page.update()

            datos = {
                "titulo": titulo.value.strip(),
                "etiqueta": etiqueta,
                "descripcion": descripcion.value.strip(),
                "video": convertir_link_google_drive(video_original, "video"),
                "link_video_original": video_original,
            }

            try:
                id_token = page.client_storage.get("id_token")
                if archivos["imagen"]:
                    imagen = subir_imagen(
                        archivos["imagen"],
                        id_token=id_token,
                        carpeta=f"contenidos/{coleccion}/imagenes",
                    )
                    datos["imagen"] = imagen["url"]
                    datos["imagen_path"] = imagen["path"]
                    if modulo.get("imagen_path"):
                        try:
                            eliminar_archivo(modulo.get("imagen_path"), id_token=id_token)
                        except StorageError:
                            pass
                else:
                    datos["imagen"] = imagen_actual
                    datos["imagen_path"] = modulo.get("imagen_path", "")

                if incluir_pdf:
                    if archivos["pdf"]:
                        pdf = subir_pdf(
                            archivos["pdf"],
                            id_token=id_token,
                            carpeta=f"contenidos/{coleccion}/pdfs",
                        )
                        datos["pdf"] = pdf["url"]
                        datos["pdf_path"] = pdf["path"]
                        if modulo.get("pdf_path"):
                            try:
                                eliminar_archivo(modulo.get("pdf_path"), id_token=id_token)
                            except StorageError:
                                pass
                    else:
                        datos["pdf"] = pdf_actual
                        datos["pdf_path"] = modulo.get("pdf_path", "")

                if estado["modulo_editando_id"]:
                    respuesta = requests.patch(f"{DATABASE_URL}/{coleccion}/{estado['modulo_editando_id']}.json", json=datos)
                else:
                    respuesta = requests.post(f"{DATABASE_URL}/{coleccion}.json", json=datos)

                if respuesta.status_code == 200:
                    mostrar_mensaje("Modulo guardado correctamente.")
                    mostrar_lista()
                else:
                    boton_guardar.disabled = False
                    estado_carga.value = ""
                    detalle = respuesta.text[:140] if respuesta.text else f"HTTP {respuesta.status_code}"
                    mostrar_mensaje(f"No se pudo guardar el modulo: {detalle}", "red")
                    page.update()
            except StorageError as error:
                boton_guardar.disabled = False
                estado_carga.color = "red"
                estado_carga.value = str(error)
                mostrar_mensaje(str(error), "red")
                page.update()
            except requests.RequestException:
                boton_guardar.disabled = False
                estado_carga.color = "red"
                estado_carga.value = "Error conectando con la base de datos."
                mostrar_mensaje("Error conectando con la base de datos.", "red")
                page.update()

        boton_guardar = ft.ElevatedButton(
            text="Guardar modulo",
            bgcolor="#5E5A2E",
            color="#FFFFFF",
            width=320,
            height=46,
            on_click=guardar_modulo,
        )

        controles = [
            ft.Container(width=220, height=140, border_radius=15, clip_behavior=ft.ClipBehavior.HARD_EDGE, bgcolor="#FFFDF8", content=vista_previa),
            titulo,
            etiqueta_dropdown,
            nueva_etiqueta,
            ft.OutlinedButton(
                text="Seleccionar imagen",
                icon=ft.Icons.IMAGE,
                width=320,
                on_click=seleccionar_imagen,
            ),
            texto_imagen,
            link_video,
        ]
        if incluir_pdf:
            controles.extend(
                [
                    ft.OutlinedButton(
                        text="Seleccionar PDF",
                        icon=ft.Icons.PICTURE_AS_PDF,
                        width=320,
                        on_click=seleccionar_pdf,
                    ),
                    texto_pdf,
                ]
            )
        controles.extend(
            [
                descripcion,
                estado_carga,
                boton_guardar,
            ]
        )

        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Editar modulo" if modulo_id else "Nuevo modulo", mostrar_lista),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20, bottom=20),
                    content=ft.Column(spacing=14, horizontal_alignment=ft.CrossAxisAlignment.CENTER, controls=controles),
                ),
            ]
        )
        page.update()

    page.add(fondo_secundario(contenido))
    mostrar_lista()


def mostrar_modulos_usuario(page, volver_inicio, coleccion, titulo_pantalla, permiso_key, etiquetas_key, incluir_pdf):
    page.clean()

    uid = page.client_storage.get("uid")
    lista = ft.ListView(expand=True, spacing=12, padding=20)

    def descargar_pdf(modulo_key, pdf):
        carpeta_cache = os.path.join(tempfile.gettempdir(), "myashram_contenidos_pdfs")
        os.makedirs(carpeta_cache, exist_ok=True)

        ruta_pdf = os.path.join(carpeta_cache, f"{modulo_key}.pdf")
        if os.path.exists(ruta_pdf) and os.path.getsize(ruta_pdf) > 0:
            return ruta_pdf

        pdf_descarga = convertir_link_google_drive(pdf, "pdf")
        respuesta = requests.get(pdf_descarga, timeout=30)
        respuesta.raise_for_status()

        with open(ruta_pdf, "wb") as archivo:
            archivo.write(respuesta.content)

        return ruta_pdf

    def renderizar_pagina_pdf(documento, pagina_actual):
        pagina = documento.load_page(pagina_actual - 1)
        pixmap = pagina.get_pixmap(matrix=fitz.Matrix(1.8, 1.8), alpha=False)
        return base64.b64encode(pixmap.tobytes("png")).decode("utf-8")

    def obtener_youtube_video_id(link):
        link_limpio = (link or "").strip()
        if not link_limpio:
            return ""

        parsed = urlparse(link_limpio)
        host = parsed.netloc.lower()
        video_id = ""

        if "youtu.be" in host:
            video_id = parsed.path.strip("/").split("/")[0]
        elif "youtube.com" in host:
            if parsed.path.startswith("/shorts/") or parsed.path.startswith("/embed/"):
                video_id = parsed.path.strip("/").split("/")[1]
            else:
                video_id = parse_qs(parsed.query).get("v", [""])[0]

        return video_id

    def obtener_youtube_miniatura(link):
        video_id = obtener_youtube_video_id(link)
        if not video_id:
            return ""
        return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    def preparar_url_descarga_pdf(pdf, titulo):
        url = convertir_link_google_drive(pdf, "pdf")
        if "firebasestorage.googleapis.com" not in url:
            return url

        separador = "&" if "?" in url else "?"
        nombre_archivo = quote(f"{titulo or 'material'}.pdf")
        return f"{url}{separador}response-content-disposition=attachment%3B%20filename%3D{nombre_archivo}"

    def usuario_actual():
        if not uid:
            return {}
        try:
            respuesta = requests.get(f"{DATABASE_URL}/usuarios/{uid}.json")
            return respuesta.json() or {}
        except requests.RequestException:
            return {}

    def cargar_modulos():
        lista.controls.clear()
        usuario = usuario_actual()
        acceso_total = bool(usuario.get(permiso_key))
        etiquetas_permitidas = usuario.get(etiquetas_key) or {}
        es_admin = usuario.get("rol") == "admin"

        try:
            respuesta = requests.get(f"{DATABASE_URL}/{coleccion}.json")
            modulos = respuesta.json() or {}
        except requests.RequestException:
            modulos = {}

        grupos = {}
        for modulo_id, modulo in modulos.items():
            etiqueta = (modulo.get("etiqueta") or "Sin etiqueta").strip()
            permitido = es_admin or acceso_total or bool(etiquetas_permitidas.get(etiqueta))
            if permitido:
                grupos.setdefault(etiqueta, []).append((modulo_id, modulo))

        if not grupos:
            lista.controls.append(
                ft.Container(
                    padding=20,
                    bgcolor="#FFFDF8",
                    border_radius=16,
                    content=ft.Text("No tienes acceso activo a estos contenidos.", color="#4E4A2A", text_align=ft.TextAlign.CENTER),
                )
            )
            page.update()
            return

        for etiqueta in sorted(grupos):
            lista.controls.append(ft.Text(etiqueta, size=18, weight=ft.FontWeight.BOLD, color="#5E5A2E"))
            for modulo_id, modulo in sorted(grupos[etiqueta], key=lambda item: (item[1].get("titulo") or "").lower()):
                lista.controls.append(tarjeta_modulo(modulo_id, modulo))

        page.update()

    def tarjeta_modulo(modulo_id, modulo):
        imagen = convertir_link_google_drive(modulo.get("imagen", ""), "imagen")
        return ft.Container(
            bgcolor="#FFFDF8",
            border_radius=16,
            border=ft.border.all(width=1, color="#D8C7A0"),
            padding=10,
            ink=True,
            on_click=lambda e: mostrar_detalle(modulo),
            content=ft.Row(
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
                controls=[
                    ft.Container(width=78, height=78, border_radius=12, clip_behavior=ft.ClipBehavior.HARD_EDGE, bgcolor="#F7F1E5", content=ft.Image(src=imagen or "icono_conocimiento.webp", fit=ft.ImageFit.COVER)),
                    ft.Container(
                        expand=True,
                        padding=ft.padding.only(left=10),
                        content=ft.Column(
                            spacing=4,
                            controls=[
                                ft.Text(modulo.get("titulo", "Sin titulo"), size=15, weight=ft.FontWeight.BOLD, color="#4E4A2A", max_lines=2),
                                ft.Text(modulo.get("descripcion", ""), size=12, color="#5E5A2E", max_lines=2),
                            ],
                        ),
                    ),
                    ft.Icon(ft.Icons.PLAY_CIRCLE, color="#5E5A2E"),
                ],
            ),
        )

    def mostrar_visor_pdf(modulo_key, titulo, pdf, volver_detalle):
        page.clean()

        imagen_pagina = ft.Image(fit=ft.ImageFit.CONTAIN, expand=True)
        contador_paginas = ft.Text("", size=13, color="#4E4A2A")
        mensaje_error = ft.Text("", size=13, color="red", text_align=ft.TextAlign.CENTER)
        pagina_actual = 1

        try:
            ruta_pdf = descargar_pdf(modulo_key, pdf)
            documento = fitz.open(ruta_pdf)
            total_paginas = max(1, documento.page_count)
            imagen_pagina.src_base64 = renderizar_pagina_pdf(documento, pagina_actual)
            contador_paginas.value = f"Pagina {pagina_actual} de {total_paginas}"
        except Exception:
            documento = None
            total_paginas = 1
            mensaje_error.value = "No se pudo cargar el PDF dentro de la app."

        def actualizar_pagina(nueva_pagina):
            nonlocal pagina_actual
            if not documento:
                return

            pagina_actual = min(max(1, nueva_pagina), total_paginas)
            imagen_pagina.src_base64 = renderizar_pagina_pdf(documento, pagina_actual)
            contador_paginas.value = f"Pagina {pagina_actual} de {total_paginas}"
            page.update()

        page.add(
            fondo_secundario(
                ft.Column(
                    expand=True,
                    controls=[
                        ft.Container(
                            padding=ft.padding.only(left=12, right=12, top=12, bottom=8),
                            content=ft.Row(
                                vertical_alignment=ft.CrossAxisAlignment.CENTER,
                                controls=[
                                    ft.IconButton(
                                        icon=ft.Icons.ARROW_BACK,
                                        icon_color="#4E4A2A",
                                        tooltip="Volver",
                                        on_click=lambda e: volver_detalle(),
                                    ),
                                    ft.Text(
                                        titulo,
                                        size=18,
                                        weight=ft.FontWeight.BOLD,
                                        color="#4E4A2A",
                                        expand=True,
                                        max_lines=2,
                                    ),
                                ],
                            ),
                        ),
                        ft.Container(
                            padding=ft.padding.only(left=20, right=20, bottom=8),
                            content=ft.Row(
                                alignment=ft.MainAxisAlignment.CENTER,
                                vertical_alignment=ft.CrossAxisAlignment.CENTER,
                                controls=[
                                    ft.IconButton(
                                        icon=ft.Icons.CHEVRON_LEFT,
                                        icon_color="#5E5A2E",
                                        tooltip="Pagina anterior",
                                        disabled=documento is None,
                                        on_click=lambda e: actualizar_pagina(pagina_actual - 1),
                                    ),
                                    contador_paginas,
                                    ft.IconButton(
                                        icon=ft.Icons.CHEVRON_RIGHT,
                                        icon_color="#5E5A2E",
                                        tooltip="Pagina siguiente",
                                        disabled=documento is None,
                                        on_click=lambda e: actualizar_pagina(pagina_actual + 1),
                                    ),
                                ],
                            ),
                        ),
                        ft.Container(
                            expand=True,
                            margin=ft.margin.only(left=10, right=10, bottom=10),
                            border_radius=18,
                            clip_behavior=ft.ClipBehavior.HARD_EDGE,
                            bgcolor="#FFFFFF",
                            alignment=ft.alignment.center,
                            content=ft.Column(
                                expand=True,
                                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                                controls=[
                                    mensaje_error,
                                    imagen_pagina,
                                ],
                            ),
                        ),
                    ],
                )
            )
        )

    def mostrar_detalle(modulo):
        page.clean()
        imagen = convertir_link_google_drive(modulo.get("imagen", ""), "imagen")
        video = convertir_link_google_drive(modulo.get("video", ""), "video")
        miniatura_video = obtener_youtube_miniatura(video)
        modulo_key = clave_firebase(f"{modulo.get('etiqueta', 'sin_etiqueta')}_{modulo.get('titulo', 'sin_titulo')}")
        realizado_key = f"{coleccion}_realizados/{uid}/{modulo_key}"
        favorito_key = f"{coleccion}_favoritos/{uid}/{modulo_key}"

        realizado = ft.Checkbox(label="Realizado", active_color="#5E5A2E", label_style=ft.TextStyle(color="#4E4A2A"))
        favorito = ft.Checkbox(label="Favorito", active_color="#5E5A2E", label_style=ft.TextStyle(color="#4E4A2A"))

        def cargar_estado_usuario():
            try:
                realizado.value = bool((requests.get(f"{DATABASE_URL}/{realizado_key}.json").json()))
                favorito.value = bool((requests.get(f"{DATABASE_URL}/{favorito_key}.json").json()))
            except requests.RequestException:
                pass

        def guardar_bool(ruta, valor):
            try:
                if valor:
                    requests.put(f"{DATABASE_URL}/{ruta}.json", json=True)
                else:
                    requests.delete(f"{DATABASE_URL}/{ruta}.json")
            except requests.RequestException:
                pass

        realizado.on_change = lambda e: guardar_bool(realizado_key, e.control.value)
        favorito.on_change = lambda e: guardar_bool(favorito_key, e.control.value)
        cargar_estado_usuario()

        video_control = ft.Container(
            width=330,
            height=190,
            border_radius=18,
            clip_behavior=ft.ClipBehavior.HARD_EDGE,
            bgcolor="#000000",
            visible=bool(video),
            ink=True,
            on_click=lambda e: page.launch_url(video),
            content=ft.Stack(
                controls=[
                    ft.Image(
                        src=miniatura_video,
                        width=330,
                        height=190,
                        fit=ft.ImageFit.COVER,
                        visible=bool(miniatura_video),
                    ),
                    ft.Container(
                        alignment=ft.alignment.center,
                        bgcolor="#55000000",
                        content=ft.Icon(
                            ft.Icons.PLAY_CIRCLE,
                            color="#FFFFFF",
                            size=64,
                        ),
                    ),
                ],
            ),
        )

        controles = [
            encabezado(titulo_pantalla, lambda: mostrar_modulos_usuario(page, volver_inicio, coleccion, titulo_pantalla, permiso_key, etiquetas_key, incluir_pdf)),
            ft.Container(
                padding=ft.padding.only(left=20, right=20, bottom=20),
                content=ft.Column(
                    spacing=14,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    controls=[
                        ft.Container(width=330, height=180, border_radius=16, clip_behavior=ft.ClipBehavior.HARD_EDGE, bgcolor="#FFFDF8", content=ft.Image(src=imagen or "icono_conocimiento.webp", fit=ft.ImageFit.COVER)),
                        ft.Text(modulo.get("titulo", "Sin titulo"), size=24, weight=ft.FontWeight.BOLD, color="#4E4A2A", text_align=ft.TextAlign.CENTER),
                        video_control,
                        ft.Row(alignment=ft.MainAxisAlignment.CENTER, controls=[realizado, favorito]),
                        ft.Text(modulo.get("descripcion", ""), size=14, color="#4E4A2A"),
                    ],
                ),
            ),
        ]

        if incluir_pdf and modulo.get("pdf"):
            controles[1].content.controls.append(
                ft.ElevatedButton(
                    text="Descargar PDF",
                    icon=ft.Icons.DOWNLOAD,
                    bgcolor="#5E5A2E",
                    color="#FFFFFF",
                    width=220,
                    on_click=lambda e: page.launch_url(
                        preparar_url_descarga_pdf(
                            modulo.get("pdf", ""),
                            modulo.get("titulo", "material"),
                        )
                    ),
                )
            )

        page.add(fondo_secundario(ft.Column(expand=True, scroll=ft.ScrollMode.AUTO, controls=controles)))

    page.add(fondo_secundario(ft.Column(expand=True, controls=[encabezado(titulo_pantalla, volver_inicio), lista])))
    cargar_modulos()


def encabezado(titulo, volver):
    return ft.Container(
        padding=20,
        content=ft.Row(
            alignment=ft.MainAxisAlignment.START,
            controls=[
                ft.IconButton(icon=ft.Icons.ARROW_BACK, icon_color="#4E4A2A", on_click=lambda e: volver()),
                ft.Text(titulo, size=26, weight=ft.FontWeight.BOLD, color="#4E4A2A"),
            ],
        ),
    )


def campo_texto(label, value="", multiline=False, min_lines=1, max_lines=1):
    return ft.TextField(
        label=label,
        value=value,
        width=320,
        multiline=multiline,
        min_lines=min_lines,
        max_lines=max_lines,
        border_radius=18,
        bgcolor="#FFFDF8",
        border_color="#D8C7A0",
        focused_border_color="#EBCF94",
        color="#4E4A2A",
        label_style=ft.TextStyle(color="#5E5A2E"),
    )


def clave_firebase(texto):
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", texto or "").strip("_") or "modulo"

