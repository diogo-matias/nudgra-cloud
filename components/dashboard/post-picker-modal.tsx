"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Check, Film, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaItem = {
  id: string;
  mediaId: string;
  mediaType: string;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  caption: string | null;
  timestamp: string;
  permalink: string | null;
};

function timeAgo(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function truncateCaption(caption: string | null, maxLength = 28) {
  if (!caption) return "No caption";
  return caption.length > maxLength
    ? `${caption.slice(0, maxLength)}...`
    : caption;
}

export function PostPickerModal({
  open,
  onOpenChange,
  selectedMediaIds,
  onSelectionChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMediaIds: string[];
  onSelectionChange: (mediaIds: string[]) => void;
}) {
  const media = useQuery(api.meta.mediaQueries.listCachedMedia) ?? [];
  const refreshMedia = useAction(api.meta.mediaQueries.refreshMedia);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localSelection, setLocalSelection] =
    useState<string[]>(selectedMediaIds);

  // Sync local selection when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalSelection(selectedMediaIds);
    }
    onOpenChange(newOpen);
  };

  const toggleMedia = (mediaId: string) => {
    setLocalSelection((prev) => (prev.includes(mediaId) ? [] : [mediaId]));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshMedia();
    } catch (error) {
      console.error("Failed to refresh media:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConfirm = () => {
    onSelectionChange(localSelection);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Pick any post or reel to automate
            </DialogTitle>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer mr-6"
            >
              <RefreshCw
                className={cn("size-3.5", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-2">
          {media.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No posts found. Click refresh to fetch your posts from
                Instagram.
              </p>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
                className="mt-3 inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  className={cn("size-3.5", isRefreshing && "animate-spin")}
                />
                Fetch posts
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {media.map((item) => {
                const isSelected = localSelection.includes(item.mediaId);
                const imageUrl = item.thumbnailUrl || item.mediaUrl;
                const isVideo =
                  item.mediaType === "VIDEO" || item.mediaType === "REEL";

                return (
                  <button
                    key={item.mediaId}
                    type="button"
                    onClick={() => toggleMedia(item.mediaId)}
                    className={cn(
                      "relative group rounded-xl border overflow-hidden transition-all text-left",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/30 hover:shadow-sm",
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square bg-muted">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.caption ?? "Post"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="size-8 text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Video/Reel indicator */}
                      {isVideo && (
                        <div className="absolute top-2 right-2 bg-black/60 rounded-md p-1">
                          <Film className="size-3.5 text-white" />
                        </div>
                      )}

                      {/* Selection indicator */}
                      <div
                        className={cn(
                          "absolute top-2 left-2 size-5 rounded-full border-2 flex items-center justify-center transition-all",
                          isSelected
                            ? "bg-primary border-primary"
                            : "bg-white/80 border-white/60 opacity-0 group-hover:opacity-100",
                        )}
                      >
                        {isSelected && (
                          <Check className="size-3 text-primary-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Caption & time */}
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-foreground leading-tight">
                        {truncateCaption(item.caption)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {timeAgo(item.timestamp)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-4 -mx-6 px-6">
          <p className="text-xs text-muted-foreground">
            {localSelection.length} post
            {localSelection.length !== 1 ? "s" : ""} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={localSelection.length === 0}
              className="inline-flex items-center bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Confirm selection
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
