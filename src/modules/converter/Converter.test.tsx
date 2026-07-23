import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider } from "../../i18n/i18n";
import { Converter } from "./Converter";

// O abcjs escreve SVG medindo o DOM real; no jsdom isso não roda. O que importa
// aqui é o estado DERIVADO (título, mensagens, botões de export) - puro - então
// o render imperativo vira um no-op.
vi.mock("abcjs", () => ({ default: { renderAbc: vi.fn() } }));

function renderConverter() {
  render(
    <I18nProvider>
      <Converter />
    </I18nProvider>,
  );
}

describe("Converter", () => {
  it("hides the export buttons until there is a tune", () => {
    renderConverter();
    expect(screen.queryByRole("button", { name: "SVG" })).toBeNull();
  });

  it("derives the title and reveals the export buttons when ABC is entered", () => {
    renderConverter();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "X:1\nT:My Tune\nK:D\nDEF" },
    });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("My Tune");
    expect(screen.getByRole("button", { name: "SVG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PNG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
  });
});
