'use strict';

const STATUS = Object.freeze({
  VALID: 'VALID',
  PARTIALLY_VALIDATED: 'PARTIALLY_VALIDATED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID: 'INVALID',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
});

const VIACEP_TIMEOUT_MS = Number(process.env.VIACEP_TIMEOUT_MS) || 5000;
const NOMINATIM_TIMEOUT_MS = Number(process.env.NOMINATIM_TIMEOUT_MS) || 6000;
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT
  || 'FloriaEcommerce/1.0 (validacao-endereco; contato@floria.com.br)';

// Normalização

function removerAcentos(str) {
  return String(str || '').normalize('NFD').replace(/[^\x00-\x7F]/g, '');
}

function normalizarTexto(str) {
  return removerAcentos(str)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ABREVIACOES_LOGRADOURO = [
  [/^R\.?\s+/, 'RUA '],
  [/^AV\.?\s+/, 'AVENIDA '],
  [/^AL\.?\s+/, 'ALAMEDA '],
  [/^TRAV\.?\s+/, 'TRAVESSA '],
  [/^TV\.?\s+/, 'TRAVESSA '],
  [/^PC\.?A?\.?\s+/, 'PRACA '],
  [/^ESTR\.?\s+/, 'ESTRADA '],
  [/^ROD\.?\s+/, 'RODOVIA '],
  [/^L\.?\s+/, 'LARGO '],
];

function normalizarLogradouro(str) {
  let texto = normalizarTexto(str);
  for (const [padrao, substituicao] of ABREVIACOES_LOGRADOURO) {
    texto = texto.replace(padrao, substituicao);
  }
  return texto;
}

function normalizarCep(cep) {
  return String(cep || '').replace(/\D/g, '');
}

function textoCoerente(a, b, tamanhoMinimo = 3) {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return null; // não dá pra comparar
  if (na === nb) return true;
  const [menor, maior] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (menor.length < tamanhoMinimo) return false;
  return maior.includes(menor);
}

function logradouroCoerente(a, b) {
  const na = normalizarLogradouro(a);
  const nb = normalizarLogradouro(b);
  if (!na || !nb) return null;
  if (na === nb) return true;
  const [menor, maior] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (menor.length < 4) return false;
  return maior.includes(menor);
}

function numerosCoerentes(a, b) {
  const na = String(a || '').match(/\d+/);
  const nb = String(b || '').match(/\d+/);
  if (!na || !nb) return null;
  return Number(na[0]) === Number(nb[0]);
}

// Cache em memória
const TTL_MS = Number(process.env.ENDERECO_VALIDACAO_CACHE_TTL_MS) || 24 * 60 * 60 * 1000; // 24h
const TAMANHO_MAX_CACHE = 500;
const cache = new Map();

function chaveCache({ cep, logradouro, numero, cidade, uf }) {
  return [normalizarCep(cep), normalizarLogradouro(logradouro), String(numero || '').trim(), normalizarTexto(cidade), normalizarTexto(uf)].join('|');
}

function lerCache(chave) {
  const entrada = cache.get(chave);
  if (!entrada) return null;
  if (entrada.expiraEm < Date.now()) { cache.delete(chave); return null; }
  return entrada.resultado;
}

function gravarCache(chave, resultado) {
  if (resultado.status === STATUS.SERVICE_UNAVAILABLE) return;
  if (cache.size >= TAMANHO_MAX_CACHE) {
    const primeiraChave = cache.keys().next().value;
    if (primeiraChave !== undefined) cache.delete(primeiraChave);
  }
  cache.set(chave, { resultado, expiraEm: Date.now() + TTL_MS });
}

let filaNominatim = Promise.resolve();
function agendarNominatim(tarefa) {
  const execucao = filaNominatim.then(() => tarefa());
  filaNominatim = execucao.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
  return execucao;
}

async function fetchComTimeout(url, opcoes, timeoutMs) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opcoes, signal: controlador.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function consultarViaCep(cep) {
  try {
    const resp = await fetchComTimeout(`https://viacep.com.br/ws/${cep}/json/`, {}, VIACEP_TIMEOUT_MS);
    if (!resp.ok) return { ok: false, indisponivel: true };
    const data = await resp.json();
    if (data.erro) return { ok: true, encontrado: false };
    return { ok: true, encontrado: true, dados: data };
  } catch (err) {
    return { ok: false, indisponivel: true, erro: err.message };
  }
}

async function consultarNominatim({ logradouro, numero, cidade, uf, cep }) {
  const numeroLimpo = String(numero || '').match(/\d+/)?.[0] || '';
  const rua = numeroLimpo ? `${numeroLimpo} ${logradouro}` : logradouro;
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'br',
    street: rua,
    city: cidade,
    state: uf,
    country: 'Brazil',
  });
  if (cep) params.set('postalcode', cep);

  try {
    const resp = await agendarNominatim(() => fetchComTimeout(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { 'User-Agent': NOMINATIM_USER_AGENT, 'Accept-Language': 'pt-BR' } },
      NOMINATIM_TIMEOUT_MS
    ));
    if (!resp.ok) return { ok: false, indisponivel: true };
    const lista = await resp.json();
    if (!Array.isArray(lista) || lista.length === 0) return { ok: true, encontrado: false };
    return { ok: true, encontrado: true, resultado: lista[0] };
  } catch (err) {
    return { ok: false, indisponivel: true, erro: err.message };
  }
}

