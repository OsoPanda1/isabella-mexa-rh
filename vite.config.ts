import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { assertPublicMetadata } from "./vite/plugins/assertPublicMetadata.ts";

const resolvePath = (pathStr: string): string =>
  fileURLToPath(new URL(pathStr, import.meta.url));

function sanitizeUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    return new URL(rawUrl).toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  const env = loadEnv(mode, process.cwd(), "");

  // Por defecto "" para que Vite reemplace %VITE_PUBLIC_APP_URL% y no quede
  // el placeholder sin resolver en el HTML construido (links/canonical rotos).
  const publicAppUrl = sanitizeUrl(env.VITE_PUBLIC_APP_URL) ?? "";
  process.env.VITE_PUBLIC_APP_URL = publicAppUrl;

  const isHmrDisabled = process.env.DISABLE_HMR === "true" || isProd;
  const apiTarget = sanitizeUrl(process.env.API_TARGET) || "http://localhost:3000";
  const port = Number.parseInt(process.env.PORT || "5173", 10);

  return {
    plugins: [
      react(),
      tailwindcss(),
      assertPublicMetadata(mode),
    ],

    resolve: {
      alias: {
        "@": resolvePath("./src"),
        "@tanstack/react-start": resolvePath("./src/lib/tanstack-polyfill.ts"),
        "@tanstack/react-router": resolvePath("./src/lib/react-router-polyfill.ts"),
      },
    },

    build: {
      target: "es2022",
      outDir: "dist",
      sourcemap: !isProd,
      cssCodeSplit: true,
      cssTarget: "es2022",
      chunkSizeWarningLimit: 800,
      minify: "esbuild",
      modulePreload: {
        polyfill: true,
      },
      rollupOptions: {
        external: ["@xterm/xterm", "@xterm/addon-fit"],
        output: {
          entryFileNames: "assets/js/[name]-[hash].js",
          chunkFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: "assets/[ext]/[name]-[hash][extname]",
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/scheduler/") ||
              id.includes("@tanstack")
            ) {
              return "vendor-framework";
            }

            if (id.includes("motion") || id.includes("lucide-react")) {
              return "vendor-ui";
            }

            if (id.includes("@supabase") || id.includes("pg")) {
              return "vendor-data";
            }
          },
        },
      },
    },

    server: {
      host: true,
      port: Number.isNaN(port) ? 5173 : port,
      strictPort: false,
      cors: true,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      hmr: !isHmrDisabled
        ? {
            overlay: true,
          }
        : false,
      watch: isHmrDisabled
        ? null
        : {
            usePolling: false,
            ignored: ["**/node_modules/**", "**/.git/**", "**/fx/**"],
          },
      allowedHosts: [
        ".all-hands.dev",
        ".prod-runtime.all-hands.dev",
        "localhost",
        "127.0.0.1",
      ],
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: isProd,
          ws: true,
        },
      },
    },

    preview: {
      host: true,
      port: 4173,
      strictPort: true,
      cors: true,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    },
  };
});
