'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

// Validação de variáveis obrigatórias
function validarVariaveis() {
  const erros = [];

  const temConfig = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

  if (!temConfig) {
    erros.push('Configure DB_HOST, DB_USER, DB_NAME e DB_PASSWORD no .env.');
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    console.warn(
      '⚠️   SESSION_SECRET não definida ou muito curta. ' +
      'Defina uma string longa e aleatória no .env.'
    );
  }

  if (erros.length) {
    erros.forEach(e => console.error('❌  ' + e));
  }
}

const { montarConfigBanco } = require('./dbConfig');

function montarConfig() {
  return {
    ...montarConfigBanco(),
    ssl: false,
  };
}

// Configuração do pool
function criarPoolConfig() {
  const base = montarConfig();
  return {
    ...base,
    charset:            'utf8mb4',
    connectionLimit:    Number(process.env.DB_POOL_LIMIT)      || 10,
    queueLimit:         Number(process.env.DB_POOL_QUEUE)      || 0,
    waitForConnections: true,
    enableKeepAlive:       true,
    keepAliveInitialDelay: 30_000,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT) || 10_000,
    dateStrings:       false,
    supportBigNumbers: true,
    bigNumberStrings:  false,
  };
}

let pool = null;
let tentativas = 0;
const MAX_TENTATIVAS  = 5;
const DELAY_INICIAL   = 2_000;  // ms

async function inicializar() {
  validarVariaveis();

  const config = criarPoolConfig();

  while (tentativas < MAX_TENTATIVAS) {
    try {
      pool = mysql.createPool(config);

      const conn = await pool.getConnection();
      const destino = `${config.database}@${config.host}:${config.port}`;

      console.log(`✅  Banco conectado — ${destino}`);
      console.log(`    Pool: ${config.connectionLimit} conexões máx., SSL: ${!!config.ssl}`);
      conn.release();

      pool.on('error', (err) => {
        console.error('⚠️   Erro no pool MySQL:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' ||
            err.code === 'ECONNRESET' ||
            err.code === 'ETIMEDOUT') {
          console.warn('     Tentando reconectar ao banco...');
          pool = null;
          tentativas = 0;
          setTimeout(inicializar, DELAY_INICIAL);
        }
      });

      return; // sucesso

    } catch (err) {
      tentativas++;
      pool = null;
      const delay = DELAY_INICIAL * tentativas;
      console.warn(
        `\n⚠️   Banco indisponível (tentativa ${tentativas}/${MAX_TENTATIVAS}): ${err.message}`
      );

      if (tentativas < MAX_TENTATIVAS) {
        console.warn(`     Retentando em ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error(
          '❌  Não foi possível conectar ao banco após várias tentativas.\n' +
          '     Verifique as variáveis DB_* no arquivo .env.\n' +
          '     O servidor vai funcionar sem banco até a próxima reconexão.\n'
        );
      }
    }
  }
}

inicializar();

const semBanco = (..._args) =>
  Promise.reject(
    new Error(
      'Banco de dados não conectado. ' +
      'Verifique as variáveis DB_* no .env e reinicie o servidor.'
    )
  );

const poolProxy = new Proxy({}, {
  get(_, prop) {
    if (!pool) return semBanco;
    const val = pool[prop];
    return typeof val === 'function' ? val.bind(pool) : val;
  },
});

module.exports = poolProxy;
