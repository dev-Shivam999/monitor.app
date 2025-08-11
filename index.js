/* eslint-disable */
const http = require('http');
const express = require('express');
const morgan = require('morgan');
const WebSocket = require('ws');
const Dicer = require('dicer');

const app = express();
app.use(morgan('dev'));

// Shared frame store (latest frame)
let latestFrame = null; // Buffer of last JPEG
let lastUpdateAt = 0;

// Simple HTML viewer
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Screen Stream Viewer</title></head>
<body>
  <h1>Latest Frame</h1>
  <p><a href="/mjpeg">MJPEG Stream</a> | <a href="/snapshot.jpg">Snapshot</a></p>
  <img id="img" src="/snapshot.jpg" style="max-width:100%;" />
  <script>
    setInterval(() => {
      const img = document.getElementById('img');
      img.src = '/snapshot.jpg?_=' + Date.now();
    }, 1000);
  </script>
</body>
</html>`);
});

// Admin: MJPEG stream endpoint to view latest frames
app.get('/mjpeg', (req, res) => {
  const boundary = 'frame';
  res.writeHead(200, {
    'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    Connection: 'close'
  });

  let aborted = false;
  req.on('close', () => { aborted = true; });

  const writeFrame = (buf) => {
    res.write(`--${boundary}\r\n`);
    res.write('Content-Type: image/jpeg\r\n');
    res.write(`Content-Length: ${buf.length}\r\n\r\n`);
    res.write(buf);
    res.write('\r\n');
  };

  // Immediate push of the latest, then periodic resend if updated
  let lastSent = 0;
  const tick = () => {
    if (aborted) return;
    if (latestFrame && lastUpdateAt !== lastSent) {
      writeFrame(latestFrame);
      lastSent = lastUpdateAt;
    }
    setTimeout(tick, 50);
  };
  tick();
});

// Admin: single snapshot
app.get('/snapshot.jpg', (req, res) => {
  if (!latestFrame) {
    res.status(404).send('No frame yet');
    return;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.end(latestFrame);
});

// Ingest: WebSocket endpoint - each binary message is a JPEG frame
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/stream' });
wss.on('connection', (ws) => {
  console.log('WS client connected');
  ws.on('message', (data, isBinary) => {
    if (!isBinary) return; // ignore text
    latestFrame = Buffer.from(data);
    lastUpdateAt = Date.now();
  });
  ws.on('close', () => console.log('WS client disconnected'));
});

// Ingest: HTTP MJPEG POST (multipart/x-mixed-replace)
app.post('/stream', (req, res) => {
  const ctype = req.headers['content-type'] || '';
  const match = ctype.match(/boundary=([^;]+)/i);
  if (!match) {
    res.status(400).send('Missing boundary');
    return;
  }
  const boundary = match[1];
  const dicer = new Dicer({ boundary });

  dicer.on('part', (part) => {
    const chunks = [];
    part.on('data', (d) => chunks.push(d));
    part.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (buf.length > 0) {
        latestFrame = buf;
        lastUpdateAt = Date.now();
      }
    });
  });
  dicer.on('finish', () => {
    console.log('HTTP MJPEG upload finished');
  });
  dicer.on('error', (err) => {
    console.error('Dicer error', err);
  });
  req.pipe(dicer);

  // Keep the connection open while client streams
  req.on('close', () => {
    try { res.end(); } catch (_) {}
  });
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('OK\n');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  console.log('Ingest endpoints:');
  console.log(' - WebSocket: ws://HOST:PORT/stream');
  console.log(' - HTTP MJPEG POST: http://HOST:PORT/stream');
  console.log('Viewer endpoints:');
  console.log(' - MJPEG: http://HOST:PORT/mjpeg');
  console.log(' - Snapshot: http://HOST:PORT/snapshot.jpg');
  console.log(' - HTML: http://HOST:PORT/');
}); 