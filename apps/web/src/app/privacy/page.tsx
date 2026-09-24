import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AniMangaBuckList collects, uses and protects your information.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <article className="space-y-6 text-sm leading-relaxed">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: September 24, 2026</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. What we collect</h2>
          <p>
            AniMangaBuckList lets you build a personal library of anime, manga, manhwa, manhua and
            novels. To do that we store the minimum information needed to run the service:
          </p>
          <ul className="list-disc space-y-1 ps-5">
            <li>
              <strong>Account details</strong> — your display name, and either the email/password you
              sign up with or, if you sign in with Google or MyAnimeList, that provider&apos;s
              identifier and the name it provides. MyAnimeList does not give us your email address.
            </li>
            <li>
              <strong>Your library data</strong> — titles you add, their status, progress, tags,
              notes and ratings.
            </li>
            <li>
              <strong>Session cookies</strong> — a secure, HttpOnly cookie that keeps you signed in.
            </li>
            <li>
              <strong>Release metadata</strong> — when you add a title we fetch its cover, genres,
              chapters, synopsis and similar details from public metadata providers such as
              MyAnimeList.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. How we use it</h2>
          <p>
            Your data is used only to operate the service: to save and display your library, keep
            you signed in, and fetch up-to-date title information. We do not sell, rent or trade
            your personal data, and we do not show advertisements based on it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Sign-in providers</h2>
          <p>
            If you choose to sign in with Google or MyAnimeList, you authenticate directly on those
            providers&apos; own pages. We receive only the minimal profile information they send back
            (identity and name), and signing in is governed by their platforms and their privacy
            policies as well as ours.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Where data is stored</h2>
          <p>
            Your data is stored in a hosted PostgreSQL database. Access is restricted to the
            application, connections are encrypted in transit, and passwords (for email accounts)
            are stored only as secure hashes — we never see or store plain-text passwords.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Retention and deletion</h2>
          <p>
            We keep your account and library data for as long as your account exists. You can delete
            your account and data by contacting us (see section 8); after deletion the data is
            removed from our system.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Children</h2>
          <p>
            The service is not directed at children under 13, and we do not knowingly collect
            personal information from them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Changes to this policy</h2>
          <p>
            We may update this policy as the service evolves. Material changes will be reflected by
            updating the date at the top of this page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Contact</h2>
          <p>
            Questions about this policy or requests to access or delete your data can be sent via
            the project repository at{" "}
            <a
              href="https://github.com/hi-it-isDebayan/AniMangaBuckList"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              github.com/hi-it-isDebayan/AniMangaBuckList
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}