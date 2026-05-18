import json
from datetime import datetime

import flet as ft
import requests
from view.ui_helpers import fondo_secundario


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    return datos["project_info"]["firebase_url"]


DATABASE_URL = cargar_firebase_config()
ADMIN_EMAILS = {"gabriel@ashramganesha.com"}


def mostrar_chat(page: ft.Page, volver_inicio):
    email = (page.client_storage.get("usuario_email") or "").lower()
    if email in ADMIN_EMAILS:
        mostrar_chat_admin(page, volver_inicio)
    else:
        mostrar_chat_usuario(page, volver_inicio)


def mostrar_chat_usuario(page: ft.Page, volver_inicio):
    page.clean()

    uid = page.client_storage.get("uid")
    email = page.client_storage.get("usuario_email") or "Usuario"
    mensajes_lista = ft.ListView(expand=True, spacing=10, padding=20, auto_scroll=True)
    mensaje = ft.TextField(
        hint_text="Escribe tu consulta...",
        expand=True,
        multiline=True,
        min_lines=1,
        max_lines=3,
        border_radius=18,
        bgcolor="#FFFDF8",
        border_color="#D8C7A0",
        color="#4E4A2A",
    )

    def cargar_mensajes():
        mensajes_lista.controls.clear()
        if not uid:
            return

        try:
            respuesta = requests.get(f"{DATABASE_URL}/chat/{uid}/mensajes.json")
            datos = respuesta.json() or {}
        except requests.RequestException:
            datos = {}

        for mensaje_id, item in sorted(datos.items(), key=lambda valor: valor[1].get("fecha", "")):
            mensajes_lista.controls.append(burbuja_mensaje(item, item.get("rol") == "usuario"))

        marcar_respuestas_leidas()
        page.update()

    def enviar(e):
        texto = (mensaje.value or "").strip()
        if not texto:
            return

        datos = {
            "texto": texto,
            "fecha": datetime.now().isoformat(),
            "remitente_uid": uid,
            "remitente_email": email,
            "rol": "usuario",
            "leido_admin": False,
            "leido_usuario": True,
        }

        try:
            requests.post(f"{DATABASE_URL}/chat/{uid}/mensajes.json", json=datos)
            requests.patch(
                f"{DATABASE_URL}/chat/{uid}.json",
                json={
                    "usuario_email": email,
                    "ultima_fecha": datos["fecha"],
                    "ultimo_mensaje": texto,
                },
            )
            mensaje.value = ""
            cargar_mensajes()
        except requests.RequestException:
            page.snack_bar = ft.SnackBar(content=ft.Text("No se pudo enviar el mensaje."), bgcolor="red")
            page.snack_bar.open = True
            page.update()

    def marcar_respuestas_leidas():
        try:
            respuesta = requests.get(f"{DATABASE_URL}/chat/{uid}/mensajes.json")
            datos = respuesta.json() or {}
            for mensaje_id, item in datos.items():
                if item.get("rol") == "admin" and not item.get("leido_usuario"):
                    requests.patch(
                        f"{DATABASE_URL}/chat/{uid}/mensajes/{mensaje_id}.json",
                        json={"leido_usuario": True},
                    )
        except requests.RequestException:
            pass

    page.add(
        fondo_secundario(
            ft.Column(
                expand=True,
                controls=[
                    encabezado("Chat", volver_inicio),
                    mensajes_lista,
                    ft.Container(
                        padding=ft.padding.only(left=12, right=12, bottom=12),
                        content=ft.Row(
                            vertical_alignment=ft.CrossAxisAlignment.END,
                            controls=[
                                mensaje,
                                ft.IconButton(
                                    icon=ft.Icons.SEND,
                                    icon_color="#5E5A2E",
                                    tooltip="Enviar",
                                    on_click=enviar,
                                ),
                            ],
                        ),
                    ),
                ],
            )
        )
    )
    cargar_mensajes()


def mostrar_chat_admin(page: ft.Page, volver_inicio):
    page.clean()

    conversaciones = ft.ListView(expand=True, spacing=12, padding=20)

    def cargar_conversaciones():
        conversaciones.controls.clear()
        try:
            respuesta = requests.get(f"{DATABASE_URL}/chat.json")
            datos = respuesta.json() or {}
        except requests.RequestException:
            datos = {}

        if not datos:
            conversaciones.controls.append(ft.Text("Todavia no hay consultas.", color="#4E4A2A"))
        else:
            for uid, chat in sorted(datos.items(), key=lambda item: item[1].get("ultima_fecha", ""), reverse=True):
                conversaciones.controls.append(tarjeta_conversacion(uid, chat))

        page.update()

    def tarjeta_conversacion(uid, chat):
        pendientes = contar_no_leidos_admin(uid)
        return ft.Container(
            padding=14,
            bgcolor="#FFFDF8",
            border_radius=16,
            border=ft.border.all(width=1, color="#D8C7A0"),
            ink=True,
            on_click=lambda e: mostrar_conversacion_admin(page, volver_inicio, uid),
            content=ft.Row(
                controls=[
                    ft.Container(
                        expand=True,
                        content=ft.Column(
                            spacing=4,
                            controls=[
                                ft.Text(chat.get("usuario_email", uid), size=15, weight=ft.FontWeight.BOLD, color="#4E4A2A"),
                                ft.Text(chat.get("ultimo_mensaje", ""), size=12, color="#5E5A2E", max_lines=2),
                            ],
                        ),
                    ),
                    ft.Container(
                        width=28,
                        height=28,
                        border_radius=14,
                        bgcolor="#A33A2A",
                        alignment=ft.alignment.center,
                        visible=pendientes > 0,
                        content=ft.Text(str(pendientes), color="#FFFFFF", size=12),
                    ),
                ],
            ),
        )

    page.add(
        fondo_secundario(
            ft.Column(
                expand=True,
                controls=[
                    encabezado("Consultas", volver_inicio),
                    conversaciones,
                ],
            )
        )
    )
    cargar_conversaciones()


