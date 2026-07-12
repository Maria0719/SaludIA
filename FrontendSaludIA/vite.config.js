import { resolve } from "node:path";
import { defineConfig } from "vite";

// Static multi-page SaludIA site (vanilla HTML/CSS/JS).
export default defineConfig({
  root: ".",
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
        prediction: resolve(__dirname, "prediction.html"),
        anomalies: resolve(__dirname, "anomalies.html"),
        data: resolve(__dirname, "data.html"),
        methodology: resolve(__dirname, "methodology.html"),
        seir: resolve(__dirname, "seir.html"),
      },
    },
  },
});
