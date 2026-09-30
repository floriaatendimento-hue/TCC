'use strict';

const Banner = require('../../models/Banner');
const { processarImagemBanner, removerImagemBanner, duplicarImagemBanner } = require('../../middlewares/uploadBanners');
const { logAcao, diffCampos } = require('../../helpers/auditLog');

exports.pagina = async (req, res) => {
  try {
    const banners = await Banner.findAll();
    res.render('pages/admin/banners', { banners, secaoAtual: 'banners' });
  } catch (err) {
    console.error('Erro ao listar banners:', err.message);
    res.render('pages/admin/banners', { banners: [], secaoAtual: 'banners' });
  }
};

exports.telaNovo = (req, res) => {
  res.render('pages/admin/banner-form', { banner: null, secaoAtual: 'banners' });
};

exports.telaEditar = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.redirect('/admin/banners');
    res.render('pages/admin/banner-form', { banner, secaoAtual: 'banners' });
  } catch (err) {
    console.error('Erro ao carregar página de edição de banner:', err.message);
    res.redirect('/admin/banners');
  }
};

exports.criar = async (req, res) => {
  let imagemUrl = null;
  try {
    imagemUrl = await processarImagemBanner(req.file.buffer, req.file.mimetype);
    const id = await Banner.create({
      titulo:      req.body.titulo,
      subtitulo:   req.body.subtitulo,
      imagem:      imagemUrl,
      texto_botao: req.body.texto_botao,
      link:        req.body.link,
      ordem:       req.body.ordem,
      ativo:       req.body.ativo === '1' || req.body.ativo === 'true',
      data_inicio: req.body.data_inicio,
      data_fim:    req.body.data_fim,
    });
    logAcao(req, 'banner.criar', `#${id} — ${req.body.titulo}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    if (imagemUrl) removerImagemBanner(imagemUrl);
    console.error('Erro ao criar banner:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao criar banner.' });
  }
};

exports.atualizar = async (req, res) => {
  let imagemUrl = null;
  try {
    const bannerAtual = await Banner.findById(req.params.id);
    if (!bannerAtual) {
      return res.status(404).json({ ok: false, message: 'Banner não encontrado.' });
    }

    const dados = {
      titulo:      req.body.titulo,
      subtitulo:   req.body.subtitulo,
      texto_botao: req.body.texto_botao,
      link:        req.body.link,
      ativo:       req.body.ativo === '1' || req.body.ativo === 'true',
      data_inicio: req.body.data_inicio,
      data_fim:    req.body.data_fim,
    };
    if (req.body.ordem !== '' && req.body.ordem !== undefined) dados.ordem = req.body.ordem;
    if (req.file) {
      imagemUrl = await processarImagemBanner(req.file.buffer, req.file.mimetype);
      dados.imagem = imagemUrl;
    }

    await Banner.update(req.params.id, dados);

    if (imagemUrl && bannerAtual.imagem) removerImagemBanner(bannerAtual.imagem);

    const diffBanner = diffCampos(bannerAtual, dados, ['titulo', 'subtitulo', 'texto_botao', 'link', 'ativo', 'data_inicio', 'data_fim']);
    logAcao(req, 'banner.editar', `#${req.params.id} — ${req.body.titulo}`, diffBanner.mudou ? { dadosAntes: diffBanner.antes, dadosDepois: diffBanner.depois } : {});
    res.json({ ok: true });
  } catch (err) {
    if (imagemUrl) removerImagemBanner(imagemUrl);
    console.error('Erro ao atualizar banner:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao atualizar banner.' });
  }
};

exports.alternarAtivo = async (req, res) => {
  try {
    const banner = await Banner.alternarAtivo(req.params.id);
    if (!banner) return res.status(404).json({ ok: false, message: 'Banner não encontrado.' });
    logAcao(req, 'banner.status', `#${req.params.id} → ${banner.ativo ? 'ativo' : 'inativo'}`, {
      dadosAntes: { ativo: !banner.ativo },
      dadosDepois: { ativo: !!banner.ativo },
    });
    res.json({ ok: true, data: banner });
  } catch (err) {
    console.error('[admin] falha ao alternar status:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao alternar status do banner.' });
  }
};

exports.mover = async (req, res) => {
  try {
    const direcao = req.body.direcao === 'cima' ? 'cima' : 'baixo';
    res.json({ ok: await Banner.mover(req.params.id, direcao) });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao reordenar banner.' });
  }
};

exports.reordenar = async (req, res) => {
  try {
    await Banner.reordenar(req.body.ids);
    logAcao(req, 'banner.reordenar', `${req.body.ids.length} banner(s)`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao reordenar banners:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao reordenar banners.' });
  }
};

exports.duplicar = async (req, res) => {
  try {
    const original = await Banner.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ ok: false, message: 'Banner não encontrado.' });
    }
    const imagemDuplicada = await duplicarImagemBanner(original.imagem);
    const id = await Banner.create({
      titulo:      `${original.titulo} (cópia)`,
      subtitulo:   original.subtitulo,
      imagem:      imagemDuplicada,
      texto_botao: original.texto_botao,
      link:        original.link,
      data_inicio: original.data_inicio,
      data_fim:    original.data_fim,
      ativo:       false,
    });
    logAcao(req, 'banner.duplicar', `#${req.params.id} → #${id}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error('Erro ao duplicar banner:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao duplicar banner.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    await Banner.delete(req.params.id);
    if (banner) removerImagemBanner(banner.imagem);
    logAcao(req, 'banner.excluir', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao excluir banner.' });
  }
};
