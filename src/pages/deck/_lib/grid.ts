export type GridPreference = {
  slots: number;
  columns: number;
};

export const DEFAULT_GRID_PREFERENCE: Readonly<GridPreference> = {
  slots: 15,
  columns: 5,
};

export const MIN_GRID_SLOTS = 1;
export const MAX_GRID_SLOTS = 64;
export const GRID_GAP = 12;
export const MIN_TILE_SIZE = 96;

export type DeckGridInput = {
  slots: number;
  preferredColumns: number;
  /** Width and height available to the grid after the header and page padding. */
  viewportWidth: number;
  viewportHeight: number;
};

export type DeckGridLayout = {
  columns: number;
  rows: number;
  gap: number;
  tileMinHeight: number;
  tileMinWidth: number;
  tileHeight: number;
  tileWidth: number;
  minHeight: number;
  minWidth: number;
  overflowY: boolean;
  overflowX: boolean;
};

function boundedInteger(value: number, fallback: number, maximum: number) {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(maximum, Math.trunc(value)))
    : Math.min(fallback, maximum);
}

/** Keep normal desktop proportions while preventing unreadable mobile tiles. */
export function resolveDeckGrid({
  slots: requestedSlots,
  preferredColumns,
  viewportWidth,
  viewportHeight,
}: DeckGridInput): DeckGridLayout {
  const slots = boundedInteger(
    requestedSlots,
    DEFAULT_GRID_PREFERENCE.slots,
    MAX_GRID_SLOTS,
  );
  let columns = boundedInteger(
    preferredColumns,
    DEFAULT_GRID_PREFERENCE.columns,
    slots,
  );
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const height = Number.isFinite(viewportHeight)
    ? Math.max(0, viewportHeight)
    : 0;

  if (width > 0 && height > width) {
    // Only the conventional presets adapt to a portrait arrangement. Other
    // explicit column choices remain intact whenever the available width fits.
    if (slots === 15 && columns === 5) columns = 3;
    else if (slots === 6 && columns === 3) columns = 2;
    else if (slots === 32 && columns === 8) columns = 4;
  }

  if (width > 0) {
    const fittingColumns = Math.max(
      1,
      Math.floor((width + GRID_GAP) / (MIN_TILE_SIZE + GRID_GAP)),
    );
    columns = Math.min(columns, fittingColumns);
  }

  const rows = Math.ceil(slots / columns);
  const minHeight = rows * MIN_TILE_SIZE + (rows - 1) * GRID_GAP;
  const minWidth = columns * MIN_TILE_SIZE + (columns - 1) * GRID_GAP;

  return {
    columns,
    rows,
    gap: GRID_GAP,
    tileMinHeight: MIN_TILE_SIZE,
    tileMinWidth: MIN_TILE_SIZE,
    tileHeight: Math.max(
      MIN_TILE_SIZE,
      (height - (rows - 1) * GRID_GAP) / rows,
    ),
    tileWidth: Math.max(
      MIN_TILE_SIZE,
      (width - (columns - 1) * GRID_GAP) / columns,
    ),
    minHeight,
    minWidth,
    overflowY: height > 0 && minHeight > height,
    overflowX: width > 0 && minWidth > width,
  };
}

export function isGridPreference(value: unknown): value is GridPreference {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<GridPreference>;
  return (
    typeof candidate.slots === "number" &&
    Number.isInteger(candidate.slots) &&
    candidate.slots >= MIN_GRID_SLOTS &&
    candidate.slots <= MAX_GRID_SLOTS &&
    typeof candidate.columns === "number" &&
    Number.isInteger(candidate.columns) &&
    candidate.columns >= 1 &&
    candidate.columns <= candidate.slots
  );
}

export function parseGridPreference(value: string | null): GridPreference {
  try {
    const parsed: unknown = value === null ? null : JSON.parse(value);
    if (isGridPreference(parsed)) {
      return { slots: parsed.slots, columns: parsed.columns };
    }
  } catch {
    // Missing or corrupt preferences must never prevent a deck from opening.
  }
  return { ...DEFAULT_GRID_PREFERENCE };
}

type GridPreferenceReader = Pick<Storage, "getItem">;
type GridPreferenceWriter = Pick<Storage, "setItem">;

/** Access can throw in embedded browsers and when browser storage is disabled. */
export function getGridPreferenceStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function gridPreferenceStorageKey(
  accountId: string | null | undefined,
  pageId: string | null | undefined,
): string | null {
  if (!accountId || !pageId) return null;
  return `viso:deck:grid:${encodeURIComponent(accountId)}:${encodeURIComponent(pageId)}`;
}

/** Reading a preference never writes a default or changes existing layouts. */
export function readGridPreference(
  storage: GridPreferenceReader | null,
  accountId: string | null | undefined,
  pageId: string | null | undefined,
): GridPreference {
  return (
    readSavedGridPreference(storage, accountId, pageId) ?? {
      ...DEFAULT_GRID_PREFERENCE,
    }
  );
}

/** A missing local preference lets an explicitly configured server grid apply. */
export function readSavedGridPreference(
  storage: GridPreferenceReader | null,
  accountId: string | null | undefined,
  pageId: string | null | undefined,
): GridPreference | null {
  const key = gridPreferenceStorageKey(accountId, pageId);
  try {
    const saved = storage && key ? storage.getItem(key) : null;
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    return isGridPreference(parsed)
      ? { slots: parsed.slots, columns: parsed.columns }
      : null;
  } catch {
    return null;
  }
}

/** Call only after an explicit choice; persisted data contains no credentials. */
export function writeGridPreference(
  storage: GridPreferenceWriter | null,
  accountId: string | null | undefined,
  pageId: string | null | undefined,
  preference: GridPreference,
): boolean {
  const key = gridPreferenceStorageKey(accountId, pageId);
  if (!storage || !key || !isGridPreference(preference)) return false;
  try {
    storage.setItem(
      key,
      JSON.stringify({ slots: preference.slots, columns: preference.columns }),
    );
    return true;
  } catch {
    return false;
  }
}
