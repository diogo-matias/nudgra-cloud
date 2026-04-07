"use client";

import { useState } from "react";
import { Search, Users, Tag } from "lucide-react";

// Shell mock data — replace with Convex query in the next pass
const MOCK_CONTACTS = [
  {
    id: "1",
    username: "sarah_creates",
    displayName: "Sarah M.",
    firstContact: "Mar 11",
    lastActive: "Apr 5",
    tags: ["interested", "warm-lead"],
    messageCount: 6,
  },
  {
    id: "2",
    username: "dev_journal",
    displayName: "Alex Chen",
    firstContact: "Mar 15",
    lastActive: "Apr 6",
    tags: ["collaborator"],
    messageCount: 3,
  },
  {
    id: "3",
    username: "the_real_marco",
    displayName: "Marco V.",
    firstContact: "Mar 22",
    lastActive: "Apr 2",
    tags: ["customer"],
    messageCount: 4,
  },
  {
    id: "4",
    username: "luna_vibes",
    displayName: "Luna K.",
    firstContact: "Apr 1",
    lastActive: "Apr 7",
    tags: ["new"],
    messageCount: 1,
  },
  {
    id: "5",
    username: "coach_daniel",
    displayName: "Daniel R.",
    firstContact: "Mar 28",
    lastActive: "Mar 30",
    tags: [],
    messageCount: 2,
  },
];

const TAG_COLORS: Record<string, string> = {
  "interested": "text-blue-700 bg-blue-50 border-blue-200",
  "warm-lead": "text-violet-700 bg-violet-50 border-violet-200",
  "collaborator": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "customer": "text-amber-700 bg-amber-50 border-amber-200",
  "new": "text-muted-foreground bg-muted border-border",
};

function tagClass(tag: string) {
  return TAG_COLORS[tag] ?? "text-muted-foreground bg-muted border-border";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ContactsPage() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_CONTACTS.filter(
    (c) =>
      c.username.toLowerCase().includes(search.toLowerCase()) ||
      c.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {MOCK_CONTACTS.length} contacts across all conversations
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
          />
        </div>

        {/* Table */}
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
                  <tr
                    key={contact.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {initials(contact.displayName)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {contact.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @{contact.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.length > 0 ? (
                          contact.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 border ${tagClass(tag)}`}
                            >
                              <Tag className="size-2.5" />
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground/50">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                      {contact.firstContact}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                      {contact.lastActive}
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
