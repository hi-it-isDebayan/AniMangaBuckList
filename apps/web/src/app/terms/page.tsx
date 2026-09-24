import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of AniMangaBuckList.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <article className="space-y-6 text-sm leading-relaxed">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="text-xs text-muted-foreground">Last updated: September 24, 2026</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Acceptance</h2>
          <p>
            By creating an account or using AniMangaBuckList (the &ldquo;Service&rdquo;), you agree to
            these Terms. If you do not agree, please do not use the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. The Service</h2>
          <p>
            The Service is a personal tracking tool for anime, manga, manhwa, manhua and novels. It
            lets you record titles, progress, tags and notes in a personal library. We may add,
            change or remove features over time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Accounts</h2>
          <p>
            You are responsible for keeping your sign-in credentials safe and for everything done
            with your account. You may register with an email and password, or with a Google or
            MyAnimeList account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 ps-5">
            <li>Attempt to access another user&apos;s account or data.</li>
            <li>Misuse, overload or attempt to disrupt the Service or its infrastructure.</li>
            <li>Upload or store unlawful, infringing or harmful content.</li>
            <li>Use the Service for spam, scams or automated abuse.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Third-party content</h2>
          <p>
            Title metadata (covers, synopses, genres, counts) is provided by third parties such as
            MyAnimeList and may be subject to their licenses. The Service merely displays this
            material to track your own progress.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Termination</h2>
          <p>
            You may stop using the Service at any time. We may suspend or terminate accounts that
            violate these Terms. On request, your account data will be deleted (see the{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            ).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Disclaimer</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
            warranties of any kind. We do not guarantee that the Service will be uninterrupted,
            error-free or that metadata will always be accurate or complete.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, the operators of the Service are not liable for
            any indirect, incidental or consequential damages arising from your use of the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes
            are posted means you accept the updated Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Contact</h2>
          <p>
            Questions about these Terms can be sent via the project repository at{" "}
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