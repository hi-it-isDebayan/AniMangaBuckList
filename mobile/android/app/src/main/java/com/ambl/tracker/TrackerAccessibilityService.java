package com.ambl.tracker;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.List;

public class TrackerAccessibilityService extends AccessibilityService {
    private static final long DEBOUNCE_MS = 45000;
    private static final long LINE_LOOP_PERIOD = 10000;
    private String lastFpr = "";
    private long lastAt = 0;
    private volatile long lastReport = 0;
    private long lastSkipLog = 0;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        reloadState();
        Tracker.log(this, "SVC accessibility service connected");
    }

    private void reloadState() {
        SharedPreferences p = getSharedPreferences(Tracker.PREFS, Context.MODE_PRIVATE);
        lastFpr = p.getString(Tracker.KEY_LAST_FINGERPRINT, "");
        lastAt = p.getLong(Tracker.KEY_LAST_AT, 0);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!Tracker.enabled(this)) return;
        int type = event.getEventType();
        boolean interesting = (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                || type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                || type == AccessibilityEvent.TYPE_VIEW_SCROLLED
                || type == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED);
        if (!interesting) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        try {
            String pkg = event.getPackageName() == null ? null : event.getPackageName().toString();
            if (pkg != null && (pkg.startsWith("com.ambl.tracker") || pkg.startsWith("android"))) return;

            List<String> texts = Extractor.collectTexts(root, 3000);
            String blob = String.join(" | ", texts);
            Extractor.Result det = Extractor.detect(null, blob, texts);
            if (det == null || det.value <= 0) {
                long now = System.currentTimeMillis();
                if (now - lastSkipLog > LINE_LOOP_PERIOD) {
                    lastSkipLog = now;
                    Tracker.log(this, "SKIP no chapter/episode number in screen text (nodes="
                            + texts.size() + ", chars=" + blob.length() + ")");
                }
                return;
            }

            String fpr = (det.title == null ? "" : det.title) + "|" + det.unit + "|" + det.value;
            long now = System.currentTimeMillis();
            if (fpr.equals(lastFpr) && (now - lastAt) < DEBOUNCE_MS) return;
            lastFpr = fpr;
            lastAt = now;
            getSharedPreferences(Tracker.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(Tracker.KEY_LAST_FINGERPRINT, lastFpr)
                .putLong(Tracker.KEY_LAST_AT, lastAt)
                .apply();

            String title = det.title == null ? "" : det.title;
            if (title.length() > 48) title = title.substring(0, 48);
            Tracker.log(this, "DETECT " + title + " " + det.unit + " " + det.value);

            if ((now - lastReport) < 4000) return; // throttle across different detections
            lastReport = now;
            new ApiClient(this).report(det, (json, status, error) -> {
                if (status == 200) {
                    String note = json != null && json.optBoolean("needsConfirmation", false)
                            ? " needs-confirmation" : "";
                    Tracker.log(this, "SENT 200 OK" + note);
                } else if (status == 409) {
                    Tracker.log(this, "SENT 409 needs-confirmation");
                } else if (status == 404) {
                    Tracker.log(this, "SENT 404 no match \u2014 tap Find in library");
                } else if (status == 401) {
                    Tracker.log(this, "SENT 401 bad/empty API key");
                } else if (status < 0) {
                    Tracker.log(this, "SEND ERR " + (error != null ? error : "network"));
                } else {
                    Tracker.log(this, "SENT " + status);
                }
            });
        } finally {
            root.recycle();
        }
    }

    @Override
    public void onInterrupt() {
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }

    public static void openSettings(Context ctx) {
        try {
            ctx.startActivity(new Intent("android.settings.ACCESSIBILITY_SETTINGS"));
        } catch (Exception ignored) {}
    }
}