const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001',
      'https://qonvoo.vercel.app',
      'https://qonvoo-frontend.vercel.app',
      'https://qonvoo-frontend.onrender.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e7, // 10MB limit for media
});

// Security middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "https:", "blob:"],
    },
  },
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'https://qonvoo.vercel.app',
    'https://qonvoo-frontend.vercel.app',
    'https://qonvoo-frontend.onrender.com'
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Analytics data storage
const analytics = {
  totalUsers: 0,
  totalMessages: 0,
  totalMediaUploads: 0,
  totalCalls: 0,
  totalCallDuration: 0,
  activeConnections: 0,
  peakConcurrentUsers: 0,
  dailyStats: {},
  userSessions: new Map(),
  callSessions: new Map(),
};

// File upload configuration with security
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Security: Only allow specific file types
    const allowedTypes = {
      'image/jpeg': true,
      'image/png': true,
      'image/gif': true,
      'image/webp': true,
      'audio/mpeg': true,
      'audio/wav': true,
      'audio/ogg': true,
      'audio/mp4': true,
    };
    
    if (allowedTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and audio files are allowed.'), false);
    }
  },
});

// Basic rate limiting (per IP)
const rateLimit = {};
app.use((req, res, next) => {
  const ip = req.ip;
  rateLimit[ip] = rateLimit[ip] || { count: 0, last: Date.now() };
  if (Date.now() - rateLimit[ip].last > 60000) {
    rateLimit[ip] = { count: 0, last: Date.now() };
  }
  rateLimit[ip].count++;
  if (rateLimit[ip].count > 120) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
});

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Analytics endpoints
app.get('/analytics', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const dailyStats = analytics.dailyStats[today] || {
    users: 0,
    messages: 0,
    mediaUploads: 0,
    calls: 0,
    callDuration: 0
  };

  res.json({
    totalUsers: analytics.totalUsers,
    totalMessages: analytics.totalMessages,
    totalMediaUploads: analytics.totalMediaUploads,
    totalCalls: analytics.totalCalls,
    totalCallDuration: analytics.totalCallDuration,
    activeConnections: analytics.activeConnections,
    peakConcurrentUsers: analytics.peakConcurrentUsers,
    today: dailyStats,
    uptime: process.uptime()
  });
});

// Secure file upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Additional security checks
    const file = req.file;
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum 10MB allowed.' });
    }

    // Convert buffer to base64 for Cloudinary
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;

    // Upload to Cloudinary with security options
    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: 'auto',
      folder: 'qonvoo',
      use_filename: false,
      unique_filename: true,
      overwrite: false,
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }, // Optimize automatically
        { width: 1920, height: 1080, crop: 'limit' } // Limit max dimensions
      ],
      moderation: 'aws_rek' // Virus scanning
    });

    // Update analytics
    analytics.totalMediaUploads++;
    const today = new Date().toISOString().split('T')[0];
    if (!analytics.dailyStats[today]) analytics.dailyStats[today] = { users: 0, messages: 0, mediaUploads: 0, calls: 0, callDuration: 0 };
    analytics.dailyStats[today].mediaUploads++;

    res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
});

// --- Real-time logic ---
let onlineUsers = 0;
const waitingUsers = [];
const userSockets = new Map();

