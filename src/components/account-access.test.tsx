import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import AccountAccess from "./account-access";
const signIn = vi.hoisted(() => vi.fn());
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn }),
}));
vi.mock("./google-sign-in", () => ({
  GoogleSignInButton: () => <button type="button">Continuar con Google</button>,
}));
beforeEach(() => signIn.mockReset().mockResolvedValue({}));
it("uses the shared password provider and restores controls after failure", async () => {
  signIn.mockRejectedValueOnce(new Error("private"));
  render(<AccountAccess />);
  await userEvent.type(
    screen.getByLabelText("Correo electrónico"),
    "User@Example.com",
  );
  await userEvent.type(
    screen.getByLabelText("Contraseña", { exact: true }),
    "password123",
  );
  await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
  expect(signIn).toHaveBeenCalledWith("password", {
    email: "user@example.com",
    password: "password123",
    flow: "signIn",
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Revisá tu correo",
  );
  expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
});
it("requires matching passwords before registering and never submits a paid action", async () => {
  render(<AccountAccess />);
  await userEvent.click(
    screen.getByRole("button", { name: "Crear una cuenta" }),
  );
  await userEvent.type(
    screen.getByLabelText("Correo electrónico"),
    "new@example.com",
  );
  await userEvent.type(
    screen.getByLabelText("Contraseña", { exact: true }),
    "password123",
  );
  await userEvent.type(
    screen.getByLabelText("Confirmá tu contraseña"),
    "different",
  );
  await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(signIn).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("no coinciden");
  await userEvent.clear(screen.getByLabelText("Confirmá tu contraseña"));
  await userEvent.type(
    screen.getByLabelText("Confirmá tu contraseña"),
    "password123",
  );
  await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  await waitFor(() =>
    expect(signIn).toHaveBeenCalledWith("password", {
      email: "new@example.com",
      password: "password123",
      flow: "signUp",
    }),
  );
});
