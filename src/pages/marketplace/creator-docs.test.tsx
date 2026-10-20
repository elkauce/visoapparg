import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import CreatorDocs from "./creator-docs";
import { CREATOR_GUIDES } from "./creator-guides";

it("documents all marketplace categories with useful preparation, testing and downloadable examples", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><CreatorDocs /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Abrir mi espacio creador" })).toHaveAttribute("href", "/marketplace?view=studio");
  const navigation = screen.getByRole("navigation", { name: "Documentación por categoría" });
  expect(within(navigation).getAllByRole("button")).toHaveLength(9);
  for (const guide of CREATOR_GUIDES) {
    await user.click(within(navigation).getByRole("button", { name: guide.label }));
    const article = screen.getByRole("article", { name: `Guía de ${guide.label}` });
    expect(within(article).getByRole("heading", { name: "Cómo prepararlo" })).toBeInTheDocument();
    expect(within(article).getByRole("heading", { name: "Cómo probarlo" })).toBeInTheDocument();
    for (const example of guide.examples) {
      expect(within(article).getByRole("link", { name: example.label })).toHaveAttribute("href", example.path);
      expect(within(article).getByRole("link", { name: example.label })).toHaveAttribute("download");
    }
  }
});

it("explains real installation boundaries instead of promising arbitrary plugin or profile execution", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><CreatorDocs /></MemoryRouter>);
  const navigation = screen.getByRole("navigation", { name: "Documentación por categoría" });
  await user.click(within(navigation).getByRole("button", { name: "Plugins" }));
  expect(screen.getByRole("article")).toHaveTextContent("VISO no ejecuta ni instala código arbitrario");
  expect(screen.getByRole("article")).toHaveTextContent("este ejemplo no es un plugin instalable");
  await user.click(within(navigation).getByRole("button", { name: "Perfiles" }));
  expect(screen.getByRole("article")).toHaveTextContent("los JSON y ZIP de terceros se descargan con sus instrucciones");
  await user.click(within(navigation).getByRole("button", { name: "Página" }));
  expect(screen.getByRole("article")).toHaveTextContent("Elegí Clima y pegá el contenido");
});

it("states pricing and affiliate rules without inventing a platform commission", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><CreatorDocs /></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Usados" }));
  expect(screen.getByRole("article")).toHaveTextContent("no tiene comisión adicional de VISO");
  expect(screen.getByText(/Para cobros dentro de VISO/)).toHaveTextContent("cuando el proveedor esté habilitado");
  expect(screen.queryByText(/15%/)).not.toBeInTheDocument();
});
