"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-semibold text-lg tracking-tight text-foreground">
            nudgra
          </span>
          {!isLoading && (
            <nav>
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/signin"
                  className="text-sm font-medium text-foreground hover:text-foreground/60 transition-colors"
                >
                  Sign in
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6">
        <section className="pt-24 pb-20 md:pt-32 md:pb-28 flex flex-col items-center text-center gap-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            Self-hosted · No SaaS fees · You own the data
          </div>

          <h1 className="max-w-3xl text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Own your Instagram automation.
          </h1>

          <p className="max-w-lg text-lg text-muted-foreground leading-relaxed">
            Nudgra automates your DMs, story replies, and follow-up sequences —
            without a monthly subscription. You deploy it, you control it.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              href="/signin"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-medium text-sm px-6 py-3 hover:opacity-90 transition-opacity shadow-sm"
            >
              Get started
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background text-foreground font-medium text-sm px-6 py-3 hover:bg-muted transition-colors"
            >
              See what it does
            </a>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="py-16 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-10"
        >
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-foreground">Keyword DM replies</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Respond automatically when someone messages a keyword. Set the
              rule once and Nudgra handles the rest.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-foreground">Story entry points</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Capture story reactions and replies as conversation triggers.
              Start automated sequences the moment someone shows interest.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-foreground">No per-account fees</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Deploy once in your own environment. No vendor lock-in, no
              per-seat pricing, no surprises on your bill.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
