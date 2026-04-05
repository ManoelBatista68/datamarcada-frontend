# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Protocolo Obrigatório

**Antes de qualquer alteração:** Apresente um "Plano de Solução" e aguarde aprovação explícita antes de executar qualquer código.

---

## Stack e Deployment

- **Frontend:** Google Apps Script (GAS) com HTML/CSS/JS vanilla — sem framework, sem bundler, sem npm
- **Estilo:** Tailwind CSS via CDN com prefixo obrigatório `tw-` e `corePlugins: { preflight: false }`
- **Backend:** Supabase Edge Functions (Deno + TypeScript) em `/supabase/functions/gerenciar-agendamentos/index.ts`
- **Dados legados:** Google Sheets via `SpreadsheetApp` (GAS nativo)
- **Deploy frontend:** `git push origin main` → Vercel deploy automático (~1-2 min)
  - URL produção: `https://datamarcadaclinica.vercel.app/index.html`
  - Repo: `https://github.com/ManoelBatista68/datamarcada-frontend`
  - `clasp push` **NÃO é mais usado** — app não roda em GAS, só no Vercel
- **Deploy backend:** `supabase functions deploy gerenciar-agendamentos`

Não existe `package.json`, `node_modules` nem processo de build local. Dependências são CDN (Tailwind, Material Icons) ou APIs nativas (GAS, Deno).

---

## Arquitetura

### Fluxo de dados
```
Browser → ApiClient.js → Supabase Edge Function (index.ts) → PostgreSQL (Supabase)
                     ↘ Google Apps Script (GAS)            → Google Sheets (legado)
```

### Frontend (`/src/`)
- `Controllers/WebController.js` — ponto de entrada GAS: `doGet(e)` serve `index.html`
- `js/ApiClient.js` — cliente HTTP centralizado; gerencia JWT do `localStorage['saas_token_jwt']`
- `js/Global_JS.js` — toda a lógica de UI (3200+ linhas); renderização, estado, modais
- `index.html` — shell do app: `#login-screen`, `#app-content`, `#medpavilion-modals-root`
- `Config/Environment.js` — IDs de planilhas e nomes de abas do Google Sheets

### Backend GAS (`/src/Services/`, `/src/Controllers/`)
- `Controllers/WebhookController.js` — roteador por estratégia: `ROTAS_DISPONIVEIS[acao](params)`
- Services acessam Google Sheets via `SpreadsheetApp`; `ProdutoService` usa cache de 6h

### Edge Function (`/supabase/functions/gerenciar-agendamentos/index.ts`)
- Recebe POST com campo `action` e roteia para handlers internos
- Acessa PostgreSQL diretamente via pool de conexões Deno
- Resposta padrão: `{ sucesso: boolean, dados/erro }`

### Multi-tenancy
- Toda query filtra por `codigoempresa` — nunca omitir esse filtro
- Soft delete obrigatório para entidades relacionais (ver Regras abaixo)

---

## Regras Críticas de UI/UX

### Responsividade — Mobile e Tablet obrigatório

**Toda tela, modal ou componente novo deve funcionar em celular (≥ 320px) e tablet (≥ 768px).** Checklist antes de finalizar qualquer implementação de UI:

- Containers com altura fixa (`height: 100vh`): usar `min-height` para permitir crescimento do conteúdo
- Listas horizontais (tabs, menus): `overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none`
- Textos longos em botões/tabs: `tw-hidden sm:tw-inline` para desktop, abreviado no mobile
- Tabelas: sempre envolver com `overflow-x: auto` + `min-width` mínimo
- iFrames: container pai **nunca** com `height` fixo — usar `min-height` + PostMessage para dimensionamento
- Modais: garantir `max-width: calc(100vw - 32px)` em telas pequenas
- Fontes e espaçamentos: classes responsivas (`tw-text-sm md:tw-text-base`, `tw-p-4 md:tw-p-8`)

