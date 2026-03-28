---
name: dom-optimization
description: Semelhante ao vanilla-js-performance, foca na otimização avançada de repintura da árvore e estruturação em DocumentFragment.
---

# Otimização da Árvore de Elementos (DOM Optimization)

## Isolamento e Tratamento
*   **Batching DOM Updates:** Qualquer operação que adicione, atualize ou remova múltiplos nodos (nodes) deve ser envolta ou empacotada. Construa `DocumentFragment`, atualize-o em memória isolada e depois execute o Anexamento (Append) num único passo para a página.
*   **Esvaziamento Limpo de Contêineres:** Redefinir containers listados é comumente mais veloz pelo uso pontual do `container.innerHTML = ''` do que varrer filhos removendo os links da arvore, exceto caso os elementos guardem pesados "EventListeners ligados".
*   **Event Removal em SPAs simulados:** Como Vanilla carrega tudo, destrua eventListeners anexados estritamente na DOM caso estes elementos tenham ciclos de vida dinâmicos e propensos à memory leaks.
