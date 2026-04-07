"use client";

import {
  AtSign,
  CheckCircle2,
  Shield,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

// Shell: shows the "not connected" state.
// When backend is wired, this will read from instagramAccounts table.
const CONNECTED = false;

const REQUIRED_SCOPES = [
  { label: "instagram_business_basic", description: "Read account profile and media" },
  { label: "instagram_business_manage_messages", description: "Send and receive DMs" },
  { label: "instagram_business_manage_comments", description: "Manage comments on posts" },
  { label: "instagram_business_content_publish", description: "Publish content (optional)" },
];

export default function AccountPage() {
  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-2xl w-full flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Account</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your Instagram professional account to enable automation.
          </p>
        </div>

        {CONNECTED ? (
          <ConnectedState />
        ) : (
          <NotConnectedState />
        )}
      </div>
    </main>
  );
}

function NotConnectedState() {
  return (
    <>
      {/* Connection card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 flex flex-col items-center text-center gap-5">
          <div className="size-14 rounded-full bg-muted flex items-center justify-center">
            <AtSign className="size-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-foreground">
              No account connected
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Connect your Instagram professional account to start receiving
              webhooks and running automation rules.
            </p>
          </div>
          <button
            disabled
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity cursor-not-allowed opacity-60"
          >
            <AtSign className="size-4" />
            Connect with Instagram
          </button>
          <p className="text-xs text-muted-foreground">
            OAuth flow — coming in the next step
          </p>
        </div>

        <div className="border-t border-border bg-muted/40 px-6 py-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Required permissions
          </p>
          <div className="flex flex-col gap-2">
            {REQUIRED_SCOPES.map((scope) => (
              <div key={scope.label} className="flex items-start gap-2.5">
                <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <code className="text-xs font-mono text-foreground">
                    {scope.label}
                  </code>
                  <p className="text-xs text-muted-foreground">
                    {scope.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Meta requirements note */}
      <div className="bg-card border border-border rounded-xl p-5 flex gap-3.5">
        <Shield className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">
            Instagram professional account required
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account must be a Creator or Business account. Personal
            accounts are not supported by the Instagram API. You can upgrade in
            the Instagram app under{" "}
            <span className="font-medium text-foreground">
              Settings → Account → Switch account type
            </span>
            .
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1 w-fit"
          >
            Meta developer docs
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </>
  );
}

function ConnectedState() {
  return (
    <>
      {/* Connected account card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 flex items-center gap-4">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-foreground shrink-0">
            A
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">
                @account_handle
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <CheckCircle2 className="size-3" />
                Connected
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Business account · Connected 2026-03-10
            </p>
          </div>
          <button className="text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh token
          </button>
        </div>

        <div className="border-t border-border px-5 py-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Token expires</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              2026-06-09
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Webhook status</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              Active
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Events today</p>
            <p className="text-sm font-medium text-foreground mt-0.5 tabular-nums">
              14
            </p>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-border rounded-xl p-5 flex gap-3.5">
        <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Disconnect account</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Removes the token and stops all automation. Cannot be undone without reconnecting.
            </p>
          </div>
          <button className="shrink-0 text-sm font-medium text-destructive border border-destructive/30 rounded-lg px-3 py-1.5 hover:bg-destructive/5 transition-colors cursor-pointer">
            Disconnect
          </button>
        </div>
      </div>
    </>
  );
}
