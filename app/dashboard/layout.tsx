"use client";

import Link from "next/link";
import { useConvexAuth, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const ensureWorkspace = useMutation(api.workspaces.ensureCurrentWorkspace);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void ensureWorkspace({});
    }
  }, [ensureWorkspace, isAuthenticated, isLoading]);

  if (isLoading || !isAuthenticated) {
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
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            nudgra
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
