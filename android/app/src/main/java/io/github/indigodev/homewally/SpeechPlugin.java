package io.github.indigodev.homewally;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Reads the voice control's answers aloud with the Android speech output. The Android WebView has no
 * speechSynthesis, so the web app uses this plugin inside HomeWally (and the browser's voices on the website).
 * Counterpart in the web app: src/native/speech.ts
 */
@CapacitorPlugin(name = "Speech")
public class SpeechPlugin extends Plugin {

    private static final int STARTING = 0, READY = 1, FAILED = -1;

    private TextToSpeech tts;
    private volatile int state = STARTING;
    /** speak calls that arrived before the engine was ready */
    private final List<PluginCall> waiting = new ArrayList<>();
    /** utterance id → call, resolved when the text is spoken (or stopped) */
    private final Map<String, PluginCall> running = new HashMap<>();
    private int nextId = 0;

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            List<PluginCall> queued;
            synchronized (this) {
                state = status == TextToSpeech.SUCCESS ? READY : FAILED;
                queued = new ArrayList<>(waiting);
                waiting.clear();
            }
            // only the latest request matters: earlier ones would be cut off by it anyway
            for (int i = 0; i < queued.size(); i++) {
                if (i < queued.size() - 1) queued.get(i).resolve();
                else say(queued.get(i));
            }
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String id) {}

            @Override
            public void onDone(String id) {
                PluginCall call = take(id);
                if (call != null) call.resolve();
            }

            @Override
            public void onStop(String id, boolean interrupted) {
                PluginCall call = take(id);
                if (call != null) call.resolve();
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onError(String id) {
                PluginCall call = take(id);
                if (call != null) call.reject("Speech output failed");
            }
        });
    }

    private synchronized PluginCall take(String id) {
        return running.remove(id);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.resolve();
            return;
        }
        synchronized (this) {
            if (state == STARTING) {
                waiting.add(call);
                return;
            }
        }
        say(call);
    }

    private void say(PluginCall call) {
        if (state != READY || tts == null) {
            call.reject("No speech output on this device", "UNAVAILABLE");
            return;
        }
        String lang = call.getString("lang");
        if (lang != null && !lang.isEmpty()) {
            int res = tts.setLanguage(Locale.forLanguageTag(lang));
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                call.reject("No voice for " + lang, "NO_VOICE");
                return;
            }
        }
        String id;
        synchronized (this) {
            id = "u" + (nextId++);
            running.put(id, call);
        }
        // QUEUE_FLUSH: a new answer replaces what is still being read
        if (tts.speak(call.getString("text"), TextToSpeech.QUEUE_FLUSH, new Bundle(), id) != TextToSpeech.SUCCESS) {
            PluginCall c = take(id);
            if (c != null) c.reject("Speech output failed");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        List<PluginCall> queued;
        synchronized (this) {
            queued = new ArrayList<>(waiting);
            waiting.clear();
        }
        for (PluginCall c : queued) c.resolve();
        if (tts != null && state == READY) tts.stop();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }
}
