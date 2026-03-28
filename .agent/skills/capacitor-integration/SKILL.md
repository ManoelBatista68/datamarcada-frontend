---
name: capacitor-integration
description: Integração e plugins de wrappers CapacitorJS acessando componentes nativos sem build pesada.
---

# Capacitor.js (Bridge to Native)

Para features onde GPS Fino, Background Location, Câmera ou Notificações Push Locais são exigidas, a adaptação será baseada no Bridge do Ionic/Capacitor.

## Validação Nativa Mista
*   Tratando o Vanilla JS Base, jamais dependa de plugins nativos rodarem sem verificar se o projeto está sendo empacotado no container (via if Capacitor isNativeCheck).
*   Se o app for acessado de Vercel/Chrome puro, exiba aviso "Acessar Funcionalidade via App Native" em vez de quebrar em console Log por tentativa de chamada da Bridge Nativa via Plugin.
