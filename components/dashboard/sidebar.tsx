"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Activity,
  Plus,
  Settings2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  AccountAvatar,
  getAccountPrimaryLabel,
} from "@/components/dashboard/account-avatar";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/account", label: "Manage Accounts", icon: Settings2 },
  { href: "/dashboard/automations", label: "Automations", icon: Zap },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  {
    href: "/dashboard/conversations",
    label: "Conversations",
    icon: MessageSquare,
  },
  { href: "/dashboard/logs", label: "Logs", icon: Activity },
];

function getAccountTone(args: {
  status: string;
  reconnectRequired: boolean;
}) {
  if (args.status === "disconnected") {
    return {
      label: "Disconnected",
      classes: "border-border bg-muted text-muted-foreground",
      icon: AlertTriangle,
    };
  }

  if (args.reconnectRequired || args.status === "connection_error") {
    return {
      label: "Reconnect",
      classes: "border-amber-200 bg-amber-50 text-amber-900",
      icon: AlertTriangle,
    };
  }

  return {
    label: "Active",
    classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  };
}

export function DashboardSidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [openSwitcherPath, setOpenSwitcherPath] = useState<string | null>(
    null,
  );
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectAccount = useMutation(api.accounts.selectAccount);
  const switcherOpen = openSwitcherPath === pathname;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col border-r border-border bg-card transition-transform duration-300 lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-foreground/80"
            >
              nudgra
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-border px-4 py-4">
          <button
            type="button"
            onClick={() =>
              setOpenSwitcherPath((current) =>
                current === pathname ? null : pathname,
              )
            }
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left transition hover:bg-muted/40"
          >
            {accountContext?.selectedAccount ? (
              <AccountAvatar
                username={accountContext.selectedAccount.username}
                name={accountContext.selectedAccount.name}
                profilePictureUrl={accountContext.selectedAccount.profilePictureUrl}
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
                <AtSign className="size-4 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Active Account
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {accountContext?.selectedAccount
                  ? getAccountPrimaryLabel({
                      username: accountContext.selectedAccount.username,
                      name: accountContext.selectedAccount.name,
                      instagramAccountId:
                        accountContext.selectedAccount.instagramAccountId,
                    })
                  : "No connected account"}
              </p>
              <p className="text-xs text-muted-foreground">
                {accountContext?.selectedAccount
                  ? `Switch between ${accountContext.connectedAccounts} connected account${
                      accountContext.connectedAccounts === 1 ? "" : "s"
                    }`
                  : "Connect an Instagram account to start automating"}
              </p>
            </div>

            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                switcherOpen && "rotate-180",
              )}
            />
          </button>

          {switcherOpen ? (
            <div className="mt-3 rounded-2xl border border-border bg-background p-2 shadow-sm">
              <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
                {(accountContext?.accounts ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                    No Instagram accounts connected yet.
                  </div>
                ) : (
                  accountContext?.accounts.map((account) => {
                    const tone = getAccountTone({
                      status: account.status,
                      reconnectRequired: account.reconnectRequired,
                    });
                    const ToneIcon = tone.icon;
                    const isDisabled = account.status === "disconnected";

                    return (
                      <button
                        key={account.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) {
                            return;
                          }
                          void selectAccount({ accountId: account.id });
                          setOpenSwitcherPath(null);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                          account.isSelected
                            ? "bg-primary/8 ring-1 ring-primary/15"
                            : "hover:bg-muted/50",
                          isDisabled && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <AccountAvatar
                          username={account.username}
                          name={account.name}
                          profilePictureUrl={account.profilePictureUrl}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {getAccountPrimaryLabel({
                                username: account.username,
                                name: account.name,
                                instagramAccountId: account.instagramAccountId,
                              })}
                            </p>
                            {account.isSelected ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                tone.classes,
                              )}
                            >
                              <ToneIcon className="size-3" />
                              {tone.label}
                            </span>
                            {account.username ? (
                              <span className="truncate text-[11px] text-muted-foreground">
                                @{account.username}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                <Link
                  href="/dashboard/account"
                  className="flex-1 rounded-xl border border-border px-3 py-2 text-center text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  Manage accounts
                </Link>
                <Link
                  href="/api/meta/connect"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <Plus className="size-3.5" />
                  Add
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact
                ? pathname === href
                : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={() => void signOut().then(() => router.push("/"))}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
