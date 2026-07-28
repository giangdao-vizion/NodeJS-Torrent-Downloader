const API_BASE = ''

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  listTorrents: () => request('/api/torrents'),
  preview: (magnetURI) =>
    request('/api/torrents/preview', {
      method: 'POST',
      body: JSON.stringify({ magnetURI })
    }),
  add: (magnetURI) =>
    request('/api/torrents', {
      method: 'POST',
      body: JSON.stringify({ magnetURI })
    }),
  stop: (infoHash) =>
    request(`/api/torrents/${infoHash}/stop`, { method: 'POST' }),
  start: (infoHash) =>
    request(`/api/torrents/${infoHash}/start`, { method: 'POST' }),
  remove: (infoHash, deleteFiles = false) =>
    request(`/api/torrents/${infoHash}?deleteFiles=${deleteFiles}`, {
      method: 'DELETE'
    })
}
