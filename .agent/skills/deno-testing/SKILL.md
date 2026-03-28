---
name: deno-testing
description: Modelos e práticas de testes em ambiente Deno para validacao das Supabase Edge Functions.
---

# Testes de Ambiente Deno (Backend Serverless)

Não usamos ferramentas nativas de node (Jest) para avaliar Edge Functions. Os testes de backend são integrados na run do Deno.

## Execução Prática
*   **Deno Native:** Utilize bibliotecas nativas como `https://deno.land/std/testing/asserts.ts`. Funções são declaradas com `Deno.test("Nome do Teste", async () => {...})`.
*   **Mocking:** Requisições a Bancos Reais podem gerar ruído em testes curtos. O uso de injetores (Dependency Injection) da conexão Supabase permite instanciar funções Edge em testes enviando Mocks de objetos baseados nas respostas padrão.
