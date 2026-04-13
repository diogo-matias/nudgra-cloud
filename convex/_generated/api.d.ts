/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as auth from "../auth.js";
import type * as automations_commentAutomations from "../automations/commentAutomations.js";
import type * as automations_commentFlow from "../automations/commentFlow.js";
import type * as automations_commentTracking from "../automations/commentTracking.js";
import type * as automations_guardrails from "../automations/guardrails.js";
import type * as automations_ruleFlow from "../automations/ruleFlow.js";
import type * as automations_ruleShared from "../automations/ruleShared.js";
import type * as automations_ruleTracking from "../automations/ruleTracking.js";
import type * as automations_rules from "../automations/rules.js";
import type * as automations_sequences from "../automations/sequences.js";
import type * as automations_shared from "../automations/shared.js";
import type * as automations_storyAutomations from "../automations/storyAutomations.js";
import type * as automations_storyFlow from "../automations/storyFlow.js";
import type * as automations_storyShared from "../automations/storyShared.js";
import type * as automations_storyTracking from "../automations/storyTracking.js";
import type * as contacts from "../contacts.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_readModels from "../lib/readModels.js";
import type * as meta_authShared from "../meta/authShared.js";
import type * as meta_commentWebhooks from "../meta/commentWebhooks.js";
import type * as meta_comments from "../meta/comments.js";
import type * as meta_config from "../meta/config.js";
import type * as meta_contactProfiles from "../meta/contactProfiles.js";
import type * as meta_history from "../meta/history.js";
import type * as meta_media from "../meta/media.js";
import type * as meta_mediaQueries from "../meta/mediaQueries.js";
import type * as meta_oauth from "../meta/oauth.js";
import type * as meta_send from "../meta/send.js";
import type * as meta_sendActions from "../meta/sendActions.js";
import type * as meta_sendHelpers from "../meta/sendHelpers.js";
import type * as meta_stories from "../meta/stories.js";
import type * as meta_storyQueries from "../meta/storyQueries.js";
import type * as meta_tokenLifecycle from "../meta/tokenLifecycle.js";
import type * as meta_webhooks from "../meta/webhooks.js";
import type * as migrations from "../migrations.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  auth: typeof auth;
  "automations/commentAutomations": typeof automations_commentAutomations;
  "automations/commentFlow": typeof automations_commentFlow;
  "automations/commentTracking": typeof automations_commentTracking;
  "automations/guardrails": typeof automations_guardrails;
  "automations/ruleFlow": typeof automations_ruleFlow;
  "automations/ruleShared": typeof automations_ruleShared;
  "automations/ruleTracking": typeof automations_ruleTracking;
  "automations/rules": typeof automations_rules;
  "automations/sequences": typeof automations_sequences;
  "automations/shared": typeof automations_shared;
  "automations/storyAutomations": typeof automations_storyAutomations;
  "automations/storyFlow": typeof automations_storyFlow;
  "automations/storyShared": typeof automations_storyShared;
  "automations/storyTracking": typeof automations_storyTracking;
  contacts: typeof contacts;
  dashboard: typeof dashboard;
  http: typeof http;
  inbox: typeof inbox;
  "lib/auth": typeof lib_auth;
  "lib/readModels": typeof lib_readModels;
  "meta/authShared": typeof meta_authShared;
  "meta/commentWebhooks": typeof meta_commentWebhooks;
  "meta/comments": typeof meta_comments;
  "meta/config": typeof meta_config;
  "meta/contactProfiles": typeof meta_contactProfiles;
  "meta/history": typeof meta_history;
  "meta/media": typeof meta_media;
  "meta/mediaQueries": typeof meta_mediaQueries;
  "meta/oauth": typeof meta_oauth;
  "meta/send": typeof meta_send;
  "meta/sendActions": typeof meta_sendActions;
  "meta/sendHelpers": typeof meta_sendHelpers;
  "meta/stories": typeof meta_stories;
  "meta/storyQueries": typeof meta_storyQueries;
  "meta/tokenLifecycle": typeof meta_tokenLifecycle;
  "meta/webhooks": typeof meta_webhooks;
  migrations: typeof migrations;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        { sinceTs?: number },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; names?: Array<string> },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      migrate: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun: boolean;
          fnHandle: string;
          name: string;
          next?: Array<{ fnHandle: string; name: string }>;
          oneBatchOnly?: boolean;
          reset?: boolean;
        },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
    };
  };
};
