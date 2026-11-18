import { createHash, timingSafeEqual } from 'node:crypto';

const sha = (s) => createHash('sha256').update(s).digest();

// Retorna true se a senha estiver correta. Caso contrário já responde ao cliente.
export function checkAuth(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'ADMIN_PASSWORD não configurada no Vercel.' });
    return false;
  }

  let given = String(req.headers['x-admin-password'] || '');
  try { given = decodeURIComponent(given); } catch { /* mantém como veio */ }

  if (!timingSafeEqual(sha(given), sha(expected))) {
    res.status(401).json({ error: 'Senha incorreta.' });
    return false;
  }
  return true;
}
