import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer } from 'ws'
import { TorrentManager, DOWNLOAD_DIR } from './torrentManager.js'

const PORT = Number(process.env.PORT) || 4000
const manager = new TorrentManager()

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, downloadDir: DOWNLOAD_DIR })
})

app.get('/api/torrents', (_req, res) => {
  res.json(manager.list())
})

app.get('/api/torrents/:infoHash', (req, res) => {
  const torrent = manager.get(req.params.infoHash)
  if (!torrent) return res.status(404).json({ error: 'Torrent not found' })
  res.json(torrent)
})

app.post('/api/torrents/preview', async (req, res) => {
  try {
    const { magnetURI } = req.body || {}
    const preview = await manager.preview(magnetURI)
    res.json(preview)
  } catch (err) {
    console.error('preview error:', err.message)
    res.status(err.status || 500).json({ error: err.message || 'Preview failed' })
  }
})

app.post('/api/torrents', async (req, res) => {
  try {
    const { magnetURI } = req.body || {}
    const torrent = await manager.addAndDownload(magnetURI)
    res.status(201).json(torrent)
  } catch (err) {
    console.error('add error:', err.message)
    res.status(err.status || 500).json({ error: err.message || 'Failed to add torrent' })
  }
})

app.post('/api/torrents/:infoHash/stop', (req, res) => {
  try {
    res.json(manager.stop(req.params.infoHash))
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.post('/api/torrents/:infoHash/start', (req, res) => {
  try {
    res.json(manager.start(req.params.infoHash))
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.delete('/api/torrents/:infoHash', async (req, res) => {
  try {
    const deleteFiles = req.query.deleteFiles === 'true'
    res.json(await manager.remove(req.params.infoHash, { deleteFiles }))
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data))
  }
}

wss.on('connection', (ws) => {
  send(ws, { type: 'torrents', data: manager.list() })

  const unsubscribe = manager.onUpdate((list) => {
    send(ws, { type: 'torrents', data: list })
  })

  ws.on('close', () => unsubscribe())
  ws.on('error', () => unsubscribe())
})

server.listen(PORT, () => {
  console.log(`Torrent backend listening on http://localhost:${PORT}`)
  console.log(`Downloads folder: ${DOWNLOAD_DIR}`)
  console.log(`WebSocket: ws://localhost:${PORT}/ws`)
})

function shutdown() {
  console.log('Shutting down...')
  manager.destroy()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message)
})

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err?.message || err)
})
