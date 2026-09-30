'use strict';

const MAPA = {
  pending:      'pendente',
  in_process:   'processando',
  authorized:   'processando',
  approved:     'aprovado',
  rejected:     'recusado',
  cancelled:    'recusado',
  refunded:     'estornado',
  charged_back: 'estornado',
};

const STATUS_CONHECIDOS_SEM_MAPEAMENTO = ['in_mediation'];

function mapear(statusMercadoPago) {
  return MAPA[statusMercadoPago] || null;
}

function ehConhecidoSemMapeamento(statusMercadoPago) {
  return STATUS_CONHECIDOS_SEM_MAPEAMENTO.includes(statusMercadoPago);
}

module.exports = { mapear, ehConhecidoSemMapeamento, STATUS_CONHECIDOS_SEM_MAPEAMENTO };
