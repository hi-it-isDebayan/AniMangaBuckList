# AniManga BuckList Tracker (browser extension)

Auto-tracks the anime and manga you watch or read **on any website** into the
[AniManga BuckList](https://animanga.debayandas.in) web app.

Works on reader/streaming sites like Asura Scans, ManhwaPlus, ManhwaTop,
KingOfShojo, AniWave, AniSuge, MAL, and others — there is no hardcoded site
list. Compatible with both **Google Chrome** and **Brave** (standard MV3
extension). Plain HTML/JS/CSS — no build step.

## How it detects things

The extension reads the page's `<title>`, `og:title`, JSON-LD metadata, headings
and URL to extract:

- the **series name** (e.g. "Solo Leveling")
- the **chapter or episode number** (e.g. `/chapter/5`, `Episode 12`)

It sends `{ title, titleCandidates, unit: CHAPTER|EPISODE, value }` to the
backend, which **fuzzy-matches the title** against the catalog (pg_trgm
similarity over primary/english/japanese titles and aliases).

- High-confidence match → progress logged immediately.
- Low-confidence / no match → the request returns `409 needsConfirmation` and
  shows up in the popup's **"Needs confirmation"** section. You pick the right
  title from candidates, search your library, or edit the detected name. That
  mapping is **remembered per user**, so you never confirm the same site+title
  twice.

## Files

- `manifest.json` — MV3 manifest (permissions for all `http/https` sites)
- `background.js` — MV3 service worker (API calls, pending queue, badge)
- `content.js` — site-agnostic page reader; extracts title + chapter/episode
- `popup.html` / `popup.css` / `popup.js` — extension popup + confirmation UI
- `icons/` — generated PNG icons (16/32/48/128)
- `gen_icons.js` — regenerate the icons: `node gen_icons.js`

## Load (Chrome)

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

## Load (Brave)

1. Go to `brave://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

## Set up

1. Log in to [AniManga BuckList](https://animanga.debayandas.in) and open
   **/settings** → "Browser extension API key" to generate a key (`ambl_...`).
2. Click the extension toolbar icon, paste the key into the **API key** field,
   and click **Save**.
3. Leave **Enabled** checked. Open a chapter/episode on any site — progress is
   reported automatically; anything ambiguous appears under "Needs
   confirmation".

## Notes

- The API key and base URL live in `chrome.storage.local`, only on your machine —
  never in the repo or source files.
- The base URL defaults to `https://animanga.debayandas.in` and can be changed
  under the popup's **Advanced** section.
- The extension needs broad site access (`<all_urls>`) because it adapts to any
  website. Chrome shows "Read and change all your data on all websites" on
  install — that is expected.
- Content scripts only report progress when a chapter/episode number AND a
  series name can be extracted; generic pages are ignored.
- Unresolved titles are queued locally (max 20) and shown in the popup until you
  confirm or dismiss them.