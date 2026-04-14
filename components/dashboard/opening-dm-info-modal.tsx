"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, UserPlus, Mail, ChevronLeft, Monitor } from "lucide-react";

export function OpeningDmInfoModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            What does an Opening DM do?
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-8 mt-2">
          {/* Left: Explanation */}
          <div className="flex-1 flex flex-col gap-5">
            <p className="text-sm text-foreground leading-relaxed">
              The Opening DM is sent as the private reply to a qualifying
              comment.
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              When someone taps the button or replies, Meta opens the normal
              24-hour DM window so Nudgra can keep the conversation going.
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              Without that interaction, only the first private reply is allowed.
            </p>

            <div>
              <p className="text-sm font-semibold text-foreground mb-4">
                After they interact, the Opening DM allows you to:
              </p>

              <div className="rounded-xl bg-muted/50 border border-border p-5 flex flex-col gap-5">
                {/* Send a follow up */}
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Bell className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Send a follow up
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Set up a personalized DM for anyone who missed your link
                      the first time
                    </p>
                  </div>
                </div>

                {/* Grow your followers */}
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <UserPlus className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Grow your followers
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Automatically ask them to follow you before sending a
                      link.
                    </p>
                  </div>
                </div>

                {/* Collect emails */}
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Mail className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Collect emails
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Ask for their email in a DM to connect with them on and
                      off social
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="hidden md:block shrink-0">
            <PhoneMockup />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Mini phone mockup showing the DM flow ────────────────────────

function PhoneMockup() {
  return (
    <div className="w-[260px]">
      <div className="bg-[#1a1a1a] rounded-[2rem] p-2.5 shadow-xl ring-1 ring-white/10">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 pt-1 pb-1.5">
          <span className="text-[9px] text-white/80 font-medium tabular-nums">
            9:41
          </span>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              <div className="w-0.5 h-1 bg-white/60 rounded-sm" />
              <div className="w-0.5 h-1.5 bg-white/60 rounded-sm" />
              <div className="w-0.5 h-2 bg-white/60 rounded-sm" />
              <div className="w-0.5 h-2.5 bg-white/80 rounded-sm" />
            </div>
            <div className="w-4 h-2 border border-white/60 rounded-sm ml-0.5">
              <div className="w-3 h-1 bg-white/80 rounded-sm m-px" />
            </div>
          </div>
        </div>

        {/* Screen */}
        <div className="bg-black rounded-[1.4rem] overflow-hidden">
          {/* DM header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
            <ChevronLeft className="size-4 text-white shrink-0" />
            <div className="size-6 rounded-full bg-linear-to-br from-purple-500 to-pink-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white font-semibold">username</p>
              <p className="text-[8px] text-white/40">Active 9m ago</p>
            </div>
            <Monitor className="size-3.5 text-white/40" />
          </div>

          {/* Messages */}
          <div className="px-3 py-3 flex flex-col gap-2 min-h-[340px] justify-end">
            {/* Opening DM */}
            <DmBubble side="left">Your private reply</DmBubble>
            <DmButton side="left">Start</DmButton>

            {/* User reply */}
            <DmBubble side="right" highlight>
              Start
            </DmBubble>

            {/* Email ask */}
            <DmBubble side="left">Ask for emails to keep in touch</DmBubble>

            {/* Follow ask */}
            <DmBubble side="left">
              Ask for a follow to build your audience
            </DmBubble>

            {/* Link delivery */}
            <DmBubble side="left">Your DM with a link</DmBubble>
            <DmButton side="left">Your link</DmButton>

            {/* Follow up */}
            <DmBubble side="left">
              Follow up to re-engage and build trust
            </DmBubble>
            <DmButton side="left">Your link</DmButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function DmBubble({
  children,
  side,
  highlight,
}: {
  children: React.ReactNode;
  side: "left" | "right";
  highlight?: boolean;
}) {
  if (side === "right") {
    return (
      <div className="flex justify-end">
        <div
          className={`rounded-2xl rounded-br-md px-3 py-1.5 max-w-[80%] ${
            highlight ? "bg-purple-600" : "bg-[#333]"
          }`}
        >
          <p className="text-[10px] text-white">{children}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1.5">
      <div className="size-4 rounded-full bg-linear-to-br from-purple-500 to-pink-500 shrink-0" />
      <div className="bg-[#262626] rounded-2xl rounded-bl-md px-3 py-1.5 max-w-[80%]">
        <p className="text-[10px] text-white">{children}</p>
      </div>
    </div>
  );
}

function DmButton({
  children,
  side,
}: {
  children: React.ReactNode;
  side: "left" | "right";
}) {
  return (
    <div
      className={`flex ${side === "right" ? "justify-end" : "items-end gap-1.5"}`}
    >
      {side === "left" && <div className="size-4 shrink-0" />}
      <div className="border border-white/20 rounded-2xl px-3 py-1.5 max-w-[80%]">
        <p className="text-[10px] text-white text-center">{children}</p>
      </div>
    </div>
  );
}
