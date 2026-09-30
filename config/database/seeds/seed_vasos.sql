-- Vasos & Cachepôs
INSERT IGNORE INTO produtos
  (categoria_id, nome, slug, descricao, preco, preco_promo, estoque, imagem, imagem_2, imagem_3, destaque, ativo)
VALUES
  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Cerâmica Rosa', 'vaso-ceramica-rosa',
    'Vaso de cerâmica artesanal em tom rosado suave, com acabamento esmaltado de alta qualidade. Ideal para plantas de pequeno e médio porte, combina perfeitamente com decorações modernas, boho e escandinavas. Possui furo de drenagem e prato incluso. Produzido por artesãos brasileiros com argila de alto grau cerâmico.',
    85.00, 65.00, 14, 'produtos-fotos/vaso-ceramica-rosa-1.webp', 'produtos-fotos/vaso-ceramica-rosa-2.webp', 'produtos-fotos/vaso-ceramica-rosa-3.webp', 1, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Cimento Rústico', 'vaso-cimento-rustico',
    'Vaso de cimento rústico produzido artesanalmente, com textura natural única em cada peça. Resistente a intempéries, pode ser usado em ambientes internos e externos. Seu peso garante estabilidade para plantas maiores. A porosidade do cimento favorece a aeração das raízes, contribuindo para a saúde da planta.',
    70.00, 50.00, 20, 'produtos-fotos/vaso-cimento-rustico-1.webp', 'produtos-fotos/vaso-cimento-rustico-2.webp', 'produtos-fotos/vaso-cimento-rustico-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Suspenso Macramê', 'vaso-suspenso-macrame',
    'Suporte de macramê artesanal feito à mão com cordas de algodão cru, acompanha vaso de cerâmica de 14cm. Perfeito para samambaias, pothos e plantas pendentes. Cria charme e amplitude visual em qualquer cômodo. Resistente e fácil de instalar em teto ou parede.',
    100.00, 80.00, 13, 'produtos-fotos/vaso-suspenso-macrame-1.webp', 'produtos-fotos/vaso-suspenso-macrame-2.webp', 'produtos-fotos/vaso-suspenso-macrame-3.webp', 1, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Vidro Transparente', 'vaso-vidro-transparente',
    'Vaso de vidro borossilicato transparente, ideal para cultivo hidropônico e exibição das raízes das plantas. Design minimalista que se adapta a qualquer estilo de decoração. Inclui suporte de metal dourado. Perfeito para orquídeas, cactus e suculentas em ambientes iluminados.',
    60.00, 45.00, 18, 'produtos-fotos/vaso-vidro-transparente-1.webp', 'produtos-fotos/vaso-vidro-transparente-2.webp', 'produtos-fotos/vaso-vidro-transparente-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Concreto Geométrico', 'vaso-concreto-geometrico',
    'Vaso de concreto com design geométrico moderno, produzido com molde exclusivo. Ideal para suculentas, cactos e plantas de pequeno porte. Sua forma angular traz sofisticação a mesas, estantes e bancadas. Resistente e durável, com acabamento liso ou texturizado disponível.',
    85.00, 68.00, 17, 'produtos-fotos/vaso-concreto-geometrico-1.webp', 'produtos-fotos/vaso-concreto-geometrico-2.webp', 'produtos-fotos/vaso-concreto-geometrico-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Cerâmica Azul', 'vaso-ceramica-azul',
    'Vaso de cerâmica esmaltada na cor azul cobalto, produzido artesanalmente com argila de alta qualidade. O acabamento vitrificado garante durabilidade e facilidade de limpeza. Ideal para plantas de médio porte como samambaias, orquídeas e pothos. Possui furo de drenagem e prato incluso. Cada peça é única, com pequenas variações que evidenciam o caráter artesanal.',
    115.00, 95.00, 19, 'produtos-fotos/vaso-ceramica-azul-1.webp', 'produtos-fotos/vaso-ceramica-azul-2.webp', 'produtos-fotos/vaso-ceramica-azul-3.webp', 1, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Barro Tradicional', 'vaso-barro-tradicional',
    'O Vaso de Barro Tradicional é produzido por ceramistas brasileiros seguindo técnicas ancestrais. Sua porosidade natural favorece a aeração do solo e regula a umidade das raízes, criando condições ideais para o crescimento das plantas. Resistente ao sol e à chuva, é perfeito tanto para jardins externos quanto para ambientes internos com iluminação natural.',
    55.00, 40.00, 26, 'produtos-fotos/vaso-barro-tradicional-1.webp', 'produtos-fotos/vaso-barro-tradicional-2.webp', 'produtos-fotos/vaso-barro-tradicional-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso de Barro Artesanal', 'vaso-barro-artesanal',
    'Peça única feita à mão por artesãos do interior de São Paulo, usando barro extraído de jazidas naturais certificadas. O acabamento rústico e irregular é intencional — cada vaso é uma obra singular. A textura porosa do barro regula naturalmente a umidade do substrato, prevenindo o apodrecimento das raízes. Compatível com plantas de pequeno e médio porte.',
    60.00, 45.00, 22, 'produtos-fotos/vaso-barro-artesanal-1.webp', 'produtos-fotos/vaso-barro-artesanal-2.webp', 'produtos-fotos/vaso-barro-artesanal-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Esmaltado', 'vaso-esmaltado',
    'Vaso de cerâmica com revestimento de esmalte vitrificado que garante um acabamento brilhante e sofisticado. A superfície lisa facilita a limpeza e resiste a manchas. Disponível em tonalidades neutras que harmonizam com qualquer decoração. Ótimo para cactos, suculentas e plantas tropicais de pequeno porte. Inclui prato de mesmo material.',
    90.00, 72.00, 23, 'produtos-fotos/vaso-esmaltado-1.webp', 'produtos-fotos/vaso-esmaltado-2.webp', 'produtos-fotos/vaso-esmaltado-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Cerâmica Decorado', 'vaso-ceramica-decorado',
    'Vaso de cerâmica com estampas decorativas pintadas à mão, inspiradas na flora brasileira. Cada detalhe é aplicado por artistas ceramistas, tornando cada peça única. A cerâmica de alta temperatura garante resistência a trincas e variações de umidade. Ideal para orquídeas, bromélias e plantas de flores. Acompanha prato decorativo da mesma linha.',
    95.00, 75.00, 16, 'produtos-fotos/vaso-ceramica-decorado-1.webp', 'produtos-fotos/vaso-ceramica-decorado-2.webp', 'produtos-fotos/vaso-ceramica-decorado-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Geométrico', 'vaso-geometrico',
    'Vaso com design geométrico contemporâneo, produzido em fibra de concreto composta — mais leve que o concreto tradicional e igualmente resistente. Suas faces angulares criam jogos de sombra e luz que transformam a planta em uma escultura viva. Perfeito para cactos, suculentas e plantas de folhagem. Drena adequadamente e suporta uso externo.',
    85.00, 68.00, 19, 'produtos-fotos/vaso-geometrico-1.webp', 'produtos-fotos/vaso-geometrico-2.webp', 'produtos-fotos/vaso-geometrico-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Minimalista', 'vaso-minimalista',
    'Vaso de perfil baixo com acabamento matte fosco em tom neutro, pensado para quem valoriza o minimalismo na decoração. A ausência de ornamentos coloca toda a atenção na planta. Ideal para suculentas, cactos e ervas aromáticas cultivadas em bancadas e estantes. O acabamento fosco resiste a impressões digitais e não reflete luz, mantendo o visual sempre limpo.',
    78.00, 60.00, 21, 'produtos-fotos/vaso-minimalista-1.webp', 'produtos-fotos/vaso-minimalista-2.webp', 'produtos-fotos/vaso-minimalista-3.webp', 0, 1),

  ((SELECT id FROM categorias WHERE slug = 'vasos'),
    'Vaso Autoirrigável Transparente', 'vaso-autoirrigavel-transparente',
    'Vaso autoirrigável com reservatório de água visível pela parede transparente em acrílico de alta resistência. O sistema de irrigação por capilaridade fornece água às raízes conforme a necessidade da planta, podendo durar de 7 a 21 dias sem reabastecimento — ideal para quem viaja ou esquece de regar. O indicador de nível evita tanto o encharcamento quanto a seca. Recomendado para orquídeas, pothos e samambaias.',
    115.00, 95.00, 30, 'produtos-fotos/vaso-autoirrigavel-transparente-1.webp', 'produtos-fotos/vaso-autoirrigavel-transparente-2.webp', 'produtos-fotos/vaso-autoirrigavel-transparente-3.webp', 1, 1);
