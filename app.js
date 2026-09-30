require('dotenv').config();
const express = require('express');
require('./app/helpers/asyncErrors');
const path    = require('path');
const fs      = require('fs');
const app     = express();

const port = process.env.PORT || 3000;

const session    = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet     = require('helmet');
const csrf       = require('csurf');
const rateLimit  = require('express-rate-limit');
const multer     = require('multer');
const bcrypt     = require('bcrypt');

const db = require('./config/db');
const { verificarEAplicarMigracoes } = require('./config/migrar');
const { sessaoSegura } = require('./app/middlewares/sessaoSegura');
const SessaoSegura = require('./app/models/SessaoSegura');
const configCache = require('./app/services/cache/configCache');
const categoriasNavCache = require('./app/services/cache/categoriasNavCache');
const promocoesService = require('./app/services/promocoesService');
const pagamentoScheduler = require('./app/services/pagamentoScheduler');
const retencaoScheduler = require('./app/services/retencaoScheduler');

const uploadDir = path.join(
  __dirname,
  process.env.UPLOAD_DIR || 'app/public/uploads/perfil'
);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://vlibras.gov.br', 'https://cdn.jsdelivr.net', 'https://sdk.mercadopago.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://use.fontawesome.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://use.fontawesome.com', 'https://vlibras.gov.br', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://vlibras.gov.br', 'https://*.vlibras.gov.br', 'https://cdn.jsdelivr.net'],
      connectSrc: ["'self'", 'https://vlibras.gov.br', 'https://*.vlibras.gov.br', 'https://cdn.jsdelivr.net', 'https://viacep.com.br'],
      frameSrc: ["'self'", 'https://vlibras.gov.br', 'https://*.vlibras.gov.br'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
}));

app.use((req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

const trustProxy = false;
app.set('trust proxy', trustProxy);

const { montarConfigBanco: montarConfigSessao } = require('./config/dbConfig');

const sessionStore = new MySQLStore({
  ...montarConfigSessao(),
  createDatabaseTable: true,
  schema: {
    tableName:   'sessions',
    columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' },
  },
  clearExpired:            true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: parseInt(process.env.SESSION_MAX_AGE_DIAS || '7', 10) * 24 * 60 * 60 * 1000,
});

sessionStore.on('error', (err) => {
  console.error('Erro na store de sessão:', err.message);
});

const SETE_DIAS  = parseInt(process.env.SESSION_MAX_AGE_DIAS || '7', 10) * 24 * 60 * 60 * 1000;
const isProducao = process.env.NODE_ENV === 'production';

const SESSION_SECRET_FALLBACK_DEV = 'floria-dev-secret-TROQUE-em-producao';
if (isProducao && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  console.error('❌  SESSION_SECRET ausente ou curta (mínimo 32 caracteres) em produção. Defina uma string longa e aleatória no ambiente antes de subir o servidor.');
  process.exit(1);
}

const NOME_COOKIE_SESSAO = 'floria.sid';
app.set('nomeCookieSessao', NOME_COOKIE_SESSAO);

app.use(session({
  secret:            process.env.SESSION_SECRET || SESSION_SECRET_FALLBACK_DEV,
  resave:            false,
  saveUninitialized: false,
  store:             sessionStore,
  name:              NOME_COOKIE_SESSAO,
  rolling:           true,
  cookie: {
    httpOnly: true,
    secure:   false,
    sameSite: 'strict',
    path:     '/',
    maxAge:   SETE_DIAS,
  },
}));

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES        = parseInt(process.env.UPLOAD_MAX_MB || '2', 10) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.'));
  },
});
app.locals.upload    = upload;
app.locals.uploadDir = uploadDir;

