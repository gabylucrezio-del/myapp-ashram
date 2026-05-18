import flet as ft
import json
import requests
import threading
import time
from inicio_sesion import pantalla_login_registro
from biblioteca_view import mostrar_biblioteca
from view.administracion_view import mostrar_administracion
from view.blog_view import mostrar_blog
from view.contenidos_view import mostrar_conocimiento, mostrar_ejercicios
from view.meditacion_view import mostrar_meditaciones
from view.perfil_view import mostrar_perfil
from view.link_utils import convertir_link_google_drive
from view.chat_view import mostrar_chat, contar_notificaciones_admin


def cargar_database_url():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)
    return datos["project_info"]["firebase_url"]


DATABASE_URL = cargar_database_url()
ADMIN_EMAILS = {"gabriel@ashramganesha.com"}


def main(page: ft.Page):

    page.title = "Ashram Ganesha"
    page.bgcolor = "#CCCCCC"
    page.window_width = 420
    page.window_height = 850
    page.scroll = ft.ScrollMode.AUTO

    def mostrar_inicio():
        page.clean()
        usuario = obtener_usuario_actual(page)
        es_admin = es_usuario_admin(page, usuario)
        banner_inicio = crear_banner_inicio(page, mostrar_inicio)
        notificaciones_chat = contar_notificaciones_admin() if es_admin else 0

        page.add(
            ft.Container(
                width=400,
                height=800,
                content=ft.Stack(
                    controls=[
                        ft.Image(
                            src="fondo_app.webp",
                            width=400,
                            height=800,
                            fit=ft.ImageFit.COVER,
                        ),

                        ft.Column(
                            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                            controls=[
                                ft.Container(height=8),

                                ft.Container(
                                    width=340,
                                    padding=ft.padding.symmetric(horizontal=12, vertical=8),
                                    bgcolor="#CCFFF8E7",
                                    border_radius=18,
                                    border=ft.border.all(
                                        width=1,
                                        color="#EBCF94",
                                    ),
                                    content=ft.Row(
                                        vertical_alignment=ft.CrossAxisAlignment.CENTER,
                                        controls=[
                                            ft.Image(
                                                src="assets/Logo Ashram.webp",
                                                width=68,
                                                height=68,
                                                fit=ft.ImageFit.CONTAIN,
                                            ),
                                            ft.Container(width=10),
                                            ft.Column(
                                                spacing=2,
                                                alignment=ft.MainAxisAlignment.CENTER,
                                                controls=[
                                                    ft.Text(
                                                        "Ashram Ganesha",
                                                        size=24,
                                                        color="#5E5A2E",
                                                        weight=ft.FontWeight.BOLD,
                                                    ),
                                                    ft.Text(
                                                        f"Bienvenido {page.client_storage.get('usuario_email')}",
                                                        size=12,
                                                        color="#5E5A2E",
                                                        text_align=ft.TextAlign.LEFT,
                                                    ),
                                                ],
                                            ),
                                        ],
                                    ),
                                ),

                                ft.Container(height=50),

                                banner_inicio,

                                ft.Container(
                                    visible=False,
                                    width=320,
                                    height=150,
                                    bgcolor="#CCB7B58A",
                                    border_radius=20,
                                    border=ft.border.all(
                                        width=1,
                                        color="#EBCF94",
                                    ),
                                    padding=20,
                                    alignment=ft.alignment.center,
                                    content=ft.Text(
                                        "Descubre la magia de Ashram Ganesha, un espacio para conectar con tu interior y encontrar armonía.",
                                        size=14,
                                        color="#5E5A2E",
                                        text_align=ft.TextAlign.CENTER,
                                    ),
                                ),

                                ft.Container(height=22),

                                ft.Row(
                                    alignment=ft.MainAxisAlignment.CENTER,
                                    spacing=10,
                                    controls=[
                                        boton_menu(
                                            "Biblioteca",
                                            "icono_biblioteca.webp",
                                            on_click=lambda e: mostrar_biblioteca(page, mostrar_inicio),
                                        ),
                                        boton_menu(
                                            "Meditación",
                                            "icono_meditacion.webp",
                                            on_click=lambda e: mostrar_meditaciones(page, mostrar_inicio),
                                        ),
                                        boton_menu(
                                            "Conocimiento",
                                            "icono_conocimiento.webp",
                                            on_click=lambda e: mostrar_conocimiento(page, mostrar_inicio),
                                        ),
                                    ],
                                ),

                                ft.Container(height=15),

                                ft.Row(
                                    alignment=ft.MainAxisAlignment.CENTER,
                                    spacing=10,
                                    controls=[
                                        boton_menu(
                                            "Blog",
                                            "icono_blog.webp",
                                            on_click=lambda e: mostrar_blog(page, mostrar_inicio),
                                        ),
                                        boton_menu(
                                            "Ejercicios",
                                            "icono_ejercicios.webp",
                                            on_click=lambda e: mostrar_ejercicios(page, mostrar_inicio),
                                        ),
                                        boton_menu(
                                            "Mi perfil",
                                            "icono_perfil.webp",
                                            54,
                                            on_click=lambda e: mostrar_perfil(page, mostrar_inicio),
                                        ),
                                    ],
                                ),

                                ft.Container(height=20),

                                ft.TextButton(
                                    text="Cerrar sesión",
                                    style=ft.ButtonStyle(
                                        color="#FFFFFF",
                                    ),
                                    on_click=cerrar_sesion,
                                ),

                                ft.Container(height=4),

                                ft.TextButton(
                                    text="Administración",
                                    style=ft.ButtonStyle(
                                        color="#FFFFFF",
                                    ),
                                    visible=es_admin,
                                    on_click=lambda e: mostrar_administracion(page, mostrar_inicio),
                                ),
                            ],
                        ),
                        boton_chat_flotante(
                            page,
                            mostrar_inicio,
                            notificaciones_chat,
                            es_admin,
                        ),
                    ],
                ),
            )
        )

    def cerrar_sesion(e):
        page.client_storage.clear()
        pantalla_login_registro(page, mostrar_inicio)

    usuario_guardado = page.client_storage.get("usuario_email")

    if usuario_guardado:
        mostrar_inicio()
    else:
        pantalla_login_registro(page, mostrar_inicio)


