import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import TelegramContactSettings from "./telegram-settings";

const fixture = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(reference) !== "timbre_telegram:saveContact")
      throw new Error("Unexpected mutation");
    return fixture.save;
  },
}));

const siteId = "site-1" as Id<"timbreSites">;
const unitId = "unit-1" as Id<"timbreUnits">;
const consent = () =>
  screen.getByRole("checkbox", { name: /Confirmo que el perfil es correcto/ });
const input = () =>
  screen.getByRole("textbox", { name: "Usuario de Telegram" });

beforeEach(() => {
  fixture.save.mockReset();
  fixture.save.mockResolvedValue({
    username: "visitantes_viso",
    url: "https://t.me/visitantes_viso",
  });
});

describe("Telegram contact settings", () => {
  it("offers an explicit safe profile check and never links an arbitrary input", async () => {
    const user = userEvent.setup();
    render(<TelegramContactSettings siteId={siteId} canEnable />);
    await user.type(input(), "https://t.me/Visitantes_Viso");
    const profile = screen.getByRole("link", { name: "Comprobar perfil" });
    expect(profile).toHaveAttribute("href", "https://t.me/visitantes_viso");
    expect(profile).toHaveAttribute("target", "_blank");
    expect(profile).toHaveAttribute("rel", "noopener noreferrer");
    expect(profile).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(fixture.save).not.toHaveBeenCalled();
    await user.clear(input());
    await user.type(input(), "https://evil.example/visitantes_viso");
    expect(
      screen.queryByRole("link", { name: "Comprobar perfil" }),
    ).not.toBeInTheDocument();
  });

  it("saves only after explicit consent for the current alias", async () => {
    const user = userEvent.setup();
    render(<TelegramContactSettings siteId={siteId} canEnable />);
    await user.type(input(), "@visitantes_viso");
    expect(fixture.save).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Guardar Telegram" }),
    ).toBeDisabled();
    await user.click(consent());
    expect(
      screen.getByRole("button", { name: "Guardar Telegram" }),
    ).toBeEnabled();
    await user.type(input(), "2");
    expect(consent()).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Guardar Telegram" }),
    ).toBeDisabled();
    await user.click(consent());
    await user.click(screen.getByRole("button", { name: "Guardar Telegram" }));
    expect(fixture.save).toHaveBeenCalledExactlyOnceWith({
      siteId,
      username: "@visitantes_viso2",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Telegram guardado",
    );
  });

  it("saves the selected unit's contact and leaves other units untouched", async () => {
    const user = userEvent.setup();
    render(
      <TelegramContactSettings siteId={siteId} unitId={unitId} canEnable />,
    );
    await user.type(input(), "https://t.me/visitantes_viso");
    await user.click(consent());
    await user.click(screen.getByRole("button", { name: "Guardar Telegram" }));
    expect(fixture.save).toHaveBeenCalledExactlyOnceWith({
      siteId,
      unitId,
      username: "https://t.me/visitantes_viso",
    });
  });

  it("allows removing a saved contact when enabling is unavailable", async () => {
    const user = userEvent.setup();
    fixture.save.mockResolvedValue({ username: null, url: null });
    render(
      <TelegramContactSettings
        siteId={siteId}
        unitId={unitId}
        username="visitantes_viso"
        canEnable={false}
      />,
    );
    expect(input()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Guardar Telegram" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Quitar Telegram" }));
    expect(fixture.save).toHaveBeenCalledExactlyOnceWith({
      siteId,
      unitId,
      username: null,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Telegram quitado",
    );
  });

  it("keeps the edit and shows a server validation error so the owner can correct it", async () => {
    const user = userEvent.setup();
    fixture.save.mockRejectedValue(
      new Error("Usá un usuario válido de Telegram."),
    );
    render(<TelegramContactSettings siteId={siteId} canEnable />);
    await user.type(input(), "+541112345678");
    await user.click(consent());
    await user.click(screen.getByRole("button", { name: "Guardar Telegram" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "usuario válido",
    );
    expect(input()).toHaveValue("+541112345678");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar Telegram" }),
    ).toBeEnabled();
  });

  it("reflects remote updates while idle, protects a draft, and resets when switching units", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TelegramContactSettings
        siteId={siteId}
        username="primero_viso"
        canEnable
      />,
    );
    rerender(
      <TelegramContactSettings
        siteId={siteId}
        username="segundo_viso"
        canEnable
      />,
    );
    expect(input()).toHaveValue("segundo_viso");
    await user.clear(input());
    await user.type(input(), "mi_borrador");
    await user.click(consent());
    rerender(
      <TelegramContactSettings
        siteId={siteId}
        username="actualizado_remoto"
        canEnable
      />,
    );
    expect(input()).toHaveValue("mi_borrador");
    expect(consent()).toBeChecked();
    rerender(
      <TelegramContactSettings
        siteId={siteId}
        unitId={unitId}
        username="unidad_distinta"
        canEnable
      />,
    );
    expect(input()).toHaveValue("unidad_distinta");
    expect(consent()).not.toBeChecked();
    expect(fixture.save).not.toHaveBeenCalled();
  });

  it("prevents a second save or removal while a save is pending", async () => {
    const user = userEvent.setup();
    let complete!: () => void;
    fixture.save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    render(
      <TelegramContactSettings
        siteId={siteId}
        username="visitantes_viso"
        canEnable
      />,
    );
    await user.click(consent());
    await user.click(screen.getByRole("button", { name: "Guardar Telegram" }));
    expect(input()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Quitar Telegram" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Quitar Telegram" }));
    expect(fixture.save).toHaveBeenCalledOnce();
    complete();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Guardar Telegram" }),
      ).toBeDisabled(),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Telegram guardado",
    );
  });
});
