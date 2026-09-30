'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp  = require('sharp');

const BASE_DIR   = path.join(__dirname, '../public/uploads/avaliacoes');
const DIR_IMAGEM = path.join(BASE_DIR, 'imagens');
const DIR_VIDEO  = path.join(BASE_DIR, 'videos');
const DIR_THUMB  = path.join(BASE_DIR, 'thumbs');

for (const dir of [DIR_IMAGEM, DIR_VIDEO, DIR_THUMB]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Limites
const MAX_IMAGENS      = 10;
const MAX_VIDEOS       = 3;
const MAX_IMAGEM_MB    = parseInt(process.env.UPLOAD_AVALIACAO_IMG_MB   || '8',  10);
const MAX_VIDEO_MB     = parseInt(process.env.UPLOAD_AVALIACAO_VIDEO_MB || '40', 10);
const MAX_IMAGEM_BYTES = MAX_IMAGEM_MB * 1024 * 1024;
const MAX_VIDEO_BYTES  = MAX_VIDEO_MB  * 1024 * 1024;

const LIMITE_GLOBAL_BYTES = MAX_VIDEO_BYTES;

const MIME_IMAGEM = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};
const MIME_VIDEO = {
  'video/mp4':       'mp4',
  'video/webm':      'webm',
  'video/quicktime': 'mov',
};

function fileFilter(_req, file, cb) {
  if (file.fieldname === 'imagens') {
    if (!MIME_IMAGEM[file.mimetype]) {
      return cb(new Error('Formato de imagem não permitido. Use JPG, PNG ou WebP.'));
    }
    return cb(null, true);
  }
  if (file.fieldname === 'videos') {
    if (!MIME_VIDEO[file.mimetype]) {
      return cb(new Error('Formato de vídeo não permitido. Use MP4, WebM ou MOV.'));
    }
    return cb(null, true);
  }
  if (file.fieldname === 'video_thumbs') {
    if (file.mimetype !== 'image/jpeg') {
      return cb(new Error('Miniatura de vídeo inválida.'));
    }
    return cb(null, true);
  }
  cb(new Error('Campo de upload desconhecido.'));
}

const uploadAvaliacao = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_GLOBAL_BYTES, files: MAX_IMAGENS + MAX_VIDEOS * 2 },
  fileFilter,
}).fields([
  { name: 'imagens',      maxCount: MAX_IMAGENS },
  { name: 'videos',       maxCount: MAX_VIDEOS },
  { name: 'video_thumbs', maxCount: MAX_VIDEOS },
]);

function assinaturaBate(buffer, mimetype) {
  if (!buffer || buffer.length < 12) return false;

  switch (mimetype) {
    case 'image/jpeg':
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    case 'image/png':
      return buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

    case 'image/webp':
      return buffer.slice(0, 4).toString('ascii') === 'RIFF'
          && buffer.slice(8, 12).toString('ascii') === 'WEBP';

    case 'video/mp4':
    case 'video/quicktime': {
      const marcador = buffer.slice(4, 8).toString('ascii');
      return marcador === 'ftyp' || ['moov', 'mdat', 'wide', 'free', 'skip'].includes(marcador);
    }

    case 'video/webm':
      return buffer.slice(0, 4).equals(Buffer.from([0x1A, 0x45, 0xDF, 0xA3]));

    default:
      return false;
  }
}

function nomeAleatorio(ext) {
  return `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
}

async function processarImagem(buffer) {
  const nomeBase = nomeAleatorio('jpg');
  const nomeThumb = `thumb_${nomeBase}`;

  await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(DIR_IMAGEM, nomeBase));

  await sharp(buffer)
    .rotate()
    .resize({ width: 400, height: 400, fit: 'cover' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join(DIR_THUMB, nomeThumb));

  return {
    arquivo:   `/uploads/avaliacoes/imagens/${nomeBase}`,
    thumbnail: `/uploads/avaliacoes/thumbs/${nomeThumb}`,
  };
}

async function processarThumbVideo(buffer) {
  const nomeThumb = `thumb_${nomeAleatorio('jpg')}`;
  await sharp(buffer)
    .rotate()
    .resize({ width: 400, height: 400, fit: 'cover' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join(DIR_THUMB, nomeThumb));
  return `/uploads/avaliacoes/thumbs/${nomeThumb}`;
}

function salvarVideo(buffer, mimetype) {
  const ext = MIME_VIDEO[mimetype];
  const nome = nomeAleatorio(ext);
  fs.writeFileSync(path.join(DIR_VIDEO, nome), buffer);
  return `/uploads/avaliacoes/videos/${nome}`;
}

function removerArquivoPublico(urlPublica) {
  if (!urlPublica || typeof urlPublica !== 'string') return;
  const relativo = urlPublica.replace(/^\/+/, '');
  if (!relativo.startsWith('uploads/avaliacoes/')) return;
  const caminho = path.join(__dirname, '../public', relativo);
  if (!caminho.startsWith(BASE_DIR)) return;
  fs.promises.unlink(caminho).catch(() => {});
}

module.exports = {
  uploadAvaliacao,
  assinaturaBate,
  processarImagem,
  processarThumbVideo,
  salvarVideo,
  removerArquivoPublico,
  MIME_IMAGEM,
  MIME_VIDEO,
  MAX_IMAGENS,
  MAX_VIDEOS,
  MAX_IMAGEM_MB,
  MAX_VIDEO_MB,
  MAX_IMAGEM_BYTES,
  MAX_VIDEO_BYTES,
};
