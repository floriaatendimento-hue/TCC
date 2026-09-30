# 🌿 Floria — Loja de Plantas e Vasos


## Tecnologias

- **Backend**: Node.js, Express 4, EJS
- **Banco**: MySQL (mysql2)
- **Autenticação**: express-session + connect-mysql2
- **Segurança**: helmet, csurf, express-rate-limit, bcrypt
- **Upload**: multer

## Instalação

```bash
npm install
cp .env.example .env
# Edite o .env com suas credenciais
npm run dev
```

O schema do banco é criado/migrado automaticamente ao subir o servidor.

Acesse em http://localhost:3000
