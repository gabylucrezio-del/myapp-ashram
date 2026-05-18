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


def mostrar_carga_meditacion(page: ft.Page, volver_administracion):
    page.clean()

    estado = {"meditaciones": {}, "meditacion_editando_id": None}
    contenido = ft.Column(expand=True, scroll=ft.ScrollMode.AUTO, spacing=14)

    def mostrar_mensaje(texto, color="#5E5A2E"):
        page.snack_bar = ft.SnackBar(content=ft.Text(texto), bgcolor=color)
        page.snack_bar.open = True
        page.update()

    def cargar_meditaciones():
        try:
            respuesta = requests.get(f"{DATABASE_URL}/meditaciones.json")
            estado["meditaciones"] = respuesta.json() or {} if respuesta.status_code == 200 else {}
        except requests.RequestException:
            estado["meditaciones"] = {}
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def mostrar_lista():
        estado["meditacion_editando_id"] = None
        cargar_meditaciones()
        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Meditacion", volver_administracion),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20),
                    content=ft.Row(
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        controls=[
                            ft.Text(
                                "Meditaciones cargadas",
                                size=20,
                                weight=ft.FontWeight.BOLD,
                                color="#4E4A2A",
                            ),
                            ft.IconButton(
                                icon=ft.Icons.ADD_CIRCLE,
                                icon_color="#5E5A2E",
                                icon_size=34,
                                tooltip="Nueva meditacion",
                                on_click=lambda e: mostrar_formulario(),
                            ),
                        ],
                    ),
                ),
            ]
        )

        if not estado["meditaciones"]:
            contenido.controls.append(
                ft.Container(
                    padding=20,
                    alignment=ft.alignment.center,
                    content=ft.Text(
                        "Todavia no hay meditaciones cargadas.",
                        color="#4E4A2A",
                        text_align=ft.TextAlign.CENTER,
                    ),
                )
            )
            page.update()
            return

        for meditacion_id, meditacion in sorted(
            estado["meditaciones"].items(),
            key=lambda item: (item[1].get("titulo") or "").lower(),
        ):
            contenido.controls.append(tarjeta_admin(meditacion_id, meditacion))

        page.update()

    def tarjeta_admin(meditacion_id, meditacion):
        imagen = convertir_link_google_drive(meditacion.get("imagen", ""), "imagen")
        titulo = meditacion.get("titulo", "Sin titulo")
        guia = meditacion.get("guia", "")

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
                        width=64,
                        height=64,
                        border_radius=12,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        bgcolor="#F7F1E5",
                        content=ft.Image(src=imagen or "icono_meditacion.webp", fit=ft.ImageFit.COVER),
                    ),
                    ft.Container(
                        expand=True,
                        padding=ft.padding.only(left=8),
                        content=ft.Column(
                            spacing=3,
                            controls=[
                                ft.Text(
                                    titulo,
                                    size=14,
                                    weight=ft.FontWeight.BOLD,
                                    color="#4E4A2A",
                                    max_lines=2,
                                ),
                                ft.Text(
                                    guia or "Guia sin cargar",
                                    size=11,
                                    color="#5E5A2E",
                                    max_lines=1,
                                ),
                            ],
                        ),
                    ),
                    ft.IconButton(
                        icon=ft.Icons.VISIBILITY,
                        icon_color="#5E5A2E",
                        tooltip="Ver",
                        on_click=lambda e: ver_meditacion(meditacion),
                    ),
                    ft.IconButton(
                        icon=ft.Icons.EDIT,
                        icon_color="#5E5A2E",
                        tooltip="Editar",
                        on_click=lambda e: mostrar_formulario(meditacion_id, meditacion),
                    ),
                    ft.IconButton(
                        icon=ft.Icons.DELETE,
                        icon_color="#A33A2A",
                        tooltip="Borrar",
                        on_click=lambda e: confirmar_borrado(meditacion_id, titulo),
                    ),
                ],
            ),
        )

    def ver_meditacion(meditacion):
        imagen = convertir_link_google_drive(meditacion.get("imagen", ""), "imagen")
        dialogo = ft.AlertDialog(
            modal=True,
            title=ft.Text(meditacion.get("titulo", "Meditacion"), color="#4E4A2A"),
            content=ft.Column(
                width=300,
                height=320,
                scroll=ft.ScrollMode.AUTO,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                controls=[
                    ft.Container(
                        width=180,
                        height=120,
                        border_radius=15,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        bgcolor="#FFFDF8",
                        content=ft.Image(src=imagen or "icono_meditacion.webp", fit=ft.ImageFit.COVER),
                    ),
                    ft.Text(f"Guia: {meditacion.get('guia') or 'Sin cargar'}", color="#4E4A2A"),
                    ft.Text(
                        meditacion.get("descripcion") or "Sin descripcion.",
                        color="#4E4A2A",
                        text_align=ft.TextAlign.CENTER,
                    ),
                ],
            ),
            actions=[ft.TextButton("Cerrar", on_click=lambda e: cerrar_dialogo(dialogo))],
        )
        page.dialog = dialogo
        dialogo.open = True
        page.update()

    def confirmar_borrado(meditacion_id, titulo):
        dialogo = ft.AlertDialog(
            modal=True,
            title=ft.Text("Borrar meditacion"),
            content=ft.Text(f"Seguro que quieres borrar '{titulo}'?"),
            actions=[
                ft.TextButton("Cancelar", on_click=lambda e: cerrar_dialogo(dialogo)),
                ft.TextButton("Borrar", on_click=lambda e: borrar_meditacion(meditacion_id, dialogo)),
            ],
        )
        page.dialog = dialogo
        dialogo.open = True
        page.update()

    def cerrar_dialogo(dialogo):
        dialogo.open = False
        page.update()

    def borrar_meditacion(meditacion_id, dialogo):
        try:
            respuesta = requests.delete(f"{DATABASE_URL}/meditaciones/{meditacion_id}.json")
            cerrar_dialogo(dialogo)
            if respuesta.status_code == 200:
                mostrar_mensaje("Meditacion borrada correctamente.")
                mostrar_lista()
            else:
                mostrar_mensaje("No se pudo borrar la meditacion.", "red")
        except requests.RequestException:
            cerrar_dialogo(dialogo)
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def mostrar_formulario(meditacion_id=None, meditacion=None):
        estado["meditacion_editando_id"] = meditacion_id
        meditacion = meditacion or {}

        titulo = campo_texto("Titulo", meditacion.get("titulo", ""))
        descripcion = campo_texto(
            "Descripcion",
            meditacion.get("descripcion", ""),
            multiline=True,
            min_lines=3,
            max_lines=4,
        )
        guia = campo_texto("Guia", meditacion.get("guia", ""))
        link_imagen = campo_texto(
            "Link imagen",
            meditacion.get("link_imagen_original") or meditacion.get("imagen", ""),
        )
        link_audio = campo_texto(
            "Link audio",
            meditacion.get("link_audio_original") or meditacion.get("audio", ""),
        )

        vista_previa_imagen = ft.Image(
            src=convertir_link_google_drive(link_imagen.value, "imagen") or "icono_meditacion.webp",
            width=220,
            height=140,
            fit=ft.ImageFit.COVER,
        )

        def actualizar_vista_previa(e=None):
            vista_previa_imagen.src = (
                convertir_link_google_drive(link_imagen.value, "imagen") or "icono_meditacion.webp"
            )
            page.update()

        link_imagen.on_change = actualizar_vista_previa

        def guardar_meditacion(e):
            if not titulo.value.strip():
                mostrar_mensaje("Completa el titulo de la meditacion.", "red")
                return
            if not link_imagen.value.strip():
                mostrar_mensaje("Completa el link de la imagen.", "red")
                return
            if not link_audio.value.strip():
                mostrar_mensaje("Completa el link del audio.", "red")
                return

            imagen_original = link_imagen.value.strip()
            audio_original = link_audio.value.strip()
            datos_meditacion = {
                "titulo": titulo.value.strip(),
                "descripcion": descripcion.value.strip(),
                "guia": guia.value.strip(),
                "imagen": convertir_link_google_drive(imagen_original, "imagen"),
                "audio": convertir_link_google_drive(audio_original, "audio"),
                "link_imagen_original": imagen_original,
                "link_audio_original": audio_original,
            }

            try:
                if estado["meditacion_editando_id"]:
                    respuesta = requests.patch(
                        f"{DATABASE_URL}/meditaciones/{estado['meditacion_editando_id']}.json",
                        json=datos_meditacion,
                    )
                    mensaje_ok = "Meditacion actualizada correctamente."
                else:
                    respuesta = requests.post(f"{DATABASE_URL}/meditaciones.json", json=datos_meditacion)
                    mensaje_ok = "Meditacion cargada correctamente."

                if respuesta.status_code == 200:
                    mostrar_mensaje(mensaje_ok)
                    mostrar_lista()
                else:
                    mostrar_mensaje("No se pudo guardar la meditacion.", "red")
            except requests.RequestException:
                mostrar_mensaje("Error conectando con la base de datos.", "red")

        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Editar meditacion" if meditacion_id else "Nueva meditacion", mostrar_lista),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20, bottom=20),
                    content=ft.Column(
                        spacing=14,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        controls=[
                            ft.Container(
                                width=220,
                                height=140,
                                border_radius=15,
                                clip_behavior=ft.ClipBehavior.HARD_EDGE,
                                bgcolor="#FFFDF8",
                                content=vista_previa_imagen,
                            ),
                            titulo,
                            descripcion,
                            guia,
                            link_imagen,
                            link_audio,
                            ft.ElevatedButton(
                                text="Guardar cambios" if meditacion_id else "Guardar meditacion",
                                bgcolor="#5E5A2E",
                                color="#FFFFFF",
                                width=320,
                                height=46,
                                on_click=guardar_meditacion,
                            ),
                        ],
                    ),
                ),
            ]
        )
        page.update()

    page.add(fondo_secundario(contenido))
    mostrar_lista()


