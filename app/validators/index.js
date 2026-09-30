'use strict';

const { body, param, query, validationResult } = require('express-validator');
const { numeroSimuladoValido, validadeValida } = require('../services/pagamento/cartao');
const Subcategoria = require('../models/Subcategoria');
const mpConfig = require('../../config/mercadoPago');

function cpfValido(cpfDigitos) {
  if (!/^\d{11}$/.test(cpfDigitos)) return false;
  if (/^(\d)\1{10}$/.test(cpfDigitos)) return false;

  const calcularDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const base = cpfDigitos.slice(0, 9);
  const d1 = calcularDigito(base);
  const d2 = calcularDigito(base + d1);
  return cpfDigitos === base + String(d1) + String(d2);
}

function cnpjValido(cnpjDigitos) {
  if (!/^\d{14}$/.test(cnpjDigitos)) return false;
  if (/^(\d)\1{13}$/.test(cnpjDigitos)) return false;

  const calcularDigito = (base, pesos) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base = cnpjDigitos.slice(0, 12);
  const d1 = calcularDigito(base, pesos1);
  const d2 = calcularDigito(base + d1, pesos2);
  return cnpjDigitos === base + String(d1) + String(d2);
}

function documentoFornecedorValido(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length === 11) return cpfValido(digitos);
  if (digitos.length === 14) return cnpjValido(digitos);
  return false;
}

const handleValidation = (req, res, next) => {
  const erros = validationResult(req);

  if (!erros.isEmpty()) {
    const isApi = req.xhr
      || req.originalUrl.startsWith('/api/')
      || (req.headers.accept  || '').includes('application/json')
      || (req.headers['content-type'] || '').includes('application/json');

    if (isApi) {
      const lista = erros.array();
      return res.status(422).json({
        ok:      false,
        message: lista[0]?.msg || 'Dados inválidos.',
        campo:   lista[0]?.path,
        errors:  lista,
      });
    }

    if (req.session) req.session.erros = erros.array();
    return res.redirect('back');
  }

  next();
};

// Login
const validarLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('O e-mail é obrigatório.')
    .isEmail().withMessage('Digite um e-mail válido.')
    .normalizeEmail(),

  body('senha')
    .notEmpty().withMessage('A senha é obrigatória.')
    .isLength({ min: 6 }).withMessage('A senha deve ter pelo menos 6 caracteres.'),

  handleValidation,
];

// Cadastro de usuário
const validarCadastro = [
  body('nome')
    .trim()
    .notEmpty().withMessage('O nome é obrigatório.')
    .isLength({ min: 2, max: 100 })
    .withMessage('O nome deve ter entre 2 e 100 caracteres.'),

  body('email')
    .trim()
    .notEmpty().withMessage('O e-mail é obrigatório.')
    .isEmail().withMessage('E-mail inválido.')
    .normalizeEmail(),

  body('cpf')
    .trim()
    .notEmpty().withMessage('O CPF é obrigatório.')
    .customSanitizer((v) => String(v).replace(/\D/g, ''))
    .custom((v) => cpfValido(v)).withMessage('CPF inválido.'),

  body('telefone')
    .trim()
    .notEmpty().withMessage('O telefone é obrigatório.')
    .custom((v) => /^\d{2}9\d{8}$/.test(String(v).replace(/\D/g, '')))
    .withMessage('Telefone inválido. Use o formato (11) 91234-5678.'),

  body('senha')
    .notEmpty().withMessage('A senha é obrigatória.')
    .isLength({ min: 12 }).withMessage('A senha deve ter pelo menos 12 caracteres.')
    .matches(/[a-z]/).withMessage('A senha deve conter letras minúsculas.')
    .matches(/[A-Z]/).withMessage('A senha deve conter letras maiúsculas.')
    .matches(/[0-9]/).withMessage('A senha deve conter ao menos um número.')
    .matches(/[^a-zA-Z0-9]/).withMessage('A senha deve conter ao menos um símbolo.'),

  body('confirmar')
    .notEmpty().withMessage('Confirme a senha.')
    .custom((value, { req }) => {
      if (value !== req.body.senha) throw new Error('As senhas não conferem.');
      return true;
    }),

  handleValidation,
];

// Recuperação de senha
const validarSolicitarRecuperacaoSenha = [
  body('email')
    .trim()
    .notEmpty().withMessage('O e-mail é obrigatório.')
    .isEmail().withMessage('Digite um e-mail válido.')
    .normalizeEmail(),

  handleValidation,
];

const { OTP_DIGITOS } = require('../models/OtpRecuperacaoSenha').constantes;
const validarVerificarOtp = [
  body('otp')
    .isString().withMessage('Digite o código de verificação.').bail()
    .matches(new RegExp(`^\\d{${OTP_DIGITOS}}$`)).withMessage(`Digite os ${OTP_DIGITOS} dígitos do código.`),

  handleValidation,
];

const validarRedefinirSenha = [
  body('novaSenha')
    .notEmpty().withMessage('A senha é obrigatória.')
    .isLength({ min: 12 }).withMessage('A senha deve ter pelo menos 12 caracteres.')
    .matches(/[a-z]/).withMessage('A senha deve conter letras minúsculas.')
    .matches(/[A-Z]/).withMessage('A senha deve conter letras maiúsculas.')
    .matches(/[0-9]/).withMessage('A senha deve conter ao menos um número.')
    .matches(/[^a-zA-Z0-9]/).withMessage('A senha deve conter ao menos um símbolo.'),

  body('confirmarSenha')
    .notEmpty().withMessage('Confirme a senha.')
    .custom((value, { req }) => {
      if (value !== req.body.novaSenha) throw new Error('As senhas não conferem.');
      return true;
    }),

  handleValidation,
];

// Suporte
const semMarcacaoNemQuebraDeLinha = (v) => !/[<>\r\n]/.test(v);

const CATEGORIAS_SUPORTE_VALIDAS = ['pedido', 'entrega', 'produto', 'pagamento', 'conta', 'outras'];

