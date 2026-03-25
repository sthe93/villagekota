import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const MAPS_VENDOR_CHUNK_WARNING_LIMIT_KB = 1100;

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
            "vendor-maps": ["maplibre-gl"],
            "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-toast", "sonner"],
          },
        },
      },
      // `vendor-maps` intentionally contains the map SDK and is expected to be larger.
      chunkSizeWarningLimit: MAPS_VENDOR_CHUNK_WARNING_LIMIT_KB,
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
