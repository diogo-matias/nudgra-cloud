"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, ChevronLeft, Phone, Video, Image as ImageIcon, Send } from "lucide-react";
import type { LinkButtonConfig } from "@/components/dashboard/link-buttons-editor";

type StoryPreviewSelection = {
  id: string;
  mediaType: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
} | null;

type PreviewMessage = {
  side: "left" | "right";
  text: ReactNode;
  buttons?: Array<{ label: string }>;
  metaLabel?: string;
  isReaction?: boolean;
};

export function StoryAutomationPreview({
  config,
}: {
  config: {
    storyScope: "any" | "specific";
    selectedStory: StoryPreviewSelection;
    replyFilter: "specific_words_or_reactions" | "any_word_or_reaction";
    triggerTokens: string[];
    reactionEnabled: boolean;
    followGateEnabled: boolean;
    followGateText: string;
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
  const [activeTab, setActiveTab] = useState("story");
  const username = config.username || "youraccount";

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
              11:32
            </span>
            <div className="h-5 w-20 rounded-full bg-black" />
            <div className="flex items-center gap-1">
              <div className="flex items-end gap-[2px]">
                <div className="h-1.5 w-1 rounded-sm bg-white/60" />
                <div className="h-2 w-1 rounded-sm bg-white/60" />
                <div className="h-2.5 w-1 rounded-sm bg-white/60" />
                <div className="h-3 w-1 rounded-sm bg-white/80" />
              </div>
              <div className="ml-1 h-2.5 w-5 rounded-sm border border-white/60">
                <div className="m-px h-1.5 w-3.5 rounded-sm bg-white/80" />
              </div>
            </div>
          </div>

          <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[1.6rem] bg-black">
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="story" className="mt-0">
                <StoryView
                  username={username}
                  profilePictureUrl={config.profilePictureUrl}
                  selectedStory={config.selectedStory}
                  storyScope={config.storyScope}
                  triggerTokens={config.triggerTokens}
                  replyFilter={config.replyFilter}
                />
              </TabsContent>
              <TabsContent value="dm" className="mt-0">
                <DmView
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
          value="story"
          className="rounded-md px-4 py-1.5 text-xs text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          Story
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
      <img
        src={profilePictureUrl}
        alt="Profile"
        className={`${sizeClasses} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-br from-orange-400 to-pink-500 shrink-0`}
    />
  );
}

function StoryView({
  username,
  profilePictureUrl,
  selectedStory,
  storyScope,
  triggerTokens,
  replyFilter,
}: {
  username: string;
  profilePictureUrl?: string | null;
  selectedStory: StoryPreviewSelection;
  storyScope: "any" | "specific";
  triggerTokens: string[];
  replyFilter: "specific_words_or_reactions" | "any_word_or_reaction";
}) {
  const previewUrl = selectedStory?.thumbnailUrl || selectedStory?.mediaUrl || null;
  const replyExample =
    replyFilter === "specific_words_or_reactions"
      ? triggerTokens[0] || "link"
      : "Any reply";

  return (
    <div className="relative min-h-[540px]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
          <span className="text-xs font-semibold text-white">{username}</span>
        </div>
        <span className="text-xl leading-none text-white">×</span>
      </div>

      <div className="mx-4 h-0.5 rounded-full bg-white/20">
        <div className="h-full w-1/3 rounded-full bg-white" />
      </div>

      <div className="relative mt-4 h-[420px]">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Story preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#181818]">
            <ImageIcon className="size-12 text-white/15" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40" />

        <div className="absolute inset-x-0 bottom-12 px-8 text-center">
          <p className="text-3xl font-semibold leading-tight text-white">
            {storyScope === "specific" ? "This automation is locked to one story" : "Your automation will work for any story"}
          </p>
          <p className="mt-4 text-sm text-white/80">
            Replies like “{replyExample}” will trigger your DM flow.
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 py-4">
        <div className="flex-1 rounded-full border border-white/25 bg-black/35 px-4 py-2 text-left text-sm text-white/45">
          Send message...
        </div>
        <Heart className="size-5 text-white" />
        <Send className="size-5 text-white" />
      </div>
    </div>
  );
}

function buildMessages(config: {
  reactionEnabled: boolean;
  followGateEnabled: boolean;
  followGateText: string;
  emailCollectionEnabled: boolean;
  emailCollectionText: string;
  linkDmText: string;
  linkButtons: LinkButtonConfig[];
  followUpEnabled: boolean;
  followUpText: string;
}) {
  const messages: PreviewMessage[] = [
    { side: "right", text: "Reply to story" },
  ];

  if (config.reactionEnabled) {
    messages.push({
      side: "left",
      text: "❤️",
      isReaction: true,
    });
  }

  if (config.followGateEnabled && config.followGateText) {
    messages.push({
      side: "left",
      text: config.followGateText,
      buttons: [{ label: "I'm following" }],
    });
    messages.push({ side: "right", text: "I'm following" });
  }

  if (config.emailCollectionEnabled && config.emailCollectionText) {
    messages.push({
      side: "left",
      text: config.emailCollectionText,
    });
    messages.push({
      side: "right",
      text: "person@example.com",
    });
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
    reactionEnabled: boolean;
    followGateEnabled: boolean;
    followGateText: string;
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
              isReaction={message.isReaction}
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
  isReaction,
  profilePictureUrl,
}: {
  children: ReactNode;
  side: "left" | "right";
  buttons?: Array<{ label: string }>;
  isReaction?: boolean;
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
      {isReaction ? (
        <div className="size-5 shrink-0" />
      ) : (
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
      )}
      <div
        className={
          isReaction
            ? "text-2xl"
            : "max-w-[80%] rounded-2xl rounded-bl-md bg-[#262626] px-3 py-2"
        }
      >
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
