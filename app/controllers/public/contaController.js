'use strict';

const Usuario = require('../../models/Usuario');
const NivelCliente = require('../../models/NivelCliente');
const Favorito = require('../../models/Favorito');
const Endereco = require('../../models/Endereco');
const SessaoSegura = require('../../models/SessaoSegura');
const authService = require('../../services/authService');
const fotoPerfilService = require('../../services/fotoPerfilService');
const privacidadeService = require('../../services/privacidadeService');
const enderecoValidationService = require('../../services/enderecoValidationService');
const { resolverImagemUrl } = require('../../helpers/imagemUrl');
const { respostaErro } = require('../../helpers/respostaErro');

/* GET /perfil */
exports.paginaPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.session.usuario.id);
    if (!usuario) { req.session.destroy(); return res.redirect('/login'); }

    let usuarios = [];
    if (usuario.papel === 'admin') {
      usuarios = await Usuario.findAll();
    }

    let nivel = null;
    try {
      nivel = await NivelCliente.progressoDoUsuario(usuario.id);
    } catch (errNivel) {
      console.error('[perfil] níveis indisponíveis:', errNivel.message);
    }

    res.render('pages/conta/perfil', { usuario, usuarios, nivel });
  } catch (err) {
    console.error('[perfil]', err.message);
    res.status(500).render('pages/Home');
  }
};

exports.obterPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.session.usuario.id);
    if (!usuario) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });
    res.json({ ok: true, data: usuario });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.quemSouEu = (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { id, nome, email, papel, foto_perfil } = req.session.usuario;
  res.json({ ok: true, data: { id, nome, email, papel, foto_perfil } });
};

/* Privacidade / LGPD */

