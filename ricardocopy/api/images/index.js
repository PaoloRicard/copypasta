import { put, del } from '@vercel/blob';
import { checkAuth } from '../../lib/auth.js';
import { ensureTable } from '../../lib/db.js';

// Funções do Vercel aceitam no máximo ~4,5 MB no corpo da requisição
const MAX_BYTES = 4.4 * 1024 * 1024;
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;

  try {
    const sql = await ensureTable();

    // Lista todas as imagens
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, url, copies FROM images ORDER BY id DESC`;
      return res.status(200).json(rows);
    }

    // Envia uma imagem (corpo = arquivo binário, nome em ?name=)
    if (req.method === 'POST') {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const ext = TYPES[type];
      if (!ext) return res.status(415).json({ error: 'Formato não suportado (use PNG, JPEG ou WEBP).' });

      const body = await readBody(req);
      if (!body.length) return res.status(400).json({ error: 'Arquivo vazio.' });
      if (body.length > MAX_BYTES) return res.status(413).json({ error: 'Imagem acima de 4 MB.' });

      const name = String(req.query.name || '').trim().slice(0, 120) || 'sem-nome';

      const blob = await put(`images/img.${ext}`, body, {
        access: 'public',
        contentType: type,
        addRandomSuffix: true,
      });

      try {
        const [row] = await sql`
          INSERT INTO images (name, url) VALUES (${name}, ${blob.url})
          RETURNING id, name, url, copies
        `;
        return res.status(201).json(row);
      } catch (dbErr) {
        await del(blob.url).catch(() => {}); // não deixa arquivo órfão
        throw dbErr;
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
