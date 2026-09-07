require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const ytdl = require('@distube/ytdl-core');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.AUTH_REDIRECT_URI || `http://localhost:${PORT}/auth`;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());

// YouTube Proxy
app.get('/api/yt', async (req, res) => {
  const url = req.query.url;
  if (!ytdl.validateURL(url)) return res.status(400).send('Invalid YouTube URL');

  try {
    const info = await ytdl.getInfo(url);
    res.header('Content-Type', 'audio/mpeg');
    res.header('X-Track-Title', encodeURIComponent(info.videoDetails.title));
    ytdl(url, { filter: 'audioonly', quality: 'highestaudio' }).pipe(res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'spotify_auth_state';

app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const scope =
    'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state user-top-read playlist-read-private playlist-read-collaborative user-library-read';

  const queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: scope,
    redirect_uri: REDIRECT_URI,
    state: state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${queryParams.toString()}`);
});

app.get('/auth', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#error=state_mismatch');
    return;
  }

  res.clearCookie(stateKey);

  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: new URLSearchParams({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      },
    });

    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token;

    // Redirect back to client with tokens in hash
    res.redirect(`/#access_token=${access_token}&refresh_token=${refresh_token}`);
  } catch (error) {
    console.error('Auth error', error.response ? error.response.data : error.message);
    res.redirect('/#error=invalid_token');
  }
});

app.get('/refresh_token', async (req, res) => {
  const refresh_token = req.query.refresh_token;
  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      },
    });
    res.send({ access_token: response.data.access_token });
  } catch (error) {
    res.status(400).send(error);
  }
});

// Proxy for Audio Analysis to avoid CORS issues if any (Spotify API supports CORS, but good to have)
app.get('/api/analysis/:trackId', async (req, res) => {
  const trackId = req.params.trackId;
  const token = req.headers.authorization;
  if (!token) return res.status(401).send('Unauthorized');

  try {
    const response = await axios.get(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
      headers: { Authorization: token },
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).send(err.message);
  }
});

// Proxy for Top Tracks
app.get('/api/top-tracks', async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send('Unauthorized');

  try {
    const response = await axios.get(`https://api.spotify.com/v1/me/top/tracks?limit=10`, {
      headers: { Authorization: token },
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).send(err.message);
  }
});

// Proxy to Play a track
app.put('/api/play', async (req, res) => {
  const token = req.headers.authorization;
  const { uris, device_id } = req.body;
  if (!token) return res.status(401).send('Unauthorized');

  try {
    await axios.put(
      `https://api.spotify.com/v1/me/player/play${device_id ? '?device_id=' + device_id : ''}`,
      { uris },
      { headers: { Authorization: token, 'Content-Type': 'application/json' } },
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(err.response?.status || 500).send(err.message);
  }
});

// Socket.io for Rooms
const rooms = {};

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join_room', (roomId, isHost) => {
    socket.join(roomId);
    currentRoom = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = { host: socket.id, state: null };
    }

    socket.emit('room_joined', { roomId, isHost: rooms[roomId].host === socket.id });

    // If there's an existing state, send it to the new guest
    if (rooms[roomId].state && rooms[roomId].host !== socket.id) {
      socket.emit('playback_update', rooms[roomId].state);
    }
  });

  socket.on('host_playback_update', (state) => {
    if (currentRoom && rooms[currentRoom].host === socket.id) {
      rooms[currentRoom].state = state;
      // Broadcast to all OTHERS in the room
      socket.to(currentRoom).emit('playback_update', state);
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom].host === socket.id) {
      // Host disconnected, could handle host reassignment or closing room
      io.to(currentRoom).emit('host_disconnected');
      delete rooms[currentRoom];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
