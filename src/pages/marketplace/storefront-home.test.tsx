import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryTiles, StoreCarousel } from "./storefront-home";
import { DEFAULT_STOREFRONT, storeMediaSource } from "./storefront-model";
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("Storefront carousel and category media", () => {
  it("removes the entire slider when disabled and keeps category destinations accessible with hidden names", () => {
    const config = structuredClone(DEFAULT_STOREFRONT);
    config.showSlider = false;
    config.categories[0].showName = false;
    render(
      <MemoryRouter>
        <StoreCarousel configuration={config} />
        <CategoryTiles configuration={config} />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("region", { name: "Destacados de VISO" }),
    ).not.toBeInTheDocument();
    const category = screen.getByRole("link", { name: "Iconos animados" });
    expect(category).toHaveAttribute("href", "/marketplace?category=icons");
    expect(category).not.toHaveTextContent("Iconos animados");
  });
  it("advances automatically, pauses on interaction and supports explicit previous/next", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <StoreCarousel configuration={DEFAULT_STOREFRONT} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Tus estados cobran vida" }),
    ).toBeVisible();
    act(() => vi.advanceTimersByTime(6000));
    expect(
      screen.getByRole("heading", { name: "Tu clima, a la vista" }),
    ).toBeVisible();
    fireEvent.mouseEnter(
      screen.getByRole("region", { name: "Destacados de VISO" }),
    );
    act(() => vi.advanceTimersByTime(6000));
    expect(
      screen.getByRole("heading", { name: "Tu clima, a la vista" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(
      screen.getByRole("heading", { name: "Tus estados cobran vida" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Slide siguiente" }));
    expect(
      screen.getByRole("heading", { name: "Tu clima, a la vista" }),
    ).toBeVisible();
  });
  it("respects reduced motion while retaining manual navigation", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(
      <MemoryRouter>
        <StoreCarousel configuration={DEFAULT_STOREFRONT} />
      </MemoryRouter>,
    );
    act(() => vi.advanceTimersByTime(20000));
    expect(
      screen.getByRole("heading", { name: "Tus estados cobran vida" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Slide siguiente" }));
    expect(
      screen.getByRole("heading", { name: "Tu clima, a la vista" }),
    ).toBeVisible();
  });
  it("rejects unsafe media locations while accepting controlled previews", () => {
    for (const url of [
      "javascript:alert(1)",
      "https://user:password@example.test/image.png",
      "/marketplace/../private.png",
      "//other.example/image.png",
    ]) {
      expect(storeMediaSource({ url })).toBeNull();
    }
    expect(
      storeMediaSource({ builtinPath: "/marketplace/animated/libre.mp4" }),
    ).toBe("/marketplace/animated/libre.mp4");
  });
});
