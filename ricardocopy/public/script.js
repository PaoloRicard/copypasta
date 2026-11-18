const API = '/api/images';
const MAX_WIDTH = 1200;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // limite das funções do Vercel é ~4,5 MB

let images = [];
let password = localStorage.getItem('rc_password') || '';
const pngCache = new Map(); // id -> Promise<Blob PNG> (deixa as cópias seguintes instantâneas)

const topRanking = document.getElementById('topRanking');
const mainGallery = document.getElementById('mainGallery');
const searchInput = document.getElementById('searchInput');
const fileInput = document.getElementById('fileInput');
const toastEl = document.getElementById('toast');
const placeholderURL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg==";

/* ---------- Utilidades ---------- */

// Escapa texto antes de colocar em innerHTML (evita XSS pelo nome do arquivo)
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

let toastTimer;
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 3000);
}

/* ---------- Comunicação com o servidor ---------- */

// Chama a API enviando a senha; se estiver errada/ausente, pede de novo
async function api(path, options = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
        if (!password) {
            const typed = prompt('Digite a senha de acesso:');
            if (typed === null) throw new Error('Acesso cancelado.');
            password = typed;
        }

        const res = await fetch(path, {
            ...options,
            headers: { ...(options.headers || {}), 'x-admin-password': encodeURIComponent(password) }
        });

        if (res.status === 401) {
            password = '';
            localStorage.removeItem('rc_password');
            continue;
        }

        let data = null;
        try { data = await res.json(); } catch { /* resposta sem corpo */ }
        if (!res.ok) throw new Error((data && data.error) || `Erro ${res.status}`);

        localStorage.setItem('rc_password', password);
        return data;
    }
    throw new Error('Senha incorreta.');
}

async function load() {
    try {
        images = await api(API);
        render(searchInput.value);
    } catch (err) {
        topRanking.innerHTML = '';
        mainGallery.innerHTML = `<p style="padding:20px">⚠️ ${escapeHtml(err.message)}</p>`;
    }
}

/* ---------- Renderização (só desenha, não salva nada) ---------- */

function render(filter = '') {
    if (images.length === 0) {
        topRanking.innerHTML = `<div class="card"><img src="${placeholderURL}" style="width:100%" alt="Sem imagem"></div>`;
        mainGallery.innerHTML = "<p style='padding:20px'>Nenhuma imagem adicionada. Clique em 'Adicionar Imagem' acima.</p>";
        return;
    }

    // Ranking (Top 5)
    const sorted = [...images].sort((a, b) => b.copies - a.copies);
    topRanking.innerHTML = sorted.slice(0, 5).map((img, i) => createCard(img, i + 1)).join('');

    // Galeria com filtro
    const term = filter.trim().toLowerCase();
    const filtered = term ? images.filter(img => img.name.toLowerCase().includes(term)) : images;

    mainGallery.innerHTML = filtered.length === 0
        ? "<p style='padding:20px'>Nenhuma imagem encontrada para essa busca.</p>"
        : filtered.map(img => createCard(img)).join('');
}

