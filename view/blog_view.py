import json
from datetime import datetime

import flet as ft
import requests
from view.link_utils import convertir_link_google_drive
from view.ui_helpers import fondo_secundario


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    return datos["project_info"]["firebase_url"]


DATABASE_URL = cargar_firebase_config()


def mostrar_carga_blog(page: ft.Page, volver_administracion):
    page.clean()

    estado = {"posts": {}, "post_editando_id": None}
    contenido = ft.Column(expand=True, scroll=ft.ScrollMode.AUTO, spacing=14)

    def mostrar_mensaje(texto, color="#5E5A2E"):
        page.snack_bar = ft.SnackBar(content=ft.Text(texto), bgcolor=color)
        page.snack_bar.open = True
        page.update()

    def cargar_posts():
        try:
            respuesta = requests.get(f"{DATABASE_URL}/blog.json")
            estado["posts"] = respuesta.json() or {} if respuesta.status_code == 200 else {}
        except requests.RequestException:
            estado["posts"] = {}
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def ordenar_posts(posts):
        return sorted(
            posts.items(),
            key=lambda item: item[1].get("fecha_carga", ""),
            reverse=True,
        )

    def mostrar_lista():
        estado["post_editando_id"] = None
        cargar_posts()
        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Blog", volver_administracion),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20),
                    content=ft.Row(
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        controls=[
                            ft.Text(
                                "Posts cargados",
                                size=20,
                                weight=ft.FontWeight.BOLD,
                                color="#4E4A2A",
                            ),
                            ft.IconButton(
                                icon=ft.Icons.ADD_CIRCLE,
                                icon_color="#5E5A2E",
                                icon_size=34,
                                tooltip="Nuevo post",
                                on_click=lambda e: mostrar_formulario(),
                            ),
                        ],
                    ),
                ),
            ]
        )

        if not estado["posts"]:
            contenido.controls.append(
                ft.Container(
                    padding=20,
                    alignment=ft.alignment.center,
                    content=ft.Text(
                        "Todavia no hay posts cargados.",
                        color="#4E4A2A",
                        text_align=ft.TextAlign.CENTER,
                    ),
                )
            )
            page.update()
            return

        for post_id, post in ordenar_posts(estado["posts"]):
            contenido.controls.append(tarjeta_admin(post_id, post))

        page.update()

    def tarjeta_admin(post_id, post):
        fecha = formatear_fecha(post.get("fecha_carga", ""))
        return ft.Container(
            margin=ft.margin.symmetric(horizontal=20),
            padding=14,
            bgcolor="#FFFDF8",
            border_radius=16,
            border=ft.border.all(width=1, color="#D8C7A0"),
            content=ft.Column(
                spacing=8,
                controls=[
                    ft.Row(
                        vertical_alignment=ft.CrossAxisAlignment.START,
                        controls=[
                            ft.Container(
                                expand=True,
                                content=ft.Column(
                                    spacing=4,
                                    controls=[
                                        ft.Text(
                                            post.get("titulo", "Sin titulo"),
                                            size=15,
                                            weight=ft.FontWeight.BOLD,
                                            color="#4E4A2A",
                                            max_lines=2,
                                        ),
                                        ft.Text(
                                            f"{post.get('etiqueta') or 'Sin etiqueta'} - {fecha}",
                                            size=11,
                                            color="#5E5A2E",
                                        ),
                                    ],
                                ),
                            ),
                            ft.IconButton(
                                icon=ft.Icons.EDIT,
                                icon_color="#5E5A2E",
                                tooltip="Editar",
                                on_click=lambda e: mostrar_formulario(post_id, post),
                            ),
                            ft.IconButton(
                                icon=ft.Icons.DELETE,
                                icon_color="#A33A2A",
                                tooltip="Borrar",
                                on_click=lambda e: confirmar_borrado(post_id, post.get("titulo", "post")),
                            ),
                        ],
                    ),
                    ft.Text(
                        resumen(post.get("descripcion", ""), 150),
                        size=12,
                        color="#4E4A2A",
                    ),
                ],
            ),
        )

    def confirmar_borrado(post_id, titulo):
        dialogo = ft.AlertDialog(
            modal=True,
            title=ft.Text("Borrar post"),
            content=ft.Text(f"Seguro que quieres borrar '{titulo}'?"),
            actions=[
                ft.TextButton("Cancelar", on_click=lambda e: cerrar_dialogo(dialogo)),
                ft.TextButton("Borrar", on_click=lambda e: borrar_post(post_id, dialogo)),
            ],
        )
        page.dialog = dialogo
        dialogo.open = True
        page.update()

    def cerrar_dialogo(dialogo):
        dialogo.open = False
        page.update()

    def borrar_post(post_id, dialogo):
        try:
            respuesta = requests.delete(f"{DATABASE_URL}/blog/{post_id}.json")
            cerrar_dialogo(dialogo)
            if respuesta.status_code == 200:
                mostrar_mensaje("Post borrado correctamente.")
                mostrar_lista()
            else:
                mostrar_mensaje("No se pudo borrar el post.", "red")
        except requests.RequestException:
            cerrar_dialogo(dialogo)
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def mostrar_formulario(post_id=None, post=None):
        estado["post_editando_id"] = post_id
        post = post or {}

        titulo = campo_texto("Titulo", post.get("titulo", ""))
        descripcion = campo_texto(
            "Descripcion",
            post.get("descripcion", ""),
            multiline=True,
            min_lines=8,
            max_lines=12,
        )
        etiqueta = campo_texto("Etiqueta", post.get("etiqueta", ""))
        link_imagen = campo_texto(
            "Link imagen",
            post.get("link_imagen_original") or post.get("imagen", ""),
        )

        vista_previa_imagen = ft.Image(
            src=convertir_link_google_drive(link_imagen.value, "imagen") or "icono_blog.webp",
            width=320,
            height=180,
            fit=ft.ImageFit.CONTAIN,
        )

        def actualizar_vista_previa(e=None):
            vista_previa_imagen.src = (
                convertir_link_google_drive(link_imagen.value, "imagen") or "icono_blog.webp"
            )
            page.update()

        link_imagen.on_change = actualizar_vista_previa

        def guardar_post(e):
            if not titulo.value.strip():
                mostrar_mensaje("Completa el titulo del post.", "red")
                return

            if not descripcion.value.strip():
                mostrar_mensaje("Completa la descripcion del post.", "red")
                return

            imagen_original = link_imagen.value.strip()
            datos_post = {
                "titulo": titulo.value.strip(),
                "descripcion": descripcion.value.strip(),
                "etiqueta": etiqueta.value.strip(),
                "imagen": convertir_link_google_drive(imagen_original, "imagen"),
                "link_imagen_original": imagen_original,
            }

            if estado["post_editando_id"]:
                datos_post["fecha_carga"] = post.get("fecha_carga") or datetime.now().isoformat()
                url = f"{DATABASE_URL}/blog/{estado['post_editando_id']}.json"
                metodo = requests.patch
                mensaje_ok = "Post actualizado correctamente."
            else:
                datos_post["fecha_carga"] = datetime.now().isoformat()
                url = f"{DATABASE_URL}/blog.json"
                metodo = requests.post
                mensaje_ok = "Post cargado correctamente."

            try:
                respuesta = metodo(url, json=datos_post)
                if respuesta.status_code == 200:
                    mostrar_mensaje(mensaje_ok)
                    mostrar_lista()
                else:
                    mostrar_mensaje("No se pudo guardar el post.", "red")
            except requests.RequestException:
                mostrar_mensaje("Error conectando con la base de datos.", "red")

        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado("Editar post" if post_id else "Nuevo post", mostrar_lista),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20, bottom=20),
                    content=ft.Column(
                        spacing=14,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        controls=[
                            ft.Container(
                                width=320,
                                height=180,
                                border_radius=15,
                                clip_behavior=ft.ClipBehavior.HARD_EDGE,
                                bgcolor="#FFFDF8",
                                content=vista_previa_imagen,
                            ),
                            titulo,
                            descripcion,
                            etiqueta,
                            link_imagen,
                            ft.ElevatedButton(
                                text="Guardar cambios" if post_id else "Guardar post",
                                bgcolor="#5E5A2E",
                                color="#FFFFFF",
                                width=320,
                                height=46,
                                on_click=guardar_post,
                            ),
                        ],
                    ),
                ),
            ]
        )
        page.update()

    page.add(fondo_secundario(contenido))
    mostrar_lista()


