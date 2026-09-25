package com.ambl.tracker;

import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Mirror of the browser-extension detector: pulls a series title + chapter/episode number. */
public final class Extractor {
    private static final String[] CHAPTER_TOKENS = {"chapter", "chapters", "chap", "ch", "capitulo", "cap"};
    private static final String[] EPISODE_TOKENS = {"episode", "episodes", "ep", "episodio"};

    public static final class Result {
        public final String title;
        public final List<String> titleCandidates;
        public final String unit; // CHAPTER | EPISODE
        public final int value;
        Result(String title, List<String> candidates, String unit, int value) {
            this.title = title;
            this.titleCandidates = candidates;
            this.unit = unit;
            this.value = value;
        }
    }

    private Extractor() {}

    private static String normalized(String s) {
        if (s == null) return "";
        s = s.toLowerCase(Locale.ROOT);
        s = s.replace('.', ' ');
        s = s.replace("asurascans", " ").replace("asuratoons", " ")
             .replace("asura scans", " ").replace("asurascan", " ").replace("asura", " ")
             .replace("kingofshojo", " ").replace("king of shojo", " ")
             .replace("manhwaplus", " ").replace("manhwa plus", " ")
             .replace("manhwatop", " ").replace("manhwa top", " ")
             .replace("aniwave", " ").replace("animesuge", " ").replace("anime suge", " ")
             .replace("mangakakalot", " ").replace("manganato", " ").replace("bato.to", " ")
             .replace("toonily", " ").replace("flamecomics", " ").replace("firescans", " ")
             .replace("reaper scans", " ").replace("reaperscans", " ").replace("webtoon", " ")
             .replace("mangadex", " ").replace("myanimelist", " ").replace("anilist", " ")
             .replace("crunchyroll", " ").replace("gogoanime", " ").replace("mangafire", " ")
             .replace("mangahere", " ");
        s = s.replaceAll("\\b(?:chapter|chap|ch)\\.?\\s*\\d+(\\.?\\d+)?", " ");
        s = s.replaceAll("\\b(?:episode|ep)\\.?\\s*\\d+(\\.?\\d+)?", " ");
        s = s.replaceAll("\\b(?:vol(?:ume)?|season|book)\\s*\\d+", " ");
        s = s.replaceAll("\\b(?:read|reading|watch|watching|online|free|english|subbed|sub|dubbed|dub|raw)\\b", " ");
        s = s.replaceAll("[^\\p{L}\\p{N}]+", " ");
        s = s.trim().replaceAll("\\s+", " ");
        return s;
    }

    /** Extract unit+value from a chunk of text/URL. Null if none. */
    public static int[] extractFromText(String text) {
        if (text == null) return null;
        String s = text.toLowerCase(Locale.ROOT);
        for (String tok : CHAPTER_TOKENS) {
            int v = matchToken(s, tok);
            if (v > 0) return new int[]{1, v}; // 1 = CHAPTER
        }
        for (String tok : EPISODE_TOKENS) {
            int v = matchToken(s, tok);
            if (v > 0) return new int[]{0, v}; // 0 = EPISODE
        }
        return null;
    }

    private static int matchToken(String s, String tok) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
            "(?:^|[^a-z0-9])" + java.util.regex.Pattern.quote(tok) + "[.\\s\\/-]*?(\\d{1,4})(?:$|[^a-z0-9])");
        java.util.regex.Matcher m = p.matcher(s);
        if (m.find()) return Integer.parseInt(m.group(1));
        return 0;
    }

    /** Slug trailing-number fallback for sites like manhwatop /series/title-177/. */
    public static int[] extractTrailingNumber(String url) {
        if (url == null) return null;
        String path;
        try {
            path = new java.net.URL(url).getPath();
        } catch (Exception e) {
            path = url;
        }
        while (path.endsWith("/")) path = path.substring(0, path.length() - 1);
        int slash = path.lastIndexOf('/');
        String last = slash >= 0 ? path.substring(slash + 1) : path;
        if (last.isEmpty()) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.*?)-(\\d{1,5})$").matcher(last);
        if (!m.find()) return null;
        int num;
        try { num = Integer.parseInt(m.group(2)); } catch (Exception e) { return null; }
        String titlePart = m.group(1).trim();
        if (titlePart.length() < 3) return null;
        if (!path.matches("(?i).*(series|manga|manhwa|manhua|title|comic|chapter|reader|read|novel|comics|anime|watch|episode).*")) return null;
        int unit = path.matches("(?i).*(episode|ep-|episode-|watch|anime|dub|sub).*") ? 0 : 1;
        return new int[]{unit, num};
    }

    /** Walk an accessibility node tree and gather readable text. */
    public static List<String> collectTexts(AccessibilityNodeInfo root, int limit) {
        List<String> out = new ArrayList<>();
        collectTexts(root, out, new int[]{0}, limit);
        return out;
    }

    private static void collectTexts(AccessibilityNodeInfo node, List<String> out, int[] count, int limit) {
        if (node == null || count[0] >= limit) return;
        if (out.size() < 120) {
            CharSequence t = node.getText();
            if (t != null && t.length() > 1) out.add(t.toString());
            CharSequence cd = node.getContentDescription();
            if (cd != null && cd.length() > 1) out.add(cd.toString());
        }
        count[0]++;
        for (int i = 0; i < node.getChildCount() && count[0] < limit; i++) {
            collectTexts(node.getChild(i), out, count, limit);
        }
    }

    /** Rank likely title candidates (short, pure-name strings first; matches unit strings later-ranked). */
    private static List<String> pickTitleCandidates(List<String> texts) {
        List<String> ranked = new ArrayList<>();
        for (String t : texts) {
            String c = t.replaceAll("[|•·|•·]", " ").replaceAll("\\s+", " ").trim();
            if (c.length() > 2) ranked.add(c);
        }
        ranked.sort((a, b) -> {
            boolean ja = a.toLowerCase(Locale.ROOT).matches(".*(episode|chapter| ch |ep ).*");
            boolean jb = b.toLowerCase(Locale.ROOT).matches(".*(episode|chapter| ch |ep ).*");
            if (ja != jb) return ja ? 1 : -1;
            return Integer.compare(a.length(), b.length());
        });
        List<String> out = new ArrayList<>();
        for (String t : ranked) {
            String key = t.toLowerCase(Locale.ROOT);
            boolean dup = false;
            for (String o : out) if (o.toLowerCase(Locale.ROOT).equals(key)) { dup = true; break; }
            if (!dup) out.add(t);
            if (out.size() >= 10) break;
        }
        return out;
    }

    public static Result detect(String url, String pageBlob, List<String> texts) {
        int[] uvUrl = null;
        if (url != null) {
            uvUrl = extractFromText(url);
            if (uvUrl == null) uvUrl = extractTrailingNumber(url);
        }
        int[] uvBlob = extractFromText(pageBlob);
        int[] chosen = uvUrl != null ? uvUrl : uvBlob;
        if (chosen == null) {
            // any single text may hold the number
            for (String t : texts) {
                int[] r = extractFromText(t);
                if (r != null) { chosen = r; break; }
            }
        }
        if (chosen == null) return null;

        List<String> candidates = pickTitleCandidates(texts);
        String title = candidates.isEmpty() ? normalized(pageBlob) : candidates.get(0);
        return new Result(title, candidates,
            chosen[0] == 1 ? "CHAPTER" : "EPISODE", chosen[1]);
    }
}