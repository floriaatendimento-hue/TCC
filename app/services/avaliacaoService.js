'use strict';

const Comentario = require('../models/Comentario');
const ComentarioMidia = require('../models/ComentarioMidia');
const {
  assinaturaBate,
  processarImagem,
  processarThumbVideo,
  salvarVideo,
  removerArquivoPublico,
  MAX_IMAGENS,
  MAX_VIDEOS,
  MAX_IMAGEM_MB,
  MAX_VIDEO_MB,
  MAX_IMAGEM_BYTES,
  MAX_VIDEO_BYTES,
} = require('../middlewares/uploadAvaliacoes');

function erroValidacao(mensagem) {
  const erro = new Error(mensagem);
  erro.code = 'MIDIA_INVALIDA';
  return erro;
}

async function salvarAvaliacao({ slug, usuario, avaliacao, comentario, arquivosImagem, arquivosVideo, arquivosThumb, removerMidiasJson }) {
  if (arquivosVideo.length !== arquivosThumb.length) {
    throw erroValidacao('Cada vídeo enviado precisa vir com sua miniatura.');
  }

  const existente = await Comentario.findByUsuarioProduto(slug, usuario.id);

  let removerIds = [];
  if (existente && removerMidiasJson) {
    try {
      const bruto = JSON.parse(removerMidiasJson);
      if (Array.isArray(bruto)) removerIds = bruto.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    } catch (_) {   }
  }

  const midiaAtual = existente ? await ComentarioMidia.findByComentario(existente.id) : [];
  const midiaParaRemover = midiaAtual.filter((m) => removerIds.includes(m.id));
  const contagemMantida = { imagem: 0, video: 0 };
  midiaAtual.forEach((m) => { if (!removerIds.includes(m.id)) contagemMantida[m.tipo]++; });

  if (contagemMantida.imagem + arquivosImagem.length > MAX_IMAGENS) {
    throw erroValidacao(`Máximo de ${MAX_IMAGENS} fotos por avaliação.`);
  }
  if (contagemMantida.video + arquivosVideo.length > MAX_VIDEOS) {
    throw erroValidacao(`Máximo de ${MAX_VIDEOS} vídeos por avaliação.`);
  }

  for (const file of arquivosImagem) {
    if (file.size > MAX_IMAGEM_BYTES) throw erroValidacao(`Cada foto deve ter no máximo ${MAX_IMAGEM_MB} MB.`);
    if (!assinaturaBate(file.buffer, file.mimetype)) throw erroValidacao('Um dos arquivos de imagem enviados é inválido ou está corrompido.');
  }
  for (const file of arquivosVideo) {
    if (file.size > MAX_VIDEO_BYTES) throw erroValidacao(`Cada vídeo deve ter no máximo ${MAX_VIDEO_MB} MB.`);
    if (!assinaturaBate(file.buffer, file.mimetype)) throw erroValidacao('Um dos vídeos enviados é inválido ou está corrompido.');
  }
  for (const file of arquivosThumb) {
    if (!assinaturaBate(file.buffer, file.mimetype)) throw erroValidacao('Miniatura de vídeo inválida.');
  }

  const novasMidias = [];
  for (const file of arquivosImagem) {
    const { arquivo, thumbnail } = await processarImagem(file.buffer);
    novasMidias.push({ tipo: 'imagem', arquivo, thumbnail });
  }
  for (let i = 0; i < arquivosVideo.length; i++) {
    const arquivo = salvarVideo(arquivosVideo[i].buffer, arquivosVideo[i].mimetype);
    const thumbnail = await processarThumbVideo(arquivosThumb[i].buffer);
    novasMidias.push({ tipo: 'video', arquivo, thumbnail });
  }

  let id, atualizado;
  try {
    if (existente) {
      await Comentario.update(existente.id, { avaliacao, comentario });
      id = existente.id;
      atualizado = true;
    } else {
      id = await Comentario.create({ produto_slug: slug, usuario_id: usuario.id, usuario_nome: usuario.nome, avaliacao, comentario });
      atualizado = false;
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const jaExistente = await Comentario.findByUsuarioProduto(slug, usuario.id);
      if (!jaExistente) throw err;
      await Comentario.update(jaExistente.id, { avaliacao, comentario });
      id = jaExistente.id;
      atualizado = true;
    } else {
      throw err;
    }
  }

  if (midiaParaRemover.length) {
    midiaParaRemover.forEach((m) => {
      removerArquivoPublico(m.arquivo);
      if (m.thumbnail) removerArquivoPublico(m.thumbnail);
    });
    await ComentarioMidia.removerPorIdsDoComentario(midiaParaRemover.map((m) => m.id), id);
  }

  let ordem = contagemMantida.imagem + contagemMantida.video;
  for (const midia of novasMidias) {
    await ComentarioMidia.create({ comentario_id: id, ...midia, ordem: ordem++ });
  }

  const midias = await ComentarioMidia.findByComentario(id);
  return { id, atualizado, midias };
}

async function excluirAvaliacao(comentarioId, usuarioSessao) {
  const comentario = await Comentario.findById(comentarioId);
  if (!comentario) return { ok: false, motivo: 'NAO_ENCONTRADA' };

  const ehDono = Number(comentario.usuario_id) === Number(usuarioSessao.id);
  const ehAdmin = usuarioSessao.papel === 'admin';
  if (!ehDono && !ehAdmin) return { ok: false, motivo: 'SEM_PERMISSAO' };

  const midias = await ComentarioMidia.findByComentario(comentario.id);
  midias.forEach((m) => {
    removerArquivoPublico(m.arquivo);
    if (m.thumbnail) removerArquivoPublico(m.thumbnail);
  });

  await Comentario.delete(comentario.id);
  return { ok: true, viaAdmin: ehAdmin && !ehDono };
}

module.exports = { salvarAvaliacao, excluirAvaliacao };
