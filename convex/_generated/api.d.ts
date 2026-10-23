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
import type * as background_presence from "../background_presence.js";
import type * as deck_actions from "../deck_actions.js";
import type * as deck_api from "../deck_api.js";
import type * as deck_layout from "../deck_layout.js";
import type * as deck_media from "../deck_media.js";
import type * as display from "../display.js";
import type * as http from "../http.js";
import type * as lib_activate_status from "../lib/activate_status.js";
import type * as lib_clock_settings from "../lib/clock_settings.js";
import type * as lib_current_user from "../lib/current_user.js";
import type * as lib_deck_action_content from "../lib/deck_action_content.js";
import type * as lib_deck_appearance from "../lib/deck_appearance.js";
import type * as lib_deck_catalogue from "../lib/deck_catalogue.js";
import type * as lib_deck_grid from "../lib/deck_grid.js";
import type * as lib_deck_key_content from "../lib/deck_key_content.js";
import type * as lib_deck_keys from "../lib/deck_keys.js";
import type * as lib_deck_tokens from "../lib/deck_tokens.js";
import type * as lib_google_auth from "../lib/google_auth.js";
import type * as lib_google_auth_redirect from "../lib/google_auth_redirect.js";
import type * as lib_light_validation from "../lib/light_validation.js";
import type * as lib_marketplace_affiliate_import from "../lib/marketplace_affiliate_import.js";
import type * as lib_marketplace_affiliate_urls from "../lib/marketplace_affiliate_urls.js";
import type * as lib_marketplace_catalog from "../lib/marketplace_catalog.js";
import type * as lib_marketplace_page_templates from "../lib/marketplace_page_templates.js";
import type * as lib_marketplace_payment_provider from "../lib/marketplace_payment_provider.js";
import type * as lib_marketplace_validation from "../lib/marketplace_validation.js";
import type * as lib_owned_status from "../lib/owned_status.js";
import type * as lib_public_links from "../lib/public_links.js";
import type * as lib_screen_settings from "../lib/screen_settings.js";
import type * as lib_sports_leagues from "../lib/sports_leagues.js";
import type * as lib_timbre_access from "../lib/timbre_access.js";
import type * as lib_timbre_commerce from "../lib/timbre_commerce.js";
import type * as lib_timbre_presence from "../lib/timbre_presence.js";
import type * as lib_timbre_push from "../lib/timbre_push.js";
import type * as lib_timbre_recurring_provider from "../lib/timbre_recurring_provider.js";
import type * as lib_timbre_rtc from "../lib/timbre_rtc.js";
import type * as lib_viso_preset_states from "../lib/viso_preset_states.js";
import type * as lib_vu_styles from "../lib/vu_styles.js";
import type * as lib_webhook_payload from "../lib/webhook_payload.js";
import type * as lights from "../lights.js";
import type * as marketplace from "../marketplace.js";
import type * as marketplace_apply from "../marketplace_apply.js";
import type * as marketplace_files from "../marketplace_files.js";
import type * as marketplace_import from "../marketplace_import.js";
import type * as marketplace_pages from "../marketplace_pages.js";
import type * as marketplace_payment_http from "../marketplace_payment_http.js";
import type * as marketplace_payments from "../marketplace_payments.js";
import type * as media from "../media.js";
import type * as public_status from "../public_status.js";
import type * as social_auth from "../social_auth.js";
import type * as sports from "../sports.js";
import type * as statuses from "../statuses.js";
import type * as timbre from "../timbre.js";
import type * as timbre_calls from "../timbre_calls.js";
import type * as timbre_calls_tables from "../timbre_calls_tables.js";
import type * as timbre_commerce from "../timbre_commerce.js";
import type * as timbre_commerce_tables from "../timbre_commerce_tables.js";
import type * as timbre_presence from "../timbre_presence.js";
import type * as timbre_presence_tables from "../timbre_presence_tables.js";
import type * as timbre_push from "../timbre_push.js";
import type * as timbre_push_tables from "../timbre_push_tables.js";
import type * as timbre_recurring from "../timbre_recurring.js";
import type * as timbre_recurring_http from "../timbre_recurring_http.js";
import type * as timbre_recurring_tables from "../timbre_recurring_tables.js";
import type * as timbre_setup from "../timbre_setup.js";
import type * as timbre_tables from "../timbre_tables.js";
import type * as users from "../users.js";
import type * as weather from "../weather.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  background_presence: typeof background_presence;
  deck_actions: typeof deck_actions;
  deck_api: typeof deck_api;
  deck_layout: typeof deck_layout;
  deck_media: typeof deck_media;
  display: typeof display;
  http: typeof http;
  "lib/activate_status": typeof lib_activate_status;
  "lib/clock_settings": typeof lib_clock_settings;
  "lib/current_user": typeof lib_current_user;
  "lib/deck_action_content": typeof lib_deck_action_content;
  "lib/deck_appearance": typeof lib_deck_appearance;
  "lib/deck_catalogue": typeof lib_deck_catalogue;
  "lib/deck_grid": typeof lib_deck_grid;
  "lib/deck_key_content": typeof lib_deck_key_content;
  "lib/deck_keys": typeof lib_deck_keys;
  "lib/deck_tokens": typeof lib_deck_tokens;
  "lib/google_auth": typeof lib_google_auth;
  "lib/google_auth_redirect": typeof lib_google_auth_redirect;
  "lib/light_validation": typeof lib_light_validation;
  "lib/marketplace_affiliate_import": typeof lib_marketplace_affiliate_import;
  "lib/marketplace_affiliate_urls": typeof lib_marketplace_affiliate_urls;
  "lib/marketplace_catalog": typeof lib_marketplace_catalog;
  "lib/marketplace_page_templates": typeof lib_marketplace_page_templates;
  "lib/marketplace_payment_provider": typeof lib_marketplace_payment_provider;
  "lib/marketplace_validation": typeof lib_marketplace_validation;
  "lib/owned_status": typeof lib_owned_status;
  "lib/public_links": typeof lib_public_links;
  "lib/screen_settings": typeof lib_screen_settings;
  "lib/sports_leagues": typeof lib_sports_leagues;
  "lib/timbre_access": typeof lib_timbre_access;
  "lib/timbre_commerce": typeof lib_timbre_commerce;
  "lib/timbre_presence": typeof lib_timbre_presence;
  "lib/timbre_push": typeof lib_timbre_push;
  "lib/timbre_recurring_provider": typeof lib_timbre_recurring_provider;
  "lib/timbre_rtc": typeof lib_timbre_rtc;
  "lib/viso_preset_states": typeof lib_viso_preset_states;
  "lib/vu_styles": typeof lib_vu_styles;
  "lib/webhook_payload": typeof lib_webhook_payload;
  lights: typeof lights;
  marketplace: typeof marketplace;
  marketplace_apply: typeof marketplace_apply;
  marketplace_files: typeof marketplace_files;
  marketplace_import: typeof marketplace_import;
  marketplace_pages: typeof marketplace_pages;
  marketplace_payment_http: typeof marketplace_payment_http;
  marketplace_payments: typeof marketplace_payments;
  media: typeof media;
  public_status: typeof public_status;
  social_auth: typeof social_auth;
  sports: typeof sports;
  statuses: typeof statuses;
  timbre: typeof timbre;
  timbre_calls: typeof timbre_calls;
  timbre_calls_tables: typeof timbre_calls_tables;
  timbre_commerce: typeof timbre_commerce;
  timbre_commerce_tables: typeof timbre_commerce_tables;
  timbre_presence: typeof timbre_presence;
  timbre_presence_tables: typeof timbre_presence_tables;
  timbre_push: typeof timbre_push;
  timbre_push_tables: typeof timbre_push_tables;
  timbre_recurring: typeof timbre_recurring;
  timbre_recurring_http: typeof timbre_recurring_http;
  timbre_recurring_tables: typeof timbre_recurring_tables;
  timbre_setup: typeof timbre_setup;
  timbre_tables: typeof timbre_tables;
  users: typeof users;
  weather: typeof weather;
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
