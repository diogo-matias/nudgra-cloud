"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type AccountAvatarProps = {
  username?: string | null;
  name?: string | null;
  profilePictureUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  onImageError?: () => void;
};

const SIZE_CLASSES: Record<NonNullable<AccountAvatarProps["size"]>, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

function getFallbackLabel(args: {
  username?: string | null;
  name?: string | null;
}) {
  const source = args.username?.trim() || args.name?.trim() || "Instagram";
  return source.slice(0, 1).toUpperCase();
}

export function getAccountPrimaryLabel(args: {
  username?: string | null;
  name?: string | null;
  instagramAccountId?: string | null;
}) {
  return args.username?.trim() || args.name?.trim() || args.instagramAccountId || "Instagram account";
}

export function AccountAvatar({
  username,
  name,
  profilePictureUrl,
  size = "md",
  className,
  onImageError,
}: AccountAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const shouldShowImage =
    Boolean(profilePictureUrl) && failedImageUrl !== profilePictureUrl;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-muted text-sm font-semibold text-foreground shadow-sm",
        sizeClass,
        className,
      )}
    >
      {shouldShowImage ? (
        <Image
          src={profilePictureUrl!}
          alt={getAccountPrimaryLabel({ username, name })}
          fill
          sizes={size === "sm" ? "32px" : size === "md" ? "40px" : "48px"}
          className="object-cover"
          onError={() => {
            setFailedImageUrl(profilePictureUrl ?? null);
            onImageError?.();
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {getFallbackLabel({ username, name })}
        </div>
      )}
    </div>
  );
}
