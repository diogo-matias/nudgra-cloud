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
import type * as automations_rules from "../automations/rules.js";
import type * as automations_sequences from "../automations/sequences.js";
import type * as automations_shared from "../automations/shared.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as meta_config from "../meta/config.js";
import type * as meta_oauth from "../meta/oauth.js";
import type * as meta_send from "../meta/send.js";
import type * as meta_sendActions from "../meta/sendActions.js";
import type * as meta_sendHelpers from "../meta/sendHelpers.js";
import type * as meta_webhooks from "../meta/webhooks.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  auth: typeof auth;
  "automations/rules": typeof automations_rules;
  "automations/sequences": typeof automations_sequences;
  "automations/shared": typeof automations_shared;
  dashboard: typeof dashboard;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "meta/config": typeof meta_config;
  "meta/oauth": typeof meta_oauth;
  "meta/send": typeof meta_send;
  "meta/sendActions": typeof meta_sendActions;
  "meta/sendHelpers": typeof meta_sendHelpers;
  "meta/webhooks": typeof meta_webhooks;
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

export declare const components: {};
