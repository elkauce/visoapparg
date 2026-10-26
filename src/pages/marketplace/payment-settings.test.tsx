import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketplacePaymentSettings, {
  CreatorPaymentConnection,
} from "./payment-settings";
import { percentToBps } from "@/lib/marketplace-payments";
import ProductCheckout, { MarketplaceOrders } from "./checkout";
import type { MarketProduct } from "./types";

const fixture = vi.hoisted(() => ({
  configuration: {} as Record<string, unknown>,
  account: { connected: false } as Record<string, unknown>,
  orders: [] as unknown[],
  save: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  checkout: vi.fn(),
  open: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference);
    return name.endsWith(":configuration")
      ? fixture.configuration
      : name.endsWith(":account")
        ? fixture.account
        : fixture.orders;
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference).endsWith(":saveSettings")
      ? fixture.save
      : fixture.disconnect,
  useAction: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference).endsWith(":beginConnection")
      ? fixture.connect
      : fixture.checkout,
}));
vi.mock("@/lib/android-native", () => ({ isAndroidNative: () => true }));
vi.mock("@/lib/marketplace-navigation", () => ({
  openMarketplaceAsset: fixture.open,
}));

beforeEach(() => {
  fixture.configuration = {
    isAdmin: true,
    configured: false,
    connectionReady: false,
    enabled: false,
    mode: "test",
    digitalCommissionBps: null,
    hardwareCommissionBps: null,
    requestedEnabled: false,
    splitApproved: false,
    policiesAccepted: false,
  };
  fixture.account = { connected: false };
  fixture.orders = [];
  fixture.save.mockReset().mockResolvedValue(null);
  fixture.disconnect.mockReset().mockResolvedValue(null);
  fixture.connect.mockReset().mockResolvedValue({
    authorizationUrl: "https://auth.mercadopago.com.ar/authorization",
  });
  fixture.checkout.mockReset().mockResolvedValue({
    checkoutUrl: "https://sandbox.mercadopago.com.ar/pay",
    orderId: "order1",
  });
  fixture.open.mockReset().mockResolvedValue(undefined);
});

const paid: MarketProduct = {
  id: "paid1",
  title: "Iconos",
  description: "Iconos originales",
  category: "icons",
  creatorName: "Creador",
  priceMode: "paid",
  priceAmount: 10000,
  currency: "ARS",
  delivery: "assets",
  affiliate: false,
  status: "published",
  builtin: false,
  acquired: false,
  owned: false,
  assetCount: 1,
};

describe("Payment administration and creator setup", () => {
  it("starts without an invented commission and saves percentages in basis points while disabled", async () => {
    render(<MarketplacePaymentSettings />);
    const digital = screen.getByLabelText("Comisión de recursos digitales (%)");
    expect(digital).toHaveValue("");
    expect(
      screen.getByRole("checkbox", { name: /Habilitar pagos/ }),
    ).toBeDisabled();
    fireEvent.change(digital, { target: { value: "12,50" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar configuración" }),
    );
    await waitFor(() =>
      expect(fixture.save).toHaveBeenCalledWith({
        digitalCommissionBps: 1250,
        hardwareCommissionBps: undefined,
        enabled: false,
        splitApproved: false,
        policiesAccepted: false,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Configuración guardada",
    );
  });
  it("validates rates before sending and accepts zero commission", async () => {
    render(<MarketplacePaymentSettings />);
    fireEvent.change(screen.getByLabelText("Comisión de hardware (%)"), {
      target: { value: "101" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar configuración" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/100%/);
    expect(fixture.save).not.toHaveBeenCalled();
    expect(percentToBps("0")).toBe(0);
    expect(percentToBps("12.34")).toBe(1234);
    expect(() => percentToBps("1.234")).toThrow();
  });
  it("exposes no settings to a non-admin and disables unavailable OAuth", () => {
    fixture.configuration.isAdmin = false;
    const rendered = render(<MarketplacePaymentSettings />);
    expect(rendered.container).toBeEmptyDOMElement();
    render(<CreatorPaymentConnection />);
    expect(
      screen.getByRole("button", { name: "Conectar Mercado Pago" }),
    ).toBeDisabled();
    expect(screen.getByText(/nunca te pide la contraseña/)).toBeVisible();
  });
  it("opens provider authorization on Android and allows disconnect without exposing tokens", async () => {
    fixture.configuration.connectionReady = true;
    const rendered = render(<CreatorPaymentConnection />);
    fireEvent.click(
      screen.getByRole("button", { name: "Conectar Mercado Pago" }),
    );
    await waitFor(() =>
      expect(fixture.open).toHaveBeenCalledWith(
        "https://auth.mercadopago.com.ar/authorization",
      ),
    );
    fixture.account = { connected: true, providerUserId: "123" };
    rendered.rerender(<CreatorPaymentConnection />);
    fireEvent.click(
      screen.getByRole("button", { name: "Desvincular de VISO" }),
    );
    await waitFor(() => expect(fixture.disconnect).toHaveBeenCalledWith({}));
  });
});

describe("Customer checkout", () => {
  it("prevents payment while server checkout is disabled", () => {
    render(<ProductCheckout product={paid} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(/todavía no está habilitada/)).toBeVisible();
    expect(fixture.checkout).not.toHaveBeenCalled();
  });
  it("sends only the product ID and never grants a resource when opening checkout", async () => {
    fixture.configuration.enabled = true;
    render(<ProductCheckout product={paid} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Probar pago con Mercado Pago" }),
    );
    await waitFor(() =>
      expect(fixture.checkout).toHaveBeenCalledExactlyOnceWith({
        productId: "paid1",
      }),
    );
    expect(fixture.open).toHaveBeenCalledWith(
      "https://sandbox.mercadopago.com.ar/pay",
    );
    expect(fixture.save).not.toHaveBeenCalled();
    expect(fixture.connect).not.toHaveBeenCalled();
  });
  it("shows the authoritative pending status for an order instead of treating the return URL as payment", () => {
    fixture.orders = [
      {
        id: "order1",
        productId: "paid1",
        title: "Iconos",
        currency: "ARS",
        amount: 10000,
        status: "pending",
        createdAt: Date.now(),
      },
    ];
    render(
      <MemoryRouter>
        <MarketplaceOrders focusOrderId="order1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Esperando confirmación")).toBeVisible();
    expect(screen.queryByText("Pago confirmado")).not.toBeInTheDocument();
  });
});
