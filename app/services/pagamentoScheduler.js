'use strict';

const db = require('../../config/db');
const Pedido = require('../models/Pedido');

const INTERVALO_MS = 5_000;

async function registrarEventos(pedidoIds, status_pagamento, observacao = null) {
  if (!pedidoIds.length) return;
  const valores = pedidoIds.map(() => '(?, ?, ?, ?)').join(', ');
  const params = pedidoIds.flatMap(id => [id, status_pagamento, 'simulador_automatico', observacao]);
  await db.query(
    `INSERT INTO pedido_pagamento_eventos (pedido_id, status_pagamento, origem, observacao) VALUES ${valores}`,
    params
  );
}

async function avancarPendenteParaProcessando() {
  const [rows] = await db.query(
    `SELECT id FROM pedidos
      WHERE status_pagamento = 'pendente'
        AND pagamento_processa_em IS NOT NULL
        AND pagamento_processa_em <= NOW()`
  );
  const avancados = [];
  for (const { id } of rows) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[atual]] = await conn.query(`SELECT status_pagamento FROM pedidos WHERE id = ? FOR UPDATE`, [id]);
      if (!atual || atual.status_pagamento !== 'pendente') { await conn.rollback(); continue; }
      await conn.query(`UPDATE pedidos SET status_pagamento = 'processando' WHERE id = ?`, [id]);
      await conn.commit();
      avancados.push(id);
    } catch (err) {
      await conn.rollback();
      console.error(`[pagamento] erro ao avançar pedido #${id} para processando:`, err.message);
    } finally {
      conn.release();
    }
  }
  if (!avancados.length) return;
  await registrarEventos(avancados, 'processando');
  console.log(`[pagamento] pedido(s) #${avancados.join(', #')} → processando`);
}

async function avancarProcessandoParaAprovado() {
  const [rows] = await db.query(
    `SELECT id FROM pedidos
      WHERE status_pagamento = 'processando'
        AND pagamento_confirma_em IS NOT NULL
        AND pagamento_confirma_em <= NOW()`
  );
  const avancados = [];
  for (const { id } of rows) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[atual]] = await conn.query(`SELECT status_pagamento FROM pedidos WHERE id = ? FOR UPDATE`, [id]);
      if (!atual || atual.status_pagamento !== 'processando') { await conn.rollback(); continue; }
      await conn.query(
        `UPDATE pedidos SET status_pagamento = 'aprovado', pagamento_confirmado_em = NOW() WHERE id = ?`,
        [id]
      );
      await conn.commit();
      avancados.push(id);
    } catch (err) {
      await conn.rollback();
      console.error(`[pagamento] erro ao avançar pedido #${id} para aprovado:`, err.message);
    } finally {
      conn.release();
    }
  }
  if (!avancados.length) return;
  await registrarEventos(avancados, 'aprovado');
  console.log(`[pagamento] pedido(s) #${avancados.join(', #')} → aprovado (pago)`);
}

async function expirarPedidosVencidos() {
  const [rows] = await db.query(
    `SELECT id FROM pedidos
      WHERE status_pagamento IN ('pendente', 'processando')
        AND pagamento_expira_em IS NOT NULL
        AND pagamento_expira_em <= NOW()`
  );

  for (const { id } of rows) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[atual]] = await conn.query(
        `SELECT status_pagamento FROM pedidos WHERE id = ? FOR UPDATE`, [id]
      );
      if (!atual || !['pendente', 'processando'].includes(atual.status_pagamento)) {
        await conn.rollback();
        continue;
      }
      await conn.query(`UPDATE pedidos SET status_pagamento = 'expirado' WHERE id = ?`, [id]);
      await conn.query(
        `INSERT INTO pedido_pagamento_eventos (pedido_id, status_pagamento, origem, observacao)
         VALUES (?, 'expirado', 'simulador_automatico', 'Janela de pagamento expirada sem confirmação.')`,
        [id]
      );
      await Pedido._restaurarEstoqueDoPedido(conn, id);
      await conn.commit();
      console.log(`[pagamento] pedido #${id} expirado — estoque restaurado`);
    } catch (err) {
      await conn.rollback();
      console.error(`[pagamento] erro ao expirar o pedido #${id}:`, err.message);
    } finally {
      conn.release();
    }
  }
}

let timer = null;

function iniciar() {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      await avancarPendenteParaProcessando();
      await avancarProcessandoParaAprovado();
      await expirarPedidosVencidos();
    } catch (err) {
      console.error('[pagamento] erro no ciclo do simulador automático:', err.message);
    }
  }, INTERVALO_MS);
  console.log(`💳  Simulador de confirmação de pagamento ativo (a cada ${INTERVALO_MS / 1000}s).`);
}

module.exports = { iniciar };
