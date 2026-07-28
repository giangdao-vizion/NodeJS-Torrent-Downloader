import TorrentRow from './TorrentRow'

export default function TorrentList({ torrents }) {
  if (!torrents.length) {
    return (
      <section className="panel queue-panel empty">
        <header className="panel-header">
          <h2>Download queue</h2>
          <p>No torrents yet. Preview a magnet link above and hit Download.</p>
        </header>
      </section>
    )
  }

  return (
    <section className="panel queue-panel">
      <header className="panel-header">
        <h2>Download queue</h2>
        <p>
          {torrents.length} torrent{torrents.length === 1 ? '' : 's'} · live stats update every second
        </p>
      </header>
      <div className="torrent-list">
        {torrents.map((t) => (
          <TorrentRow key={t.infoHash} torrent={t} />
        ))}
      </div>
    </section>
  )
}
