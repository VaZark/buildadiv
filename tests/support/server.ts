import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(process.cwd(), 'dist');
// `npm run serve-examples` uses 4173; the browser tests pass their own port so both can run at once.
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

// Runtime gallery data: orders with nested line items, and a paged catalog.
const freshOrders = () => [
  {
    id: 101,
    customer: 'Ada',
    total: 42.5,
    shipped: false,
    tags: ['gift', 'express'],
    items: [
      { sku: 'scarf', name: 'Scarf', quantity: 1 },
      { sku: 'hat', name: 'Hat', quantity: 2 },
    ],
  },
  {
    id: 102,
    customer: 'Grace',
    total: 15,
    shipped: true,
    tags: [],
    items: [{ sku: 'mug', name: 'Mug', quantity: 1 }],
  },
];
let orders = freshOrders();
const catalog = Array.from({ length: 8 }, (_, index) => ({
  sku: `item-${index + 1}`,
  name: `Catalog item ${index + 1}`,
  price: 5 * (index + 1),
}));
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
createServer(async (request, response) => {
  const url = new URL(request.url!, 'http://localhost');
  if (url.pathname === '/api/reset') {
    products = [
      { id: 1, name: 'Scarf', price: 25, inStock: true },
      { id: 2, name: 'Hat', price: 15, inStock: false },
    ];
    orders = freshOrders();
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
    // An optional delay keeps pending states visible long enough to see.
    const delay = Number(url.searchParams.get('delay')) || 0;
    if (url.pathname === '/api/orders' && request.method === 'GET') {
      await wait(delay);
      response.end(JSON.stringify(orders));
      return;
    }
    if (url.pathname === '/api/orders/none') {
      await wait(delay);
      response.writeHead(204);
      response.end();
      return;
    }
    const shipped = /^\/api\/orders\/(\d+)\/ship$/.exec(url.pathname)?.[1];
    if (shipped && request.method === 'POST') {
      const order = orders.find((candidate) => candidate.id === Number(shipped));
      if (!order) {
        response.writeHead(404);
        response.end('{}');
        return;
      }
      order.shipped = true;
      response.end(JSON.stringify(order));
      return;
    }
    if (url.pathname === '/api/orders/reopen' && request.method === 'POST') {
      orders = freshOrders().map((order) => ({ ...order, shipped: false }));
      response.end('{}');
      return;
    }
    if (url.pathname === '/api/outage') {
      await wait(delay);
      response.writeHead(503);
      response.end('{"message":"Orders service unavailable"}');
      return;
    }
    if (url.pathname === '/api/catalog') {
      await wait(delay);
      const size = Number(url.searchParams.get('size')) || 3;
      const pages = Math.ceil(catalog.length / size);
      const page = Math.min(Math.max(1, Number(url.searchParams.get('page')) || 1), pages);
      const items = catalog.slice((page - 1) * size, page * size);
      response.end(JSON.stringify({ items, page, pages, total: catalog.length }));
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
  console.log(`Runtime gallery:   ${origin}/examples/runtime/index.html`);
  console.log(`Manual playground: ${origin}/examples/playground/index.html`);
});
