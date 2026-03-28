---
name: system-mapping
description: Práticas de mapeamento do sistema para identificar acoplamento e integrações globais de arquitetura.
---

# System Mapping & Discovery

Habilidade base para entendimento global, usada pela pesquisa de sistema.

## Técnicas de Mapeamento
*   **Estrutura de Arquivos Central:** Antes de refatorar e iniciar a alteração, determine quem invoca o arquivo (Entrada) e quem ele influencia (Saída/Callback).
*   **Depuração Guiada:** Rastreie dependências utilizando `grep` para encontrar strings essenciais. 
*   **Evite Alucinações (Handoff Artifact):** Durante a delegação no Agent Manager, o mapeamento garante que você forneça o `Context Artifact` com a Exata Chave Primária, Tabela Banco de dados ou a Assinatura do Edge Function existente para o próximo agente.
