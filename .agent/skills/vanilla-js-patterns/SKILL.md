---
name: vanilla-js-patterns
description: Padrões essenciais de programação e manipulação de DOM utilizando ECMAScript moderno e Vanilla JS puro sem frameworks SPA.
---

# Padrões Vanilla JS (Frontend Architecture)

Para desenvolver no Antigravity Kit (focado em máxima leveza e zero build lock-in), evitamos dependências externas de UI e Single Page Application (SPA) reativas como React e Vue. Toda a manipulação de tela, estados e APIs é direta ao ponto.

## Padrões Adotados
*   **Modularidade via Global e Clients:** Funções utilitárias devem residir em `Global_JS.js`. Chamadas HTTP em `ApiClient.js`.
*   **Event Delegation:** Minimize o número de manipuladores de evento atrelados iterativamente. Prenda ouvintes (listeners) no nível ascendente da DOM e capture dinamicamente os cliques ou modifique as classes via Tailwind (`classList.toggle()`).
*   **Strings de Template Literal HTML:** Ao invés de usar Node creation com createElement massivo, prefira gerar e retornar Strings HTML formatadas com variáveis, depois injetadas no contêiner com documentFragment se possível, ou setar o html diretamente garantindo sanitização.
