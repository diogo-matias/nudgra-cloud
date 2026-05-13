"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { NudgraLogo } from "@/components/logo";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const ensureWorkspace = useMutation(api.workspaces.ensureCurrentWorkspace);
  const accessStatus = useQuery(
    api.workspaces.getOperatorAccessStatus,
    isAuthenticated ? {} : "skip",
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAccessLoading = isAuthenticated && accessStatus === undefined;
  const isAllowed = accessStatus?.isAllowed === true;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && isAllowed) {
      void ensureWorkspace({});
    }
  }, [ensureWorkspace, isAllowed, isAuthenticated, isLoading]);

  if (isLoading || !isAuthenticated || isAccessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <NudgraLogo size="lg" />
          <h1 className="mt-8 text-xl font-semibold text-foreground">
            Access denied
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {accessStatus?.email
              ? `${accessStatus.email} is not allowed to access this Nudgra deployment.`
              : "This Google account is not allowed to access this Nudgra deployment."}
          </p>
          <button
            type="button"
            onClick={() => void signOut().then(() => router.push("/signin"))}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/">
            <NudgraLogo size="sm" />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
