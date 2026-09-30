INSERT IGNORE INTO produtos
  (categoria_id, nome, slug, descricao, preco, estoque, imagem, destaque, criado_em, pouca_luz, pet_friendly)
VALUES
  ((SELECT id FROM categorias WHERE slug = 'plantas'),
    'Espada-de-São-Jorge', 'espadadesaojorge',
    'Planta extremamente resistente, purifica o ar e tolera baixa luminosidade.',
    35.00, 40, 'sansevieria.png', 0, '2025-02-10 10:00:00', 1, 0),

  ((SELECT id FROM categorias WHERE slug = 'plantas'),
    'Manjericão', 'manjericao',
    'Erva aromática indispensável na culinária italiana, exige sol pleno.',
    100.00, 40, 'manjericao.jpg', 0, '2025-02-12 10:00:00', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'plantas'),
    'Singônio (Syngonium)', 'singonio',
    'Trepadeira de folhas em forma de seta, fácil cultivo e purifica o ar.',
    45.00, 40, 'singonio.png', 0, '2025-02-14 10:00:00', 1, 0),

  ((SELECT id FROM categorias WHERE slug = 'plantas'),
    'Zamioculca (ZZ Plant)', 'zamioculca',
    'Planta quase indestrutível, tolera esquecimento de rega e pouca luz.',
    72.00, 35, 'Zamioculca.png', 0, '2025-02-16 10:00:00', 1, 0),

  ((SELECT id FROM categorias WHERE slug = 'plantas'),
    'Jiboia (Philodendron)', 'philodendron',
    'Trepadeira tropical de folhas cordiformes, ideal para iniciantes.',
    59.90, 35, 'Philodendron.png', 0, '2025-02-18 10:00:00', 1, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Cerâmica Rosa', 'vaso-ceramica-rosa',
    'Vaso de cerâmica esmaltada em rosa, acabamento artesanal.',
    65.00, 22, 'produtos-fotos/vaso-ceramica-rosa-1.webp', 0, '2025-02-20 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Cimento Rústico', 'vaso-cimento-rustico',
    'Vaso de cimento com textura rústica, resistente a intempéries.',
    50.00, 30, 'produtos-fotos/vaso-cimento-rustico-1.webp', 0, '2025-02-21 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Suspenso Macramê', 'vaso-suspenso-macrame',
    'Suporte de macramê artesanal para plantas pendentes.',
    80.00, 25, 'produtos-fotos/vaso-suspenso-macrame-1.webp', 0, '2025-02-22 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Vidro Transparente', 'vaso-vidro-transparente',
    'Vaso de vidro borossilicato, ideal para cultivo hidropônico.',
    45.00, 28, 'produtos-fotos/vaso-vidro-transparente-1.webp', 0, '2025-02-23 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Concreto Geométrico', 'vaso-concreto-geometrico',
    'Vaso de concreto com design geométrico moderno.',
    68.00, 20, 'produtos-fotos/vaso-concreto-geometrico-1.webp', 0, '2025-02-24 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Esmaltado', 'vaso-esmaltado',
    'Vaso com esmalte vitrificado de alta durabilidade.',
    72.00, 18, 'produtos-fotos/vaso-esmaltado-1.webp', 0, '2025-02-25 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Cerâmica Decorado', 'vaso-ceramica-decorado',
    'Vaso de cerâmica premium com design decorativo exclusivo.',
    75.00, 20, 'produtos-fotos/vaso-ceramica-decorado-1.webp', 0, '2025-02-26 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Geométrico', 'vaso-geometrico',
    'Vaso de concreto leve com formas geométricas modernas.',
    68.00, 20, 'produtos-fotos/vaso-geometrico-1.webp', 0, '2025-02-27 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Minimalista', 'vaso-minimalista',
    'Vaso de cerâmica matte com design clean e minimalista.',
    60.00, 18, 'produtos-fotos/vaso-minimalista-1.webp', 0, '2025-02-28 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Barro Artesanal', 'vaso-barro-artesanal',
    'Vaso de barro feito à mão, acabamento artesanal nobre.',
    45.00, 26, 'produtos-fotos/vaso-barro-artesanal-1.webp', 0, '2025-03-01 10:00:00', 0, 0),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Decorativo Marrom', 'vaso-decorativo-marrom',
    'Vaso decorativo em polietileno, leve e resistente para uso interno e externo.',
    55.99, 30, 'produtos-fotos/vaso-decorativo-marrom-1.webp', 1, '2025-03-02 10:00:00', 0, 0);

UPDATE produtos SET slug_pagina = 'detalhes'    WHERE slug = 'comigo-ninguem-pode' AND (slug_pagina IS NULL OR slug_pagina = '');
UPDATE produtos SET slug_pagina = 'costeladeadao' WHERE slug = 'costela-de-adao'    AND (slug_pagina IS NULL OR slug_pagina = '');
UPDATE produtos SET slug_pagina = 'detalhesv'    WHERE slug = 'vaso-decorativo-marrom' AND (slug_pagina IS NULL OR slug_pagina = '');
