import json
from datetime import date, datetime

import flet as ft
import requests
from view.ui_helpers import fondo_secundario


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    return datos["project_info"]["firebase_url"]


DATABASE_URL = cargar_firebase_config()


def mostrar_perfil(page: ft.Page, volver_inicio):
    page.clean()

    uid = page.client_storage.get("uid")
    email_usuario = page.client_storage.get("usuario_email") or ""

    nombre = campo_texto("Nombre")
    domicilio = campo_texto("Domicilio")
    telefono = campo_texto("Telefono")
    localidad = campo_texto("Localidad")
    codigo_postal = campo_texto("Codigo postal")
    fecha_nacimiento = campo_texto("Fecha de nacimiento", hint_text="AAAA-MM-DD")
    edad = ft.Text("Edad: -", size=15, color="#4E4A2A", weight=ft.FontWeight.BOLD)
    mensaje = ft.Text("", size=12, color="#5E5A2E", text_align=ft.TextAlign.CENTER)

    def calcular_edad(fecha_texto):
        try:
            nacimiento = datetime.strptime(fecha_texto.strip(), "%Y-%m-%d").date()
        except ValueError:
            return None

        hoy = date.today()
        return hoy.year - nacimiento.year - ((hoy.month, hoy.day) < (nacimiento.month, nacimiento.day))

    def actualizar_edad(e=None):
        edad_calculada = calcular_edad(fecha_nacimiento.value or "")
        edad.value = f"Edad: {edad_calculada} años" if edad_calculada is not None else "Edad: -"
        page.update()

    fecha_nacimiento.on_change = actualizar_edad

    def mostrar_mensaje(texto, color="#5E5A2E"):
        mensaje.value = texto
        mensaje.color = color
        page.update()

    def cargar_datos_usuario():
        if not uid:
            mostrar_mensaje("No se encontro el usuario logueado.", "red")
            return

        try:
            respuesta = requests.get(f"{DATABASE_URL}/usuarios/{uid}.json")
            datos = respuesta.json() or {}
        except requests.RequestException:
            mostrar_mensaje("Error conectando con la base de datos.", "red")
            return

        nombre.value = datos.get("nombre", "")
        domicilio.value = datos.get("domicilio", "")
        telefono.value = datos.get("telefono", "")
        localidad.value = datos.get("localidad", "")
        codigo_postal.value = datos.get("codigo_postal", "")
        fecha_nacimiento.value = datos.get("fecha_nacimiento", "")
        actualizar_edad()

    def guardar_perfil(e):
        if not uid:
            mostrar_mensaje("No se encontro el usuario logueado.", "red")
            return

        edad_calculada = calcular_edad(fecha_nacimiento.value or "")
        if fecha_nacimiento.value.strip() and edad_calculada is None:
            mostrar_mensaje("Usa el formato AAAA-MM-DD para la fecha de nacimiento.", "red")
            return

        datos = {
            "email": email_usuario,
            "nombre": nombre.value.strip(),
            "domicilio": domicilio.value.strip(),
            "telefono": telefono.value.strip(),
            "localidad": localidad.value.strip(),
            "codigo_postal": codigo_postal.value.strip(),
            "fecha_nacimiento": fecha_nacimiento.value.strip(),
            "edad": edad_calculada,
        }

        try:
            respuesta = requests.patch(f"{DATABASE_URL}/usuarios/{uid}.json", json=datos)
            if respuesta.status_code == 200:
                mostrar_mensaje("Perfil guardado correctamente.")
            else:
                mostrar_mensaje("No se pudo guardar el perfil.", "red")
        except requests.RequestException:
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    page.add(
        fondo_secundario(
            ft.Column(
                expand=True,
                scroll=ft.ScrollMode.AUTO,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                controls=[
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
                                    "Mi perfil",
                                    size=28,
                                    weight=ft.FontWeight.BOLD,
                                    color="#4E4A2A",
                                ),
                            ],
                        ),
                    ),
                    ft.Container(
                        width=340,
                        padding=20,
                        bgcolor="#FFFDF8",
                        border_radius=18,
                        border=ft.border.all(width=1, color="#D8C7A0"),
                        content=ft.Column(
                            spacing=14,
                            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                            controls=[
                                ft.Image(
                                    src="icono_perfil.webp",
                                    width=70,
                                    height=70,
                                    fit=ft.ImageFit.CONTAIN,
                                ),
                                ft.Text(email_usuario, size=12, color="#5E5A2E"),
                                nombre,
                                domicilio,
                                telefono,
                                localidad,
                                codigo_postal,
                                fecha_nacimiento,
                                edad,
                                ft.ElevatedButton(
                                    text="Guardar perfil",
                                    bgcolor="#5E5A2E",
                                    color="#FFFFFF",
                                    width=300,
                                    height=46,
                                    on_click=guardar_perfil,
                                ),
                                mensaje,
                            ],
                        ),
                    ),
                    ft.Container(height=20),
                ],
            )
        )
    )

    cargar_datos_usuario()


def campo_texto(label, value="", hint_text=None, on_change=None):
    return ft.TextField(
        label=label,
        value=value,
        hint_text=hint_text,
        width=300,
        border_radius=18,
        bgcolor="#FFFDF8",
        border_color="#D8C7A0",
        focused_border_color="#EBCF94",
        color="#4E4A2A",
        label_style=ft.TextStyle(color="#5E5A2E"),
        on_change=on_change,
    )

