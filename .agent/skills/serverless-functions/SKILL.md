---
name: serverless-functions
description: Protocolos de Edge Functions no Deno, uso do @supabase/supabase-js e handlers.
---

# Serverless Functions (Deno / Supabase Edge)

Backend no Antigravity não é escrito em Node.js tradicionais de longa duração (Express/Nest), mas sim via "Supabase Edge Functions" powered by Deno.

## Arquitetura Serverless
*   **Deno Runtime:** As funções suportam typescript moderno nativo `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`
*   **Stateless by Design:** As Edge instances são "stateless". Variáveis globais sofrem "cold starts", não use-as para cache persistente, dependa do cache Redis ou do proprio Banco de Dados.
*   **Supabase Client:** Injete e crie o client conectando com `Deno.env.get('SUPABASE_URL')` e `Deno.env.get('SUPABASE_ANON_KEY')`. Utilize o header de autorização (Bearer token) enviado pelo `ApiClient` para extrair o JWT e forçar a RLS baseada no usuário logado chamando `createClient` com o header `{ global: { headers: { Authorization: req.headers.get('Authorization') } } }`.
