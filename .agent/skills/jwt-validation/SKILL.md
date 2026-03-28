---
name: jwt-validation
description: Tratamento de JWT expirado, JWT forging e validação de claims seguros no server-side ou interceptors do client.
---

# JWT Validation & Session UX

Esta skill orienta o gerenciamento de Autorizações Baseadas em Token. As chaves JWT governam o estado de Login do usuário.

## Regras de JWT e Sessão
*   **PROTOCOLO DE SESSÃO (TOKEN VENCIDO):** Se o Endpoint / Backend / DB recusar a requisição com Erro 401 ou 403 por Expiração, NÃO DEIXE FALHAR SILENCIOSAMENTE. Emita um alerta nativo (Alert/Toast) informando que a Sessão Expirou ANTES de reverter o fluxo visual ou apagar as chaves (Limpeza de Cache/localStorage).
*   **Validação Backend (Deno Edge):** Valide que o Token repassado pertence a estrutura correta utilizando a função embutida do helper de Auth do Supabase Client para atestar a falsificação (JWT forging) e barrar requisições. O Edge function deve responder HTTP Status 401 para a queda em `catch` no frontend.
