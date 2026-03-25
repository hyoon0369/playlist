import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/itunes": {
        target: "https://itunes.apple.com",
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, "http://localhost");
          const { endpoint, ...rest } = Object.fromEntries(url.searchParams);
          const upstream = new URL(`https://itunes.apple.com/${endpoint || "search"}`);
          for (const [k, v] of Object.entries(rest)) {
            upstream.searchParams.set(k, v);
          }
          return `/${endpoint || "search"}?${upstream.searchParams.toString()}`;
        },
      },
    },
  },
})
