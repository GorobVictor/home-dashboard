// Read-only fixture based on https://apidocs.freelancehunt.com/ pagination envelope.
const http = require('node:http');
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('content-type', 'application/json');
  if (url.pathname === '/v2/threads') {
    res.writeHead(429, { 'Retry-After': '120' }); res.end(JSON.stringify({ error: { message: 'Rate limited' } })); return;
  }
  if (url.pathname === '/v2/projects') {
    const page = Number(url.searchParams.get('page[number]') || 1);
    res.end(JSON.stringify({ data: [{ id: page, attributes: { name: `Project ${page}`, skills: [], published_at: '2026-10-23T10:00:00Z' } }], links: { self: `/v2/projects?page[number]=${page}`, ...(page < 2 ? { next: '/v2/projects?page[number]=2' } : {}) } })); return;
  }
  res.writeHead(501); res.end(JSON.stringify({ error: 'Endpoint not modeled' }));
}).listen(process.env.PORT);
