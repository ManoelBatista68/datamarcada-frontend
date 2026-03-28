---
name: pwa-manifest
description: Padões e diretrizes do Manifest de aplicativos PWA e configurações do Service Worker em Vanilla.
---

# PWA (Progressive Web Apps)

Em arquiteturas onde instalabilidade for focada no web, o arquivo `manifest.json` e Service Workers determinam o modo PWA offline ou Standalone da execução.

## Estruturação Principal
*   Use manifest estruturado para habilitar prompt de instalação: Campos chave: `display: standalone`, icones múltiplos dimensionados, e configuração de "theme_color" no HTML base referenciando sempre as cores base configuradas.
*   **Service Worker Cache (Offline Base):** Requisições de CSS Tailwind compilado, Scripts Puros da camada do Core e Views Modais Estáticos podem ser cacheados com API nativa de Cache SW. Porém, respostas Supabase (Edge/Database) NÃO DEVEM ser cacheadas nativamente sem estratégia sofisticada "Stale-While-Revalidate", dados desatualizados desmoronam aplicações corporativas.
