export function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value < 10 && i > 0 ? value.toFixed(2) : value < 100 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

export function formatSpeed(bytesPerSec = 0) {
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatEta(ms) {
  if (!Number.isFinite(ms) || ms <= 0 || ms === Infinity) return '—'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ${min % 60}m`
  const days = Math.floor(hr / 24)
  return `${days}d ${hr % 24}h`
}

export function statusLabel(status) {
  switch (status) {
    case 'downloading':
      return 'Downloading'
    case 'stopped':
      return 'Stopped'
    case 'completed':
      return 'Completed'
    default:
      return status || 'Unknown'
  }
}
