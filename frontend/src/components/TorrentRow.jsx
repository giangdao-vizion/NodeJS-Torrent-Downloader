import { useState } from 'react'
import { api } from '../api/client'
import { formatBytes, formatEta, formatSpeed, statusLabel } from '../utils/format'

export default function TorrentRow({ torrent }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isStopped = torrent.status === 'stopped'
  const isDone = torrent.status === 'completed' || torrent.done

  return (
    <article className={`torrent-row status-${torrent.status}`}>
      <div className="torrent-main">
        <div className="torrent-title-row">
          <h3 title={torrent.name}>{torrent.name}</h3>
          <span className={`pill pill-${torrent.status}`}>{statusLabel(torrent.status)}</span>
        </div>

        <div className="progress-track" aria-label={`Progress ${torrent.progress}%`}>
          <div className="progress-fill" style={{ width: `${Math.min(100, torrent.progress)}%` }} />
        </div>

        <div className="torrent-stats">
          <Stat label="Progress" value={`${torrent.progress.toFixed(1)}%`} />
          <Stat label="Downloaded" value={`${formatBytes(torrent.downloaded)} / ${formatBytes(torrent.length)}`} />
          <Stat label="↓ Speed" value={isStopped ? '—' : formatSpeed(torrent.downloadSpeed)} accent="down" />
          <Stat label="↑ Speed" value={isStopped ? '—' : formatSpeed(torrent.uploadSpeed)} accent="up" />
          <Stat label="Seeders" value={String(torrent.seeders ?? 0)} />
          <Stat label="Leechers" value={String(torrent.leechers ?? 0)} />
          <Stat label="Peers" value={String(torrent.numPeers ?? 0)} />
          <Stat label="ETA" value={isDone || isStopped ? '—' : formatEta(torrent.timeRemaining)} />
        </div>

        {error && <div className="banner banner-error compact">{error}</div>}
      </div>

      <div className="torrent-actions">
        {isStopped || isDone ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || isDone}
            onClick={() => run(() => api.start(torrent.infoHash))}
            title={isDone ? 'Already completed' : 'Restart download'}
          >
            Restart
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => run(() => api.stop(torrent.infoHash))}
          >
            Stop
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => run(() => api.remove(torrent.infoHash, false))}
        >
          Remove
        </button>
      </div>
    </article>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className={`stat ${accent ? `stat-${accent}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}
