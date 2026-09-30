'use strict';

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Usuario = require('../models/Usuario');

const FORMATOS_FOTO_PERFIL = {
  'image/jpeg': { ext: 'jpg',  aplicar: (img) => img.jpeg({ quality: 82, mozjpeg: true }) },
  'image/png':  { ext: 'png',  aplicar: (img) => img.png({ compressionLevel: 9 }) },
  'image/webp': { ext: 'webp', aplicar: (img) => img.webp({ quality: 82 }) },
};

function formatoSuportado(mimetype) {
  return Boolean(FORMATOS_FOTO_PERFIL[mimetype]);
}

async function processarEAtualizar({ usuarioId, buffer, mimetype, uploadDir }) {
  const formato = FORMATOS_FOTO_PERFIL[mimetype];
  if (!formato) {
    const erro = new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.');
    erro.codigo = 'FORMATO_INVALIDO';
    throw erro;
  }

  const nomeArquivo = `user_${usuarioId}_${Date.now()}.${formato.ext}`;
  const caminhoDestino = path.join(uploadDir, nomeArquivo);

  try {
    let imagem = sharp(buffer).rotate().resize(512, 512, { fit: 'cover' });
    imagem = formato.aplicar(imagem);
    await imagem.toFile(caminhoDestino);
  } catch (erroImagem) {
    const erro = new Error('Não foi possível processar a imagem enviada. Verifique se o arquivo não está corrompido.');
    erro.codigo = 'IMAGEM_INVALIDA';
    erro.causa = erroImagem.message;
    throw erro;
  }

  const urlFoto = `/uploads/perfil/${nomeArquivo}`;
  const usuarioAtual = await Usuario.findById(usuarioId);

  try {
    await Usuario.updateFoto(usuarioId, urlFoto);
  } catch (erroBanco) {
    if (fs.existsSync(caminhoDestino)) fs.unlinkSync(caminhoDestino);
    throw erroBanco;
  }

  if (usuarioAtual?.foto_perfil && !usuarioAtual.foto_perfil.includes('default')) {
    const caminhoAntigo = path.join(__dirname, '../public', usuarioAtual.foto_perfil);
    if (fs.existsSync(caminhoAntigo)) fs.unlinkSync(caminhoAntigo);
  }

  return urlFoto;
}

module.exports = { formatoSuportado, processarEAtualizar };
