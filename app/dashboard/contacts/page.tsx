"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, Search, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ContactAvatar,
  getContactDisplayName,
  getInstagramHandle,
} from "@/components/dashboard/contact-avatar";
import { ContactDetailDialog } from "@/components/dashboard/contact-detail-dialog";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  formatDateTime,
  formatRelativeTime,
} from "@/lib/dashboard-formatters";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";

type ContactListItem = NonNullable<
  ReturnType<typeof useQuery<typeof api.contacts.listContacts>>
>[number];

function parseAutomationFilter(value: string) {
  if (value === "all") {
    return null;
  }

  const [kind, id] = value.split(":");
  if (!kind || !id) {
    return null;
  }

  if (kind === "rule") {
    return {
      kind: "rule" as const,
      automationRuleId: id as Id<"automationRules">,
    };
  }

  if (kind === "comment_automation") {
    return {
      kind: "comment_automation" as const,
      commentAutomationId: id as Id<"commentAutomations">,
    };
  }

  if (kind === "sequence") {
    return {
      kind: "sequence" as const,
      sequenceDefinitionId: id as Id<"sequenceDefinitions">,
    };
  }

  return null;
}

function automationKindLabel(kind: "rule" | "comment_automation" | "sequence") {
  if (kind === "comment_automation") {
    return "Comment";
  }
  if (kind === "sequence") {
    return "Sequence";
  }
  return "Rule";
}

export default function ContactsPage() {
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;
  const [search, setSearch] = useState("");
  const [selectedAutomation, setSelectedAutomation] = useState("all");
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const requestedRefreshIdsRef = useRef(new Set<string>());
  const requestContactProfileRefresh = useMutation(
    api.contacts.requestContactProfileRefresh,
  );

  const automationFilters =
    useQuery(
      api.contacts.listAutomationFilters,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? {
      rules: [],
      commentAutomations: [],
      sequences: [],
    };
  const contactsQuery = useQuery(
    api.contacts.listContacts,
    selectedAccount
      ? {
          accountId: selectedAccount.id,
          automationFilter: parseAutomationFilter(selectedAutomation),
        }
      : "skip",
  );

  const filteredContacts = useMemo(() => {
    const source = contactsQuery ?? [];
    const query = search.trim().toLowerCase();
    if (!query) {
      return source;
    }

    return source.filter((contact) =>
      [
        contact.displayName,
        contact.username,
        ...contact.tags.map((tag) => tag.label),
        ...contact.automations.map((automation) => automation.label),
      ]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [contactsQuery, search]);

  useEffect(() => {
    const missingProfiles = (contactsQuery ?? [])
      .filter(
        (contact) =>
          contact.profilePictureUrl === null &&
          !requestedRefreshIdsRef.current.has(contact.id),
      )
      .slice(0, 12);

    for (const contact of missingProfiles) {
      requestedRefreshIdsRef.current.add(contact.id);
      void requestContactProfileRefresh({
        accountId: selectedAccount!.id,
        contactId: contact.id,
      });
    }
  }, [contactsQuery, requestContactProfileRefresh, selectedAccount]);

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before opening contacts."
        />
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Contacts
          </h1>
          <p className="text-sm text-muted-foreground">
            Filter people by automation, inspect who subscribed first, and open
            their latest conversation context.
          </p>
        </header>

        <section className="rounded-[28px] border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {filteredContacts.length} contact
                {filteredContacts.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedAutomation === "all"
                  ? "All automations"
                  : "Filtered by one automation"}
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative min-w-[230px]">
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={selectedAutomation}
                  onChange={(event) => setSelectedAutomation(event.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  <option value="all">All automations</option>
                  {automationFilters.rules.length > 0 ? (
                    <optgroup label="Rules">
                      {automationFilters.rules.map((rule) => (
                        <option key={rule.id} value={`rule:${rule.id}`}>
                          {rule.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {automationFilters.commentAutomations.length > 0 ? (
                    <optgroup label="Comment automations">
                      {automationFilters.commentAutomations.map((automation) => (
                        <option
                          key={automation.id}
                          value={`comment_automation:${automation.id}`}
                        >
                          {automation.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {automationFilters.sequences.length > 0 ? (
                    <optgroup label="Sequences">
                      {automationFilters.sequences.map((sequence) => (
                        <option key={sequence.id} value={`sequence:${sequence.id}`}>
                          {sequence.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </div>

              <div className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search contacts, tags, or automations"
                  className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>
          </div>

          {filteredContacts.length === 0 ? (
            <EmptyState hasSearch={search.trim().length > 0 || selectedAutomation !== "all"} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3.5 font-medium">Contact</th>
                    <th className="px-6 py-3.5 font-medium">Automations</th>
                    <th className="px-6 py-3.5 font-medium">Tags</th>
                    <th className="px-6 py-3.5 font-medium">Subscribed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="group cursor-pointer transition-colors hover:bg-muted/25"
                      onClick={() => {
                        setSelectedContact(contact);
                        setDialogOpen(true);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <ContactAvatar
                            displayName={contact.displayName}
                            username={contact.username}
                            profilePictureUrl={contact.profilePictureUrl}
                            size="lg"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {getContactDisplayName(
                                contact.displayName,
                                contact.username,
                              )}
                            </p>
                            {getInstagramHandle(contact.username) ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {getInstagramHandle(contact.username)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {contact.automations.length === 0 ? (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          ) : (
                            <>
                              {contact.automations.slice(0, 2).map((automation) => (
                                <StatusPill
                                  key={automation.id}
                                  status={
                                    automation.status === null
                                      ? "inactive"
                                      : automation.status
                                  }
                                  label={`${automationKindLabel(automation.kind)} · ${automation.label}`}
                                  className="max-w-[220px] truncate"
                                />
                              ))}
                              {contact.automations.length > 2 ? (
                                <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                  +{contact.automations.length - 2}
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {contact.tags.length === 0 ? (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          ) : (
                            contact.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground"
                              >
                                {tag.label}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">
                            {formatRelativeTime(contact.subscribedAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(contact.subscribedAt)}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <ContactDetailDialog
        accountId={selectedAccount.id}
        contact={selectedContact}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </main>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
        <Users className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {hasSearch ? "No matching contacts" : "No contacts yet"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasSearch
            ? "Try a broader search or switch to a different automation filter."
            : "Contacts will appear here as soon as inbound messages and automations start creating contact records."}
        </p>
      </div>
    </div>
  );
}
