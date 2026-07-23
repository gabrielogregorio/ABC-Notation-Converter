// Music Lab is locked to the light ("white") theme. The dark tokens still live
// in global.css but are never activated: nothing writes data-theme="dark".
export type Theme = "light";

// Pin <html data-theme> to light so the CSS variables in global.css resolve to
// the white sheet everywhere, regardless of the OS colour-scheme preference.
export function lockLightTheme(): void {
  document.documentElement.dataset.theme = "light";
}
