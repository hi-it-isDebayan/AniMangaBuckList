package com.ambl.tracker;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class Tracker {
    public static final String DEFAULT_BASE = "https://animanga.debayandas.in";
    public static final String PREFS = "ambl";
    public static final String KEY_BASE = "baseUrl";
    public static final String KEY_KEY = "apiKey";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_LAST_FINGERPRINT = "lastFpr";
    public static final String KEY_LAST_AT = "lastAt";
    public static final String KEY_LOG = "log";
    private static final int LOG_MAX = 40;

    private Tracker() {}

    public static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean enabled(Context ctx) {
        return prefs(ctx).getBoolean(KEY_ENABLED, true);
    }

    public static String baseUrl(Context ctx) {
        String b = prefs(ctx).getString(KEY_BASE, DEFAULT_BASE);
        if (b == null || b.isEmpty()) b = DEFAULT_BASE;
        while (b.endsWith("/")) b = b.substring(0, b.length() - 1);
        return b;
    }

    public static String apiKey(Context ctx) {
        return prefs(ctx).getString(KEY_KEY, "");
    }

    public static void log(Context ctx, String message) {
        JSONArray arr = lastLog(ctx);
        JSONObject o = new JSONObject();
        try {
            o.put("t", System.currentTimeMillis());
            o.put("m", message);
        } catch (Exception ignored) {}
        arr.put(o);
        while (arr.length() > LOG_MAX) arr.remove(0);
        prefs(ctx).edit().putString(KEY_LOG, arr.toString()).apply();
    }

    public static JSONArray lastLog(Context ctx) {
        String raw = prefs(ctx).getString(KEY_LOG, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public static String logText(Context ctx) {
        JSONArray arr = lastLog(ctx);
        SimpleDateFormat fmt = new SimpleDateFormat("HH:mm:ss", Locale.ROOT);
        StringBuilder sb = new StringBuilder();
        boolean first = true;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            if (!first) sb.append('\n');
            first = false;
            sb.append(fmt.format(new Date(o.optLong("t", 0)))).append(" ").append(o.optString("m", ""));
        }
        return sb.toString();
    }
}