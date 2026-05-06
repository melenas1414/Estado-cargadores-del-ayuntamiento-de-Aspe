import WebSocket from 'ws';

export default defineNitroPlugin(() => {
  if (typeof globalThis.WebSocket === 'undefined') {
    // Supabase Realtime in Node < 22 needs a WebSocket implementation.
    (globalThis as any).WebSocket = WebSocket as any;
  }
});
