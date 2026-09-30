'use strict';

const Usuario = require('../../models/Usuario');
const SessaoSegura = require('../../models/SessaoSegura');
const { logAcao } = require('../../helpers/auditLog');
const { respostaErro } = require('../../helpers/respostaErro');

const EMAIL_ADMIN_PRINCIPAL = 'admin@gmail.com';

exports.pagina = async (req, res) => {
  try {
    const admins = await Usuario.findAdmins();
    res.render('pages/admin/usuarios', { admins, emailAdminPrincipal: EMAIL_ADMIN_PRINCIPAL, secaoAtual: 'usuarios' });
  } catch (err) {
    console.error('Erro ao listar administradores:', err.message);
    res.render('pages/admin/usuarios', { admins: [], emailAdminPrincipal: EMAIL_ADMIN_PRINCIPAL, secaoAtual: 'usuarios' });
  }
};

exports.buscarClientes = async (req, res) => {
  try {
    const busca = String(req.query.q || '').trim();
    if (busca.length < 2) return res.json({ ok: true, data: [] });
    res.json({ ok: true, data: await Usuario.buscarClientesParaPromover(busca) });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao buscar clientes.' });
  }
};

exports.promover = async (req, res) => {
  try {
    const alvo = await Usuario.findById(req.params.id);
    if (!alvo) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });
    await Usuario.updatePapel(req.params.id, 'admin');
    await SessaoSegura.revogarTodasDoUsuario(req.params.id)
      .catch((e) => console.error('[usuarios] falha ao revogar sessões após promover:', e.message));
    const usuario = await Usuario.findById(req.params.id);
    logAcao(req, 'usuario.promover', `#${req.params.id} — ${usuario ? usuario.nome : ''} agora é admin`);
    res.json({ ok: true, data: usuario });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao promover usuário.' });
  }
};

exports.rebaixar = async (req, res) => {
  try {
    const alvo = await Usuario.findById(req.params.id);
    if (!alvo) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });
    if (alvo.email === EMAIL_ADMIN_PRINCIPAL) {
      return res.status(403).json({ ok: false, message: 'Esta é a conta de administrador principal e não pode ser rebaixada.' });
    }
    if (req.session.usuario.id === alvo.id) {
      return res.status(403).json({ ok: false, message: 'Você não pode remover seu próprio acesso de administrador.' });
    }
    await Usuario.updatePapel(req.params.id, 'cliente');
    await SessaoSegura.revogarTodasDoUsuario(req.params.id)
      .catch((e) => console.error('[usuarios] falha ao revogar sessões após rebaixar:', e.message));
    logAcao(req, 'usuario.rebaixar', `#${req.params.id} — ${alvo.nome} volta a ser cliente`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao rebaixar usuário.' });
  }
};

exports.listar = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll();
    res.json({ ok: true, data: usuarios });
  } catch (err) {
    respostaErro(res, err);
  }
};
