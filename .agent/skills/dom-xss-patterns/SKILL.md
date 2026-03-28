---
name: dom-xss-patterns
description: Sanitarização mandatória de Payload em aplicações Vanilla e mitigação contra Injeção DOM Based.
---

# Prevenção à Injeções Baseadas em DOM e XSS

Uma arquitetura com inputs do usuário fluindo para Supabase e retornando em Arrays injetados via `innerHTML` está estruturalmente exposta se o escape dos dados não ocorrer adequadamente. O Backend trata Roles, porém o Frontend é quem sofre o exploit via DOM.

## Defesas Atemporais
*   **Atribuição Contextual Segura:** Sempre que inserir apenas texto do Payload do banco na interface, evite ao máximo `innerHTML`. A substituição para `textContent` inibe execução do código injetado, prevenindo `<script>` arbitrário de rodar na sessão atual.
*   **Sanitize Functions Obrigatórias:** Dados de cadastro que precisem ser processados em interpolações do HTML (`<div id="${userData}">`) devem ser analisados, proibindo que "quotes" finalizem strings prematuramente. (Utilizado extensamente no `carregarEstruturaHierarquica()`).
*   **Avaliação de Referência URL:** Se algum botão ou A-TAG assumir o atributo de href baseado num dado não sanitarizado, rejeitar inputs como `javascript:`. Use URLs estritas absolutas/relativas ao Hub.
