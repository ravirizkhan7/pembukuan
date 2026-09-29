import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'searches-gender-subsidiary-traveler.trycloudflare.com'
    ]
  }
});