async function validarExistenciaEndereco(endereco) {
  const cepLimpo = normalizarCep(endereco.cep);
  const chave = chaveCache(endereco);
  const emCache = lerCache(chave);
  if (emCache) return { ...emCache, cache: true };

  const detalhes = {
    cepExiste: null,
    ufCoerente: null,
    cidadeCoerente: null,
    bairroCoerente: null,
    logradouroLocalizado: null,
    numeroConfirmado: null,
  };

  if (cepLimpo.length !== 8) {
    const resultado = {
      status: STATUS.INVALID,
      campo: 'cep',
      mensagem: 'CEP em formato inválido.',
      fonte: 'formato',
      confirmado: {},
      detalhes,
    };
    return resultado;
  }

  const viacep = await consultarViaCep(cepLimpo);
  if (!viacep.ok) {
    const resultado = {
      status: STATUS.SERVICE_UNAVAILABLE,
      mensagem: 'Não foi possível confirmar o CEP agora (serviço de consulta indisponível). Tente novamente em instantes.',
      fonte: 'viacep',
      confirmado: {},
      detalhes,
    };
    return resultado;
  }
  if (!viacep.encontrado) {
    const resultado = {
      status: STATUS.INVALID,
      campo: 'cep',
      mensagem: 'Este CEP não existe na base dos Correios.',
      fonte: 'viacep',
      confirmado: {},
      detalhes: { ...detalhes, cepExiste: false },
    };
    gravarCache(chave, resultado);
    return resultado;
  }
  detalhes.cepExiste = true;

  const oficial = viacep.dados;
  detalhes.ufCoerente = textoCoerente(endereco.uf, oficial.uf, 2);
  detalhes.cidadeCoerente = textoCoerente(endereco.cidade, oficial.localidade);
  detalhes.bairroCoerente = oficial.bairro ? textoCoerente(endereco.bairro, oficial.bairro) : null;
  detalhes.logradouroLocalizado = oficial.logradouro ? logradouroCoerente(endereco.logradouro, oficial.logradouro) : null;

  if (detalhes.ufCoerente === false) {
    const resultado = {
      status: STATUS.INVALID,
      campo: 'uf',
      mensagem: `O estado informado (${endereco.uf}) não corresponde ao CEP (${oficial.uf}).`,
      fonte: 'viacep',
      confirmado: { cep: cepLimpo, uf: oficial.uf, cidade: oficial.localidade },
      detalhes,
    };
    gravarCache(chave, resultado);
    return resultado;
  }
  if (detalhes.cidadeCoerente === false) {
    const resultado = {
      status: STATUS.INVALID,
      campo: 'cidade',
      mensagem: `A cidade informada (${endereco.cidade}) não corresponde ao CEP (${oficial.localidade}/${oficial.uf}).`,
      fonte: 'viacep',
      confirmado: { cep: cepLimpo, uf: oficial.uf, cidade: oficial.localidade },
      detalhes,
    };
    gravarCache(chave, resultado);
    return resultado;
  }

  const nominatim = await consultarNominatim({
    logradouro: endereco.logradouro || oficial.logradouro,
    numero: endereco.numero,
    cidade: oficial.localidade,
    uf: oficial.uf,
    cep: cepLimpo,
  });

  if (!nominatim.ok) {
    const resultado = {
      status: STATUS.PARTIALLY_VALIDATED,
      mensagem: 'CEP e cidade confirmados. Não foi possível confirmar a localização exata da rua agora (serviço de mapas indisponível) — o endereço será salvo mesmo assim.',
      fonte: 'viacep',
      confirmado: { cep: cepLimpo, logradouro: oficial.logradouro, bairro: oficial.bairro, cidade: oficial.localidade, uf: oficial.uf },
      detalhes,
    };
    return resultado;
  }

  if (!nominatim.encontrado) {
    detalhes.logradouroLocalizado = false;
    const resultado = {
      status: STATUS.NOT_FOUND,
      mensagem: 'CEP e cidade existem, mas não conseguimos localizar esta rua/número no mapa. Confira o logradouro e o número.',
      fonte: 'viacep+nominatim',
      confirmado: { cep: cepLimpo, bairro: oficial.bairro, cidade: oficial.localidade, uf: oficial.uf },
      detalhes,
    };
    gravarCache(chave, resultado);
    return resultado;
  }

  const encontrado = nominatim.resultado.address || {};
  const cidadeOsm = encontrado.city || encontrado.town || encontrado.village || encontrado.municipality || '';
  detalhes.logradouroLocalizado = encontrado.road ? logradouroCoerente(endereco.logradouro, encontrado.road) !== false : true;
  const ufSigla = (encontrado['ISO3166-2-lvl4'] || '').replace(/^BR-/, '');
  const ufOsmCoerente = ufSigla
    ? normalizarTexto(ufSigla) === normalizarTexto(endereco.uf)
    : (encontrado.state ? textoCoerente(endereco.uf, encontrado.state, 2) : null);
  const cidadeOsmCoerente = cidadeOsm ? textoCoerente(endereco.cidade, cidadeOsm) : null;

  if (encontrado.house_number) {
    detalhes.numeroConfirmado = numerosCoerentes(endereco.numero, encontrado.house_number);
  } else {
    detalhes.numeroConfirmado = false;
  }

  const ruaConfirmada = detalhes.logradouroLocalizado !== false;
  const numeroConfirmado = detalhes.numeroConfirmado === true;
  const contextoCoerente = ufOsmCoerente !== false && cidadeOsmCoerente !== false;

  let resultado;
  if (ruaConfirmada && numeroConfirmado && contextoCoerente) {
    resultado = {
      status: STATUS.VALID,
      mensagem: 'Endereço confirmado: CEP, rua e número localizados.',
      fonte: 'viacep+nominatim',
      confirmado: {
        cep: cepLimpo, logradouro: encontrado.road || oficial.logradouro, numero: encontrado.house_number,
        bairro: oficial.bairro, cidade: cidadeOsm || oficial.localidade, uf: encontrado.state || oficial.uf,
      },
      detalhes,
    };
  } else if (ruaConfirmada && contextoCoerente) {
    resultado = {
      status: STATUS.PARTIALLY_VALIDATED,
      mensagem: 'Rua e cidade confirmadas, mas não foi possível confirmar especificamente o número informado. O endereço será salvo mesmo assim.',
      fonte: 'viacep+nominatim',
      confirmado: {
        cep: cepLimpo, logradouro: encontrado.road || oficial.logradouro,
        bairro: oficial.bairro, cidade: cidadeOsm || oficial.localidade, uf: encontrado.state || oficial.uf,
      },
      detalhes,
    };
  } else {
    resultado = {
      status: STATUS.PARTIALLY_VALIDATED,
      mensagem: 'CEP confirmado, mas o mapa devolveu um local que não bate totalmente com a rua/cidade informada. Confira os dados antes de continuar.',
      fonte: 'viacep+nominatim',
      confirmado: { cep: cepLimpo, bairro: oficial.bairro, cidade: oficial.localidade, uf: oficial.uf },
      detalhes,
    };
  }

  gravarCache(chave, resultado);
  return resultado;
}

module.exports = { validarExistenciaEndereco, STATUS, _internos: { normalizarTexto, normalizarLogradouro, textoCoerente, logradouroCoerente, numerosCoerentes, normalizarCep } };
