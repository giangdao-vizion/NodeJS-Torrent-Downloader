import AddTorrentPanel from './components/AddTorrentPanel'
import TorrentList from './components/TorrentList'
import { useTorrents } from './hooks/useTorrents'

export default function App() {
  const { torrents, connected, error } = useTorrents()

  const active = torrents.filter((t) => t.status === 'downloading').length
  const totalDown = torrents.reduce((sum, t) => sum + (t.status === 'downloading' ? t.downloadSpeed : 0), 0)
  const totalUp = torrents.reduce((sum, t) => sum + (t.status !== 'stopped' ? t.uploadSpeed : 0), 0)

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />

      <header className="app-header">
        <div className="brand-block">
          <p className="brand">TorrentLab</p>
          <h1>Web torrent downloader</h1>
          <p className="tagline">
            Magnet preview, queue control, and live transfer stats — powered by Node.js + WebTorrent.
          </p>
        </div>

        <div className="header-metrics">
          <div className="metric">
            <span className="metric-label">Status</span>
            <span className={`metric-value ${connected ? 'ok' : 'bad'}`}>
              {connected ? 'Connected' : 'Reconnecting…'}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Active</span>
            <span className="metric-value">{active}</span>
          </div>
          <div className="metric">
            <span className="metric-label">↓ Total</span>
            <span className="metric-value down">{formatHeaderSpeed(totalDown)}</span>
          </div>
          <div className="metric">
            <span className="metric-label">↑ Total</span>
            <span className="metric-value up">{formatHeaderSpeed(totalUp)}</span>
          </div>
        </div>
      </header>

      {error && <div className="banner banner-error global">{error}</div>}

      <main className="app-main">
        <AddTorrentPanel />
        <TorrentList torrents={torrents} />
      </main>

      <footer className="app-footer">
        Files are saved to <code>backend/downloads</code>. DHT · Trackers · LSD · uTP enabled.
      </footer>
    </div>
  )
}

function formatHeaderSpeed(n) {
  if (!n) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}
