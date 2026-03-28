---
name: mobile-web-patterns
description: Adaptação ágil baseada em Web mobile, toques responsivos sem reescrita para React Native ou Flutter.
---

# Mobile Native "Feel" (PWA / Wrapper Focus)

Nossa filosofia Mobile não migra nosso App Vanilla para Swift/Kotlin ou Flutter. Ele será embutido e adaptado.

## Sentimento Visceral App
*   **Padrão de Toque Limpo:** Aumente as `Touch Targets`. O polegar humano demanda no mínimo 44x44px de área clicável em modais, com margem em botões acoplados para evitar o Missclick ("Fat Finger Error"). Tailwind: `tw-min-h-[44px] tw-min-w-[44px]`.
*   **Barra Fixa / Viewport Constrain:** Iniba Scroll horizontal com `overflow-x-hidden`. Se existir botão Crítico Salvar/Cancelar no Mobile View, amarre as ações usando painéis Fixos para manter o polegar próximo à parte inferior (Bottom Bars).
