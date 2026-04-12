"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, BookOpen, Send } from "lucide-react";

type AutomationType = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  available: boolean;
};

const AUTOMATION_TYPES: AutomationType[] = [
  {
    id: "comment-dm",
    title: "Auto-DM links from comments",
    description:
      "When someone comments a keyword on your post, automatically DM them a link, collect their email, and grow your audience.",
    icon: MessageSquare,
    href: "/dashboard/automations/comments/new",
    available: true,
  },
  {
    id: "keyword-dm",
    title: "When someone DMs you",
    description:
      "Reply to keyword DMs with tracked links, optional follow gates, email capture, and re-engagement follow-ups.",
    icon: Send,
    href: "/dashboard/automations/rules/new",
    available: true,
  },
  {
    id: "story-leads",
    title: "Generate leads with stories",
    description:
      "Capture leads when people reply to your stories. Send automated DMs and collect contact information.",
    icon: BookOpen,
    href: "/dashboard/automations/stories/new",
    available: false,
  },
];

export function AutomationTypeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Create a new automation
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the type of automation you want to set up.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          {AUTOMATION_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                type="button"
                disabled={!type.available}
                onClick={() => {
                  if (type.available) {
                    onOpenChange(false);
                    router.push(type.href);
                  }
                }}
                className={`relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                  type.available
                    ? "border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-sm cursor-pointer"
                    : "border-border/60 bg-muted/30 opacity-60 cursor-not-allowed"
                }`}
              >
                <div
                  className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                    type.available
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {type.title}
                    </p>
                    {!type.available && (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {type.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
