import type { Metadata } from "next";
import { Chrome, Smartphone } from "lucide-react";

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
      <header className="noise-overlay relative overflow-hidden rounded-3xl border border-border/70 bg-card/60 p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-gradient opacity-20 blur-3xl"
        />
        <div className="relative space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-gradient">
            AniManga Tracker apps
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The tracker works on <strong className="text-foreground">any</strong> site you watch or
            read on — no fixed site list. It detects the series title and chapter/episode number
            from the page or screen and syncs it to your account with fuzzy title matching.
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card-hover space-y-3 rounded-2xl border border-border/70 bg-card/70 p-6 shadow-sm shadow-black/[0.03]">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Smartphone className="h-4 w-4" />
            </span>
            Android app
          </h2>
          <p className="text-sm text-muted-foreground">
            Runs in the background and auto-detects what you&apos;re reading or watching on your
            phone. Download the <span className="font-medium text-foreground">.apk</span> and
            enable the accessibility service once.
          </p>
          <a
            href={APK_URL}
            className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.03] hover:bg-primary/90"
          >
            Download app (.apk)
          </a>
          <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
            <li>Download and open the apk, allow &quot;install unknown apps&quot;.</li>
            <li>Sign in on the website and create an API key in Settings.</li>
            <li>Paste the key into the app and tap &quot;Enable background detection&quot;.</li>
            <li>Allow the accessibility permission. It reads the screen only to catch titles.</li>
          </ol>
        </div>

        <div className="card-hover space-y-3 rounded-2xl border border-border/70 bg-card/70 p-6 shadow-sm shadow-black/[0.03]">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Chrome className="h-4 w-4" />
            </span>
            Browser extension
          </h2>
          <p className="text-sm text-muted-foreground">
            For Chrome and Brave on desktop. Detects the title and chapter/episode from any reader
            or streaming site you visit.
          </p>
          <a
            href={EXT_URL}
            className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.03] hover:bg-primary/90"
          >
            Download extension (.zip)
          </a>
          <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
            <li>Unzip the download somewhere stable.</li>
            <li>
              Open{" "}
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">chrome://extensions</code>{" "}
              (or <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">brave://extensions</code>
              ).
            </li>
            <li>
              Enable <strong className="text-foreground">Developer mode</strong>, click{" "}
              <strong className="text-foreground">Load unpacked</strong>, select the unzipped folder.
            </li>
            <li>
              Paste your Settings API key into the popup. Ambiguous titles appear as &quot;Needs
              confirmation&quot;.
            </li>
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