"use client";

import type { ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  LinkButtonsEditor,
  type LinkButtonConfig,
} from "@/components/dashboard/link-buttons-editor";
import { FollowerAutomationPreview } from "@/components/dashboard/follower-automation-preview";
import {
  InlineWarning,
  ToggleCard,
  ValidationIssuesNotice,
} from "@/components/dashboard/automation-shared-ui";

type TagOption = {
  id: Id<"tags">;
  label: string;
  color: string;
};

type FollowerAutomationFormProps = {
  name: string;
  onNameChange: (value: string) => void;
  welcomeDmText: string;
  onWelcomeDmTextChange: (value: string) => void;
  emailCollectionEnabled: boolean;
  onEmailCollectionEnabledChange: (enabled: boolean) => void;
  emailCollectionText: string;
  onEmailCollectionTextChange: (value: string) => void;
  linkDmText: string;
  onLinkDmTextChange: (value: string) => void;
  linkButtons: LinkButtonConfig[];
  onLinkButtonsChange: (links: LinkButtonConfig[]) => void;
  followUpEnabled: boolean;
  onFollowUpEnabledChange: (enabled: boolean) => void;
  followUpText: string;
  onFollowUpTextChange: (value: string) => void;
  tagOptions: TagOption[];
  selectedTagIds: Id<"tags">[];
  onSelectedTagIdsChange: (tagIds: Id<"tags">[]) => void;
  validationIssues: string[];
  submissionError?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
};

export function FollowerAutomationForm(props: FollowerAutomationFormProps) {
  function toggleTag(tagId: Id<"tags">) {
    props.onSelectedTagIdsChange(
      props.selectedTagIds.includes(tagId)
        ? props.selectedTagIds.filter((current) => current !== tagId)
        : [...props.selectedTagIds, tagId],
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-8">
          {props.validationIssues.length > 0 ? (
            <ValidationIssuesNotice
              title="This automation needs a few fixes"
              issues={props.validationIssues}
            />
          ) : null}

          {props.submissionError ? (
            <ValidationIssuesNotice
              title="Unable to save automation"
              issues={[props.submissionError]}
            />
          ) : null}

          <FormField label="Automation name">
            <input
              type="text"
              value={props.name}
              onChange={(event) => props.onNameChange(event.target.value)}
              placeholder="e.g. New follower welcome"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </FormField>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              When someone follows you
            </h2>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Send a welcome DM
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Runs from Meta follower webhook events only. It does not use DM,
                comment, or story reply fallback triggers.
              </p>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              They&apos;ll get this welcome message
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  Welcome DM
                </p>
              </div>
              <div className="px-4 pb-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <textarea
                    value={props.welcomeDmText}
                    onChange={(event) =>
                      props.onWelcomeDmTextChange(event.target.value)
                    }
                    placeholder="Thanks for following! Glad you're here."
                    rows={4}
                    maxLength={1000}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              Add a link if needed
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  Optional link DM
                </p>
              </div>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <textarea
                    value={props.linkDmText}
                    onChange={(event) =>
                      props.onLinkDmTextChange(event.target.value)
                    }
                    placeholder="Here's the link I mentioned:"
                    rows={3}
                    maxLength={2000}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>

                <LinkButtonsEditor
                  links={props.linkButtons}
                  onChange={props.onLinkButtonsChange}
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              Other things to automate
            </h2>

            <ToggleCard
              label="Ask for email"
              enabled={props.emailCollectionEnabled}
              onToggle={props.onEmailCollectionEnabledChange}
            >
              {props.emailCollectionEnabled ? (
                <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                  <textarea
                    value={props.emailCollectionText}
                    onChange={(event) =>
                      props.onEmailCollectionTextChange(event.target.value)
                    }
                    placeholder="Drop your email and I'll send it right over:"
                    rows={2}
                    maxLength={500}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              ) : null}
            </ToggleCard>

            <ToggleCard
              label="Follow up to grow engagement"
              enabled={props.followUpEnabled}
              onToggle={props.onFollowUpEnabledChange}
            >
              {props.followUpEnabled ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <textarea
                      value={props.followUpText}
                      onChange={(event) =>
                        props.onFollowUpTextChange(event.target.value)
                      }
                      placeholder="Just checking in - did you get the link?"
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  {props.linkButtons.length === 0 ? (
                    <InlineWarning text="Add at least one link button first. Follow-up only runs when clicks can be tracked." />
                  ) : (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Follow-up sends once, 6 hours after the link DM, only if
                      no tracked link click is recorded.
                    </p>
                  )}
                </div>
              ) : null}
            </ToggleCard>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-foreground">
              Advanced settings
            </h2>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Tags</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Apply tags automatically as soon as this automation runs.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {props.tagOptions.map((tag) => {
                  const selected = props.selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="h-8" />
        </div>
      </div>

      <div className="hidden w-[380px] shrink-0 items-start justify-center overflow-y-auto border-l border-border bg-muted/30 py-8 lg:flex">
        <FollowerAutomationPreview
          config={{
            welcomeDmText: props.welcomeDmText,
            emailCollectionEnabled: props.emailCollectionEnabled,
            emailCollectionText: props.emailCollectionText,
            linkDmText: props.linkDmText,
            linkButtons: props.linkButtons,
            followUpEnabled: props.followUpEnabled,
            followUpText: props.followUpText,
            validationIssues: props.validationIssues,
            username: props.username,
            profilePictureUrl: props.profilePictureUrl,
          }}
        />
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
