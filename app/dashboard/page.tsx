"use client";

import Link from "next/link";
import {
  Zap,
  Users,
  MessageSquare,
  AlertCircle,
  ArrowRight,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your automation summary at a glance.
          </p>
        </div>

        {/* Account connection notice */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <AtSign className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              No Instagram account connected
            </p>
            <p className="text-sm text-muted-foreground">
              Connect a professional account to start automating.
            </p>
          </div>
          <Link
            href="/dashboard/account"
            className="shrink-0 text-sm font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
          >
            Connect
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Active rules" value="0" icon={Zap} />
          <StatCard label="Contacts" value="0" icon={Users} />
          <StatCard label="Conversations" value="0" icon={MessageSquare} />
          <StatCard
            label="Failures today"
            value="0"
            icon={AlertCircle}
            destructive
          />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLink
            href="/dashboard/rules"
            title="Automation Rules"
            description="Set up keyword triggers and automatic DM replies."
            icon={Zap}
          />
          <QuickLink
            href="/dashboard/contacts"
            title="Contacts"
            description="View Instagram users who've interacted with your account."
            icon={Users}
          />
          <QuickLink
            href="/dashboard/conversations"
            title="Conversations"
            description="Browse message threads and automation history."
            icon={MessageSquare}
          />
          <QuickLink
            href="/dashboard/logs"
            title="Logs & Failures"
            description="Inspect delivery attempts, errors, and webhook events."
            icon={AlertCircle}
          />
        </div>

        {/* Recent activity */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Recent Activity
          </h2>
          <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center text-center gap-2">
            <p className="text-sm font-medium text-foreground">
              No activity yet
            </p>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Automation events, replies, and errors will appear here once your
              account is connected and rules are running.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  destructive,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  destructive?: boolean;
}) {
  const hasAlert = destructive && value !== "0";
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <Icon
        className={cn(
          "size-3.5 mb-3",
          destructive ? "text-muted-foreground/50" : "text-muted-foreground/50"
        )}
      />
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          hasAlert ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="group bg-card border border-border rounded-xl p-5 flex items-start gap-3.5 hover:shadow-sm transition-all"
    >
      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight className="size-3.5 text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />
    </Link>
  );
}