def mostrar_blog(page: ft.Page, volver_inicio, post_id_inicial=None):
    page.clean()

    usuario_uid = page.client_storage.get("uid") or page.client_storage.get("usuario_email") or "invitado"
    posts_lista = ft.ListView(expand=True, spacing=14, padding=20)

    def mostrar_mensaje(texto, color="#5E5A2E"):
        page.snack_bar = ft.SnackBar(content=ft.Text(texto), bgcolor=color)
        page.snack_bar.open = True
        page.update()

    def cargar_likes(post_id):
        try:
            respuesta = requests.get(f"{DATABASE_URL}/blog_likes/{post_id}.json")
            datos = respuesta.json() or {}
            return datos
        except requests.RequestException:
            return {}

    def usuario_dio_like(post_id):
        return bool(cargar_likes(post_id).get(usuario_uid))

    def guardar_like(post_id, dio_like):
        try:
            if dio_like:
                requests.put(f"{DATABASE_URL}/blog_likes/{post_id}/{usuario_uid}.json", json=True)
            else:
                requests.delete(f"{DATABASE_URL}/blog_likes/{post_id}/{usuario_uid}.json")
        except requests.RequestException:
            mostrar_mensaje("No se pudo guardar el me gusta.", "red")

    def cargar_comentarios(post_id):
        try:
            respuesta = requests.get(f"{DATABASE_URL}/blog_comentarios/{post_id}.json")
            return respuesta.json() or {}
        except requests.RequestException:
            return {}

    def guardar_comentario(post_id, texto):
        if not texto.strip():
            mostrar_mensaje("Escribe un comentario antes de enviarlo.", "red")
            return False

        datos = {
            "texto": texto.strip(),
            "usuario": page.client_storage.get("usuario_email") or "Usuario",
            "uid": usuario_uid,
            "fecha": datetime.now().isoformat(),
        }

        try:
            respuesta = requests.post(f"{DATABASE_URL}/blog_comentarios/{post_id}.json", json=datos)
            if respuesta.status_code == 200:
                return True
            mostrar_mensaje("No se pudo guardar el comentario.", "red")
        except requests.RequestException:
            mostrar_mensaje("Error conectando con la base de datos.", "red")

        return False

    def mostrar_lista():
        page.clean()
        posts_lista.controls.clear()

        try:
            respuesta = requests.get(f"{DATABASE_URL}/blog.json")
            posts = respuesta.json() or {}
            for post_id, post in sorted(
                posts.items(),
                key=lambda item: item[1].get("fecha_carga", ""),
                reverse=True,
            ):
                posts_lista.controls.append(tarjeta_post(post_id, post))

            if not posts_lista.controls:
                posts_lista.controls.append(
                    ft.Text(
                        "Todavia no hay posts para leer.",
                        color="#4E4A2A",
                        text_align=ft.TextAlign.CENTER,
                    )
                )
        except requests.RequestException:
            posts_lista.controls.append(ft.Text("Error cargando el blog", color="red"))

        page.add(
            fondo_secundario(
                ft.Column(
                    expand=True,
                    controls=[
                        encabezado("Blog", volver_inicio),
                        posts_lista,
                    ],
                )
            )
        )
        page.update()

    def tarjeta_post(post_id, post):
        likes = cargar_likes(post_id)
        imagen = convertir_link_google_drive(post.get("imagen", ""), "imagen")
        return ft.Container(
            bgcolor="#FFFDF8",
            border_radius=16,
            border=ft.border.all(width=1, color="#D8C7A0"),
            padding=16,
            ink=True,
            on_click=lambda e: mostrar_detalle(post_id, post),
            content=ft.Column(
                spacing=8,
                controls=[
                    ft.Container(
                        height=180,
                        border_radius=14,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        bgcolor="#F7F1E5",
                        content=ft.Image(
                            src=imagen,
                            fit=ft.ImageFit.CONTAIN,
                            visible=bool(imagen),
                        ),
                        visible=bool(imagen),
                    ),
                    ft.Text(
                        post.get("titulo", "Sin titulo"),
                        size=20,
                        weight=ft.FontWeight.BOLD,
                        color="#4E4A2A",
                    ),
                    ft.Text(
                        f"{post.get('etiqueta') or 'Sin etiqueta'} - {formatear_fecha(post.get('fecha_carga', ''))}",
                        size=12,
                        color="#5E5A2E",
                    ),
                    ft.Text(
                        resumen(post.get("descripcion", ""), 210),
                        size=13,
                        color="#4E4A2A",
                    ),
                    ft.Row(
                        controls=[
                            ft.Icon(ft.Icons.FAVORITE, color="#A33A2A", size=18),
                            ft.Text(str(len(likes)), size=12, color="#5E5A2E"),
                            ft.Icon(ft.Icons.COMMENT, color="#5E5A2E", size=18),
                            ft.Text(str(len(cargar_comentarios(post_id))), size=12, color="#5E5A2E"),
                        ],
                    ),
                ],
            ),
        )

    def mostrar_detalle(post_id, post):
        page.clean()

        imagen = convertir_link_google_drive(post.get("imagen", ""), "imagen")
        comentario = campo_texto("Deja tu comentario", multiline=True, min_lines=2, max_lines=4)
        comentarios_lista = ft.Column(spacing=10)
        like_check = ft.Checkbox(
            label="Me gusta",
            value=usuario_dio_like(post_id),
            active_color="#5E5A2E",
            label_style=ft.TextStyle(color="#4E4A2A"),
        )

        def recargar_comentarios():
            comentarios_lista.controls.clear()
            comentarios = cargar_comentarios(post_id)
            if not comentarios:
                comentarios_lista.controls.append(ft.Text("Sin comentarios todavia.", color="#5E5A2E"))
                return

            for item_id, item in sorted(
                comentarios.items(),
                key=lambda valor: valor[1].get("fecha", ""),
                reverse=True,
            ):
                comentarios_lista.controls.append(
                    ft.Container(
                        padding=10,
                        bgcolor="#FFFDF8",
                        border_radius=12,
                        border=ft.border.all(width=1, color="#D8C7A0"),
                        content=ft.Column(
                            spacing=4,
                            controls=[
                                ft.Text(
                                    item.get("usuario", "Usuario"),
                                    size=12,
                                    weight=ft.FontWeight.BOLD,
                                    color="#4E4A2A",
                                ),
                                ft.Text(item.get("texto", ""), size=12, color="#4E4A2A"),
                            ],
                        ),
                    )
                )

        def enviar_comentario(e):
            if guardar_comentario(post_id, comentario.value):
                comentario.value = ""
                recargar_comentarios()
                page.update()

        def cambiar_like(e):
            guardar_like(post_id, e.control.value)

        like_check.on_change = cambiar_like
        recargar_comentarios()

        page.add(
            fondo_secundario(
                ft.Column(
                    expand=True,
                    scroll=ft.ScrollMode.AUTO,
                    controls=[
                        encabezado("Blog", mostrar_lista),
                        ft.Container(
                            padding=ft.padding.only(left=20, right=20, bottom=20),
                            content=ft.Column(
                                spacing=14,
                                controls=[
                                    ft.Container(
                                        width=330,
                                        height=180,
                                        border_radius=16,
                                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                                        bgcolor="#FFFDF8",
                                        content=ft.Image(
                                            src=imagen,
                                            fit=ft.ImageFit.CONTAIN,
                                            visible=bool(imagen),
                                        ),
                                        visible=bool(imagen),
                                    ),
                                    ft.Text(
                                        post.get("titulo", "Sin titulo"),
                                        size=25,
                                        weight=ft.FontWeight.BOLD,
                                        color="#4E4A2A",
                                    ),
                                    ft.Text(
                                        f"{post.get('etiqueta') or 'Sin etiqueta'} - {formatear_fecha(post.get('fecha_carga', ''))}",
                                        size=12,
                                        color="#5E5A2E",
                                    ),
                                    ft.Text(post.get("descripcion", ""), size=14, color="#4E4A2A"),
                                    like_check,
                                    comentario,
                                    ft.ElevatedButton(
                                        text="Enviar comentario",
                                        bgcolor="#5E5A2E",
                                        color="#FFFFFF",
                                        width=320,
                                        height=44,
                                        on_click=enviar_comentario,
                                    ),
                                    ft.Text(
                                        "Comentarios",
                                        size=18,
                                        weight=ft.FontWeight.BOLD,
                                        color="#4E4A2A",
                                    ),
                                    comentarios_lista,
                                ],
                            ),
                        ),
                    ],
                )
            )
        )
        page.update()

    if post_id_inicial:
        try:
            respuesta = requests.get(f"{DATABASE_URL}/blog/{post_id_inicial}.json")
            post = respuesta.json() or {}
            if post:
                mostrar_detalle(post_id_inicial, post)
            else:
                mostrar_lista()
        except requests.RequestException:
            mostrar_lista()
    else:
        mostrar_lista()


def resumen(texto, limite):
    texto_limpio = " ".join((texto or "").split())
    if len(texto_limpio) <= limite:
        return texto_limpio
    return f"{texto_limpio[:limite].rstrip()}..."


def formatear_fecha(fecha_iso):
    if not fecha_iso:
        return "Sin fecha"

    try:
        return datetime.fromisoformat(fecha_iso).strftime("%d/%m/%Y")
    except ValueError:
        return fecha_iso


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

