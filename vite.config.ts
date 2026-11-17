import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' -> relative asset paths, so the build runs under any sub-path
// (e.g. https://<user>.github.io/Family_Calendar/) without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
});