### Design (paridade visual absoluta — não inovar)
- Botões de ação primária circular: copiar `.action-add` (`border-radius: 50%`, 40×40px) — nunca usar botão quadrado Tailwind
- Botões de modal: usar **sempre** `class="btn-modal"` + cor inline obrigatória:
  - Salvar/Confirmar: `style="background:#34a853; color:white"`
  - Cancelar/Fechar/Secundário: `style="background:#e0e0e0; color:#333"`
  - Aviso/Destrutivo: `style="background:#e53935; color:white"`
  - Informativo/OK: `style="background:#1a73e8; color:white"`
  - O CSS base de `.btn-modal` (shape, border-radius, hover) está em `Global_CSS.css` — NÃO recriar inline
  - **NUNCA** deixar `<button class="btn-modal">` sem `style="background:...; color:..."` — ficará com aparência de botão browser padrão
- Inputs, selects e formulários: sempre `height: 38px; border-radius: 8px`
- Proibido `style="font-size:..."` — usar `tw-text-lg` (especialidades), `tw-text-base` (subs e produtos)
- Botões de ação em cards não têm borda (`tw-border` proibido neles)

### Estrutura de modais (Rule 18 — SSOT)
- Todos os modais ficam em `#medpavilion-modals-root` no `index.html`
- Antes de criar novo modal: verificar e remover versão legada com mesmo ID
- Posicionamento absoluto obrigatório: `top:50%; left:50%; transform:translate(-50%,-50%)`
- Botões de ação em modais: `type="button"` obrigatório; onclick explícito

### Estado oculto em modais (Rule 14)
- Para edição/exclusão: `<input type="hidden" id="[entidade]-[acao]-id" />` no HTML do modal
- Sempre validar existência do campo antes de `.value`

### Acordeões / hierarquia (Rule 16)
- Elementos filhos carregam com `tw-hidden` por padrão e ícone `visibility_off`
- Modais globais (ex: sessão expirada) injetados em `window.top.document.body`

### Campos relacionais (Rule 19)
- Nunca input de texto livre para entidades relacionais — usar `<select>` dinâmico
- Chamar `carregarOpcoesTagsSubEspecialidades()` ao abrir modal com campo de sub-especialidades

### Exclusão (Rule 17 — Soft Delete)
- **PROIBIDO** `DELETE` físico para Especialistas, Clientes, Produtos e Agendamentos
- Usar `status = 'inactive'` ou `ativo = false` — filtrar nas listagens, preservar no banco

---

## Segurança e Tratamento de Erros

- **DOM injection:** sempre usar `escapeHtml()` + `.replace(/'/g, "\\'")` ao injetar variáveis em atributos `onclick`
- **Catch silencioso:** PROIBIDO — todo `catch` deve acionar `mostrarMensagem("Erro", ...)`
- **Sessão expirada (401/403):** exibir feedback visual antes de redirecionar; usar flag `isExpiredAlerted` em chamadas paralelas; NÃO exibir `alert` nativo quando `SESSION_EXPIRED` (interceptador global já trata)
- **Payload front↔back (Rule 15):** inspecionar `index.ts` e espelhar exatamente os nomes de propriedades do payload antes de codificar chamadas de API

---

## Banco de Dados (Rule 11)

**PROIBIDO** deduzir nomes de colunas, tipos (UUID vs string) ou foreign keys a partir do código frontend. Antes de qualquer query SQL ou chamada Supabase (`.select()`, `.insert()`, `.eq()`): inspecionar o schema real da tabela via MCP do Supabase ou lendo a Edge Function correspondente.

---

## iFrame e Comunicação

- `body` de iFrames: `overflow: hidden !important; height: auto !important;`
- Comunicação de altura via `postMessage` com debounce 150ms e threshold 15px
- Botões dentro de iFrames chamam funções do pai via `window.parent.NOME_DA_FUNCAO()`
- Sempre `event.stopPropagation()` em botões de ação para não disparar toggle de acordeão pai
