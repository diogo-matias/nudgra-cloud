"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function ToggleCard({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {children}
    </div>
  );
}

export function ValidationIssuesNotice({
  title,
  issues,
}: {
  title: string;
  issues: string[];
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-amber-900">{title}</p>
          {issues.map((issue) => (
            <p key={issue} className="text-xs leading-relaxed text-amber-800">
              {issue}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InlineWarning({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-xs leading-relaxed text-amber-800">{text}</p>
    </div>
  );
}

export function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed text-foreground">{value || "-"}</p>
    </div>
  );
}

export function RadioCircle({ selected }: { selected: boolean }) {
  return (
    <div
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        selected ? "border-primary" : "border-muted-foreground/40"
      }`}
    >
      {selected ? <div className="size-2.5 rounded-full bg-primary" /> : null}
    </div>
  );
}

export function OptionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`cursor-pointer rounded-xl border bg-card px-4 py-3 transition-colors ${
        selected
          ? "border-primary/30 bg-primary/[0.02]"
          : "border-border hover:bg-muted/50"
      }`}
    >
      {children}
    </div>
  );
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {isActive ? "Live" : "Paused"}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status: "draft" | "live" | "paused";
}) {
  const styles =
    status === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "paused"
        ? "border-border bg-muted text-muted-foreground"
        : "border-amber-200 bg-amber-50 text-amber-700";

  const label =
    status === "live" ? "Live" : status === "paused" ? "Paused" : "Draft";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}
