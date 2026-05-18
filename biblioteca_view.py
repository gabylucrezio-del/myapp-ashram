import base64
import flet as ft
import fitz
import json
import os
import requests
import tempfile
from view.link_utils import convertir_link_google_drive
from view.ui_helpers import fondo_secundario


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    database_url = datos["project_info"]["firebase_url"]

    return database_url


DATABASE_URL = cargar_firebase_config()


def mostrar_biblioteca(page: ft.Page, volver_inicio):

    page.clean()
    usuario_uid = page.client_storage.get("uid") or page.client_storage.get("usuario_email") or "invitado"
    progreso_usuario = {}

    libros_lista = ft.GridView(
        expand=True,
        runs_count=2,
        max_extent=180,
        child_aspect_ratio=0.56,
        spacing=15,
        run_spacing=15,
    )

    buscador = ft.TextField(
        hint_text="Buscar libros...",
        prefix_icon=ft.Icons.SEARCH,
        border_radius=20,
        bgcolor="#F7F1E5",
        border_color="#D8C7A0",
        color="#4E4A2A",
        width=360,
        on_change=lambda e: cargar_libros(buscador.value),
    )

    def cargar_progreso_usuario():
        nonlocal progreso_usuario
        try:
            respuesta = requests.get(f"{DATABASE_URL}/progreso_biblioteca/{usuario_uid}.json")
            progreso_usuario = respuesta.json() or {}
        except requests.RequestException:
            progreso_usuario = {}

    def obtener_progreso(libro_id):
        return progreso_usuario.get(libro_id, {})

    def guardar_progreso(libro_id, datos):
        progreso_actual = obtener_progreso(libro_id)
        progreso_actual.update(datos)
        progreso_usuario[libro_id] = progreso_actual

        try:
            requests.patch(
                f"{DATABASE_URL}/progreso_biblioteca/{usuario_uid}/{libro_id}.json",
                json=progreso_actual,
            )
        except requests.RequestException:
            pass

    def guardar_estado(libro_id, estado):
        guardar_progreso(libro_id, {"estado": estado})
        cargar_libros(buscador.value)

    def descargar_pdf(libro_id, pdf):
        carpeta_cache = os.path.join(tempfile.gettempdir(), "myashram_pdfs")
        os.makedirs(carpeta_cache, exist_ok=True)

        ruta_pdf = os.path.join(carpeta_cache, f"{libro_id}.pdf")
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

    def abrir_pdf(libro_id, titulo, pdf):
        mostrar_visor_pdf(libro_id, titulo, pdf)

    def mostrar_visor_pdf(libro_id, titulo, pdf):
        page.clean()

        progreso = obtener_progreso(libro_id)
        pagina_actual = max(1, int(progreso.get("pagina", 1) or 1))
        imagen_pagina = ft.Image(fit=ft.ImageFit.CONTAIN, expand=True)
        contador_paginas = ft.Text("", size=13, color="#4E4A2A")
        mensaje_error = ft.Text("", size=13, color="red", text_align=ft.TextAlign.CENTER)

        try:
            ruta_pdf = descargar_pdf(libro_id, pdf)
            documento = fitz.open(ruta_pdf)
            total_paginas = max(1, documento.page_count)
            pagina_actual = min(pagina_actual, total_paginas)
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
            guardar_progreso(libro_id, {"pagina": pagina_actual})
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
                                        on_click=lambda e: mostrar_biblioteca(page, volver_inicio),
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
                            border_radius=12,
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

    def crear_libro(libro_id, titulo, imagen, pdf):
        progreso = obtener_progreso(libro_id)
        estado = progreso.get("estado", "")

        leyendo = ft.Checkbox(
            label="Leyendo",
            value=estado == "leyendo",
            active_color="#5E5A2E",
            label_style=ft.TextStyle(color="#4E4A2A", size=10),
            on_change=lambda e: guardar_estado(libro_id, "leyendo" if e.control.value else ""),
        )
        terminado = ft.Checkbox(
            label="Leido",
            value=estado == "terminado",
            active_color="#5E5A2E",
            label_style=ft.TextStyle(color="#4E4A2A", size=10),
            on_change=lambda e: guardar_estado(libro_id, "terminado" if e.control.value else ""),
        )

        return ft.Container(
            bgcolor="#FFFDF8",
            border_radius=18,
            padding=6,

            content=ft.Column(
                spacing=3,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,

                controls=[

                    ft.Container(
                        width=130,
                        height=170,
                        border_radius=15,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        ink=True,
                        on_click=lambda e: abrir_pdf(libro_id, titulo, pdf),
                        content=ft.Image(
                            src=imagen,
                            fit=ft.ImageFit.COVER,
                        ),
                    ),

                    ft.Text(
                        titulo,
                        size=12,
                        weight=ft.FontWeight.W_500,
                        color="#4E4A2A",
                        text_align=ft.TextAlign.CENTER,
                        max_lines=2,
                    ),
                    ft.Row(
                        spacing=0,
                        alignment=ft.MainAxisAlignment.CENTER,
                        controls=[
                            leyendo,
                            terminado,
                        ],
                    ),
                    ft.Text(
                        f"Pag. {progreso.get('pagina', 1)}",
                        size=9,
                        color="#5E5A2E",
                        visible=bool(progreso.get("pagina")),
                    ),
                ],
            ),
        )

    def cargar_libros(texto_busqueda=""):

        libros_lista.controls.clear()
        cargar_progreso_usuario()

        try:
            respuesta = requests.get(
                f"{DATABASE_URL}/biblioteca.json"
            )

            datos = respuesta.json()

            if datos:

                for key, libro in datos.items():

                    titulo = libro.get("titulo", "")
                    imagen = libro.get("portada_url") or convertir_link_google_drive(
                        libro.get("imagen", ""),
                        "imagen",
                    )
                    pdf = libro.get("pdf_url") or convertir_link_google_drive(
                        libro.get("pdf", ""),
                        "pdf",
                    )

                    if texto_busqueda.lower() in titulo.lower():

                        libros_lista.controls.append(
                            crear_libro(
                                key,
                                titulo,
                                imagen,
                                pdf,
                            )
                        )

        except:
            livros_error = ft.Text(
                "Error cargando biblioteca",
                color="red",
            )

            libros_lista.controls.append(livros_error)

        page.update()

    cargar_libros()

    page.add(
        fondo_secundario(
            ft.Column(
                expand=True,

                controls=[

                    # HEADER
                    ft.Container(
                        padding=20,

                        content=ft.Row(
                            alignment=ft.MainAxisAlignment.START,

                            controls=[

                                ft.IconButton(
                                    icon=ft.Icons.ARROW_BACK,
                                    icon_color="#4E4A2A",
                                    on_click=lambda e: volver_inicio(),
                                ),

                                ft.Text(
                                    "Biblioteca",
                                    size=28,
                                    weight=ft.FontWeight.BOLD,
                                    color="#4E4A2A",
                                ),
                            ],
                        ),
                    ),

                    # BUSCADOR
                    ft.Container(
                        padding=ft.padding.only(
                            left=20,
                            right=20,
                            bottom=15,
                        ),

                        content=buscador,
                    ),

                    # LIBROS
                    ft.Container(
                        expand=True,
                        padding=20,

                        content=libros_lista,
                    ),
                ],
            )
        )
    )

