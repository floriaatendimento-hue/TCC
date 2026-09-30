'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Uso: node scripts/aplicar-sql.js <caminho-do-arquivo.sql>');
  process.exit(1);
}

const caminhoCompleto = path.resolve(process.cwd(), arquivo);
if (!fs.existsSync(caminhoCompleto)) {
  console.error(`Arquivo não encontrado: ${caminhoCompleto}`);
  process.exit(1);
}

const { montarConfigBanco: montarConfig } = require('../config/dbConfig');

async function run() {
  const config = montarConfig();
  console.log(`Conectando em ${config.user}@${config.host}:${config.port} (banco: ${config.database})…`);

  const conn = await mysql.createConnection({
    ...config,
    multipleStatements: true,
    connectTimeout: 15000,
  });

  const sql = fs.readFileSync(caminhoCompleto, 'utf8');
  console.log(`Executando ${path.basename(caminhoCompleto)}…`);

  try {
    await conn.query(sql);
    console.log('✅  Concluído com sucesso.');
  } catch (err) {
    console.error('❌  Erro ao executar o SQL:');
    console.error(`    ${err.code || ''} ${err.message}`);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('❌  Não foi possível conectar ao banco:', err.message);
  console.error('    Confira DB_HOST / DB_USER / DB_PASSWORD / DB_NAME no seu .env.');
  process.exit(1);
});
