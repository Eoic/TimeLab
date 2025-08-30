import { resolve } from 'path';

import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@app': resolve(__dirname, 'src/app'),
            '@domain': resolve(__dirname, 'src/domain'),
            '@platform': resolve(__dirname, 'src/platform'),
            '@charts': resolve(__dirname, 'src/charts'),
            '@ui': resolve(__dirname, 'src/ui'),
            '@styles': resolve(__dirname, 'src/styles'),
            '@shared': resolve(__dirname, 'src/shared'),
            '@workers': resolve(__dirname, 'src/workers'),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                // Import only essential tokens without conflicts
                additionalData: '@use "@styles/abstracts/tokens" as *;',
            },
        },
    },
    build: {
        target: 'esnext',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                },
            },
        },
    },
    server: {
        port: 3000,
        open: true,
    },
    preview: {
        port: 4173,
        open: false,
    },
});
