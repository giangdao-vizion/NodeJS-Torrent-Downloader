import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

export function useTorrents() {
  const [torrents, setTorrents] = useState([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const retryRef = useRef(0)

  useEffect(() => {
    let ws
    let closed = false
    let retryTimer

    async function bootstrap() {
      try {
        const list = await api.listTorrents()
        if (!closed) setTorrents(list)
      } catch (err) {
        if (!closed) setError(err.message)
      }
    }

    function connect() {
      ws = new WebSocket(wsUrl())

      ws.onopen = () => {
        retryRef.current = 0
        setConnected(true)
        setError(null)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'torrents') {
            setTorrents(msg.data || [])
          }
        } catch {
          /* ignore */
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (closed) return
        const delay = Math.min(8000, 500 * 2 ** retryRef.current)
        retryRef.current += 1
        retryTimer = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    bootstrap()
    connect()

    return () => {
      closed = true
      clearTimeout(retryTimer)
      if (ws) ws.close()
    }
  }, [])

  return { torrents, connected, error, setTorrents }
}
