---
name: html5-canvas
description: Desenvolvimento e Otimização para elementos HTML5 Genéricos de Jogos em Browser.
---

# HTML5 Canvas (Gamification)

Na introdução de Gamificação Leve e animações, o HTML5 Canvas resolve necessidades pesadas com API Vanilla JS.

## Boas Práticas (Animation Node)
*   **Loop de Solicitação Constante (FPS):** Sempre execute os processos via loop iterativo de quadro de sistema (`window.requestAnimationFrame()`) nunca com Timeouts repetitivos (`window.setInterval()`).
*   **Gestão de Memória:** O canvas prende grandes porções de Array de pixels se as imagens base forem brutas (Raw). Destrua e realoque (Context dispose / Event Listener Drop) toda gamificação executada momentaneamente caso seja "Mini-Game" ao encerrar.
