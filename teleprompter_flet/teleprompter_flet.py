import json
import threading
import time
import uuid
from pathlib import Path

import flet as ft


DATA_FILE = Path(__file__).with_name("teleprompter_data.json")


def default_data():
    ayurveda_id = new_id()
    satsang_id = new_id()
    return {
        "folders": [
            {"id": ayurveda_id, "name": "Ayurveda"},
            {"id": new_id(), "name": "Registros"},
            {"id": satsang_id, "name": "Satsang"},
        ],
        "scripts": [
            {
                "id": new_id(),
                "folder_id": ayurveda_id,
                "title": "Primer guion",
                "text": "Respira.\n\nAbre tu camara.\n\nCuando estes listo, presiona Play y lee con calma.",
            }
        ],
        "settings": {
            "speed": 150,
            "font_size": 44,
            "bg_opacity": 0.35,
            "window_width": 390,
            "window_height": 780,
            "countdown": 3,
        },
    }


def new_id():
    return uuid.uuid4().hex


def load_data():
    if not DATA_FILE.exists():
        return default_data()
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        if not data.get("folders") or not data.get("scripts"):
            return default_data()
        return data
    except Exception:
        return default_data()


def save_data(data):
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class TeleprompterApp:
    def __init__(self, page: ft.Page):
        self.page = page
        self.data = load_data()
        settings = self.data.setdefault("settings", {})
        self.selected_folder_id = ""
        self.selected_script_id = self.data["scripts"][0]["id"]
        self.playing = False
        self.prompter_mode = False
        self.offset = 0.0
        self.speed = int(settings.get("speed", 150))
        self.font_size = int(settings.get("font_size", 44))
        self.bg_opacity = float(settings.get("bg_opacity", 0.35))
        self.window_width = int(settings.get("window_width", 390))
        self.window_height = int(settings.get("window_height", 780))
        self.countdown = int(settings.get("countdown", 3))
        self.countdown_value = 0

        self.folder_filter = ft.Dropdown(
            label="Carpeta",
            options=[],
            value="",
            dense=True,
            text_size=11,
            content_padding=ft.padding.symmetric(horizontal=8, vertical=2),
        )
        self.script_picker = ft.Dropdown(
            label="Guion",
            options=[],
            dense=True,
            text_size=12,
            content_padding=ft.padding.symmetric(horizontal=8, vertical=2),
        )
        self.script_list = ft.ListView(expand=True, spacing=6, padding=0)
        self.title_input = ft.TextField(
            label="Titulo",
            dense=True,
            text_size=16,
            height=48,
            content_padding=ft.padding.symmetric(horizontal=10, vertical=8),
        )
        self.text_input = ft.TextField(
            label="Guion",
            multiline=True,
            min_lines=15,
            max_lines=28,
            expand=True,
            text_size=14,
            content_padding=ft.padding.symmetric(horizontal=10, vertical=8),
        )
        self.folder_select = ft.Dropdown(
            label="Guardar en",
            options=[],
            dense=True,
            text_size=11,
            content_padding=ft.padding.symmetric(horizontal=8, vertical=2),
        )
        self.prompter_text = ft.Text("", color=ft.Colors.WHITE, size=self.font_size, weight=ft.FontWeight.W_700, text_align=ft.TextAlign.CENTER)
        self.prompter_mover = ft.Container(top=180, left=20, right=20, content=self.prompter_text)
        self.background_layer = ft.Container(bgcolor=self.overlay_color(), expand=True)
        self.countdown_text = ft.Text("", size=96, color=ft.Colors.WHITE, weight=ft.FontWeight.BOLD, visible=False)
        self.prompter_title = ft.Text("", color=ft.Colors.WHITE, weight=ft.FontWeight.BOLD, overflow=ft.TextOverflow.ELLIPSIS)
        self.play_button = ft.IconButton(icon=ft.Icons.PLAY_ARROW, icon_color=ft.Colors.WHITE, tooltip="Play", on_click=self.toggle_play)
        self.controls_panel = ft.Column(spacing=8, visible=True)

    def setup(self):
        self.page.title = "Teleprompter Ashram"
        self.page.theme_mode = ft.ThemeMode.LIGHT
        self.page.padding = 0
        self.page.bgcolor = "#f5efe2"
        self.page.window.width = self.window_width
        self.page.window.height = self.window_height
        self.page.window.min_width = 320
        self.page.window.min_height = 560
        self.page.window.resizable = True
        self.page.window.center()
        self.refresh_options()
        self.render_main()
        threading.Thread(target=self.tick_loop, daemon=True).start()

    def refresh_options(self):
        folder_options = [ft.dropdown.Option("", "Todas")]
        save_options = [ft.dropdown.Option("", "Sin carpeta")]
        for folder in self.data["folders"]:
            folder_options.append(ft.dropdown.Option(folder["id"], folder["name"]))
            save_options.append(ft.dropdown.Option(folder["id"], folder["name"]))
        self.folder_filter.options = folder_options
        self.folder_filter.value = self.selected_folder_id
        self.folder_filter.on_change = lambda e: self.select_folder(self.folder_filter.value or "")
        self.folder_select.options = save_options

    def render_main(self):
        self.prompter_mode = False
        self.playing = False
        self.page.window.always_on_top = False
        self.page.window.opacity = 1
        self.page.clean()
        self.refresh_options()
        self.load_selected_script()
        self.render_script_list()

        top_panel = ft.Container(
            bgcolor="#fff8e7",
            padding=8,
            content=ft.Column(
                spacing=5,
                controls=[
                    ft.Row(
                        controls=[
                            ft.Column(
                                expand=True,
                                spacing=0,
                                controls=[
                                    ft.Text("Teleprompter", size=16, weight=ft.FontWeight.BOLD, color="#3f3a20"),
                                    ft.Text("Modo celular", size=10, color="#6c6840"),
                                ],
                            ),
                            ft.IconButton(ft.Icons.CREATE_NEW_FOLDER, icon_size=18, tooltip="Nueva carpeta", on_click=self.create_folder),
                            ft.IconButton(ft.Icons.NOTE_ADD, icon_size=18, tooltip="Nuevo guion", on_click=self.create_script),
                            ft.IconButton(ft.Icons.DELETE_OUTLINE, icon_size=18, tooltip="Borrar guion", on_click=self.delete_script),
                        ],
                    ),
                    ft.Row(
                        spacing=6,
                        controls=[
                            ft.Container(height=40, expand=1, content=self.folder_filter),
                            ft.Container(height=40, expand=1, content=self.script_picker),
                        ],
                    ),
                ],
            ),
        )

        editor = ft.Container(
            expand=True,
            padding=8,
            content=ft.Column(
                expand=True,
                spacing=5,
                controls=[
                    self.title_input,
                    ft.Container(height=42, content=self.folder_select),
                    ft.Container(height=4),
                    self.text_input,
                    ft.Container(
                        bgcolor="#fff8e7",
                        border=ft.border.only(top=ft.BorderSide(1, "#e4d4ad")),
                        padding=ft.padding.only(top=6),
                        content=ft.Row(
                            alignment=ft.MainAxisAlignment.END,
                            controls=[
                                ft.OutlinedButton("Nuevo", icon=ft.Icons.NOTE_ADD, on_click=self.create_script, height=34),
                                ft.OutlinedButton("Guardar", icon=ft.Icons.SAVE, on_click=self.save_current, height=34),
                                ft.FilledButton("Play", icon=ft.Icons.PLAY_ARROW, on_click=self.open_prompter, height=38),
                            ],
                        ),
                    ),
                ],
            ),
        )

        self.page.add(ft.Column([top_panel, editor], expand=True, spacing=0))

    def render_script_list(self):
        scripts = [
            script for script in self.data["scripts"]
            if not self.selected_folder_id or script.get("folder_id") == self.selected_folder_id
        ]
        if scripts and not any(script["id"] == self.selected_script_id for script in scripts):
            self.selected_script_id = scripts[0]["id"]
            self.load_selected_script()
        self.script_picker.options = [
            ft.dropdown.Option(script["id"], script.get("title") or "Sin titulo")
            for script in scripts
        ]
        self.script_picker.value = self.selected_script_id if scripts else None
        self.script_picker.on_change = lambda e: self.select_script(self.script_picker.value)

        self.script_list.controls.clear()
        for script in scripts:
            selected = script["id"] == self.selected_script_id
            self.script_list.controls.append(
                ft.Container(
                    bgcolor="#fffdf8" if selected else "#fff8e7",
                    border=ft.border.all(1, "#d9bd79" if selected else "#e4d4ad"),
                    border_radius=8,
                    padding=7,
                    on_click=lambda e, script_id=script["id"]: self.select_script(script_id),
                    content=ft.Column(
                        spacing=1,
                        controls=[
                            ft.Text(script.get("title") or "Sin titulo", size=12, weight=ft.FontWeight.BOLD, color="#3f3a20", overflow=ft.TextOverflow.ELLIPSIS),
                            ft.Text(self.folder_name(script.get("folder_id")), size=9, color="#6c6840"),
                        ],
                    ),
                )
            )

    def render_prompter(self):
        self.page.clean()
        script = self.selected_script()
        self.prompter_title.value = script.get("title") or "Sin titulo"
        self.prompter_text.value = script.get("text") or "Guion vacio"
        self.prompter_text.size = self.font_size
        self.offset = 0
        self.prompter_mover.top = 180
        self.page.window.always_on_top = True
        self.page.window.width = self.window_width
        self.page.window.height = self.window_height
        self.page.window.opacity = 0.96
        self.page.window.to_front()

        self.controls_panel.controls = [
            self.slider("Vel", 20, 420, self.speed, self.set_speed),
            self.slider("Texto", 24, 96, self.font_size, self.set_font_size),
            self.slider("Opac", 0, 92, int(self.bg_opacity * 100), self.set_opacity),
            self.slider("Ancho", 300, 900, self.window_width, self.set_window_width),
            self.slider("Alto", 420, 1000, self.window_height, self.set_window_height),
            ft.Dropdown(
                label="Cuenta",
                value=str(self.countdown),
                options=[ft.dropdown.Option("0", "0s"), ft.dropdown.Option("3", "3s"), ft.dropdown.Option("5", "5s"), ft.dropdown.Option("10", "10s")],
                on_change=lambda e: self.set_countdown(int(e.control.value)),
                dense=True,
                bgcolor="#fffdf8",
            ),
        ]

        self.background_layer = ft.Container(bgcolor=self.overlay_color(), expand=True)
        viewport = ft.Stack(
            expand=True,
            clip_behavior=ft.ClipBehavior.HARD_EDGE,
            controls=[
                self.background_layer,
                self.prompter_mover,
                ft.Container(alignment=ft.alignment.center, content=self.countdown_text),
                ft.Container(
                    left=8,
                    right=8,
                    bottom=8,
                    bgcolor="#111111aa",
                    border_radius=12,
                    padding=8,
                    content=self.controls_panel,
                ),
            ],
        )
        topbar = ft.Container(
            bgcolor="#1b1b1bcc",
            padding=6,
            content=ft.Row(
                controls=[
                    ft.WindowDragArea(content=ft.Container(width=24, height=32, content=ft.Icon(ft.Icons.DRAG_INDICATOR, color=ft.Colors.WHITE, size=18))),
                    self.prompter_title,
                    ft.IconButton(ft.Icons.TUNE, icon_color=ft.Colors.WHITE, tooltip="Controles", on_click=self.toggle_controls),
                    self.play_button,
                    ft.IconButton(ft.Icons.RESTART_ALT, icon_color=ft.Colors.WHITE, tooltip="Inicio", on_click=self.reset_prompter),
                    ft.IconButton(ft.Icons.CLOSE, icon_color=ft.Colors.WHITE, tooltip="Cerrar", on_click=lambda e: self.render_main()),
                ],
            ),
        )

        self.page.add(
            ft.Column(
                expand=True,
                spacing=0,
                controls=[
                    topbar,
                    viewport,
                ],
            )
        )

    def slider(self, label, minimum, maximum, value, on_change):
        value_text = ft.Text(str(int(value)), size=10, color=ft.Colors.WHITE)

        def changed(e):
            value_text.value = str(int(e.control.value))
            on_change(e.control.value)
            self.page.update()

        return ft.Row(
            controls=[
                ft.Text(label, width=45, size=10, color=ft.Colors.WHITE),
                ft.Slider(min=minimum, max=maximum, value=value, expand=True, on_change=changed),
                ft.Container(width=34, content=value_text),
            ]
        )

    def toggle_controls(self, e=None):
        self.controls_panel.visible = not self.controls_panel.visible
        self.page.update()

    def select_folder(self, folder_id):
        self.selected_folder_id = folder_id
        self.render_script_list()
        self.page.update()

    def select_script(self, script_id):
        self.save_form_to_selected()
        self.selected_script_id = script_id
        self.load_selected_script()
        self.render_script_list()
        self.page.update()

    def selected_script(self):
        for script in self.data["scripts"]:
            if script["id"] == self.selected_script_id:
                return script
        return self.data["scripts"][0]

    def load_selected_script(self):
        script = self.selected_script()
        self.title_input.value = script.get("title") or ""
        self.text_input.value = script.get("text") or ""
        self.folder_select.value = script.get("folder_id") or ""

    def save_form_to_selected(self):
        if not self.data["scripts"] or not self.title_input:
            return
        script = self.selected_script()
        script["title"] = (self.title_input.value or "").strip() or "Sin titulo"
        script["text"] = self.text_input.value or ""
        script["folder_id"] = self.folder_select.value or ""
        save_data(self.data)

    def save_current(self, e=None):
        self.save_form_to_selected()
        self.render_script_list()
        self.page.snack_bar = ft.SnackBar(ft.Text("Guion guardado"))
        self.page.snack_bar.open = True
        self.page.update()

    def delete_script(self, e=None):
        if len(self.data["scripts"]) <= 1:
            self.data["scripts"][0]["title"] = "Primer guion"
            self.data["scripts"][0]["text"] = ""
        else:
            self.data["scripts"] = [script for script in self.data["scripts"] if script["id"] != self.selected_script_id]
            self.selected_script_id = self.data["scripts"][0]["id"]
        save_data(self.data)
        self.render_main()

    def create_folder(self, e=None):
        name = f"Carpeta {len(self.data['folders']) + 1}"
        folder = {"id": new_id(), "name": name}
        self.data["folders"].append(folder)
        self.selected_folder_id = folder["id"]
        save_data(self.data)
        self.render_main()

    def create_script(self, e=None):
        self.save_form_to_selected()
        script = {"id": new_id(), "folder_id": self.selected_folder_id, "title": "Nuevo guion", "text": ""}
        self.data["scripts"].insert(0, script)
        self.selected_script_id = script["id"]
        save_data(self.data)
        self.render_main()

    def open_prompter(self, e=None):
        self.save_form_to_selected()
        self.prompter_mode = True
        self.render_prompter()

    def toggle_play(self, e=None):
        if self.playing:
            self.playing = False
            self.play_button.icon = ft.Icons.PLAY_ARROW
            self.page.update()
            return
        if self.countdown > 0:
            threading.Thread(target=self.countdown_then_play, daemon=True).start()
        else:
            self.start_play()

    def countdown_then_play(self):
        for value in range(self.countdown, 0, -1):
            self.countdown_value = value
            self.countdown_text.value = str(value)
            self.countdown_text.visible = True
            self.safe_update()
            time.sleep(1)
        self.countdown_text.visible = False
        self.start_play()

    def start_play(self):
        self.playing = True
        self.play_button.icon = ft.Icons.PAUSE
        self.safe_update()

    def reset_prompter(self, e=None):
        self.playing = False
        self.offset = 0
        self.prompter_mover.top = 180
        self.play_button.icon = ft.Icons.PLAY_ARROW
        self.countdown_text.visible = False
        self.page.update()

    def tick_loop(self):
        last = time.time()
        while True:
            now = time.time()
            delta = now - last
            last = now
            if self.prompter_mode and self.playing:
                self.offset += self.speed * delta
                self.prompter_mover.top = 180 - self.offset
                self.safe_update()
            time.sleep(1 / 30)

    def safe_update(self):
        try:
            self.page.update()
        except Exception:
            pass

    def set_speed(self, value):
        self.speed = int(value)
        self.save_settings()

    def set_font_size(self, value):
        self.font_size = int(value)
        self.prompter_text.size = self.font_size
        self.save_settings()

    def set_opacity(self, value):
        self.bg_opacity = max(0, min(0.92, value / 100))
        self.background_layer.bgcolor = self.overlay_color()
        self.save_settings()

    def set_window_width(self, value):
        self.window_width = int(value)
        self.page.window.width = self.window_width
        self.save_settings()

    def set_window_height(self, value):
        self.window_height = int(value)
        self.page.window.height = self.window_height
        self.save_settings()

    def set_countdown(self, value):
        self.countdown = int(value)
        self.save_settings()

    def save_settings(self):
        self.data["settings"] = {
            "speed": self.speed,
            "font_size": self.font_size,
            "bg_opacity": self.bg_opacity,
            "window_width": self.window_width,
            "window_height": self.window_height,
            "countdown": self.countdown,
        }
        save_data(self.data)

    def overlay_color(self):
        alpha = int(self.bg_opacity * 255)
        return f"#{alpha:02x}000000"

    def folder_name(self, folder_id):
        for folder in self.data["folders"]:
            if folder["id"] == folder_id:
                return folder["name"]
        return "Sin carpeta"


def main(page: ft.Page):
    app = TeleprompterApp(page)
    app.setup()


if __name__ == "__main__":
    ft.app(target=main)
