"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { AtSign, Clock3, ExternalLink, Mail, Sparkles, Tag } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContactAvatar,
  getContactDisplayName,
  getInstagramHandle,
  getInstagramProfileUrl,
} from "@/components/dashboard/contact-avatar";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  formatDateTime,
  formatExactDate,
  formatRelativeTime,
} from "@/lib/dashboard-formatters";

type ContactRow = {
  id: Id<"contacts">;
  username: string | null;
  displayName: string | null;
  profilePictureUrl: string | null;
  subscribedAt: number;
  lastMessageAt: number;
  messageCount: number;
  tags: Array<{ id: string; label: string; color: string }>;
  latestConversationId: Id<"conversations"> | null;
};

function kindLabel(
  kind:
    | "rule"
    | "comment_automation"
    | "story_automation"
    | "follower_automation"
    | "sequence",
) {
  if (kind === "comment_automation") {
    return "Comment automation";
  }
  if (kind === "story_automation") {
    return "Story automation";
  }
  if (kind === "follower_automation") {
    return "Follower automation";
  }
  if (kind === "sequence") {
    return "Sequence";
  }
  return "Rule";
}

export function ContactDetailDialog({
  accountId,
  contact,
  open,
  onOpenChange,
}: {
  accountId: Id<"instagramAccounts">;
  contact: ContactRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const requestedRefreshIdsRef = useRef(new Set<string>());
  const requestContactProfileRefresh = useMutation(
    api.contacts.requestContactProfileRefresh,
  );
  const detail = useQuery(
    api.contacts.getContactDetail,
    contact && open ? { accountId, contactId: contact.id } : "skip",
  );
  const requestAvatarRefresh = (contactId: Id<"contacts">) => {
    if (requestedRefreshIdsRef.current.has(contactId)) {
      return;
    }

    requestedRefreshIdsRef.current.add(contactId);
    void requestContactProfileRefresh({ accountId, contactId }).catch(() => {
      requestedRefreshIdsRef.current.delete(contactId);
    });
  };

  useEffect(() => {
    if (!open || contact === null) {
      return;
    }

    const hasProfilePicture =
      detail?.profilePictureUrl ?? contact.profilePictureUrl ?? null;
    if (hasProfilePicture) {
      return;
    }

    if (requestedRefreshIdsRef.current.has(contact.id)) {
      return;
    }

    requestedRefreshIdsRef.current.add(contact.id);
    void requestContactProfileRefresh({ accountId, contactId: contact.id });
  }, [
    accountId,
    contact,
    detail?.profilePictureUrl,
    open,
    requestContactProfileRefresh,
  ]);

  const displayName = getContactDisplayName(
    detail?.displayName ?? contact?.displayName ?? null,
    detail?.username ?? contact?.username ?? null,
  );
  const instagramHandle = getInstagramHandle(
    detail?.username ?? contact?.username ?? null,
  );
  const instagramProfileUrl = getInstagramProfileUrl(
    detail?.username ?? contact?.username ?? null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {contact === null ? null : (
          <div className="grid max-h-[85vh] overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="border-b border-border bg-muted/30 p-6 lg:border-r lg:border-b-0">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col items-start gap-4">
                  <ContactAvatar
                    displayName={detail?.displayName ?? contact.displayName}
                    username={detail?.username ?? contact.username}
                    profilePictureUrl={
                      detail?.profilePictureUrl ?? contact.profilePictureUrl
                    }
                    size="xl"
                    onImageError={() => requestAvatarRefresh(contact.id)}
                  />
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-foreground">
                      {displayName}
                    </h2>
                    {instagramHandle ? (
                      <p className="text-sm text-muted-foreground">
                        {instagramHandle}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-border bg-background p-4">
                  <Stat label="First seen" value={formatExactDate(contact.subscribedAt)} />
                  <Stat
                    label="Last activity"
                    value={formatRelativeTime(contact.lastMessageAt)}
                    subvalue={formatDateTime(contact.lastMessageAt)}
                  />
                  <Stat
                    label="Message volume"
                    value={`${contact.messageCount} message${
                      contact.messageCount === 1 ? "" : "s"
                    }`}
                  />
                </div>

                {contact.latestConversationId ? (
                  <div className="grid gap-2">
                    <Button asChild className="w-full">
                      <Link
                        href={`/dashboard/conversations/${contact.latestConversationId}`}
                      >
                        Open conversation
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                    {instagramProfileUrl ? (
                      <Button asChild variant="outline" className="w-full">
                        <a
                          href={instagramProfileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Instagram profile
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : instagramProfileUrl ? (
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={instagramProfileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Instagram profile
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="overflow-y-auto p-6">
              {detail === undefined ? (
                <div className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Loading contact</DialogTitle>
                    <DialogDescription>
                      Fetching automation and timeline context.
                    </DialogDescription>
                  </DialogHeader>
                </div>
              ) : detail === null ? (
                <div className="space-y-2">
                  <DialogHeader>
                    <DialogTitle>Contact not found</DialogTitle>
                    <DialogDescription>
                      The selected contact is no longer available in this workspace.
                    </DialogDescription>
                  </DialogHeader>
                </div>
              ) : (
                <div className="space-y-6">
                  <DialogHeader className="space-y-1">
                    <DialogTitle>Contact context</DialogTitle>
                    <DialogDescription>
                      Subscription timing, active automations, and sequence state for
                      this contact.
                    </DialogDescription>
                  </DialogHeader>

                  <Section
                    icon={AtSign}
                    title="Profile"
                    description="Current data stored for this contact."
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <InfoCard
                        label="Name"
                        value={getContactDisplayName(
                          detail.displayName,
                          detail.username,
                        )}
                      />
                      <InfoCard
                        label="Instagram handle"
                        value={instagramHandle ?? "Not available yet"}
                        subvalue={
                          instagramProfileUrl ? (
                            <a
                              href={instagramProfileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary transition hover:text-primary/80"
                            >
                              Open Instagram profile
                              <ExternalLink className="size-3.5" />
                            </a>
                          ) : (
                            "Profile link becomes available once the username is known."
                          )
                        }
                      />
                      <InfoCard
                        label="Instagram scoped user ID"
                        value={detail.instagramUserId}
                      />
                      <InfoCard
                        label="Subscribed"
                        value={formatRelativeTime(detail.subscribedAt)}
                        subvalue={formatDateTime(detail.subscribedAt)}
                      />
                      <InfoCard
                        label="Last inbound"
                        value={formatRelativeTime(detail.lastInboundAt)}
                        subvalue={formatDateTime(detail.lastInboundAt)}
                      />
                    </div>
                  </Section>

                  <Section
                    icon={Mail}
                    title="Saved emails"
                    description="Distinct email addresses collected for this contact across automations."
                  >
                    <div className="space-y-3">
                      {detail.emails.length === 0 ? (
                        <EmptyLine text="No emails collected yet." />
                      ) : (
                        detail.emails.map((emailRecord) => (
                          <div
                            key={emailRecord.id}
                            className="rounded-2xl border border-border bg-background p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {emailRecord.email}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {emailRecord.sourceLabel}
                              </span>
                            </div>
                            <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                              <span>
                                First collected:{" "}
                                {formatDateTime(emailRecord.firstCollectedAt)}
                              </span>
                              <span>
                                Last collected:{" "}
                                {formatDateTime(emailRecord.lastCollectedAt)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Section>

                  <Section
                    icon={Sparkles}
                    title="Automation opt-ins"
                    description="Every rule, comment automation, story automation, and sequence this contact entered."
                  >
                    <div className="space-y-3">
                      {detail.automations.length === 0 ? (
                        <EmptyLine text="No automation history yet." />
                      ) : (
                        detail.automations.map((automation) => (
                          <div
                            key={automation.id}
                            className="rounded-2xl border border-border bg-background p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {automation.label}
                              </span>
                              <StatusPill
                                status={
                                  automation.status === null
                                    ? "inactive"
                                    : automation.status
                                }
                                label={
                                  automation.status === null
                                    ? kindLabel(automation.kind)
                                    : `${kindLabel(automation.kind)} · ${automation.status.replaceAll("_", " ")}`
                                }
                              />
                            </div>
                            <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                              <span>
                                First opt-in: {formatDateTime(automation.firstMatchedAt)}
                              </span>
                              <span>
                                Last activity: {formatDateTime(automation.lastMatchedAt)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Section>

                  <Section
                    icon={Clock3}
                    title="Sequence enrollments"
                    description="Enrollment records currently associated with this contact."
                  >
                    <div className="space-y-3">
                      {detail.sequenceEnrollments.length === 0 ? (
                        <EmptyLine text="No sequence enrollments yet." />
                      ) : (
                        detail.sequenceEnrollments.map((sequence) => (
                          <div
                            key={sequence.id}
                            className="rounded-2xl border border-border bg-background p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {sequence.name}
                              </span>
                              <StatusPill status={sequence.status} />
                            </div>
                            <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                              <span>
                                Enrolled: {formatDateTime(sequence.enrolledAt)}
                              </span>
                              <span>
                                Next run:{" "}
                                {sequence.nextRunAt
                                  ? formatDateTime(sequence.nextRunAt)
                                  : "No pending step"}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Section>

                  <Section
                    icon={Tag}
                    title="Tags"
                    description="Current segmentation labels applied to the contact."
                  >
                    <div className="flex flex-wrap gap-2">
                      {detail.tags.length === 0 ? (
                        <EmptyLine text="No tags applied." />
                      ) : (
                        detail.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground"
                          >
                            {tag.label}
                          </span>
                        ))
                      )}
                    </div>
                  </Section>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-2xl border border-border bg-muted/60">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      {subvalue ? (
        <p className="mt-1 text-xs text-muted-foreground">{subvalue}</p>
      ) : null}
    </div>
  );
}

function InfoCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: React.ReactNode;
  subvalue?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      {subvalue ? (
        <p className="mt-1 text-xs text-muted-foreground">{subvalue}</p>
      ) : null}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
      {text}
    </div>
  );
}
