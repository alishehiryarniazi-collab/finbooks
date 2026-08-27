import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // FinBooks always runs on 5173 (strictPort = never silently move to another port,
    // so it can't collide with the other local projects — OrderFlow 5174, School 5175).
    port: 5173,
    strictPort: true,
    // Proxy API calls to the Express backend during dev so the frontend can
    // just call "/api/..." without hardcoding the backend URL.
    proxy: {
      "/api": "http://localhost:4001",
    },
  },
});
