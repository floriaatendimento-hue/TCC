'use strict';

const Usuario = require('../../models/Usuario');
const authService = require('../../services/authService');
const { respostaErro } = require('../../helpers/respostaErro');

exports.telaLogin = (req, res) => res.render('pages/conta/login2', { modoInicial: 'signin' });
exports.telaCadastro = (req, res) => res.render('pages/conta/login2', { modoInicial: 'signup' });
exports.redirecionarLogin2 = (req, res) => res.redirect(301, '/login');

/* POST /api/login */
exports.login = async (req, res) => {
  try {
    const resultado = await authService.autenticar(req.body.email, req.body.senha);

    if (!resultado.ok) {
      if (resultado.motivo === 'CONTA_BLOQUEADA') {
        return res.status(403).json({ ok: false, code: 'CONTA_BLOQUEADA', message: 'Esta conta está bloqueada. Entre em contato com o suporte.' });
      }
      return res.status(401).json({ ok: false, message: 'E-mail ou senha incorretos.' });
    }

    const { usuario } = resultado;
    await authService.iniciarSessaoAutenticada(req, usuario);
    await Usuario.updateUltimoAcesso(usuario.id);

    res.json({ ok: true, message: 'Login realizado com sucesso!', redirect: '/perfil' });
  } catch (err) {
    respostaErro(res, err, 'Erro ao criar sessão.');
  }
};

exports.cadastro = async (req, res) => {
  try {
    const novoUsuario = await authService.registrar(req.body);
    await authService.iniciarSessaoAutenticada(req, novoUsuario);

    res.status(201).json({ ok: true, message: 'Cadastro realizado com sucesso!', redirect: '/perfil' });
  } catch (err) {
    if (err.codigo === 'DUPLICADO') {
      return res.status(409).json({ ok: false, campo: err.campo, message: err.message });
    }
    if (err.code === 'ER_DUP_ENTRY') {
      const campo = /uk_usuarios_cpf|\bcpf\b/i.test(err.message) ? 'cpf' : 'email';
      return res.status(409).json({
        ok: false,
        campo,
        message: campo === 'cpf' ? 'CPF já cadastrado.' : 'E-mail já cadastrado.',
      });
    }
    respostaErro(res, err);
  }
};

const { OTP_DIGITOS, OTP_EXPIRA_MINUTOS, OTP_MAX_TENTATIVAS, COOLDOWN_REENVIO_SEGUNDOS } = authService.otpConfig;
const MAX_REENVIOS = 4;
const MSG_ENVIADO = 'Se este e-mail estiver cadastrado, enviamos um código de verificação para ele.';

function segundosParaProximoEnvio(estado) {
  const passado = Math.floor((Date.now() - estado.solicitadoEm) / 1000);
  return Math.max(0, COOLDOWN_REENVIO_SEGUNDOS - passado);
}

function mascararEmail(email) {
  const [usuario = '', dominio = ''] = String(email).split('@');
  return `${usuario.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(usuario.length - 1, 6)))}@${dominio}`;
}

