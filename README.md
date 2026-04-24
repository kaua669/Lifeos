# ⬡ LifeOS

> **Gerencie sua vida inteira em um só lugar** — cronograma, estudos, academia e finanças.

LifeOS é um Progressive Web App (PWA) completo com backend Node.js + PostgreSQL. Pode ser instalado no celular como um app nativo.

---

## 📁 Estrutura do Projeto

```
lifeos/
├── backend/                  ← API Node.js
│   ├── src/
│   │   ├── server.js         ← Entry point Express
│   │   ├── db/
│   │   │   ├── pool.js       ← Conexão PostgreSQL
│   │   │   └── migrate.js    ← Script de migração
│   │   ├── middleware/
│   │   │   ├── auth.js       ← JWT middleware
│   │   │   ├── validate.js   ← Validação de inputs
│   │   │   └── errorHandler.js
│   │   └── routes/
│   │       ├── auth.js       ← /api/auth/login, register
│   │       ├── user.js       ← /api/user/profile, password
│   │       ├── schedule.js   ← /api/schedule
│   │       ├── study.js      ← /api/study/subjects, notes
│   │       ├── gym.js        ← /api/gym/workouts, nutrition
│   │       └── finance.js    ← /api/finance/transactions, salaries
│   ├── .env.example          ← Variáveis de ambiente (template)
│   └── package.json
├── frontend/
│   ├── index.html            ← App SPA + PWA meta tags
│   ├── app.js                ← Toda lógica frontend
│   ├── styles.css            ← Design system dark luxury
│   ├── manifest.json         ← PWA manifest
│   ├── sw.js                 ← Service Worker (cache offline)
│   └── icons/                ← (adicionar icon-192.png e icon-512.png)
└── README.md
```

---

## 🚀 Configuração Local

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/lifeos.git
cd lifeos
```

### 2. Configurar o banco de dados
```sql
-- No psql ou pgAdmin:
CREATE DATABASE lifeos_db;
CREATE USER lifeos_user WITH PASSWORD 'sua_senha_segura';
GRANT ALL PRIVILEGES ON DATABASE lifeos_db TO lifeos_user;
```

### 3. Configurar variáveis de ambiente
```bash
cd backend
cp .env.example .env
# Edite .env com suas credenciais
```

### 4. Instalar dependências e rodar migrações
```bash
cd backend
npm install
npm run migrate   # Cria as tabelas no banco
```

### 5. Iniciar o backend
```bash
npm run dev       # Com nodemon (hot-reload)
# ou
npm start         # Produção
```

### 6. Servir o frontend
Qualquer servidor estático funciona. Exemplos:

```bash
# VS Code: extensão Live Server
# ou com npx:
cd frontend
npx serve .

# ou com Python:
python3 -m http.server 3000
```

Acesse **http://localhost:3000** no navegador.

---

## 🌐 Deploy em Produção

### Backend (Render.com — grátis)
1. Crie um novo **Web Service** no Render
2. Conecte seu repositório GitHub
3. Configure:
   - **Build command:** `cd backend && npm install`
   - **Start command:** `cd backend && node src/server.js`
4. Adicione as variáveis de ambiente do `.env.example`
5. Adicione um **PostgreSQL** gratuito no Render e copie a `DATABASE_URL`

### Frontend (Vercel / Netlify / GitHub Pages)
1. O frontend é 100% estático (HTML + CSS + JS)
2. Faça deploy da pasta `frontend/`
3. Atualize `API_BASE` no `app.js` para a URL do seu backend no Render

### Variáveis de Ambiente Necessárias
| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL completa do PostgreSQL |
| `JWT_SECRET` | String aleatória longa (mínimo 64 chars) |
| `NODE_ENV` | `production` |
| `PORT` | Porta do servidor (Render define automaticamente) |
| `CORS_ORIGINS` | URL do seu frontend (ex: `https://lifeos.vercel.app`) |

---

## 🔒 Segurança

- **Senhas** — bcrypt com 12 rounds
- **JWT** — Tokens assinados, expiram em 7 dias
- **Rate limiting** — 200 req/15min global, 20 req/15min em /auth
- **Helmet.js** — Headers de segurança HTTP
- **Validação** — express-validator em todos os endpoints
- **Isolamento** — Cada query filtra por `user_id` (dados 100% isolados)
- **Soft delete** — Dados nunca deletados permanentemente (deleted_at)
- **SQL Injection** — Somente queries parametrizadas (nunca string concatenation)
- **CORS** — Apenas origens permitidas

---

## 📱 PWA — Instalar no Celular

1. Abra o site no **Chrome** (Android) ou **Safari** (iOS)
2. Um banner de instalação aparecerá automaticamente
3. Toque em **Instalar** → o app aparece na tela inicial
4. Funciona offline para ver dados cacheados

---

## 🛠 Stack Técnica

### Backend
| Pacote | Uso |
|---|---|
| `express` | Framework HTTP |
| `pg` | Driver PostgreSQL |
| `bcryptjs` | Hash de senhas |
| `jsonwebtoken` | Autenticação JWT |
| `helmet` | Headers de segurança |
| `cors` | Controle de origens |
| `express-rate-limit` | Rate limiting |
| `express-validator` | Validação de inputs |
| `morgan` | Logging HTTP |

### Frontend
| Tecnologia | Uso |
|---|---|
| HTML/CSS/JS vanilla | SPA sem framework |
| Chart.js | Gráficos do dashboard |
| SheetJS (xlsx) | Exportar Excel |
| Service Worker | Cache offline (PWA) |

---

## 📡 API Endpoints

### Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Login |

### Usuário (requer JWT)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/user/me` | Dados do usuário |
| PUT | `/api/user/profile` | Atualizar perfil |
| PUT | `/api/user/password` | Alterar senha |
| POST | `/api/user/avatar` | Upload avatar (base64) |

### Cronograma
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/schedule` | Listar eventos |
| POST | `/api/schedule` | Criar evento |
| DELETE | `/api/schedule/:id` | Excluir evento |

### Estudos
| Método | Rota |
|---|---|
| GET/POST | `/api/study/subjects` |
| DELETE | `/api/study/subjects/:id` |
| GET/POST | `/api/study/notes` |
| DELETE | `/api/study/notes/:id` |

### Academia
| Método | Rota |
|---|---|
| GET/POST | `/api/gym/workouts` |
| DELETE | `/api/gym/workouts/:id` |
| GET/POST | `/api/gym/nutrition` |
| DELETE | `/api/gym/nutrition/:id` |

### Finanças
| Método | Rota |
|---|---|
| GET/POST | `/api/finance/transactions` |
| DELETE | `/api/finance/transactions/:id` |
| GET/POST | `/api/finance/salaries` |
| DELETE | `/api/finance/salaries/:id` |
| GET | `/api/finance/summary` |

---

## 📄 Licença

MIT — use à vontade!
