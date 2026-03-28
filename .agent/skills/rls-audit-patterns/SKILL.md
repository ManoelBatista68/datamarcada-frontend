---
name: rls-audit-patterns
description: Padrões de Auditoria de Políticas Supabase RLS exigidas pelos agentes de Segurança.
---

# Padrões de Segurança - RLS Audit

Complemento de Auditoria ao `supabase-rls-tactics`, usado especificamente pelo Penetration Tester e Security Auditor para checar integridade defensiva.

## Checklists de Auditoria
1.  **Vazamento Horizontal:** Verifique se as Tabelas sensíveis possuem CHECK limitando UPDATES/DELETES apenas aos dados do proprietário (Prevenção de IDOR).
2.  **Service Role Overuse:** Agentes backend não devem usar a chave *Service Role* (`SUPABASE_SERVICE_ROLE_KEY`) indiscriminadamente. O uso do Service Role anula (Ignora) as políticas de RLS e deve ser reservado EXCLUSIVAMENTE para sincronizações administrativas ou webhooks confirmados em backend, nunca originados de requisições de clientes sem sanitização extra.
3.  **Roles Default:** Verificar se as RLS limitam o escopo também para `TO authenticated` e não `TO public`, exceto em tabelas publicas abertas.
