import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    plugins: [react()],
    server: {
      proxy: {
        "/api": "http://localhost:3001",
      },
      host: "0.0.0.0",
      allowedHosts:
        "37dd5897-8ab2-45fd-8ea6-3d8f4c7ff023-00-gtggtcrwgvb5.sisko.replit.dev",
    },
  };
});
