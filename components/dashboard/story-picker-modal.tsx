"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { RefreshCw, Check, Image as ImageIcon, Film, Clock3 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function formatStoryAge(timestamp: string | null) {
  if (!timestamp) {
    return "Just now";
  }

  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function StoryPickerModal({
  accountId,
  open,
  onOpenChange,
  selectedStoryId,
  onSelectionChange,
}: {
  accountId: Id<"instagramAccounts">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStoryId: string | null;
  onSelectionChange: (storyId: string | null) => void;
}) {
  const stories =
    useQuery(api.meta.storyQueries.listCachedStories, { accountId }) ?? [];
  const refreshStories = useAction(api.meta.storyQueries.refreshStories);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localSelection, setLocalSelection] = useState<string | null>(
    selectedStoryId,
  );

  useEffect(() => {
    if (open) {
      setLocalSelection(selectedStoryId);
    }
  }, [open, selectedStoryId]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshStories({ accountId });
    } catch (error) {
      console.error("Failed to refresh stories:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Pick a live story
            </DialogTitle>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="mr-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw
                className={cn("size-3.5", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </DialogHeader>

        <div className="-mx-6 flex-1 overflow-y-auto px-6 py-2">
          {stories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                No live stories are cached right now. Refresh to fetch the
                latest stories from Instagram.
              </p>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("size-3.5", isRefreshing && "animate-spin")}
                />
                Fetch stories
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {stories.map((story) => {
                const previewUrl = story.thumbnailUrl || story.mediaUrl;
                const isSelected = localSelection === story.storyId;
                const isVideo = story.mediaType.toUpperCase().includes("VIDEO");

                return (
                  <button
                    key={story.storyId}
                    type="button"
                    onClick={() =>
                      setLocalSelection(
                        localSelection === story.storyId ? null : story.storyId,
                      )
                    }
                    className={cn(
                      "group overflow-hidden rounded-2xl border text-left transition-all",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/30 hover:shadow-sm",
                    )}
                  >
                    <div className="relative aspect-[9/16] bg-muted">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Instagram story"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="size-8 text-muted-foreground/40" />
                        </div>
                      )}

                      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-3">
                        <div className="rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                          Story
                        </div>
                        <div
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full border-2 transition-all",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-white/70 bg-white/70 text-transparent opacity-0 group-hover:opacity-100",
                          )}
                        >
                          <Check className="size-3" />
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-3 pb-3 pt-12">
                        <div className="flex items-center gap-2 text-[10px] text-white/85">
                          {isVideo ? (
                            <Film className="size-3" />
                          ) : (
                            <ImageIcon className="size-3" />
                          )}
                          <Clock3 className="size-3" />
                          <span>{formatStoryAge(story.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="-mx-6 flex items-center justify-between border-t border-border px-6 pt-4">
          <p className="text-xs text-muted-foreground">
            {localSelection ? "1 story selected" : "No story selected"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectionChange(localSelection);
                onOpenChange(false);
              }}
              disabled={!localSelection}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm selection
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