app.use(express.static('app/public', {
  maxAge: isProducao ? '5m' : 0,
  setHeaders(res, caminhoArquivo) {
    if (isProducao && /[\\/](imagens|uploads)[\\/]/.test(caminhoArquivo)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  },
}));
app.set('view engine', 'ejs');
app.set('views', './app/views');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(sessaoSegura);

app.use((req, res, next) => {
  res.locals.usuario = req.session?.usuario || null;
  res.locals.socialLinks = configCache.montarSocialLinks();
  res.locals.categoriasNav = categoriasNavCache.obter();
  next();
});

function origemConfiavel(req) {
  const hostEsperado = req.get('host');
  const origin = req.headers.origin;
  if (origin) {
    try { return new URL(origin).host === hostEsperado; } catch { return false; }
  }
  const referer = req.headers.referer;
  if (referer) {
    try { return new URL(referer).host === hostEsperado; } catch { return false; }
  }
  return true;
}

const METODOS_MUTAVEIS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
app.use((req, res, next) => {
  if (METODOS_MUTAVEIS.has(req.method) && !origemConfiavel(req)) {
    return res.status(403).json({ ok: false, message: 'Origem da requisição não confiável.' });
  }
  next();
});

app.use(require('./app/routes/webhooks/mercadopago'));

const csrfProtection = csrf({ cookie: false });
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_JANELA_MINUTOS || '15', 10) * 60 * 1000,
  max:      parseInt(process.env.LOGIN_MAX_TENTATIVAS || '5', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  skipSuccessfulRequests: true,
});
app.use('/api/login', loginLimiter);

const cadastroLimiter = rateLimit({
  windowMs: parseInt(process.env.CADASTRO_JANELA_MINUTOS || '60', 10) * 60 * 1000,
  max:      parseInt(process.env.CADASTRO_MAX_TENTATIVAS || '10', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
});
app.use('/api/cadastro', cadastroLimiter);

const pagamentoLimiter = rateLimit({
  windowMs: parseInt(process.env.PAGAMENTO_JANELA_MINUTOS || '15', 10) * 60 * 1000,
  max:      parseInt(process.env.PAGAMENTO_MAX_TENTATIVAS || '20', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Muitas tentativas de pagamento. Tente novamente em alguns minutos.' },
});
app.use('/api/pedidos/finalizar', pagamentoLimiter);

const recuperacaoSenhaLimiter = rateLimit({
  windowMs: parseInt(process.env.RECUPERACAO_JANELA_MINUTOS || '60', 10) * 60 * 1000,
  max:      parseInt(process.env.RECUPERACAO_MAX_TENTATIVAS || '5', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Se este e-mail estiver cadastrado, enviamos um código de verificação para ele.' },
});
app.use('/api/recuperar-senha', recuperacaoSenhaLimiter);
app.use('/api/reenviar-codigo', recuperacaoSenhaLimiter);

const verificarOtpLimiter = rateLimit({
  windowMs: parseInt(process.env.OTP_VERIFICAR_JANELA_MINUTOS || '15', 10) * 60 * 1000,
  max:      parseInt(process.env.OTP_VERIFICAR_MAX_TENTATIVAS || '10', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, code: 'LIMITE_IP', message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
  skipSuccessfulRequests: true,
});
app.use('/api/verificar-otp', verificarOtpLimiter);

const redefinirSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.REDEFINIR_SENHA_MAX_TENTATIVAS || '20', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});
app.use('/api/redefinir-senha', redefinirSenhaLimiter);

const trocaSenhaLimiter = rateLimit({
  windowMs: parseInt(process.env.TROCA_SENHA_JANELA_MINUTOS || '15', 10) * 60 * 1000,
  max:      parseInt(process.env.TROCA_SENHA_MAX_TENTATIVAS || '5', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
  skipSuccessfulRequests: true,
});
app.use('/api/perfil/senha', trocaSenhaLimiter);
app.use('/api/perfil/excluir-conta', trocaSenhaLimiter);

const acessibilidadeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.ACESSIBILIDADE_MAX_REQUISICOES || '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Muitas alterações em pouco tempo. Aguarde um instante.' },
});
app.use('/api/acessibilidade', acessibilidadeLimiter);

