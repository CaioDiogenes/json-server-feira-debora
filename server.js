import express from 'express';
import { JsonDB, Config } from 'node-json-db';
import { kv } from '@vercel/kv';

const app = express();
app.use(express.json());

const db = new JsonDB(new Config("db", true, false, '/'));
// Helpers
const KEYS = {
  aprovados: 'counters:aprovados',
  rejeitos: 'counters:rejeitos',
  feedbacks: 'counters:feedbacks',
  total: 'counters:total',
};

async function readAll() {
  const [ap, rj, fb, tt] = await kv.mget(
    KEYS.aprovados,
    KEYS.rejeitos,
    KEYS.feedbacks,
    KEYS.total
  );
  return {
    aprovados: Number(ap ?? 0),
    rejeitos: Number(rj ?? 0),
    feedbacks: Number(fb ?? 0),
    total: Number(tt ?? 0),
  };
}

function toNum(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

// GET /stats -> retorna todos os contadores
app.get('/stats', async (_req, res) => {
  try {
    const data = await readAll();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /stats/bulk -> incrementos independentes
// Body exemplo (feedback positivo):
// { "aprovados": 1, "feedbacks": 1, "total": 1 }
// (feedback negativo):
// { "rejeitos": 1, "feedbacks": 1, "total": 1 }
app.post('/stats/bulk', async (req, res) => {
  try {
    const aprovados = toNum(req.body?.aprovados);
    const rejeitos = toNum(req.body?.rejeitos);
    const feedbacks = toNum(req.body?.feedbacks);
    const total = toNum(req.body?.total);

    // pipeline atômico
    const p = kv.pipeline();
    if (aprovados) p.incrby(KEYS.aprovados, aprovados);
    if (rejeitos) p.incrby(KEYS.rejeitos, rejeitos);
    if (feedbacks) p.incrby(KEYS.feedbacks, feedbacks);
    if (total) p.incrby(KEYS.total, total);
    await p.exec();

    const data = await readAll();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /stats/reset -> zera tudo
app.post('/stats/reset', async (_req, res) => {
  try {
    const p = kv.pipeline();
    p.set(KEYS.aprovados, 0);
    p.set(KEYS.rejeitos, 0);
    p.set(KEYS.feedbacks, 0);
    p.set(KEYS.total, 0);
    await p.exec();

    const data = await readAll();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(3000, () => {
  console.log('🚀 JSON-DB server running at http://localhost:3000');
});