const validarSuporte = [
  body('nome')
    .trim()
    .notEmpty().withMessage('Informe seu nome.')
    .isLength({ min: 2, max: 120 }).withMessage('O nome deve ter entre 2 e 120 caracteres.')
    .custom(semMarcacaoNemQuebraDeLinha).withMessage('O nome contém caracteres não permitidos.'),

  body('email')
    .trim()
    .notEmpty().withMessage('Informe seu e-mail.')
    .isEmail().withMessage('Digite um e-mail válido.')
    .normalizeEmail(),

  body('assunto')
    .trim()
    .notEmpty().withMessage('Informe o assunto.')
    .isLength({ min: 3, max: 150 }).withMessage('O assunto deve ter entre 3 e 150 caracteres.')
    .custom(semMarcacaoNemQuebraDeLinha).withMessage('O assunto contém caracteres não permitidos.'),

  body('categoria')
    .optional({ checkFalsy: true })
    .isIn(CATEGORIAS_SUPORTE_VALIDAS).withMessage('Categoria inválida.'),

  body('mensagem')
    .trim()
    .notEmpty().withMessage('Escreva sua mensagem.')
    .isLength({ min: 10, max: 5000 }).withMessage('A mensagem deve ter entre 10 e 5000 caracteres.'),

  body('site').optional({ checkFalsy: true }).isString(),

  handleValidation,
];

// Cadastro / edição de produto
function parsearCamposJsonProduto(req, res, next) {
  for (const campo of ['especificacoes', 'cuidados', 'variacoes']) {
    const valor = req.body[campo];
    if (typeof valor === 'string' && valor.trim()) {
      try { req.body[campo] = JSON.parse(valor); }
      catch (e) { return res.status(400).json({ ok: false, message: `Campo "${campo}" inválido.` }); }
    } else if (valor === '' || valor === undefined) {
      req.body[campo] = null;
    }
  }
  for (const campo of ['destaque', 'ativo']) {
    if (campo in req.body) req.body[campo] = req.body[campo] === 'true' || req.body[campo] === '1' || req.body[campo] === true;
  }
  next();
}

const validarProduto = [
  body('nome')
    .trim()
    .notEmpty().withMessage('O nome do produto é obrigatório.')
    .isLength({ max: 120 }).withMessage('Nome muito longo (máx. 120 caracteres).'),

  body('sku')
    .trim()
    .notEmpty().withMessage('O SKU é obrigatório.')
    .isLength({ max: 40 }).withMessage('SKU muito longo (máx. 40 caracteres).')
    .matches(/^[A-Za-z0-9._-]+$/).withMessage('SKU deve conter apenas letras, números, ponto, hífen ou underline.'),

  body('marca')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 80 }).withMessage('Marca muito longa (máx. 80 caracteres).'),

  body('descricao')
    .trim()
    .notEmpty().withMessage('A descrição é obrigatória.')
    .isLength({ min: 30, max: 5000 }).withMessage('A descrição deve ter entre 30 e 5000 caracteres.'),

  body('beneficios')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 5000 }).withMessage('Benefícios muito longos.'),

  body('como_utilizar')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 5000 }).withMessage('"Como utilizar" muito longo.'),

  body('recomendacoes')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 5000 }).withMessage('Recomendações muito longas.'),

  body('preco')
    .notEmpty().withMessage('O preço é obrigatório.')
    .isFloat({ min: 0.01 }).withMessage('Preço inválido (mínimo R$ 0,01).')
    .toFloat(),

  body('preco_promo')
    .customSanitizer((value) => (value === '' || value === undefined ? undefined : value))
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Preço promocional inválido.')
    .custom((value, { req }) => {
      if (parseFloat(value) >= parseFloat(req.body.preco)) {
        throw new Error('O preço promocional deve ser menor que o preço original.');
      }
      return true;
    })
    .toFloat(),

  body('estoque')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 }).withMessage('Estoque deve ser um número inteiro não-negativo.')
    .toInt(),

  body('estoque_minimo')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 }).withMessage('Estoque mínimo deve ser um número inteiro não-negativo.')
    .toInt(),

  body('categoria_id')
    .notEmpty().withMessage('Selecione uma categoria.')
    .isInt({ min: 1 }).withMessage('Categoria inválida.')
    .toInt(),

  body('subcategoria_id')
    .notEmpty().withMessage('Selecione uma subcategoria.')
    .isInt({ min: 1 }).withMessage('Subcategoria inválida.')
    .toInt()
    .custom(async (subcategoriaId, { req }) => {
      const sub = await Subcategoria.findById(subcategoriaId);
      if (!sub || String(sub.categoria_id) !== String(req.body.categoria_id)) {
        throw new Error('A subcategoria selecionada não pertence à categoria escolhida.');
      }
      return true;
    }),

  body('especificacoes')
    .custom((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) {
        throw new Error('Informe ao menos uma especificação (ficha técnica).');
      }
      return true;
    }),

  body('cuidados')
    .custom((value) => {
      if (!Array.isArray(value) || value.length < 3) {
        throw new Error('Informe ao menos 3 cuidados (ícone, título e texto).');
      }
      const valido = value.every((c) => c && c.icone && c.titulo && c.texto);
      if (!valido) throw new Error('Cada cuidado precisa de ícone, título e texto.');
      return true;
    }),

  body('variacoes')
    .optional({ nullable: true })
    .custom((value) => {
      if (value == null) return true;
      if (!Array.isArray(value)) throw new Error('Variações em formato inválido.');
      const tiposValidos = ['cor', 'tamanho', 'modelo', 'volume'];
      const ROTULO_MAX = 40;
      const rotuloValido = (r) => typeof r === 'string' && r.trim().length > 0
        && r.length <= ROTULO_MAX && !/[<>]/.test(r);
      const valido = value.every((grupo) =>
        grupo && tiposValidos.includes(grupo.tipo)
        && rotuloValido(grupo.rotulo)
        && Array.isArray(grupo.opcoes) && grupo.opcoes.length > 0
        && grupo.opcoes.every((op) => op && rotuloValido(op.rotulo))
      );
      if (!valido) throw new Error('Cada grupo de variação precisa de um tipo e rótulo válidos (sem "<"/">", até 40 caracteres), e ao menos uma opção com rótulo válido.');
      return true;
    }),

  handleValidation,
];

