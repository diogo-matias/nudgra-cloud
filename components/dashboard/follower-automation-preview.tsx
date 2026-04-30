"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { LinkButtonConfig } from "@/components/dashboard/link-buttons-editor";
import { ChevronLeft, Phone, UserPlus, Video } from "lucide-react";

type PreviewMessage = {
  side: "left" | "right";
  text: ReactNode;
  buttons?: Array<{ label: string }>;
  metaLabel?: string;
};

export function FollowerAutomationPreview({
  config,
}: {
  config: {
    welcomeDmText: string;
    emailCollectionEnabled: boolean;
    emailCollectionText: string;
    linkDmText: string;
    linkButtons: LinkButtonConfig[];
    followUpEnabled: boolean;
    followUpText: string;
    validationIssues?: string[];
    username?: string | null;
    profilePictureUrl?: string | null;
  };
}) {
  const username = config.username || "youraccount";

  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 text-xs font-medium text-muted-foreground">Preview</p>
      <div className="relative w-[300px]">
        <div className="rounded-[2.2rem] bg-[#1a1a1a] p-3 shadow-xl ring-1 ring-white/10">
          <div className="flex items-center justify-between px-4 pb-2 pt-1">
            <span className="text-[10px] font-medium tabular-nums text-white/80">
              11:32
            </span>
            <div className="h-5 w-20 rounded-full bg-black" />
            <div className="h-2.5 w-5 rounded-sm border border-white/60">
              <div className="m-px h-1.5 w-3.5 rounded-sm bg-white/80" />
            </div>
          </div>
          <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[1.6rem] bg-black">
            <DmView
              config={config}
              username={username}
              profilePictureUrl={config.profilePictureUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountAvatar({
  profilePictureUrl,
  size = "md",
}: {
  profilePictureUrl?: string | null;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "size-5" : "size-7";

  if (profilePictureUrl) {
    return (
      <div className={`relative shrink-0 overflow-hidden rounded-full ${sizeClasses}`}>
        <Image
          src={profilePictureUrl}
          alt="Profile"
          fill
          unoptimized
          sizes={size === "sm" ? "20px" : "28px"}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses} shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-pink-500`}
    />
  );
}

function buildMessages(config: {
  welcomeDmText: string;
  emailCollectionEnabled: boolean;
  emailCollectionText: string;
  linkDmText: string;
  linkButtons: LinkButtonConfig[];
  followUpEnabled: boolean;
  followUpText: string;
}) {
  const messages: PreviewMessage[] = [
    {
      side: "right",
      text: "Followed your account",
      metaLabel: "Follower event",
    },
  ];

  if (config.welcomeDmText) {
    messages.push({ side: "left", text: config.welcomeDmText });
  }

  if (config.emailCollectionEnabled && config.emailCollectionText) {
    messages.push({ side: "left", text: config.emailCollectionText });
    messages.push({ side: "right", text: "person@example.com" });
  }

  if (config.linkDmText || config.linkButtons.length > 0) {
    messages.push({
      side: "left",
      text: config.linkDmText || "Tap below to open your link.",
      buttons: config.linkButtons.map((button) => ({ label: button.label })),
    });
  }

  if (
    config.followUpEnabled &&
    config.followUpText &&
    config.linkButtons.length > 0
  ) {
    messages.push({
      side: "left",
      text: config.followUpText,
      metaLabel: "6 hours later if no click is tracked",
    });
  }

  return messages;
}

function DmView({
  config,
  username,
  profilePictureUrl,
}: {
  config: {
    welcomeDmText: string;
    emailCollectionEnabled: boolean;
    emailCollectionText: string;
    linkDmText: string;
    linkButtons: LinkButtonConfig[];
    followUpEnabled: boolean;
    followUpText: string;
    validationIssues?: string[];
  };
  username: string;
  profilePictureUrl?: string | null;
}) {
  const messages = buildMessages(config);

  return (
    <div className="flex min-h-[540px] flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <ChevronLeft className="size-5 shrink-0 text-white" />
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="md" />
        <span className="flex-1 text-xs font-semibold text-white">
          {username}
        </span>
        <Phone className="size-4 shrink-0 text-white/60" />
        <Video className="size-4 shrink-0 text-white/60" />
      </div>

      <div className="flex flex-1 flex-col justify-end px-3 py-3">
        {config.validationIssues && config.validationIssues.length > 0 ? (
          <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-400/10 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Blocked configuration
            </p>
            <div className="mt-1 flex flex-col gap-1">
              {config.validationIssues.map((issue) => (
                <p
                  key={issue}
                  className="text-[11px] leading-relaxed text-amber-100/90"
                >
                  {issue}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wide text-white/35">
          <UserPlus className="size-3" />
          New follower
        </div>

        {messages.map((message) => (
          <div key={`${message.side}-${String(message.text)}`} className="mb-3">
            {message.metaLabel ? (
              <p className="mb-2 text-center text-[10px] uppercase tracking-wide text-white/35">
                {message.metaLabel}
              </p>
            ) : null}
            <MessageBubble
              side={message.side}
              profilePictureUrl={profilePictureUrl}
              buttons={message.buttons}
            >
              {message.text}
            </MessageBubble>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
        <div className="flex-1 rounded-full bg-white/6 px-4 py-2 text-[11px] text-white/40">
          Message...
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  children,
  side,
  buttons,
  profilePictureUrl,
}: {
  children: ReactNode;
  side: "left" | "right";
  buttons?: Array<{ label: string }>;
  profilePictureUrl?: string | null;
}) {
  if (side === "right") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#2c2c2c] px-3 py-2">
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-white">
            {children}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1.5">
      <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
      <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-[#262626] px-3 py-2">
        <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-white">
          {children}
        </p>
        {buttons && buttons.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {buttons.map((button) => (
              <div
                key={button.label}
                className="rounded-xl border border-white/8 bg-white/8 px-3 py-2.5 text-center text-[11px] font-semibold text-white"
              >
                {button.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
