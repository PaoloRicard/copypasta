import { del } from '@vercel/blob';
import { checkAuth } from '../../lib/auth.js';
import { ensureTable } from '../../lib/db.js';

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;

  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  try {
    const sql = await ensureTable();

    // Registra +1 cópia
    if (req.method === 'PATCH') {
      const [row] = await sql`
        UPDATE images SET copies = copies + 1 WHERE id = ${id}
        RETURNING id, name, url, copies
      `;
      if (!row) return res.status(404).json({ error: 'Imagem não encontrada.' });
      return res.status(200).json(row);
    }

    // Remove do banco e do Blob
    if (req.method === 'DELETE') {
      const [row] = await sql`DELETE FROM images WHERE id = ${id} RETURNING url`;
      if (!row) return res.status(404).json({ error: 'Imagem não encontrada.' });
      await del(row.url).catch((e) => console.error('Falha ao apagar blob:', e));
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'PATCH, DELETE');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
