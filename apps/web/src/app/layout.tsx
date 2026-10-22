import type { Metadata } from "next";
import { Manrope, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteFooter } from "@/components/site-footer";

const sans = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "AniMangaBuckList",
    template: "%s · AniMangaBuckList",
  },
  description:
    "A lightweight, privacy-conscious tracker for anime, manga, manhwa, manhua and novels.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171721" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.classList.add("js");try{var t=localStorage.getItem("ambl-theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}d.classList.toggle("dark",t==="dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
