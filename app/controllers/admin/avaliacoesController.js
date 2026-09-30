'use strict';

const Comentario = require('../../models/Comentario');
const ComentarioMidia = require('../../models/ComentarioMidia');
const { removerArquivoPublico } = require('../../middlewares/uploadAvaliacoes');
const { logAcao } = require('../../helpers/auditLog');

exports.pagina = async (req, res) => {
  try {
    const nota = String(req.query.nota || '').trim();
    const status = String(req.query.status || '').trim();
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = 20;
    const offset = (pagina - 1) * limite;

    const [avaliacoes, total] = await Promise.all([
      Comentario.findAllAdmin({ nota, status, limite, offset }),
      Comentario.contarAdmin(nota, status),
    ]);

    const mapaMidias = await ComentarioMidia.findByComentarioIds(avaliacoes.map((a) => a.id));
    avaliacoes.forEach((a) => { a.midias = mapaMidias[a.id] || []; });

    res.render('pages/admin/avaliacoes', {
      avaliacoes, nota, status, pagina, totalPaginas: Math.max(1, Math.ceil(total / limite)),
      total, secaoAtual: 'avaliacoes',
    });
  } catch (err) {
    console.error('Erro ao listar avaliações:', err.message);
    res.render('pages/admin/avaliacoes', {
      avaliacoes: [], nota: '', status: '', pagina: 1, totalPaginas: 1, total: 0, secaoAtual: 'avaliacoes',
    });
  }
};

exports.responder = async (req, res) => {
  try {
    await Comentario.responder(req.params.id, req.body.resposta);
    logAcao(req, 'avaliacao.responder', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao salvar resposta.' });
  }
};

exports.removerResposta = async (req, res) => {
  try {
    await Comentario.removerResposta(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao remover resposta.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const midias = await ComentarioMidia.findByComentario(req.params.id);
    midias.forEach((m) => {
      removerArquivoPublico(m.arquivo);
      if (m.thumbnail) removerArquivoPublico(m.thumbnail);
    });

    await Comentario.delete(req.params.id);
    logAcao(req, 'avaliacao.excluir', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao excluir avaliação.' });
  }
};

exports.atualizarStatus = async (req, res) => {
  try {
    const status = req.body.status;
    if (status !== 'aprovado' && status !== 'reprovado') {
      return res.status(422).json({ ok: false, message: "Status inválido — use 'aprovado' ou 'reprovado'." });
    }
    await Comentario.atualizarStatus(req.params.id, status);
    logAcao(req, 'avaliacao.status', `#${req.params.id} → ${status}`);
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao atualizar status da avaliação.' });
  }
};

exports.ocultarMidia = async (req, res) => {
  try {
    const oculto = !!req.body.oculto;
    await ComentarioMidia.setOculto(req.params.id, oculto);
    logAcao(req, 'avaliacao.midia.ocultar', `#${req.params.id} → ${oculto ? 'oculta' : 'visível'}`);
    res.json({ ok: true, oculto });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao atualizar a mídia.' });
  }
};

exports.excluirMidia = async (req, res) => {
  try {
    const midia = await ComentarioMidia.findByIdComDono(req.params.id);
    if (!midia) return res.status(404).json({ ok: false, message: 'Mídia não encontrada.' });

    removerArquivoPublico(midia.arquivo);
    if (midia.thumbnail) removerArquivoPublico(midia.thumbnail);
    await ComentarioMidia.removerPorId(midia.id);

    logAcao(req, 'avaliacao.midia.excluir', `#${midia.id} (avaliação #${midia.comentario_id})`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao excluir a mídia.' });
  }
};
