import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";
import AccountPanel from "./account-panel";
import AdminCustomers from "./admin-customers";

const f = vi.hoisted(() => ({
  profile: {
    id: "owner",
    name: "Ana",
    email: "ana@fixture.example",
    contactPhone: "",
    isAdmin: false,
    canLinkDeck: false,
    deckLinked: false,
    enrolled: true,
    updatedAt: 10,
  },
  customer: {
    id: "owner",
    name: "Ana",
    email: "ana@fixture.example",
    contactPhone: "",
    updatedAt: 10,
    spaces: [
      {
        id: "space",
        name: "Casa",
        enabled: true,
        updatedAt: 20,
        digital: false,
      },
    ],
    qrs: [],
    sites: [],
    business: [],
    licenses: [],
    events: [],
  },
  save: vi.fn(),
  adminSave: vi.fn(),
  doorbellSave: vi.fn(),
  directory: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "teaviso_accounts:profile"
      ? f.profile
      : f.customer,
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    ({
      "teaviso_accounts:saveProfile": f.save,
      "teaviso_accounts:adminSaveProfile": f.adminSave,
      "teaviso_accounts:adminSaveDoorbell": f.doorbellSave,
    })[getFunctionName(ref)],
  usePaginatedQuery: (_ref: unknown, args: unknown) => {
    f.directory(args);
    return {
      results: [{ id: "owner", name: "Ana", email: "ana@fixture.example" }],
      status: "Exhausted",
      loadMore: vi.fn(),
    };
  },
}));
beforeEach(() => {
  f.profile.canLinkDeck = false;
  f.profile.deckLinked = false;
  for (const fn of [f.save, f.adminSave, f.doorbellSave, f.directory])
    fn.mockReset();
  f.save.mockResolvedValue(null);
  f.adminSave.mockResolvedValue(null);
  f.doorbellSave.mockResolvedValue(null);
});
const mount = (node: React.ReactNode) =>
  render(<MemoryRouter>{node}</MemoryRouter>);
it("keeps the customer account and doorbell management inside Te Aviso", () => {
  mount(<AccountPanel />);
  expect(
    screen.getByRole("heading", { name: "Mi cuenta", exact: true }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Administrar mis timbres" }),
  ).toHaveAttribute("href", "/panel/timbres");
  expect(screen.queryByRole("link", { name: /VISO/ })).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Gestionar mi cuenta VISO/),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
    "readonly",
  );
});
it("saves contact details locally without redirecting to the VISO account page", async () => {
  mount(<AccountPanel />);
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Nombre"));
  await user.type(screen.getByLabelText("Nombre"), "Ana Consultorio");
  await user.type(
    screen.getByLabelText("Teléfono de contacto"),
    "5491112345678",
  );
  await user.click(screen.getByRole("button", { name: "Guardar mis datos" }));
  await waitFor(() =>
    expect(f.save).toHaveBeenCalledWith({
      name: "Ana Consultorio",
      contactPhone: "5491112345678",
      expectedUpdatedAt: 10,
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "se guardaron en Te Aviso",
  );
});
it("shows the optional Deck access only when the backend verifies its connection", async () => {
  f.profile.canLinkDeck = true;
  f.profile.deckLinked = true;
  mount(<AccountPanel />);
  expect(
    screen.getByRole("link", { name: "Abrir mi Deck VISO ↗" }),
  ).toHaveAttribute("href", "https://viso-deck-android.vercel.app/deck");
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar mis datos" }),
  );
  await waitFor(() =>
    expect(f.save).toHaveBeenCalledWith(
      expect.objectContaining({ deckLinked: false }),
    ),
  );
});
it("opens a local customer record and saves an audited doorbell change", async () => {
  mount(<AdminCustomers />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Ana.*Ver timbres/ }));
  expect(
    await screen.findByRole("heading", { name: "Timbres del cliente" }),
  ).toBeVisible();
  const summary = screen.getByText("Casa").closest("summary")!;
  await user.click(summary);
  const form = within(summary.closest("details")!);
  await user.clear(form.getByLabelText("Nombre del timbre"));
  await user.type(
    form.getByLabelText("Nombre del timbre"),
    "Entrada principal",
  );
  await user.click(form.getByLabelText("Timbre habilitado"));
  await user.type(
    form.getByLabelText("Motivo del cambio"),
    "A pedido del cliente",
  );
  await user.click(form.getByRole("button", { name: "Guardar timbre" }));
  await waitFor(() =>
    expect(f.doorbellSave).toHaveBeenCalledWith({
      userId: "owner",
      target: "space",
      id: "space",
      name: "Entrada principal",
      enabled: false,
      expectedUpdatedAt: 20,
      reason: "A pedido del cliente",
    }),
  );
  expect(await form.findByRole("status")).toHaveTextContent(
    "conserva su enlace",
  );
});
