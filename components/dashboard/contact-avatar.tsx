"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const sizeClassMap = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
  xl: "size-20",
} as const;

const pixelSizeMap = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 80,
} as const;

export function getContactInitials(
  displayName: string | null,
  username: string | null,
) {
  const label = getContactDisplayName(displayName, username);
  const words = label.match(/[A-Za-z0-9]+/g) ?? [];

  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }

  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }

  return "IG";
}

export function getContactDisplayName(
  displayName: string | null,
  username: string | null,
) {
  const normalizedDisplayName = displayName?.trim();
  if (normalizedDisplayName) {
    return normalizedDisplayName;
  }

  const normalizedUsername = username?.trim();
  if (normalizedUsername) {
    return normalizedUsername;
  }

  return "Unknown contact";
}

export function getInstagramHandle(username: string | null) {
  const normalizedUsername = username?.trim();
  return normalizedUsername ? `@${normalizedUsername}` : null;
}

export function getInstagramProfileUrl(username: string | null) {
  const normalizedUsername = username?.trim();
  return normalizedUsername
    ? `https://www.instagram.com/${encodeURIComponent(normalizedUsername)}/`
    : null;
}

export function ContactAvatar({
  displayName,
  username,
  profilePictureUrl,
  size = "md",
  className,
}: {
  displayName: string | null;
  username: string | null;
  profilePictureUrl: string | null;
  size?: keyof typeof sizeClassMap;
  className?: string;
}) {
  const initials = getContactInitials(displayName, username);
  const label = getContactDisplayName(displayName, username);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-primary/8 text-primary ring-1 ring-border/50",
        sizeClassMap[size],
        className,
      )}
    >
      {profilePictureUrl ? (
        <Image
          src={profilePictureUrl}
          alt={label}
          fill
          sizes={`${pixelSizeMap[size]}px`}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[0.65rem] font-semibold tracking-wide">
          {initials}
        </div>
      )}
    </div>
  );
}
