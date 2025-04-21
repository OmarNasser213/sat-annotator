// filepath: d:\College\EgSA GP\sat-annotator\web\vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import type { ServerResponse, IncomingMessage } from 'http';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,  // Allow external connections
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,  // Important for local development
        rewrite: (path: string) => path.replace(/^\/api/, ''),
        configure: (proxy: any) => {
          proxy.on('error', (err: Error) => {
            console.error('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq: any) => {
            console.log('Proxying request to:', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes: any, req: IncomingMessage) => {
            console.log(`Proxy response: ${proxyRes.statusCode} for ${req.url}`);
          });
        },
        // Enhanced connection handling
        timeout: 15000,
        proxyTimeout: 15000,
        retry: 5,
        errorHandler: (err: Error, _req: IncomingMessage, res: ServerResponse) => {
          console.error('Proxy error handler:', err);
          res.writeHead(500, {
            'Content-Type': 'application/json',
          });
          res.end(JSON.stringify({ error: 'Backend service unavailable, please retry' }));
        },
      },
      '/uploads': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy: any) => {
          proxy.on('error', (err: Error) => {
            console.error('Uploads proxy error:', err);
          });
        },
        timeout: 15000,
      }
    }
  },
  preview: {
    port: 5173,
    host: true
  }
});