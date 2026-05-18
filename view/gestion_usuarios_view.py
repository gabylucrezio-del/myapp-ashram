import json

import flet as ft
import requests
from view.ui_helpers import fondo_secundario


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    return datos["project_info"]["firebase_url"]


DATABASE_URL = cargar_firebase_config()


def mostrar_gestion_usuarios(page: ft.Page, volver_administracion):
    page.clean()

    contenido = ft.Column(expand=True, scroll=ft.ScrollMode.AUTO, spacing=12)

    def mostrar_mensaje(texto, color="#5E5A2E"):
        page.snack_bar = ft.SnackBar(content=ft.Text(texto), bgcolor=color)
        page.snack_bar.open = True
        page.update()

    def cargar_json(ruta):
        try:
            respuesta = requests.get(f"{DATABASE_URL}/{ruta}.json")
            return respuesta.json() or {}
        except requests.RequestException:
            return {}

    def etiquetas_de(coleccion):
        datos = cargar_json(coleccion)
        etiquetas = set()
        for item in datos.values():
            etiqueta = (item.get("etiqueta") or "").strip()
            if etiqueta:
                etiquetas.add(etiqueta)
        return sorted(etiquetas)

    def mostrar_lista():
        usuarios = cargar_json("usuarios")
        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Gestion usuarios", volver_administracion),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20),
                    content=ft.Text(
                        "Selecciona un usuario para editar perfil, permisos y etiquetas.",
                        size=13,
                        color="#4E4A2A",
                    ),
                ),
            ]
        )

        if not usuarios:
            contenido.controls.append(ft.Text("No hay usuarios cargados.", color="#4E4A2A"))
            page.update()
            return

        for uid, usuario in sorted(usuarios.items(), key=lambda item: item[1].get("email", "")):
            contenido.controls.append(tarjeta_usuario(uid, usuario))

        page.update()

    def texto_etiquetas(etiquetas):
        if isinstance(etiquetas, dict):
            return ", ".join(sorted([key for key, value in etiquetas.items() if value]))
        return ""

    def dict_etiquetas(texto):
        resultado = {}
        for etiqueta in texto.split(","):
            etiqueta_limpia = etiqueta.strip()
            if etiqueta_limpia:
                resultado[etiqueta_limpia] = True
        return resultado

    def tarjeta_usuario(uid, usuario):
        permisos = []
        if usuario.get("rol") == "admin":
            permisos.append("Admin")
        if usuario.get("permiso_conocimientos"):
            permisos.append("Conocimiento total")
        elif usuario.get("etiquetas_conocimiento"):
            permisos.append("Conocimiento por etiquetas")
        if usuario.get("permiso_ejercicios"):
            permisos.append("Ejercicios total")
        elif usuario.get("etiquetas_ejercicios"):
            permisos.append("Ejercicios por etiquetas")

        return ft.Container(
            margin=ft.margin.symmetric(horizontal=20),
            padding=14,
            bgcolor="#FFFDF8",
            border_radius=16,
            border=ft.border.all(width=1, color="#D8C7A0"),
            ink=True,
            on_click=lambda e: mostrar_detalle_usuario(uid, usuario),
            content=ft.Row(
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
                controls=[
                    ft.Container(
                        width=46,
                        height=46,
                        border_radius=23,
                        bgcolor="#EBCF94",
                        alignment=ft.alignment.center,
                        content=ft.Icon(ft.Icons.PERSON, color="#5E5A2E"),
                    ),
                    ft.Container(
                        expand=True,
                        padding=ft.padding.only(left=10),
                        content=ft.Column(
                            spacing=4,
                            controls=[
                                ft.Text(
                                    usuario.get("nombre") or usuario.get("email", uid),
                                    size=15,
                                    weight=ft.FontWeight.BOLD,
                                    color="#4E4A2A",
                                    max_lines=1,
                                ),
                                ft.Text(usuario.get("email", ""), size=11, color="#5E5A2E", max_lines=1),
                                ft.Text(
                                    ", ".join(permisos) if permisos else "Sin permisos de suscripcion",
                                    size=11,
                                    color="#4E4A2A",
                                    max_lines=2,
                                ),
                            ],
                        ),
                    ),
                    ft.Icon(ft.Icons.CHEVRON_RIGHT, color="#5E5A2E"),
                ],
            ),
        )

    def mostrar_detalle_usuario(uid, usuario):
        permiso_conocimiento = ft.Checkbox(
            label="Acceso total conocimiento",
            value=bool(usuario.get("permiso_conocimientos")),
            active_color="#5E5A2E",
            label_style=ft.TextStyle(color="#4E4A2A", size=12),
        )
        permiso_ejercicios = ft.Checkbox(
            label="Acceso total ejercicios",
            value=bool(usuario.get("permiso_ejercicios")),
            active_color="#5E5A2E",
            label_style=ft.TextStyle(color="#4E4A2A", size=12),
        )
        es_admin = ft.Checkbox(
            label="Administrador",
            value=usuario.get("rol") == "admin",
            active_color="#5E5A2E",
            label_style=ft.TextStyle(color="#4E4A2A", size=12),
        )
        etiquetas_conocimiento = campo_texto(
            "Etiquetas conocimiento",
            texto_etiquetas(usuario.get("etiquetas_conocimiento") or {}),
        )
        etiquetas_ejercicios = campo_texto(
            "Etiquetas ejercicios",
            texto_etiquetas(usuario.get("etiquetas_ejercicios") or {}),
        )
        nombre = campo_texto("Nombre", usuario.get("nombre", ""))
        domicilio = campo_texto("Domicilio", usuario.get("domicilio", ""))
        telefono = campo_texto("Telefono", usuario.get("telefono", ""))
        localidad = campo_texto("Localidad", usuario.get("localidad", ""))
        codigo_postal = campo_texto("Codigo postal", usuario.get("codigo_postal", ""))
        fecha_nacimiento = campo_texto("Fecha nacimiento", usuario.get("fecha_nacimiento", ""))

        def guardar(e):
            datos = {
                "nombre": nombre.value.strip(),
                "domicilio": domicilio.value.strip(),
                "telefono": telefono.value.strip(),
                "localidad": localidad.value.strip(),
                "codigo_postal": codigo_postal.value.strip(),
                "fecha_nacimiento": fecha_nacimiento.value.strip(),
                "permiso_conocimientos": permiso_conocimiento.value,
                "permiso_ejercicios": permiso_ejercicios.value,
                "etiquetas_conocimiento": dict_etiquetas(etiquetas_conocimiento.value or ""),
                "etiquetas_ejercicios": dict_etiquetas(etiquetas_ejercicios.value or ""),
                "rol": "admin" if es_admin.value else "usuario",
            }
            try:
                respuesta = requests.patch(f"{DATABASE_URL}/usuarios/{uid}.json", json=datos)
                if respuesta.status_code == 200:
                    mostrar_mensaje("Usuario actualizado.")
                else:
                    mostrar_mensaje("No se pudo actualizar el usuario.", "red")
            except requests.RequestException:
                mostrar_mensaje("Error conectando con la base de datos.", "red")

        sugeridas_conocimiento = ", ".join(etiquetas_de("conocimiento"))
        sugeridas_ejercicios = ", ".join(etiquetas_de("ejercicios"))

        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Editar usuario", mostrar_lista),
                ft.Container(
                    margin=ft.margin.symmetric(horizontal=20),
                    padding=14,
                    bgcolor="#FFFDF8",
                    border_radius=16,
                    border=ft.border.all(width=1, color="#D8C7A0"),
                    content=ft.Column(
                        spacing=12,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        controls=[
                            ft.Text(usuario.get("email", uid), size=15, weight=ft.FontWeight.BOLD, color="#4E4A2A"),
                            ft.Text("Datos del perfil", size=14, weight=ft.FontWeight.BOLD, color="#5E5A2E"),
                            nombre,
                            domicilio,
                            telefono,
                            localidad,
                            codigo_postal,
                            fecha_nacimiento,
                            ft.Text("Permisos", size=14, weight=ft.FontWeight.BOLD, color="#5E5A2E"),
                            es_admin,
                            permiso_conocimiento,
                            etiquetas_conocimiento,
                            ft.Text(f"Disponibles conocimiento: {sugeridas_conocimiento or '-'}", size=10, color="#5E5A2E"),
                            permiso_ejercicios,
                            etiquetas_ejercicios,
                            ft.Text(f"Disponibles ejercicios: {sugeridas_ejercicios or '-'}", size=10, color="#5E5A2E"),
                            ft.ElevatedButton(
                                text="Guardar cambios",
                                bgcolor="#5E5A2E",
                                color="#FFFFFF",
                                width=300,
                                on_click=guardar,
                            ),
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
                ft.Text(titulo, size=25, weight=ft.FontWeight.BOLD, color="#4E4A2A"),
            ],
        ),
    )


def campo_texto(label, value=""):
    return ft.TextField(
        label=label,
        value=value,
        width=300,
        border_radius=18,
        bgcolor="#FFFDF8",
        border_color="#D8C7A0",
        focused_border_color="#EBCF94",
        color="#4E4A2A",
        label_style=ft.TextStyle(color="#5E5A2E"),
    )

