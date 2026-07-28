import WebTorrent from 'webtorrent'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOWNLOAD_DIR = path.resolve(__dirname, '../downloads')

/** Public trackers appended to magnet announces for better peer discovery */
const DEFAULT_ANNOUNCE = [
  'udp://tracker.openbittorrent.com:6969',
  'udp://tracker.opentrackr.org:1337',
  'udp://open.stealth.si:80',
  'udp://tracker.torrent.eu.org:451',
  'udp://explodie.org:6969',
  'udp://tracker.moeking.me:6969',
  'udp://tracker.tiny-vps.com:6969',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev'
]

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
}

/**
 * Optimized BitTorrent client settings (similar to desktop clients):
 * - DHT + trackers + LSD + PEX for peer discovery
 * - Higher connection limits for better piece availability
 * - uTP + TCP transports (enabled by WebTorrent defaults on Node)
 */
function createClient() {
  return new WebTorrent({
    maxConns: 55,
    dht: true,
    lsd: true,
    utp: true,
    utPex: true,
    webSeeds: true,
    tracker: true
  })
}

function torrentOpts(extra = {}) {
  return {
    path: DOWNLOAD_DIR,
    announce: DEFAULT_ANNOUNCE,
    // Rarest-first improves swarm health vs sequential (closer to classic clients)
    strategy: 'rarest',
    ...extra
  }
}

function waitForTorrent(torrent, eventName = 'ready', timeoutMs = 60000) {
  if (eventName === 'ready' && torrent.ready) return Promise.resolve(torrent)
  if (eventName === 'metadata' && torrent.files?.length) return Promise.resolve(torrent)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(Object.assign(new Error(`Timed out waiting for torrent ${eventName}`), { status: 504 }))
    }, timeoutMs)

    const onOk = () => {
      cleanup()
      resolve(torrent)
    }
    const onErr = (err) => {
      cleanup()
      reject(err)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      torrent.removeListener(eventName, onOk)
      torrent.removeListener('error', onErr)
    }

    torrent.once(eventName, onOk)
    torrent.once('error', onErr)
  })
}

function buildFileTree(files) {
  const root = { name: '', type: 'folder', children: {}, size: 0 }

  for (const file of files) {
    const parts = file.path.split(/[/\\]/).filter(Boolean)
    let node = root
    let accumulated = 0

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1

      if (!node.children[part]) {
        node.children[part] = isFile
          ? { name: part, type: 'file', size: file.length, path: file.path }
          : { name: part, type: 'folder', children: {}, size: 0 }
      }

      if (isFile) {
        accumulated = file.length
      }
      node = node.children[part]
    }

    // Bubble size up
    let walk = root
    for (const part of parts) {
      if (walk.children[part].type === 'folder') {
        walk.children[part].size += accumulated
      }
      walk = walk.children[part]
    }
    root.size += accumulated
  }

  function toArray(node) {
    if (node.type === 'file') {
      return { name: node.name, type: 'file', size: node.size, path: node.path }
    }
    return {
      name: node.name,
      type: 'folder',
      size: node.size,
      children: Object.values(node.children)
        .map(toArray)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
    }
  }

  const tree = toArray(root)
  return tree.children || []
}

function peerHasAllPieces(wire, pieceCount) {
  if (!wire?.peerPieces || !pieceCount) return false
  const bf = wire.peerPieces
  try {
    if (typeof bf.cardinality === 'function') {
      return bf.cardinality() >= pieceCount
    }
    if (typeof bf.get === 'function') {
      for (let i = 0; i < pieceCount; i++) {
        if (!bf.get(i)) return false
      }
      return true
    }
  } catch {
    return false
  }
  return false
}

function countSeedersLeechers(torrent) {
  let seeders = 0
  let leechers = 0
  const pieceCount = torrent.pieces?.length || 0

  for (const wire of torrent.wires || []) {
    if (peerHasAllPieces(wire, pieceCount)) seeders += 1
    else leechers += 1
  }

  return { seeders, leechers }
}

