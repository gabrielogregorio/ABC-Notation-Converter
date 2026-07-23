import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "../i18n/i18n";
import { Launcher } from "./Launcher";

function renderLauncher() {
  const navigate = vi.fn();
  render(
    <I18nProvider>
      <Launcher navigate={navigate} />
    </I18nProvider>,
  );
  return { navigate };
}

describe("Launcher", () => {
  it("lists every app as a card when the input is empty", () => {
    renderLauncher();
    // Four tools, no suggestion buttons yet.
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("routes a card click to that app", async () => {
    const user = userEvent.setup();
    const { navigate } = renderLauncher();
    await user.click(screen.getAllByRole("button")[0]);
    expect(navigate).toHaveBeenCalledWith("converter");
  });

  it("offers the metronome when a bare tempo is typed", async () => {
    const user = userEvent.setup();
    const { navigate } = renderLauncher();
    await user.type(screen.getByRole("textbox"), "120");
    const suggestions = screen.getAllByRole("button");
    expect(suggestions).toHaveLength(1);
    await user.click(suggestions[0]);
    expect(navigate).toHaveBeenCalledWith("metronome");
  });

  it("offers the converter when pasted text looks like ABC", async () => {
    const user = userEvent.setup();
    const { navigate } = renderLauncher();
    await user.type(screen.getByRole("textbox"), "K:D{Enter}DEF GAB");
    // The ABC suggestion is prepended above the four cards.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    await user.click(buttons[0]);
    expect(navigate).toHaveBeenCalledWith("converter");
  });
});
