# Qonvoo Backend 🚀

Real-time chat backend server for Qonvoo - a modern chat application where users can connect with strangers worldwide.

## ✨ Features

- **Real-time Chat** - Socket.IO powered instant messaging
- **User Matching** - Intelligent stranger pairing system
- **Media Upload** - Secure image and audio sharing via Cloudinary
- **WebRTC Signaling** - Video and audio call support
- **Analytics** - Live user statistics and metrics
- **Security** - Rate limiting, input sanitization, CORS protection

## 🛠️ Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Socket.IO** - Real-time WebSocket communication
- **Cloudinary** - Media upload and storage
- **Multer** - File upload handling
- **Helmet.js** - Security headers

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudinary account (free)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/ayush68824/Qonv-back.git
cd Qonv-back
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
Create a `.env` file in the root directory:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
PORT=4000
```

4. **Run the server**
```bash
# Development
npm run dev

# Production
npm start
```

The server will start on `http://localhost:4000`

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns server status

### Analytics
```
GET /analytics
```
Returns live server statistics:
```json
{
  "totalUsers": 150,
  "totalMessages": 1250,
  "totalMediaUploads": 45,
  "totalCalls": 12,
  "activeConnections": 25,
  "peakConcurrentUsers": 50,
  "uptime": 3600
}
```

### File Upload
```
POST /upload
Content-Type: multipart/form-data
```
Upload images and audio files to Cloudinary

## 🔌 Socket.IO Events

### Client to Server
- `connection` - User connects with username
- `message` - Send text message
- `media_message` - Send media message
- `call_request` - Initiate video/audio call
- `call_answer` - Answer incoming call
- `call_ice_candidate` - WebRTC signaling
- `call_end` - End active call
- `skip` - Skip current partner
- `disconnect` - User disconnects

### Server to Client
- `users_online` - Live user count
- `matched` - User matched with partner
- `waiting` - Waiting for partner
- `message` - Receive text message
- `media_message` - Receive media message
- `call_request` - Incoming call
- `call_answer` - Call answered/declined
- `call_ice_candidate` - WebRTC signaling
- `call_end` - Call ended

## 🔒 Security Features

- **Rate Limiting** - 120 requests per minute per IP
- **Input Sanitization** - XSS protection
- **File Validation** - Type and size checks
- **CORS Protection** - Cross-origin security
- **Helmet.js** - Security headers
- **Virus Scanning** - Cloudinary AWS Rekognition

## 📊 Analytics Tracking

The backend tracks:
- Total users and messages
- Media uploads and calls
- Active connections
- Peak concurrent users
- Daily statistics
- Server uptime

## 🌐 Deployment

### Render
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically

### Heroku
```bash
heroku create your-app-name
heroku config:set CLOUDINARY_CLOUD_NAME=your_cloud_name
heroku config:set CLOUDINARY_API_KEY=your_api_key
heroku config:set CLOUDINARY_API_SECRET=your_api_secret
git push heroku main
```

### Railway
1. Connect repository
2. Add environment variables
3. Deploy

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `FRONTEND_URL` | Frontend application URL | Yes |
| `PORT` | Server port (default: 4000) | No |

## 📝 License

MIT License - feel free to use for personal or commercial projects.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 🆘 Support

For issues or questions:
1. Check the documentation
2. Search existing issues
3. Create new issue with details

---

**Built with ❤️ for connecting people worldwide** 