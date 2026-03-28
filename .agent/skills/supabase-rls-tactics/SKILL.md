---
name: supabase-rls-tactics
description: Mapeamento das regras de Role Level Security, isolamento de auth.uid() e userCodigoEmpresa.
---

# Táticas de Supabase Row Level Security (RLS)

O RLS é a base de defesa da Arquitetura Antigravity, garantindo isolamento Multi-Tenant em todas as execuções de SQL.

## Estrutura do RLS
*   **Enable by Default:** Nunca deve existir tabela sem RLS Habilitada (`ALTER TABLE tabela ENABLE ROW LEVEL SECURITY`).
*   **Isolamento via JWT Reclam (Multi-Tenant):** Aplicações SaaS Antigravity são comumente Multi-Tentant. As regras de RLS (Policies) devem comparar a coluna de locatário (`codigo_empresa`) contra o valor contido no Token, ou usando extensões, ex: `(codigo_empresa = (auth.jwt() ->> 'codigo_empresa')::int)`.
*   **Restrição Absoluta:** Políticas mal formatadas como `USING (true)` anulam a defesa. O teste padrão é "Esse SELECT traria dados de outro cliente? Se sim, o RLS falhou."
