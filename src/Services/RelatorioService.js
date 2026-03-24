function gerarRelatorioCliente(celular, emailEspecialista) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID); const sheetCons = ss.getSheetByName(NOME_ABA_CONSULTAS);
    if (!sheetCons) return { success: false, erro: "Aba de Consultas não encontrada." };
    const dados = sheetCons.getDataRange().getDisplayValues(); let historico = [];
    for (let i = 1; i < dados.length; i++) {
      const row = dados[i]; const st = (row[12] || "").trim(); const celRow = (row[11] || "").trim();
      if (st === "Atendido" && celRow === celular.trim()) { 
          const emailProp = (row[21] || "").toString().toLowerCase().trim();
          if (emailProp === emailEspecialista.toLowerCase().trim()) {
              historico.push({ dataRaw: row[5], h_ini: row[6], esp: row[8], prof: row[3], obs_esp: row[17], obs_p_cli: row[22], relatorio: row[19], obs_cli: row[18] }); 
          }
      }
    }
    historico.sort((a, b) => { let dA = parseDateBackend(a.dataRaw, a.h_ini); let dB = parseDateBackend(b.dataRaw, b.h_ini); return dA - dB; });
    return { success: true, dados: historico };
  } catch(e) { return { success: false, erro: e.toString() }; }
}
