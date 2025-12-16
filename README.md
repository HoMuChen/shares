# P2P File Sharing App

A simple peer-to-peer file sharing application using WebRTC, Socket.io, and vanilla JS/Tailwind.

## Prerequisites

- Node.js installed.
- Supabase account (optional, for session tracking).

## Setup

1.  **Install Dependencies**:

    ```bash
    cd server
    npm install
    cd ../client
    npm install
    ```

2.  **Environment Variables**:
    Create `server/.env` based on `server/.env.example`.
    If you don't have Supabase keys, leave them blank, and the server will use a mock DB.

## Running

1.  **Start the Signaling Server**:

    ```bash
    cd server
    npm start
    ```
    Runs on `http://localhost:3000`.

2.  **Start the Client**:

    ```bash
    cd client
    npm run dev
    ```
    Open the displayed URL (e.g., `http://localhost:5173`).

## Usage

1.  Open the client in one tab. Click **Create Room**.
2.  Copy the link or QR code.
3.  Open the link in another tab (or device on the same network).
4.  Once connected, drag and drop a file to share it instantly via WebRTC.
