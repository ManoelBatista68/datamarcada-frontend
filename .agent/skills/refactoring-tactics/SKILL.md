---
name: refactoring-tactics
description: Diretrizes de refatoração para transição de legados para os padrões Vanilla JS Antigravity.
---

# Táticas de Refatoração de Legados

A especialidade do `@code-archaeologist` e `@project-planner` para limpeza do código durante transições ou débitos técnicos.

## Processos
*   **Identificação de Código Morto:** Código não executado ou que referencia a estrutura legada desativada (ex: `google.script.run`) não deve ser apenas "comentado". Delete o bloco arcaico.
*   **Isolamento Progressivo:** Mapeie funções imensas no estilo "God Function" e extraia as responsabilidades para utilitários externos em `Global_JS.js`, retornando Arrays puros antes de interpolar DOM.
*   **CSS em Linha para Tailwind:** Mapeie ocorrências de `style="margin-top: 10px; color: red;"` e as refatore estritamente para sintaxe Tailwind (`tw-mt-[10px] tw-text-red-500`). Se hover CSS Custom, remova e transfira.