function dispararEnvioOtp(req, email) {
  authService.solicitarRecuperacaoSenha({
    email,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch((e) => console.error('[authController] falha inesperada na recuperação de senha:', e.message));
}

exports.solicitarRecuperacaoSenha = (req, res) => {
  const email = req.body.email;
  const atual = req.session.recuperacao;

  if (atual && atual.email === email) {
    const restante = segundosParaProximoEnvio(atual);
    if (restante > 0) {
      return res.json({ ok: true, message: MSG_ENVIADO, redirect: '/verificar-codigo', segundosRestantes: restante });
    }
  }

  dispararEnvioOtp(req, email);
  req.session.recuperacao = { email, solicitadoEm: Date.now(), reenvios: 0, tentativas: 0 };

  res.json({ ok: true, message: MSG_ENVIADO, redirect: '/verificar-codigo', segundosRestantes: COOLDOWN_REENVIO_SEGUNDOS });
};

exports.reenviarCodigo = (req, res) => {
  const estado = req.session.recuperacao;
  if (!estado) {
    return res.status(400).json({ ok: false, code: 'SEM_SOLICITACAO', message: 'Sua solicitação expirou. Informe o e-mail novamente.', redirect: '/login' });
  }

  const restante = segundosParaProximoEnvio(estado);
  if (restante > 0) {
    return res.status(429).json({ ok: false, code: 'COOLDOWN', message: `Aguarde ${restante}s para solicitar um novo código.`, segundosRestantes: restante });
  }
  if (estado.reenvios >= MAX_REENVIOS) {
    return res.status(429).json({ ok: false, code: 'LIMITE_REENVIOS', message: 'Limite de reenvios atingido. Tente novamente mais tarde.' });
  }

  dispararEnvioOtp(req, estado.email);
  req.session.recuperacao = {
    email: estado.email,
    solicitadoEm: Date.now(),
    reenvios: estado.reenvios + 1,
    tentativas: 0, // código novo → contagem nova
  };

  res.json({ ok: true, message: 'Enviamos um novo código para o seu e-mail.', segundosRestantes: COOLDOWN_REENVIO_SEGUNDOS });
};

exports.telaVerificarCodigo = async (req, res) => {
  const estado = req.session.recuperacao;
  if (!estado) return res.redirect('/login');

  try {
    if (estado.autorizacao && await authService.autorizacaoRedefinicaoValida(estado.autorizacao)) {
      return res.redirect('/redefinir-senha');
    }

    res.render('pages/conta/verificar-codigo', {
      emailMascarado: mascararEmail(estado.email),
      digitos: OTP_DIGITOS,
      expiraMinutos: OTP_EXPIRA_MINUTOS,
      segundosRestantes: segundosParaProximoEnvio(estado),
    });
  } catch (err) {
    console.error('[authController] falha ao abrir a tela de OTP:', err.message);
    res.status(500).render('pages/erro', { status: 500, titulo: 'Algo deu errado', mensagem: 'Não foi possível carregar esta página agora. Tente novamente.' });
  }
};

exports.verificarOtp = async (req, res) => {
  const estado = req.session.recuperacao;
  if (!estado) {
    return res.status(400).json({ ok: false, code: 'SEM_SOLICITACAO', message: 'Sua solicitação expirou. Informe o e-mail novamente.', redirect: '/login' });
  }

  const msgExpirado = 'Este código expirou. Solicite um novo código.';
  const msgBloqueado = 'Muitas tentativas incorretas. Solicite um novo código.';

  if (Date.now() - estado.solicitadoEm > OTP_EXPIRA_MINUTOS * 60 * 1000) {
    return res.status(400).json({ ok: false, code: 'EXPIRADO', message: msgExpirado });
  }
  if (estado.tentativas >= OTP_MAX_TENTATIVAS) {
    return res.status(429).json({ ok: false, code: 'BLOQUEADO', message: msgBloqueado });
  }

  try {
    const resultado = await authService.verificarOtpRecuperacao({ email: estado.email, otp: req.body.otp, ip: req.ip });

    if (resultado.ok) {
      req.session.recuperacao = { ...estado, tentativas: 0, autorizacao: resultado.autorizacao };
      return res.json({ ok: true, message: 'Código verificado!', redirect: '/redefinir-senha' });
    }

    if (resultado.motivo === 'EXPIRADO') {
      return res.status(400).json({ ok: false, code: 'EXPIRADO', message: msgExpirado });
    }
    if (resultado.motivo === 'BLOQUEADO') {
      return res.status(429).json({ ok: false, code: 'BLOQUEADO', message: msgBloqueado });
    }

    estado.tentativas += 1;
    const restantes = Math.max(0, OTP_MAX_TENTATIVAS - estado.tentativas);
    return res.status(400).json({
      ok: false,
      code: 'INVALIDO',
      message: restantes > 0 ? 'Código inválido.' : msgBloqueado,
      tentativasRestantes: restantes,
    });
  } catch (err) {
    respostaErro(res, err, 'Erro ao verificar o código.');
  }
};

exports.telaRedefinirSenha = async (req, res) => {
  const estado = req.session.recuperacao;
  try {
    if (!estado?.autorizacao || !(await authService.autorizacaoRedefinicaoValida(estado.autorizacao))) {
      return res.redirect(estado ? '/verificar-codigo' : '/login');
    }
    res.render('pages/conta/redefinir-senha');
  } catch (err) {
    console.error('[authController] falha ao validar autorização de redefinição:', err.message);
    res.status(500).render('pages/erro', { status: 500, titulo: 'Algo deu errado', mensagem: 'Não foi possível carregar esta página agora. Tente novamente.' });
  }
};

exports.redefinirSenha = async (req, res) => {
  const estado = req.session.recuperacao;
  const semAutorizacao = () => res.status(403).json({
    ok: false,
    code: 'SEM_AUTORIZACAO',
    message: 'Sua verificação expirou ou não foi concluída. Solicite um novo código.',
    redirect: estado ? '/verificar-codigo' : '/login',
  });
  if (!estado?.autorizacao) return semAutorizacao();

  try {
    const resultado = await authService.redefinirSenhaComAutorizacao({
      autorizacao: estado.autorizacao,
      novaSenha: req.body.novaSenha,
      ip: req.ip,
    });
    if (!resultado.ok) return semAutorizacao();

    delete req.session.recuperacao;
    res.json({ ok: true, message: 'Senha redefinida com sucesso! Faça login com a nova senha.', redirect: '/login' });
  } catch (err) {
    respostaErro(res, err, 'Erro ao redefinir a senha.');
  }
};

/* POST /api/logout */
exports.logout = async (req, res) => {
  await authService.encerrarSessao(req);
  res.clearCookie(req.app.get('nomeCookieSessao'));
  res.json({ ok: true, redirect: '/' });
};

exports.logoutGet = async (req, res) => {
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).render('pages/403');
  }
  await authService.encerrarSessao(req);
  res.clearCookie(req.app.get('nomeCookieSessao'));
  res.redirect('/');
};
