---
name: vanilla-js-performance
description: Estratégias táticas de alta performance para execução client-side via Vanilla JS (Debounce, RAF, Evitando Reflows).
---

# Vanilla JS Performance Tactics

Arquiteturas serverless delegam mais responsabilidade à máquina cliente. Garantir um "Snappy UI" sem frameworks reativos exige foco absoluto no Event Loop e manipulação da DOM.

## Táticas de Otimização

*   **Minimização de Layout Thrashing (Reflows):** Em listagens longas e construção de tabelas, jamais adicione iterativamente via `container.innerHTML += ...`. Construa primeiro toda a string e aplique *apenas uma vez*.
*   **Lazy Loading em Iframes e Modais:** Iframes que invocam outros recursos dentro dos modais (`<iframe src="...">`) bloqueiam a carga principal se visíveis inicialmente. O carregamento deve ser adiado (adição de classe ou injeção dinâmica no src) até o momento em que o usuário requisita a janela.
*   **Uso de Debounce:** Requisições de pesquisas digitadas ou scroll em grande quantidade não podem invocar funções pesadas repetidamente nas chamadas `oninput`. Utilize Debounce na invocaçaõ do `ApiClient.js`.
