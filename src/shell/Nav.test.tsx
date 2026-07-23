import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "../i18n/i18n";
import { Nav } from "./Nav";

function renderNav(route: "converter" | "tuner" | "metronome" | "practice") {
  const navigate = vi.fn();
  render(
    <I18nProvider>
      <Nav route={route} navigate={navigate} />
    </I18nProvider>,
  );
  return { navigate };
}

describe("Nav", () => {
  it("marks exactly the current route with aria-current", () => {
    renderNav("converter");
    expect(screen.getAllByRole("button", { current: "page" })).toHaveLength(1);
  });

  it("navigates to the tab that was clicked", async () => {
    const user = userEvent.setup();
    const { navigate } = renderNav("converter");
    // Order follows the app registry: converter, tuner, metronome, practice.
    await user.click(screen.getAllByRole("button")[1]);
    expect(navigate).toHaveBeenCalledWith("tuner");
  });
});
