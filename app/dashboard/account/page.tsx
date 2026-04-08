"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import {
  AtSign,
  CheckCircle2,
  Shield,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/convex/_generated/api";

type ConnectedAccount = {
  id: string;
  instagramAccountId: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  accountType: string;
  status: string;
  scopes: string[];
  tokenExpiresAt: number | null;
  webhookSubscriptionStatus: string;
  lastWebhookAt: number | null;
  lastError: string | null;
  connectedAt: number | null;
  disconnectedAt: number | null;
};

const REQUIRED_SCOPES = [
  {
    label: "instagram_business_basic",
    description: "Read account profile and media",
  },
  {
    label: "instagram_business_manage_messages",
    description: "Send and receive DMs",
  },
  {
    label: "instagram_business_manage_comments",
    description: "Manage comments on posts",
  },
];

const META_WEBHOOK_DOCS_URL =
  "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/webhooks";
const CONVEX_WEBHOOK_CALLBACK_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  ? `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/meta/webhooks`
  : null;

export default function AccountPage() {
  const data = useQuery(api.accounts.getCurrentAccountStatus);
  const disconnectAccount = useMutation(api.accounts.disconnectCurrentAccount);
  const searchParams = useSearchParams();

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-2xl w-full flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Account</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your Instagram professional account to enable automation.
          </p>
        </div>

        {searchParams.get("error") ? (
          <StatusBanner
            tone="error"
            message={decodeURIComponent(searchParams.get("error") ?? "")}
          />
        ) : null}

        {searchParams.get("warning") ? (
          <StatusBanner
            tone="warning"
            message={decodeURIComponent(searchParams.get("warning") ?? "")}
          />
        ) : null}

        {searchParams.get("connected") ? (
          <StatusBanner
            tone="success"
            message="Instagram account connected successfully."
          />
        ) : null}

        {data?.account ? (
          <ConnectedState
            account={data.account}
            onDisconnect={() => void disconnectAccount({})}
          />
        ) : (
          <NotConnectedState
            isMetaConfigured={Boolean(data?.isMetaConfigured)}
          />
        )}
      </div>
    </main>
  );
}

function NotConnectedState({
  isMetaConfigured,
}: {
  isMetaConfigured: boolean;
}) {
  return (
    <>
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
          <Link
            href={isMetaConfigured ? "/api/meta/connect" : "/dashboard/account"}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity ${
              isMetaConfigured
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-primary/50 text-primary-foreground pointer-events-none cursor-not-allowed"
            }`}
          >
            <AtSign className="size-4" />
            Connect with Instagram
          </Link>
          <p className="text-xs text-muted-foreground">
            {isMetaConfigured
              ? "Instagram Login for one professional account."
              : "Set META_APP_ID, META_APP_SECRET, and META_VERIFY_TOKEN first."}
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
            href="https://developers.facebook.com/docs/messenger-platform/instagram/get-started"
            target="_blank"
            rel="noreferrer"
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

function ConnectedState({
  account,
  onDisconnect,
}: {
  account: ConnectedAccount;
  onDisconnect: () => void;
}) {
  const refreshProfile = useAction(api.meta.oauth.refreshProfilePicture);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile({});
    } catch {
      // Silently fail — the UI will still show the fallback avatar
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 flex items-center gap-4">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-foreground shrink-0 overflow-hidden">
            {account.profilePictureUrl ? (
              <img
                src={account.profilePictureUrl}
                alt={account.username ?? "Instagram"}
                className="size-12 rounded-full object-cover"
              />
            ) : (
              (account.username?.[0] ?? "I").toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">
                @{account.username ?? account.instagramAccountId}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <CheckCircle2 className="size-3" />
                {account.webhookSubscriptionStatus === "active"
                  ? "Connected"
                  : "Needs attention"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {capitalize(account.accountType)} account ·{" "}
              {account.connectedAt
                ? `Connected ${formatDate(account.connectedAt)}`
                : "Connected"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh profile from Instagram"
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing" : "Refresh"}
            </button>
            <Link
              href="/api/meta/connect"
              className="text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Reconnect
            </Link>
          </div>
        </div>

        <div className="border-t border-border px-5 py-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Token expires</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {account.tokenExpiresAt
                ? formatDate(account.tokenExpiresAt)
                : "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Webhook status</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {capitalize(account.webhookSubscriptionStatus)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last webhook</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {account.lastWebhookAt
                ? formatDate(account.lastWebhookAt)
                : "Waiting"}
            </p>
          </div>
        </div>
      </div>

      {account.lastWebhookAt === null ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-3.5">
          <AlertTriangle className="size-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-amber-950">
              Waiting for the first Meta webhook
            </p>
            <p className="text-sm text-amber-900 leading-relaxed">
              This account token is connected, but Nudgra has not received any
              inbound webhook yet. Meta must send Instagram webhooks to the
              Convex callback URL, the app must be subscribed to Instagram
              webhooks, and Meta only sends webhook notifications while the app
              is in Live mode.
            </p>
            {CONVEX_WEBHOOK_CALLBACK_URL ? (
              <div className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  Callback URL
                </p>
                <code className="mt-1 block text-xs text-foreground break-all">
                  {CONVEX_WEBHOOK_CALLBACK_URL}
                </code>
                <p className="mt-1 text-xs text-amber-900/80">
                  Use your <code>META_VERIFY_TOKEN</code> as the verify token in
                  the Meta App Dashboard.
                </p>
              </div>
            ) : null}
            <a
              href={META_WEBHOOK_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-900 hover:underline w-fit"
            >
              Meta webhook setup docs
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      ) : null}

      {account.lastError ? (
        <StatusBanner tone="warning" message={account.lastError} />
      ) : null}

      <div className="bg-card border border-border rounded-xl p-5 flex gap-3.5">
        <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Disconnect account
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Removes the token and stops all automation. Reconnect later to
              resume.
            </p>
          </div>
          <button
            onClick={onDisconnect}
            className="shrink-0 text-sm font-medium text-destructive border border-destructive/30 rounded-lg px-3 py-1.5 hover:bg-destructive/5 transition-colors cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      </div>
    </>
  );
}

function StatusBanner({
  tone,
  message,
}: {
  tone: "success" | "warning" | "error";
  message: string;
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : tone === "warning"
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : "bg-destructive/5 border-destructive/20 text-foreground";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>
      {message}
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace("_", " ");
}
