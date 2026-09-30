'use strict';

const Produto = require('../models/Produto');
const Configuracao = require('../models/Configuracao');

class FreteError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// CEP

function normalizarCep(cep) {
  return String(cep || '').replace(/\D/g, '');
}

function validarFormatoCep(cep) {
  return /^\d{8}$/.test(normalizarCep(cep));
}

async function fetchComTimeout(url, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cacheEnderecos = new Map();

function obterDoCache(cepLimpo) {
  const item = cacheEnderecos.get(cepLimpo);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    cacheEnderecos.delete(cepLimpo);
    return null;
  }
  return item.endereco;
}

async function buscarEnderecoPorCep(cepLimpo) {
  const doCache = obterDoCache(cepLimpo);
  if (doCache) return doCache;

  let resp;
  try {
    resp = await fetchComTimeout(`https://viacep.com.br/ws/${cepLimpo}/json/`);
  } catch (err) {
    throw new FreteError('SERVICO_INDISPONIVEL', 'Não foi possível consultar o CEP agora. Verifique sua conexão e tente novamente.');
  }

  if (!resp.ok) {
    throw new FreteError('SERVICO_INDISPONIVEL', 'O serviço de consulta de CEP está temporariamente indisponível. Tente novamente em instantes.');
  }

  let dados;
  try {
    dados = await resp.json();
  } catch (err) {
    throw new FreteError('SERVICO_INDISPONIVEL', 'O serviço de consulta de CEP retornou uma resposta inválida. Tente novamente.');
  }

  if (dados.erro) {
    throw new FreteError('CEP_NAO_ENCONTRADO', 'CEP não encontrado. Confira o número digitado.');
  }

  const endereco = {
    cep: dados.cep,
    uf: dados.uf,
    cidade: dados.localidade,
    bairro: dados.bairro,
    logradouro: dados.logradouro,
  };
  cacheEnderecos.set(cepLimpo, { endereco, timestamp: Date.now() });
  return endereco;
}

// Distância aproximada

const REGIAO_POR_UF = {
  SP: 'sudeste', RJ: 'sudeste', MG: 'sudeste', ES: 'sudeste',
  PR: 'sul', SC: 'sul', RS: 'sul',
  MS: 'centro-oeste', MT: 'centro-oeste', GO: 'centro-oeste', DF: 'centro-oeste',
  BA: 'nordeste', SE: 'nordeste', AL: 'nordeste', PE: 'nordeste', PB: 'nordeste',
  RN: 'nordeste', CE: 'nordeste', PI: 'nordeste', MA: 'nordeste',
  TO: 'norte', PA: 'norte', AM: 'norte', AC: 'norte', RO: 'norte', RR: 'norte', AP: 'norte',
};

const REGIOES_VIZINHAS = {
  sudeste: ['sul', 'centro-oeste', 'nordeste'],
  sul: ['sudeste', 'centro-oeste'],
  'centro-oeste': ['sudeste', 'sul', 'nordeste', 'norte'],
  nordeste: ['sudeste', 'centro-oeste', 'norte'],
  norte: ['centro-oeste', 'nordeste'],
};

function calcularTierDistancia(ufOrigem, ufDestino) {
  if (ufOrigem === ufDestino) return 0;

  const regiaoOrigem = REGIAO_POR_UF[ufOrigem];
  const regiaoDestino = REGIAO_POR_UF[ufDestino];
  if (!regiaoOrigem || !regiaoDestino) return 3;
  if (regiaoOrigem === regiaoDestino) return 1;
  if ((REGIOES_VIZINHAS[regiaoOrigem] || []).includes(regiaoDestino)) return 2;
  return 3;
}

const FATOR_VALOR_POR_TIER = { 0: 1, 1: 1.5, 2: 2.1, 3: 2.8 };
const PRAZO_DIAS_POR_TIER  = { 0: 2, 1: 4, 2: 7, 3: 10 };
const VALOR_MINIMO = 9.9;

// Cálculo

function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

function montarOpcoes({ pesoConsideradoKg, tier, precoBaseConfig }) {
  const prazoPadrao = PRAZO_DIAS_POR_TIER[tier];
  const valorPadrao = Math.max(
    VALOR_MINIMO,
    arredondar((precoBaseConfig + pesoConsideradoKg * 3.2) * FATOR_VALOR_POR_TIER[tier])
  );

  const prazoExpresso = Math.max(1, Math.ceil(prazoPadrao * 0.5));
  const valorExpresso = arredondar(valorPadrao * 1.6 + 5);

  return [
    {
      transportadora: 'Floria Entregas',
      tipo: 'Padrão',
      prazoDias: prazoPadrao,
      valor: valorPadrao,
    },
    {
      transportadora: 'Floria Express',
      tipo: 'Expressa',
      prazoDias: prazoExpresso,
      valor: valorExpresso,
    },
  ];
}

async function calcularFrete({ cepDestino, slug, quantidade = 1 }) {
  const cepLimpo = normalizarCep(cepDestino);
  if (!validarFormatoCep(cepLimpo)) {
    throw new FreteError('CEP_INVALIDO', 'Digite um CEP válido com 8 dígitos (ex.: 01310-930).');
  }

  const qtd = Math.max(1, Number(quantidade) || 1);

  const produto = await Produto.findFreteInfoBySlug(String(slug || '').trim());
  if (!produto) {
    throw new FreteError('PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado para cálculo de frete.');
  }
  if (!produto.peso_g || !produto.altura_cm || !produto.largura_cm || !produto.comprimento_cm) {
    throw new FreteError('PRODUTO_SEM_DIMENSOES', 'Este produto ainda não tem peso/dimensões cadastrados — não é possível calcular o frete agora.');
  }

  const endereco = await buscarEnderecoPorCep(cepLimpo);

  const config = await Configuracao.obterTodas();
  const ufOrigem = config.uf_origem || 'SP';
  const precoBaseConfig = Number(config.frete_padrao ?? 15);
  const gratisAcima = Number(config.frete_gratis_acima ?? 150);

  const ufsPermitidas = String(config.ufs_entrega_permitidas || '')
    .split(',').map((uf) => uf.trim().toUpperCase()).filter(Boolean);
  if (ufsPermitidas.length && !ufsPermitidas.includes(endereco.uf)) {
    throw new FreteError('REGIAO_NAO_ATENDIDA', 'No momento, não realizamos entregas para este endereço.');
  }

  const precoUnitario = produto.preco_promo != null ? Number(produto.preco_promo) : Number(produto.preco);
  const subtotal = precoUnitario * qtd;

  const pesoRealKg = (Number(produto.peso_g) * qtd) / 1000;
  const pesoCubicoKg = (Number(produto.altura_cm) * Number(produto.largura_cm) * Number(produto.comprimento_cm) * qtd) / 6000;
  const pesoConsideradoKg = Math.max(pesoRealKg, pesoCubicoKg);

  const tier = calcularTierDistancia(ufOrigem, endereco.uf);

  let opcoes;
  let freteGratis = false;
  if (gratisAcima > 0 && subtotal >= gratisAcima) {
    freteGratis = true;
    opcoes = [{
      transportadora: 'Floria Entregas',
      tipo: 'Padrão (frete grátis)',
      prazoDias: PRAZO_DIAS_POR_TIER[tier],
      valor: 0,
    }];
  } else {
    opcoes = montarOpcoes({ pesoConsideradoKg, tier, precoBaseConfig });
  }

  return {
    cep: `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`,
    cidade: endereco.cidade,
    uf: endereco.uf,
    freteGratis,
    opcoes,
  };
}

module.exports = { calcularFrete, validarFormatoCep, FreteError };
