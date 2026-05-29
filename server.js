const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const FC_BASE  = 'https://fastcard1.store/client/api';
const FC_TOKEN = process.env.FC_API_TOKEN || 'QMMcLPmGsdgD6lQq9Z_2WFdfMQnLy1ZfM670CByiBS43O5PX6U9SHmlvMBI_ycg7';
const PROFIT   = parseFloat(process.env.PROFIT_MARGIN || '0.15');

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper ──────────────────────────────────────────────────
async function fc(endpoint, method = 'GET', params = {}) {
  const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
  let url = FC_BASE + endpoint;
  if (Object.keys(params).length) url += '?' + new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method,
    headers: { 'api-token': FC_TOKEN, 'Accept': 'application/json' }
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
}

// ── Routes ──────────────────────────────────────────────────

// Health
app.get('/health', (req, res) => res.json({ ok: true, fc_token: FC_TOKEN ? '✅' : '❌' }));

// Profile (رصيد FastCard)
app.get('/api/fc/profile', async (req, res) => {
  try { res.json(await fc('/profile')); }
  catch(e) { res.status(503).json({ error: e.message }); }
});

// Products
app.get('/api/fc/products', async (req, res) => {
  try {
    const data = await fc('/products');
    if (Array.isArray(data)) {
      data.forEach(p => { p.sell_price = +(p.price * (1 + PROFIT)).toFixed(3); });
    }
    res.json(data);
  } catch(e) { res.status(503).json({ error: e.message }); }
});

// New Order
app.post('/api/fc/order', async (req, res) => {
  const { productId, ...params } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId required' });
  try {
    const p = {};
    Object.entries(params).forEach(([k,v]) => p[k] = String(v));
    res.json(await fc(`/newOrder/${productId}/params`, 'POST', p));
  } catch(e) { res.status(503).json({ error: e.message }); }
});

// Check Order
app.get('/api/fc/check', async (req, res) => {
  const { orderId, uuid } = req.query;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const path = uuid === '1'
      ? `/check?orders=["${orderId}"]&uuid=1`
      : `/check?orders=[${orderId}]`;
    res.json(await fc(path));
  } catch(e) { res.status(503).json({ error: e.message }); }
});

// Catch-all → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ GameZone running on port ${PORT}`);
  console.log(`FC_TOKEN: ${FC_TOKEN ? FC_TOKEN.slice(0,10)+'...' : '❌ NOT SET'}`);
});
