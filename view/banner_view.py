import json

import flet as ft
import requests

from view.link_utils import convertir_link_google_drive
from view.ui_helpers import fondo_secundario


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    return datos["project_info"]["firebase_url"]


DATABASE_URL = cargar_firebase_config()


def mostrar_carga_banners(page: ft.Page, volver_administracion):
    page.clean()

    estado = {"banners": {}, "posts": {}, "banner_editando_id": None}
    contenido = ft.Column(expand=True, scroll=ft.ScrollMode.AUTO, spacing=14)

    def mostrar_mensaje(texto, color="#5E5A2E"):
        page.snack_bar = ft.SnackBar(content=ft.Text(texto), bgcolor=color)
        page.snack_bar.open = True
        page.update()

    def cargar_datos():
        try:
            respuesta_banners = requests.get(f"{DATABASE_URL}/banners.json")
            respuesta_posts = requests.get(f"{DATABASE_URL}/blog.json")
            estado["banners"] = respuesta_banners.json() or {} if respuesta_banners.status_code == 200 else {}
            estado["posts"] = respuesta_posts.json() or {} if respuesta_posts.status_code == 200 else {}
        except requests.RequestException:
            estado["banners"] = {}
            estado["posts"] = {}
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def mostrar_lista():
        estado["banner_editando_id"] = None
        cargar_datos()
        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Banners", volver_administracion),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20),
                    content=ft.Row(
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        controls=[
                            ft.Text("Banners cargados", size=20, weight=ft.FontWeight.BOLD, color="#4E4A2A"),
                            ft.IconButton(
                                icon=ft.Icons.ADD_CIRCLE,
                                icon_color="#5E5A2E",
                                icon_size=34,
                                tooltip="Nuevo banner",
                                on_click=lambda e: mostrar_formulario(),
                            ),
                        ],
                    ),
                ),
            ]
        )

        if not estado["banners"]:
            contenido.controls.append(
                ft.Container(
                    padding=20,
                    alignment=ft.alignment.center,
                    content=ft.Text("Todavia no hay banners cargados.", color="#4E4A2A"),
                )
            )
            page.update()
            return

        for banner_id, banner in sorted(
            estado["banners"].items(),
            key=lambda item: item[1].get("orden", 0),
        ):
            contenido.controls.append(tarjeta_banner(banner_id, banner))

        page.update()

    def tarjeta_banner(banner_id, banner):
        imagen = convertir_link_google_drive(banner.get("imagen", ""), "imagen")
        post = estado["posts"].get(banner.get("post_id", ""), {})
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
                        width=90,
                        height=70,
                        border_radius=10,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        bgcolor="#F7F1E5",
                        content=ft.Image(src=imagen or "icono_blog.webp", fit=ft.ImageFit.CONTAIN),
                    ),
                    ft.Container(
                        expand=True,
                        padding=ft.padding.only(left=8),
                        content=ft.Column(
                            spacing=3,
                            controls=[
                                ft.Text(banner.get("titulo", "Sin titulo"), size=14, weight=ft.FontWeight.BOLD, color="#4E4A2A", max_lines=2),
                                ft.Text(post.get("titulo", "Sin post vinculado"), size=11, color="#5E5A2E", max_lines=1),
                            ],
                        ),
                    ),
                    ft.IconButton(icon=ft.Icons.EDIT, icon_color="#5E5A2E", tooltip="Editar", on_click=lambda e: mostrar_formulario(banner_id, banner)),
                    ft.IconButton(icon=ft.Icons.DELETE, icon_color="#A33A2A", tooltip="Borrar", on_click=lambda e: confirmar_borrado(banner_id, banner.get("titulo", "banner"))),
                ],
            ),
        )

    def confirmar_borrado(banner_id, titulo):
        dialogo = ft.AlertDialog(
            modal=True,
            title=ft.Text("Borrar banner"),
            content=ft.Text(f"Seguro que quieres borrar '{titulo}'?"),
            actions=[
                ft.TextButton("Cancelar", on_click=lambda e: cerrar_dialogo(dialogo)),
                ft.TextButton("Borrar", on_click=lambda e: borrar_banner(banner_id, dialogo)),
            ],
        )
        page.dialog = dialogo
        dialogo.open = True
        page.update()

    def cerrar_dialogo(dialogo):
        dialogo.open = False
        page.update()

    def borrar_banner(banner_id, dialogo):
        try:
            respuesta = requests.delete(f"{DATABASE_URL}/banners/{banner_id}.json")
            cerrar_dialogo(dialogo)
            if respuesta.status_code == 200:
                mostrar_mensaje("Banner borrado correctamente.")
                mostrar_lista()
            else:
                mostrar_mensaje("No se pudo borrar el banner.", "red")
        except requests.RequestException:
            cerrar_dialogo(dialogo)
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def mostrar_formulario(banner_id=None, banner=None):
        estado["banner_editando_id"] = banner_id
        banner = banner or {}

        titulo = campo_texto("Titulo", banner.get("titulo", ""))
        link_imagen = campo_texto("Link imagen", banner.get("link_imagen_original") or banner.get("imagen", ""))
        orden = campo_texto("Orden", str(banner.get("orden", "")))
        post_dropdown = ft.Dropdown(
            label="Post del blog",
            width=320,
            options=[
                ft.dropdown.Option(key=post_id, text=post.get("titulo", "Sin titulo"))
                for post_id, post in sorted(estado["posts"].items(), key=lambda item: (item[1].get("titulo") or "").lower())
            ],
            value=banner.get("post_id"),
            border_radius=18,
            bgcolor="#FFFDF8",
            border_color="#D8C7A0",
            color="#4E4A2A",
            label_style=ft.TextStyle(color="#5E5A2E"),
        )
        vista_previa = ft.Image(
            src=convertir_link_google_drive(link_imagen.value, "imagen") or "icono_blog.webp",
            width=320,
            height=180,
            fit=ft.ImageFit.CONTAIN,
        )

        def actualizar_vista(e=None):
            vista_previa.src = convertir_link_google_drive(link_imagen.value, "imagen") or "icono_blog.webp"
            page.update()

        link_imagen.on_change = actualizar_vista

        def guardar(e):
            if not titulo.value.strip():
                mostrar_mensaje("Completa el titulo.", "red")
                return
            if not link_imagen.value.strip():
                mostrar_mensaje("Completa el link de imagen.", "red")
                return
            if not post_dropdown.value:
                mostrar_mensaje("Selecciona el post del blog.", "red")
                return

            try:
                orden_valor = int(orden.value or 0)
            except ValueError:
                orden_valor = 0

            imagen_original = link_imagen.value.strip()
            datos = {
                "titulo": titulo.value.strip(),
                "imagen": convertir_link_google_drive(imagen_original, "imagen"),
                "link_imagen_original": imagen_original,
                "post_id": post_dropdown.value,
                "orden": orden_valor,
            }

            try:
                if estado["banner_editando_id"]:
                    respuesta = requests.patch(f"{DATABASE_URL}/banners/{estado['banner_editando_id']}.json", json=datos)
                else:
                    respuesta = requests.post(f"{DATABASE_URL}/banners.json", json=datos)

                if respuesta.status_code == 200:
                    mostrar_mensaje("Banner guardado correctamente.")
                    mostrar_lista()
                else:
                    mostrar_mensaje("No se pudo guardar el banner.", "red")
            except requests.RequestException:
                mostrar_mensaje("Error conectando con la base de datos.", "red")

        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Editar banner" if banner_id else "Nuevo banner", mostrar_lista),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20, bottom=20),
                    content=ft.Column(
                        spacing=14,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        controls=[
                            ft.Container(width=320, height=180, border_radius=15, clip_behavior=ft.ClipBehavior.HARD_EDGE, bgcolor="#FFFDF8", content=vista_previa),
                            titulo,
                            link_imagen,
                            post_dropdown,
                            orden,
                            ft.ElevatedButton(text="Guardar banner", bgcolor="#5E5A2E", color="#FFFFFF", width=320, height=46, on_click=guardar),
                        ],
                    ),
                ),
            ]
        )
        page.update()

    page.add(fondo_secundario(contenido))
    mostrar_lista()


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


def campo_texto(label, value=""):
    return ft.TextField(
        label=label,
        value=value,
        width=320,
        border_radius=18,
        bgcolor="#FFFDF8",
        border_color="#D8C7A0",
        focused_border_color="#EBCF94",
        color="#4E4A2A",
        label_style=ft.TextStyle(color="#5E5A2E"),
    )

