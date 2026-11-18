# RicardoCopy

Banco de imagens para copiar e colar rápido. Imagens no **Vercel Blob**, dados no **Neon Postgres**, acesso protegido por senha.

## Publicar

1. Suba esta pasta para um repositório no GitHub.
2. No Vercel: **Add New → Project** e importe o repositório (sem framework, deixe tudo padrão).
3. No projeto, aba **Storage**:
   - **Create → Blob** e conecte ao projeto (cria `BLOB_READ_WRITE_TOKEN`).
   - **Create → Neon (Postgres)** pelo Marketplace e conecte ao projeto (cria `DATABASE_URL`).
4. **Settings → Environment Variables**: crie `ADMIN_PASSWORD` com a senha que você quiser.
5. **Deployments → Redeploy** (as variáveis só valem em deploys novos).

A tabela `images` é criada automaticamente no primeiro acesso.

## Rodar localmente

```bash
npm i -g vercel
npm install
vercel link
vercel env pull .env.local
# adicione ADMIN_PASSWORD=... no .env.local
vercel dev
```

## Observações

- Imagens são reduzidas para no máx. 1200 px de largura e ~4 MB antes do envio (limite das funções do Vercel).
- Imagens guardadas no navegador antigo (localStorage) não aparecem aqui: o endereço é outro. Envie de novo.
