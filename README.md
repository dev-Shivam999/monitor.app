# ScreenStreamer Server (Node.js)

Receives JPEG frames from the Android client via WebSocket or HTTP MJPEG and serves them to admins.

## Install & Run
```bash
cd server
npm install
npm start
```
Default port: 8080 (set `PORT` env var to change).

## Endpoints
- Ingest
  - WebSocket: `ws://HOST:PORT/stream` (each binary message is one JPEG frame)
  - HTTP MJPEG POST: `http://HOST:PORT/stream` (Content-Type: multipart/x-mixed-replace; boundary=...)
- View
  - MJPEG stream: `http://HOST:PORT/mjpeg`
  - Snapshot: `http://HOST:PORT/snapshot.jpg`
  - Simple HTML viewer: `http://HOST:PORT/`

## Android client configuration
- In the app’s `Server URL` field, set one of:
  - WebSocket: `ws://YOUR_SERVER:8080/stream`
  - HTTP MJPEG: `http://YOUR_SERVER:8080/stream`
- FPS and JPEG quality can be adjusted in the app UI.

## Notes
- Behind reverse proxies, ensure they allow WebSocket upgrades and large/streamed request bodies.
- MJPEG POST keeps the HTTP connection open; do not buffer the entire body.
- For production, serve over HTTPS/WSS. 