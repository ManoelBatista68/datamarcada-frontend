---
name: webgl-basics
description: Fundamentos para renderização avançada com WebGL no Browser para visualizadores 3D interativos.
---

# WebGL (Interactive Elements)

Se a complexidade exigir bibliotecas como `Three.js` para carregamento de Objetos (Visualizadores de Anatomia, Produtos), sigam esse padrão Serverless Mobile-First.

## Carga em Devices Limites
*   **Texturas WebP/Otimizadas:** Todas as respostas contendo modelos renderizáveis ou GLTF devem pesar menos que centenas de KBs. Dispositivos Android Mid-End travam a GPU do Chrome rapidamente.
*   **Degradação Elegante:** WebGL possui conflitos antigos no IOS ou aparelhos sem WebGL ativo. Sempre disponibilize Imagens Standalone ou visualização Plana Vanilla em `catch` no WebGL Support.
