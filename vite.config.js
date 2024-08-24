import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: {
      "process.env.REACT_APP_TOKEN": JSON.stringify(env.REACT_APP_TOKEN),
      "process.env.REACT_APP_APP_ID": JSON.stringify(env.REACT_APP_APP_ID),
    },
    plugins: [react()],
    server: {
      https: {
        key: resolve(__dirname, "ssl/key.pem"),
        cert: resolve(__dirname, "ssl/cert.pem"),
      },
    },
    host: "localhost",
  };
});