function createCard(img, rank = null) {
    const name = escapeHtml(img.name);
    return `
        <div class="card">
            ${rank ? `<span class="badge">#${rank}</span>` : ''}
            <div class="img-container">
                <img src="${escapeHtml(img.url)}" alt="${name}" loading="lazy">
                <div class="overlay">
                    <button class="btn-copy" data-id="${img.id}" type="button">
                        <i class="fas fa-copy"></i> COPIAR
                    </button>
                    <button class="btn-delete" data-id="${img.id}" type="button" aria-label="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-info">
                <h3 title="${name}">${name}</h3>
                <span class="copy-count">${img.copies} envio${img.copies !== 1 ? 's' : ''}</span>
            </div>
        </div>
    `;
}

/* ---------- Copiar ---------- */

// Baixa a imagem e garante que seja PNG (único formato aceito pela área de transferência)
function getPngBlob(img) {
    if (!pngCache.has(img.id)) {
        const promise = (async () => {
            const res = await fetch(img.url, { mode: 'cors' });
            if (!res.ok) throw new Error('Falha ao baixar a imagem');
            const blob = await res.blob();
            if (blob.type === 'image/png') return blob;

            const bmp = await createImageBitmap(blob);
            const canvas = document.createElement('canvas');
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            canvas.getContext('2d').drawImage(bmp, 0, 0);
            if (bmp.close) bmp.close();
            return await new Promise((resolve, reject) =>
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob falhou')), 'image/png'));
        })();
        promise.catch(() => pngCache.delete(img.id));
        pngCache.set(img.id, promise);
    }
    return pngCache.get(img.id);
}

async function copyImage(id) {
    const img = images.find(i => i.id === id);
    if (!img) return;

    try {
        // Passa a Promise direto: mantém o "gesto do usuário" mesmo com download em andamento
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': getPngBlob(img) })]);
    } catch (err) {
        console.error(err);
        alert("Erro ao copiar: seu navegador pode estar bloqueando o acesso à área de transferência.\n\nTente usar o Chrome e permita o acesso quando solicitado.");
        return;
    }

    showToast('✅ Copiado para o chat!');

    try {
        const updated = await api(`${API}/${id}`, { method: 'PATCH' });
        img.copies = updated.copies;
    } catch {
        img.copies++; // a cópia funcionou; só o contador não sincronizou
    }
    render(searchInput.value);
}

/* ---------- Remover ---------- */

async function deleteImage(id) {
    if (!confirm('Remover esta imagem?')) return;
    try {
        await api(`${API}/${id}`, { method: 'DELETE' });
        images = images.filter(i => i.id !== id);
        pngCache.delete(id);
        render(searchInput.value);
    } catch (err) {
        showToast('⚠️ ' + err.message);
    }
}

/* ---------- Enviar ---------- */

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao processar a imagem')), type, quality));
}

function drawToCanvas(img, w, h, whiteBg) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (whiteBg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } // JPEG não tem transparência
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
}

// Redimensiona e comprime. PNG continua PNG (se couber no limite); o resto vira JPEG.
async function prepareImage(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('formato de imagem não suportado pelo navegador'));
            el.src = objectUrl;
        });

        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX_WIDTH) { h = Math.round(h * MAX_WIDTH / w); w = MAX_WIDTH; }

        if (file.type === 'image/png') {
            const png = await canvasToBlob(drawToCanvas(img, w, h, false), 'image/png');
            if (png.size <= MAX_UPLOAD_BYTES) return png;
        }

        for (const quality of [0.85, 0.65, 0.5]) {
            const jpg = await canvasToBlob(drawToCanvas(img, w, h, true), 'image/jpeg', quality);
            if (jpg.size <= MAX_UPLOAD_BYTES) return jpg;
        }
        throw new Error('imagem muito grande mesmo após compressão');
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

document.getElementById('btnUpload').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async function () {
    const files = Array.from(this.files);
    this.value = '';

    const errors = [];
    let ok = 0;

    for (const [i, file] of files.entries()) {
        try {
            showToast(`⏳ Enviando ${i + 1}/${files.length}...`);
            const blob = await prepareImage(file);
            const name = file.name.replace(/\.[^.]+$/, ''); // remove extensão
            const created = await api(`${API}?name=${encodeURIComponent(name)}`, {
                method: 'POST',
                headers: { 'Content-Type': blob.type },
                body: blob
            });
            images.unshift(created);
            ok++;
            render(searchInput.value);
        } catch (err) {
            errors.push(`${file.name}: ${err.message}`);
        }
    }

    if (ok) showToast(`✅ ${ok} imagem(ns) adicionada(s)`);
    if (errors.length) alert('Algumas imagens não foram enviadas:\n\n' + errors.join('\n'));
});

/* ---------- Eventos ---------- */

// Delegação: um único listener cuida de todos os botões dos cards
document.addEventListener('click', e => {
    const copyBtn = e.target.closest('.btn-copy');
    if (copyBtn) return copyImage(Number(copyBtn.dataset.id));

    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) return deleteImage(Number(delBtn.dataset.id));
});

searchInput.addEventListener('input', () => render(searchInput.value));

load();
