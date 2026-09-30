'use strict';

const Comentario = require('../../models/Comentario');
const ComentarioMidia = require('../../models/ComentarioMidia');
const Produto = require('../../models/Produto');
const configCache = require('../../services/cache/configCache');
const avaliacaoService = require('../../services/avaliacaoService');
const { respostaErro } = require('../../helpers/respostaErro');
const { uploadAvaliacao, MAX_IMAGENS, MAX_VIDEOS, MAX_IMAGEM_MB, MAX_VIDEO_MB } = require('../../middlewares/uploadAvaliacoes');
const { logAcao } = require('../../helpers/auditLog');
const { resolverPaginaProduto } = require('./produtosController');

exports.listarPorProduto = async (req, res) => {
  try {
    const slug = req.params.slug;
    const [comentarios, { media, total }] = await Promise.all([
      Comentario.findByProduto(slug),
      Comentario.mediaAvaliacao(slug),
    ]);

    const idsParaBuscarMidia = comentarios.map((c) => c.id);

    let minhaAvaliacao = null;
    const usuarioLogado = req.session && req.session.usuario;
    if (usuarioLogado) {
      minhaAvaliacao = await Comentario.findByUsuarioProduto(slug, usuarioLogado.id);
      if (minhaAvaliacao && !idsParaBuscarMidia.includes(minhaAvaliacao.id)) {
        idsParaBuscarMidia.push(minhaAvaliacao.id);
      }
    }

    const mapaMidias = await ComentarioMidia.findByComentarioIds(idsParaBuscarMidia);
    const visiveis = (lista) => (lista || []).filter((m) => !m.oculto);

    const comentariosComMidia = comentarios.map((c) => ({ ...c, midias: visiveis(mapaMidias[c.id]) }));
    if (minhaAvaliacao) minhaAvaliacao = { ...minhaAvaliacao, midias: mapaMidias[minhaAvaliacao.id] || [] };

    res.json({ ok: true, comentarios: comentariosComMidia, media, total, minhaAvaliacao, lojaNome: configCache.obterLojaNome() });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.uploadMidiaAvaliacao = (req, res, next) => {
  uploadAvaliacao(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ ok: false, message: `Arquivo muito grande. Máximo: ${MAX_IMAGEM_MB} MB por foto e ${MAX_VIDEO_MB} MB por vídeo.` });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ ok: false, message: `Limite de mídia excedido: até ${MAX_IMAGENS} fotos e ${MAX_VIDEOS} vídeos por avaliação.` });
    }
    return res.status(400).json({ ok: false, message: err.message || 'Não foi possível enviar os arquivos.' });
  });
};

exports.salvar = async (req, res) => {
  try {
    const slug = req.params.slug;
    const produtoValido = (await Produto.findBySlugOuPagina(slug)) || resolverPaginaProduto(slug);
    if (!produtoValido) {
      return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
    }

    const resultado = await avaliacaoService.salvarAvaliacao({
      slug: req.params.slug,
      usuario: req.session.usuario,
      avaliacao: req.body.avaliacao,
      comentario: req.body.comentario,
      arquivosImagem: (req.files && req.files.imagens) || [],
      arquivosVideo: (req.files && req.files.videos) || [],
      arquivosThumb: (req.files && req.files.video_thumbs) || [],
      removerMidiasJson: req.body.remover_midias,
    });

    res.status(resultado.atualizado ? 200 : 201).json({ ok: true, ...resultado });
  } catch (err) {
    if (err.code === 'MIDIA_INVALIDA') return res.status(400).json({ ok: false, message: err.message });
    console.error('[avaliação] erro ao salvar:', err.message);
    res.status(500).json({ ok: false, message: 'Não foi possível salvar sua avaliação. Tente novamente.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const resultado = await avaliacaoService.excluirAvaliacao(req.params.id, req.session.usuario);

    if (!resultado.ok) {
      if (resultado.motivo === 'NAO_ENCONTRADA') return res.status(404).json({ ok: false, message: 'Avaliação não encontrada.' });
      return res.status(403).json({ ok: false, message: 'Você não pode excluir a avaliação de outra pessoa.' });
    }

    if (resultado.viaAdmin) logAcao(req, 'avaliacao.excluir', `#${req.params.id} (pela página do produto)`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Não foi possível excluir a avaliação.' });
  }
};
