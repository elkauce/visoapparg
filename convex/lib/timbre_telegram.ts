const RESERVED_TELEGRAM_PATHS = new Set([
  "addstickers",
  "addemoji",
  "addtheme",
  "addlist",
  "share",
  "joinchat",
  "login",
  "proxy",
  "socks",
  "boost",
  "giftcode",
  "invoice",
  "confirmphone",
  "setlanguage",
  "premium_offer",
  "contact",
  "iv",
  "c",
  "s",
  "bg",
]);

/** Accept only ordinary public usernames, never telephone-number links,
 * invitations, arbitrary URLs or Telegram actions. No provider request is made. */
export function normalizeTimbreTelegramUsername(value: string): string | null {
  if (
    value.length > 256 ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return null;
  let username = value.trim();
  if (/^(?:https:\/\/)?t\.me\//i.test(username)) {
    // Match the original string rather than normalizing URL dot segments,
    // decoding escapes or allowing an empty query/hash to disappear.
    const link = /^(?:https:\/\/)?t\.me\/([^/]+)\/?$/i.exec(username);
    if (!link) return null;
    username = link[1];
  } else if (username.startsWith("@")) username = username.slice(1);

  if (!/^[a-zA-Z][a-zA-Z0-9_]{3,30}[a-zA-Z0-9]$/.test(username)) return null;
  const normalized = username.toLowerCase();
  return RESERVED_TELEGRAM_PATHS.has(normalized) ? null : normalized;
}

export function timbreTelegramUrl(value: string): string | null {
  const username = normalizeTimbreTelegramUsername(value);
  return username ? `https://t.me/${username}` : null;
}