function exigeTresImagensProdutoNovo(req, res, next) {
  const arquivos = req.files || {};
  const completo = ['imagem_1', 'imagem_2', 'imagem_3'].every((campo) => arquivos[campo] && arquivos[campo][0]);
  if (!completo) {
    return res.status(400).json({ ok: false, message: 'São necessárias 3 imagens do produto.' });
  }
  next();
}

// Cadastro / edição de categoria
const validarCategoria = [
  body('nome')
    .trim()
    .notEmpty().withMessage('O nome da categoria é obrigatório.')
    .isLength({ max: 80 }).withMessage('Nome muito longo (máx. 80 caracteres).'),

  body('slug')
    .trim()
    .notEmpty().withMessage('O slug é obrigatório.')
    .isLength({ max: 80 }).withMessage('Slug muito longo (máx. 80 caracteres).')
    .matches(/^[a-z0-9-]+$/).withMessage('Slug deve conter apenas letras minúsculas, números e hífens.'),

  body('descricao')
    .optional({ checkFalsy: true })
    .isLength({ max: 2000 }).withMessage('Descrição muito longa.'),

  handleValidation,
];

// Cadastro / edição de subcategoria
const validarSubcategoria = [
  body('categoria_id')
    .notEmpty().withMessage('Selecione a categoria.')
    .isInt({ min: 1 }).withMessage('Categoria inválida.')
    .toInt(),

  body('nome')
    .trim()
    .notEmpty().withMessage('O nome da subcategoria é obrigatório.')
    .isLength({ max: 80 }).withMessage('Nome muito longo (máx. 80 caracteres).'),

  body('slug')
    .trim()
    .notEmpty().withMessage('O slug é obrigatório.')
    .isLength({ max: 80 }).withMessage('Slug muito longo (máx. 80 caracteres).')
    .matches(/^[a-z0-9-]+$/).withMessage('Slug deve conter apenas letras minúsculas, números e hífens.'),

  body('descricao')
    .optional({ checkFalsy: true })
    .isLength({ max: 2000 }).withMessage('Descrição muito longa.'),

  handleValidation,
];

const validarCupom = [
  body('codigo')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 40 }).withMessage('Código muito longo (máx. 40 caracteres).')
    .matches(/^[A-Za-z0-9-]+$/).withMessage('Código deve conter apenas letras, números e hífens.')
    .toUpperCase(),

  body('tipo')
    .notEmpty().withMessage('Selecione o tipo de desconto.')
    .isIn(['percentual', 'fixo', 'frete_gratis']).withMessage('Tipo inválido.'),

  body('valor')
    .if(body('tipo').not().equals('frete_gratis'))
    .notEmpty().withMessage('Informe o valor do desconto.')
    .isFloat({ min: 0.01, max: 99999999.99 }).withMessage('Valor inválido.')
    .toFloat()
    .custom((valor, { req }) => {
      if (req.body.tipo === 'percentual' && valor > 100) {
        throw new Error('O desconto percentual não pode passar de 100%.');
      }
      return true;
    }),

  body('valor_minimo')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 99999999.99 }).withMessage('Valor mínimo inválido.')
    .toFloat(),

  body('limite_usos')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 1000000 }).withMessage('Limite de usos deve ser um número inteiro entre 1 e 1.000.000.')
    .toInt(),

  body('data_fim')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Data de término inválida.')
    .custom((value, { req }) => {
      if (req.body.data_inicio && value < req.body.data_inicio) {
        throw new Error('A data de término deve ser depois da data de início.');
      }
      return true;
    }),

  handleValidation,
];

const validarPromocao = [
  body('nome')
    .trim()
    .notEmpty().withMessage('Informe um nome para a promoção.')
    .isLength({ max: 120 }).withMessage('Nome muito longo (máx. 120 caracteres).'),

  body('tipo')
    .notEmpty().withMessage('Selecione o tipo de promoção.')
    .isIn(['categoria', 'subcategoria', 'produto', 'valor_minimo_produto', 'valor_minimo_carrinho', 'todos'])
    .withMessage('Tipo inválido.'),

  body('desconto_percentual')
    .notEmpty().withMessage('Informe o percentual de desconto.')
    .isFloat({ min: 0.01, max: 90 }).withMessage('Desconto deve ser entre 0,01% e 90%.')
    .toFloat(),

  body('categoria_id')
    .if(body('tipo').isIn(['categoria', 'subcategoria']))
    .notEmpty().withMessage('Selecione uma categoria.')
    .isInt({ min: 1 }).withMessage('Categoria inválida.')
    .toInt(),

  body('subcategoria_id')
    .if(body('tipo').equals('subcategoria'))
    .notEmpty().withMessage('Selecione uma subcategoria.')
    .isInt({ min: 1 }).withMessage('Subcategoria inválida.')
    .toInt()
    .custom(async (subcategoriaId, { req }) => {
      const sub = await Subcategoria.findById(subcategoriaId);
      if (!sub || String(sub.categoria_id) !== String(req.body.categoria_id)) {
        throw new Error('A subcategoria selecionada não pertence à categoria escolhida.');
      }
      return true;
    }),

  body('produtos')
    .if(body('tipo').equals('produto'))
    .custom((value) => {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('Selecione ao menos um produto.');
      }
      const valido = value.every((id) => Number.isInteger(Number(id)) && Number(id) > 0);
      if (!valido) throw new Error('Lista de produtos inválida.');
      return true;
    }),

  body('valor_minimo')
    .if(body('tipo').isIn(['valor_minimo_produto', 'valor_minimo_carrinho']))
    .notEmpty().withMessage('Informe o valor mínimo.')
    .isFloat({ min: 0.01 }).withMessage('Valor mínimo inválido.')
    .toFloat(),

  body('data_fim')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Data de término inválida.')
    .custom((value, { req }) => {
      if (req.body.data_inicio && value < req.body.data_inicio) {
        throw new Error('A data de término deve ser depois da data de início.');
      }
      return true;
    }),

  handleValidation,
];

