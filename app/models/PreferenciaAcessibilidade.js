'use strict';

const db = require('../../config/db');

const PADRAO = Object.freeze({
  tamanho_fonte: 'normal',
  espacamento_texto: 'normal',
  alto_contraste: false,
  reduzir_movimento: false,
  destacar_links: false,
  destacar_foco: false,
  interface_simplificada: false,
  otimizar_leitor_tela: false,
  libras_ativo: false,
  pausar_midia_automatica: false,
});

function paraApi(linha) {
  if (!linha) return { ...PADRAO };
  return {
    tamanho_fonte: linha.tamanho_fonte,
    espacamento_texto: linha.espacamento_texto,
    alto_contraste: !!linha.alto_contraste,
    reduzir_movimento: !!linha.reduzir_movimento,
    destacar_links: !!linha.destacar_links,
    destacar_foco: !!linha.destacar_foco,
    interface_simplificada: !!linha.interface_simplificada,
    otimizar_leitor_tela: !!linha.otimizar_leitor_tela,
    libras_ativo: !!linha.libras_ativo,
    pausar_midia_automatica: !!linha.pausar_midia_automatica,
  };
}

class PreferenciaAcessibilidade {
  static async buscar(usuarioId) {
    const [rows] = await db.query(
      'SELECT * FROM preferencias_acessibilidade WHERE usuario_id = ?',
      [usuarioId]
    );
    return paraApi(rows[0]);
  }

  static async salvar(usuarioId, campos) {
    const valores = { ...PADRAO, ...campos };
    await db.query(
      `INSERT INTO preferencias_acessibilidade
         (usuario_id, tamanho_fonte, espacamento_texto, alto_contraste, reduzir_movimento,
          destacar_links, destacar_foco, interface_simplificada, otimizar_leitor_tela,
          libras_ativo, pausar_midia_automatica)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tamanho_fonte = VALUES(tamanho_fonte),
         espacamento_texto = VALUES(espacamento_texto),
         alto_contraste = VALUES(alto_contraste),
         reduzir_movimento = VALUES(reduzir_movimento),
         destacar_links = VALUES(destacar_links),
         destacar_foco = VALUES(destacar_foco),
         interface_simplificada = VALUES(interface_simplificada),
         otimizar_leitor_tela = VALUES(otimizar_leitor_tela),
         libras_ativo = VALUES(libras_ativo),
         pausar_midia_automatica = VALUES(pausar_midia_automatica)`,
      [
        usuarioId, valores.tamanho_fonte, valores.espacamento_texto,
        valores.alto_contraste ? 1 : 0, valores.reduzir_movimento ? 1 : 0,
        valores.destacar_links ? 1 : 0, valores.destacar_foco ? 1 : 0,
        valores.interface_simplificada ? 1 : 0, valores.otimizar_leitor_tela ? 1 : 0,
        valores.libras_ativo ? 1 : 0, valores.pausar_midia_automatica ? 1 : 0,
      ]
    );
    return paraApi(valores);
  }

  static async salvarCampo(usuarioId, campo, valor) {
    const COLUNAS_VALIDAS = Object.keys(PADRAO);
    if (!COLUNAS_VALIDAS.includes(campo)) {
      throw new Error(`Campo de acessibilidade inválido: ${campo}`);
    }
    const atual = await PreferenciaAcessibilidade.buscar(usuarioId);
    atual[campo] = valor;
    return PreferenciaAcessibilidade.salvar(usuarioId, atual);
  }

  static async restaurarPadrao(usuarioId) {
    return PreferenciaAcessibilidade.salvar(usuarioId, PADRAO);
  }

  static valoresPadrao() {
    return { ...PADRAO };
  }
}

module.exports = PreferenciaAcessibilidade;