def boton_menu(texto, icono=None, icono_tamano=44, on_click=None):
    return ft.Container(
        width=100,
        height=120,
        bgcolor="#CCFFF8E7",
        border_radius=20,
        border=ft.border.all(
            width=1,
            color="#EBCF94",
        ),
        ink=True,
        on_click=on_click,
        alignment=ft.alignment.center,
        padding=8,
        content=ft.Column(
            spacing=6,
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            alignment=ft.MainAxisAlignment.CENTER,
            controls=[
                ft.Image(
                    src=icono,
                    width=icono_tamano,
                    height=icono_tamano,
                    fit=ft.ImageFit.CONTAIN,
                    visible=icono is not None,
                ),
                ft.Text(
                    texto,
                    size=11,
                    color="#5E5A2E",
                    text_align=ft.TextAlign.CENTER,
                    weight=ft.FontWeight.W_500,
                    max_lines=2,
                ),
            ],
        ),
    )


def obtener_usuario_actual(page: ft.Page):
    uid = page.client_storage.get("uid")
    if not uid:
        return {}

    try:
        respuesta = requests.get(f"{DATABASE_URL}/usuarios/{uid}.json")
        return respuesta.json() or {}
    except requests.RequestException:
        return {}


def es_usuario_admin(page: ft.Page, usuario):
    email = (page.client_storage.get("usuario_email") or "").lower()
    if email in ADMIN_EMAILS:
        asegurar_rol_admin(page)
        return True

    return usuario.get("rol") == "admin"


def asegurar_rol_admin(page: ft.Page):
    uid = page.client_storage.get("uid")
    if not uid:
        return

    try:
        requests.patch(f"{DATABASE_URL}/usuarios/{uid}.json", json={"rol": "admin"})
    except requests.RequestException:
        pass


