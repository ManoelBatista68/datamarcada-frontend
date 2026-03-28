---
name: vercel-config
description: Regras e padronizações para deployment em hosts baseados no padrão serverless da Vercel Edge Networks.
---

# Configurações Vercel (Edge Deploy)

A pipeline final onde a interface Web interage com a vida real.

## Táticas Vercel e Headers
*   **Headers de Resposta:** `vercel.json` deve incluir os headers de segurança base (Content-Security-Policy em rotas dinâmicas, Header `X-Frame-Options` se não houver iFrame ou em Sameorigin se o App precisar embutimento interno).
*   **Rewrites Estáticos:** Rotas do SPA Falso (HTML Views unificadas) precisam rotear apropriadamente, caso ocorra link direto de URL aos Modais Vanilla. Mapeie rewrites no JSON se suportar múltiplas Entrypoints.
