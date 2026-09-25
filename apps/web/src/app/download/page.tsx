import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download",
  description:
    "Track your anime and manga on any website — browser extension for desktop, background tracker app for Android.",
};

const APK_URL =
  "https://github.com/hi-it-isDebayan/AniMangaBuckList/releases/latest/download/animanga-tracker.apk";
const EXT_URL =
  "https://github.com/hi-it-isDebayan/AniMangaBuckList/releases/latest/download/animanga-tracker-extension.zip";

export default function DownloadPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">AniManga Tracker apps</h1>
        <p className="text-sm text-muted-foreground">
          The tracker works on <strong>any</strong> site you watch or read on — no fixed site
          list. It detects the series title and chapter/episode number from the page or screen and
          syncs it to your account with fuzzy title matching.
        </p>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Android app</h2>
          <p className="text-sm text-muted-foreground">
            Runs in the background and auto-detects what you&apos;re reading or watching on your
            phone. Download the <span className="font-medium text-foreground">.apk</span> and
            enable the accessibility service once.
          </p>
          <a href={APK_URL} className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Download app (.apk)
          </a>
          <ol className="list-decimal space-y-1 ps-5 text-sm">
            <li>Download and open the apk, allow &quot;install unknown apps&quot;.</li>
            <li>Sign in on the website and create an API key in Settings.</li>
            <li>Paste the key into the app and tap &quot;Enable background detection&quot;.</li>
            <li>Allow the accessibility permission. It reads the screen only to catch titles.</li>
          </ol>
        </div>

        <div className="space-y-3 rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Browser extension</h2>
          <p className="text-sm text-muted-foreground">
            For Chrome and Brave on desktop. Detects the title and chapter/episode from any reader
            or streaming site you visit.
          </p>
          <a href={EXT_URL} className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Download extension (.zip)
          </a>
          <ol className="list-decimal space-y-1 ps-5 text-sm">
            <li>Unzip the download somewhere stable.</li>
            <li>Open <code className="rounded bg-muted px-1">chrome://extensions</code> (or <code className="rounded bg-muted px-1">brave://extensions</code>).</li>
            <li>Enable <strong>Developer mode</strong>, click <strong>Load unpacked</strong>, select the unzipped folder.</li>
            <li>Paste your Settings API key into the popup. Ambiguous titles appear as &quot;Needs confirmation&quot;.</li>
          </ol>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Both apps are built automatically from the project repository. Requests are an open-source
        project — find the code on{" "}
        <a
          href="https://github.com/hi-it-isDebayan/AniMangaBuckList"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          GitHub
        </a>
        .
      </p>
    </main>
  );
}