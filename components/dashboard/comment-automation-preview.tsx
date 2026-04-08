"use client";

import { useState } from "react";
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
  // Comment reply
  commentReplyEnabled: boolean;
  commentReplyTexts: string[];
  triggerKeywords: string[];

  // Opening DM
  openingDmEnabled: boolean;
  openingDmText: string;
  openingDmButtonText: string;

  // Follow gate
  followGateEnabled: boolean;
  followGateText: string;

  // Email collection
  emailCollectionEnabled: boolean;
  emailCollectionText: string;

  // Link delivery
  linkDmText: string;
  linkUrl: string;

  // Selected post info
  selectedPostThumbnail?: string | null;
  selectedPostCaption?: string | null;
  username?: string;
  profilePictureUrl?: string | null;
};

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
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0`}
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
      {/* Preview label */}
      <p className="text-xs text-muted-foreground mb-3 font-medium">Preview</p>

      {/* Phone mockup */}
      <div className="relative w-[300px]">
        {/* Phone frame */}
        <div className="bg-[#1a1a1a] rounded-[2.2rem] p-3 shadow-xl ring-1 ring-white/10">
          {/* Notch area */}
          <div className="flex items-center justify-between px-4 pt-1 pb-2">
            <span className="text-[10px] text-white/80 font-medium tabular-nums">
              9:41
            </span>
            <div className="w-20 h-5 bg-black rounded-full" />
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5">
                <div className="w-1 h-1.5 bg-white/60 rounded-sm" />
                <div className="w-1 h-2 bg-white/60 rounded-sm" />
                <div className="w-1 h-2.5 bg-white/60 rounded-sm" />
                <div className="w-1 h-3 bg-white/80 rounded-sm" />
              </div>
              <svg
                className="size-3 text-white/60 ml-0.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <div className="w-5 h-2.5 border border-white/60 rounded-sm ml-0.5">
                <div className="w-3.5 h-1.5 bg-white/80 rounded-sm m-px" />
              </div>
            </div>
          </div>

          {/* Screen content */}
          <div className="bg-black rounded-[1.6rem] overflow-hidden min-h-[560px] flex flex-col">
            {/* Tab content area */}
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

      {/* Tab switcher — outside the phone frame */}
      <TabsList className="mt-4 bg-muted/60 rounded-lg h-auto p-1 gap-1">
        <TabsTrigger
          value="post"
          className="rounded-md text-xs px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground"
        >
          Post
        </TabsTrigger>
        <TabsTrigger
          value="comments"
          className="rounded-md text-xs px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground"
        >
          Comments
        </TabsTrigger>
        <TabsTrigger
          value="dm"
          className="rounded-md text-xs px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground"
        >
          DM
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// ── Post preview tab ─────────────────────────────────────────────

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
      {/* Header bar */}
      <div className="flex items-center px-3 py-2 border-b border-white/10">
        <ChevronLeft className="size-5 text-white mr-2" />
        <div className="flex-1 flex flex-col items-center">
          <span className="text-[9px] text-white/50 uppercase tracking-wider font-medium">
            {username.toUpperCase()}
          </span>
          <span className="text-xs text-white font-semibold">Posts</span>
        </div>
        <div className="size-5" />
      </div>

      {/* Post header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="md" />
        <span className="text-xs text-white font-medium flex-1">
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

      {/* Post image */}
      <div className="relative w-full h-[200px] bg-[#262626] flex items-center justify-center overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Post"
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="size-12 text-white/20" />
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Heart className="size-5 text-white" />
          <MessageCircle className="size-5 text-white" />
          <Send className="size-5 text-white" />
        </div>
        <Bookmark className="size-5 text-white" />
      </div>

      {/* Likes */}
      <div className="px-3 pb-1">
        <p className="text-[11px] text-white font-semibold">94 likes</p>
      </div>

      {/* Caption */}
      <div className="px-3 pb-3">
        <p className="text-[11px] text-white/80 leading-relaxed line-clamp-2">
          <span className="font-semibold text-white">{username}</span>{" "}
          {caption || "Your post caption will appear here..."}
        </p>
      </div>
    </div>
  );
}

// ── Comments preview tab ─────────────────────────────────────────

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
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-white/10">
        <ChevronLeft className="size-5 text-white mr-2" />
        <div className="flex-1 flex flex-col items-center">
          <span className="text-[9px] text-white/50 uppercase tracking-wider font-medium">
            {username.toUpperCase()}
          </span>
          <span className="text-xs text-white font-semibold">Comments</span>
        </div>
        <Send className="size-4 text-white/60" />
      </div>

      {/* Comment list */}
      <div className="px-3 py-3 flex flex-col gap-4">
        {/* User comment */}
        <div className="flex gap-2">
          <div className="size-7 rounded-full bg-[#404040] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white leading-relaxed">
              <span className="font-semibold">user</span>{" "}
              <span className="text-white/40 text-[10px]">Now</span>
            </p>
            <p className="text-[11px] text-white mt-0.5">{commentKeyword}</p>
            <p className="text-[10px] text-white/40 mt-1">Reply</p>
          </div>
          <Heart className="size-3 text-white/40 shrink-0 mt-1" />
        </div>

        {/* Auto-reply */}
        {replyEnabled && (
          <div className="flex gap-2 pl-9">
            <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white leading-relaxed">
                <span className="font-semibold">{username}</span>{" "}
                <span className="text-white/40 text-[10px]">Now</span>
              </p>
              <p className="text-[11px] text-white mt-0.5">{replyText}</p>
              <p className="text-[10px] text-white/40 mt-1">Reply</p>
            </div>
            <Heart className="size-3 text-white/40 shrink-0 mt-1" />
          </div>
        )}
      </div>

      {/* Emoji bar */}
      <div className="flex items-center justify-center gap-3 py-3 border-t border-white/10 mt-auto">
        {[
          "\u2764\uFE0F",
          "\uD83D\uDE4C",
          "\uD83D\uDD25",
          "\uD83D\uDC4F",
          "\uD83D\uDE22",
          "\uD83D\uDE0D",
          "\uD83D\uDE2E",
          "\uD83D\uDE02",
        ].map((emoji) => (
          <span key={emoji} className="text-base">
            {emoji}
          </span>
        ))}
      </div>

      {/* Comment input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
        <span className="text-[11px] text-white/40 flex-1">
          Add a comment for {username}...
        </span>
      </div>
    </div>
  );
}

// ── DM preview tab ───────────────────────────────────────────────

type Msg = {
  side: "left" | "right";
  text: React.ReactNode;
  isButton?: boolean;
};

function buildDmMessages(config: PreviewConfig): Msg[] {
  const msgs: Msg[] = [];

  if (config.openingDmEnabled && config.openingDmText) {
    msgs.push({ side: "left", text: config.openingDmText });

    if (config.openingDmButtonText) {
      msgs.push({
        side: "left",
        text: config.openingDmButtonText,
        isButton: true,
      });
      msgs.push({ side: "right", text: config.openingDmButtonText });
    }
  }

  if (config.emailCollectionEnabled && config.emailCollectionText) {
    msgs.push({ side: "left", text: config.emailCollectionText });
    msgs.push({ side: "right", text: "example@mail.com" });
  }

  if (config.followGateEnabled && config.followGateText) {
    msgs.push({ side: "left", text: config.followGateText });
    msgs.push({ side: "left", text: "Following", isButton: true });
    msgs.push({ side: "right", text: "Following" });
  }

  if (config.linkDmText) {
    msgs.push({
      side: "left",
      text: (
        <>
          {config.linkDmText}
          {config.linkUrl && (
            <>
              {"\n\n"}
              <span className="text-blue-400 underline">{config.linkUrl}</span>
            </>
          )}
        </>
      ),
    });
  }

  return msgs;
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
    <div className="flex flex-col min-h-[440px]">
      {/* DM Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <ChevronLeft className="size-5 text-white shrink-0" />
        <AccountAvatar profilePictureUrl={profilePictureUrl} size="md" />
        <span className="text-xs text-white font-semibold flex-1">
          {username}
        </span>
        <Phone className="size-4 text-white/60 shrink-0" />
        <Video className="size-4 text-white/60 shrink-0 ml-1" />
      </div>

      {/* Messages — stack from bottom like real Instagram */}
      <div className="flex-1 px-3 py-3 flex flex-col justify-end overflow-y-auto">
        <div className="flex flex-col">
          {messages.map((msg, i) => {
            const next = messages[i + 1];
            // Show avatar only on the last left-side message before a
            // direction change (or the very last message).
            const isLastInGroup =
              msg.side === "left" && (!next || next.side !== "left");
            // Tighter gap between consecutive same-sender messages.
            const sameGroupAsNext = next && next.side === msg.side;

            return (
              <div key={i} className={sameGroupAsNext ? "mb-1" : "mb-3"}>
                <MessageBubble
                  side={msg.side}
                  avatar={isLastInGroup}
                  isButton={msg.isButton}
                  profilePictureUrl={profilePictureUrl}
                >
                  {msg.text}
                </MessageBubble>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/10">
        <div className="size-6 rounded-full bg-gradient-to-tr from-blue-500 to-blue-400 flex items-center justify-center shrink-0">
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
        <span className="text-[11px] text-white/40 flex-1">Message...</span>
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

// ── Message bubble component ─────────────────────────────────────

function MessageBubble({
  children,
  side,
  avatar,
  isButton,
  profilePictureUrl,
}: {
  children: React.ReactNode;
  side: "left" | "right";
  avatar?: boolean;
  isButton?: boolean;
  profilePictureUrl?: string | null;
}) {
  if (side === "right") {
    return (
      <div className="flex justify-end">
        <div className="bg-purple-600 rounded-2xl rounded-br-md px-3 py-2 max-w-[80%]">
          <p className="text-[11px] text-white whitespace-pre-wrap leading-relaxed">
            {children}
          </p>
        </div>
      </div>
    );
  }

  if (isButton) {
    return (
      <div className="flex items-end gap-1.5">
        {avatar ? (
          <AccountAvatar profilePictureUrl={profilePictureUrl} size="sm" />
        ) : (
          <div className="size-5 shrink-0" />
        )}
        <div className="border border-white/20 rounded-2xl px-3 py-2 max-w-[80%]">
          <p className="text-[11px] text-white text-center">{children}</p>
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
      <div className="bg-[#262626] rounded-2xl rounded-bl-md px-3 py-2 max-w-[80%]">
        <p className="text-[11px] text-white whitespace-pre-wrap leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  );
}
