/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as deck_api from "../deck_api.js";
import type * as deck_layout from "../deck_layout.js";
import type * as display from "../display.js";
import type * as http from "../http.js";
import type * as lib_activate_status from "../lib/activate_status.js";
import type * as lib_current_user from "../lib/current_user.js";
import type * as lib_deck_key_content from "../lib/deck_key_content.js";
import type * as lib_deck_keys from "../lib/deck_keys.js";
import type * as lib_deck_tokens from "../lib/deck_tokens.js";
import type * as lib_light_validation from "../lib/light_validation.js";
import type * as lib_owned_status from "../lib/owned_status.js";
import type * as lib_public_links from "../lib/public_links.js";
import type * as lib_sports_leagues from "../lib/sports_leagues.js";
import type * as lib_webhook_payload from "../lib/webhook_payload.js";
import type * as lights from "../lights.js";
import type * as media from "../media.js";
import type * as public_status from "../public_status.js";
import type * as sports from "../sports.js";
import type * as statuses from "../statuses.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  deck_api: typeof deck_api;
  deck_layout: typeof deck_layout;
  display: typeof display;
  http: typeof http;
  "lib/activate_status": typeof lib_activate_status;
  "lib/current_user": typeof lib_current_user;
  "lib/deck_key_content": typeof lib_deck_key_content;
  "lib/deck_keys": typeof lib_deck_keys;
  "lib/deck_tokens": typeof lib_deck_tokens;
  "lib/light_validation": typeof lib_light_validation;
  "lib/owned_status": typeof lib_owned_status;
  "lib/public_links": typeof lib_public_links;
  "lib/sports_leagues": typeof lib_sports_leagues;
  "lib/webhook_payload": typeof lib_webhook_payload;
  lights: typeof lights;
  media: typeof media;
  public_status: typeof public_status;
  sports: typeof sports;
  statuses: typeof statuses;
  users: typeof users;
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