function serializeTorrent(entry) {
  const { torrent, status, magnetURI, addedAt } = entry
  const { seeders, leechers } = countSeedersLeechers(torrent)

  return {
    infoHash: torrent.infoHash,
    name: torrent.name || 'Unknown',
    magnetURI,
    status,
    progress: Math.min(100, Math.round((torrent.progress || 0) * 10000) / 100),
    downloadSpeed: torrent.downloadSpeed || 0,
    uploadSpeed: torrent.uploadSpeed || 0,
    downloaded: torrent.downloaded || 0,
    uploaded: torrent.uploaded || 0,
    length: torrent.length || 0,
    ratio: torrent.ratio || 0,
    numPeers: torrent.numPeers || 0,
    seeders,
    leechers,
    timeRemaining: torrent.timeRemaining || 0,
    done: Boolean(torrent.done),
    addedAt,
    path: torrent.path,
    files: (torrent.files || []).map((f) => ({
      name: f.name,
      path: f.path,
      length: f.length,
      progress: Math.min(100, Math.round((f.progress || 0) * 10000) / 100),
      downloaded: f.downloaded || 0
    }))
  }
}

export class TorrentManager {
  constructor() {
    this.client = createClient()
    this.entries = new Map() // infoHash -> { torrent, status, magnetURI, addedAt }
    this.previewPending = new Map() // temp id / magnet key -> promise metadata
    this.listeners = new Set()

    this.client.on('error', (err) => {
      console.error('[WebTorrent]', err.message)
    })

    // Push live stats ~1s
    this._statsTimer = setInterval(() => this._broadcast(), 1000)
  }

  onUpdate(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  _broadcast() {
    const list = this.list()
    for (const fn of this.listeners) {
      try {
        fn(list)
      } catch (err) {
        console.error('broadcast error', err)
      }
    }
  }

  list() {
    return [...this.entries.values()].map(serializeTorrent)
  }

  get(infoHash) {
    const entry = this.findEntry(infoHash)
    return entry ? serializeTorrent(entry) : null
  }

  /**
   * Fetch metadata only (deselect all pieces) for file/folder preview.
   */
  async preview(magnetURI) {
    if (!magnetURI || !magnetURI.startsWith('magnet:')) {
      throw Object.assign(new Error('Invalid magnet URI'), { status: 400 })
    }

    const existing = await this.client.get(magnetURI)
    if (existing && existing.ready) {
      return {
        infoHash: existing.infoHash,
        name: existing.name,
        length: existing.length,
        files: buildFileTree(existing.files),
        fileCount: existing.files.length,
        alreadyAdded: this.entries.has(existing.infoHash)
      }
    }

    // If a non-ready torrent is already in the client, wait for metadata
    if (existing && !existing.ready) {
      await waitForTorrent(existing, 'metadata')
      for (const file of existing.files) file.deselect()
      return {
        infoHash: existing.infoHash,
        name: existing.name,
        length: existing.length,
        files: buildFileTree(existing.files),
        fileCount: existing.files.length,
        alreadyAdded: this.entries.has(existing.infoHash)
      }
    }

    const torrent = await new Promise((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        try {
          if (torrentRef) this.client.remove(torrentRef, { destroyStore: false })
        } catch {
          /* ignore */
        }
        reject(Object.assign(new Error('Timed out waiting for torrent metadata'), { status: 504 }))
      }, 60000)

      let torrentRef = null

      try {
        torrentRef = this.client.add(magnetURI, torrentOpts({ deselect: true }))
      } catch (err) {
        clearTimeout(timeout)
        reject(err)
        return
      }

      torrentRef.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(err)
      })

