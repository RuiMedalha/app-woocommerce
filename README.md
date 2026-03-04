# Hotelequip Product Optimizer

Aplicação web **self-hosted** para otimizar a gestão de produtos do site WooCommerce (ex.: hotelequip.pt). Extrai dados de catálogos (PDF) e listas (Excel), enriquece com informação de fornecedores, otimiza textos e imagens com IA e atualiza o WooCommerce via API REST.

**Linguagem da interface:** Português de Portugal (PT-PT).

## Stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Base de dados:** SQLite (sqlite3)
- **Imagens:** sharp (1000×1000, fundo branco, WebP)
- **PDF:** pdf-parse
- **Excel:** exceljs
- **Deployment:** Docker + docker-compose

## Estrutura

```
/client          → React (Vite, Tailwind)
/server          → Express, rotas API, serviços
  /src/lib       → db, uploadService, optimizeService, wooCommerceService, etc.
  /uploads       → Ficheiros carregados (PDF/Excel)
/data            → database.sqlite (ou DB_PATH)
Dockerfile       → Build client + server
docker-compose.yml
```

## Funcionalidades (conforme PDF)

1. **Dashboard** – Estatísticas (Pendentes, Aprovados, Total), atalhos (Carregar Ficheiros, Ver Produtos, Configurações), log de atividade.
2. **Upload de ficheiros** – Drag-and-drop PDF e Excel; tabela com estado (Aguardando, A extrair dados, Concluído, Erro); processamento extrai produtos com estado "Pendente".
3. **Painel de Produtos** – Filtros por estado (Pendente, Aprovado, Rejeitado, Aplicado no Site); tabela com checkbox, thumbnail, SKU, título original/otimizado, estado; ações em lote e por linha; modal com abas:
   - **Textos** – Antes/Depois (título, meta title, meta description, descrição curta/completa); botão "Re-otimizar com IA".
   - **Imagens** – Preview 1000×1000, carregar imagem (processa e envia para S3).
   - **Sugestões** – Cross-sell e Upsell (SKUs).
   - **Dados Brutos** – Texto original do PDF/Excel.
4. **Configurações** – OpenAI, Anthropic, modelo de IA; WooCommerce (URL, Consumer Key/Secret); S3 (Access Key, Secret, Bucket, Região); **Fornecedores** (prefixo SKU + URL de pesquisa com `{sku}` ou `{code}`).

## Backend – Lógica principal

- **Upload:** Ficheiros guardados em `/server/uploads`; PDF (pdf-parse) e Excel (exceljs) extraem produtos → tabela `products` com `original_*` e status "Pendente".
- **Otimização (POST /api/products/:id/optimize):** Remove os 2 primeiros caracteres do SKU para obter o prefixo; opcionalmente faz scraping no URL do fornecedor (configurações); deteta idioma (franc); traduz para PT-PT se necessário; prompt IA para título SEO, meta title/description, descrições, alt text, cross-sell e upsell (JSON); grava em `optimized_*`.
- **Imagem (POST /api/products/:id/process-image):** sharp 1000×1000, fit contain, fundo branco, WebP; upload S3; associa ao produto.
- **Aplicar no site (POST /api/products/:id/apply):** Envia para WooCommerce (name, description, short_description, meta_data RankMath, images com alt); atualiza estado para "Aplicado no Site" e regista no log.

## Base de dados (SQLite)

- **products** – sku, status, original_*, optimized_*, cross_sell_skus, upsell_skus, price, image_s3_url, woo_id, etc.
- **images** – product_id, original_url_or_path, processed_s3_url, alt_text, is_main_image
- **settings** – key, value (credenciais e lista de fornecedores)
- **activity_log** – action, details, status
- **uploaded_files** – filename, path, type, status, product_count

## Variáveis de ambiente (servidor)

- `PORT`, `DB_PATH`, `UPLOADS_DIR`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `WOOCOMMERCE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `AWS_REGION`
- `CLIENT_DIST` – caminho do build do client (Docker)

As configurações da página **Configurações** são guardadas na tabela `settings`; os fornecedores (prefixo + URL) são usados pelo endpoint de otimização para scraping. Para chaves de API em produção, recomenda-se usar variáveis de ambiente.

## Como correr

**Desenvolvimento:**

```bash
# Backend
cd server && npm install && npm run dev

# Frontend (outro terminal)
cd client && npm install && npm run dev
```

**Docker:**

```bash
docker-compose up -d
# Aceder: http://localhost:4000
```

Criar ficheiro `.env` na raiz (ou em `server/`) com as variáveis acima para OpenAI, WooCommerce e S3, e referenciá-lo no `docker-compose` com `env_file: .env` se quiser.

## API (resumo)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/stats | Estatísticas + log (dashboard) |
| GET | /api/activity | Log de atividade |
| POST | /api/upload | Upload ficheiro (multipart) |
| GET | /api/upload | Lista ficheiros carregados |
| POST | /api/upload/process | Processar ficheiro (extrair produtos) |
| GET | /products?status= | Lista produtos (filtro opcional) |
| GET | /products/:id | Detalhe produto |
| PUT | /products/:id | Atualizar produto |
| POST | /api/products/:id/optimize | Otimizar com IA (scrape + prompt SEO) |
| POST | /api/products/:id/process-image | Processar imagem (sharp + S3) |
| POST | /api/products/:id/apply | Aplicar no WooCommerce |
| GET/POST | /api/settings | Ler/guardar configurações |

Os endpoints anteriores (brands, scrape/udex, excel/import, woocommerce/sync, etc.) mantêm-se disponíveis.
