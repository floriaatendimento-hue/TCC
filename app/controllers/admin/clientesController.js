'use strict';

const Usuario = require('../../models/Usuario');
const SessaoSegura = require('../../models/SessaoSegura');
const Pedido = require('../../models/Pedido');
const Endereco = require('../../models/Endereco');
const Favorito = require('../../models/Favorito');
const Comentario = require('../../models/Comentario');
const NotaInterna = require('../../models/NotaInterna');
const NivelCliente = require('../../models/NivelCliente');
const { logAcao, diffCampos } = require('../../helpers/auditLog');

/* Clientes */

exports.pagina = async (req, res) => {
  try {
    const busca = String(req.query.q || '').trim().slice(0, 100);
    const status = ['ativo', 'bloqueado'].includes(req.query.status) ? req.query.status : '';
    const ordenar = ['nome', 'cadastro', 'pedidos', 'gasto', 'ultima_compra'].includes(req.query.ordenar) ? req.query.ordenar : 'cadastro';
    const direcao = req.query.direcao === 'asc' ? 'asc' : 'desc';
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = 20;
    const offset = (pagina - 1) * limite;

    const [clientes, total] = await Promise.all([
      Usuario.findClientesAdmin({ busca, status, ordenar, direcao, limite, offset }),
      Usuario.contarClientesFiltrados(busca, status),
    ]);

    res.render('pages/admin/clientes', {
      clientes, busca, status, ordenar, direcao,
      pagina, totalPaginas: Math.max(1, Math.ceil(total / limite)),
      total, secaoAtual: 'clientes',
    });
  } catch (err) {
    console.error('Erro ao listar clientes:', err.message);
    res.render('pages/admin/clientes', {
      clientes: [], busca: '', status: '', ordenar: 'cadastro', direcao: 'desc',
      pagina: 1, totalPaginas: 1, total: 0, secaoAtual: 'clientes',
    });
  }
};

exports.alternarAtivo = async (req, res) => {
  try {
    const cliente = await Usuario.alternarAtivo(req.params.id);
    if (!cliente) return res.status(404).json({ ok: false, message: 'Cliente não encontrado (administradores não podem ser bloqueados por aqui).' });
    if (cliente && !cliente.ativo) {
      await SessaoSegura.revogarTodasDoUsuario(cliente.id)
        .catch((e) => console.error('[clientes] falha ao revogar sessões após bloquear:', e.message));
    }
    logAcao(req, 'cliente.status', `#${req.params.id} → ${cliente.ativo ? 'ativo' : 'inativo'}`, {
      dadosAntes: { ativo: !cliente.ativo },
      dadosDepois: { ativo: !!cliente.ativo },
    });
    res.json({ ok: true, data: cliente });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao alternar status do cliente.' });
  }
};

exports.detalhes = async (req, res) => {
  try {
    const clienteId = req.params.id;
    const cliente = await Usuario.findById(clienteId); // já exclui senha_hash
    if (!cliente || cliente.papel !== 'cliente') {
      return res.redirect('/admin/clientes');
    }

    const [
      enderecos,
      pedidos,
      itensDosPedidos,
      timelinePedidos,
      estatisticas,
      rankingCompras,
      favoritos,
      avaliacoes,
      notas,
    ] = await Promise.all([
      Endereco.findByUsuario(clienteId),
      Pedido.findByUsuario(clienteId),
      Pedido.itensPorUsuario(clienteId),
      Pedido.timelinePorUsuario(clienteId),
      Pedido.estatisticasCliente(clienteId),
      Pedido.produtoECategoriaMaisCompradosPorUsuario(clienteId),
      Favorito.findByUsuario(clienteId),
      Comentario.findByUsuario(clienteId),
      NotaInterna.findByUsuario(clienteId),
    ]);

    const itensPorPedido = {};
    for (const item of itensDosPedidos) {
      (itensPorPedido[item.pedido_id] ||= []).push(item);
    }
    pedidos.forEach(p => { p.itens = itensPorPedido[p.id] || []; });

    const eventosTimeline = [
      { tipo: 'conta', data: cliente.criado_em, titulo: 'Conta criada', descricao: `${cliente.nome} se cadastrou na Floria.` },
      ...timelinePedidos.map(t => ({
        tipo: t.etapa === 'cancelado' ? 'cancelamento' : 'pedido',
        data: t.criado_em,
        titulo: `Pedido #${t.pedido_id} — ${Pedido.rotulosEtapa()[t.etapa] || t.etapa}`,
        descricao: t.observacao || '',
      })),
      ...avaliacoes.map(a => ({
        tipo: 'avaliacao',
        data: a.criado_em,
        titulo: `Avaliação enviada (${a.produto_slug})`,
        descricao: `Nota ${a.avaliacao}/5 — ${a.status === 'aprovado' ? 'aprovada' : 'aguardando/reprovada'}.`,
      })),
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    let nivel = null;
    try {
      nivel = await NivelCliente.progressoDoUsuario(clienteId);
    } catch (errNivel) {
      console.error('[admin-cliente-detalhes] níveis indisponíveis:', errNivel.message);
    }

    res.render('pages/admin/cliente-detalhes', {
      cliente, enderecos, pedidos, estatisticas, rankingCompras,
      favoritos, avaliacoes, notas, eventosTimeline, nivel,
      rotulosEtapa: Pedido.rotulosEtapa(),
      rotulosStatusPagamento: Pedido.rotulosStatusPagamento(),
      secaoAtual: 'clientes',
    });
  } catch (err) {
    console.error('Erro ao carregar perfil do cliente:', err.message);
    res.redirect('/admin/clientes');
  }
};

exports.criarNota = async (req, res) => {
  try {
    const cliente = await Usuario.findById(req.params.id);
    if (!cliente || cliente.papel !== 'cliente') {
      return res.status(404).json({ ok: false, message: 'Cliente não encontrado.' });
    }

    const notaId = await NotaInterna.create({
      usuario_id: req.params.id,
      admin_id: req.session.usuario.id,
      admin_nome: req.session.usuario.nome,
      nota: req.body.nota,
    });
    logAcao(req, 'cliente.nota', `#${req.params.id} — observação interna adicionada`);

    res.json({
      ok: true,
      data: {
        id: notaId,
        admin_nome: req.session.usuario.nome,
        nota: req.body.nota,
        criado_em: new Date(),
      },
    });
  } catch (err) {
    console.error('Erro ao salvar observação interna:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao salvar observação.' });
  }
};

