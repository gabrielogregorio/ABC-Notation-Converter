import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Absolute base = the GitHub Pages project path. Keeps asset URLs valid even when
// the site is opened without the trailing slash. Hash routing (#/converter, ...)
// means every module has a shareable URL without any server rewrite.
// If the repository is renamed on GitHub, update this to match /<repo>/.
export default defineConfig({
  base: "/music-lab/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