// Cadastro / edição de banner
const validarBanner = [
  body('titulo')
    .trim()
    .notEmpty().withMessage('O título do banner é obrigatório.')
    .isLength({ max: 120 }).withMessage('Título muito longo (máx. 120 caracteres).'),

  body('subtitulo')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Subtítulo muito longo (máx. 200 caracteres).'),

  body('texto_botao')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 60 }).withMessage('Texto do botão muito longo (máx. 60 caracteres).'),

  body('link')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 255 }).withMessage('Link muito longo.'),

  body('ordem')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 }).withMessage('Ordem de exibição inválida.')
    .toInt(),

  body('data_inicio')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Data de início inválida.'),

  body('data_fim')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Data de término inválida.'),

  handleValidation,
];

const validarReordenarBanners = [
  body('ids')
    .isArray({ min: 1 }).withMessage('Lista de banners inválida.'),
  body('ids.*')
    .isInt({ min: 1 }).withMessage('ID de banner inválido.')
    .toInt(),
  handleValidation,
];

// Aplicar cupom no carrinho/checkout
const validarAplicarCupom = [
  body('codigo')
    .trim()
    .notEmpty().withMessage('Digite o código do cupom.')
    .isLength({ max: 40 }).withMessage('Código inválido.'),

  body('subtotal')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Subtotal inválido.')
    .toFloat(),

  handleValidation,
];

const validarCalcularFrete = [
  body('cep')
    .trim()
    .notEmpty().withMessage('Digite o CEP de entrega.')
    .customSanitizer(v => String(v).replace(/\D/g, ''))
    .isLength({ min: 8, max: 8 }).withMessage('Digite um CEP válido com 8 dígitos.'),

  body('slug')
    .trim()
    .notEmpty().withMessage('Produto inválido.')
    .isLength({ max: 120 }).withMessage('Produto inválido.'),

  body('quantidade')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 999 }).withMessage('Quantidade inválida.')
    .toInt(),

  handleValidation,
];

const validarRespostaAvaliacao = [
  body('resposta')
    .trim()
    .notEmpty().withMessage('Escreva uma resposta antes de enviar.')
    .isLength({ max: 1000 }).withMessage('Resposta muito longa (máx. 1000 caracteres).'),

  handleValidation,
];

// Configurações da loja
const temCampo = (chave) => (value, { req }) => Object.prototype.hasOwnProperty.call(req.body, chave);

const validarConfiguracoes = [
  body('loja_nome')
    .if(temCampo('loja_nome'))
    .trim()
    .notEmpty().withMessage('O nome da loja é obrigatório.')
    .isLength({ max: 80 }).withMessage('Nome muito longo.'),

  body('loja_email')
    .if(temCampo('loja_email'))
    .trim()
    .notEmpty().withMessage('O e-mail de contato é obrigatório.')
    .isEmail().withMessage('E-mail inválido.'),

  body('telefone_exibicao')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 30 }).withMessage('Telefone muito longo.'),

  body('telefone_e164')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 20 }).withMessage('Telefone muito longo.'),

  body('whatsapp_numero')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 20 }).withMessage('Número de WhatsApp muito longo.'),

  body('whatsapp_mensagem')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 300 }).withMessage('Mensagem muito longa.'),

  body('whatsapp_mensagem_suporte')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 300 }).withMessage('Mensagem muito longa.'),

  body('facebook')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 200 }).withMessage('Link do Facebook muito longo.'),

  body('instagram')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 200 }).withMessage('Link do Instagram muito longo.'),

  body('frete_padrao')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Frete padrão inválido.'),

  body('frete_gratis_acima')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Valor de frete grátis inválido.'),

  body('cep_origem')
    .optional({ checkFalsy: true })
    .customSanitizer((v) => String(v).replace(/\D/g, ''))
    .isLength({ min: 8, max: 8 }).withMessage('CEP de origem inválido. Use 8 dígitos.'),

  body('uf_origem')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 2 }).withMessage('UF de origem inválida.')
    .isAlpha().withMessage('UF de origem inválida.')
    .toUpperCase(),

  body('cidade_origem')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Cidade de origem muito longa.'),

  body('bairro_origem')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Bairro de origem muito longo.'),

  body('logradouro_origem')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Logradouro de origem muito longo.'),

  body('numero_origem')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Número de origem muito longo.'),

  body('ufs_entrega_permitidas')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[A-Za-z]{2}(,[A-Za-z]{2})*$/).withMessage('Lista de UFs de entrega inválida.'),

  handleValidation,
];

// Movimentação de estoque
const validarMovimentacaoEstoque = [
  body('produto_id')
    .notEmpty().withMessage('Selecione um produto.')
    .isInt({ min: 1 }).withMessage('Produto inválido.')
    .toInt(),

  body('tipo')
    .notEmpty().withMessage('Selecione o tipo de movimentação.')
    .isIn(['entrada', 'saida', 'ajuste']).withMessage('Tipo inválido.'),

  body('quantidade')
    .notEmpty().withMessage('Informe a quantidade.')
    .isInt({ min: 0, max: 1000000000 }).withMessage('Quantidade deve ser um número inteiro entre 0 e 1.000.000.000.')
    .toInt(),

  body('motivo')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 255 }).withMessage('Motivo muito longo (máx. 255 caracteres).'),

  handleValidation,
];

const validarParamId = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID inválido.')
    .toInt(),

  handleValidation,
];

