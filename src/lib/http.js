export async function readJson(req, fallback = {}) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8').trim();
  return body ? JSON.parse(body) : fallback;
}

export function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload, null, 2));
}

export function sendText(res, status, text, contentType = 'text/plain') {
  res.writeHead(status, { 'content-type': contentType });
  res.end(text);
}
