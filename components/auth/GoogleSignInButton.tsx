"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GoogleSignInButtonProps = {
  className?: string;
  errorClassName?: string;
  label?: string;
  redirectTo?: string;
};

export function GoogleSignInButton({
  className,
  errorClassName,
  label = "Sign in with Google",
  redirectTo = "/",
}: GoogleSignInButtonProps) {
  const { signIn } = useAuthActions();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setIsPending(true);
    setError(null);

    void signIn("google", { redirectTo }).catch((authError) => {
      setIsPending(false);
      setError(
        authError instanceof Error
          ? authError.message
          : "Google sign-in could not be started.",
      );
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "h-13 rounded-full border border-[#1c1712]/15 bg-white/90 px-6 text-sm font-semibold text-[#17110c] shadow-[0_14px_40px_rgba(37,26,16,0.12)] backdrop-blur-sm hover:bg-white",
          className,
        )}
      >
        <GoogleMark />
        {isPending ? "Redirecting to Google..." : label}
      </Button>
      {error ? (
        <p className={cn("text-sm text-[#8c2d1d]", errorClassName)}>{error}</p>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      role="img"
    >
      <path
        d="M21.805 12.23c0-.718-.064-1.407-.183-2.068H12v3.914h5.498a4.706 4.706 0 0 1-2.044 3.087v2.565h3.303c1.934-1.78 3.048-4.405 3.048-7.498Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.074-.915 6.766-2.472l-3.303-2.565c-.915.613-2.081.975-3.463.975-2.656 0-4.907-1.794-5.71-4.204H2.876v2.646A9.998 9.998 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.29 13.734A5.996 5.996 0 0 1 5.97 12c0-.602.11-1.186.32-1.734V7.62H2.876A9.999 9.999 0 0 0 2 12c0 1.615.387 3.145 1.074 4.38l3.216-2.646Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.062c1.5 0 2.845.516 3.905 1.53l2.928-2.929C17.069 3.02 14.756 2 12 2A9.998 9.998 0 0 0 2.876 7.62l3.414 2.646c.803-2.41 3.054-4.204 5.71-4.204Z"
        fill="#EA4335"
      />
    </svg>
  );
}
