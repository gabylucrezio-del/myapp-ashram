import json

from datetime import datetime

import flet as ft
import requests

from storage_service import StorageError, eliminar_archivo, subir_imagen, subir_pdf
from view.link_utils import convertir_link_google_drive
from view.ui_helpers import fondo_secundario


def cargar_firebase_config():
    with open("google-services.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    return datos["project_info"]["firebase_url"]


DATABASE_URL = cargar_firebase_config()


def mostrar_carga_biblioteca(page: ft.Page, volver_administracion):
    page.clean()

    estado = {
        "libros": {},
        "libro_editando_id": None,
        "libro_borrando": None,
    }

    contenido = ft.Column(
        expand=True,
        scroll=ft.ScrollMode.AUTO,
        spacing=14,
    )

    def mostrar_mensaje(texto, color="#5E5A2E"):
        page.snack_bar = ft.SnackBar(
            content=ft.Text(texto),
            bgcolor=color,
        )
        page.snack_bar.open = True
        page.update()

    def cargar_libros():
        try:
            respuesta = requests.get(f"{DATABASE_URL}/biblioteca.json")
            if respuesta.status_code == 200:
                estado["libros"] = respuesta.json() or {}
            else:
                estado["libros"] = {}
                mostrar_mensaje("No se pudo cargar la lista de libros.", "red")
        except requests.RequestException:
            estado["libros"] = {}
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def abrir_pdf(link_pdf):
        pdf = convertir_link_google_drive(link_pdf, "pdf")
        if pdf:
            page.launch_url(pdf)

    def abrir_dialogo(dialogo):
        if hasattr(page, "open"):
            page.open(dialogo)
        else:
            page.dialog = dialogo
            dialogo.open = True
            page.update()

    def cerrar_dialogo(dialogo):
        estado["libro_borrando"] = None
        if hasattr(page, "close"):
            page.close(dialogo)
        else:
            dialogo.open = False
            page.update()

    def mostrar_lista():
        estado["libro_editando_id"] = None
        cargar_libros()
        contenido.controls.clear()

        contenido.controls.extend(
            [
                encabezado("Biblioteca", volver_administracion),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20),
                    content=ft.Row(
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        controls=[
                            ft.Text(
                                "Libros cargados",
                                size=20,
                                weight=ft.FontWeight.BOLD,
                                color="#4E4A2A",
                            ),
                            ft.IconButton(
                                icon=ft.Icons.ADD_CIRCLE,
                                icon_color="#5E5A2E",
                                icon_size=34,
                                tooltip="Nuevo libro",
                                on_click=lambda e: mostrar_formulario(),
                            ),
                        ],
                    ),
                ),
            ]
        )

        libros = estado["libros"]
        if not libros:
            contenido.controls.append(
                ft.Container(
                    padding=20,
                    alignment=ft.alignment.center,
                    content=ft.Text(
                        "Todavia no hay libros cargados.",
                        color="#4E4A2A",
                        size=14,
                        text_align=ft.TextAlign.CENTER,
                    ),
                )
            )
            page.update()
            return

        categorias = {}
        for libro_id, libro in libros.items():
            categoria = (libro.get("categoria") or "Sin categoria").strip()
            categorias.setdefault(categoria, []).append((libro_id, libro))

        for categoria in sorted(categorias):
            contenido.controls.append(
                ft.Container(
                    padding=ft.padding.only(left=20, right=20, top=6),
                    content=ft.Text(
                        categoria,
                        size=16,
                        weight=ft.FontWeight.BOLD,
                        color="#5E5A2E",
                    ),
                )
            )

            for libro_id, libro in sorted(
                categorias[categoria],
                key=lambda item: (item[1].get("titulo") or "").lower(),
            ):
                contenido.controls.append(tarjeta_libro(libro_id, libro))

        page.update()

    def tarjeta_libro(libro_id, libro):
        imagen = libro.get("portada_url") or convertir_link_google_drive(libro.get("imagen", ""), "imagen")
        titulo = libro.get("titulo", "Sin titulo")
        autor = libro.get("autor", "")

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
                        width=58,
                        height=84,
                        border_radius=10,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        bgcolor="#F7F1E5",
                        content=ft.Image(src=imagen or "icono_biblioteca.webp", fit=ft.ImageFit.COVER),
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
                                    autor or "Autor sin cargar",
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
                        on_click=lambda e, libro_actual=libro: ver_libro(libro_actual),
                    ),
                    ft.IconButton(
                        icon=ft.Icons.EDIT,
                        icon_color="#5E5A2E",
                        tooltip="Editar",
                        on_click=lambda e, libro_actual_id=libro_id, libro_actual=libro: mostrar_formulario(
                            libro_actual_id,
                            libro_actual,
                        ),
                    ),
                    ft.IconButton(
                        icon=ft.Icons.DELETE,
                        icon_color="#A33A2A",
                        tooltip="Borrar",
                        on_click=lambda e, libro_actual_id=libro_id, titulo_actual=titulo: confirmar_borrado(
                            libro_actual_id,
                            titulo_actual,
                        ),
                    ),
                ],
            ),
        )

    def ver_libro(libro):
        imagen = libro.get("portada_url") or convertir_link_google_drive(libro.get("imagen", ""), "imagen")
        descripcion = libro.get("descripcion") or "Sin descripcion."

        dialogo = ft.AlertDialog(
            modal=True,
            title=ft.Text(libro.get("titulo", "Libro"), color="#4E4A2A"),
            content=ft.Column(
                width=300,
                height=360,
                scroll=ft.ScrollMode.AUTO,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                controls=[
                    ft.Container(
                        width=130,
                        height=190,
                        border_radius=15,
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,
                        bgcolor="#FFFDF8",
                        content=ft.Image(src=imagen or "icono_biblioteca.webp", fit=ft.ImageFit.COVER),
                    ),
                    ft.Text(f"Autor: {libro.get('autor') or 'Sin cargar'}", color="#4E4A2A"),
                    ft.Text(f"Categoria: {libro.get('categoria') or 'Sin categoria'}", color="#4E4A2A"),
                    ft.Text(descripcion, color="#4E4A2A", text_align=ft.TextAlign.CENTER),
                ],
            ),
            actions=[
                ft.TextButton(
                    "Abrir PDF",
                    on_click=lambda e: abrir_pdf(libro.get("pdf_url") or libro.get("pdf", "")),
                ),
                ft.TextButton(
                    "Cerrar",
                    on_click=lambda e: cerrar_dialogo(dialogo),
                ),
            ],
        )

        abrir_dialogo(dialogo)

    def confirmar_borrado(libro_id, titulo):
        estado["libro_borrando"] = {
            "id": libro_id,
            "titulo": titulo,
        }
        dialogo = ft.AlertDialog(
            modal=True,
            title=ft.Text("Borrar libro"),
            content=ft.Text(f"Seguro que quieres borrar '{titulo}'?"),
            actions=[
                ft.TextButton("Cancelar", on_click=lambda e: cerrar_dialogo(dialogo)),
                ft.TextButton(
                    "Borrar",
                    on_click=lambda e: borrar_libro(dialogo),
                ),
            ],
        )

        abrir_dialogo(dialogo)

    def borrar_libro(dialogo):
        libro_borrando = estado.get("libro_borrando") or {}
        libro_id = libro_borrando.get("id")
        titulo = libro_borrando.get("titulo") or "Libro"
        if not libro_id:
            cerrar_dialogo(dialogo)
            mostrar_mensaje("No se pudo identificar el libro seleccionado.", "red")
            return

        try:
            respuesta = requests.delete(
                f"{DATABASE_URL}/biblioteca/{libro_id}.json",
                timeout=10,
            )
            if not respuesta.ok:
                respuesta = requests.patch(
                    f"{DATABASE_URL}/biblioteca.json",
                    json={libro_id: None},
                    timeout=10,
                )
            cerrar_dialogo(dialogo)
            if respuesta.ok:
                libro_eliminado = estado["libros"].pop(libro_id, None) or {}
                id_token = page.client_storage.get("id_token")
                for ruta_storage in (
                    libro_eliminado.get("portada_path"),
                    libro_eliminado.get("pdf_path"),
                ):
                    try:
                        eliminar_archivo(ruta_storage, id_token=id_token)
                    except StorageError:
                        pass
                mostrar_mensaje(f"'{titulo}' borrado correctamente.")
                mostrar_lista()
            else:
                detalle = respuesta.text[:120] if respuesta.text else f"HTTP {respuesta.status_code}"
                mostrar_mensaje(f"No se pudo borrar el libro: {detalle}", "red")
        except requests.RequestException:
            cerrar_dialogo(dialogo)
            mostrar_mensaje("Error conectando con la base de datos.", "red")

    def mostrar_formulario(libro_id=None, libro=None):
        estado["libro_editando_id"] = libro_id
        libro = libro or {}
        archivos = {"portada": None, "pdf": None}

        titulo = campo_texto("Titulo", libro.get("titulo", ""))
        descripcion = campo_texto(
            "Descripcion",
            libro.get("descripcion", ""),
            multiline=True,
            min_lines=3,
            max_lines=4,
        )
        categoria = campo_texto("Categoria", libro.get("categoria", ""))
        autor = campo_texto("Autor", libro.get("autor", ""))

        portada_actual = libro.get("portada_url") or convertir_link_google_drive(libro.get("imagen", ""), "imagen")
        pdf_actual = libro.get("pdf_url") or convertir_link_google_drive(libro.get("pdf", ""), "pdf")

        texto_portada = ft.Text(
            "Portada actual cargada" if portada_actual else "Selecciona una portada",
            size=12,
            color="#5E5A2E",
            text_align=ft.TextAlign.CENTER,
        )
        texto_pdf = ft.Text(
            "PDF actual cargado" if pdf_actual else "Selecciona un PDF",
            size=12,
            color="#5E5A2E",
            text_align=ft.TextAlign.CENTER,
        )
        estado_carga = ft.Text("", size=12, color="#5E5A2E", text_align=ft.TextAlign.CENTER)

        vista_previa_imagen = ft.Image(
            src=portada_actual or "icono_biblioteca.webp",
            width=130,
            height=190,
            fit=ft.ImageFit.COVER,
        )

        picker_portada = ft.FilePicker()
        picker_pdf = ft.FilePicker()
        page.overlay.extend([picker_portada, picker_pdf])

        def seleccionar_portada(e):
            picker_portada.pick_files(
                allow_multiple=False,
                allowed_extensions=["jpg", "jpeg", "png", "webp"],
            )

        def seleccionar_pdf(e):
            picker_pdf.pick_files(
                allow_multiple=False,
                allowed_extensions=["pdf"],
            )

        def portada_seleccionada(e):
            if not e.files:
                return
            archivo = e.files[0]
            archivos["portada"] = archivo.path
            texto_portada.value = f"{archivo.name} - se optimizara a WebP"
            if archivo.path:
                vista_previa_imagen.src = archivo.path
            page.update()

        def pdf_seleccionado(e):
            if not e.files:
                return
            archivo = e.files[0]
            archivos["pdf"] = archivo.path
            texto_pdf.value = archivo.name
            page.update()

        picker_portada.on_result = portada_seleccionada
        picker_pdf.on_result = pdf_seleccionado

        def guardar_libro(e):
            if not titulo.value.strip():
                mostrar_mensaje("Completa el titulo del libro.", "red")
                return

            if not archivos["portada"] and not portada_actual:
                mostrar_mensaje("Selecciona la imagen de portada.", "red")
                return

            if not archivos["pdf"] and not pdf_actual:
                mostrar_mensaje("Selecciona el archivo PDF.", "red")
                return

            boton_guardar.disabled = True
            estado_carga.value = "Optimizando portada a WebP y subiendo archivos..."
            page.update()

            datos_libro = {
                "titulo": titulo.value.strip(),
                "descripcion": descripcion.value.strip(),
                "categoria": categoria.value.strip(),
                "autor": autor.value.strip(),
                "fecha_creacion": libro.get("fecha_creacion") or datetime.now().isoformat(),
            }

            try:
                id_token = page.client_storage.get("id_token")

                if archivos["portada"]:
                    portada = subir_imagen(archivos["portada"], id_token=id_token)
                    datos_libro["portada_url"] = portada["url"]
                    datos_libro["portada_path"] = portada["path"]
                    datos_libro["imagen"] = portada["url"]
                    if libro.get("portada_path"):
                        try:
                            eliminar_archivo(libro.get("portada_path"), id_token=id_token)
                        except StorageError:
                            pass
                else:
                    datos_libro["portada_url"] = portada_actual
                    datos_libro["portada_path"] = libro.get("portada_path", "")
                    datos_libro["imagen"] = portada_actual

                if archivos["pdf"]:
                    pdf = subir_pdf(archivos["pdf"], id_token=id_token)
                    datos_libro["pdf_url"] = pdf["url"]
                    datos_libro["pdf_path"] = pdf["path"]
                    datos_libro["pdf"] = pdf["url"]
                    if libro.get("pdf_path"):
                        try:
                            eliminar_archivo(libro.get("pdf_path"), id_token=id_token)
                        except StorageError:
                            pass
                else:
                    datos_libro["pdf_url"] = pdf_actual
                    datos_libro["pdf_path"] = libro.get("pdf_path", "")
                    datos_libro["pdf"] = pdf_actual

                if estado["libro_editando_id"]:
                    respuesta = requests.patch(
                        f"{DATABASE_URL}/biblioteca/{estado['libro_editando_id']}.json",
                        json=datos_libro,
                    )
                    mensaje_ok = "Libro actualizado correctamente."
                else:
                    respuesta = requests.post(f"{DATABASE_URL}/biblioteca.json", json=datos_libro)
                    mensaje_ok = "Libro cargado correctamente."

                if respuesta.status_code == 200:
                    mostrar_mensaje(mensaje_ok)
                    mostrar_lista()
                else:
                    boton_guardar.disabled = False
                    estado_carga.value = ""
                    mostrar_mensaje("No se pudo guardar el libro. Intenta nuevamente.", "red")
                    page.update()
            except StorageError as error:
                boton_guardar.disabled = False
                estado_carga.value = ""
                mostrar_mensaje(str(error), "red")
            except requests.RequestException:
                boton_guardar.disabled = False
                estado_carga.value = ""
                mostrar_mensaje("Error conectando con la base de datos.", "red")

        boton_guardar = ft.ElevatedButton(
            text="Guardar cambios" if libro_id else "Guardar libro",
            bgcolor="#5E5A2E",
            color="#FFFFFF",
            width=320,
            height=46,
            on_click=guardar_libro,
        )

        contenido.controls.clear()
        contenido.controls.extend(
            [
                encabezado(
                    "Editar libro" if libro_id else "Nuevo libro",
                    mostrar_lista,
                ),
                ft.Container(
                    padding=ft.padding.only(left=20, right=20, bottom=20),
                    content=ft.Column(
                        spacing=14,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        controls=[
                            ft.Container(
                                width=130,
                                height=190,
                                border_radius=15,
                                clip_behavior=ft.ClipBehavior.HARD_EDGE,
                                bgcolor="#FFFDF8",
                                content=vista_previa_imagen,
                            ),
                            titulo,
                            descripcion,
                            categoria,
                            autor,
                            ft.OutlinedButton(
                                text="Seleccionar portada",
                                icon=ft.Icons.IMAGE,
                                width=320,
                                on_click=seleccionar_portada,
                            ),
                            texto_portada,
                            ft.OutlinedButton(
                                text="Seleccionar PDF",
                                icon=ft.Icons.PICTURE_AS_PDF,
                                width=320,
                                on_click=seleccionar_pdf,
                            ),
                            texto_pdf,
                            estado_carga,
                            boton_guardar,
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