io.on('connection', (socket) => {
  let username = socket.handshake.query.username;
  if (!username || typeof username !== 'string' || username.length > 20) {
    socket.disconnect(true);
    return;
  }
  
  // Sanitize username
  username = username.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 20);
  userSockets.set(socket.id, { username, partner: null, peerId: null });
  onlineUsers++;
  analytics.activeConnections++;
  analytics.totalUsers++;
  analytics.peakConcurrentUsers = Math.max(analytics.peakConcurrentUsers, onlineUsers);
  
  // Track user session
  const sessionId = `${username}_${Date.now()}`;
  analytics.userSessions.set(sessionId, {
    username,
    startTime: Date.now(),
    socketId: socket.id
  });

  const today = new Date().toISOString().split('T')[0];
  if (!analytics.dailyStats[today]) analytics.dailyStats[today] = { users: 0, messages: 0, mediaUploads: 0, calls: 0, callDuration: 0 };
  analytics.dailyStats[today].users++;

  io.emit('users_online', onlineUsers);

  // Matching logic
  if (waitingUsers.length > 0) {
    const partnerId = waitingUsers.shift();
    if (userSockets.has(partnerId)) {
      userSockets.get(socket.id).partner = partnerId;
      userSockets.get(partnerId).partner = socket.id;
      io.to(socket.id).emit('matched', { username: userSockets.get(partnerId).username });
      io.to(partnerId).emit('matched', { username });
    }
  } else {
    waitingUsers.push(socket.id);
    socket.emit('waiting');
  }

  // Messaging with sanitization
  socket.on('message', (msg) => {
    const user = userSockets.get(socket.id);
    if (user && user.partner && userSockets.has(user.partner)) {
      // Sanitize message content
      const sanitizedMsg = typeof msg === 'string' ? msg.slice(0, 1000) : '';
      if (sanitizedMsg.trim()) {
        io.to(user.partner).emit('message', { 
          from: user.username, 
          msg: sanitizedMsg, 
          ts: Date.now() 
        });
        
        // Update analytics
        analytics.totalMessages++;
        analytics.dailyStats[today].messages++;
      }
    }
  });

  // Media message handling
  socket.on('media_message', (data) => {
    const user = userSockets.get(socket.id);
    if (user && user.partner && userSockets.has(user.partner)) {
      // Validate media URL
      if (data.url && typeof data.url === 'string' && data.url.startsWith('https://res.cloudinary.com/')) {
        io.to(user.partner).emit('media_message', {
          from: user.username,
          url: data.url,
          type: data.type, // 'image' or 'audio'
          ts: Date.now()
        });
      }
    }
  });

  // WebRTC signaling for video calls
  socket.on('call_request', (data) => {
    const user = userSockets.get(socket.id);
    if (user && user.partner && userSockets.has(user.partner)) {
      io.to(user.partner).emit('call_request', {
        from: user.username,
        peerId: data.peerId,
        type: data.type // 'video' or 'audio'
      });
      
      // Track call analytics
      analytics.totalCalls++;
      analytics.dailyStats[today].calls++;
      const callId = `${user.username}_${userSockets.get(user.partner).username}_${Date.now()}`;
      analytics.callSessions.set(callId, {
        caller: user.username,
        callee: userSockets.get(user.partner).username,
        startTime: Date.now(),
        type: data.type
      });
    }
  });

  socket.on('call_answer', (data) => {
    const user = userSockets.get(socket.id);
    if (user && user.partner && userSockets.has(user.partner)) {
      io.to(user.partner).emit('call_answer', {
        from: user.username,
        peerId: data.peerId,
        accepted: data.accepted
      });
    }
  });

  socket.on('call_ice_candidate', (data) => {
    const user = userSockets.get(socket.id);
    if (user && user.partner && userSockets.has(user.partner)) {
      io.to(user.partner).emit('call_ice_candidate', {
        from: user.username,
        candidate: data.candidate
      });
    }
  });

  socket.on('call_end', (data) => {
    const user = userSockets.get(socket.id);
    if (user && user.partner && userSockets.has(user.partner)) {
      io.to(user.partner).emit('call_end', {
        from: user.username
      });
      
      // Update call duration analytics
      const callId = `${user.username}_${userSockets.get(user.partner).username}_${Date.now()}`;
      const callSession = analytics.callSessions.get(callId);
      if (callSession) {
        const duration = Date.now() - callSession.startTime;
        analytics.totalCallDuration += duration;
        analytics.dailyStats[today].callDuration += duration;
      }
    }
  });

  // Skip/Disconnect
  socket.on('skip', () => {
    const user = userSockets.get(socket.id);
    if (user && user.partner && userSockets.has(user.partner)) {
      const partnerId = user.partner;
      userSockets.get(partnerId).partner = null;
      waitingUsers.push(partnerId);
      io.to(partnerId).emit('waiting');
    }
    userSockets.get(socket.id).partner = null;
    waitingUsers.push(socket.id);
    socket.emit('waiting');
  });

  socket.on('disconnect', () => {
    onlineUsers--;
    analytics.activeConnections--;
    io.emit('users_online', onlineUsers);
    const user = userSockets.get(socket.id);
    if (user && user.partner && userSockets.has(user.partner)) {
      const partnerId = user.partner;
      userSockets.get(partnerId).partner = null;
      waitingUsers.push(partnerId);
      io.to(partnerId).emit('waiting');
    }
    userSockets.delete(socket.id);
    // Remove from waiting queue
    const idx = waitingUsers.indexOf(socket.id);
    if (idx !== -1) waitingUsers.splice(idx, 1);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Qonvoo backend running on port ${PORT}`);
  console.log(`Cloudinary configured for cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`Analytics tracking enabled`);
}); 