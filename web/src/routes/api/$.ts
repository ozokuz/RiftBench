// src/routes/api/$.ts
import { createFileRoute } from '@tanstack/react-router'

const API_URL = process.env.API_HTTP

async function proxy({ request, params }: any) {
    if (!API_URL) {
        return new Response('Not Found', {status: 404})
    }
  const url = new URL(request.url)
  const path = params._splat ?? ''

  const headers = new Headers(request.headers)
  headers.delete('host')

  return fetch(`${API_URL}/api/${path}${url.search}`, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    // needed by Node fetch when streaming a request body
    duplex: 'half',
  } as RequestInit)
}

export const Route = createFileRoute('/api/$')({
    server: {
        handlers: {
            GET: proxy,
            POST: proxy,
            PUT: proxy,
            PATCH: proxy,
            DELETE: proxy,
        }
    }
})