      torrentRef.on('metadata', () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        // Keep deselected — preview only
        for (const file of torrentRef.files) {
          file.deselect()
        }
        resolve(torrentRef)
      })
    })

    return {
      infoHash: torrent.infoHash,
      name: torrent.name,
      length: torrent.length,
      files: buildFileTree(torrent.files),
      fileCount: torrent.files.length,
      alreadyAdded: this.entries.has(torrent.infoHash)
    }
  }

  /**
   * Start (or resume) downloading a torrent from magnet.
   */
  async addAndDownload(magnetURI) {
    if (!magnetURI || !magnetURI.startsWith('magnet:')) {
      throw Object.assign(new Error('Invalid magnet URI'), { status: 400 })
    }

    let torrent = await this.client.get(magnetURI)

    if (!torrent) {
      torrent = await new Promise((resolve, reject) => {
        let settled = false
        const t = this.client.add(magnetURI, torrentOpts())

        const timeout = setTimeout(() => {
          if (settled) return
          settled = true
          reject(Object.assign(new Error('Timed out waiting for torrent metadata'), { status: 504 }))
        }, 60000)

        t.on('error', (err) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          reject(err)
        })

        t.on('ready', () => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          resolve(t)
        })
      })
    } else {
      if (!torrent.ready) {
        await waitForTorrent(torrent, 'ready')
      }
      // Was preview-only or stopped — select all pieces and resume peering
      for (const file of torrent.files || []) {
        file.select()
      }
      if (typeof torrent.resume === 'function') {
        torrent.resume()
      }
    }

    const infoHash = torrent.infoHash
    const entry = {
      torrent,
      status: torrent.done ? 'completed' : 'downloading',
      magnetURI: torrent.magnetURI || magnetURI,
      addedAt: this.entries.get(infoHash)?.addedAt || Date.now()
    }

    torrent.removeAllListeners('done')
    torrent.on('done', () => {
      const e = this.entries.get(infoHash)
      if (e) e.status = 'completed'
      this._broadcast()
    })

    this.entries.set(infoHash, entry)
    this._broadcast()
    return serializeTorrent(entry)
  }

  stop(infoHash) {
    const entry = this.findEntry(infoHash)
    if (!entry) {
      throw Object.assign(new Error('Torrent not found'), { status: 404 })
    }

    const { torrent } = entry
    // Deselect pieces so we stop requesting data
    for (const file of torrent.files) {
      file.deselect()
    }
    if (typeof torrent.pause === 'function') {
      torrent.pause()
    }
    // Tear down active peer wires to halt in-flight transfers
    for (const wire of [...(torrent.wires || [])]) {
      try {
        wire.destroy()
      } catch {
        /* ignore */
      }
    }
    entry.status = 'stopped'
    this._broadcast()
    return serializeTorrent(entry)
  }

  start(infoHash) {
    const entry = this.findEntry(infoHash)
    if (!entry) {
      throw Object.assign(new Error('Torrent not found'), { status: 404 })
    }

    const { torrent } = entry
    for (const file of torrent.files) {
      file.select()
    }
    if (typeof torrent.resume === 'function') {
      torrent.resume()
    }

    entry.status = torrent.done ? 'completed' : 'downloading'
    this._broadcast()
    return serializeTorrent(entry)
  }

  findEntry(infoHash) {
    if (!infoHash) return null
    const direct = this.entries.get(infoHash) || this.entries.get(infoHash.toLowerCase())
    if (direct) return direct
    const key = [...this.entries.keys()].find((k) => k.toLowerCase() === infoHash.toLowerCase())
    return key ? this.entries.get(key) : null
  }

  async remove(infoHash, { deleteFiles = false } = {}) {
    const key = [...this.entries.keys()].find((k) => k.toLowerCase() === infoHash?.toLowerCase())
    const entry = key ? this.entries.get(key) : null
    if (!entry) {
      throw Object.assign(new Error('Torrent not found'), { status: 404 })
    }

    await this.client.remove(entry.torrent, { destroyStore: deleteFiles })
    this.entries.delete(key)
    this._broadcast()
    return { ok: true }
  }

  destroy() {
    clearInterval(this._statsTimer)
    this.client.destroy()
  }
}

export { DOWNLOAD_DIR }
