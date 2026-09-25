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
    private String lastFpr = "";
    private long lastAt = 0;
    private volatile long lastReport = 0;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        reloadState();
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
            if (det == null || det.value <= 0) return;

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

            if ((now - lastReport) < 4000) return; // throttle across different detections
            lastReport = now;
            new ApiClient(this).report(det);
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