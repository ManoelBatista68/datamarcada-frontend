---
name: github-actions
description: Diretrizes CI/CD Automatizadas para execução de Pipelines QA no fluxo do Github Integrado.
---

# GitHub Actions (CI & Tests)

O DevOps implementa a barreira final de segurança usando scripts QA Playwright que evitam o disparo "quebrado" ao Github e posterior propagação cega para Deploy Automático na Vercel.

## Testes no CI
*   A ação (Workflows `.yml`) aciona o Push à ramificação (Branch). Nela os scripts `Playwright Test Runner` processam a interface em headless mode.
*   O Playwright precisa acessar um Environment MOCK ou "Tenant Teste Dedicado" nas requisições do DB/Supabase usando credenciais e ENV Variables injetados via Secrets Github Settings.
*   **Falha = Break Pull Request/Deploy:** Se os testes quebrarem e a Action falhar o Run, o Merge para envio do Vercel trava imediatamente a fim de assegurar código protegido.
