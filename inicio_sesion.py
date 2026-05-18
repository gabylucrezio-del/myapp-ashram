import flet as ft
import requests
import json


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    api_key = datos["client"][0]["api_key"][0]["current_key"]
    database_url = datos["project_info"]["firebase_url"]

    return api_key, database_url


API_KEY, DATABASE_URL = cargar_firebase_config()


def pantalla_login_registro(page: ft.Page, mostrar_inicio):

    es_registro = False

    titulo = ft.Text(
        "Iniciar sesión",
        size=28,
        color="#FFFFFF",
        weight=ft.FontWeight.BOLD,
        text_align=ft.TextAlign.CENTER,
    )

    email = ft.TextField(
        label="Email",
        width=300,
        border_radius=15,
        bgcolor="#FFF8E7",
        label_style=ft.TextStyle(color="#8B5E3C"),
        text_style=ft.TextStyle(color="#3E3A1F"),
    )

    password = ft.TextField(
        label="Contraseña",
        password=True,
        can_reveal_password=True,
        width=300,
        border_radius=15,
        bgcolor="#FFF8E7",
        label_style=ft.TextStyle(color="#8B5E3C"),
        text_style=ft.TextStyle(color="#3E3A1F"),
    )

    mensaje = ft.Text(
        "",
        size=13,
        color="#FFFFFF",
        text_align=ft.TextAlign.CENTER,
    )

    def mostrar_mensaje(texto):
        mensaje.value = texto
        page.update()

    def iniciar_sesion(e):
        if not email.value or not password.value:
            mostrar_mensaje("Completá email y contraseña.")
            return

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"

        datos = {
            "email": email.value,
            "password": password.value,
            "returnSecureToken": True,
        }

        respuesta = requests.post(url, json=datos)

        if respuesta.status_code == 200:
            usuario = respuesta.json()

            page.client_storage.set("usuario_email", usuario["email"])
            page.client_storage.set("id_token", usuario["idToken"])
            page.client_storage.set("uid", usuario["localId"])

            mostrar_inicio()
        else:
            mostrar_mensaje("Email o contraseña incorrectos.")

    def registrar_usuario(e):
        if not email.value or not password.value:
            mostrar_mensaje("Completá email y contraseña.")
            return

        if len(password.value) < 6:
            mostrar_mensaje("La contraseña debe tener mínimo 6 caracteres.")
            return

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"

        datos = {
            "email": email.value,
            "password": password.value,
            "returnSecureToken": True,
        }

        respuesta = requests.post(url, json=datos)

        if respuesta.status_code == 200:
            usuario = respuesta.json()

            uid = usuario["localId"]

            page.client_storage.set("usuario_email", usuario["email"])
            page.client_storage.set("id_token", usuario["idToken"])
            page.client_storage.set("uid", uid)

            guardar_usuario_en_database(uid, usuario["email"])

            mostrar_inicio()
        else:
            mostrar_mensaje("No se pudo registrar. Tal vez el email ya existe.")

    def guardar_usuario_en_database(uid, email_usuario):
        url = f"{DATABASE_URL}/usuarios/{uid}.json"

        datos = {
            "email": email_usuario,
            "nombre": "",
            "domicilio": "",
            "telefono": "",
            "localidad": "",
            "codigo_postal": "",
            "fecha_nacimiento": "",
            "edad": None,
            "rol": "usuario",
            "permiso_biblioteca": True,
            "permiso_meditacion": True,
            "permiso_conocimientos": False,
            "permiso_ejercicios": False,
            "etiquetas_conocimiento": {},
            "etiquetas_ejercicios": {},
        }

        requests.put(url, json=datos)

    def cerrar_dialogo(dialogo):
        dialogo.open = False
        page.update()

    def recuperar_password(e):
        email_recuperar = ft.TextField(
            label="Ingresá tu email",
            width=280,
            border_radius=15,
            bgcolor="#FFF8E7",
            label_style=ft.TextStyle(color="#8B5E3C"),
            text_style=ft.TextStyle(color="#3E3A1F"),
        )

        mensaje_recuperar = ft.Text(
            "",
            size=12,
            color="#5E5A2E",
            text_align=ft.TextAlign.CENTER,
        )

        def enviar_email(e):
            if not email_recuperar.value:
                mensaje_recuperar.value = "Escribí tu email."
                page.update()
                return

            url = f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={API_KEY}"

            datos = {
                "requestType": "PASSWORD_RESET",
                "email": email_recuperar.value,
            }

            respuesta = requests.post(url, json=datos)

            if respuesta.status_code == 200:
                mensaje_recuperar.value = "Te enviamos un email para cambiar la contraseña."
            else:
                mensaje_recuperar.value = "No se pudo enviar. Revisá el email."

            page.update()

        dialogo = ft.AlertDialog(
            modal=True,
            title=ft.Text(
                "Recuperar contraseña",
                color="#5E5A2E",
                weight=ft.FontWeight.BOLD,
            ),
            content=ft.Column(
                tight=True,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                controls=[
                    email_recuperar,
                    ft.Container(height=10),
                    mensaje_recuperar,
                ],
            ),
            actions=[
                ft.TextButton(
                    text="Cancelar",
                    on_click=lambda e: cerrar_dialogo(dialogo),
                ),
                ft.ElevatedButton(
                    text="Enviar",
                    bgcolor="#EBCF94",
                    color="#5E5A2E",
                    on_click=enviar_email,
                ),
            ],
        )

        page.dialog = dialogo
        dialogo.open = True
        page.update()

    boton_principal = ft.ElevatedButton(
        text="Entrar",
        width=300,
        height=45,
        bgcolor="#EBCF94",
        color="#5E5A2E",
        on_click=iniciar_sesion,
    )

    boton_olvide = ft.TextButton(
        text="Olvidé mi contraseña",
        on_click=recuperar_password,
        style=ft.ButtonStyle(
            color="#FFFFFF",
        ),
    )

    boton_cambiar = ft.TextButton(
        text="Crear cuenta nueva",
        style=ft.ButtonStyle(
            color="#FFFFFF",
        ),
        on_click=lambda e: cambiar_modo(),
    )

    def cambiar_modo():
        nonlocal es_registro

        es_registro = not es_registro

        if es_registro:
            titulo.value = "Crear cuenta"
            boton_principal.text = "Registrarme"
            boton_principal.on_click = registrar_usuario
            boton_cambiar.text = "Ya tengo cuenta"
            boton_olvide.visible = False
        else:
            titulo.value = "Iniciar sesión"
            boton_principal.text = "Entrar"
            boton_principal.on_click = iniciar_sesion
            boton_cambiar.text = "Crear cuenta nueva"
            boton_olvide.visible = True

        mensaje.value = ""
        page.update()

    page.clean()

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
                            ft.Container(height=45),

                            ft.Image(
                                src="assets/Logo Ashram.webp",
                                width=115,
                                height=115,
                                fit=ft.ImageFit.CONTAIN,
                            ),

                            ft.Container(height=8),

                            titulo,

                            ft.Container(height=25),

                            ft.Container(
                                width=340,
                                padding=25,
                                border_radius=25,
                                bgcolor="#88000000",
                                content=ft.Column(
                                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                                    controls=[
                                        email,
                                        ft.Container(height=10),
                                        password,
                                        ft.Container(height=15),
                                        boton_principal,
                                        boton_olvide,
                                        boton_cambiar,
                                        mensaje,
                                    ],
                                ),
                            ),
                        ],
                    ),
                ],
            ),
        )
    )
