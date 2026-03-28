---
name: iframe-communication
description: Regras seguras de comunicação via PostMessage entre janelas, modais em Window/Parent dentro do Antigravity Hub.
---

# Protocolos Seguros de Iframe

Nosso ecossistema frequentemente usa modais ou janelas filhas isoladas em iframes (padrão legado consolidado). Tratar eventos via PostMessage, Onclicks cross-frame ou carregamentos em cascata deve obedecer às práticas abaixo.

## Práticas Seguras

*   **Origin Limitation e Verificação Mútua:** Apesar de as vezes estarem na mesma origin, comunicações que usem API nativa de Iframe (`window.parent.postMessage()`) devem possuir a filtragem rigorosa no listener do objeto evento de recebimento, validando se o JSON parse de respostas procede do ambiente pretendido.
*   **Acesso Transparente a Funções (`window.parent.foo()`):** Sendo "Same-Origin", priorize acesso direto aos scripts do parent ao fechar um Pop-Up ou emitir atualizações de lista do que depender de mensageria complexa, economizando recursos.
*   **Limpeza de Contexto Visual:** Ligar a classe Tailwind utilitária "hidden" no Wrapper modal do Parent após confirmar a alteração no Iframe filho.
