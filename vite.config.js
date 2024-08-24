import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: resolve(__dirname, "ssl/key.pem"),
      cert: resolve(__dirname, "ssl/cert.pem"),
    },
  },
  host: "localhost",
});
