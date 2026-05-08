"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AutomationDeleteKind = "comment" | "story" | "follower" | "rule";

type AutomationDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationKind: AutomationDeleteKind;
  automationName: string;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
};

function getAutomationLabel(kind: AutomationDeleteKind) {
  if (kind === "comment") {
    return "comment automation";
  }

  if (kind === "story") {
    return "story automation";
  }

  if (kind === "follower") {
    return "follower automation";
  }

  return "DM automation";
}

export function AutomationDeleteDialog({
  open,
  onOpenChange,
  automationKind,
  automationName,
  isDeleting,
  error,
  onConfirm,
}: AutomationDeleteDialogProps) {
  const label = getAutomationLabel(automationKind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {label}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{automationName}</span>{" "}
            will be removed permanently. Existing sessions, logs, messages, and
            saved contact history will stay available as historical data.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
          Live runs stop immediately. This action cannot be undone.
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
