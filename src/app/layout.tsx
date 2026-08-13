import type { Metadata } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import SiteHeaderNav from "@/app/components/SiteHeaderNav";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Galatariotis Recall Check",
  description:
    "Check whether your vehicle needs an authorized garage recall by VIN or registration number.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <header className="relative z-50 border-b border-[var(--line)]/70 bg-white/70 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
            <Link
              href="/"
              className="group inline-flex flex-col items-start gap-1.5"
            >
              <span className="flex flex-wrap items-center gap-3 sm:gap-4">
                <Image
                  src="/galatariotis-logo.png"
                  alt="Galatariotis"
                  width={249}
                  height={70}
                  className="h-8 w-auto transition-transform duration-200 group-hover:-translate-y-0.5 sm:h-10"
                  priority
                />
                <span
                  className="hidden h-8 w-px bg-[var(--line)] sm:block sm:h-10"
                  aria-hidden
                />
                <Image
                  src="/honda-logo.png"
                  alt="Honda"
                  width={202}
                  height={48}
                  className="h-8 w-auto transition-transform duration-200 group-hover:-translate-y-0.5 sm:h-10"
                  priority
                />
              </span>
              <div className="brand-mark text-[0.7rem] font-semibold text-[var(--muted)]">
                Recall Check
              </div>
            </Link>
            <SiteHeaderNav />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10">
          {children}
        </main>
        <footer className="border-t border-[var(--line)]/70 py-5 text-center text-sm text-[var(--muted)]">
          Visit an authorized garage to complete any open recalls.
        </footer>
      </body>
    </html>
  );
}
