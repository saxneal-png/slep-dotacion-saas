import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@slep/mineduc-engine': path.resolve(__dirname, './packages/mineduc-engine/src')
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('exceljs')) return 'vendor-exceljs';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('sql.js')) return 'vendor-sql';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@supabase') || id.includes('@gotrue') || id.includes('@postgrest')) return 'vendor-supabase';
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
          }
          if (id.includes('packages/mineduc-engine')) {
            return 'mineduc-engine';
          }
        }
      }
    }
  }
});
