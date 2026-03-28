---
name: autonomous-handoff
description: Protocolo de comunicação entre os agentes autônomos no ecossistema usando Context Artifacts e o Agent Manager.
---

# Protocolo: Autonomous Handoff

No modelo Agent-First Antigravity, diferentes módulos requerem especialistas diferentes (Orchestrator, Frontend, Backend, Database). O `autonomous-handoff` rege como esses agentes trocam contexto e finalizam suas etapas.

## Regras de Execução de Handoff

Quando um Agente finaliza sua atribuição e precisa chamar o próximo especialista, a seguinte string **Deverá ser inserida na resposta final**:

`[AGENT MANAGER DIRECTIVE]: [Motivo da Invocação]. Invoking @[NomeDoAgente]. Context Artifact: [Descrição clara do que foi feito e do payload, variáveis ou schemas esperados para a continuidade]. Please [ação específica para o próximo Agente].`

## Context Artifacts
Sempre documente o que está sendo repassado:
- Se for para o Banco de Dados, detalhe as RLS.
- Se for para o Frontend, detalhe a URL da API e formato do JSON de resposta.
- Se for para o Backend, detalhe as rotas necessárias e as lógicas exigidas.
