/**
 * Server-side proxy so the backend host stays in Vercel env (API_BACKEND_URL),
 * not in the git repo or the browser bundle.
 *
 * Prefer pathname over req.query.path — on Vercel, catch-all query segments
 * are often empty for this Vite + /api setup, which would proxy only to "/".
 */
export default async function handler(req, res) {
  const base = (process.env.API_BACKEND_URL || '').replace(/\/$/, '');
  if (!base) {
    res.status(500).json({
      ok: false,
      error: 'API_BACKEND_URL is not set in Vercel environment variables',
    });
    return;
  }

  const incoming = new URL(req.url, 'http://localhost');
  const bridgePrefix = '/api/bridge/';
  let suffix = '';
  if (incoming.pathname.startsWith(bridgePrefix)) {
    suffix = incoming.pathname.slice(bridgePrefix.length);
  } else {
    const parts = req.query.path;
    suffix = Array.isArray(parts) ? parts.join('/') : parts || '';
  }

  const target = new URL(`${base}/${suffix}`);
  incoming.searchParams.forEach((value, key) => {
    if (key !== 'path') target.searchParams.append(key, value);
  });

  const headers = { accept: req.headers.accept || 'application/json' };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('content-type', contentType);
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: 'Upstream API request failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
