"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function SignIn() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-semibold text-2xl tracking-tight text-foreground">
            nudgra
          </span>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground mb-1">
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Continue to your Nudgra workspace
          </p>

          <GoogleSignInButton
            redirectTo="/dashboard"
            label="Continue with Google"
            className="w-full justify-center"
          />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By signing in you agree to use this product responsibly.
        </p>
      </div>
    </div>
  );
}
