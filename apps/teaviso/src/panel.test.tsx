import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "./auth";
import WhatsappPanel, { WhatsappVisitor } from "./qr";
import BusinessPanel from "./business";

const f = vi.hoisted(() => ({
  google: false,
  offer: null as null | {
    enabled: boolean;
    buyable: boolean;
    priceAmount: number;
    terms: string;
    currency: string;
  },
  qrs: [] as Record<string, unknown>[],
  requests: [] as Record<string, unknown>[],
  contact: null as null | { label: string; url: string },
  signIn: vi.fn(),
  save: vi.fn(),
  request: vi.fn(),
  checkout: vi.fn(),
  archive: vi.fn(),
  template: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: f.signIn }),
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    return {
      "teaviso:configuration": { google: f.google, business: f.offer },
      "teaviso:myWhatsappQrs": f.qrs,
      "teaviso:myBusinessRequests": f.requests,
      "teaviso:publicWhatsapp": f.contact,
    }[name];
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    ({
      "teaviso:saveWhatsappQr": f.save,
      "teaviso:requestBusiness": f.request,
      "teaviso:archiveWhatsappQr": f.archive,
      "teaviso:saveQrTemplate": f.template,
    })[getFunctionName(ref)],
  useAction: () => f.checkout,
}));
function mount(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  f.google = false;
  f.offer = null;
  f.qrs = [];
  f.requests = [];
  f.contact = null;
  for (const mock of [
    f.signIn,
    f.save,
    f.request,
    f.checkout,
    f.archive,
    f.template,
  ])
    mock.mockReset();
  f.signIn.mockResolvedValue({});
  f.save.mockResolvedValue("id");
  f.request.mockResolvedValue("request");
  f.template.mockResolvedValue(null);
});
describe("Te Aviso own account", () => {
  it("signs in with existing VISO credentials and normalizes email", async () => {
    mount(<Auth />);
    await userEvent.type(
      screen.getByLabelText("Correo electrónico"),
      "User@Example.com",
    );
    await userEvent.type(screen.getByLabelText("Contraseña"), "password123");
    await userEvent.click(
      screen.getByRole("button", { name: "Ingresar", exact: true }),
    );
    expect(f.signIn).toHaveBeenCalledWith("password", {
      email: "user@example.com",
      password: "password123",
      flow: "signIn",
    });
    expect(
      screen.queryByRole("button", { name: "Continuar con Google" }),
    ).not.toBeInTheDocument();
  });
  it("registers in the shared account system without granting a paid plan", async () => {
    mount(<Auth />);
    await userEvent.click(
      screen.getByRole("button", { name: "Crear una cuenta" }),
    );
    await userEvent.type(
      screen.getByLabelText("Correo electrónico"),
      "new@example.com",
    );
    await userEvent.type(screen.getByLabelText("Contraseña"), "newpassword");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(f.signIn).toHaveBeenCalledWith("password", {
      email: "new@example.com",
      password: "newpassword",
      flow: "signUp",
    });
    expect(f.checkout).not.toHaveBeenCalled();
  });
  it("reports auth failure and leaves password retry available", async () => {
    f.signIn.mockRejectedValue(new Error("secret error"));
    mount(<Auth />);
    await userEvent.type(
      screen.getByLabelText("Correo electrónico"),
      "user@example.com",
    );
    await userEvent.type(screen.getByLabelText("Contraseña"), "badpassword");
    await userEvent.click(
      screen.getByRole("button", { name: "Ingresar", exact: true }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Revisá tu correo",
    );
    expect(
      screen.getByRole("button", { name: "Ingresar", exact: true }),
    ).toBeEnabled();
    expect(screen.queryByText("secret error")).not.toBeInTheDocument();
  });
});
describe("QR account panel", () => {
  it("saves the explicit phone consent and shows success", async () => {
    mount(<WhatsappPanel />);
    await userEvent.type(screen.getByLabelText("Nombre del lugar"), "Mi casa");
    await userEvent.type(
      screen.getByLabelText(/WhatsApp con código/),
      "5491112345678",
    );
    await userEvent.click(screen.getByLabelText(/Tengo permiso/));
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar entrada" }),
    );
    expect(f.save).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Mi casa",
        phone: "5491112345678",
        enabled: true,
        consent: true,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("QR guardado");
  });
  it("edits the existing record and stable URL instead of making another QR", async () => {
    f.qrs = [
      {
        _id: "qr1",
        label: "Puerta",
        phone: "5491112345678",
        message: "Hola",
        enabled: true,
        token: "a".repeat(64),
      },
    ];
    mount(<WhatsappPanel />);
    expect(screen.getByRole("link", { name: "Probar mi QR" })).toHaveAttribute(
      "href",
      `${window.location.origin}/w/${"a".repeat(64)}`,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Editar", exact: true }),
    );
    await userEvent.clear(screen.getByLabelText(/WhatsApp con código/));
    await userEvent.type(
      screen.getByLabelText(/WhatsApp con código/),
      "5491187654321",
    );
    await userEvent.click(screen.getByLabelText(/Tengo permiso/));
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar entrada" }),
    );
    expect(f.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "qr1", phone: "5491187654321" }),
    );
  });
  it("public visitor has only the contact link, never performs a call mutation", () => {
    f.contact = {
      label: "Oficina",
      url: "https://wa.me/5491112345678?text=Hola",
    };
    render(
      <MemoryRouter initialEntries={["/w/token"]}>
        <Routes>
          <Route path="/w/:token" element={<WhatsappVisitor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "Abrir WhatsApp" }),
    ).toHaveAttribute("href", f.contact.url);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.request).not.toHaveBeenCalled();
  });
});
describe("Business purchase clarity", () => {
  it("records a request without silently charging or activating", async () => {
    mount(<BusinessPanel />);
    await userEvent.type(screen.getByLabelText("Nombre del lugar"), "Oficina");
    await userEvent.type(
      screen.getByLabelText(/Teléfono para coordinar/),
      "5491112345678",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar solicitud" }),
    );
    expect(f.request).toHaveBeenCalledWith({
      businessName: "Oficina",
      contactPhone: "5491112345678",
      notes: "",
    });
    expect(f.checkout).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Recibimos tu solicitud",
    );
  });
  it("requires current terms and does not allow checkout when readiness is false", async () => {
    f.offer = {
      enabled: true,
      buyable: false,
      priceAmount: 10000,
      terms: "Número, configuración y condiciones del servicio.",
      currency: "ARS",
    };
    f.requests = [
      { _id: "request1", businessName: "Casa", status: "requested" },
    ];
    mount(<BusinessPanel />);
    await userEvent.click(screen.getByLabelText(/Acepto el importe/));
    expect(
      screen.getByRole("button", {
        name: "Pagar configuración con Mercado Pago",
      }),
    ).toBeDisabled();
    expect(f.checkout).not.toHaveBeenCalled();
  });
  it("invalidates consent when price or conditions change", async () => {
    f.offer = {
      enabled: true,
      buyable: true,
      priceAmount: 10000,
      terms: "Condiciones originales de configuración.",
      currency: "ARS",
    };
    f.requests = [
      { _id: "request1", businessName: "Casa", status: "requested" },
    ];
    const view = mount(<BusinessPanel />);
    const button = screen.getByRole("button", {
      name: "Pagar configuración con Mercado Pago",
    });
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/Acepto el importe/));
    expect(button).toBeEnabled();
    f.offer = { ...f.offer, priceAmount: 20000 };
    view.rerender(
      <MemoryRouter>
        <BusinessPanel />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", {
        name: "Pagar configuración con Mercado Pago",
      }),
    ).toBeDisabled();
  });
});

describe("Plate selection", () => {
  it("previews all four templates and saves the chosen design for the exact account entry", async () => {
    f.qrs = [
      {
        _id: "qr1",
        label: "Mi oficina",
        phone: "5491112345678",
        message: "Hola",
        enabled: true,
        token: "a".repeat(64),
      },
    ];
    mount(<WhatsappPanel />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    await userEvent.click(screen.getByRole("radio", { name: /Noche/ }));
    expect(screen.getByRole("radio", { name: /Noche/ })).toBeChecked();
    expect(
      screen.getByRole("img", { name: "Placa Noche: Mi oficina" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar diseño" }),
    );
    expect(f.template).toHaveBeenCalledWith({
      kind: "personal",
      id: "qr1",
      template: "night",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Diseño guardado",
    );
  });
});
