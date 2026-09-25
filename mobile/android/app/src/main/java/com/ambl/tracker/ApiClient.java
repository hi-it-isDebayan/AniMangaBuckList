package com.ambl.tracker;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class ApiClient {
    public interface Callback {
        void onResult(JSONObject json, int status, String error);
    }

    private final Context ctx;
    private final String baseUrl;
    private final String apiKey;

    public ApiClient(Context ctx) {
        this.ctx = ctx;
        this.baseUrl = Tracker.baseUrl(ctx);
        this.apiKey = Tracker.apiKey(ctx);
    }

    private enum Method { GET, POST }

    public void report(final Extractor.Result det) {
        if (apiKey.isEmpty()) return;
        try {
            JSONObject body = new JSONObject();
            body.put("title", det.title == null ? "" : det.title);
            JSONArray cands = new JSONArray();
            if (det.titleCandidates != null) {
                for (String c : det.titleCandidates) cands.put(c);
            }
            if (cands.length() == 0) cands.put(det.title == null ? "" : det.title);
            body.put("titleCandidates", cands);
            body.put("unit", det.unit);
            body.put("value", det.value);
            body.put("kind", "OPENED");
            body.put("source", "android");
            body.put("host", "android");
            async(Method.POST, "/api/extension/progress", body, (json, status, error) -> {
                if (status == 409 && json != null && json.optBoolean("needsConfirmation", false)) {
                    PendingStore.add(ctx, json.optJSONObject("detected"));
                }
            });
        } catch (Exception e) {
            // ignore
        }
    }

    public void search(final String q, final String unit, final Callback cb) {
        try {
            String u = baseUrl + "/api/extension/resolve?q=" + java.net.URLEncoder.encode(q, "UTF-8")
                    + "&unit=" + java.net.URLEncoder.encode(unit == null || unit.isEmpty() ? "CHAPTER" : unit, "UTF-8");
            async(Method.GET, u, null, (json, status, error) -> cb.onResult(json, status, error));
        } catch (Exception e) {
            cb.onResult(null, -1, e.getMessage());
        }
    }

    public void confirm(final JSONObject payload, final String dedupeKey, final Callback cb) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(baseUrl + "/api/extension/confirm");
            conn = open(Method.POST, url);
            write(conn, payload);
            conn.getInputStream();
            JSONObject json = new JSONObject(read(conn.getInputStream()));
            cb.onResult(json, 200, null);
            PendingStore.remove(ctx, dedupeKey);
        } catch (Exception e) {
            cb.onResult(null, -1, e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    public void async(final Method method, final String url, final JSONObject body, final Callback cb) {
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = open(method, new URL(url));
                if (body != null) write(conn, body);
                int status = conn.getResponseCode();
                InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                String txt = is == null ? "" : read(is);
                JSONObject json = null;
                try {
                    if (txt != null && !txt.isEmpty()) json = new JSONObject(txt);
                } catch (Exception ignore) {}
                cb.onResult(json, status, status >= 400 ? txt : null);
            } catch (Exception e) {
                cb.onResult(null, -1, e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private HttpURLConnection open(Method m, URL url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestMethod(m == Method.GET ? "GET" : "POST");
        conn.setRequestProperty("Authorization", "Bearer " + apiKey);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        conn.setDoInput(true);
        if (m == Method.POST) conn.setDoOutput(true);
        return conn;
    }

    private static void write(HttpURLConnection conn, JSONObject body) throws Exception {
        OutputStream os = conn.getOutputStream();
        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
        os.flush();
        os.close();
    }

    private static String read(InputStream is) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
        }
        return sb.toString();
    }
}