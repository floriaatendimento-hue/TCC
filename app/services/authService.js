'use strict';

const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const SessaoSegura = require('../models/SessaoSegura');
const OtpRecuperacaoSenha = require('../models/OtpRecuperacaoSenha');
const { mailerDisponivel, enviarRecuperacaoSenhaPorEmail, enviarSenhaAlteradaPorEmail } = require('./mailer');
const { logSeguranca } = require('../helpers/logSeguranca');

function notificarSenhaAlterada({ email, nome, ip }) {
  if (!mailerDisponivel) return;
  const quando = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  enviarSenhaAlteradaPorEmail({ to: email, nome: nome || 'cliente', quando, ip })
    .catch((e) => console.error('[authService] falha ao enviar notificação de senha alterada:', e.message));
}

const HASH_BCRYPT_MORTO = bcrypt.hashSync('nenhuma-senha-corresponde-a-isto', 12);

async function autenticar(email, senha) {
  const usuario = await Usuario.findByEmail(email);
  const senhaCorreta = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_BCRYPT_MORTO);
  if (!usuario || !senhaCorreta) return { ok: false, motivo: 'CREDENCIAIS_INVALIDAS' };

  if (!usuario.ativo) return { ok: false, motivo: 'CONTA_BLOQUEADA' };

  return { ok: true, usuario };
}

async function registrar({ nome, email, senha, cpf, telefone }) {
  const existeEmail = await Usuario.findByEmail(email);
  if (existeEmail) {
    const erro = new Error('E-mail já cadastrado.');
    erro.campo = 'email';
    erro.codigo = 'DUPLICADO';
    throw erro;
  }

  const cpfExistente = await Usuario.findByCpf(cpf);
  if (cpfExistente) {
    const erro = new Error('CPF já cadastrado.');
    erro.campo = 'cpf';
    erro.codigo = 'DUPLICADO';
    throw erro;
  }

  const senha_hash = await bcrypt.hash(senha, 12);
  const id = await Usuario.create({ nome, email, senha_hash, cpf, telefone: telefone || null, foto_perfil: null });
  return Usuario.findById(id);
}

function iniciarSessaoAutenticada(req, usuario) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(async (err) => {
      if (err) return reject(err);

      req.session.usuario = {
        id:          usuario.id,
        nome:        usuario.nome,
        email:       usuario.email,
        foto_perfil: usuario.foto_perfil,
        papel:       usuario.papel,
      };

      await SessaoSegura.criar({
        sessionId: req.sessionID,
        usuarioId: usuario.id,
        papel:     usuario.papel,
        ip:        req.ip,
        userAgent: req.headers['user-agent'],
      }).catch((e) => console.error('[authService] falha ao registrar sessão segura:', e.message));

      resolve();
    });
  });
}

async function alterarSenha({ usuarioId, emailUsuario, senhaAtual, novaSenha, sessionIdAtual, ip }) {
  const usuario = await Usuario.findByEmail(emailUsuario);
  if (!usuario) {
    const erro = new Error('Usuário não encontrado.');
    erro.codigo = 'NAO_ENCONTRADO';
    throw erro;
  }

  const senhaAtualCorreta = await bcrypt.compare(senhaAtual, usuario.senha_hash);
  if (!senhaAtualCorreta) return { ok: false, motivo: 'SENHA_ATUAL_INCORRETA' };

  const mesmaSenha = await bcrypt.compare(novaSenha, usuario.senha_hash);
  if (mesmaSenha) return { ok: false, motivo: 'SENHA_IGUAL' };

  const novoHash = await bcrypt.hash(novaSenha, 12);
  await Usuario.updateSenha(usuario.id, novoHash);

  await SessaoSegura.revogarTodasDoUsuario(usuario.id, { exceto_session_id: sessionIdAtual })
    .catch((e) => console.error('[authService] falha ao revogar outras sessões após troca de senha:', e.message));

  logSeguranca('senha_alterada', { origem: 'troca_logada', usuario_id: usuario.id, ip });
  notificarSenhaAlterada({ email: usuario.email, nome: usuario.nome, ip });

  return { ok: true };
}

