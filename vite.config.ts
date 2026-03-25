import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const configuredBase = process.env.VITE_BASE_PATH?.trim();
  const defaultBase = "/";
  const base = configuredBase && configuredBase.length > 0 ? configuredBase : defaultBase;

  return {
    base,
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-supabase": ["@supabase/supabase-js", "@tanstack/react-query"],
            "vendor-maps": ["mapbox-gl", "maplibre-gl"],
            "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-toast", "sonner"],
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
