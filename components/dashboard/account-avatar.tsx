"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type AccountAvatarProps = {
  username?: string | null;
  name?: string | null;
  profilePictureUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
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
}: AccountAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-muted text-sm font-semibold text-foreground shadow-sm",
        sizeClass,
        className,
      )}
    >
      {profilePictureUrl ? (
        <Image
          src={profilePictureUrl}
          alt={getAccountPrimaryLabel({ username, name })}
          fill
          sizes={size === "sm" ? "32px" : size === "md" ? "40px" : "48px"}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {getFallbackLabel({ username, name })}
        </div>
      )}
    </div>
  );
}
