/**
 * TemporarioService.gs
 * Serviço responsável por interagir com os dados temporários dos clientes.
 */

function buscarTemporario(celularAlvo, codigoempresaAlvo) {
  try {
    // 1. Usando a nossa nova blindagem!
    const res = _obterDados(NOME_ABA_TEMPORARIO);
    if (!res.sucesso) return res;

    const { displayValues: dadosTemp, headers } = res;
    if (dadosTemp.length <= 1) return { sucesso: false, erro: "Usuário não encontrado." };

    // 2. Busca inteligente das colunas
    const idxCelular = _encontrarColuna(headers, ["celular", "telefone"]);
    const idxEmpresa = _encontrarColuna(headers, ["codigoempresa", "codigo_empresa"]);

    if (idxCelular === -1 || idxEmpresa === -1) {
      return { sucesso: false, erro: "Colunas de identificação não mapeadas." };
    }

    // 3. A MÁGICA RECUPERADA: remove tudo que não for número!
    const celProcurado = String(celularAlvo || "").replace(/\D/g, '');
    const empProcurada = String(codigoempresaAlvo || "").trim().toLowerCase();

    for (let i = 1; i < dadosTemp.length; i++) {
      const row = dadosTemp[i];

      const celPlanilha = String(row[idxCelular] || "").replace(/\D/g, '');
      const empPlanilha = String(row[idxEmpresa] || "").trim().toLowerCase();

      if (celPlanilha === celProcurado && empPlanilha === empProcurada) {
        const objetoCliente = {};
        for (let j = 0; j < headers.length; j++) {
          const chave = String(headers[j] || "").trim();
          if (chave) objetoCliente[chave] = row[j];
        }
        return { sucesso: true, dados: objetoCliente };
      }
    }
    return { sucesso: false, erro: "Usuário não encontrado." };
  } catch (e) {
    return { sucesso: false, erro: "Erro ao buscar no Temporario: " + e.toString() };
  }
}