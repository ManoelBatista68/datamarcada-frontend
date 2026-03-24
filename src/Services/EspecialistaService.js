/**
 * EspecialistaService.gs
 * Módulo responsável por interagir com os dados dos profissionais.
 */

function listarEspecialistas(codigoempresaAlvo) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sheetEsp = ss.getSheetByName(NOME_ABA_ESPECIALISTAS);

    if (!sheetEsp) return { sucesso: false, erro: "Aba de especialistas não encontrada." };

    const dadosEsp = sheetEsp.getDataRange().getDisplayValues();
    if (dadosEsp.length <= 1) return { sucesso: true, especialistas: [] };

    const headers = dadosEsp[0];
    const listaRetorno = [];

    // Identificar as colunas Base
    let idxStatus = -1;
    let idxEmpresa = -1;
    for (let c = 0; c < headers.length; c++) {
      let h = String(headers[c] || "").trim().toLowerCase();
      if (h === 'status' || h === 'ativo') {
        idxStatus = c;
      }
      if (h === 'codigoempresa' || h === 'codigo_empresa') {
        idxEmpresa = c;
      }
    }

    for (let i = 1; i < dadosEsp.length; i++) {
      const row = dadosEsp[i];

      // Verifica se a linha está totalmente vazia
      const isEmpty = row.every(val => String(val || "").trim() === "");
      if (isEmpty) continue;

      // Filtrar inativos se a coluna Status existir
      if (idxStatus !== -1) {
        const valStatus = String(row[idxStatus] || "").trim().toLowerCase();
        if (valStatus === "inativo" || valStatus === "inativa" || valStatus === "não" || valStatus === "false") {
          continue;
        }
      }

      // Filtrar codigoempresa se a coluna existir, senão descarta por segurança do tenant
      if (idxEmpresa !== -1) {
        const valEmpresa = String(row[idxEmpresa] || "").trim().toLowerCase();
        if (valEmpresa !== String(codigoempresaAlvo).trim().toLowerCase()) {
          continue;
        }
      } else {
        // Se a coluna não existe na planilha, abortar a linha para não vazar info cruzada
        continue;
      }

      // Monta o objeto dinâmico com todas as colunas
      const objEspecialista = {};
      for (let c = 0; c < headers.length; c++) {
        let key = String(headers[c] || "").trim();
        if (!key) key = "Coluna_" + c; // Fallback para colunas sem cabeçalho

        objEspecialista[key] = String(row[c] || "").trim();
      }

      listaRetorno.push(objEspecialista);
    }

    return {
      sucesso: true,
      especialistas: listaRetorno
    };

  } catch (e) {
    return { sucesso: false, erro: e.toString() };
  }
}
