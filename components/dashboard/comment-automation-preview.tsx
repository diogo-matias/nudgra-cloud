"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Image as ImageIcon,
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
};

export function CommentAutomationPreview({
  config,
}: {
  config: PreviewConfig;
}) {
  const [activeTab, setActiveTab] = useState("post");
  const username = config.username || "youraccount";
  const commentKeyword =
    config.triggerKeywords.length > 0 ? config.triggerKeywords[0] : "link";
  const replyText =
    config.commentReplyTexts.length > 0
      ? config.commentReplyTexts[0]
      : "Thanks! Check your DMs.";

  return (
    <div className="flex flex-col items-center">
      {/* Preview label */}
      <p className="text-xs text-muted-foreground mb-3 font-medium">Preview</p>

      {/* Phone mockup */}
      <div className="relative w-[300px]">
        {/* Phone frame */}
        <div className="bg-[#1a1a1a] rounded-[2.2rem] p-3 shadow-xl ring-1 ring-white/10">
          {/* Notch area */}
          <div className="flex items-center justify-between px-4 pt-1 pb-2">
            <span className="text-[10px] text-white/80 font-medium tabular-nums">
              5:22
            </span>
            <div className="w-20 h-5 bg-black rounded-full" />
            <div className="flex items-center gap-1">
              <div className="w-3.5 h-2 border border-white/60 rounded-sm">
                <div className="w-2 h-1 bg-white/80 rounded-sm m-px" />
              </div>
            </div>
          </div>

          {/* Screen content */}
          <div className="bg-black rounded-[1.6rem] overflow-hidden min-h-[480px] flex flex-col">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-col flex-1"
            >
              {/* Tab content area */}
              <div className="flex-1 overflow-y-auto">
                <TabsContent value="post" className="mt-0 flex-1">
                  <PostPreview
                    username={username}
                    thumbnail={config.selectedPostThumbnail}
                    caption={config.selectedPostCaption}
                  />
                </TabsContent>

                <TabsContent value="comments" className="mt-0 flex-1">
                  <CommentsPreview
                    username={username}
                    commentKeyword={commentKeyword}
                    replyEnabled={config.commentReplyEnabled}
                    replyText={replyText}
                  />
                </TabsContent>

                <TabsContent value="dm" className="mt-0 flex-1">
                  <DmPreview config={config} username={username} />
                </TabsContent>
              </div>

              {/* Bottom tabs */}
              <TabsList className="bg-[#1a1a1a] border-t border-white/10 rounded-none h-auto p-0 gap-0">
                <TabsTrigger
                  value="post"
                  className="flex-1 rounded-none text-[11px] py-2.5 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none text-white/50 data-[state=active]:border-b-2 data-[state=active]:border-white"
                >
                  Post
                </TabsTrigger>
                <TabsTrigger
                  value="comments"
                  className="flex-1 rounded-none text-[11px] py-2.5 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none text-white/50 data-[state=active]:border-b-2 data-[state=active]:border-white"
                >
                  Comments
                </TabsTrigger>
                <TabsTrigger
                  value="dm"
                  className="flex-1 rounded-none text-[11px] py-2.5 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none text-white/50 data-[state=active]:border-b-2 data-[state=active]:border-white"
                >
                  DM
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Post preview tab ─────────────────────────────────────────────

function PostPreview({
  username,
  thumbnail,
  caption,
}: {
  username: string;
  thumbnail?: string | null;
  caption?: string | null;
}) {
  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-[10px] text-white/50 uppercase tracking-wide">
          {username.toUpperCase()}
        </span>
        <span className="text-xs text-white font-medium">Posts</span>
        <div className="w-12" />
      </div>

      {/* Post header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="size-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
        <span className="text-xs text-white font-medium">{username}</span>
      </div>

      {/* Post image */}
      <div className="aspect-square bg-[#262626] flex items-center justify-center">
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

      {/* Caption */}
      <div className="px-3 pb-3">
        <p className="text-[11px] text-white/80 leading-relaxed">
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
  commentKeyword,
  replyEnabled,
  replyText,
}: {
  username: string;
  commentKeyword: string;
  replyEnabled: boolean;
  replyText: string;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-[10px] text-white/50 uppercase tracking-wide">
          {username.toUpperCase()}
        </span>
        <span className="text-xs text-white font-medium">Comments</span>
        <Send className="size-4 text-white/60" />
      </div>

      {/* Comment list */}
      <div className="px-3 py-3 flex flex-col gap-4">
        {/* User comment */}
        <div className="flex gap-2">
          <div className="size-7 rounded-full bg-[#404040] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white leading-relaxed">
              <span className="font-semibold">Username</span>{" "}
              <span className="text-white/60">Now</span>
            </p>
            <p className="text-[11px] text-white mt-0.5">{commentKeyword}</p>
            <p className="text-[10px] text-white/40 mt-1">Reply</p>
          </div>
          <Heart className="size-3 text-white/40 shrink-0 mt-1" />
        </div>

        {/* Auto-reply */}
        {replyEnabled && (
          <div className="flex gap-2 pl-9">
            <div className="size-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white leading-relaxed">
                <span className="font-semibold">{username}</span>{" "}
                <span className="text-white/60">Now</span>
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
        {["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"].map((emoji) => (
          <span key={emoji} className="text-base">
            {emoji}
          </span>
        ))}
      </div>

      {/* Comment input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
        <div className="size-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0" />
        <span className="text-[11px] text-white/40 flex-1">
          Add a comment for username...
        </span>
      </div>
    </div>
  );
}

// ── DM preview tab ───────────────────────────────────────────────

function DmPreview({
  config,
  username,
}: {
  config: PreviewConfig;
  username: string;
}) {
  return (
    <div className="flex flex-col min-h-[440px]">
      {/* DM Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div className="size-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0" />
        <span className="text-xs text-white font-medium flex-1">
          {username}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-y-auto">
        {/* Opening DM */}
        {config.openingDmEnabled && config.openingDmText && (
          <>
            <MessageBubble side="left" avatar>
              {config.openingDmText}
            </MessageBubble>

            {/* Button */}
            {config.openingDmButtonText && (
              <>
                <MessageBubble side="left" avatar isButton>
                  {config.openingDmButtonText}
                </MessageBubble>

                {/* User clicks the button */}
                <MessageBubble side="right">
                  {config.openingDmButtonText}
                </MessageBubble>
              </>
            )}
          </>
        )}

        {/* Email collection */}
        {config.emailCollectionEnabled && config.emailCollectionText && (
          <>
            <MessageBubble side="left" avatar>
              {config.emailCollectionText}
            </MessageBubble>

            <MessageBubble side="right">example@mail.com</MessageBubble>
          </>
        )}

        {/* Follow gate */}
        {config.followGateEnabled && config.followGateText && (
          <>
            <MessageBubble side="left" avatar>
              {config.followGateText}
            </MessageBubble>

            <MessageBubble side="left" avatar isButton>
              Following
            </MessageBubble>

            <MessageBubble side="right">Following</MessageBubble>
          </>
        )}

        {/* Link delivery */}
        {config.linkDmText && (
          <MessageBubble side="left" avatar>
            {config.linkDmText}
            {config.linkUrl && (
              <>
                {"\n\n"}
                <span className="text-blue-400 underline">
                  {config.linkUrl}
                </span>
              </>
            )}
          </MessageBubble>
        )}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
        <div className="size-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
          <svg
            className="size-3.5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
          </svg>
        </div>
        <span className="text-[11px] text-white/40 flex-1">Message...</span>
        <div className="flex items-center gap-2 text-white/40">
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
          </svg>
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
            <path d="M12 8v8M8 12h8" strokeWidth="1.5" />
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
}: {
  children: React.ReactNode;
  side: "left" | "right";
  avatar?: boolean;
  isButton?: boolean;
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
          <div className="size-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0" />
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
        <div className="size-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0" />
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
