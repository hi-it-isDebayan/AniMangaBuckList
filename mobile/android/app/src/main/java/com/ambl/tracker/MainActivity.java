package com.ambl.tracker;

import android.Manifest;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

public class MainActivity extends Activity {

    private EditText baseInput;
    private EditText keyInput;
    private LinearLayout pendingBox;
    private TextView statusView;
    private TextView logView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestNotificationPermissionIfNeeded();

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(16), dp(16), dp(16));

        TextView title = new TextView(this);
        title.setText("AniManga Tracker");
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        root.addView(label("API base URL"));
        baseInput = new EditText(this);
        baseInput.setSingleLine(true);
        root.addView(baseInput);

        root.addView(label("API key (from the website Settings page)"));
        keyInput = new EditText(this);
        keyInput.setSingleLine(true);
        keyInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        root.addView(keyInput);

        Button save = new Button(this);
        save.setText("Save & start");
        save.setOnClickListener(v -> saveConfig());
        root.addView(save);

        Button acc = new Button(this);
        acc.setText("Enable background detection");
        acc.setOnClickListener(v -> TrackerAccessibilityService.openSettings(this));
        root.addView(acc);

        Button getKey = new Button(this);
        getKey.setText("Open website to create an API key");
        getKey.setOnClickListener(v -> {
            try {
                startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,
                        android.net.Uri.parse(Tracker.baseUrl(this) + "/settings")));
            } catch (Exception ignored) {}
        });
        root.addView(getKey);

        Button test = new Button(this);
        test.setText("Test connection");
        test.setOnClickListener(v -> testConnection());
        root.addView(test);

        statusView = new TextView(this);
        statusView.setTextSize(13);
        statusView.setPadding(0, dp(8), 0, dp(4));
        root.addView(statusView);

        TextView guide = new TextView(this);
        guide.setTextSize(12);
        guide.setText("If background tracking stops on Samsung:\n"
                + "1) Apps > AniManga BuckList Tracker > Battery > Unrestricted\n"
                + "2) Battery & device care > Battery > Background usage limits > "
                + "Never sleeping apps > add this app\n"
                + "3) After every phone restart/update re-enable: "
                + "Accessibility > Installed apps > AniManga BuckList Tracker");
        guide.setPadding(0, dp(4), 0, dp(4));
        root.addView(guide);

        TextView logLabel = label("Activity log");
        root.addView(logLabel);
        logView = new TextView(this);
        logView.setTextSize(11);
        logView.setPadding(0, 0, 0, dp(8));
        root.addView(logView);

        TextView pendLabel = label("Needs confirmation");
        root.addView(pendLabel);
        pendingBox = new LinearLayout(this);
        pendingBox.setOrientation(LinearLayout.VERTICAL);
        root.addView(pendingBox);

        scroll.addView(root);
        setContentView(scroll);

        loadConfig();
        renderPending();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                   != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    private TextView label(String s) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(13);
        t.setPadding(0, dp(14), 0, dp(4));
        return t;
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void loadConfig() {
        baseInput.setText(Tracker.baseUrl(this));
        keyInput.setText(Tracker.apiKey(this));
    }

    private void saveConfig() {
        getSharedPreferences(Tracker.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(Tracker.KEY_BASE, baseInput.getText().toString().trim())
            .putString(Tracker.KEY_KEY, keyInput.getText().toString().trim())
            .putBoolean(Tracker.KEY_ENABLED, true)
            .apply();
        TrackerForegroundService.start(this);
        Toast.makeText(this, "Saved. Enable the accessibility service above to auto-detect.", Toast.LENGTH_LONG).show();
        renderPending();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadConfig();
        renderPending();
        renderStatus();
        renderLog();
    }

    private boolean accessibilityEnabled() {
        AccessibilityManager am = (AccessibilityManager) getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (am == null) return false;
        String myId = getPackageName() + "/" + TrackerAccessibilityService.class.getName();
        for (AccessibilityServiceInfo i : am.getEnabledAccessibilityServiceList(
                AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
            if (i.getId().equals(myId)) return true;
        }
        return false;
    }

    private boolean notificationsAllowed() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean batteryExempt() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    private void renderStatus() {
        if (statusView == null) return;
        boolean keySet = !Tracker.apiKey(this).isEmpty();
        boolean acc = accessibilityEnabled();
        StringBuilder s = new StringBuilder();
        s.append("API key: ").append(keySet ? "saved" : "NOT SET").append('\n');
        s.append("Background detection: ").append(acc ? "ON" : "OFF").append('\n');
        s.append("Notifications: ").append(notificationsAllowed() ? "allowed" : "BLOCKED").append('\n');
        s.append("Battery: ").append(batteryExempt() ? "exempt from optimization" : "optimized (Samsung may kill it)");
        statusView.setText(s.toString());
        statusView.setTextColor(acc ? 0xFF4CAF50 : 0xFFFF5252);
    }

    private void renderLog() {
        if (logView == null) return;
        String t = Tracker.logText(this);
        logView.setText(t.isEmpty() ? "No activity yet. Open a chapter/episode page and come back." : t);
    }

    private void testConnection() {
        Tracker.log(this, "Testing connection to " + Tracker.baseUrl(this) + " ...");
        renderLog();
        new ApiClient(this).testConnection((json, status, error) -> runOnUiThread(() -> {
            String msg;
            if (status == 200 && json != null) {
                int n = json.optJSONArray("candidates") == null
                        ? 0 : json.optJSONArray("candidates").length();
                msg = "Connection OK \u2014 resolve returned " + n + " candidates";
            } else if (status == 401) {
                msg = "HTTP 401 \u2014 wrong or missing API key";
            } else if (status == -1) {
                msg = "Network error: " + (error != null ? error : "?");
            } else {
                msg = "Unexpected: HTTP " + status;
            }
            Tracker.log(this, "TEST " + msg);
            renderLog();
            Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
        }));
    }

    private void renderPending() {
        pendingBox.removeAllViews();
        JSONArray arr = PendingStore.all(this);
        if (arr.length() == 0) {
            TextView none = new TextView(this);
            none.setText("Nothing waiting. Open a chapter while reading to queue it here.");
            none.setTextSize(12);
            none.setPadding(0, dp(6), 0, dp(6));
            pendingBox.addView(none);
            return;
        }
        for (int i = 0; i < arr.length(); i++) {
            JSONObject d = arr.optJSONObject(i);
            if (d != null) pendingBox.addView(pendingItem(d));
        }
    }

    private View pendingItem(final JSONObject d) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundResource(android.R.drawable.edit_text);
        card.setPadding(dp(10), dp(8), dp(10), dp(8));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(6), 0, dp(6));
        card.setLayoutParams(lp);

        TextView head = new TextView(this);
        String unit = d.optString("unit", "CHAPTER").toLowerCase(Locale.ROOT);
        head.setText(String.format(Locale.ROOT, "%s  \u00b7  %s %d",
            d.optString("title", "Unknown"), unit, d.optInt("value", 0)));
        head.setPadding(0, 0, 0, dp(2));
        card.addView(head);

        final EditText search = new EditText(this);
        search.setSingleLine(true);
        search.setHint("Type the real title...");
        search.setText(d.optString("title", ""));
        card.addView(search);

        Button find = new Button(this);
        find.setText("Find in library");
        find.setOnClickListener(v -> findCandidates(d, search.getText().toString().trim(), card));
        card.addView(find);

        final String dedupe = PendingStore.dedupeKey(d);
        Button dismiss = new Button(this);
        dismiss.setText("Dismiss");
        dismiss.setOnClickListener(v -> {
            PendingStore.remove(this, dedupe);
            renderPending();
        });
        card.addView(dismiss);

        return card;
    }

    private void findCandidates(final JSONObject d, final String query, final LinearLayout card) {
        if (query.isEmpty()) return;
        new ApiClient(this).search(query, d.optString("unit", "CHAPTER"), (json, status, error) -> runOnUiThread(() -> {
            if (status != 200 || json == null) {
                Toast.makeText(this, "Search failed: " + (error != null ? error : "?"), Toast.LENGTH_SHORT).show();
                return;
            }
            JSONArray cands = json.optJSONArray("candidates");
            if (cands == null || cands.length() == 0) {
                Toast.makeText(this, "No matches \u2014 add this title on the website first.", Toast.LENGTH_SHORT).show();
                return;
            }
            for (int i = 0; i < cands.length(); i++) {
                final JSONObject c = cands.optJSONObject(i);
                if (c == null) continue;
                Button b = new Button(this);
                String name = c.optString("primaryTitle", "?");
                double score = c.optDouble("score", 0);
                b.setText(String.format(Locale.ROOT, "%s  (%d%%)", name, (int) Math.round(score * 100)));
                b.setOnClickListener(v -> {
                    try {
                        JSONObject payload = new JSONObject();
                        payload.put("titleId", c.optString("titleId"));
                        payload.put("detectedTitle", query);
                        payload.put("unit", d.optString("unit", "CHAPTER"));
                        payload.put("value", d.optInt("value", 0));
                        payload.put("kind", d.optString("kind", "OPENED"));
                        payload.put("host", "android");
                        new ApiClient(this).confirm(payload, PendingStore.dedupeKey(d), (r, s, e) -> runOnUiThread(() -> {
                            if (s == 200) {
                                Toast.makeText(this, "Logged \u2713", Toast.LENGTH_SHORT).show();
                                renderPending();
                            } else {
                                Toast.makeText(this, "Confirm failed: " + (e != null ? e : "?"), Toast.LENGTH_SHORT).show();
                            }
                        }));
                    } catch (Exception ignored) {}
                });
                card.addView(b);
            }
        }));
    }
}