exports.exportarDados = async (req, res) => {
  try {
    const dados = await privacidadeService.exportarDados(req.session.usuario.id);
    res.set('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="floria-meus-dados-${req.session.usuario.id}.json"`);
    res.json(dados);
  } catch (err) {
    respostaErro(res, err, 'Erro ao gerar a exportação dos seus dados.');
  }
};

exports.excluirConta = async (req, res) => {
  try {
    const resultado = await privacidadeService.solicitarExclusaoConta({
      usuarioId: req.session.usuario.id,
      senhaAtual: req.body.senha,
    });
    if (!resultado.ok) {
      return res.status(401).json({ ok: false, message: 'Senha incorreta.' });
    }
    await authService.encerrarSessao(req);
    res.clearCookie(req.app.get('nomeCookieSessao'));
    res.json({ ok: true, message: 'Sua conta foi encerrada e seus dados pessoais foram removidos.', redirect: '/' });
  } catch (err) {
    respostaErro(res, err, 'Erro ao excluir a conta.');
  }
};

/* Sessões ativas */

exports.listarSessoes = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const sessoes = await SessaoSegura.listarAtivasDoUsuario(req.session.usuario.id, req.sessionID);
    res.json({ ok: true, data: sessoes });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.revogarSessao = async (req, res) => {
  try {
    const revogado = await SessaoSegura.revogarPorId(req.params.id, req.session.usuario.id);
    if (!revogado) return res.status(404).json({ ok: false, message: 'Sessão não encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.revogarOutrasSessoes = async (req, res) => {
  try {
    await SessaoSegura.revogarTodasDoUsuario(req.session.usuario.id, { exceto_session_id: req.sessionID });
    res.json({ ok: true });
  } catch (err) {
    respostaErro(res, err);
  }
};

/* POST /api/perfil/foto */
exports.atualizarFoto = (req, res) => {
  const upload = req.app.locals.upload;
  upload.single('foto')(req, res, async (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    if (!req.file) return res.status(400).json({ ok: false, message: 'Nenhum arquivo enviado.' });

    try {
      const urlFoto = await fotoPerfilService.processarEAtualizar({
        usuarioId: req.session.usuario.id,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        uploadDir: req.app.locals.uploadDir,
      });

      req.session.usuario.foto_perfil = urlFoto;

      res.json({ ok: true, foto_perfil: urlFoto });
    } catch (e) {
      const status = e.codigo === 'FORMATO_INVALIDO' || e.codigo === 'IMAGEM_INVALIDA' ? 400 : 500;
      console.error('[foto de perfil]', e.message, e.causa || '');
      res.status(status).json({ ok: false, message: status === 400 ? e.message : 'Erro ao salvar a foto de perfil. Tente novamente.' });
    }
  });
};

/* POST /api/perfil/senha */
exports.alterarSenha = async (req, res) => {
  try {
    const resultado = await authService.alterarSenha({
      usuarioId: req.session.usuario.id,
      emailUsuario: req.session.usuario.email,
      senhaAtual: req.body.senha_atual,
      novaSenha: req.body.nova_senha,
      sessionIdAtual: req.sessionID,
      ip: req.ip,
    });

    if (!resultado.ok) {
      if (resultado.motivo === 'SENHA_ATUAL_INCORRETA') {
        return res.status(401).json({ ok: false, message: 'Senha atual incorreta.' });
      }
      return res.status(400).json({ ok: false, message: 'A nova senha não pode ser igual à atual.' });
    }

    res.json({ ok: true, message: 'Senha alterada com sucesso!' });
  } catch (err) {
    if (err.codigo === 'NAO_ENCONTRADO') return res.status(404).json({ ok: false, message: err.message });
    respostaErro(res, err);
  }
};

/* Favoritos */

exports.listarFavoritos = async (req, res) => {
  try {
    const favoritos = await Favorito.findByUsuario(req.session.usuario.id);
    res.json({ ok: true, favoritos });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.listarSlugsFavoritos = async (req, res) => {
  try {
    if (!req.session.usuario) return res.json({ ok: true, slugs: [] });
    const slugs = await Favorito.slugsByUsuario(req.session.usuario.id);
    res.json({ ok: true, slugs });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.adicionarFavorito = async (req, res) => {
  try {
    const { nome, imagem, preco } = req.body || {};
    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ ok: false, message: 'Nome do produto é obrigatório.' });
    }
    await Favorito.add(req.session.usuario.id, {
      produto_slug:   req.params.slug,
      produto_nome:   nome.trim().slice(0, 150),
      produto_imagem: resolverImagemUrl(imagem, null)?.slice(0, 255) ?? null,
      produto_preco:  preco != null && preco !== '' ? Number(preco) : null,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.removerFavorito = async (req, res) => {
  try {
    await Favorito.remove(req.session.usuario.id, req.params.slug);
    res.json({ ok: true });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.atalhoFavoritos = (req, res) => res.redirect('/perfil#favoritos');

/* Endereços */

exports.paginaNovoEndereco = (req, res) => res.render('pages/conta/endereco-novo');

function montarDadosEndereco(body) {
  const {
    rotulo, destinatario, telefone, cep, logradouro,
    numero, complemento, bairro, cidade, uf, referencia, padrao,
  } = body || {};
  return {
    rotulo: String(rotulo).slice(0, 60),
    destinatario: String(destinatario).slice(0, 120),
    telefone: String(telefone).slice(0, 20),
    cep: String(cep).slice(0, 9),
    logradouro: String(logradouro).slice(0, 180),
    numero: String(numero).slice(0, 20),
    complemento: complemento ? String(complemento).slice(0, 80) : null,
    bairro: String(bairro).slice(0, 100),
    cidade: String(cidade).slice(0, 100),
    uf: String(uf).slice(0, 2).toUpperCase(),
    referencia: referencia ? String(referencia).slice(0, 180) : null,
    padrao: !!padrao,
  };
}

exports.listarEnderecos = async (req, res) => {
  try {
    const enderecos = await Endereco.findByUsuario(req.session.usuario.id);
    res.json({ ok: true, enderecos });
  } catch (err) {
    respostaErro(res, err);
  }
};

async function confirmarExistenciaEndereco(dadosEndereco) {
  const resultado = await enderecoValidationService.validarExistenciaEndereco(dadosEndereco);
  if (resultado.status === enderecoValidationService.STATUS.INVALID) {
    return {
      bloqueado: true,
      resposta: {
        ok: false,
        message: resultado.mensagem,
        errors: resultado.campo ? [{ path: resultado.campo, msg: resultado.mensagem }] : [],
        validacao: { status: 'invalid', mensagem: resultado.mensagem },
      },
    };
  }
  return {
    bloqueado: false,
    validacao: {
      status: resultado.status.toLowerCase(),
      fonte: resultado.fonte,
      detalhes: resultado.detalhes,
    },
    mensagemValidacao: resultado.mensagem,
  };
}

exports.criarEndereco = async (req, res) => {
  try {
    const dados = montarDadosEndereco(req.body);
    const checagem = await confirmarExistenciaEndereco(dados);
    if (checagem.bloqueado) return res.status(422).json(checagem.resposta);

    const id = await Endereco.create(req.session.usuario.id, { ...dados, validacao: checagem.validacao });
    res.status(201).json({ ok: true, id, validacao: { status: checagem.validacao.status, mensagem: checagem.mensagemValidacao } });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Não foi possível salvar o endereço. Tente novamente.' });
  }
};

exports.atualizarEndereco = async (req, res) => {
  try {
    const dados = montarDadosEndereco(req.body);
    const checagem = await confirmarExistenciaEndereco(dados);
    if (checagem.bloqueado) return res.status(422).json(checagem.resposta);

    const atualizado = await Endereco.update(req.params.id, req.session.usuario.id, { ...dados, validacao: checagem.validacao });
    if (!atualizado) return res.status(404).json({ ok: false, message: 'Endereço não encontrado.' });
    res.json({ ok: true, validacao: { status: checagem.validacao.status, mensagem: checagem.mensagemValidacao } });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Não foi possível atualizar o endereço. Tente novamente.' });
  }
};

exports.verificarEndereco = async (req, res) => {
  try {
    const dados = montarDadosEndereco(req.body);
    const resultado = await enderecoValidationService.validarExistenciaEndereco(dados);
    res.json({
      ok: true,
      validacao: {
        status: resultado.status.toLowerCase(),
        mensagem: resultado.mensagem,
        campo: resultado.campo || null,
        detalhes: resultado.detalhes,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Não foi possível verificar o endereço agora. Tente novamente.' });
  }
};

exports.definirEnderecoPrincipal = async (req, res) => {
  try {
    const ok = await Endereco.definirPrincipal(req.params.id, req.session.usuario.id);
    if (!ok) return res.status(404).json({ ok: false, message: 'Endereço não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Não foi possível definir o endereço como principal.' });
  }
};

exports.removerEndereco = async (req, res) => {
  try {
    const removido = await Endereco.remove(req.params.id, req.session.usuario.id);
    if (!removido) return res.status(404).json({ ok: false, message: 'Endereço não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Não foi possível remover o endereço. Tente novamente.' });
  }
};
