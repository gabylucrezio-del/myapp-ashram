package com.ashramganesha.estudio;

import android.app.Service;
import android.content.SharedPreferences;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

public class FloatingPromptService extends Service {
    private WindowManager windowManager;
    private FrameLayout overlay;
    private WindowManager.LayoutParams overlayParams;
    private FrameLayout promptViewport;
    private ScrollView promptScroll;
    private TextView promptText;
    private TextView titleView;
    private Button playButton;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<Script> scripts = new ArrayList<>();
    private boolean playing = false;
    private boolean locked = false;
    private float offset = 0f;
    private int speed = 150;
    private int opacity = 24;
    private int textSize = 32;
    private int windowWidthPercent = 92;
    private int windowHeightPercent = 58;
    private int promptRotation = 0;
    private int savedX = -1;
    private int savedY = -1;
    private long lastTick = 0;
    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (!playing || promptText == null) return;
            long now = System.currentTimeMillis();
            if (lastTick == 0) lastTick = now;
            float delta = (now - lastTick) / 1000f;
            lastTick = now;
            offset += speed * delta;
            if (promptScroll != null) promptScroll.scrollTo(0, Math.round(offset));
            handler.postDelayed(this, 16);
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent.getStringExtra("title");
        String text = intent.getStringExtra("text");
        loadSettings();
        showOverlay(title == null ? "Guion" : title, text == null ? "" : text);
        return START_STICKY;
    }

    private void showOverlay(String title, String text) {
        removeOverlay();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        overlay = new FrameLayout(this);
        applyOverlayOpacity();

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(8), dp(6), dp(8), dp(8));

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(4), 0, dp(4), 0);
        bar.setBackgroundColor(Color.argb(150, 18, 18, 18));
        titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(13);
        titleView.setSingleLine(true);
        playButton = new Button(this);
        playButton.setText("Play");
        Button textButton = new Button(this);
        textButton.setText("Texto");
        Button rotateButton = new Button(this);
        rotateButton.setText("Girar");
        Button controls = new Button(this);
        controls.setText("Ajustes");
        Button close = new Button(this);
        close.setText("Cerrar");
        bar.addView(titleView, new LinearLayout.LayoutParams(0, -2, 1));
        bar.addView(tinyButton(playButton));
        bar.addView(tinyButton(textButton));
        bar.addView(tinyButton(rotateButton));
        bar.addView(tinyButton(controls));
        bar.addView(closeButton(close));

        LinearLayout scriptPanel = new LinearLayout(this);
        scriptPanel.setOrientation(LinearLayout.VERTICAL);
        scriptPanel.setPadding(dp(8), dp(6), dp(8), dp(6));
        scriptPanel.setBackgroundColor(Color.argb(185, 17, 17, 17));
        scriptPanel.setVisibility(View.GONE);
        buildScriptPanel(scriptPanel);

        LinearLayout sliders = new LinearLayout(this);
        sliders.setOrientation(LinearLayout.VERTICAL);
        sliders.setPadding(dp(8), dp(6), dp(8), dp(6));
        sliders.setBackgroundColor(Color.argb(170, 17, 17, 17));
        sliders.setVisibility(View.GONE);
        Button reset = new Button(this);
        reset.setText("Inicio");
        Button lock = new Button(this);
        lock.setText("Bloquear");
        LinearLayout quickControls = new LinearLayout(this);
        quickControls.setGravity(Gravity.CENTER_VERTICAL);
        quickControls.addView(tinyButton(reset), new LinearLayout.LayoutParams(0, dp(34), 1));
        quickControls.addView(tinyButton(lock), new LinearLayout.LayoutParams(0, dp(34), 1));
        sliders.addView(quickControls);
        sliders.addView(control("Vel", 20, 420, speed, value -> {
            speed = value;
            saveSettings();
        }));
        sliders.addView(control("Texto", 24, 96, textSize, value -> {
            textSize = value;
            promptText.setTextSize(textSize);
            saveSettings();
        }));
        sliders.addView(control("Opac", 0, 92, opacity, value -> {
            opacity = value;
            applyOverlayOpacity();
            saveSettings();
        }));
        sliders.addView(control("Ancho", 35, 100, windowWidthPercent, value -> {
            windowWidthPercent = value;
            updateWindowSize();
            saveSettings();
        }));
        sliders.addView(control("Alto", 28, 100, windowHeightPercent, value -> {
            windowHeightPercent = value;
            updateWindowSize();
            saveSettings();
        }));

        promptViewport = new FrameLayout(this);
        promptViewport.setClipToPadding(true);
        promptViewport.setPadding(0, dp(2), 0, dp(2));
        promptScroll = new ScrollView(this);
        promptScroll.setFillViewport(true);
        promptScroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        promptText = new TextView(this);
        promptText.setText(text.isEmpty() ? "Guion vacio" : text);
        promptText.setTextColor(Color.WHITE);
        promptText.setTextSize(textSize);
        promptText.setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        promptText.setSingleLine(false);
        promptText.setHorizontallyScrolling(false);
        promptText.setMaxLines(2000);
        promptText.setIncludeFontPadding(true);
        promptText.setLineSpacing(0, 1.0f);
        promptText.setShadowLayer(12, 0, 2, Color.BLACK);
        promptText.setPadding(dp(14), dp(80), dp(14), dp(520));
        promptScroll.addView(promptText, new ScrollView.LayoutParams(-1, -2));
        promptViewport.addView(promptScroll, new FrameLayout.LayoutParams(-1, -1));

        content.addView(bar);
        content.addView(scriptPanel);
        content.addView(promptViewport, new LinearLayout.LayoutParams(-1, 0, 1));
        content.addView(sliders);
        overlay.addView(content, new FrameLayout.LayoutParams(-1, -1));

        playButton.setOnClickListener(v -> {
            playing = !playing;
            playButton.setText(playing ? "Pausa" : "Play");
            lastTick = 0;
            if (playing) handler.post(ticker);
        });
        reset.setOnClickListener(v -> {
            playing = false;
            playButton.setText("Play");
            offset = 0;
            if (promptScroll != null) promptScroll.scrollTo(0, 0);
        });
        lock.setOnClickListener(v -> {
            locked = !locked;
            lock.setText(locked ? "Desbloquear" : "Bloquear");
        });
        controls.setOnClickListener(v -> sliders.setVisibility(sliders.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
        textButton.setOnClickListener(v -> scriptPanel.setVisibility(scriptPanel.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
        rotateButton.setOnClickListener(v -> {
            promptRotation = (promptRotation + 90) % 360;
            applyPromptRotation();
            saveSettings();
        });
        close.setOnClickListener(v -> closeOverlayAndReturnToEditor());

        overlayParams = new WindowManager.LayoutParams(
            screenPercentWidth(windowWidthPercent),
            screenPercentHeight(windowHeightPercent),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        overlayParams.gravity = Gravity.TOP | Gravity.START;
        overlayParams.x = savedX >= 0 ? savedX : dp(18);
        overlayParams.y = savedY >= 0 ? savedY : dp(74);
        enableDrag(bar);
        windowManager.addView(overlay, overlayParams);
        promptViewport.post(this::applyPromptRotation);
    }

    private void buildScriptPanel(LinearLayout panel) {
        scripts.clear();
        loadScripts();
        TextView label = new TextView(this);
        label.setText("Elegir guion");
        label.setTextColor(Color.WHITE);
        label.setTextSize(11);
        panel.addView(label);
        ScrollView scrollView = new ScrollView(this);
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        for (Script script : scripts) {
            Button button = new Button(this);
            button.setText((script.folder.isEmpty() ? "" : script.folder + " · ") + script.title);
            button.setTextSize(11);
            button.setAllCaps(false);
            button.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
            button.setPadding(dp(8), 0, dp(8), 0);
            button.setTextColor(Color.WHITE);
            button.setBackgroundColor(Color.TRANSPARENT);
            button.setOnClickListener(v -> {
                playing = false;
                offset = 0;
                lastTick = 0;
                if (titleView != null) titleView.setText(script.title);
                if (promptText != null) {
                    promptText.setText(script.text.isEmpty() ? "Guion vacio" : script.text);
                    if (promptScroll != null) promptScroll.scrollTo(0, 0);
                }
                panel.setVisibility(View.GONE);
            });
            list.addView(button, new LinearLayout.LayoutParams(-1, dp(34)));
        }
        scrollView.addView(list);
        panel.addView(scrollView, new LinearLayout.LayoutParams(-1, dp(210)));
    }

    private void loadScripts() {
        try {
            SharedPreferences prefs = getSharedPreferences("teleprompter", MODE_PRIVATE);
            JSONArray array = new JSONArray(prefs.getString("scripts", "[]"));
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.getJSONObject(i);
                scripts.add(new Script(item.optString("title", "Sin titulo"), item.optString("text", ""), item.optString("folder", "")));
            }
        } catch (Exception ignored) {}
    }

    private LinearLayout control(String label, int min, int max, int value, ValueChange listener) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView text = new TextView(this);
        text.setText(label);
        text.setTextColor(Color.WHITE);
        text.setTextSize(10);
        SeekBar seekBar = new SeekBar(this);
        seekBar.setMax(max - min);
        seekBar.setProgress(value - min);
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                listener.onChange(progress + min);
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        row.addView(text, new LinearLayout.LayoutParams(dp(46), -2));
        row.addView(seekBar, new LinearLayout.LayoutParams(0, -2, 1));
        return row;
    }

    private Button tinyButton(Button button) {
        button.setTextSize(10);
        button.setAllCaps(false);
        button.setMinHeight(0);
        button.setMinWidth(0);
        button.setPadding(dp(6), 0, dp(6), 0);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(Color.TRANSPARENT);
        return button;
    }

    private Button closeButton(Button button) {
        button.setTextSize(10);
        button.setAllCaps(false);
        button.setMinHeight(0);
        button.setMinWidth(0);
        button.setPadding(dp(8), 0, dp(8), 0);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(Color.rgb(154, 50, 42));
        return button;
    }

    private void enableDrag(View handle) {
        final int[] startX = new int[1];
        final int[] startY = new int[1];
        final float[] downX = new float[1];
        final float[] downY = new float[1];
        handle.setOnTouchListener((view, event) -> {
            if (locked) return true;
            if (overlayParams == null) return false;
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                startX[0] = overlayParams.x;
                startY[0] = overlayParams.y;
                downX[0] = event.getRawX();
                downY[0] = event.getRawY();
                return true;
            }
            if (event.getAction() == MotionEvent.ACTION_MOVE) {
                overlayParams.x = startX[0] + Math.round(event.getRawX() - downX[0]);
                overlayParams.y = startY[0] + Math.round(event.getRawY() - downY[0]);
                windowManager.updateViewLayout(overlay, overlayParams);
                savedX = overlayParams.x;
                savedY = overlayParams.y;
                saveSettings();
                return true;
            }
            return false;
        });
    }

    private void applyOverlayOpacity() {
        if (overlay != null) overlay.setBackgroundColor(Color.argb(Math.round(opacity * 255f / 100f), 0, 0, 0));
    }

    private void applyPromptRotation() {
        if (promptViewport == null || promptScroll == null) return;
        int normalizedRotation = ((promptRotation % 360) + 360) % 360;
        promptRotation = normalizedRotation;

        int viewportWidth = promptViewport.getWidth();
        int viewportHeight = promptViewport.getHeight();
        FrameLayout.LayoutParams params;
        if (normalizedRotation == 90 || normalizedRotation == 270) {
            params = new FrameLayout.LayoutParams(Math.max(1, viewportHeight), Math.max(1, viewportWidth), Gravity.CENTER);
        } else {
            params = new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER);
        }
        promptScroll.setLayoutParams(params);
        promptScroll.setPivotX(params.width > 0 ? params.width / 2f : promptScroll.getWidth() / 2f);
        promptScroll.setPivotY(params.height > 0 ? params.height / 2f : promptScroll.getHeight() / 2f);
        promptScroll.setRotation(normalizedRotation);
        promptScroll.requestLayout();
    }

    private void updateWindowSize() {
        if (overlayParams == null || overlay == null || windowManager == null) return;
        overlayParams.width = screenPercentWidth(windowWidthPercent);
        overlayParams.height = screenPercentHeight(windowHeightPercent);
        clampOverlayPosition();
        windowManager.updateViewLayout(overlay, overlayParams);
    }

    private void clampOverlayPosition() {
        if (overlayParams == null) return;
        int maxX = Math.max(0, getResources().getDisplayMetrics().widthPixels - overlayParams.width);
        int maxY = Math.max(0, getResources().getDisplayMetrics().heightPixels - overlayParams.height);
        overlayParams.x = Math.max(0, Math.min(overlayParams.x, maxX));
        overlayParams.y = Math.max(0, Math.min(overlayParams.y, maxY));
        savedX = overlayParams.x;
        savedY = overlayParams.y;
    }

    private int screenPercentWidth(int percent) {
        return Math.round(getResources().getDisplayMetrics().widthPixels * (percent / 100f));
    }

    private int screenPercentHeight(int percent) {
        return Math.round(getResources().getDisplayMetrics().heightPixels * (percent / 100f));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void loadSettings() {
        SharedPreferences prefs = getSharedPreferences("teleprompter_settings", MODE_PRIVATE);
        speed = prefs.getInt("speed", speed);
        opacity = prefs.getInt("opacity", opacity);
        textSize = prefs.getInt("textSize", textSize);
        windowWidthPercent = prefs.getInt("windowWidthPercent", windowWidthPercent);
        windowHeightPercent = prefs.getInt("windowHeightPercent", windowHeightPercent);
        savedX = prefs.getInt("x", -1);
        savedY = prefs.getInt("y", -1);
        promptRotation = prefs.getInt("promptRotation", 0);
    }

    private void saveSettings() {
        getSharedPreferences("teleprompter_settings", MODE_PRIVATE)
            .edit()
            .putInt("speed", speed)
            .putInt("opacity", opacity)
            .putInt("textSize", textSize)
            .putInt("windowWidthPercent", windowWidthPercent)
            .putInt("windowHeightPercent", windowHeightPercent)
            .putInt("promptRotation", promptRotation)
            .putInt("x", savedX)
            .putInt("y", savedY)
            .apply();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        updateWindowSize();
        if (promptViewport != null) promptViewport.post(this::applyPromptRotation);
    }

    private void removeOverlay() {
        handler.removeCallbacksAndMessages(null);
        if (windowManager != null && overlay != null) {
            windowManager.removeView(overlay);
        }
        overlay = null;
        overlayParams = null;
        promptText = null;
        promptScroll = null;
        promptViewport = null;
        playing = false;
        offset = 0;
    }

    private void closeOverlayAndReturnToEditor() {
        removeOverlay();
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        removeOverlay();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private interface ValueChange {
        void onChange(int value);
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
