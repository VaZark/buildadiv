import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(process.cwd(), 'dist');
// `npm run dev` uses 4173; the browser tests pass their own port so both can run at once.
const port = Number(process.env.PORT) || 4173;
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};
let products = [
  { id: 1, name: 'Scarf', price: 25, inStock: true },
  { id: 2, name: 'Hat', price: 15, inStock: false },
];
const calls: Record<string, number> = {};
createServer(async (request, response) => {
  const url = new URL(request.url!, 'http://localhost');
  if (url.pathname === '/api/reset') {
    products = [
      { id: 1, name: 'Scarf', price: 25, inStock: true },
      { id: 2, name: 'Hat', price: 15, inStock: false },
    ];
    for (const key of Object.keys(calls)) delete calls[key];
    response.end('{}');
    return;
  }
  if (url.pathname === '/api/calls') {
    response.end(JSON.stringify(calls));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    calls[url.pathname + url.search] = (calls[url.pathname + url.search] || 0) + 1;
    response.setHeader('Content-Type', 'application/json');
    let body = '';
    for await (const chunk of request) body += chunk;
    if (url.pathname === '/api/products' && request.method === 'GET') {
      response.end(JSON.stringify(products));
      return;
    }
    if (url.pathname === '/api/products/1' && request.method === 'PUT') {
      products[0] = { ...products[0], ...JSON.parse(body) };
      response.end(JSON.stringify(products[0]));
      return;
    }
    const productId = /^\/api\/products\/(\d+)$/.exec(url.pathname)?.[1];
    if (productId && request.method === 'DELETE') {
      products = products.filter((product) => product.id !== Number(productId));
      response.writeHead(204);
      response.end();
      return;
    }
    if (url.pathname === '/api/import') {
      products[1].name = 'Imported hat';
      response.end('{}');
      return;
    }
    if (url.pathname === '/api/empty') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (url.pathname === '/api/zero') {
      response.end('[]');
      return;
    }
    if (url.pathname === '/api/error') {
      response.writeHead(500);
      response.end('{"message":"failure"}');
      return;
    }
    if (url.pathname === '/api/slow') {
      setTimeout(() => response.end('{}'), 200);
      return;
    }
    if (url.pathname === '/api/pages') {
      const page = Number(url.searchParams.get('page'));
      // An optional delay lets manual testers act while a page is still loading.
      const delay = Number(url.searchParams.get('delay')) || 0;
      setTimeout(() => response.end(JSON.stringify([{ id: page, name: `Page ${page}` }])), delay);
      return;
    }
    if (url.pathname === '/api/echo') {
      response.end(
        JSON.stringify({ method: request.method, type: request.headers['content-type'], body }),
      );
      return;
    }
    response.writeHead(404);
    response.end('{}');
    return;
  }
  try {
    const path = resolve(
      root,
      '.' +
        decodeURIComponent(url.pathname === '/' ? '/examples/vanilla/index.html' : url.pathname),
    );
    if (!path.startsWith(root + '/')) throw new Error('Invalid path');
    response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  const origin = `http://127.0.0.1:${port}`;
  console.log(`Runtime shop:      ${origin}/examples/vanilla/index.html`);
  console.log(`Builder preview:   ${origin}/examples/builder/index.html`);
  console.log(`Manual playground: ${origin}/examples/playground/index.html`);
});
