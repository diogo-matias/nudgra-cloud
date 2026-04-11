"use client";

import Link from "next/link";
import { AtSign, Plus } from "lucide-react";

export function SelectedAccountEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] border border-border bg-card px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-3xl border border-border bg-muted/50">
          <AtSign className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/account"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Manage accounts
          </Link>
          <Link
            href="/api/meta/connect"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="size-4" />
            Add account
          </Link>
        </div>
      </div>
    </div>
  );
}
