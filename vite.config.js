import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                pinpoint311: resolve(__dirname, 'pinpoint311.html'),
                getstarted: resolve(__dirname, 'get-started.html'),
                about: resolve(__dirname, 'about.html'),
                demolauncher: resolve(__dirname, 'demo-launcher.html'),
            },
        },
    },
});
