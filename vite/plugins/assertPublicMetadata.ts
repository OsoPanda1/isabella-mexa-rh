import type { Plugin } from "vite";

export const assertPublicMetadata = (mode: string): Plugin => ({
  name: "assert-public-metadata",
  closeBundle() {
    if (mode !== "production") return;

    const publicUrl = process.env.VITE_PUBLIC_APP_URL;

    if (!publicUrl) {
      console.warn(
        "[assert-public-metadata] VITE_PUBLIC_APP_URL no está definida. " +
        "Las etiquetas OG, canonical y JSON-LD mantendrán valores por defecto. " +
        "Asegúrate de configurarla en Vercel o en .env.production."
      );
      return;
    }

    if (publicUrl.includes("%VITE_")) {
      console.warn(
        "[assert-public-metadata] VITE_PUBLIC_APP_URL contiene un marcador sin resolver: " +
        publicUrl
      );
      return;
    }

    if (publicUrl.startsWith("http://localhost")) {
      return;
    }

    if (!publicUrl.startsWith("https://")) {
      console.warn(
        "[assert-public-metadata] VITE_PUBLIC_APP_URL debe utilizar el protocolo HTTPS en producción. " +
        "Valor recibido: " + publicUrl
      );
    }
  },
});
