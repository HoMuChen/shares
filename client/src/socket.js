import { io } from "socket.io-client";

// URL of the signaling server
// For local dev, it's usually http://localhost:3000
const SIGNALING_SERVER_URL = "http://localhost:3000";

export const socket = io(SIGNALING_SERVER_URL, {
  autoConnect: false,
});
