import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

// Preview-only build: real app code, mocked Supabase, single HTML output.
// The regex alias matches the import specifier ('../supabaseClient') that
// components use, swapping in the in-memory mock.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: [
      {
        find: /^(\.\.\/|\.\/)supabaseClient(\.js)?$/,
        replacement: path.resolve(__dirname, 'src/demo/mockSupabase.js'),
      },
    ],
  },
  build: {
    outDir: 'dist-demo',
    rollupOptions: { input: path.resolve(__dirname, 'index.demo.html') },
  },
})
