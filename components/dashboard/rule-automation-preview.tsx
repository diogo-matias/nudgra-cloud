"use client";
/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import type { LinkButtonConfig } from "@/components/dashboard/link-buttons-editor";
import { ChevronLeft, Phone, Video } from "lucide-react";

type PreviewButton = {
  label: string;
};

type PreviewMessage = {
  side: "left" | "right";
  text: ReactNode;
  buttons?: PreviewButton[];
  metaLabel?: string;
};

export type RuleAutomationPreviewConfig = {
  triggerKeywords: string[];
  followGateEnabled: boolean;
  followGateText: string;
  emailCollectionEnabled: boolean;
  emailCollectionText: string;
  linkDmText: string;
  linkButtons: LinkButtonConfig[];
  followUpEnabled?: boolean;
  followUpText?: string;
  validationIssues?: string[];
  username?: string | null;
  profilePictureUrl?: string | null;
};

const FOLLOW_GATE_BUTTONS: PreviewButton[] = [{ label: "I'm following" }];

function AccountAvatar({
  profilePictureUrl,
  size = "md",
}: {
  profilePictureUrl?: string | null;
  size?: "sm" | "md";
}) {
  const sizeClasses = {
    sm: "size-5",
    md: "size-7",
  };

  if (profilePictureUrl) {
    return (
      <img
        src={profilePictureUrl}
        alt="Profile"
        className={`${sizeClasses[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} shrink-0 rounded-full bg-gradient-to-br from-pink-500 to-orange-400`}
    />
  );
}

function buildMessages(config: RuleAutomationPreviewConfig): PreviewMessage[] {
  const messages: PreviewMessage[] = [];

  if (config.followGateEnabled && config.followGateText) {
    messages.push({
      side: "left",
      text: config.followGateText,
      buttons: FOLLOW_GATE_BUTTONS,
    });
    messages.push({ side: "right", text: "I'm following" });
  }

  if (config.emailCollectionEnabled && config.emailCollectionText) {
    messages.push({ side: "left", text: config.emailCollectionText });
    messages.push({ side: "right", text: "example@mail.com" });
  }

  if (config.linkDmText || config.linkButtons.length > 0) {
    messages.push({
      side: "left",
      text: config.linkDmText || "Tap below to open your link.",
      buttons:
        config.linkButtons.length > 0
          ? config.linkButtons.map((button) => ({ label: button.label }))
          : undefined,
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

  if (messages.length === 0) {
    messages.push({
      side: "left",
      text:
        config.triggerKeywords.length > 0
          ? `Someone DMs "${config.triggerKeywords[0]}"`
          : "Your DM flow preview will appear here.",
    });
  }

  return messages;
}

export function RuleAutomationPreview({
  config,
}: {
  config: RuleAutomationPreviewConfig;
}) {
  const username = config.username || "youraccount";
  const messages = buildMessages(config);

  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 text-xs font-medium text-muted-foreground">Preview</p>

      <div className="relative w-[300px]">
        <div className="rounded-[2.2rem] bg-[#1a1a1a] p-3 shadow-xl ring-1 ring-white/10">
          <div className="flex items-center justify-between px-4 pt-1 pb-2">
            <span className="text-[10px] font-medium tabular-nums text-white/80">
              9:41
            </span>
            <div className="h-5 w-20 rounded-full bg-black" />
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5">
                <div className="h-1.5 w-1 rounded-sm bg-white/60" />
                <div className="h-2 w-1 rounded-sm bg-white/60" />
                <div className="h-2.5 w-1 rounded-sm bg-white/60" />
                <div className="h-3 w-1 rounded-sm bg-white/80" />
              </div>
              <div className="ml-0.5 h-2.5 w-5 rounded-sm border border-white/60">
                <div className="m-px h-1.5 w-3.5 rounded-sm bg-white/80" />
              </div>
            </div>
          </div>

          <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[1.6rem] bg-black">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <ChevronLeft className="size-5 shrink-0 text-white" />
              <AccountAvatar
                profilePictureUrl={config.profilePictureUrl}
                size="md"
              />
              <span className="flex-1 text-xs font-semibold text-white">
                {username}
              </span>
              <Phone className="size-4 shrink-0 text-white/60" />
              <Video className="ml-1 size-4 shrink-0 text-white/60" />
            </div>

            <div className="flex flex-1 flex-col justify-end overflow-y-auto px-3 py-3">
              <div className="flex flex-col">
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

                {messages.map((message, index) => {
                  const next = messages[index + 1];
                  const isLastInGroup =
                    message.side === "left" && (!next || next.side !== "left");
                  const sameGroupAsNext = next && next.side === message.side;

                  return (
                    <div key={index} className={sameGroupAsNext ? "mb-1" : "mb-3"}>
                      {message.metaLabel ? (
                        <p className="mb-2 text-center text-[10px] uppercase tracking-wide text-white/35">
                          {message.metaLabel}
                        </p>
                      ) : null}
                      <MessageBubble
                        side={message.side}
                        avatar={isLastInGroup}
                        buttons={message.buttons}
                        profilePictureUrl={config.profilePictureUrl}
                      >
                        {message.text}
                      </MessageBubble>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-blue-400">
                <svg
                  className="size-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13" r="4" strokeWidth="2" />
                </svg>
              </div>
              <span className="flex-1 text-[11px] text-white/40">Message...</span>
              <div className="flex items-center gap-2.5 text-white/40">
                <svg
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="2"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                    fill="currentColor"
                    stroke="none"
                  />
                  <path
                    d="M4 15l4-4 3 3 5-5 4 4"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <svg
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <svg
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    d="M12 3v18m9-9H3"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  children,
  side,
  avatar,
  buttons,
  profilePictureUrl,
}: {
  children: ReactNode;
  side: "left" | "right";
  avatar?: boolean;
  buttons?: PreviewButton[];
  profilePictureUrl?: string | null;
}) {
  if (side === "right") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-violet-600 px-3 py-2">
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-white">
            {children}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1.5">
      {avatar ? (
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
      ) : (
        <div className="size-5 shrink-0" />
      )}
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
