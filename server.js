const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// In-memory room state
const rooms = new Map();
const roomCleanupTimers = new Map();

// --- Helpers ---

function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const limit = 252; // largest multiple of 36 that fits in a byte (36*7=252)
  let id;
  do {
    id = '';
    const bytes = crypto.randomBytes(12); // extra bytes in case of rejections
    for (let i = 0; i < bytes.length && id.length < 6; i++) {
      if (bytes[i] < limit) {
        id += chars[bytes[i] % chars.length];
      }
    }
    if (id.length < 6) continue; // extremely unlikely, retry
  } while (id.length < 6 || rooms.has(id));
  return id;
}

function getNextSeatIndex(room, preferredSeat) {
  const taken = new Set();
  for (const p of room.participants.values()) {
    taken.add(p.seatIndex);
  }
  // Try preferred seat first (for reconnects)
  if (preferredSeat != null && preferredSeat >= 0 && preferredSeat < 8 && !taken.has(preferredSeat)) {
    return preferredSeat;
  }
  for (let i = 0; i < 8; i++) {
    if (!taken.has(i)) return i;
  }
  return -1; // room full
}

function buildRoomState(room) {
  const participants = [];
  for (const [socketId, p] of room.participants) {
    participants.push({
      socketId,
      name: p.name,
      seatIndex: p.seatIndex,
      hasVoted: p.vote !== null,
      vote: room.phase === 'revealed' ? p.vote : null,
    });
  }
  return {
    roomId: room.id,
    phase: room.phase,
    hostSocketId: room.hostSocketId,
    participants,
  };
}

function broadcastRoomState(room) {
  io.to(room.id).emit('room-state', buildRoomState(room));
}

// Pick the earliest-joined participant as new host (Map preserves insertion order)
function transferHost(room) {
  if (room.participants.size === 0) return;
  const firstSocketId = room.participants.keys().next().value;
  room.hostSocketId = firstSocketId;
}

// --- Security headers ---

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' ws: wss:;"
  );
  next();
});

// --- Rate limiting for room creation ---

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // max rooms per IP per window

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

// --- Express routes ---

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/create-room', (req, res) => {
  const ip = req.ip;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many rooms created. Try again later.' });
  }
  const roomId = generateRoomId();
  rooms.set(roomId, {
    id: roomId,
    hostSocketId: null,
    phase: 'voting',
    participants: new Map(),
  });
  res.json({ roomId });
});

// Room existence check API
app.get('/api/room-exists/:id', (req, res) => {
  const roomId = req.params.id;
  res.json({ exists: rooms.has(roomId) });
});

app.get('/room/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// --- Socket.IO ---

const VALID_VOTES = new Set(['0', '1', '2', '3', '5', '8', '13', '21', '?']);

io.on('connection', (socket) => {

  socket.on('join-room', (data) => {
    // Input validation
    if (!data || typeof data !== 'object') return;
    const { roomId, name, preferredSeat } = data;
    if (typeof roomId !== 'string' || typeof name !== 'string') {
      socket.emit('error-msg', { message: 'Invalid input' });
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 12) {
      socket.emit('error-msg', { message: 'Name must be 1-12 characters' });
      return;
    }

    if (!/^[a-z0-9]{1,10}$/.test(roomId)) {
      socket.emit('error-msg', { message: 'Invalid room ID' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error-msg', { message: 'Room not found' });
      return;
    }

    // Check name uniqueness
    for (const p of room.participants.values()) {
      if (p.name.toLowerCase() === trimmedName.toLowerCase()) {
        socket.emit('error-msg', { message: 'Name already taken in this room' });
        return;
      }
    }

    const parsedSeat = typeof preferredSeat === 'number' ? preferredSeat : undefined;
    const seatIndex = getNextSeatIndex(room, parsedSeat);
    if (seatIndex === -1) {
      socket.emit('error-msg', { message: 'Room is full (max 8)' });
      return;
    }

    // Cancel cleanup timer if someone rejoins
    if (roomCleanupTimers.has(roomId)) {
      clearTimeout(roomCleanupTimers.get(roomId));
      roomCleanupTimers.delete(roomId);
    }

    // Add participant
    room.participants.set(socket.id, {
      name: trimmedName,
      seatIndex,
      vote: null,
      connected: true,
    });

    // First joiner becomes host
    if (!room.hostSocketId || !room.participants.has(room.hostSocketId)) {
      room.hostSocketId = socket.id;
    }

    socket.roomId = roomId;
    socket.join(roomId);

    // Notify everyone (room-state includes hostSocketId so clients derive host status)
    broadcastRoomState(room);
  });

  socket.on('cast-vote', (data) => {
    // Input validation
    if (!data || typeof data !== 'object') return;
    const { vote } = data;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    if (room.phase !== 'voting') return;

    // Allow null to un-vote
    if (vote === null) {
      participant.vote = null;
      broadcastRoomState(room);
      return;
    }

    if (typeof vote !== 'string' || !VALID_VOTES.has(vote)) return;

    participant.vote = vote;
    broadcastRoomState(room);
  });

  socket.on('reveal-votes', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    room.phase = 'revealed';
    broadcastRoomState(room);
  });

  socket.on('reset-votes', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    room.phase = 'voting';
    for (const p of room.participants.values()) {
      p.vote = null;
    }
    broadcastRoomState(room);
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.participants.delete(socket.id);

    if (room.participants.size === 0) {
      // Schedule room cleanup
      const timer = setTimeout(() => {
        rooms.delete(roomId);
        roomCleanupTimers.delete(roomId);
      }, 30000);
      roomCleanupTimers.set(roomId, timer);
    } else {
      // Transfer host if needed
      if (room.hostSocketId === socket.id) {
        transferHost(room);
      }
      broadcastRoomState(room);
    }
  });
});

// --- Graceful shutdown ---

function shutdown() {
  console.log('Shutting down gracefully...');
  // Clear pending room cleanup timers
  for (const timer of roomCleanupTimers.values()) clearTimeout(timer);
  roomCleanupTimers.clear();
  io.emit('error-msg', { message: 'Server is restarting' });
  io.close();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force exit after 5 seconds
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// --- Start ---

server.listen(PORT, () => {
  console.log(`Planning Poker running at http://localhost:${PORT}`);
});
