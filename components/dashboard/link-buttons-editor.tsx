"use client";

import { useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type LinkButtonConfig = {
  label: string;
  url: string;
};

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function LinkButtonsEditor({
  links,
  onChange,
}: {
  links: LinkButtonConfig[];
  onChange: (links: LinkButtonConfig[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState("https://");

  const isValid = draftLabel.trim().length > 0 && draftUrl.trim().length > 0;

  function resetForm() {
    setEditingIndex(null);
    setDraftLabel("");
    setDraftUrl("https://");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  function handleCreate() {
    resetForm();
    setOpen(true);
  }

  function handleEdit(index: number) {
    const link = links[index];
    if (!link) {
      return;
    }

    setEditingIndex(index);
    setDraftLabel(link.label);
    setDraftUrl(link.url);
    setOpen(true);
  }

  function handleRemove(index: number) {
    onChange(links.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleSave() {
    if (!isValid) {
      return;
    }

    const nextLinks = [...links];
    const normalizedLink = {
      label: draftLabel.trim(),
      url: normalizeUrl(draftUrl),
    };

    if (editingIndex === null) {
      nextLinks.push(normalizedLink);
    } else {
      nextLinks[editingIndex] = normalizedLink;
    }

    onChange(nextLinks);
    handleOpenChange(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {links.length > 0 ? (
        <div className="flex flex-col gap-2">
          {links.map((link, index) => (
            <div
              key={`${link.label}-${link.url}-${index}`}
              className="rounded-lg border border-border bg-background px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {link.label}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {link.url}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(index)}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Edit ${link.label}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    aria-label={`Remove ${link.label}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-background/70 px-3 py-4">
          <p className="text-sm text-muted-foreground">
            No links added yet.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/25 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Links</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Nudgra sends up to 3 buttons in one DM. If you add more, the rest
              are sent in a follow-up message automatically.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleCreate}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" />
            Add link
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingIndex === null ? "Add a link" : "Edit link"}
            </DialogTitle>
            <DialogDescription>
              Add the button label and destination URL for this DM button.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Button label
              </label>
              <input
                type="text"
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                placeholder="Open"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Link
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                <ExternalLink className="size-4 text-muted-foreground" />
                <input
                  type="url"
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
