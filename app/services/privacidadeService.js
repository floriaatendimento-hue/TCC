'use strict';

const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const Endereco = require('../models/Endereco');
const Favorito = require('../models/Favorito');
const Pedido = require('../models/Pedido');
const Comentario = require('../models/Comentario');
const SessaoSegura = require('../models/SessaoSegura');
const LogAdmin = require('../models/LogAdmin');

async function exportarDados(usuarioId) {
  const [usuario, enderecos, favoritos, pedidos, avaliacoes, sessoesAtivas] = await Promise.all([
    Usuario.findById(usuarioId),
    Endereco.findByUsuario(usuarioId),
    Favorito.findByUsuario(usuarioId),
    Pedido.findByUsuario(usuarioId),
    Comentario.findByUsuario(usuarioId),
    SessaoSegura.listarAtivasDoUsuario(usuarioId, null),
  ]);

  return {
    geradoEm: new Date().toISOString(),
    aviso: 'Exportação gerada pelo próprio titular via /perfil (LGPD art. 9º/18). '
      + 'Não inclui a senha (armazenada só como hash, irreversível) nem dados de outras pessoas.',
    dadosCadastrais: usuario,
    enderecos,
    favoritos,
    pedidos,
    avaliacoes,
    sessoesAtivas: sessoesAtivas.map(({ atual, ...s }) => s),
  };
}

async function solicitarExclusaoConta({ usuarioId, senhaAtual }) {
  const usuario = await Usuario.findByIdComSenha(usuarioId);
  if (!usuario) return { ok: false, motivo: 'SENHA_INCORRETA' };
  const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha_hash);
  if (!senhaCorreta) return { ok: false, motivo: 'SENHA_INCORRETA' };

  await Promise.all([
    Endereco.findByUsuario(usuarioId).then(lista =>
      Promise.all(lista.map(e => Endereco.remove(e.id, usuarioId)))
    ),
    Favorito.findByUsuario(usuarioId).then(lista =>
      Promise.all(lista.map(f => Favorito.remove(usuarioId, f.produto_slug)))
    ),
    Comentario.anonimizarNomeDoUsuario(usuarioId),
  ]);

  await Usuario.anonimizar(usuarioId);
  await SessaoSegura.revogarTodasDoUsuario(usuarioId, {})
    .catch((e) => console.error('[privacidadeService] falha ao revogar sessões após exclusão de conta:', e.message));

  await LogAdmin.registrar({
    usuario_id: usuarioId,
    usuario_nome: 'Cliente removido',
    acao: 'conta.exclusao_solicitada_pelo_titular',
    detalhes: `Usuário #${usuarioId} solicitou e confirmou a exclusão/anonimização da própria conta.`,
  });

  return { ok: true };
}

module.exports = { exportarDados, solicitarExclusaoConta };
