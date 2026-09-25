package com.ambl.tracker;

import android.content.Context;
import android.content.SharedPreferences;

public final class Tracker {
    public static final String DEFAULT_BASE = "https://animanga.debayandas.in";
    public static final String PREFS = "ambl";
    public static final String KEY_BASE = "baseUrl";
    public static final String KEY_KEY = "apiKey";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_LAST_FINGERPRINT = "lastFpr";
    public static final String KEY_LAST_AT = "lastAt";

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
}