// Parâmetros de busca / paginação
const validarBusca = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Busca muito longa (máx. 100 caracteres).'),

  query('pagina')
    .optional()
    .isInt({ min: 1 }).withMessage('Número de página inválido.')
    .toInt(),

  handleValidation,
];

// Endereço
const validarEndereco = [
  body('rotulo')
    .trim()
    .notEmpty().withMessage('Escolha um título para o endereço.')
    .isLength({ max: 60 }).withMessage('Título muito longo (máx. 60 caracteres).'),

  body('destinatario')
    .trim()
    .notEmpty().withMessage('Informe o nome de quem vai receber a entrega.')
    .isLength({ max: 120 }).withMessage('Nome muito longo (máx. 120 caracteres).'),

  body('telefone')
    .trim()
    .notEmpty().withMessage('Informe um telefone para contato da entrega.')
    .isLength({ min: 8, max: 20 }).withMessage('Telefone inválido.'),

  body('cep')
    .trim()
    .notEmpty().withMessage('CEP obrigatório.')
    .matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido (formato: 01310-100).'),

  body('logradouro')
    .trim().notEmpty().withMessage('Rua/logradouro obrigatório.')
    .isLength({ max: 180 }).withMessage('Endereço muito longo.'),

  body('numero')
    .trim().notEmpty().withMessage('Número obrigatório (use "S/N" se não houver).'),

  body('complemento')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 80 }).withMessage('Complemento muito longo.'),

  body('bairro')
    .trim().notEmpty().withMessage('Bairro obrigatório.'),

  body('cidade')
    .trim().notEmpty().withMessage('Cidade obrigatória.'),

  body('uf')
    .trim()
    .notEmpty().withMessage('Estado obrigatório.')
    .isLength({ min: 2, max: 2 }).withMessage('Use a sigla do estado (ex: SP).')
    .isAlpha().withMessage('Estado deve conter apenas letras.'),

  body('referencia')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 180 }).withMessage('Ponto de referência muito longo.'),

  handleValidation,
];

const validarEnderecoExistencia = [
  body('cep')
    .trim()
    .notEmpty().withMessage('CEP obrigatório.')
    .matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido (formato: 01310-100).'),

  body('logradouro')
    .trim().notEmpty().withMessage('Rua/logradouro obrigatório.')
    .isLength({ max: 180 }).withMessage('Endereço muito longo.'),

  body('numero')
    .trim().notEmpty().withMessage('Número obrigatório (use "S/N" se não houver).'),

  body('bairro')
    .trim().notEmpty().withMessage('Bairro obrigatório.'),

  body('cidade')
    .trim().notEmpty().withMessage('Cidade obrigatória.'),

  body('uf')
    .trim()
    .notEmpty().withMessage('Estado obrigatório.')
    .isLength({ min: 2, max: 2 }).withMessage('Use a sigla do estado (ex: SP).')
    .isAlpha().withMessage('Estado deve conter apenas letras.'),

  handleValidation,
];

// Status de pedido
const validarStatusPedido = [
  body('status')
    .notEmpty().withMessage('Status obrigatório.')
    .isIn(['preparando', 'enviado', 'em_transporte', 'saiu_entrega', 'entregue', 'cancelado'])
    .withMessage('Status inválido.'),

  body('observacao')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 255 }).withMessage('Observação muito longa (máx. 255 caracteres).'),

  handleValidation,
];

// Alterar status de pagamento
const validarStatusPagamentoAdmin = [
  body('status_pagamento')
    .notEmpty().withMessage('Status de pagamento obrigatório.')
    .isIn(['pendente', 'processando', 'aprovado', 'recusado', 'expirado', 'estornado'])
    .withMessage('Status de pagamento inválido.'),

  body('observacao')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 255 }).withMessage('Observação muito longa (máx. 255 caracteres).'),

  handleValidation,
];

// Cancelamento de pedido
const validarCancelamentoPedido = [
  body('motivo')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 255 }).withMessage('Motivo muito longo (máx. 255 caracteres).'),

  handleValidation,
];

// Listagem de produtos
const validarListagem = [
  query('categoria')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Parâmetro categoria muito longo.'),

  query('limite')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100.')
    .toInt(),

  query('pagina')
    .optional()
    .isInt({ min: 1 }).withMessage('Número de página inválido.')
    .toInt(),

  handleValidation,
];

// Busca filtrada
const validarBuscaFiltrada = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Busca muito longa (máx. 100 caracteres).'),

  query('categoria')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Parâmetro categoria muito longo.'),

  query('petFriendly')
    .optional()
    .isBoolean().withMessage('Parâmetro petFriendly inválido.')
    .toBoolean(),

  query('poucaLuz')
    .optional()
    .isBoolean().withMessage('Parâmetro poucaLuz inválido.')
    .toBoolean(),

  query('limite')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100.')
    .toInt(),

  handleValidation,
];

// Alterar senha
const validarAlterarSenha = [
  body('senha_atual')
    .notEmpty().withMessage('A senha atual é obrigatória.'),

  body('nova_senha')
    .notEmpty().withMessage('A nova senha é obrigatória.')
    .isLength({ min: 12 }).withMessage('A nova senha deve ter pelo menos 12 caracteres.')
    .matches(/[a-z]/).withMessage('A nova senha deve conter letras minúsculas.')
    .matches(/[A-Z]/).withMessage('A nova senha deve conter letras maiúsculas.')
    .matches(/[0-9]/).withMessage('A nova senha deve conter ao menos um número.')
    .matches(/[^a-zA-Z0-9]/).withMessage('A nova senha deve conter ao menos um símbolo.'),

  body('confirmar_nova')
    .notEmpty().withMessage('Confirme a nova senha.')
    .custom((value, { req }) => {
      if (value !== req.body.nova_senha) throw new Error('As senhas não conferem.');
      return true;
    }),

  handleValidation,
];

