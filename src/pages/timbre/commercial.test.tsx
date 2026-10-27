import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimbreCommercial from "./commercial";
import { defaultTimbreQrDesign } from "@/lib/timbre-qr";
import type { TimbreQrEditorProps } from "./qr-editor";

it("keeps owned licenses and subscriptions without displaying an acquisition catalogue in account-only mode", () => {
  render(<TimbreCommercial accountOnly />);
  expect(screen.getByRole("heading", { name: "Tus licencias" })).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Tus suscripciones" }),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Tus pedidos de placas" }),
  ).toBeVisible();
  expect(
    screen.queryByText("Un servicio dentro de tu cuenta VISO."),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Ofertas de Timbre" }),
  ).not.toBeInTheDocument();
  expect(fixture.query).toHaveBeenCalledWith("timbre_commerce:catalog", "skip");
});

const fixture = vi.hoisted(() => ({
  catalog: [] as Array<Record<string, unknown>>,
  sites: [] as Array<Record<string, unknown>>,
  qrs: [] as Array<Record<string, unknown>>,
  qrLoading: false,
  editor: vi.fn(),
  query: vi.fn(),
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  actions: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("convex/react", () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    const name = getFunctionName(reference);
    fixture.query(name, args);
    if (args === "skip") return undefined;
    if (name === "timbre_commerce:catalog") return fixture.catalog;
    if (name === "timbre:workspace")
      return { sites: fixture.sites, memberships: [] };
    if (name === "timbre:listQrs") return fixture.qrs;
    if (name === "timbre:qrForExport")
      return fixture.qrLoading
        ? undefined
        : {
            qr: fixture.qrs.find(
              (qr) => qr._id === (args as { qrId: string }).qrId,
            ),
          };
    if (name === "timbre_commerce:shippingOptions")
      return [
        {
          _id: "shipping-1",
          name: "Entrega configurada",
          country: "AR",
          regions: [],
          priceAmount: 1000,
          currency: "ARS",
          terms: "Condiciones acordadas con VISO.",
        },
      ];
    return [];
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    fixture.mutations[name] ??= vi.fn(async () => ({}));
    return fixture.mutations[name];
  },
  useAction: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    fixture.actions[name] ??= vi.fn(async () => ({}));
    return fixture.actions[name];
  },
}));
vi.mock("./qr-editor", () => ({
  default: (props: TimbreQrEditorProps) => {
    fixture.editor(props);
    const { initialDesign, onDesignChange } = props;
    return (
      <div>
        <p data-testid="production-preview-title">{initialDesign?.title}</p>
        <button
          type="button"
          onClick={() =>
            initialDesign &&
            onDesignChange?.({
              ...initialDesign,
              title: "Edición pendiente del primer QR",
            })
          }
        >
          Modificar diseño de prueba
        </button>
      </div>
    );
  },
}));

function offer(variants: Array<Record<string, unknown>> = []) {
  return {
    code: "personalizado",
    title: "Placa VISO",
    description: "Configuración comercial real",
    configured: true,
    buyable: true,
    plans: [],
    variants,
    eligibleProducts: [],
    blockReason: null,
  };
}
function variant(patch: Record<string, unknown> = {}) {
  return {
    id: "variant-1",
    name: "Placa elegida",
    material: "Material configurado",
    widthMm: 150,
    heightMm: 200,
    priceAmount: 10000,
    currency: "ARS",
    availability: "available",
    warranty: "Garantía configurada",
    includedPlanId: null,
    buyable: true,
    ...patch,
  };
}
function qr(id = "qr-1", title = "Diseño guardado de mi entrada") {
  return {
    _id: id,
    label: `Entrada ${id}`,
    token: (id === "qr-1" ? "a" : "b").repeat(64),
    enabled: true,
    design: {
      ...defaultTimbreQrDesign(),
      title,
      familyName: "Familia real",
      backgroundColor: "#EAF0F5",
      widthMm: 100,
      heightMm: 150,
    },
  };
}
beforeEach(() => {
  fixture.catalog = [offer([variant()])];
  fixture.sites = [
    { _id: "site-1", name: "Mi Timbre", role: "owner", licenseActive: true },
  ];
  fixture.qrs = [qr()];
  fixture.query.mockClear();
  fixture.qrLoading = false;
  fixture.editor.mockClear();
  fixture.mutations = {};
  fixture.actions = {};
});

