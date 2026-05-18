import flet as ft
from view.carga_biblioteca_view import mostrar_carga_biblioteca
from view.banner_view import mostrar_carga_banners
from view.blog_view import mostrar_carga_blog
from view.contenidos_view import mostrar_carga_conocimiento, mostrar_carga_ejercicios
from view.gestion_usuarios_view import mostrar_gestion_usuarios
from view.meditacion_view import mostrar_carga_meditacion


def mostrar_administracion(page: ft.Page, volver_inicio):
    page.clean()

    def accion_pendiente(nombre):
        page.snack_bar = ft.SnackBar(
            content=ft.Text(f"Proximamente: carga de {nombre}"),
            bgcolor="#5E5A2E",
        )
        page.snack_bar.open = True
        page.update()

    page.add(
        ft.Container(
            width=400,
            height=800,
            content=ft.Stack(
                controls=[
                    ft.Container(
                        width=400,
                        height=800,
                        bgcolor="#DDE3C7",
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
                                border=ft.border.all(width=1, color="#EBCF94"),
                                content=ft.Row(
                                    vertical_alignment=ft.CrossAxisAlignment.CENTER,
                                    controls=[
                                        ft.IconButton(
                                            icon=ft.Icons.ARROW_BACK,
                                            icon_color="#5E5A2E",
                                            on_click=lambda e: volver_inicio(),
                                        ),
                                        ft.Container(width=4),
                                        ft.Column(
                                            spacing=2,
                                            alignment=ft.MainAxisAlignment.CENTER,
                                            controls=[
                                                ft.Text(
                                                    "Administracion",
                                                    size=24,
                                                    color="#5E5A2E",
                                                    weight=ft.FontWeight.BOLD,
                                                ),
                                                ft.Text(
                                                    "Carga de contenidos",
                                                    size=12,
                                                    color="#5E5A2E",
                                                ),
                                            ],
                                        ),
                                    ],
                                ),
                            ),
                            ft.Container(height=50),
                            ft.Row(
                                alignment=ft.MainAxisAlignment.CENTER,
                                spacing=10,
                                controls=[
                                    boton_admin(
                                        "Biblioteca",
                                        "icono_biblioteca.webp",
                                        on_click=lambda e: mostrar_carga_biblioteca(
                                            page,
                                            lambda: mostrar_administracion(page, volver_inicio),
                                        ),
                                    ),
                                    boton_admin(
                                        "Meditacion",
                                        "icono_meditacion.webp",
                                        on_click=lambda e: mostrar_carga_meditacion(
                                            page,
                                            lambda: mostrar_administracion(page, volver_inicio),
                                        ),
                                    ),
                                    boton_admin(
                                        "Conocimiento",
                                        "icono_conocimiento.webp",
                                        on_click=lambda e: mostrar_carga_conocimiento(
                                            page,
                                            lambda: mostrar_administracion(page, volver_inicio),
                                        ),
                                    ),
                                ],
                            ),
                            ft.Container(height=15),
                            ft.Row(
                                alignment=ft.MainAxisAlignment.CENTER,
                                spacing=10,
                                controls=[
                                    boton_admin(
                                        "Blog",
                                        "icono_blog.webp",
                                        on_click=lambda e: mostrar_carga_blog(
                                            page,
                                            lambda: mostrar_administracion(page, volver_inicio),
                                        ),
                                    ),
                                    boton_admin(
                                        "Ejercicios",
                                        "icono_ejercicios.webp",
                                        on_click=lambda e: mostrar_carga_ejercicios(
                                            page,
                                            lambda: mostrar_administracion(page, volver_inicio),
                                        ),
                                    ),
                                ],
                            ),
                            ft.Container(height=15),
                            ft.Row(
                                alignment=ft.MainAxisAlignment.CENTER,
                                spacing=10,
                                controls=[
                                    boton_admin(
                                        "Banners",
                                        "icono_blog.webp",
                                        on_click=lambda e: mostrar_carga_banners(
                                            page,
                                            lambda: mostrar_administracion(page, volver_inicio),
                                        ),
                                    ),
                                    boton_admin(
                                        "Usuarios",
                                        "icono_perfil.webp",
                                        54,
                                        on_click=lambda e: mostrar_gestion_usuarios(
                                            page,
                                            lambda: mostrar_administracion(page, volver_inicio),
                                        ),
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        )
    )


def boton_admin(texto, icono=None, icono_tamano=44, on_click=None):
    return ft.Container(
        width=100,
        height=120,
        bgcolor="#CCFFF8E7",
        border_radius=20,
        border=ft.border.all(width=1, color="#EBCF94"),
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