// Finalizar pedido
const validarFinalizarPedido = [
  body('itens')
    .isArray({ min: 1 }).withMessage('O carrinho não pode estar vazio.'),

  body('itens.*.nome')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Nome do produto muito longo.'),

  body('itens.*.link')
    .trim()
    .notEmpty().withMessage('Item do carrinho inválido — recarregue a página e tente novamente.')
    .isLength({ max: 300 }).withMessage('Item do carrinho inválido.'),

  body('itens.*.cor')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 60 }).withMessage('Nome da cor muito longo.'),

  body('itens.*.quantidade')
    .isInt({ min: 1, max: 9999 }).withMessage('Quantidade inválida (de 1 a 9999).')
    .toInt(),

  body('itens.*.preco')
    .isFloat({ min: 0 }).withMessage('Preço do item inválido.')
    .toFloat(),

  body('total')
    .notEmpty().withMessage('Total é obrigatório.')
    .isFloat({ min: 0 }).withMessage('Total inválido.')
    .toFloat(),

  body('forma_pagto')
    .notEmpty().withMessage('Selecione uma forma de pagamento.')
    .isIn(['credito', 'debito', 'pix', 'boleto'])
    .withMessage('Forma de pagamento inválida.'),

  body('numero_cartao')
    .if(body('forma_pagto').isIn(['credito', 'debito']))
    .if(() => !mpConfig.ativo)
    .customSanitizer(v => String(v || '').replace(/\D/g, ''))
    .custom(v => numeroSimuladoValido(v))
    .withMessage('Número de cartão inválido.'),

  body('nome_cartao')
    .if(body('forma_pagto').isIn(['credito', 'debito']))
    .if(() => !mpConfig.ativo)
    .trim()
    .notEmpty().withMessage('Informe o nome impresso no cartão.')
    .isLength({ max: 120 }).withMessage('Nome muito longo.'),

  body('validade_cartao')
    .if(body('forma_pagto').isIn(['credito', 'debito']))
    .if(() => !mpConfig.ativo)
    .trim()
    .matches(/^\d{2}\/\d{2}$/).withMessage('Validade inválida (use MM/AA).')
    .custom(v => validadeValida(v))
    .withMessage('Cartão vencido.'),

  body('cvv_cartao')
    .if(body('forma_pagto').isIn(['credito', 'debito']))
    .if(() => !mpConfig.ativo)
    .trim()
    .matches(/^\d{3,4}$/).withMessage('CVV inválido.'),

  body('cpf_boleto')
    .if(body('forma_pagto').equals('boleto'))
    .if(() => !mpConfig.ativo)
    .trim()
    .customSanitizer(v => String(v || '').replace(/\D/g, ''))
    .custom(v => cpfValido(v)).withMessage('CPF inválido.'),

  body('mp_token')
    .if(body('forma_pagto').isIn(['credito', 'debito']))
    .if(() => mpConfig.ativo)
    .trim().notEmpty().withMessage('Dados de pagamento do Mercado Pago ausentes — tente novamente.'),

  body('mp_payment_method_id')
    .if(() => mpConfig.ativo)
    .trim().notEmpty().withMessage('Método de pagamento do Mercado Pago não identificado.'),

  body('mp_installments')
    .if(body('forma_pagto').isIn(['credito', 'debito']))
    .if(() => mpConfig.ativo)
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 24 }).withMessage('Número de parcelas inválido.')
    .toInt(),

  body('mp_issuer_id')
    .if(() => mpConfig.ativo)
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 40 }).withMessage('Emissor de cartão inválido.'),

  body('mp_payer')
    .if(() => mpConfig.ativo)
    .optional()
    .isObject().withMessage('Dados do pagador inválidos.'),

  body('endereco_id')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Endereço de entrega inválido.')
    .toInt(),

  body('frete')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Frete inválido.')
    .toFloat(),

  body('desconto')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Desconto inválido.')
    .toFloat(),

  body('cupom')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 40 }).withMessage('Cupom inválido.'),

  body('parcelas')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 12 }).withMessage('Número de parcelas inválido.')
    .toInt(),

  body('observacoes')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 500 }).withMessage('Observações muito longas (máx. 500 caracteres).'),

  handleValidation,
];

const validarEnviarComprovanteEmail = [
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage('Digite um e-mail válido.')
    .normalizeEmail(),

  handleValidation,
];

// Comentário de produto
const validarComentario = [
  body('avaliacao')
    .notEmpty().withMessage('Selecione uma nota.')
    .isInt({ min: 1, max: 5 }).withMessage('A nota deve ser entre 1 e 5.')
    .toInt(),

  body('comentario')
    .trim()
    .notEmpty().withMessage('O comentário não pode estar vazio.')
    .isLength({ max: 1000 }).withMessage('Comentário muito longo (máx. 1000 caracteres).'),

  handleValidation,
];

// Observação interna de cliente
const validarNotaInterna = [
  body('nota')
    .trim()
    .notEmpty().withMessage('Escreva uma observação antes de salvar.')
    .isLength({ max: 2000 }).withMessage('Observação muito longa (máx. 2000 caracteres).'),

  handleValidation,
];

const validarNivelCliente = [
  body('nome')
    .trim()
    .notEmpty().withMessage('O nome do nível é obrigatório.')
    .isLength({ max: 60 }).withMessage('Nome muito longo (máx. 60 caracteres).'),

  body('valor_minimo')
    .customSanitizer((valor) => {
      if (typeof valor === 'number') return valor;
      const texto = String(valor ?? '').trim().replace(/[R$\s.]/g, '').replace(',', '.');
      const numero = Number(texto);
      return Number.isFinite(numero) ? numero : valor;
    })
    .notEmpty().withMessage('Informe o valor necessário para alcançar o nível.')
    .isFloat({ min: 0, max: 99999999.99 }).withMessage('O valor deve ser um número igual ou maior que zero.')
    .toFloat(),

  body('icone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 16 }).withMessage('Ícone inválido.'),

  body('descricao')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 255 }).withMessage('Descrição muito longa (máx. 255 caracteres).'),

  body('beneficios')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 2000 }).withMessage('Lista de benefícios muito longa (máx. 2000 caracteres).'),

  handleValidation,
];