def mostrar_meditaciones(page: ft.Page, volver_inicio):
    page.clean()

    usuario_uid = page.client_storage.get("uid") or page.client_storage.get("usuario_email") or "invitado"
    meditaciones_lista = ft.ListView(expand=True, spacing=12, padding=20)
    favoritos = {}

    buscador = ft.TextField(
        hint_text="Buscar meditaciones...",
        prefix_icon=ft.Icons.SEARCH,
        border_radius=20,
        bgcolor="#FFFDF8",
        border_color="#D8C7A0",
        color="#4E4A2A",
        width=360,
        on_change=lambda e: cargar_meditaciones(buscador.value),
    )

    def mostrar_mensaje(texto, color="#5E5A2E"):
        page.snack_bar = ft.SnackBar(content=ft.Text(texto), bgcolor=color)
        page.snack_bar.open = True
        page.update()

    def cargar_favoritos():
        nonlocal favoritos
        try:
            respuesta = requests.get(f"{DATABASE_URL}/favoritos_meditacion/{usuario_uid}.json")
            favoritos = respuesta.json() or {}
        except requests.RequestException:
            favoritos = {}

    def guardar_favorito(meditacion_id, es_favorito):
        try:
            if es_favorito:
                requests.put(f"{DATABASE_URL}/favoritos_meditacion/{usuario_uid}/{meditacion_id}.json", json=True)
                favoritos[meditacion_id] = True
            else:
                requests.delete(f"{DATABASE_URL}/favoritos_meditacion/{usuario_uid}/{meditacion_id}.json")
                favoritos.pop(meditacion_id, None)
        except requests.RequestException:
            mostrar_mensaje("No se pudo guardar el favorito.", "red")

    def abrir_reproductor(meditacion_id, meditacion):
        page.clean()

        imagen = convertir_link_google_drive(meditacion.get("imagen", ""), "imagen")
        audio_src = convertir_link_google_drive(meditacion.get("audio", ""), "audio")
        audio = ft.Audio(src=audio_src, autoplay=False)
        page.overlay.append(audio)

        reproduciendo = {"valor": False}
        estado_audio = ft.Text("Listo para reproducir", size=12, color="#5E5A2E")
        play_icon = ft.IconButton(
            icon=ft.Icons.PLAY_CIRCLE,
            icon_color="#5E5A2E",
            icon_size=54,
            tooltip="Reproducir",
        )
        stop_icon = ft.IconButton(
            icon=ft.Icons.STOP_CIRCLE,
            icon_color="#A33A2A",
            icon_size=42,
            tooltip="Detener",
        )
        favorito = ft.Checkbox(
            label="Guardar en favoritos",
            value=bool(favoritos.get(meditacion_id)),
            active_color="#5E5A2E",
            label_style=ft.TextStyle(color="#4E4A2A"),
            on_change=lambda e: guardar_favorito(meditacion_id, e.control.value),
        )

        def alternar_audio(e):
            if reproduciendo["valor"]:
                audio.pause()
                play_icon.icon = ft.Icons.PLAY_CIRCLE
                play_icon.tooltip = "Reproducir"
                estado_audio.value = "Pausado"
            else:
                audio.play()
                play_icon.icon = ft.Icons.PAUSE_CIRCLE
                play_icon.tooltip = "Pausar"
                estado_audio.value = "Reproduciendo"

            reproduciendo["valor"] = not reproduciendo["valor"]
            page.update()

        def detener_audio(e):
            audio.pause()
            audio.seek(0)
            reproduciendo["valor"] = False
            play_icon.icon = ft.Icons.PLAY_CIRCLE
            play_icon.tooltip = "Reproducir"
            estado_audio.value = "Detenido"
            page.update()

        play_icon.on_click = alternar_audio
        stop_icon.on_click = detener_audio

        def volver():
            try:
                audio.pause()
                audio.release()
                if audio in page.overlay:
                    page.overlay.remove(audio)
            except Exception:
                pass
            mostrar_meditaciones(page, volver_inicio)

        page.add(
            fondo_secundario(
                ft.Column(
                    expand=True,
                    scroll=ft.ScrollMode.AUTO,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
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
                                        on_click=lambda e: volver(),
                                    ),
                                    ft.Text(
                                        meditacion.get("titulo", "Meditacion"),
                                        size=20,
                                        weight=ft.FontWeight.BOLD,
                                        color="#4E4A2A",
                                        expand=True,
                                        max_lines=2,
                                    ),
                                ],
                            ),
                        ),
                        ft.Container(
                            width=330,
                            height=210,
                            border_radius=18,
                            clip_behavior=ft.ClipBehavior.HARD_EDGE,
                            bgcolor="#FFFDF8",
                            content=ft.Image(src=imagen or "icono_meditacion.webp", fit=ft.ImageFit.COVER),
                        ),
                        ft.Container(height=6),
                        ft.Container(
                            width=330,
                            padding=14,
                            bgcolor="#FFFDF8",
                            border_radius=16,
                            border=ft.border.all(width=1, color="#D8C7A0"),
                            content=ft.Column(
                                spacing=8,
                                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                                controls=[
                                    ft.Text(
                                        "Reproductor de audio",
                                        size=15,
                                        weight=ft.FontWeight.BOLD,
                                        color="#4E4A2A",
                                    ),
                                    ft.Row(
                                        alignment=ft.MainAxisAlignment.CENTER,
                                        vertical_alignment=ft.CrossAxisAlignment.CENTER,
                                        controls=[
                                            play_icon,
                                            stop_icon,
                                        ],
                                    ),
                                    estado_audio,
                                ],
                            ),
                        ),
                        favorito,
                        ft.Container(
                            width=330,
                            padding=16,
                            bgcolor="#FFFDF8",
                            border_radius=16,
                            border=ft.border.all(width=1, color="#D8C7A0"),
                            content=ft.Column(
                                spacing=10,
                                controls=[
                                    ft.Text(
                                        f"Guia: {meditacion.get('guia') or 'Sin cargar'}",
                                        size=15,
                                        weight=ft.FontWeight.BOLD,
                                        color="#4E4A2A",
                                    ),
                                    ft.Text(
                                        meditacion.get("descripcion") or "Sin descripcion.",
                                        size=13,
                                        color="#4E4A2A",
                                    ),
                                ],
                            ),
                        ),
                    ],
                )
            )
        )
        page.update()

    def tarjeta_meditacion(meditacion_id, meditacion):
        imagen = convertir_link_google_drive(meditacion.get("imagen", ""), "imagen")
        es_favorita = bool(favoritos.get(meditacion_id))

        return ft.Container(
            bgcolor="#FFFDF8",
            border_radius=16,
            border=ft.border.all(width=1, color="#D8C7A0"),
            padding=10,
            ink=True,
            on_click=lambda e: abrir_reproductor(meditacion_id, meditacion),
            content=ft.Row(
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
                controls=[
                    ft.Container(
                        width=78,
                        height=78,
                        border_radius=12,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        bgcolor="#F7F1E5",
                        content=ft.Image(src=imagen or "icono_meditacion.webp", fit=ft.ImageFit.COVER),
                    ),
                    ft.Container(
                        expand=True,
                        padding=ft.padding.only(left=10),
                        content=ft.Column(
                            spacing=4,
                            controls=[
                                ft.Text(
                                    meditacion.get("titulo", "Sin titulo"),
                                    size=15,
                                    weight=ft.FontWeight.BOLD,
                                    color="#4E4A2A",
                                    max_lines=2,
                                ),
                                ft.Text(
                                    meditacion.get("guia") or "Guia sin cargar",
                                    size=12,
                                    color="#5E5A2E",
                                    max_lines=1,
                                ),
                            ],
                        ),
                    ),
                    ft.Icon(
                        name=ft.Icons.FAVORITE if es_favorita else ft.Icons.FAVORITE_BORDER,
                        color="#A33A2A" if es_favorita else "#5E5A2E",
                    ),
                ],
            ),
        )

    def cargar_meditaciones(texto_busqueda=""):
        meditaciones_lista.controls.clear()
        cargar_favoritos()

        try:
            respuesta = requests.get(f"{DATABASE_URL}/meditaciones.json")
            datos = respuesta.json() or {}

            for meditacion_id, meditacion in sorted(
                datos.items(),
                key=lambda item: (item[1].get("titulo") or "").lower(),
            ):
                titulo = meditacion.get("titulo", "")
                guia = meditacion.get("guia", "")
                if texto_busqueda.lower() in f"{titulo} {guia}".lower():
                    meditaciones_lista.controls.append(tarjeta_meditacion(meditacion_id, meditacion))

            if not meditaciones_lista.controls:
                meditaciones_lista.controls.append(
                    ft.Text(
                        "No hay meditaciones para mostrar.",
                        color="#4E4A2A",
                        text_align=ft.TextAlign.CENTER,
                    )
                )
        except requests.RequestException:
            meditaciones_lista.controls.append(ft.Text("Error cargando meditaciones", color="red"))

        page.update()

    page.add(
        fondo_secundario(
            ft.Column(
                expand=True,
                controls=[
                    encabezado("Meditaciones", volver_inicio),
                    ft.Container(
                        padding=ft.padding.only(left=20, right=20, bottom=8),
                        alignment=ft.alignment.center,
                        content=buscador,
                    ),
                    meditaciones_lista,
                ],
            )
        )
    )
    cargar_meditaciones()


def encabezado(titulo, volver):
    return ft.Container(
        padding=20,
        content=ft.Row(
            alignment=ft.MainAxisAlignment.START,
            controls=[
                ft.IconButton(
                    icon=ft.Icons.ARROW_BACK,
                    icon_color="#4E4A2A",
                    on_click=lambda e: volver(),
                ),
                ft.Text(
                    titulo,
                    size=26,
                    weight=ft.FontWeight.BOLD,
                    color="#4E4A2A",
                ),
            ],
        ),
    )


def campo_texto(
    label,
    value="",
    multiline=False,
    min_lines=1,
    max_lines=1,
    on_change=None,
):
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
        on_change=on_change,
    )

