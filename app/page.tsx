"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            nudgra
          </span>
          {!isLoading ? (
            <nav>
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/signin"
                  className="text-sm font-medium text-foreground transition-colors hover:text-foreground/60"
                >
                  Sign in
                </Link>
              )}
            </nav>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="flex flex-col items-center gap-6 pb-20 pt-24 text-center md:pb-28 md:pt-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            Operator-owned deployment / No SaaS fees / You own the data
          </div>

          <h1 className="max-w-3xl text-5xl font-bold leading-[1.1] tracking-tight text-foreground md:text-6xl">
            Own your Instagram automation.
          </h1>

          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            Nudgra automates your DMs, story replies, and follow-up sequences
            without a monthly subscription. You deploy it, you control it.
          </p>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
            <Link
              href="/signin"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              See what it does
            </a>
          </div>
        </section>

        <section
          id="features"
          className="grid grid-cols-1 gap-10 border-t border-border py-16 sm:grid-cols-3"
        >
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-foreground">Keyword DM replies</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Respond automatically when someone messages a keyword. Set the
              rule once and Nudgra handles the rest.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-foreground">Story entry points</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Capture story replies as conversation triggers and start the right
              follow-up sequence as soon as someone shows intent.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-foreground">No per-account fees</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Run it in your own stack, keep your data model open, and avoid
              recurring platform pricing for the core Instagram automation flow.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
