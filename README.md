# NodeJS Torrent Downloader

Web-based BitTorrent client (uTorrent-style) built with **Node.js + WebTorrent** and a React UI.

## Features

- Paste a **magnet URI** → preview files/folders before downloading
- **Download** adds the torrent to the queue and starts transferring
- **Stop** / **Restart** individual torrents
- Live stats: seeders, leechers, ↓/↑ speed, progress %
- Peer discovery via DHT, trackers, LSD, and uTP (WebTorrent)

## Project structure

```
├── backend/          # Express API + WebTorrent + WebSocket
├── frontend/         # React (Vite) UI
├── package.json      # yarn start → both apps
└── README.md
```

## Requirements

- Node.js ≥ 18
- Yarn classic

## Setup

```bash
yarn install:all
```

## Run

```bash
yarn start
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:4000  
- Downloads saved to `backend/downloads`

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/torrents/preview` | `{ magnetURI }` → file tree metadata |
| POST | `/api/torrents` | `{ magnetURI }` → start download |
| GET | `/api/torrents` | List queue |
| POST | `/api/torrents/:infoHash/stop` | Stop torrent |
| POST | `/api/torrents/:infoHash/start` | Restart torrent |
| DELETE | `/api/torrents/:infoHash` | Remove from client |
| WS | `/ws` | Live torrent stats every ~1s |

## Notes

- Preview uses `deselect: true` so pieces are not downloaded until you click **Download**.
- Some networks/firewalls block BitTorrent ports; peer discovery may take time.
- Only download content you have the right to download.
