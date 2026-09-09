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
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-icons': ['lucide-react'],
                    'vendor-xlsx': ['xlsx']
                }
            }
        }
    }
});
