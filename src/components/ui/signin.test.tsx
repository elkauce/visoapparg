import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInButton } from "./signin.tsx";

const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  signIn: vi.fn<() => Promise<void>>(),
  signOut: vi.fn<() => Promise<void>>(),
  toastError: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: mocks.signIn,
    signOut: mocks.signOut,
  }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mocks.isAuthenticated,
    isLoading: mocks.isLoading,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function openSignIn() {
  const user = userEvent.setup();
  render(<SignInButton />);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  const dialog = screen.getByRole("dialog", { name: "Entrar a VISO" });
  return { user, dialog };
}

beforeEach(() => {
  mocks.isAuthenticated = false;
  mocks.isLoading = false;
  mocks.signIn.mockReset().mockResolvedValue(undefined);
  mocks.signOut.mockReset().mockResolvedValue(undefined);
  mocks.toastError.mockReset();
});

describe("SignInButton", () => {
  it("opens an accessible local sign-in form without calling the backend", async () => {
    const { dialog } = await openSignIn();

    expect(within(dialog).getByLabelText("Correo electrónico")).toHaveAttribute(
      "type",
      "email",
    );
    expect(within(dialog).getByLabelText("Contraseña")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      within(dialog).getByRole("button", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Crear una cuenta" }),
    ).toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it.each(["", "correo-sin-dominio"])(
    "shows Spanish validation for the invalid email %j without submitting",
    async (email) => {
      const { user, dialog } = await openSignIn();
      if (email) {
        await user.type(
          within(dialog).getByLabelText("Correo electrónico"),
          email,
        );
      }
      await user.type(within(dialog).getByLabelText("Contraseña"), "password");
      await user.click(within(dialog).getByRole("button", { name: "Entrar" }));

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Escribe un correo electrónico válido.",
      );
      expect(mocks.signIn).not.toHaveBeenCalled();
    },
  );

  it("requires a nonempty password for sign-in", async () => {
    const { user, dialog } = await openSignIn();
    await user.type(
      within(dialog).getByLabelText("Correo electrónico"),
      "persona@example.com",
    );
    await user.click(within(dialog).getByRole("button", { name: "Entrar" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Escribe tu contraseña.",
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("normalizes the email and accepts an existing short password for sign-in", async () => {
    const { user, dialog } = await openSignIn();
    await user.type(
      within(dialog).getByLabelText("Correo electrónico"),
      "  Persona@Example.COM  ",
    );
    await user.type(within(dialog).getByLabelText("Contraseña"), "x");
    await user.click(within(dialog).getByRole("button", { name: "Entrar" }));

    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith("password", {
      email: "persona@example.com",
      password: "x",
      flow: "signIn",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  });

  it("switches between sign-up and sign-in without submitting credentials", async () => {
    const { user, dialog } = await openSignIn();
    await user.click(
      within(dialog).getByRole("button", { name: "Crear una cuenta" }),
    );

    expect(screen.getByRole("dialog", { name: "Crear cuenta" })).toBe(dialog);
    expect(
      within(dialog).getByRole("button", { name: "Crear cuenta" }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Ya tengo una cuenta" }),
    );

    expect(screen.getByRole("dialog", { name: "Entrar a VISO" })).toBe(dialog);
    expect(
      within(dialog).getByRole("button", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("clears the password and validation error when changing modes, retaining the email", async () => {
    const { user, dialog } = await openSignIn();
    await user.type(
      within(dialog).getByLabelText("Correo electrónico"),
      "correo-invalido",
    );
    await user.type(within(dialog).getByLabelText("Contraseña"), "12345678");
    await user.click(within(dialog).getByRole("button", { name: "Entrar" }));
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Crear una cuenta" }),
    );

    expect(within(dialog).getByLabelText("Contraseña")).toHaveValue("");
    expect(within(dialog).getByLabelText("Correo electrónico")).toHaveValue(
      "correo-invalido",
    );
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("requires at least eight password characters when creating an account", async () => {
    const { user, dialog } = await openSignIn();
    await user.click(
      within(dialog).getByRole("button", { name: "Crear una cuenta" }),
    );
    await user.type(
      within(dialog).getByLabelText("Correo electrónico"),
      "persona@example.com",
    );
    await user.type(within(dialog).getByLabelText("Contraseña"), "1234567");
    await user.click(
      within(dialog).getByRole("button", { name: "Crear cuenta" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "La contraseña debe tener al menos 8 caracteres.",
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("creates an account through the password provider", async () => {
    const { user, dialog } = await openSignIn();
    await user.click(
      within(dialog).getByRole("button", { name: "Crear una cuenta" }),
    );
    await user.type(
      within(dialog).getByLabelText("Correo electrónico"),
      "Nueva@Example.COM",
    );
    await user.type(within(dialog).getByLabelText("Contraseña"), "12345678");
    await user.click(
      within(dialog).getByRole("button", { name: "Crear cuenta" }),
    );

    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith("password", {
      email: "nueva@example.com",
      password: "12345678",
      flow: "signUp",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it.each([
    {
      flow: "signIn",
      submit: "Entrar",
      pending: "Entrando...",
      toggle: "Crear una cuenta",
    },
    {
      flow: "signUp",
      submit: "Crear cuenta",
      pending: "Creando cuenta...",
      toggle: "Ya tengo una cuenta",
    },
  ])(
    "keeps the $flow dialog open and prevents duplicate submissions while pending",
    async ({ flow, submit, pending, toggle }) => {
      const request = deferred();
      mocks.signIn.mockReturnValueOnce(request.promise);
      const { user, dialog } = await openSignIn();
      if (flow === "signUp") {
        await user.click(
          within(dialog).getByRole("button", { name: "Crear una cuenta" }),
        );
      }
      const email = within(dialog).getByLabelText("Correo electrónico");
      const password = within(dialog).getByLabelText("Contraseña");
      await user.type(email, "persona@example.com");
      await user.type(password, "12345678");
      await user.dblClick(within(dialog).getByRole("button", { name: submit }));

      expect(dialog).toBeInTheDocument();
      expect(email).toBeDisabled();
      expect(password).toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: toggle }),
      ).toBeDisabled();
      const pendingButton = within(dialog).getByRole("button", {
        name: pending,
      });
      expect(pendingButton).toBeDisabled();
      await user.click(pendingButton);
      expect(mocks.signIn).toHaveBeenCalledOnce();

      await act(async () => request.resolve());
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await user.click(screen.getByRole("button", { name: "Entrar" }));
      expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    },
  );

  it.each([
    {
      flow: "signIn",
      title: "Entrar a VISO",
      submit: "Entrar",
      error: "No pudimos iniciar sesión. Revisa tu correo y contraseña.",
    },
    {
      flow: "signUp",
      title: "Crear cuenta",
      submit: "Crear cuenta",
      error:
        "No pudimos crear la cuenta. Revisa tus datos o inicia sesión si ya tienes una cuenta.",
    },
  ])(
    "keeps the $flow form available after a backend failure",
    async ({ flow, title, submit, error }) => {
      mocks.signIn.mockRejectedValueOnce(new Error("Backend rejected request"));
      const { user, dialog } = await openSignIn();
      if (flow === "signUp") {
        await user.click(
          within(dialog).getByRole("button", { name: "Crear una cuenta" }),
        );
      }
      await user.type(
        within(dialog).getByLabelText("Correo electrónico"),
        "persona@example.com",
      );
      await user.type(within(dialog).getByLabelText("Contraseña"), "12345678");
      await user.click(within(dialog).getByRole("button", { name: submit }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(error);
      expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Correo electrónico")).toBeEnabled();
      expect(within(dialog).getByLabelText("Contraseña")).toBeEnabled();
      expect(
        within(dialog).getByRole("button", { name: submit }),
      ).toBeEnabled();
      expect(screen.queryByText("Backend rejected request")).toBeNull();
      expect(mocks.signIn).toHaveBeenCalledOnce();
    },
  );

  it("signs out without opening the credential dialog and blocks duplicate clicks", async () => {
    mocks.isAuthenticated = true;
    const request = deferred();
    mocks.signOut.mockReturnValueOnce(request.promise);
    const user = userEvent.setup();
    render(<SignInButton />);
    await user.dblClick(screen.getByRole("button", { name: "Salir" }));

    const pendingButton = screen.getByRole("button", { name: "Saliendo..." });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => request.resolve());
    expect(screen.getByRole("button", { name: "Salir" })).toBeEnabled();
  });

  it("reports a sign-out failure and leaves the button available to retry", async () => {
    mocks.isAuthenticated = true;
    mocks.signOut.mockRejectedValueOnce(new Error("Backend rejected request"));
    const user = userEvent.setup();
    render(<SignInButton />);
    await user.click(screen.getByRole("button", { name: "Salir" }));

    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith(
      "No pudimos cerrar la sesión. Inténtalo de nuevo.",
    );
    expect(screen.getByRole("button", { name: "Salir" })).toBeEnabled();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Salir" }));
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
  });
});