exports.paginaNiveis = async (req, res) => {
  try {
    const [niveis, resumo] = await Promise.all([
      NivelCliente.findAll(),
      NivelCliente.contarClientesPorNivel(),
    ]);
    res.render('pages/admin/niveis', { niveis, resumo, secaoAtual: 'niveis' });
  } catch (err) {
    console.error('Erro ao carregar níveis de clientes:', err.message);
    res.render('pages/admin/niveis', {
      niveis: [],
      resumo: { contagem: {}, semNivel: 0, totalClientes: 0 },
      secaoAtual: 'niveis',
    });
  }
};

exports.telaNovoNivel = (req, res) => {
  res.render('pages/admin/nivel-form', { nivel: null, secaoAtual: 'niveis' });
};

exports.telaEditarNivel = async (req, res) => {
  try {
    const nivel = await NivelCliente.findById(req.params.id);
    if (!nivel) return res.redirect('/admin/niveis');
    res.render('pages/admin/nivel-form', { nivel, secaoAtual: 'niveis' });
  } catch (err) {
    console.error('Erro ao carregar página de edição de nível:', err.message);
    res.redirect('/admin/niveis');
  }
};

exports.listarNiveis = async (req, res) => {
  try {
    const [niveis, resumo] = await Promise.all([
      NivelCliente.findAll(),
      NivelCliente.contarClientesPorNivel(),
    ]);
    res.json({ ok: true, data: niveis, resumo });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao listar níveis.' });
  }
};

exports.criarNivel = async (req, res) => {
  try {
    const id = await NivelCliente.create(req.body);
    logAcao(req, 'nivel.criar', `#${id} — ${req.body.nome} (a partir de R$ ${Number(req.body.valor_minimo).toFixed(2)})`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error('Erro ao criar nível:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao criar nível.' });
  }
};

exports.atualizarNivel = async (req, res) => {
  try {
    const nivelAntes = await NivelCliente.findById(req.params.id);
    if (!nivelAntes) return res.status(404).json({ ok: false, message: 'Nível não encontrado.' });

    await NivelCliente.update(req.params.id, req.body);
    const diff = diffCampos(nivelAntes, req.body, ['nome', 'icone', 'valor_minimo', 'descricao', 'beneficios']);
    logAcao(
      req,
      'nivel.editar',
      `#${req.params.id} — ${req.body.nome}`,
      diff.mudou ? { dadosAntes: diff.antes, dadosDepois: diff.depois } : {}
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao atualizar nível:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao atualizar nível.' });
  }
};

exports.reordenarNiveisPorValor = async (req, res) => {
  try {
    const total = await NivelCliente.reordenarPorValor();
    logAcao(req, 'nivel.reordenar', `ordem alinhada aos valores mínimos (${total} níveis)`);
    res.json({ ok: true, total });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao reordenar níveis.' });
  }
};

exports.alternarAtivoNivel = async (req, res) => {
  try {
    const nivel = await NivelCliente.findById(req.params.id);
    if (!nivel) return res.status(404).json({ ok: false, message: 'Nível não encontrado.' });

    if (nivel.ativo) {
      const ativos = await NivelCliente.findAllAtivos();
      if (ativos.length <= 1) {
        return res.status(409).json({
          ok: false,
          message: 'Este é o único nível ativo — mantenha ao menos um para a progressão continuar funcionando.',
        });
      }
    }

    const atualizado = await NivelCliente.alternarAtivo(req.params.id);
    logAcao(req, 'nivel.status', `#${req.params.id} → ${atualizado.ativo ? 'ativo' : 'inativo'}`, {
      dadosAntes: { ativo: !atualizado.ativo },
      dadosDepois: { ativo: !!atualizado.ativo },
    });
    res.json({ ok: true, data: atualizado });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao alternar status do nível.' });
  }
};

exports.moverNivel = async (req, res) => {
  try {
    const direcao = req.body.direcao === 'cima' ? 'cima' : 'baixo';
    const moveu = await NivelCliente.mover(req.params.id, direcao);
    res.json({ ok: moveu });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao reordenar nível.' });
  }
};

exports.impactoRemocaoNivel = async (req, res) => {
  try {
    const impacto = await NivelCliente.impactoDaRemocao(req.params.id);
    if (!impacto) return res.status(404).json({ ok: false, message: 'Nível não encontrado.' });
    res.json({ ok: true, data: impacto });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao calcular impacto da exclusão.' });
  }
};

exports.excluirNivel = async (req, res) => {
  try {
    const nivel = await NivelCliente.findById(req.params.id);
    if (!nivel) return res.status(404).json({ ok: false, message: 'Nível não encontrado.' });

    if (await NivelCliente.contarTodos() <= 1) {
      return res.status(409).json({
        ok: false,
        message: 'Não é possível excluir o último nível — a progressão precisa de ao menos um.',
      });
    }

    await NivelCliente.delete(req.params.id);
    logAcao(req, 'nivel.excluir', `#${req.params.id} — ${nivel.nome}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir nível:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao excluir nível.' });
  }
};