async function solicitarRecuperacaoSenha({ email, ip, userAgent }) {
  const usuario = await Usuario.findByEmail(email);
  logSeguranca('recuperacao_solicitada', { email, ip, encontrado: !!(usuario && usuario.ativo) });
  if (!usuario || !usuario.ativo) return;

  try {
    const codigo = await OtpRecuperacaoSenha.criar({ usuarioId: usuario.id, ip, userAgent });
    if (codigo === null) {
      logSeguranca('recuperacao_otp_limitado', { usuario_id: usuario.id, ip });
      return;
    }
    const primeiroNome = (usuario.nome || '').split(' ')[0] || 'cliente';
    await enviarRecuperacaoSenhaPorEmail({
      to: usuario.email,
      nome: primeiroNome,
      codigo,
      expiraMinutos: OtpRecuperacaoSenha.constantes.OTP_EXPIRA_MINUTOS,
      quando: new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }),
    });
  } catch (err) {
    if (err.code === 'MAILER_INDISPONIVEL') {
      console.warn('[authService] recuperação de senha: envio de e-mail não configurado (ok em dev).');
    } else {
      console.error('[authService] falha ao enviar e-mail de recuperação de senha:', err.message);
    }
  }
}

async function verificarOtpRecuperacao({ email, otp, ip }) {
  const usuario = await Usuario.findByEmail(email);
  if (!usuario || !usuario.ativo) {
    logSeguranca('recuperacao_otp_falhou', { ip, motivo: 'INVALIDO', encontrado: false });
    return { ok: false, motivo: 'INVALIDO' };
  }

  const resultado = await OtpRecuperacaoSenha.verificar({ usuarioId: usuario.id, otp });
  logSeguranca(resultado.ok ? 'recuperacao_otp_verificado' : 'recuperacao_otp_falhou', {
    usuario_id: usuario.id, ip, ...(resultado.ok ? {} : { motivo: resultado.motivo }),
  });
  return resultado;
}

function autorizacaoRedefinicaoValida(autorizacao) {
  return OtpRecuperacaoSenha.autorizacaoValida(autorizacao);
}

async function redefinirSenhaComAutorizacao({ autorizacao, novaSenha, ip }) {
  const registro = await OtpRecuperacaoSenha.consumirAutorizacao(autorizacao);
  if (!registro) {
    logSeguranca('recuperacao_autorizacao_invalida', { ip });
    return { ok: false, motivo: 'AUTORIZACAO_INVALIDA' };
  }

  const usuario = await Usuario.findById(registro.usuario_id).catch(() => null);
  if (!usuario || !usuario.ativo) {
    logSeguranca('recuperacao_autorizacao_invalida', { ip, usuario_id: registro.usuario_id, motivo: 'CONTA_INATIVA' });
    return { ok: false, motivo: 'AUTORIZACAO_INVALIDA' };
  }

  const novoHash = await bcrypt.hash(novaSenha, 12);
  await Usuario.updateSenha(usuario.id, novoHash);
  await SessaoSegura.revogarTodasDoUsuario(usuario.id, {})
    .catch((e) => console.error('[authService] falha ao revogar sessões após redefinição de senha:', e.message));

  logSeguranca('recuperacao_concluida', { origem: 'redefinicao_por_otp', usuario_id: usuario.id, ip });
  notificarSenhaAlterada({ email: usuario.email, nome: usuario.nome, ip });

  return { ok: true };
}

function encerrarSessao(req) {
  return SessaoSegura.revogar(req.sessionID)
    .catch((e) => console.error('[authService] falha ao revogar sessão segura:', e.message))
    .then(() => new Promise((resolve) => {
      req.session.destroy((err) => {
        if (err) console.error('[authService] erro ao destruir sessão:', err.message);
        resolve();
      });
    }));
}

module.exports = {
  autenticar,
  registrar,
  iniciarSessaoAutenticada,
  alterarSenha,
  encerrarSessao,
  solicitarRecuperacaoSenha,
  verificarOtpRecuperacao,
  autorizacaoRedefinicaoValida,
  redefinirSenhaComAutorizacao,
  otpConfig: OtpRecuperacaoSenha.constantes,
};
