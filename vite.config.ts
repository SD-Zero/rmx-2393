import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: "/rmx-2393/",
  },
  tanstackStart: {
    // GitHub Pages only hosts static files; don't deploy a server runtime.
    server: { entry: "server", preset: "static" },
    prerender: {
      enabled: true,
      crawlLinks: true,
    },
  },
});
