import { useState } from 'react'
import { api } from '../api/client'
import FileTree from './FileTree'
import { formatBytes } from '../utils/format'

export default function AddTorrentPanel({ onAdded }) {
  const [magnet, setMagnet] = useState('')
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingDownload, setLoadingDownload] = useState(false)
  const [error, setError] = useState(null)

  async function handlePreview(e) {
    e.preventDefault()
    setError(null)
    setPreview(null)
    const value = magnet.trim()
    if (!value.startsWith('magnet:')) {
      setError('Please paste a valid magnet URI (starts with magnet:)')
      return
    }

    setLoadingPreview(true)
    try {
      const data = await api.preview(value)
      setPreview(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleDownload() {
    setError(null)
    setLoadingDownload(true)
    try {
      const torrent = await api.add(magnet.trim())
      onAdded?.(torrent)
      setPreview(null)
      setMagnet('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDownload(false)
    }
  }

  return (
    <section className="panel add-panel">
      <header className="panel-header">
        <h2>Add torrent</h2>
        <p>Paste a magnet link to preview contents, then start downloading.</p>
      </header>

      <form className="magnet-form" onSubmit={handlePreview}>
        <label htmlFor="magnet" className="sr-only">
          Magnet URI
        </label>
        <input
          id="magnet"
          type="text"
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
          placeholder="magnet:?xt=urn:btih:..."
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-secondary" disabled={loadingPreview || !magnet.trim()}>
          {loadingPreview ? 'Fetching…' : 'Preview'}
        </button>
      </form>

      {error && <div className="banner banner-error">{error}</div>}

      {loadingPreview && (
        <div className="banner banner-info">
          Resolving metadata from DHT / trackers… this can take up to a minute.
        </div>
      )}

      {preview && (
        <div className="preview-box">
          <div className="preview-meta">
            <div>
              <h3>{preview.name}</h3>
              <p className="muted">
                {preview.fileCount} file{preview.fileCount === 1 ? '' : 's'} · {formatBytes(preview.length)}
                {preview.alreadyAdded ? ' · already in queue' : ''}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={loadingDownload}
            >
              {loadingDownload ? 'Starting…' : preview.alreadyAdded ? 'Resume download' : 'Download'}
            </button>
          </div>
          <div className="preview-tree">
            <FileTree files={preview.files} />
          </div>
        </div>
      )}
    </section>
  )
}
