const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const supabase = require('./supabase');

const app = express();
const server = http.createServer(app);

// Allow CORS for the frontend Vite dev server (usually localhost:5173) and production
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for prototype; restrict in prod
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Signaling Server is running');
});

// Store active rooms in memory for speed (could sync to Supabase)
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async ({ roomId }) => {
    socket.join(roomId);
    
    const room = io.sockets.adapter.rooms.get(roomId);
    const numClients = room ? room.size : 0;
    
    console.log(`User ${socket.id} joined room ${roomId}. Total: ${numClients}`);

    // Notify others in room
    socket.to(roomId).emit('user-connected', socket.id);

    // Optional: Log to Supabase
    try {
      const { error } = await supabase.from('sessions').upsert({ 
        room_id: roomId, 
        last_active: new Date()
      }, { onConflict: 'room_id' });
      
      if (error) console.error('Supabase error:', error.message);
    } catch (e) {
      console.error('Supabase exception:', e);
    }
  });

  // Signaling messages
  socket.on('offer', ({ offer, roomId }) => {
    console.log(`User ${socket.id} sent OFFER to room ${roomId}`);
    socket.to(roomId).emit('offer', { offer, sender: socket.id });
  });

  socket.on('answer', ({ answer, roomId }) => {
    console.log(`User ${socket.id} sent ANSWER to room ${roomId}`);
    socket.to(roomId).emit('answer', { answer, sender: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, roomId }) => {
    console.log(`User ${socket.id} sent ICE CANDIDATE to room ${roomId}`);
    socket.to(roomId).emit('ice-candidate', { candidate, sender: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
