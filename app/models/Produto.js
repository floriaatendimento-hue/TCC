'use strict';

const db = require('../../config/db');

class Produto {
  // Listagens

  static async findAll({ limite = 50, offset = 0 } = {}) {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
        WHERE p.ativo = 1
        ORDER BY p.nome
        LIMIT ? OFFSET ?`,
      [limite, offset]
    );
    return rows;
  }

  static async findByCategoria(slug, { limite = 50, offset = 0, subcategoriaSlug = null } = {}) {
    const params = [slug];
    let filtroSub = '';
    if (subcategoriaSlug) {
      filtroSub = 'AND sc.slug = ?';
      params.push(subcategoriaSlug);
    }
    params.push(limite, offset);
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN subcategorias sc ON sc.id = p.subcategoria_id AND sc.categoria_id = c.id
        WHERE c.slug = ? AND c.ativa = 1 AND p.ativo = 1 ${filtroSub}
        ORDER BY p.nome
        LIMIT ? OFFSET ?`,
      params
    );
    return rows;
  }

  static async findAgrupadosPorSubcategoria(categoriaSlug, { limitePorSubcategoria = 30 } = {}) {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome,
              s.id AS subcategoria_id, s.nome AS subcategoria_nome, s.slug AS subcategoria_slug
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
         JOIN subcategorias s ON s.id = p.subcategoria_id AND s.categoria_id = c.id
        WHERE c.slug = ? AND c.ativa = 1 AND p.ativo = 1 AND s.ativa = 1
        ORDER BY s.ordem ASC, s.nome ASC, p.nome ASC`,
      [categoriaSlug]
    );

    const grupos = new Map();
    for (const row of rows) {
      if (!grupos.has(row.subcategoria_id)) {
        grupos.set(row.subcategoria_id, {
          subcategoria: { id: row.subcategoria_id, nome: row.subcategoria_nome, slug: row.subcategoria_slug },
          produtos: [],
        });
      }
      const grupo = grupos.get(row.subcategoria_id);
      if (grupo.produtos.length < limitePorSubcategoria) grupo.produtos.push(row);
    }
    return Array.from(grupos.values());
  }

  static async findDestaque(limite = 12) {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
        WHERE p.ativo = 1 AND p.destaque = 1
        ORDER BY p.criado_em DESC
        LIMIT ?`,
      [limite]
    );
    return rows;
  }

  static async buscarMaisVendidos({ limite = 10, categoriaSlug = null } = {}) {
    const params = [];
    let filtroCategoria = '';
    if (categoriaSlug) {
      filtroCategoria = 'AND c.slug = ?';
      params.push(categoriaSlug);
    }
    params.push(Number(limite));
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome,
              v.total_vendido, v.ultima_venda
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
         JOIN (
           SELECT i.produto_id, SUM(i.quantidade) AS total_vendido, MAX(ped.criado_em) AS ultima_venda
             FROM itens_pedido i
             JOIN pedidos ped ON ped.id = i.pedido_id
            WHERE ped.status_pagamento = 'aprovado' AND i.produto_id IS NOT NULL
            GROUP BY i.produto_id
         ) v ON v.produto_id = p.id
        WHERE p.ativo = 1 AND c.ativa = 1 ${filtroCategoria}
        ORDER BY v.total_vendido DESC, v.ultima_venda DESC, p.criado_em DESC
        LIMIT ?`,
      params
    );
    return rows.map(r => ({ ...r, total_vendido: Number(r.total_vendido) || 0 }));
  }

  static async findAllAdmin() {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug,
              s.nome AS subcategoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
        ORDER BY p.criado_em DESC`
    );
    return rows;
  }

  static async statsBasicos() {
    const [[row]] = await db.query(
      `SELECT
          COUNT(*)                                            AS total,
          SUM(ativo = 1)                                      AS ativos,
          SUM(estoque = 0)                                    AS sem_estoque,
          SUM(estoque > 0 AND estoque <= estoque_minimo)      AS estoque_baixo
         FROM produtos`
    );
    return {
      total:        Number(row.total)         || 0,
      ativos:       Number(row.ativos)        || 0,
      semEstoque:   Number(row.sem_estoque)   || 0,
      estoqueBaixo: Number(row.estoque_baixo) || 0,
    };
  }

  static async relatorioProdutosPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT p.id, p.nome, p.sku, p.preco, p.preco_promo, p.estoque, p.ativo, p.criado_em,
              c.nome AS categoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
        WHERE DATE(p.criado_em) BETWEEN ? AND ?
        ORDER BY p.criado_em DESC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({
      ...r,
      preco: Number(r.preco) || 0,
      preco_promo: r.preco_promo != null ? Number(r.preco_promo) : null,
      estoque: Number(r.estoque) || 0,
    }));
  }

  static async listaEstoqueBaixo(qtd = 5) {
    const [rows] = await db.query(
      `SELECT id, nome, slug, estoque, estoque_minimo
         FROM produtos
        WHERE estoque <= estoque_minimo
        ORDER BY estoque ASC, nome ASC
        LIMIT ?`,
      [qtd]
    );
    return rows;
  }

  // Busca unitária

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id = ? AND p.ativo = 1`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findByIdAdmin(id) {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome, s.nome AS subcategoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
        WHERE p.id = ?`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findBySlug(slug) {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
        WHERE p.slug = ? AND p.ativo = 1`,
      [slug]
    );
    return rows[0] ?? null;
  }

  static async findBySlugOuPagina(slug) {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug,
              s.nome AS subcategoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
        WHERE p.ativo = 1 AND (p.slug = ? OR p.slug_pagina = ?)
        LIMIT 1`,
      [slug, slug]
    );
    return rows[0] ?? null;
  }

  static async findFreteInfoBySlug(slug) {
    const [rows] = await db.query(
      `SELECT id, nome, slug, slug_pagina, preco, preco_promo,
              peso_g, altura_cm, largura_cm, comprimento_cm
         FROM produtos
        WHERE (slug = ? OR slug_pagina = ?) AND ativo = 1
        LIMIT 1`,
      [slug, slug]
    );
    return rows[0] ?? null;
  }

  static MAPA_CATEGORIAS_RELACIONADAS = {
    plantas:           ['vasos', 'adubos', 'ferramentas'],
    vasos:              ['plantas'],
    ferramentas:        ['adubos', 'controle-pragas'],
    adubos:             ['plantas', 'ferramentas'],
    'controle-pragas':  ['plantas', 'adubos'],
  };

  static async findRelacionados({ categoriaSlug, excluirSlug = '', limite = 8 }) {
    if (!categoriaSlug) return [];

    const categoriasAlvo = this.MAPA_CATEGORIAS_RELACIONADAS[categoriaSlug] ?? [categoriaSlug];
    const placeholders = categoriasAlvo.map(() => '?').join(', ');

    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug,
              COALESCE(r.media, 0) AS media_avaliacoes,
              COALESCE(r.total, 0) AS qtd_avaliacoes,
              CASE
                WHEN p.destaque = 1 THEN 'Mais vendida'
                WHEN p.criado_em >= (NOW() - INTERVAL 30 DAY) THEN 'Novo'
                ELSE NULL
              END AS selo
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN (
           SELECT produto_slug, ROUND(AVG(avaliacao), 1) AS media, COUNT(*) AS total
             FROM comentarios
            GROUP BY produto_slug
         ) r ON r.produto_slug = COALESCE(p.slug_pagina, p.slug)
        WHERE c.slug IN (${placeholders}) AND p.ativo = 1 AND p.slug <> ? AND p.estoque > 0
        ORDER BY p.destaque DESC, RAND()
        LIMIT ?`,
      [...categoriasAlvo, excluirSlug, Number(limite)]
    );
    return rows;
  }

  // Criação

  static async create({
    categoria_id, subcategoria_id, nome, slug, descricao,
    preco, preco_promo, estoque, estoque_minimo, imagem, tags, destaque, ativo, especificacoes,
    sku, marca, imagem_2, imagem_3, cuidados, variacoes, beneficios, como_utilizar, recomendacoes,
  }) {
    const [result] = await db.query(
      `INSERT INTO produtos
         (categoria_id, subcategoria_id, nome, slug, descricao, preco, preco_promo, estoque, estoque_minimo, imagem, tags, destaque, ativo, especificacoes,
          sku, marca, imagem_2, imagem_3, cuidados, variacoes, beneficios, como_utilizar, recomendacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoria_id,
        subcategoria_id || null,
        nome,
        slug,
        descricao  ?? null,
        preco,
        preco_promo ?? null,
        estoque    ?? 50,
        estoque_minimo ?? 5,
        imagem     ?? null,
        tags       ?? null,
        destaque   ? 1 : 0,
        ativo === false ? 0 : 1,
        especificacoes != null ? JSON.stringify(especificacoes) : null,
        sku        ?? null,
        marca      ?? null,
        imagem_2   ?? null,
        imagem_3   ?? null,
        cuidados   != null ? JSON.stringify(cuidados)  : null,
        variacoes  != null ? JSON.stringify(variacoes) : null,
        beneficios ?? null,
        como_utilizar ?? null,
        recomendacoes ?? null,
      ]
    );
    return result.insertId;
  }

  // Atualização

  static async update(id, campos) {
    const permitidos = [
      'nome', 'slug', 'descricao', 'preco', 'preco_promo',
      'estoque', 'estoque_minimo', 'imagem', 'tags', 'destaque', 'ativo', 'categoria_id',
      'subcategoria_id', 'especificacoes',
      'sku', 'marca', 'imagem_2', 'imagem_3', 'cuidados', 'variacoes',
      'beneficios', 'como_utilizar', 'recomendacoes',
    ];
    const camposJson = ['especificacoes', 'cuidados', 'variacoes'];
    const sets   = [];
    const values = [];

    for (const [k, v] of Object.entries(campos)) {
      if (permitidos.includes(k)) {
        sets.push(`${k} = ?`);
        if (camposJson.includes(k) && v != null) values.push(JSON.stringify(v));
        else if (k === 'subcategoria_id') values.push(v || null);
        else values.push(v === undefined ? null : v);
      }
    }

    if (!sets.length) return 0;

    values.push(id);
    const [result] = await db.query(
      `UPDATE produtos SET ${sets.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows;
  }

  // Remoção

  static async delete(id) {
    const [result] = await db.query(
      'UPDATE produtos SET ativo = 0 WHERE id = ?',
      [id]
    );
    return result.affectedRows;
  }

  // Busca

  static async search(q, limite = 20) {
    const termoOriginal = (q || '').trim();
    if (!termoOriginal) return [];

    const normalizado = termoOriginal
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const normalizadoPlural   = normalizado.endsWith('s') ? normalizado : normalizado + 's';
    const normalizadoSingular = normalizado.endsWith('s') ? normalizado.slice(0, -1) : normalizado;

    const [categoriaExata] = await db.query(
      `SELECT id FROM categorias
        WHERE LOWER(nome) IN (?, ?, ?) OR slug IN (?, ?, ?)
        LIMIT 1`,
      [normalizado, normalizadoPlural, normalizadoSingular,
       normalizado, normalizadoPlural, normalizadoSingular]
    );

    if (categoriaExata.length) {
      const [rows] = await db.query(
        `SELECT p.*, c.nome AS categoria_nome
           FROM produtos p
           JOIN categorias c ON c.id = p.categoria_id
          WHERE p.ativo = 1 AND p.categoria_id = ?
          ORDER BY p.destaque DESC, p.nome ASC
          LIMIT ?`,
        [categoriaExata[0].id, Number(limite)]
      );
      return rows;
    }

    const termo = `%${termoOriginal}%`;
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
        WHERE p.ativo = 1
          AND (p.nome LIKE ? OR p.descricao LIKE ? OR c.nome LIKE ? OR p.tags LIKE ?)
        ORDER BY
          CASE WHEN p.nome LIKE ? THEN 0 ELSE 1 END,
          p.destaque DESC,
          p.nome ASC
        LIMIT ?`,
      [termo, termo, termo, termo, termo, Number(limite)]
    );
    return rows;
  }

  static async buscarComFiltros({
    q = '', categoria = '', petFriendly = false, poucaLuz = false,
    limite = 60, offset = 0,
  } = {}) {
    const condicoes = ['p.ativo = 1'];
    const valores = [];

    if (categoria) {
      condicoes.push('c.slug = ?');
      valores.push(categoria);
    }

    const termo = String(q || '').trim();
    if (termo) {
      const like = `%${termo}%`;
      condicoes.push('(p.nome LIKE ? OR p.descricao LIKE ? OR p.tags LIKE ? OR c.nome LIKE ?)');
      valores.push(like, like, like, like);
    }

    if (petFriendly) condicoes.push('p.pet_friendly = 1');
    if (poucaLuz)    condicoes.push('p.pouca_luz = 1');

    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug
         FROM produtos p
         JOIN categorias c ON c.id = p.categoria_id
        WHERE ${condicoes.join(' AND ')}
        ORDER BY p.destaque DESC, p.nome ASC
        LIMIT ? OFFSET ?`,
      [...valores, Number(limite), Number(offset)]
    );
    return rows;
  }

  // Estoque

  static async decrementarEstoque(id, qtd = 1) {
    const [result] = await db.query(
      'UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?',
      [qtd, id, qtd]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Produto;
