package com.ashramganesha.teleprompter;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String PREFS = "teleprompter";
    private static final String SCRIPTS = "scripts";
    private static final String FOLDERS = "folders";
    private final ArrayList<String> folders = new ArrayList<>();
    private final ArrayList<Script> scripts = new ArrayList<>();
    private Button folderButton;
    private Button scriptButton;
    private Button saveFolderButton;
    private EditText titleInput;
    private EditText textInput;
    private String selectedFolder = "";
    private int selectedScriptIndex = 0;

    @Override
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        loadData();
        buildUi();
        bindCurrentScript();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(10), dp(28), dp(10), dp(24));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int top = dp(28);
            int bottom = dp(24);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                top = bars.top + dp(8);
                bottom = bars.bottom + dp(8);
            } else {
                top = insets.getSystemWindowInsetTop() + dp(8);
                bottom = insets.getSystemWindowInsetBottom() + dp(8);
            }
            view.setPadding(dp(10), top, dp(10), bottom);
            return insets;
        });
        root.setBackgroundColor(Color.rgb(255, 248, 231));

        LinearLayout head = row();
        LinearLayout titleBlock = new LinearLayout(this);
        titleBlock.setOrientation(LinearLayout.VERTICAL);
        titleBlock.addView(text("Teleprompter", 17, true, Color.rgb(63, 58, 32)));
        titleBlock.addView(text("Modo celular", 10, false, Color.rgb(108, 104, 64)));
        head.addView(titleBlock, new LinearLayout.LayoutParams(0, -2, 1));
        head.addView(iconButton(true, v -> newScript()));
        head.addView(iconButton(false, v -> deleteCurrent()));
        root.addView(head);

        LinearLayout selectors = row();
        folderButton = selectorButton("Carpeta: Todas");
        folderButton.setOnClickListener(v -> chooseFolder());
        scriptButton = selectorButton("Guion");
        scriptButton.setOnClickListener(v -> chooseScript());
        selectors.addView(folderButton, weight(42));
        selectors.addView(scriptButton, weight(42));
        root.addView(selectors);

        titleInput = new EditText(this);
        titleInput.setHint("Titulo");
        titleInput.setTextSize(16);
        titleInput.setSingleLine(true);
        titleInput.setPadding(dp(10), 0, dp(10), 0);
        titleInput.setBackground(box(Color.WHITE));
        root.addView(titleInput, fullHeight(48));

        saveFolderButton = selectorButton("Guardar en: Sin carpeta");
        saveFolderButton.setOnClickListener(v -> chooseSaveFolder());
        LinearLayout.LayoutParams saveParams = fullHeight(42);
        saveParams.setMargins(0, dp(5), 0, dp(6));
        root.addView(saveFolderButton, saveParams);

        textInput = new EditText(this);
        textInput.setHint("Escribe o pega aqui tu guion...");
        textInput.setGravity(Gravity.TOP | Gravity.START);
        textInput.setTextSize(15);
        textInput.setPadding(dp(11), dp(9), dp(11), dp(9));
        textInput.setBackground(box(Color.WHITE));
        textInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        root.addView(textInput, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout bottom = row();
        bottom.setPadding(0, dp(7), 0, 0);
        Button permission = smallButton("Permiso");
        permission.setOnClickListener(v -> openOverlayPermission());
        Button save = smallButton("Guardar");
        save.setOnClickListener(v -> saveCurrent());
        Button play = primaryButton("Play");
        play.setOnClickListener(v -> startFloating());
        bottom.addView(permission, weight(40));
        bottom.addView(save, weight(40));
        bottom.addView(play, weight(40));
        root.addView(bottom);

        setContentView(root);
    }

    private void chooseFolder() {
        ArrayList<String> values = new ArrayList<>();
        values.add("Todas");
        values.addAll(folders);
        showChooser("Carpeta", values, value -> {
            saveFormToSelected();
            selectedFolder = "Todas".equals(value) ? "" : value;
            selectedScriptIndex = 0;
            bindCurrentScript();
        });
    }

    private void chooseScript() {
        ArrayList<Script> visible = visibleScripts();
        ArrayList<String> values = new ArrayList<>();
        for (Script script : visible) values.add(script.title);
        showChooser("Guion", values, value -> {
            saveFormToSelected();
            for (int i = 0; i < visible.size(); i++) {
                if (visible.get(i).title.equals(value)) {
                    selectedScriptIndex = i;
                    break;
                }
            }
            bindCurrentScript();
        });
    }

    private void chooseSaveFolder() {
        ArrayList<String> values = new ArrayList<>();
        values.add("Sin carpeta");
        values.addAll(folders);
        showChooser("Guardar en", values, value -> {
            Script script = selectedVisibleScript();
            if (script == null) return;
            script.folder = "Sin carpeta".equals(value) ? "" : value;
            saveFolderButton.setText("Guardar en: " + (script.folder.isEmpty() ? "Sin carpeta" : script.folder));
            saveData();
        });
    }

    private void showChooser(String title, ArrayList<String> values, Choice choice) {
        if (values.isEmpty()) return;
        new AlertDialog.Builder(this)
            .setTitle(title)
            .setItems(values.toArray(new String[0]), (dialog, which) -> choice.pick(values.get(which)))
            .show();
    }

    private void bindCurrentScript() {
        ArrayList<Script> visible = visibleScripts();
        if (visible.isEmpty()) {
            selectedFolder = "";
            selectedScriptIndex = 0;
            visible = visibleScripts();
        }
        if (visible.isEmpty()) return;
        selectedScriptIndex = Math.max(0, Math.min(selectedScriptIndex, visible.size() - 1));
        Script script = visible.get(selectedScriptIndex);
        folderButton.setText("Carpeta: " + (selectedFolder.isEmpty() ? "Todas" : selectedFolder));
        scriptButton.setText("Guion: " + script.title);
        saveFolderButton.setText("Guardar en: " + (script.folder.isEmpty() ? "Sin carpeta" : script.folder));
        titleInput.setText(script.title);
        textInput.setText(script.text);
    }

    private void newScript() {
        saveFormToSelected();
        scripts.add(0, new Script("Nuevo guion", "", selectedFolder));
        selectedFolder = "";
        selectedScriptIndex = 0;
        saveData();
        bindCurrentScript();
        titleInput.requestFocus();
    }

    private void saveCurrent() {
        saveFormToSelected();
        saveData();
        bindCurrentScript();
    }

    private void deleteCurrent() {
        Script script = selectedVisibleScript();
        if (script == null) return;
        if (scripts.size() <= 1) {
            script.title = "Primer guion";
            script.text = "";
            script.folder = "";
        } else {
            scripts.remove(script);
        }
        selectedScriptIndex = 0;
        saveData();
        bindCurrentScript();
    }

    private void startFloating() {
        saveFormToSelected();
        if (!Settings.canDrawOverlays(this)) {
            openOverlayPermission();
            return;
        }
        String title = titleInput.getText().toString().trim();
        if (title.isEmpty()) title = "Sin titulo";
        String text = textInput.getText().toString();
        Intent intent = new Intent(this, FloatingPromptService.class);
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        startService(intent);
        moveTaskToBack(true);
    }

    private void openOverlayPermission() {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
        startActivity(intent);
    }

    private void saveFormToSelected() {
        if (titleInput == null) return;
        Script script = selectedVisibleScript();
        if (script == null) return;
        script.title = titleInput.getText().toString().trim();
        if (script.title.isEmpty()) script.title = "Sin titulo";
        script.text = textInput.getText().toString();
        saveData();
    }

    private Script selectedVisibleScript() {
        ArrayList<Script> visible = visibleScripts();
        if (visible.isEmpty()) return null;
        return visible.get(Math.max(0, Math.min(selectedScriptIndex, visible.size() - 1)));
    }

    private ArrayList<Script> visibleScripts() {
        ArrayList<Script> visible = new ArrayList<>();
        for (Script script : scripts) {
            if (selectedFolder.isEmpty() || selectedFolder.equals(script.folder)) visible.add(script);
        }
        return visible;
    }

    private void loadData() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        try {
            JSONArray folderArray = new JSONArray(prefs.getString(FOLDERS, "[]"));
            for (int i = 0; i < folderArray.length(); i++) folders.add(folderArray.getString(i));
        } catch (Exception ignored) {}
        if (folders.isEmpty()) {
            folders.add("Ayurveda");
            folders.add("Registros");
            folders.add("Satsang");
        }

        try {
            JSONArray array = new JSONArray(prefs.getString(SCRIPTS, "[]"));
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.getJSONObject(i);
                scripts.add(new Script(item.optString("title", "Sin titulo"), item.optString("text", ""), item.optString("folder", "")));
            }
        } catch (Exception ignored) {}
        if (scripts.isEmpty()) {
            scripts.add(new Script("Primer guion", "Respira.\n\nAbre la camara del celular.\n\nEl texto queda flotando encima.", "Ayurveda"));
        }
    }

    private void saveData() {
        try {
            JSONArray folderArray = new JSONArray();
            for (String folder : folders) folderArray.put(folder);
            JSONArray scriptArray = new JSONArray();
            for (Script script : scripts) {
                JSONObject item = new JSONObject();
                item.put("title", script.title);
                item.put("text", script.text);
                item.put("folder", script.folder);
                scriptArray.put(item);
            }
            getSharedPreferences(PREFS, MODE_PRIVATE)
                .edit()
                .putString(FOLDERS, folderArray.toString())
                .putString(SCRIPTS, scriptArray.toString())
                .apply();
        } catch (Exception ignored) {}
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private Button selectorButton(String text) {
        Button button = smallButton(text);
        button.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        button.setBackground(box(Color.WHITE));
        button.setSingleLine(true);
        return button;
    }

    private Button smallButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextSize(12);
        button.setAllCaps(false);
        button.setPadding(dp(8), 0, dp(8), 0);
        return button;
    }

    private Button primaryButton(String text) {
        Button button = smallButton(text);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(Color.rgb(94, 90, 46));
        return button;
    }

    private ImageButton iconButton(boolean add, android.view.View.OnClickListener listener) {
        ImageButton button = new ImageButton(this);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setImageResource(add ? android.R.drawable.ic_input_add : android.R.drawable.ic_menu_delete);
        button.setOnClickListener(listener);
        button.setPadding(dp(6), dp(6), dp(6), dp(6));
        return button;
    }

    private TextView text(String value, int size, boolean bold, int color) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(color);
        if (bold) text.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return text;
    }

    private GradientDrawable box(int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(8));
        drawable.setStroke(dp(1), Color.rgb(220, 202, 160));
        return drawable;
    }

    private LinearLayout.LayoutParams fullHeight(int height) {
        return new LinearLayout.LayoutParams(-1, dp(height));
    }

    private LinearLayout.LayoutParams weight(int height) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(height), 1);
        params.setMargins(dp(2), dp(2), dp(2), dp(2));
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private interface Choice {
        void pick(String value);
    }

    private static class Script {
        String title;
        String text;
        String folder;
        Script(String title, String text, String folder) {
            this.title = title;
            this.text = text;
            this.folder = folder == null ? "" : folder;
        }
    }
}
