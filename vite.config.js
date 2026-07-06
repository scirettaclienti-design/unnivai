import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// DVAI-049 — Mirror dev-only della Edge Function places-proxy.
// In prod il client chiama ${VITE_SUPABASE_URL}/functions/v1/places-proxy.
// In dev (vite serve) intercettiamo /__dev/places-proxy e replichiamo
// la stessa logica server-side, così possiamo testare senza deploy.
const ALLOWED_PATHS = new Set(['place/findplacefromtext', 'place/photo', 'place/details'])
const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api'

function devPlacesProxyPlugin(env) {
  return {
    name: 'dvai-dev-places-proxy',
    apply: 'serve',
    configureServer(server) {
      // No `return () => ...`: il middleware deve essere registrato PRIMA
      // dei middleware interni di Vite, altrimenti l'SPA fallback vince.
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/__dev/places-proxy')) return next()

        const key = env.GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY
        if (!key) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY missing in env' }))
        }
        const url = new URL(req.url, 'http://localhost')
        const path = url.searchParams.get('path')
        if (!path || !ALLOWED_PATHS.has(path)) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Path not allowed', allowed: [...ALLOWED_PATHS] }))
        }
        const upstreamParams = new URLSearchParams()
        for (const [k, v] of url.searchParams.entries()) {
          if (k === 'path') continue
          upstreamParams.set(k, v)
        }
        upstreamParams.set('key', key)
        const isPhoto = path === 'place/photo'
        const upstreamUrl = `${GOOGLE_BASE}/${path}${isPhoto ? '' : '/json'}?${upstreamParams.toString()}`
        try {
          if (isPhoto) {
            const upstream = await fetch(upstreamUrl, { redirect: 'manual' })
            if (upstream.status === 302 || upstream.status === 303) {
              const loc = upstream.headers.get('location')
              res.statusCode = 302
              res.setHeader('Location', loc || '')
              return res.end()
            }
            res.statusCode = upstream.status
            const ct = upstream.headers.get('content-type')
            if (ct) res.setHeader('Content-Type', ct)
            const buf = Buffer.from(await upstream.arrayBuffer())
            return res.end(buf)
          }
          const upstream = await fetch(upstreamUrl)
          const data = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          return res.end(data)
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'upstream failed', detail: String(err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devPlacesProxyPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
