"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { LinkButtonConfig } from "@/components/dashboard/link-buttons-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Image as ImageIcon,
  ChevronLeft,
  Phone,
  Video,
} from "lucide-react";

type PreviewConfig = {
  commentReplyEnabled: boolean;
  commentReplyTexts: string[];
  triggerKeywords: string[];
  openingDmEnabled: boolean;
  openingDmText: string;
  openingDmButtonText: string;
  followGateEnabled: boolean;
  followGateText: string;
  emailCollectionEnabled: boolean;
  emailCollectionText: string;
  linkDmText: string;
  linkButtons: LinkButtonConfig[];
  followUpEnabled?: boolean;
  followUpText?: string;
  validationIssues?: string[];
  selectedPostThumbnail?: string | null;
  selectedPostCaption?: string | null;
  username?: string;
  profilePictureUrl?: string | null;
};

type PreviewButton = {
  label: string;
};

type PreviewMessage = {
  side: "left" | "right";
  text: ReactNode;
  buttons?: PreviewButton[];
  metaLabel?: string;
};

const FOLLOW_GATE_BUTTONS: PreviewButton[] = [{ label: "I'm following" }];

function AccountAvatar({
  profilePictureUrl,
  size = "md",
}: {
  profilePictureUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "size-5",
    md: "size-7",
    lg: "size-8",
  };

  if (profilePictureUrl) {
    return (
      <img
        src={profilePictureUrl}
        alt="Profile"
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-linear-to-br from-purple-500 to-pink-500 shrink-0`}
    />
  );
}

export function CommentAutomationPreview({
  config,
}: {
  config: PreviewConfig;
}) {
  const [activeTab, setActiveTab] = useState("dm");
  const username = config.username || "youraccount";
  const commentKeyword =
    config.triggerKeywords.length > 0 ? config.triggerKeywords[0] : "link";
  const replyText =
    config.commentReplyTexts.length > 0
      ? config.commentReplyTexts[0]
      : "Thanks! Check your DMs.";

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex flex-col items-center"
    >
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
              <svg
                className="ml-0.5 size-3 text-white/60"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <div className="ml-0.5 h-2.5 w-5 rounded-sm border border-white/60">
                <div className="m-px h-1.5 w-3.5 rounded-sm bg-white/80" />
              </div>
            </div>
          </div>

          <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[1.6rem] bg-black">
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="post" className="mt-0 flex-1">
                <PostPreview
                  username={username}
                  profilePictureUrl={config.profilePictureUrl}
                  thumbnail={config.selectedPostThumbnail}
                  caption={config.selectedPostCaption}
                />
              </TabsContent>

              <TabsContent value="comments" className="mt-0 flex-1">
                <CommentsPreview
                  username={username}
                  profilePictureUrl={config.profilePictureUrl}
                  commentKeyword={commentKeyword}
                  replyEnabled={config.commentReplyEnabled}
                  replyText={replyText}
                />
              </TabsContent>

              <TabsContent value="dm" className="mt-0 flex-1">
                <DmPreview
                  config={config}
                  username={username}
                  profilePictureUrl={config.profilePictureUrl}
                />
              </TabsContent>
            </div>
          </div>
        </div>
      </div>

      <TabsList className="mt-4 h-auto gap-1 rounded-lg bg-muted/60 p-1">
        <TabsTrigger
          value="post"
          className="rounded-md px-4 py-1.5 text-xs text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          Post
        </TabsTrigger>
        <TabsTrigger
          value="comments"
          className="rounded-md px-4 py-1.5 text-xs text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          Comments
        </TabsTrigger>
        <TabsTrigger
          value="dm"
          className="rounded-md px-4 py-1.5 text-xs text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          DM
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function PostPreview({
  username,
  profilePictureUrl,
  thumbnail,
  caption,
}: {
  username: string;
  profilePictureUrl?: string | null;
  thumbnail?: string | null;
  caption?: string | null;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center border-b border-white/10 px-3 py-2">
        <ChevronLeft className="mr-2 size-5 text-white" />
        <div className="flex flex-1 flex-col items-center">
          <span className="text-[9px] font-medium tracking-wider text-white/50 uppercase">
            {username.toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-white">Posts</span>
        </div>
        <div className="size-5" />
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="md" />
        <span className="flex-1 text-xs font-medium text-white">
          {username}
        </span>
        <svg
          className="size-4 text-white/60"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </div>

      <div className="relative flex h-[200px] w-full items-center justify-center overflow-hidden bg-[#262626]">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Post"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="size-12 text-white/20" />
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Heart className="size-5 text-white" />
          <MessageCircle className="size-5 text-white" />
          <Send className="size-5 text-white" />
        </div>
        <Bookmark className="size-5 text-white" />
      </div>

      <div className="px-3 pb-1">
        <p className="text-[11px] font-semibold text-white">94 likes</p>
      </div>

      <div className="px-3 pb-3">
        <p className="line-clamp-2 text-[11px] leading-relaxed text-white/80">
          <span className="font-semibold text-white">{username}</span>{" "}
          {caption || "Your post caption will appear here..."}
        </p>
      </div>
    </div>
  );
}

function CommentsPreview({
  username,
  profilePictureUrl,
  commentKeyword,
  replyEnabled,
  replyText,
}: {
  username: string;
  profilePictureUrl?: string | null;
  commentKeyword: string;
  replyEnabled: boolean;
  replyText: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center border-b border-white/10 px-3 py-2">
        <ChevronLeft className="mr-2 size-5 text-white" />
        <div className="flex flex-1 flex-col items-center">
          <span className="text-[9px] font-medium tracking-wider text-white/50 uppercase">
            {username.toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-white">Comments</span>
        </div>
        <Send className="size-4 text-white/60" />
      </div>

      <div className="flex flex-col gap-4 px-3 py-3">
        <div className="flex gap-2">
          <div className="size-7 shrink-0 rounded-full bg-[#404040]" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] leading-relaxed text-white">
              <span className="font-semibold">user</span>{" "}
              <span className="text-[10px] text-white/40">Now</span>
            </p>
            <p className="mt-0.5 text-[11px] text-white">{commentKeyword}</p>
            <p className="mt-1 text-[10px] text-white/40">Reply</p>
          </div>
          <Heart className="mt-1 size-3 shrink-0 text-white/40" />
        </div>

        {replyEnabled && (
          <div className="flex gap-2 pl-9">
            <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-relaxed text-white">
                <span className="font-semibold">{username}</span>{" "}
                <span className="text-[10px] text-white/40">Now</span>
              </p>
              <p className="mt-0.5 text-[11px] text-white">{replyText}</p>
              <p className="mt-1 text-[10px] text-white/40">Reply</p>
            </div>
            <Heart className="mt-1 size-3 shrink-0 text-white/40" />
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-center gap-3 border-t border-white/10 py-3">
        {["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"].map((emoji) => (
          <span key={emoji} className="text-base">
            {emoji}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
        <span className="flex-1 text-[11px] text-white/40">
          Add a comment for {username}...
        </span>
      </div>
    </div>
  );
}

function buildDmMessages(config: PreviewConfig): PreviewMessage[] {
  const messages: PreviewMessage[] = [];
  const initialMetaLabel = "Private reply after comment";

  if (config.openingDmEnabled && config.openingDmText) {
    messages.push({
      side: "left",
      text: config.openingDmText,
      metaLabel: initialMetaLabel,
      buttons: config.openingDmButtonText
        ? [{ label: config.openingDmButtonText }]
        : undefined,
    });

    if (config.openingDmButtonText) {
      messages.push({
        side: "right",
        text: config.openingDmButtonText,
      });
    }
  }

  if (config.followGateEnabled && config.followGateText) {
    messages.push({
      side: "left",
      text: config.followGateText,
      metaLabel: messages.length === 0 ? initialMetaLabel : undefined,
      buttons: FOLLOW_GATE_BUTTONS,
    });
    messages.push({ side: "right", text: "I'm following" });
  }

  if (config.emailCollectionEnabled && config.emailCollectionText) {
    messages.push({
      side: "left",
      text: config.emailCollectionText,
      metaLabel: messages.length === 0 ? initialMetaLabel : undefined,
    });
    messages.push({ side: "right", text: "example@mail.com" });
  }

  if (config.linkDmText || config.linkButtons.length > 0) {
    messages.push({
      side: "left",
      text: config.linkDmText || "Tap below to open your link.",
      metaLabel: messages.length === 0 ? initialMetaLabel : undefined,
      buttons: config.linkButtons.length > 0
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

  return messages;
}

function DmPreview({
  config,
  username,
  profilePictureUrl,
}: {
  config: PreviewConfig;
  username: string;
  profilePictureUrl?: string | null;
}) {
  const messages = buildDmMessages(config);

  return (
    <div className="flex min-h-[440px] flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <ChevronLeft className="size-5 shrink-0 text-white" />
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="md" />
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
                  <p key={issue} className="text-[11px] leading-relaxed text-amber-100/90">
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
                  profilePictureUrl={profilePictureUrl}
                >
                  {message.text}
                </MessageBubble>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-linear-to-tr from-blue-500 to-blue-400">
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
            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.5" />
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
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-purple-600 px-3 py-2">
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
