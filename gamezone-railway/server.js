const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const FC_BASE  = 'https://fastcard1.store/client/api';
const FC_TOKEN = process.env.FC_API_TOKEN || '';

app.use(cors());
app.use(express.json());

// ── Serve frontend ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper ──────────────────────────────────────────────────
async function fcFetch(path, method = 'GET', params = {}) {
  const { default: fetch } = await import('node-fetch');
  let url = FC_BASE + path;
  if (Object.keys(params).length > 0) {
    const qs = new URLSearchParams(params).toString();
    url += '?' + qs;
  }
  const res = await fetch(url, {
    method,
    headers: { 'api-token': FC_TOKEN, 'Accept': 'application/json' }
  });
  return res.json();
}

// ── GET /api/fc/profile ─────────────────────────────────────
app.get('/api/fc/profile', async (req, res) => {
  try {
    const data = await fcFetch('/profile');
    res.json(data);
  } catch(e) {
    res.status(503).json({ error: 'FastCard unreachable' });
  }
});

// ── GET /api/fc/products ────────────────────────────────────
app.get('/api/fc/products', async (req, res) => {
  try {
    const data = await fcFetch('/products');
    const profit = parseFloat(process.env.PROFIT_MARGIN || '0.15');
    if (Array.isArray(data)) {
      data.forEach(p => { p.sell_price = +(p.price * (1 + profit)).toFixed(3); });
    }
    res.json(data);
  } catch(e) {
    res.status(503).json({ error: 'FastCard unreachable' });
  }
});

// ── POST /api/fc/order ──────────────────────────────────────
app.post('/api/fc/order', async (req, res) => {
  const { productId, ...params } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId required' });
  try {
    const strParams = {};
    Object.entries(params).forEach(([k,v]) => strParams[k] = String(v));
    const data = await fcFetch(`/newOrder/${productId}/params`, 'POST', strParams);
    res.json(data);
  } catch(e) {
    res.status(503).json({ error: 'FastCard unreachable' });
  }
});

// ── GET /api/fc/check ───────────────────────────────────────
app.get('/api/fc/check', async (req, res) => {
  const { orderId, uuid } = req.query;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const path = uuid === '1'
      ? `/check?orders=["${orderId}"]&uuid=1`
      : `/check?orders=[${orderId}]`;
    const data = await fcFetch(path);
    res.json(data);
  } catch(e) {
    res.status(503).json({ error: 'FastCard unreachable' });
  }
});

// ── Health ──────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Catch-all → index.html ──────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`✅ GameZone running on port ${PORT}`));
