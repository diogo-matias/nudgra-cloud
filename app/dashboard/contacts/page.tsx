"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Search, Users, Tag } from "lucide-react";
import { api } from "@/convex/_generated/api";

function initials(name: string | null, username: string | null) {
  const label = name || username || "IG";
  return label
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const contacts = useQuery(api.dashboard.listContacts) ?? [];

  const filtered = contacts.filter((contact) => {
    const query = search.toLowerCase();
    return (
      (contact.username ?? "").toLowerCase().includes(query) ||
      (contact.displayName ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {contacts.length} contacts across all conversations
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or username..."
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasSearch={search.length > 0} />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    Contact
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3 hidden sm:table-cell">
                    Tags
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3 hidden md:table-cell">
                    First contact
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3 hidden md:table-cell">
                    Last active
                  </th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    Messages
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((contact) => (
                  <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {initials(contact.displayName, contact.username)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {contact.displayName ?? "Instagram contact"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @{contact.username ?? "unknown"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.length > 0 ? (
                          contact.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 border text-muted-foreground bg-muted border-border"
                            >
                              <Tag className="size-2.5" />
                              {tag.label}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                      {formatDate(contact.firstInboundAt)}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                      {formatDate(contact.lastMessageAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-medium text-foreground">
                      {contact.messageCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center text-center gap-2">
      <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
        <Users className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mt-2">
        {hasSearch ? "No matching contacts" : "No contacts yet"}
      </p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {hasSearch
          ? "Try a different name or username."
          : "Contacts will appear here once your automations start running."}
      </p>
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}
