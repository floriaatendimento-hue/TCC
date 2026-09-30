'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp  = require('sharp');

const { assinaturaBate, MIME_IMAGEM } = require('./uploadAvaliacoes');

const BASE_DIR = path.join(__dirname, '../public/uploads/banners');
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

const MAX_BANNER_MB    = parseInt(process.env.UPLOAD_BANNER_MB || '5', 10);
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const LARGURA_MAXIMA   = 1920;

const uploadBanner = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BANNER_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!MIME_IMAGEM[file.mimetype]) {
      return cb(new Error('Formato de imagem não permitido. Use JPG, JPEG, PNG ou WebP.'));
    }
    cb(null, true);
  },
}).single('imagem');

function nomeAleatorio(ext) {
  return `banner_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
}

async function processarImagemBanner(buffer, mimetype) {
  const ext = MIME_IMAGEM[mimetype];
  const nome = nomeAleatorio(ext);
  const destino = path.join(BASE_DIR, nome);

  let imagem = sharp(buffer).rotate().resize({
    width: LARGURA_MAXIMA,
    height: LARGURA_MAXIMA,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (mimetype === 'image/jpeg')      imagem = imagem.jpeg({ quality: 85, mozjpeg: true });
  else if (mimetype === 'image/png')  imagem = imagem.png({ compressionLevel: 8 });
  else if (mimetype === 'image/webp') imagem = imagem.webp({ quality: 85 });

  await imagem.toFile(destino);
  return `/uploads/banners/${nome}`;
}

function removerImagemBanner(urlPublica) {
  if (!urlPublica || typeof urlPublica !== 'string') return;
  const relativo = urlPublica.replace(/^\/+/, '');
  if (!relativo.startsWith('uploads/banners/')) return;
  const caminho = path.join(__dirname, '../public', relativo);
  if (!caminho.startsWith(BASE_DIR)) return;
  fs.promises.unlink(caminho).catch(() => {});
}

function uploadImagemBanner(req, res, next) {
  uploadBanner(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 400 : 400;
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `Arquivo muito grande. Máximo: ${MAX_BANNER_MB} MB.`
        : err.message;
      return res.status(status).json({ ok: false, message });
    }

    if (!req.file) return next();

    if (!assinaturaBate(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ ok: false, message: 'O arquivo enviado não é uma imagem válida.' });
    }

    next();
  });
}

async function duplicarImagemBanner(urlOriginal) {
  if (!urlOriginal || typeof urlOriginal !== 'string') return urlOriginal;
  const relativo = urlOriginal.replace(/^\/+/, '');
  if (!relativo.startsWith('uploads/banners/')) return urlOriginal;

  const origem = path.join(__dirname, '../public', relativo);
  const ext = path.extname(origem).replace('.', '') || 'jpg';
  const nome = nomeAleatorio(ext);
  const destino = path.join(BASE_DIR, nome);

  await fs.promises.copyFile(origem, destino);
  return `/uploads/banners/${nome}`;
}

module.exports = {
  uploadImagemBanner,
  processarImagemBanner,
  removerImagemBanner,
  duplicarImagemBanner,
  MAX_BANNER_MB,
};