def cargar_banners():
    try:
        respuesta = requests.get(f"{DATABASE_URL}/banners.json")
        datos = respuesta.json() or {}
    except requests.RequestException:
        return []

    banners = []
    for banner_id, banner in datos.items():
        imagen = convertir_link_google_drive(banner.get("imagen", ""), "imagen")
        if imagen:
            banners.append(
                {
                    "id": banner_id,
                    "titulo": banner.get("titulo", ""),
                    "imagen": imagen,
                    "post_id": banner.get("post_id", ""),
                    "orden": banner.get("orden", 0),
                }
            )

    return sorted(banners, key=lambda item: item.get("orden", 0))


def crear_banner_inicio(page: ft.Page, mostrar_inicio):
    banners = cargar_banners()

    if not banners:
        return ft.Container(
            width=320,
            height=180,
            bgcolor="#CCB7B58A",
            border_radius=20,
            border=ft.border.all(width=1, color="#EBCF94"),
            padding=20,
            alignment=ft.alignment.center,
            content=ft.Text(
                "Descubre la magia de Ashram Ganesha, un espacio para conectar con tu interior y encontrar armonía.",
                size=14,
                color="#5E5A2E",
                text_align=ft.TextAlign.CENTER,
            ),
        )

    estado = {"indice": 0, "activo": True}
    imagen = ft.Image(src=banners[0]["imagen"], width=320, height=180, fit=ft.ImageFit.CONTAIN)
    titulo = ft.Text(
        banners[0]["titulo"],
        size=15,
        color="#FFFFFF",
        weight=ft.FontWeight.BOLD,
        max_lines=2,
        text_align=ft.TextAlign.CENTER,
    )

    def abrir_banner(e):
        estado["activo"] = False
        post_id = banners[estado["indice"]].get("post_id")
        if post_id:
            mostrar_blog(page, mostrar_inicio, post_id)
        else:
            mostrar_blog(page, mostrar_inicio)

    contenedor = ft.Container(
        width=320,
        height=180,
        border_radius=20,
        border=ft.border.all(width=1, color="#EBCF94"),
        clip_behavior=ft.ClipBehavior.HARD_EDGE,
        ink=True,
        on_click=abrir_banner,
        content=ft.Stack(
            controls=[
                imagen,
                ft.Container(
                    left=0,
                    right=0,
                    bottom=0,
                    padding=10,
                    bgcolor="#66000000",
                    content=titulo,
                ),
            ],
        ),
    )

    def rotar():
        while estado["activo"] and len(banners) > 1:
            time.sleep(5)
            if not estado["activo"]:
                break
            estado["indice"] = (estado["indice"] + 1) % len(banners)
            imagen.src = banners[estado["indice"]]["imagen"]
            titulo.value = banners[estado["indice"]]["titulo"]
            try:
                page.update()
            except Exception:
                break

    threading.Thread(target=rotar, daemon=True).start()
    return contenedor


def boton_chat_flotante(page: ft.Page, mostrar_inicio, notificaciones, es_admin):
    return ft.Container(
        right=18,
        bottom=18,
        width=64,
        height=64,
        border_radius=32,
        bgcolor="#5E5A2E",
        ink=True,
        on_click=lambda e: mostrar_chat(page, mostrar_inicio),
        content=ft.Stack(
            controls=[
                ft.Container(
                    alignment=ft.alignment.center,
                    content=ft.Icon(ft.Icons.CHAT, color="#FFFFFF", size=30),
                ),
                ft.Container(
                    right=0,
                    top=0,
                    width=24,
                    height=24,
                    border_radius=12,
                    bgcolor="#A33A2A",
                    alignment=ft.alignment.center,
                    visible=es_admin and notificaciones > 0,
                    content=ft.Text(str(notificaciones), color="#FFFFFF", size=11),
                ),
            ],
        ),
    )


ft.app(target=main, assets_dir=".")