def mostrar_conversacion_admin(page: ft.Page, volver_inicio, uid):
    page.clean()

    mensajes_lista = ft.ListView(expand=True, spacing=10, padding=20, auto_scroll=True)
    respuesta = ft.TextField(
        hint_text="Responder...",
        expand=True,
        multiline=True,
        min_lines=1,
        max_lines=3,
        border_radius=18,
        bgcolor="#FFFDF8",
        border_color="#D8C7A0",
        color="#4E4A2A",
    )

    def cargar_mensajes():
        mensajes_lista.controls.clear()
        try:
            datos = requests.get(f"{DATABASE_URL}/chat/{uid}/mensajes.json").json() or {}
        except requests.RequestException:
            datos = {}

        for mensaje_id, item in sorted(datos.items(), key=lambda valor: valor[1].get("fecha", "")):
            mensajes_lista.controls.append(burbuja_mensaje(item, item.get("rol") == "admin"))
            if item.get("rol") == "usuario" and not item.get("leido_admin"):
                try:
                    requests.patch(
                        f"{DATABASE_URL}/chat/{uid}/mensajes/{mensaje_id}.json",
                        json={"leido_admin": True},
                    )
                except requests.RequestException:
                    pass

        page.update()

    def enviar(e):
        texto = (respuesta.value or "").strip()
        if not texto:
            return

        email = page.client_storage.get("usuario_email") or "Administrador"
        datos = {
            "texto": texto,
            "fecha": datetime.now().isoformat(),
            "remitente_uid": page.client_storage.get("uid"),
            "remitente_email": email,
            "rol": "admin",
            "leido_admin": True,
            "leido_usuario": False,
        }

        try:
            requests.post(f"{DATABASE_URL}/chat/{uid}/mensajes.json", json=datos)
            requests.patch(
                f"{DATABASE_URL}/chat/{uid}.json",
                json={
                    "ultima_fecha": datos["fecha"],
                    "ultimo_mensaje": texto,
                },
            )
            respuesta.value = ""
            cargar_mensajes()
        except requests.RequestException:
            page.snack_bar = ft.SnackBar(content=ft.Text("No se pudo enviar la respuesta."), bgcolor="red")
            page.snack_bar.open = True
            page.update()

    page.add(
        fondo_secundario(
            ft.Column(
                expand=True,
                controls=[
                    encabezado("Conversacion", lambda: mostrar_chat_admin(page, volver_inicio)),
                    mensajes_lista,
                    ft.Container(
                        padding=ft.padding.only(left=12, right=12, bottom=12),
                        content=ft.Row(
                            vertical_alignment=ft.CrossAxisAlignment.END,
                            controls=[
                                respuesta,
                                ft.IconButton(icon=ft.Icons.SEND, icon_color="#5E5A2E", on_click=enviar),
                            ],
                        ),
                    ),
                ],
            )
        )
    )
    cargar_mensajes()


def contar_no_leidos_admin(uid):
    try:
        datos = requests.get(f"{DATABASE_URL}/chat/{uid}/mensajes.json").json() or {}
    except requests.RequestException:
        return 0

    return sum(1 for item in datos.values() if item.get("rol") == "usuario" and not item.get("leido_admin"))


def contar_notificaciones_admin():
    try:
        chats = requests.get(f"{DATABASE_URL}/chat.json").json() or {}
    except requests.RequestException:
        return 0

    return sum(contar_no_leidos_admin(uid) for uid in chats.keys())


def burbuja_mensaje(item, propio):
    return ft.Row(
        alignment=ft.MainAxisAlignment.END if propio else ft.MainAxisAlignment.START,
        controls=[
            ft.Container(
                width=290,
                padding=12,
                bgcolor="#EBCF94" if propio else "#FFFDF8",
                border_radius=16,
                border=ft.border.all(width=1, color="#D8C7A0"),
                content=ft.Column(
                    spacing=4,
                    controls=[
                        ft.Text(item.get("remitente_email", ""), size=10, color="#5E5A2E"),
                        ft.Text(item.get("texto", ""), size=13, color="#4E4A2A"),
                    ],
                ),
            )
        ],
    )


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

