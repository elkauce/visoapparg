import { ConvexError, v } from "convex/values";

export const deckGrid = v.object({ columns: v.number(), rows: v.number() });
export const DEFAULT_GRID = { columns: 5, rows: 3 } as const;
export const MAX_SLOTS_PER_PAGE = 64;

export function validateGrid(grid: { columns: number; rows: number }) {
  if (
    !Number.isInteger(grid.columns) ||
    !Number.isInteger(grid.rows) ||
    grid.columns < 1 ||
    grid.rows < 1 ||
    grid.columns > 16 ||
    grid.rows > 16 ||
    grid.columns * grid.rows > MAX_SLOTS_PER_PAGE
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `La cuadrícula debe tener entre 1 y ${MAX_SLOTS_PER_PAGE} posiciones`,
    });
  }
  return grid;
}

export function pageSlots(page: { grid?: { columns: number; rows: number } }) {
  const grid = page.grid ?? DEFAULT_GRID;
  return grid.columns * grid.rows;
}

export function validatePosition(
  position: number,
  page: Parameters<typeof pageSlots>[0],
) {
  if (
    !Number.isInteger(position) ||
    position < 0 ||
    position >= pageSlots(page)
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Posición inválida",
    });
  }
}
