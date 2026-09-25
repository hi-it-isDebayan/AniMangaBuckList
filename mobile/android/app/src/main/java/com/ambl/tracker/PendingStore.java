package com.ambl.tracker;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

public final class PendingStore {
    private static final String KEY = "pending";

    private PendingStore() {}

    public static synchronized JSONArray all(Context ctx) {
        String raw = Tracker.prefs(ctx).getString(KEY, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public static synchronized void add(Context ctx, JSONObject detected) {
        if (detected == null) return;
        JSONArray arr = all(ctx);
        String norm = detected.optString("normalized", "");
        String unit = detected.optString("unit", "");
        int value = detected.optInt("value", 0);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && o.optString("normalized", "").equals(norm)
                    && o.optString("unit", "").equals(unit)
                    && o.optInt("value", 0) == value) {
                return; // already pending
            }
        }
        arr.put(detected);
        while (arr.length() > 20) arr.remove(0);
        Tracker.prefs(ctx).edit().putString(KEY, arr.toString()).apply();
    }

    public static synchronized void remove(Context ctx, String dedupeKey) {
        JSONArray arr = all(ctx);
        JSONArray next = new JSONArray();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            String k = o.optString("normalized", "") + "|" + o.optString("unit", "") + "|" + o.optInt("value", 0);
            if (k.equals(dedupeKey)) continue;
            next.put(o);
        }
        Tracker.prefs(ctx).edit().putString(KEY, next.toString()).apply();
    }

    public static synchronized String dedupeKey(JSONObject detected) {
        return detected.optString("normalized", "") + "|" + detected.optString("unit", "") + "|" + detected.optInt("value", 0);
    }
}