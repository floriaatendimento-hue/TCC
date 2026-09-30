'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp  = require('sharp');

const { assinaturaBate, MIME_IMAGEM } = require('./uploadAvaliacoes');

const BASE_DIR = path.join(__dirname, '../public/uploads/produtos');
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

const MAX_PRODUTO_MB    = parseInt(process.env.UPLOAD_PRODUTO_MB || '5', 10);
const MAX_PRODUTO_BYTES = MAX_PRODUTO_MB * 1024 * 1024;
const LADO_IMAGEM       = 1200;

const CAMPOS_IMAGEM = ['imagem_1', 'imagem_2', 'imagem_3'];

const uploadProduto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PRODUTO_BYTES, files: 3 },
  fileFilter(_req, file, cb) {
    if (!MIME_IMAGEM[file.mimetype]) {
      return cb(new Error('Formato de imagem não permitido. Use JPG, JPEG, PNG ou WebP.'));
    }
    cb(null, true);
  },
}).fields(CAMPOS_IMAGEM.map((name) => ({ name, maxCount: 1 })));

function nomeAleatorio(ext) {
  return `produto_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
}

async function processarImagemProduto(buffer, mimetype) {
  const ext = MIME_IMAGEM[mimetype];
  const nome = nomeAleatorio(ext);
  const destino = path.join(BASE_DIR, nome);

  let imagem = sharp(buffer).rotate().resize({
    width: LADO_IMAGEM,
    height: LADO_IMAGEM,
    fit: 'cover',
  });

  if (mimetype === 'image/jpeg')      imagem = imagem.jpeg({ quality: 85, mozjpeg: true });
  else if (mimetype === 'image/png')  imagem = imagem.png({ compressionLevel: 8 });
  else if (mimetype === 'image/webp') imagem = imagem.webp({ quality: 85 });

  await imagem.toFile(destino);
  return `/uploads/produtos/${nome}`;
}

function removerImagemProduto(urlPublica) {
  if (!urlPublica || typeof urlPublica !== 'string') return;
  const relativo = urlPublica.replace(/^\/+/, '');
  if (!relativo.startsWith('uploads/produtos/')) return;
  const caminho = path.join(__dirname, '../public', relativo);
  if (!caminho.startsWith(BASE_DIR)) return;
  fs.promises.unlink(caminho).catch(() => {});
}

function uploadImagensProduto(req, res, next) {
  uploadProduto(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `Arquivo muito grande. Máximo: ${MAX_PRODUTO_MB} MB por imagem.`
        : err.message;
      return res.status(400).json({ ok: false, message });
    }

    for (const campo of CAMPOS_IMAGEM) {
      const arquivo = req.files && req.files[campo] && req.files[campo][0];
      if (arquivo && !assinaturaBate(arquivo.buffer, arquivo.mimetype)) {
        return res.status(400).json({ ok: false, message: 'Um dos arquivos enviados não é uma imagem válida.' });
      }
    }

    next();
  });
}

module.exports = {
  uploadImagensProduto,
  processarImagemProduto,
  removerImagemProduto,
  CAMPOS_IMAGEM,
  MAX_PRODUTO_MB,
};
