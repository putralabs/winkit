import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { createJob, destroyJob, detectCapabilities, getJob, initStore, readOutput, setParams, startSweeper } from './queue.js';
import type { ToolParams } from './tools.js';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const API_KEY = process.env.WINKIT_API_KEY ?? '';
const DATA_DIR = process.env.DATA_DIR ?? './.winkit-jobs';
const TTL_MS = Number(process.env.JOB_TTL_MINUTES ?? 15) * 60_000;
const CONCURRENCY = Number(process.env.JOB_CONCURRENCY ?? 2);
const MAX_MB = Number(process.env.MAX_UPLOAD_MB ?? 200);

const ALLOWED_TOOLS = new Set([
  'video-transcode',
  'video-subtitles',
  'doc-convert',
  'pdf-to-word-cloud',
  'pdf-encrypt',
  'pdf-decrypt',
]);

const cfg = { dataDir: DATA_DIR, ttlMs: TTL_MS, concurrency: CONCURRENCY };

const app = Fastify({ logger: false, bodyLimit: MAX_MB * 1024 * 1024 });
await app.register(multipart, { limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 } });

// Scaffold CORS: the extension origin (chrome-extension://) and local web
// dev/preview must reach the API. Production: restrict to your domains.
app.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  reply.header('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return reply.code(204).send();
});

function authed(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  if (!API_KEY) return true; // dev without key: localhost only by default HOST
  const got = req.headers['x-api-key'];
  return typeof got === 'string' && got === API_KEY;
}

app.get('/v1/capabilities', async () => detectCapabilities());

app.get('/v1/health', async () => ({ ok: true, ttlMinutes: TTL_MS / 60000 }));

app.post('/v1/jobs', async (req, reply) => {
  if (!authed(req)) return reply.code(401).send({ error: 'unauthorized' });
  const toolId = (req.query as Record<string, string>).tool ?? '';
  if (!ALLOWED_TOOLS.has(toolId)) return reply.code(400).send({ error: 'unknown tool' });
  const file = await req.file();
  if (!file) return reply.code(400).send({ error: 'missing file' });
  const chunks: Buffer[] = [];
  for await (const chunk of file.file) chunks.push(chunk as Buffer);
  const bytes = Buffer.concat(chunks);
  if (bytes.length === 0) return reply.code(400).send({ error: 'empty file' });
  const params: ToolParams = {};
  const q = req.query as Record<string, string>;
  if (q.format) params.format = q.format;
  if (q.quality) params.quality = q.quality;
  if (q.maxWidth) params.maxWidth = Number(q.maxWidth);
  if (typeof file.fields.password === 'object' && 'value' in file.fields.password) {
    params.password = String((file.fields.password as { value: unknown }).value);
  }
  const job = await createJob(cfg, toolId, file.filename || 'input', bytes);
  setParams(job, params);
  return reply.code(202).send({ id: job.id, toolId, status: job.status });
});

app.get('/v1/jobs/:id', async (req, reply) => {
  if (!authed(req)) return reply.code(401).send({ error: 'unauthorized' });
  const job = getJob((req.params as Record<string, string>).id);
  if (!job) return reply.code(404).send({ error: 'not found' });
  return { id: job.id, toolId: job.toolId, status: job.status, progress: job.progress, error: job.error };
});

app.get('/v1/jobs/:id/download', async (req, reply) => {
  if (!authed(req)) return reply.code(401).send({ error: 'unauthorized' });
  const job = getJob((req.params as Record<string, string>).id);
  if (!job) return reply.code(404).send({ error: 'not found' });
  if (job.status !== 'ready') return reply.code(409).send({ error: 'not ready', status: job.status });
  const { bytes, name, mime } = await readOutput(job);
  // PRD §50: Download, then Delete.
  await destroyJob(cfg, job.id);
  return reply
    .header('Content-Type', mime)
    .header('Content-Disposition', `attachment; filename="${name.replace(/"/g, '')}"`)
    .send(bytes);
});

app.delete('/v1/jobs/:id', async (req, reply) => {
  if (!authed(req)) return reply.code(401).send({ error: 'unauthorized' });
  const ok = await destroyJob(cfg, (req.params as Record<string, string>).id);
  return ok ? { deleted: true } : reply.code(404).send({ error: 'not found' });
});

await initStore(DATA_DIR);
startSweeper(cfg);

await app.listen({ port: PORT, host: HOST });
console.log(`WinKit cloud scaffold on http://${HOST}:${PORT} (TTL ${TTL_MS / 60000}min, concurrency ${CONCURRENCY})`);
