'use strict';

const { montarDashboard, montarEvolucao, montarAlertas, montarTrafego, montarAtividadeClientes } = require('../../services/relatorios/dashboardService');

exports.pagina = async (req, res) => {
  try {
    const dashboard = await montarDashboard();
    res.render('pages/admin/dashboard', { dashboard, secaoAtual: 'dashboard' });
  } catch (err) {
    console.error('Erro ao montar o Dashboard administrativo:', err.message);
    res.render('pages/admin/dashboard', { dashboard: null, secaoAtual: 'dashboard' });
  }
};

exports.evolucao = async (req, res) => {
  try {
    const evolucao = await montarEvolucao();
    res.json({ ok: true, data: evolucao });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao atualizar o gráfico.' });
  }
};

exports.trafego = async (req, res) => {
  try {
    const trafego = await montarTrafego(req.query.periodo);
    res.json({ ok: true, data: trafego });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao atualizar o gráfico de tráfego.' });
  }
};

exports.atividadeClientes = async (req, res) => {
  try {
    const atividade = await montarAtividadeClientes(req.query.periodo);
    res.json({ ok: true, data: atividade });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao atualizar o gráfico de atividade de clientes.' });
  }
};

exports.alertas = async (req, res) => {
  try {
    const alertas = await montarAlertas();
    res.json({ ok: true, data: alertas });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao carregar notificações.' });
  }
};
