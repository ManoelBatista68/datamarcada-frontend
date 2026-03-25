# Diretrizes de Arquitetura Frontend - Data Marcada

## 1. Protocolo de Ação Rigoroso (A Regra de Ouro)
- NUNCA altere código sem autorização expressa do Tech Lead.
- Sempre que receber um diagnóstico, analise a situação e apresente PRIMEIRO um **Plano de Solução** detalhado. 
- Aguarde o "Sinal Verde" do Tech Lead antes de codificar.

## 2. Padrões de Interface (UI/UX)
- **Cores Oficiais:** Usar sempre o Primary `#1a73e8` e Error `#d93025`.
- **Interatividade:** Elementos clicáveis devem ter transições suaves (`transition-all duration-200`) e efeitos de `hover` e `fade-in`.
- **Suavidade:** Contornos e bordas devem ser suaves (uso de opacidades menores e `ring-inset`), evitando um visual pesado ou antigo.

## 3. Isolamento e Tailwind CSS
- **Prefixo Obrigatório:** O Tailwind deve usar o prefixo `tw-` em TODAS as classes para evitar colisão com o CSS legado do sistema.
- **Preflight Desativado:** O `corePlugins: { preflight: false }` é obrigatório para não destruir o layout original dos Cards.

## 4. Arquitetura de iFrame e Modais
- **Modais de Tela Cheia:** Modais devem residir no ficheiro principal (`index.html`) para cobrir todo o ecrã, acionados via `window.parent` de dentro do iFrame.
- **Scroll Único:** O iFrame NUNCA deve ter barra de rolagem interna. Deve usar a técnica de envio de altura via `postMessage` para que o documento pai redimensione o iFrame dinamicamente.

## 5. Fidelidade Estética e Herança Visual (A Nova Regra de Ouro)
- **Herança de Propriedades**: Elementos de interface novos (incluindo modais e formulários em qualquer aba) devem obrigatoriamente herdar as propriedades de design (border-radius, espessura e cor de contorno, e efeitos hover) da tela principal legada.
- **Proibição de Contornos Agressivos**: É expressamente proibido o uso de contornos agressivos; priorize tons suaves (#ddd, #eee) e mantenha a consistência do feedback tátil.
- **Feedback Tátil Padronizado**: O estado de hover deve replicar o comportamento nativo do sistema (ex: `scale-[1.02]`) e transição de `200ms`.