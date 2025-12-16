import { io } from "socket.io-client";

// URL of the signaling server
// In production (Nginx), use relative path (same origin)
// In dev (Vite), use localhost:3000
const SIGNALING_SERVER_URL = import.meta.env.PROD 
  ? "/" 
  : "http://localhost:3000";

export const socket = io(SIGNALING_SERVER_URL, {
  autoConnect: false,
});