const suporteLimiter = rateLimit({
  windowMs: parseInt(process.env.SUPORTE_JANELA_MINUTOS || '60', 10) * 60 * 1000,
  max:      parseInt(process.env.SUPORTE_MAX_TENTATIVAS || '5', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Muitas solicitações de suporte em pouco tempo. Tente novamente mais tarde.' },
});
app.use('/api/suporte', suporteLimiter);

const avaliacaoLimiter = rateLimit({
  windowMs: parseInt(process.env.AVALIACAO_JANELA_MINUTOS || '15', 10) * 60 * 1000,
  max:      parseInt(process.env.AVALIACAO_MAX_TENTATIVAS || '20', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  skip:     (req) => req.method === 'GET',
  message: { ok: false, message: 'Muitas alterações em avaliações em pouco tempo. Aguarde um instante.' },
});
app.use('/api/comentarios', avaliacaoLimiter);

const enderecoVerificarLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.ENDERECO_VERIFICAR_MAX_REQUISICOES || '15', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Muitas verificações de endereço em pouco tempo. Aguarde um instante.' },
});
app.use('/api/enderecos/verificar', enderecoVerificarLimiter);

const enderecoSalvarLimiter = rateLimit({
  windowMs: parseInt(process.env.ENDERECO_SALVAR_JANELA_MINUTOS || '15', 10) * 60 * 1000,
  max: parseInt(process.env.ENDERECO_SALVAR_MAX_TENTATIVAS || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Muitas tentativas de salvar endereço em pouco tempo. Tente novamente mais tarde.' },
});
app.use('/api/enderecos', (req, res, next) => {
  if (req.path === '/verificar') return next();
  if (req.method === 'POST' || req.method === 'PUT') return enderecoSalvarLimiter(req, res, next);
  next();
});

const rotas = require('./app/routes');
app.use('/', rotas);

app.use((req, res) => {
  res.status(404).render('pages/404');
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ ok: false, message: 'Token de segurança inválido. Recarregue a página.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, message: `Arquivo muito grande. Máximo: ${process.env.UPLOAD_MAX_MB || 2} MB.` });
  }

  let status = Number(err.status || err.statusCode);
  if (err instanceof URIError) status = 400;
  if (!(status >= 400 && status < 500)) status = 500;

  let titulo = 'Algo deu errado';
  let mensagem;
  if (err.type === 'entity.parse.failed') { titulo = 'Requisição inválida'; mensagem = 'Os dados enviados estão malformados.'; }
  else if (err.type === 'entity.too.large' || status === 413) { status = 413; titulo = 'Requisição grande demais'; mensagem = 'Os dados enviados excedem o tamanho permitido.'; }
  else if (err instanceof URIError) { titulo = 'Endereço inválido'; mensagem = 'O endereço solicitado contém caracteres inválidos.'; }
  else if (status < 500) { titulo = 'Requisição inválida'; mensagem = 'Não foi possível processar a requisição.'; }
  else { mensagem = isProducao ? 'Erro interno. Tente novamente em instantes.' : (err.message || 'Erro interno.'); }

  if (status >= 500) console.error('[Erro]', err.message);

  const querJson = req.xhr
    || req.originalUrl.startsWith('/api/')
    || (req.headers.accept || '').includes('application/json')
    || (req.headers['content-type'] || '').includes('application/json');
  if (querJson) return res.status(status).json({ ok: false, message: mensagem });

  res.status(status).render('pages/erro', { status, titulo, mensagem }, (erroRender, html) => {
    if (erroRender) return res.status(status).type('text/plain').send(mensagem);
    res.send(html);
  });
});

(async () => {
  await verificarEAplicarMigracoes();
  await configCache.carregar();
  await categoriasNavCache.carregar();
  await promocoesService.carregar();
  promocoesService.iniciar();
  pagamentoScheduler.iniciar();
  retencaoScheduler.iniciar();

  SessaoSegura.limparAntigas().catch((e) => console.error('[sessoes] falha na limpeza inicial:', e.message));
  setInterval(() => {
    SessaoSegura.limparAntigas().catch((e) => console.error('[sessoes] falha na limpeza periódica:', e.message));
  }, 6 * 60 * 60 * 1000);

  const server = app.listen(port, () => {
    console.log(`\n🌿  Floria rodando em http://localhost:${port}`);
    console.log(`    Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`    Banco: variáveis DB_*\n`);
  });

  let encerrando = false;
  const encerrar = (sinal) => {
    if (encerrando) return;
    encerrando = true;
    console.log(`\n${sinal} recebido — encerrando o servidor…`);
    server.close(() => {
      Promise.allSettled([db.end(), sessionStore.close()]).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
})();