async function completeAddress(user: ReturnType<typeof userEvent.setup>) {
  const form = within(
    screen.getByRole("region", { name: "Personalizar placa" }),
  );
  for (const [label, value] of [
    ["Nombre y apellido", "Cliente VISO"],
    ["Calle, número y unidad", "Calle 123"],
    ["Ciudad", "Buenos Aires"],
    ["Provincia o región", "Buenos Aires"],
    ["Código postal", "1000"],
    ["País (código ISO, por ejemplo AR)", "AR"],
    ["Teléfono de entrega", "1112345678"],
  ])
    await user.type(form.getByRole("textbox", { name: label }), value);
  await user.selectOptions(
    form.getByRole("combobox", { name: "Envío disponible" }),
    "shipping-1",
  );
  await user.click(form.getByRole("checkbox", { name: /Confirmo los textos/ }));
  return form;
}

describe("Timbre commercial safety and plate design", () => {
  it("does not enable a checkout before the backend marks a paid plan buyable", () => {
    fixture.catalog = [
      {
        ...offer(),
        code: "digital",
        plans: [
          {
            id: "plan-1",
            name: "Pago único",
            description: "Plan configurado",
            priceAmount: 12000,
            currency: "ARS",
            period: "one_time",
            durationDays: 365,
            features: {
              audio: true,
              video: false,
              chat: false,
              messages: true,
              buildings: false,
            },
            limits: { maxSites: 1, maxQrs: 1, maxMembers: 2 },
            buyable: false,
          },
        ],
      },
    ];
    render(<TimbreCommercial />);
    expect(
      screen.getByRole("button", { name: "Contratar en Mercado Pago" }),
    ).toBeDisabled();
    expect(
      fixture.actions["timbre_commerce:createCheckout"],
    ).not.toHaveBeenCalled();
    expect(
      screen.getByText(/cuenta y los recursos gratuitos/),
    ).toBeInTheDocument();
  });
  it("orders the same saved QR design that is previewed, including the chosen material dimensions", async () => {
    const user = userEvent.setup();
    render(<TimbreCommercial />);
    await user.click(
      screen.getByRole("button", { name: "Personalizar placa" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "QR" }),
      "qr-1",
    );
    expect(screen.getByTestId("production-preview-title")).toHaveTextContent(
      "Diseño guardado de mi entrada",
    );
    expect(fixture.editor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fixedDimensions: { widthMm: 150, heightMm: 200 },
      }),
    );
    const form = await completeAddress(user);
    await user.click(
      form.getByRole("button", { name: "Guardar pedido y diseño" }),
    );
    await waitFor(() =>
      expect(
        fixture.mutations["timbre_commerce:createPlateOrder"],
      ).toHaveBeenCalledOnce(),
    );
    expect(
      fixture.mutations["timbre_commerce:createPlateOrder"],
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        qrId: "qr-1",
        variantId: "variant-1",
        design: {
          ...(fixture.qrs[0].design as object),
          widthMm: 150,
          heightMm: 200,
        },
        shippingOptionId: "shipping-1",
        shippingAddress: expect.objectContaining({
          name: "Cliente VISO",
          country: "AR",
        }),
      }),
    );
  });
  it("discards the previous QR's unsaved draft when choosing another QR", async () => {
    fixture.qrs.push(qr("qr-2", "Diseño de la segunda entrada"));
    const user = userEvent.setup();
    render(<TimbreCommercial />);
    await user.click(
      screen.getByRole("button", { name: "Personalizar placa" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "QR" }),
      "qr-1",
    );
    await user.click(
      screen.getByRole("button", { name: "Modificar diseño de prueba" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "QR" }),
      "qr-2",
    );
    const form = await completeAddress(user);
    await user.click(
      form.getByRole("button", { name: "Guardar pedido y diseño" }),
    );
    await waitFor(() =>
      expect(
        fixture.mutations["timbre_commerce:createPlateOrder"],
      ).toHaveBeenCalledOnce(),
    );
    expect(
      fixture.mutations["timbre_commerce:createPlateOrder"],
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        qrId: "qr-2",
        design: expect.objectContaining({
          title: "Diseño de la segunda entrada",
        }),
      }),
    );
  });
  it("does not let a plate without an included license be ordered without the user's active QR", async () => {
    fixture.sites = [
      {
        _id: "not-owned",
        name: "Timbre compartido",
        role: "resident",
        licenseActive: true,
      },
      {
        _id: "expired",
        name: "Licencia vencida",
        role: "owner",
        licenseActive: false,
      },
    ];
    const user = userEvent.setup();
    render(<TimbreCommercial />);
    await user.click(
      screen.getByRole("button", { name: "Personalizar placa" }),
    );
    expect(
      screen.getByRole("button", { name: "Guardar pedido y diseño" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Elegí un QR activo. Esta variante no incluye licencia.",
      ),
    ).toBeInTheDocument();
    expect(fixture.query).toHaveBeenCalledWith("timbre:listQrs", "skip");
    expect(
      fixture.mutations["timbre_commerce:createPlateOrder"],
    ).not.toHaveBeenCalled();
  });
  it("permits a configured bundle draft without a QR while clearly withholding the license until payment", async () => {
    fixture.catalog = [
      offer([variant({ includedPlanId: "paid-bundle-plan" })]),
    ];
    fixture.sites = [];
    const user = userEvent.setup();
    render(<TimbreCommercial />);
    await user.click(
      screen.getByRole("button", { name: "Personalizar placa" }),
    );
    expect(
      screen.getByText(/después del pago, creá y vinculá tu QR/),
    ).toBeInTheDocument();
    expect(fixture.editor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        previewOnly: true,
        url: "",
        fixedDimensions: { widthMm: 150, heightMm: 200 },
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Modificar diseño de prueba" }),
    );
    const form = await completeAddress(user);
    await user.click(
      form.getByRole("button", { name: "Guardar pedido y diseño" }),
    );
    await waitFor(() =>
      expect(
        fixture.mutations["timbre_commerce:createPlateOrder"],
      ).toHaveBeenCalledOnce(),
    );
    const args =
      fixture.mutations["timbre_commerce:createPlateOrder"].mock.calls[0][0];
    expect(args).not.toHaveProperty("qrId");
    expect(args).toHaveProperty("variantId", "variant-1");
    expect(args).toHaveProperty(
      "design.title",
      "Edición pendiente del primer QR",
    );
    expect(
      fixture.actions["timbre_commerce:createCheckout"],
    ).not.toHaveBeenCalled();
  });
  it("waits for the full saved design before allowing an order with a selected QR", async () => {
    fixture.qrLoading = true;
    const user = userEvent.setup();
    const view = render(<TimbreCommercial />);
    await user.click(
      screen.getByRole("button", { name: "Personalizar placa" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "QR" }),
      "qr-1",
    );
    expect(
      screen.getByText("Cargando el diseño guardado…"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar pedido y diseño" }),
    ).toBeDisabled();
    expect(
      fixture.mutations["timbre_commerce:createPlateOrder"],
    ).not.toHaveBeenCalled();
    fixture.qrLoading = false;
    view.rerender(<TimbreCommercial />);
    expect(screen.getByTestId("production-preview-title")).toHaveTextContent(
      "Diseño guardado de mi entrada",
    );
    expect(
      screen.getByRole("button", { name: "Guardar pedido y diseño" }),
    ).toBeEnabled();
  });
});
