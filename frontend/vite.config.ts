import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the Express backend during dev so the frontend can
    // just call "/api/..." without hardcoding the backend URL.
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
