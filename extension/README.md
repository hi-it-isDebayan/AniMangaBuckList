# AniManga BuckList Tracker (browser extension)

Tracks your anime/manga reading and watching progress into the
[AniManga BuckList](https://animanga.debayandas.in) web app.

Compatible with both **Google Chrome** and **Brave** (standard MV3 extension).
Plain HTML/JS/CSS — no build step.

## Files

- `manifest.json` — MV3 manifest
- `background.js` — MV3 service worker (API calls, config storage)
- `content.js` — runs on MAL / AniList / MangaDex / Crunchyroll pages, reports progress
- `popup.html` / `popup.css` / `popup.js` — extension popup
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
3. Leave **Enabled** checked. Visit a title/reader page — progress is reported
   automatically.

## Notes

- The API key and base URL live in `chrome.storage.local`, only on your machine —
  never in the repo or source files.
- The base URL defaults to `https://animanga.debayandas.in` and can be changed
  under the popup's **Advanced** section.
- Content scripts only report progress when a chapter/episode number can be
  detected conservatively from the URL (e.g. `/chapter/123`, `/ep/12`). Title
  pages without a specific chapter/episode are not reported.