// Acessibilidade
const CAMPOS_BOOLEANOS_ACESSIBILIDADE = [
  'alto_contraste', 'reduzir_movimento', 'destacar_links', 'destacar_foco',
  'interface_simplificada', 'otimizar_leitor_tela', 'libras_ativo', 'pausar_midia_automatica',
];

function corpoBooleano(campo) {
  return body(campo)
    .optional()
    .customSanitizer((v) => v === true || v === 'true' || v === 1 || v === '1')
    .isBoolean().withMessage(`Campo "${campo}" deve ser verdadeiro ou falso.`);
}

const validarPreferenciasAcessibilidade = [
  body('tamanho_fonte').optional().isIn(['normal', 'grande', 'muito_grande']).withMessage('Tamanho de fonte inválido.'),
  body('espacamento_texto').optional().isIn(['normal', 'aumentado', 'muito_aumentado']).withMessage('Espaçamento inválido.'),
  ...CAMPOS_BOOLEANOS_ACESSIBILIDADE.map(corpoBooleano),
  handleValidation,
];

const validarCampoUnicoAcessibilidade = [
  param('campo').isIn([
    'tamanho_fonte', 'espacamento_texto', ...CAMPOS_BOOLEANOS_ACESSIBILIDADE,
  ]).withMessage('Campo de acessibilidade inválido.'),
  body('valor')
    .custom((valor, { req }) => {
      const campo = req.params.campo;
      if (['tamanho_fonte'].includes(campo)) {
        if (!['normal', 'grande', 'muito_grande'].includes(valor)) throw new Error('Valor inválido para tamanho_fonte.');
      } else if (campo === 'espacamento_texto') {
        if (!['normal', 'aumentado', 'muito_aumentado'].includes(valor)) throw new Error('Valor inválido para espacamento_texto.');
      } else {
        if (typeof valor !== 'boolean' && valor !== 'true' && valor !== 'false' && valor !== true && valor !== false) {
          throw new Error(`Valor inválido para ${campo}.`);
        }
      }
      return true;
    }),
  handleValidation,
];

// Fornecedores
const validarFornecedor = [
  body('razao_social')
    .trim().notEmpty().withMessage('Informe a razão social.')
    .isLength({ max: 150 }).withMessage('Razão social muito longa (máx. 150 caracteres).'),

  body('nome_fantasia')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 150 }).withMessage('Nome fantasia muito longo (máx. 150 caracteres).'),

  body('documento')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 20 }).withMessage('Documento muito longo (máx. 20 caracteres).')
    .custom((v) => documentoFornecedorValido(v)).withMessage('Documento inválido — informe um CPF ou CNPJ válido.'),

  body('telefone')
    .optional({ checkFalsy: true })
    .trim().isLength({ min: 8, max: 20 }).withMessage('Telefone inválido.'),

  body('email')
    .optional({ checkFalsy: true })
    .trim().isEmail().withMessage('E-mail inválido.').isLength({ max: 190 }),

  body('endereco')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 255 }).withMessage('Endereço muito longo (máx. 255 caracteres).'),

  body('cep')
    .optional({ checkFalsy: true })
    .trim().matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido (formato: 01310-100).'),

  body('logradouro')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 180 }).withMessage('Endereço muito longo.'),

  body('numero')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 20 }).withMessage('Número muito longo.'),

  body('complemento')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 80 }).withMessage('Complemento muito longo.'),

  body('bairro')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 100 }).withMessage('Bairro muito longo.'),

  body('cidade')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 100 }).withMessage('Cidade muito longa.'),

  body('uf')
    .optional({ checkFalsy: true })
    .trim().isLength({ min: 2, max: 2 }).withMessage('Use a sigla do estado (ex: SP).')
    .isAlpha().withMessage('Estado deve conter apenas letras.'),

  body('observacoes')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 500 }).withMessage('Observações muito longas (máx. 500 caracteres).'),

  handleValidation,
];

const validarStatusFornecedor = [
  body('status')
    .notEmpty().withMessage('Status obrigatório.')
    .isIn(['ativo', 'inativo', 'bloqueado']).withMessage('Status inválido.'),
  handleValidation,
];

