---
name: antigravity-workflow
description: Fundamentos centrais do Antigravity Kit (Vanilla JS, Tailwind, Supabase, Vercel) e fluxo obrigatório de deploy GitOps.
---

# Antigravity Workflow (Core Skill)

Esta skill estabelece o fluxo de trabalho obrigatório e inegociável dentro da arquitetura Antigravity.

## Praticas Fundamentais
- **Stack Fixa:** O desenvolvimento deve ser estritamente realizado usando Vanilla JS, HTML semântico e Tailwind CSS para a interface. O Backend opera estritamente via Supabase (Edge Functions) e PostgreSQL.
- **Ambientes Locais são Proibidos:** O sistema não utiliza servidores locais em loop (ex: localhost, Vite dev server, etc). Toda validação é feita em produção/Vercel.
- **Interação Global:** Todas as chamadas de API feitas pelo Frontend para o Backend (Supabase) devem passar estritamente pela classe utilitária `ApiClient.js`.

## O Fluxo de Deploy (GitOps)
Sendo esta uma arquitetura Serverless (Vercel/Supabase), o deploy das alterações é feito 100% via Git. Ao finalizar qualquer alteração de código, você deve:
1. Analisar as mudanças;
2. Adicionar ao stage: `git add .`
3. Executar o commit: `git commit -m "tipo: mensagem"`
4. Subir para produção: `git push`
