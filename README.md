# Config Service (Next.js) — CRUD de Tenants/Empresas

Painel simples (front + back) em Next.js (App Router) para administrar tenants/empresas
e expor um endpoint público de resolução de tenant para outros serviços (ex.: Estety Cloud).

## Requisitos
- Node 18+
- npm

## Como iniciar
```bash
npm install
cp .env.example .env.local
# edite .env.local com seus valores
npm run dev
```
Abra http://localhost:4000

## Endpoints
- **Painel Admin**
  - `GET /login` — página de login do admin
  - `GET /tenants` — listagem/cadastro de tenants (protegido por cookie HttpOnly)

- **APIs (protegidas pelo cookie do painel)**  
  - `GET /api/tenants` — lista
  - `POST /api/tenants` — cria
  - `GET /api/tenants/:id` — detalhe
  - `PATCH /api/tenants/:id` — atualiza
  - `DELETE /api/tenants/:id` — remove

- **API pública para resolução de tenant (para o Estety Cloud)**
  - `GET /api/tenants/resolve?tenantId=... | slug=... | name=...`
    - Responde `{ tenantId, name, slug, dbName, mongoUri }`
    - Se `CONFIG_API_KEY` estiver setado, enviar header: `x-api-key: <valor>`

## Observações
- Cookies de autenticação do painel: `config_token` (HttpOnly)
- Coleção: `tenants` no DB `NAME_DB` do seu cluster `MONGODB_URI`
- Campos do tenant:
  ```json
  {
    "tenantId": "lash-001",
    "name": "Lash Dev",
    "slug": "lashdev",
    "dbName": "lashdbdev",
    "mongoUri": null,
    "status": "active",
    "createdAt": "2025-08-13T00:00:00.000Z"
  }
  ```