const validarCompra = [
  body('fornecedor_id')
    .notEmpty().withMessage('Selecione um fornecedor.')
    .isInt({ min: 1 }).withMessage('Fornecedor inválido.')
    .toInt(),

  body('data_compra')
    .notEmpty().withMessage('Informe a data da compra.')
    .isISO8601().withMessage('Data da compra inválida.'),

  body('forma_pagamento')
    .optional({ checkFalsy: true })
    .isIn(['a_vista', 'parcelado']).withMessage('Forma de pagamento inválida.'),

  body('vencimento')
    .if((value, { req }) => (req.body.forma_pagamento || 'a_vista') === 'a_vista')
    .notEmpty().withMessage('Informe o vencimento da conta a pagar.')
    .isISO8601().withMessage('Data de vencimento inválida.')
    .custom((v, { req }) => {
      if (req.body.data_compra && String(v).slice(0, 10) < String(req.body.data_compra).slice(0, 10)) {
        throw new Error('O vencimento não pode ser anterior à data da compra.');
      }
      return true;
    }),

  body('numero_parcelas')
    .if((value, { req }) => req.body.forma_pagamento === 'parcelado')
    .notEmpty().withMessage('Informe o número de parcelas.')
    .isInt({ min: 2, max: 60 }).withMessage('Número de parcelas deve ser entre 2 e 60.')
    .toInt(),

  body('primeiro_vencimento')
    .if((value, { req }) => req.body.forma_pagamento === 'parcelado')
    .notEmpty().withMessage('Informe o vencimento da 1ª parcela.')
    .isISO8601().withMessage('Data de vencimento inválida.')
    .custom((v, { req }) => {
      if (req.body.data_compra && String(v).slice(0, 10) < String(req.body.data_compra).slice(0, 10)) {
        throw new Error('O vencimento da 1ª parcela não pode ser anterior à data da compra.');
      }
      return true;
    }),

  body('intervalo_dias')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 365 }).withMessage('Intervalo entre parcelas deve ser entre 1 e 365 dias.')
    .toInt(),

  body('itens')
    .isArray({ min: 1 }).withMessage('A compra precisa ter ao menos um item.'),

  body('itens.*.descricao')
    .trim().notEmpty().withMessage('Todo item precisa de uma descrição.')
    .isLength({ max: 200 }).withMessage('Descrição do item muito longa (máx. 200 caracteres).'),

  body('itens.*.quantidade')
    .isFloat({ gt: 0, max: 999999999 }).withMessage('Quantidade do item inválida.')
    .toFloat(),

  body('itens.*.preco_unit')
    .isFloat({ min: 0, max: 9999999999.99 }).withMessage('Preço unitário do item inválido.')
    .toFloat(),

  body('itens.*.produto_id')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Produto inválido.').toInt(),

  body('itens.*.unidade')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 10 }).withMessage('Unidade muito longa (máx. 10 caracteres).'),

  body('itens.*.desconto')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 9999999999.99 }).withMessage('Desconto do item inválido.')
    .toFloat(),

  body('desconto')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 9999999999.99 }).withMessage('Desconto inválido.').toFloat(),

  body('frete')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 9999999999.99 }).withMessage('Frete inválido.').toFloat(),

  body('impostos')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 9999999999.99 }).withMessage('Impostos inválidos.').toFloat(),

  body('taxas')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 9999999999.99 }).withMessage('Taxas inválidas.').toFloat(),

  body('observacoes')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 500 }).withMessage('Observações muito longas (máx. 500 caracteres).'),

  handleValidation,
];

const validarCancelamentoCompra = [
  body('motivo')
    .trim().notEmpty().withMessage('Informe o motivo do cancelamento.')
    .isLength({ max: 255 }).withMessage('Motivo muito longo (máx. 255 caracteres).'),
  handleValidation,
];

const validarPagamentoFornecedor = [
  body('valor')
    .notEmpty().withMessage('Informe o valor do pagamento.')
    .isFloat({ gt: 0, max: 9999999999.99 }).withMessage('Valor do pagamento inválido.')
    .toFloat(),

  body('data_pagamento')
    .notEmpty().withMessage('Informe a data do pagamento.')
    .isISO8601().withMessage('Data do pagamento inválida.'),

  body('metodo')
    .notEmpty().withMessage('Selecione o método de pagamento.')
    .isIn(['transferencia', 'pix', 'boleto', 'cartao', 'dinheiro', 'outro']).withMessage('Método de pagamento inválido.'),

  body('referencia')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 120 }).withMessage('Referência muito longa (máx. 120 caracteres).'),

  body('observacoes')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 500 }).withMessage('Observações muito longas (máx. 500 caracteres).'),

  handleValidation,
];

const validarContaAvulsa = [
  body('fornecedor_id')
    .notEmpty().withMessage('Selecione um fornecedor/beneficiário.')
    .isInt({ min: 1 }).withMessage('Fornecedor inválido.')
    .toInt(),

  body('descricao')
    .trim().notEmpty().withMessage('Informe uma descrição para a conta.')
    .isLength({ max: 200 }).withMessage('Descrição muito longa (máx. 200 caracteres).'),

  body('categoria')
    .optional({ checkFalsy: true })
    .trim().isIn(['aluguel', 'utilidades', 'servicos', 'impostos', 'salarios', 'outro'])
    .withMessage('Categoria inválida.'),

  body('valor')
    .notEmpty().withMessage('Informe o valor da conta.')
    .isFloat({ gt: 0, max: 9999999999.99 }).withMessage('Valor inválido.')
    .toFloat(),

  body('vencimento')
    .notEmpty().withMessage('Informe o vencimento.')
    .isISO8601().withMessage('Data de vencimento inválida.'),

  body('observacoes')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 500 }).withMessage('Observações muito longas (máx. 500 caracteres).'),

  handleValidation,
];

const validarParamContaId = [
  param('contaId').isInt({ min: 1 }).withMessage('Conta a pagar inválida.').toInt(),
  handleValidation,
];

const validarParamPagamentoId = [
  param('pagamentoId').isInt({ min: 1 }).withMessage('Pagamento inválido.').toInt(),
  handleValidation,
];

// Exports
module.exports = {
  handleValidation,
  cpfValido,
  cnpjValido,
  documentoFornecedorValido,
  validarLogin,
  validarCadastro,
  validarSolicitarRecuperacaoSenha,
  validarVerificarOtp,
  validarRedefinirSenha,
  validarSuporte,
  CATEGORIAS_SUPORTE_VALIDAS,
  validarProduto,
  parsearCamposJsonProduto,
  exigeTresImagensProdutoNovo,
  validarCategoria,
  validarSubcategoria,
  validarCupom,
  validarPromocao,
  validarAplicarCupom,
  validarCalcularFrete,
  validarBanner,
  validarReordenarBanners,
  validarRespostaAvaliacao,
  validarConfiguracoes,
  validarMovimentacaoEstoque,
  validarParamId,
  validarBusca,
  validarEndereco,
  validarEnderecoExistencia,
  validarStatusPedido,
  validarStatusPagamentoAdmin,
  validarCancelamentoPedido,
  validarListagem,
  validarBuscaFiltrada,
  validarAlterarSenha,
  validarFinalizarPedido,
  validarComentario,
  validarEnviarComprovanteEmail,
  validarNotaInterna,
  validarNivelCliente,
  validarPreferenciasAcessibilidade,
  validarCampoUnicoAcessibilidade,
  validarFornecedor,
  validarStatusFornecedor,
  validarCompra,
  validarCancelamentoCompra,
  validarPagamentoFornecedor,
  validarContaAvulsa,
  validarParamContaId,
  validarParamPagamentoId,
};
