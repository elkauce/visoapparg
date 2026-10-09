import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { VISO_STATES, type VisoStatusRecord } from "../_lib/viso-states.ts";
import VisoStateScreen, {
  type VisoStateScreenProps,
} from "./viso-state-screen.tsx";

const statuses: VisoStatusRecord[] = VISO_STATES.map((definition) => ({
  _id: definition.key as Id<"statuses">,
  name: definition.name,
  color: "#123456",
  icon: "coffee",
}));

function props(
  overrides: Partial<VisoStateScreenProps> = {},
): VisoStateScreenProps {
  return {
    statuses,
    activeStatusId: null,
    pending: false,
    connected: true,
    onSelect: vi.fn(),
    onConfigureLights: vi.fn(),
    ...overrides,
  };
}

function stateButtons() {
  return within(screen.getByRole("group", { name: "Seleccionar estado VISO" }));
}

describe("VISO state screen", () => {
  it("shows exactly the six requested state buttons in order", () => {
    render(<VisoStateScreen {...props()} />);
    expect(
      stateButtons()
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      "LIBRE",
      "OCUPADO",
      "REUNIÓN",
      "LLAMADA",
      "NO MOLESTAR",
      "AUSENTE",
    ]);
  });

  it.each(VISO_STATES)(
    "uses the real saved id when choosing $label",
    (definition) => {
      const onSelect = vi.fn();
      render(<VisoStateScreen {...props({ onSelect })} />);
      fireEvent.click(
        stateButtons().getByRole("button", { name: definition.label }),
      );
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(
        definition,
        definition.key,
      );
    },
  );

  it("only requests creation of a missing state after an explicit click", () => {
    const onSelect = vi.fn();
    render(
      <VisoStateScreen
        {...props({
          onSelect,
          statuses: statuses.filter((status) => status.name !== "No molestar"),
        })}
      />,
    );
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTitle(/se creará este estado/)).toBeInTheDocument();
    const missing = stateButtons().getByRole("button", { name: "NO MOLESTAR" });
    expect(missing).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(missing);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(VISO_STATES[4], null);
  });

  it("changes the active marker only when the saved id arrives, preserving the user's color", () => {
    const initial = props({ activeStatusId: statuses[0]._id });
    const { rerender } = render(<VisoStateScreen {...initial} />);
    fireEvent.click(stateButtons().getByRole("button", { name: "OCUPADO" }));
    expect(
      stateButtons().getByRole("button", { name: "LIBRE" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      stateButtons().getByRole("button", { name: "OCUPADO" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Estado sincronizado: LIBRE",
    );
    rerender(<VisoStateScreen {...initial} activeStatusId={statuses[1]._id} />);
    const active = stateButtons().getByRole("button", { name: "OCUPADO" });
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active).toHaveStyle({ backgroundColor: "#123456" });
    expect(active.querySelector("svg")).toHaveClass("lucide-coffee");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Estado sincronizado: OCUPADO",
    );
  });

  it("disables changes offline and labels the last received state accurately", () => {
    const onSelect = vi.fn();
    render(
      <VisoStateScreen
        {...props({
          connected: false,
          activeStatusId: statuses[2]._id,
          onSelect,
        })}
      />,
    );
    for (const button of stateButtons().getAllByRole("button")) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sin conexión · Último estado recibido: REUNIÓN",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "Estado sincronizado",
    );
  });

  it("prevents repeated activation while the actual mutation is pending", () => {
    const onSelect = vi.fn();
    render(<VisoStateScreen {...props({ pending: true, onSelect })} />);
    for (const button of stateButtons().getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Guardando estado…");
  });

  it("opens Google Home configuration without adding another state or navigating", () => {
    const onConfigureLights = vi.fn();
    const onSelect = vi.fn();
    render(<VisoStateScreen {...props({ onConfigureLights, onSelect })} />);
    fireEvent.click(screen.getByRole("button", { name: "Luces Google Home" }));
    expect(onConfigureLights).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    expect(stateButtons().getAllByRole("button")).toHaveLength(6);
  });
});
