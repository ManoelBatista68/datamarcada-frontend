// ==============================================================================
// 🛠️ FUNÇÕES AUXILIARES GERAIS E CONFIGURAÇÕES
// ==============================================================================

function limparTexto(texto) {
  if (!texto) return "";
  return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

function encontrarColuna(cabecalho, nomeProcurado) {
  const alvo = limparTexto(nomeProcurado);
  for (let i = 0; i < cabecalho.length; i++) {
    if (limparTexto(cabecalho[i]) === alvo) return i;
  }
  return -1;
}

/**
 * Helper Privado: Centraliza o acesso aos dados de uma aba.
 */
function _obterDados(nomeAba) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sheet = ss.getSheetByName(nomeAba);
    if (!sheet) return { sucesso: false, erro: "Aba [" + nomeAba + "] não encontrada." };

    const displayValues = sheet.getDataRange().getDisplayValues();
    const values = sheet.getDataRange().getValues();
    const headers = displayValues[0] || [];

    return { sucesso: true, sheet, displayValues, values, headers };
  } catch (e) {
    return { sucesso: false, erro: "Erro ao acessar aba [" + nomeAba + "]: " + e.toString() };
  }
}

/**
 * Helper Privado: Busca índice de coluna de forma resiliente.
 */
function _encontrarColuna(headers, nomesPossiveis) {
  if (!Array.isArray(nomesPossiveis)) nomesPossiveis = [nomesPossiveis];
  for (let nome of nomesPossiveis) {
    let idx = encontrarColuna(headers, nome);
    if (idx > -1) return idx;
  }
  return -1;
}

// ==============================================================================
// 🔑 LÓGICA DE LOGIN E BUSCA DE DADOS
// ==============================================================================
function verificarLogin(email, senha) {
  try {
    const res = _obterDados(NOME_ABA_TEMPORARIO);
    if (!res.sucesso) return res;
    const { values: data, headers } = res;

    const emailIdx = _encontrarColuna(headers, ["email"]);
    const senhaIdx = _encontrarColuna(headers, ["Senha"]);
    const tipoIdx = _encontrarColuna(headers, ["tipousuario"]);
    const codEmpresaIdx = _encontrarColuna(headers, ["codigoempresa"]);

    if (emailIdx === -1 || senhaIdx === -1) {
      return { sucesso: false, erro: "Colunas de login não encontradas na aba Temporario." };
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][emailIdx]).trim().toLowerCase() === email.trim().toLowerCase() &&
        String(data[i][senhaIdx]).trim() === senha.trim()) {

        let tipo = tipoIdx > -1 ? String(data[i][tipoIdx]).trim() : "Especialista";
        let codigoempresa = codEmpresaIdx > -1 ? String(data[i][codEmpresaIdx]).trim() : "";

        return {
          sucesso: true,
          email: email,
          tipoUsuario: tipo,
          codigoempresa: codigoempresa
        };
      }
    }
    return { sucesso: false, erro: "E-mail ou senha incorretos." };
  } catch (e) {
    return { sucesso: false, erro: e.toString() };
  }
}

// Busca as informações do usuário logado na aba Especialistas
function getUserRoleInfo(email) {
  const res = _obterDados(NOME_ABA_ESPECIALISTAS);
  if (!res.sucesso) return { tipo: 'Cliente', nomeEsp: '', celEsp: '', especialidade: '', codigoempresa: '' };
  const { values: data, headers } = res;

  const emailIdx = _encontrarColuna(headers, ['EmailEspecialista']);
  const nomeIdx = _encontrarColuna(headers, ['Especialista']);
  const celIdx = _encontrarColuna(headers, ['CelularEspecialista']);
  const espIdx = _encontrarColuna(headers, ['SubEspecialidades']);
  const codEmpresaIdx = _encontrarColuna(headers, ['codigoempresa']);

  if (emailIdx === -1) return { tipo: 'Cliente', nomeEsp: '', celEsp: '', especialidade: '', codigoempresa: '' };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).trim().toLowerCase() === email.trim().toLowerCase()) {
      return {
        tipo: 'Especialista',
        nomeEsp: nomeIdx > -1 ? data[i][nomeIdx] : '',
        celEsp: celIdx > -1 ? data[i][celIdx] : '',
        especialidade: espIdx > -1 ? data[i][espIdx] : '',
        codigoempresa: codEmpresaIdx > -1 ? data[i][codEmpresaIdx] : ''
      };
    }
  }
  return { tipo: 'Cliente', nomeEsp: '', celEsp: '', especialidade: '', codigoempresa: '' };
}

// ==============================================================================
// 🚀 MOTOR BLINDADO DE CRIAÇÃO EM LOTE
// ==============================================================================
function salvarAgendamentosEmLote(userEmail, userCodigoEmpresa, agendamentos) {
  try {
    const resAg = _obterDados(NOME_ABA_AGENDA);
    if (!resAg.sucesso) return resAg;
    const { sheet: sheetAgendas, values: dadosAgendas, headers: cabecalhoAgendas } = resAg;

    // Traz informações do especialista
    const userRoleInfo = getUserRoleInfo(userEmail);
    if (userRoleInfo.tipo !== 'Especialista') {
      return { success: false, error: "Apenas especialistas podem criar agendas." };
    }

    // 🔥 BUSCA O CÓDIGO DA EMPRESA DIRETAMENTE DA ABA TEMPORARIO
    let codigoempresaReal = userCodigoEmpresa;
    const resTemp = _obterDados(NOME_ABA_TEMPORARIO);
    if (resTemp.sucesso) {
      const { values: dataTemp, headers: headersTemp } = resTemp;
      const emailIdx = _encontrarColuna(headersTemp, ["email"]);
      const codEmpIdx = _encontrarColuna(headersTemp, ["codigoempresa"]);
      if (emailIdx > -1 && codEmpIdx > -1) {
        for (let i = 1; i < dataTemp.length; i++) {
          if (String(dataTemp[i][emailIdx]).trim().toLowerCase() === String(userEmail).trim().toLowerCase()) {
            const cod = String(dataTemp[i][codEmpIdx]).trim();
            if (cod) codigoempresaReal = cod;
            break;
          }
        }
      }
    }

    const totalColunas = cabecalhoAgendas.length;

    // Mapeamento Dinâmico de Colunas
    const colAtiv = _encontrarColuna(cabecalhoAgendas, ["Atividade"]);
    const colUlt = _encontrarColuna(cabecalhoAgendas, ["Ultimoevento"]);
    const colForma = _encontrarColuna(cabecalhoAgendas, ["Formadaconsulta"]);
    const colCodEsp = _encontrarColuna(cabecalhoAgendas, ["Especialista"]);
    const colEspAg = _encontrarColuna(cabecalhoAgendas, ["NomeEspecialista"]);
    const colCelEspAg = _encontrarColuna(cabecalhoAgendas, ["CelularEspecialista"]);
    const colProp = _encontrarColuna(cabecalhoAgendas, ["Proprietario"]);
    const colData = _encontrarColuna(cabecalhoAgendas, ["Data"]);
    const colIni = _encontrarColuna(cabecalhoAgendas, ["Horarioinicio"]);
    const colFim = _encontrarColuna(cabecalhoAgendas, ["HorarioFim"]);
    const colStatus = _encontrarColuna(cabecalhoAgendas, ["Status"]);
    const colCodEmpresaAg = _encontrarColuna(cabecalhoAgendas, ["codigoempresa"]);

    if (colData === -1 || colIni === -1 || colFim === -1 || colProp === -1) {
      return { success: false, error: "Colunas obrigatórias não encontradas na aba Agendas." };
    }

    let lista = Array.isArray(agendamentos) ? agendamentos : [];
    if (lista.length === 0) return { success: false, error: "Nenhum agendamento recebido válido." };

    let temConflito = false;
    for (let i = 0; i < lista.length; i++) {
      let ag = lista[i];
      for (let r = 1; r < dadosAgendas.length; r++) {
        let row = dadosAgendas[r];
        if (String(row[colProp]).toLowerCase() === userEmail.toLowerCase() &&
          row[colStatus] !== "Cancelado" && row[colStatus] !== "Arquivado") {

          let dataRow = formatDateToISO(row[colData]);
          if (dataRow === ag.data) {
            let iniRow = String(row[colIni]);
            let fimRow = String(row[colFim]);
            if (ag.ini < fimRow && ag.fim > iniRow) {
              temConflito = true;
              break;
            }
          }
        }
      }
      if (temConflito) break;
    }

    if (temConflito) return { success: false, conflict: true };

    const agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy - EEEE - HH:mm");
    let linhasParaInserir = [];

    for (let ag of lista) {
      let novaLinha = new Array(totalColunas).fill("");
      if (colAtiv > -1) novaLinha[colAtiv] = "Consulta";
      if (colUlt > -1) novaLinha[colUlt] = agora;
      if (colForma > -1) novaLinha[colForma] = "Presencial ou On-Line";
      if (colEspAg > -1) novaLinha[colEspAg] = userRoleInfo.nomeEsp;
      if (colCelEspAg > -1) novaLinha[colCelEspAg] = userRoleInfo.celEsp;
      if (colProp > -1) novaLinha[colProp] = userEmail;
      if (colData > -1) novaLinha[colData] = formatarDataParaPlanilha(ag.data);
      if (colIni > -1) novaLinha[colIni] = ag.ini;
      if (colFim > -1) novaLinha[colFim] = ag.fim;
      if (colStatus > -1) novaLinha[colStatus] = ag.status || "Indefinido";
      if (colCodEmpresaAg > -1) novaLinha[colCodEmpresaAg] = codigoempresaReal;

      linhasParaInserir.push(novaLinha);
    }

    if (linhasParaInserir.length > 0) {
      sheetAgendas.getRange(sheetAgendas.getLastRow() + 1, 1, linhasParaInserir.length, totalColunas).setValues(linhasParaInserir);
      return { success: true, count: linhasParaInserir.length };
    }
    return { success: false, error: "Nenhum agendamento processado." };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Insere um novo agendamento diretamente na aba Consultas vindo de webhook (n8n)
 * @param {Object} payload Dados completos enviados pelo n8n
 */
function registrarAgendamentoWebhook(payload) {
  try {
    const res = _obterDados(NOME_ABA_CONSULTAS);
    if (!res.sucesso) return res;
    const { sheet: sheetConsultas, headers: cabecalho } = res;

    const totalColunas = cabecalho.length;
    let novaLinha = new Array(totalColunas).fill("");

    // MAPEAMENTO PERFEITO (Baseado nas colunas exatas do seu CSV de Consultas)
    const mapeamento = {
      "Data": payload.Data || "",
      "Forma da Consulta": payload["Forma da Consulta"] || payload.Forma_da_Consulta || "",
      "Codigo_Especialista": payload.Codigo_Especialista || "",
      "Nome_Especialista": payload.Nome_Especialista || "",
      "Celular_Especialista": payload.Celular_Especialista || "",
      "Data_Consulta": payload.Data_Consulta || "",
      "Horário início": payload["Horário início"] || payload.Horario_inicio || "",
      "Horário Fim": payload["Horário Fim"] || payload.Horario_Fim || "",
      "Especialidade": payload.Especialidade || "",
      "Valor": payload.Valor || "",
      "Cliente": payload.Cliente || "",
      "Celular_Cliente": payload.Celular_Cliente || "",
      "Status": payload.Status || "Não confirmado",
      "Local": payload.Local || "",
      "ID_pagamento": payload.ID_pagamento || "",
      "Status_pagamento": payload.Status_pagamento || "",
      "Link_pagamento": payload.Link_pagamento || payload.Link_Pagamento || "",
      "Status_cliente": payload.Status_cliente || "",
      "Email_Especialista": payload.Email_Especialista || "",
      "Codigo_produto": payload.Codigo_produto || "",
      "codigoempresa": payload.codigoempresa || ""
    };

    // Insere cada dado exatamente na coluna que tem o mesmo nome
    for (let nomeColuna in mapeamento) {
      let idx = _encontrarColuna(cabecalho, [nomeColuna]);
      if (idx > -1) {
        novaLinha[idx] = mapeamento[nomeColuna];
      }
    }

    // Salva a linha diretamente na aba Consultas
    sheetConsultas.appendRow(novaLinha);

    return { sucesso: true, mensagem: "Agendamento inserido com sucesso na aba Consultas!", id_pagamento: payload.ID_pagamento };
  } catch (e) {
    return { sucesso: false, erro: "Erro no serviço: " + e.toString() };
  }
}

// ==============================================================================
// GESTÃO GERAL DA AGENDA E CONSULTAS
// ==============================================================================
function getAgendaData(email, userCodigoEmpresa) {
  try {
    limparAgendasAutomaticamente();
    const emailUser = email.toLowerCase().trim();
    let tipoUsuario = "Especialista"; let nomeUsuario = "";
    const scriptProps = PropertiesService.getScriptProperties().getProperties();
    const janelaPropria = scriptProps['janela_' + emailUser] || "";

    let codigoempresaReal = userCodigoEmpresa;
    const resTemp = _obterDados(NOME_ABA_TEMPORARIO);
    if (resTemp.sucesso) {
      const { displayValues: dadosTemp, headers: headersTemp } = resTemp;
      const emailIdx = _encontrarColuna(headersTemp, ["email"]);
      const nomeIdx = _encontrarColuna(headersTemp, ["nome_sobrenome"]);
      const tipoIdx = _encontrarColuna(headersTemp, ["tipousuario"]);
      const codEmpIdx = _encontrarColuna(headersTemp, ["codigoempresa"]);

      for (let i = 1; i < dadosTemp.length; i++) {
        if (dadosTemp[i][emailIdx] && dadosTemp[i][emailIdx].toString().toLowerCase().trim() === emailUser) {
          nomeUsuario = dadosTemp[i][nomeIdx].toString().trim();
          tipoUsuario = dadosTemp[i][tipoIdx].toString().trim();
          const codBanco = String(dadosTemp[i][codEmpIdx] || "").trim();
          if (codBanco) codigoempresaReal = codBanco;
          break;
        }
      }
    }

    const isCliente = (tipoUsuario === "Cliente");
    const resultados = [];
    const historicoClientes = {};
    const resCons = _obterDados(NOME_ABA_CONSULTAS);

    if (resCons.sucesso) {
      const { displayValues: dadosConsRaw, headers: headersCons } = resCons;
      const statusIdxCons = _encontrarColuna(headersCons, ["Status"]);
      const celIdxCons = _encontrarColuna(headersCons, ["Celular_Cliente"]);
      const nomeIdxCons = _encontrarColuna(headersCons, ["Cliente"]);
      const dataIdxCons = _encontrarColuna(headersCons, ["Data_Consulta", "Data da Consulta"]);
      const hIniIdxCons = _encontrarColuna(headersCons, ["Horário início", "Horarioinicio"]);

      for (let i = 1; i < dadosConsRaw.length; i++) {
        if (String(dadosConsRaw[i][statusIdxCons] || "").trim() === "Atendido") {
          let cel = (dadosConsRaw[i][celIdxCons] || "").trim();
          let nome = (dadosConsRaw[i][nomeIdxCons] || "").trim().toLowerCase();
          let key = cel || nome;
          if (key) {
            if (!historicoClientes[key]) historicoClientes[key] = [];
            historicoClientes[key].push({ ts: parseDateBackend(dadosConsRaw[i][dataIdxCons], dadosConsRaw[i][hIniIdxCons] || "00:00"), str: dadosConsRaw[i][dataIdxCons] });
          }
        }
      }
    }

    function buscarUltEv(key, currentTs) {
      if (!key || !historicoClientes[key]) return "";
      let maxTs = 0; let resultStr = "";
      for (let idx = 0; idx < historicoClientes[key].length; idx++) { let h = historicoClientes[key][idx]; if (h.ts < currentTs && h.ts > maxTs) { maxTs = h.ts; resultStr = h.str; } }
      return resultStr;
    }

    const resAg = _obterDados(NOME_ABA_AGENDA);
    if (resAg.sucesso) {
      const { displayValues: dadosAg, headers: cabecalhoAg } = resAg;
      const colCodEmpresaAg = _encontrarColuna(cabecalhoAg, ["codigoempresa"]);
      const colStatusAg = _encontrarColuna(cabecalhoAg, ["Status"]);
      const colPropAg = _encontrarColuna(cabecalhoAg, ["Proprietario"]);
      const colCliAg = _encontrarColuna(cabecalhoAg, ["Cliente"]);
      const colCelAg = _encontrarColuna(cabecalhoAg, ["Celular_Cliente"]);
      const colDataAg = _encontrarColuna(cabecalhoAg, ["Data"]);
      const colIniAg = _encontrarColuna(cabecalhoAg, ["Horarioinicio"]);

      for (let i = 1; i < dadosAg.length; i++) {
        const row = dadosAg[i];
        if (colCodEmpresaAg > -1) {
          const codEmpLinha = String(row[colCodEmpresaAg] || "").trim();
          if (codEmpLinha !== "" && codEmpLinha !== String(codigoempresaReal).trim()) continue;
        }

        if (isCliente) { if (!row[colCliAg] || row[colCliAg].toString().trim().toLowerCase() !== nomeUsuario.toLowerCase()) continue; const st = (row[colStatusAg] || "").trim(); if (st !== "Confirmado" && st !== "Atendido") continue; }
        else { if (!row[colPropAg] || row[colPropAg].toLowerCase().trim() !== emailUser) continue; const st = (row[colStatusAg] || "").trim(); if (st !== "Disponível" && st !== "Indefinido" && st !== "Atendido" && st !== "") continue; }

        let keyAg = (row[colCelAg] || "").trim() || (row[colCliAg] || "").trim().toLowerCase();
        let curTsAg = parseDateBackend(planilhaParaHtmlData(row[colDataAg]), row[colIniAg] || "00:00");
        let ultEvFinal = buscarUltEv(keyAg, curTsAg) || row[1]; // row[1] = Ultimoevento

        let emailPropAg = (row[colPropAg] || "").toLowerCase().trim();
        let janelaEspAg = scriptProps['janela_' + emailPropAg] || "";

        resultados.push({ id_unico: 'A-' + (i + 1), planilha: 'Agendas', row: i + 1, ativ: row[0], ult_ev: ultEvFinal, forma: row[2], esp: row[3], nome_esp: row[5], prop: row[6], data: planilhaParaHtmlData(row[7]), h_ini: row[8], h_fim: row[9], especialidade: row[10], cli: row[11], cel_cli: row[12], status: (row[13] || "").trim() || "Indefinido", local: row[14], id_pag: row[15], link_pag: row[16], valor: row[17], status_conf: row[18], obs: row[19], obs_cliente: "", relatorio: "", status_cliente: "", obs_para_cliente: "", visto_cli: "", visto_p_cli: "", janela: janelaEspAg });
      }
    }

    if (resCons.sucesso) {
      const { displayValues: dadosConsRaw, headers: cabecalhoCons } = resCons;
      const colCodEmpresaCons = _encontrarColuna(cabecalhoCons, ["codigoempresa", "codigo_empresa"]);
      const colCliCons = _encontrarColuna(cabecalhoCons, ["Cliente"]);
      const colStatusCons = _encontrarColuna(cabecalhoCons, ["Status"]);
      const colPropCons = _encontrarColuna(cabecalhoCons, ["Email_Especialista", "Proprietario"]);
      const colCelCons = _encontrarColuna(cabecalhoCons, ["Celular_Cliente"]);
      const colDataCons = _encontrarColuna(cabecalhoCons, ["Data_Consulta", "Data da Consulta"]);
      const colIniCons = _encontrarColuna(cabecalhoCons, ["Horário início", "Horarioinicio"]);

      for (let i = 1; i < dadosConsRaw.length; i++) {
        const row = dadosConsRaw[i];
        if (colCodEmpresaCons > -1) {
          const codEmpLinha = String(row[colCodEmpresaCons] || "").trim();
          if (codEmpLinha !== "" && codEmpLinha !== String(codigoempresaReal).trim()) continue;
        }

        if (isCliente) {
          if (!row[colCliCons] || row[colCliCons].toString().trim().toLowerCase() !== nomeUsuario.toLowerCase()) continue;
          const st = (row[colStatusCons] || "").trim();
          if (st !== "Confirmado" && st !== "Atendido") continue;
        } else { if (!row[colPropCons] || row[colPropCons].toLowerCase().trim() !== emailUser) continue; }

        let keyCons = (row[colCelCons] || "").trim() || (row[colCliCons] || "").trim().toLowerCase();
        let curTsCons = parseDateBackend(planilhaParaHtmlData(row[colDataCons]), row[colIniCons] || "00:00");
        let calcUltEvCons = buscarUltEv(keyCons, curTsCons);

        let emailPropCons = (row[colPropCons] || "").toLowerCase().trim();
        let janelaEspCons = scriptProps['janela_' + emailPropCons] || "";

        resultados.push({ id_unico: 'C-' + (i + 1), planilha: 'Consultas', row: i + 1, ativ: "Consulta", ult_ev: calcUltEvCons, forma: row[1], esp: row[2], nome_esp: row[3], prop: row[21], data: planilhaParaHtmlData(row[5]), h_ini: row[6], h_fim: row[7], especialidade: row[8], cli: row[10], cel_cli: row[11], status: (row[12] || "").trim(), local: row[13], id_pag: row[14], link_pag: row[16], valor: row[9], status_conf: row[15], obs: row[17], obs_cliente: row[18] || "", relatorio: row[19] || "", status_cliente: row[20] || "", obs_para_cliente: row[22] || "", visto_cli: row[23] || "", visto_p_cli: row[24] || "", janela: janelaEspCons });
      }
    }
    return { success: true, data: resultados, tipoUsuario: tipoUsuario, janelaPropria: janelaPropria };
  } catch (e) { return { error: "Erro Backend: " + e.toString() }; }
}

function parseDateBackend(dataStr, horaStr) {
  if (!dataStr) return 0;
  const p = dataStr.split('-');
  const h = horaStr.split(':');
  if (p.length === 3 && h.length === 2) {
    return new Date(p[0], parseInt(p[1]) - 1, p[2], h[0], h[1]).getTime();
  }
  return 0;
}

function planilhaParaHtmlData(val) {
  if (!val) return "";
  if (val instanceof Date) {
    let d = val.getDate(); let m = val.getMonth() + 1; let y = val.getFullYear();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
  }
  let s = String(val).trim();
  if (s.includes('/')) {
    let p = s.split('/');
    if (p.length === 3) return p[2] + '-' + (p[1].length === 1 ? '0' + p[1] : p[1]) + '-' + (p[0].length === 1 ? '0' + p[0] : p[0]);
  }
  if (s.includes('-')) return s.substring(0, 10);
  return s;
}

function limparAgendasAutomaticamente() {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sheet = ss.getSheetByName(NOME_ABA_AGENDA);
    if (!sheet) return;

    const dados = sheet.getDataRange().getValues();
    const agoraTs = new Date().getTime();
    let chavesVistas = new Set();

    for (let i = dados.length - 1; i >= 1; i--) {
      const row = dados[i];
      const codEspecialista = row[3];
      const dataCell = row[7];
      const horaIniStr = row[8];
      const horaFimStr = row[9];
      const status = (row[13] || "").toString().trim();

      let deveDeletar = false;

      if (dataCell) {
        let dtObj = null;
        if (dataCell instanceof Date) { dtObj = new Date(dataCell.getTime()); } else if (typeof dataCell === 'string') { if (dataCell.includes('/')) { let p = dataCell.split('/'); if (p.length === 3) dtObj = new Date(p[2], p[1] - 1, p[0]); } else if (dataCell.includes('-')) { let p = dataCell.split('-'); if (p.length === 3) dtObj = new Date(p[0], p[1] - 1, p[2]); } }
        if (dtObj) {
          let h = 23, m = 59; let horaReferencia = horaFimStr || horaIniStr;
          if (horaReferencia instanceof Date) { h = horaReferencia.getHours(); m = horaReferencia.getMinutes(); } else if (typeof horaReferencia === 'string' && horaReferencia.includes(':')) { let hp = horaReferencia.split(':'); h = parseInt(hp[0], 10); m = parseInt(hp[1], 10); }
          dtObj.setHours(h, m, 0, 0);
          if (dtObj.getTime() < agoraTs) { deveDeletar = true; }
        }
      }

      if (!deveDeletar && (status === "Disponível" || status === "Indefinido" || status === "")) {
        const chaveUnica = `${codEspecialista}_${String(dataCell)}_${String(horaIniStr)}_${String(horaFimStr)}`;
        if (chavesVistas.has(chaveUnica)) { deveDeletar = true; } else { chavesVistas.add(chaveUnica); }
      }

      if (deveDeletar) { sheet.deleteRow(i + 1); }
    }
  } catch (e) { }
}

function atualizarOuCriarNaAgenda(ss, dadosOrigConsulta, novoStatus, limparCliente) {
  const sheetAg = ss.getSheetByName(NOME_ABA_AGENDA); const idPagamentoAlvo = dadosOrigConsulta[14]; const dadosAg = sheetAg.getDataRange().getValues(); let linhaEncontrada = -1;
  if (idPagamentoAlvo) { for (let i = 1; i < dadosAg.length; i++) { if (dadosAg[i][15] && dadosAg[i][15].toString() === idPagamentoAlvo.toString()) { linhaEncontrada = i + 1; break; } } }
  if (linhaEncontrada > 0) { if (limparCliente) { sheetAg.getRange(linhaEncontrada, 11, 1, 3).clearContent(); sheetAg.getRange(linhaEncontrada, 15, 1, 10).clearContent(); sheetAg.getRange(linhaEncontrada, 14).setValue("Disponível"); } else { sheetAg.getRange(linhaEncontrada, 14).setValue(novoStatus); } }
}

function marcarAtendido(idUnico) { try { const ss = SpreadsheetApp.openById(PLANILHA_ID); const parts = idUnico.split('-'); const linha = parseInt(parts[1]); const sheetCons = ss.getSheetByName(NOME_ABA_CONSULTAS); sheetCons.getRange(linha, 13).setValue("Atendido"); const dadosOrig = sheetCons.getRange(linha, 1, 1, 25).getValues()[0]; atualizarOuCriarNaAgenda(ss, dadosOrig, "Atendido", false); return { success: true }; } catch (e) { return { error: e.toString() }; } }
function marcarCancelado(idUnico) { try { const ss = SpreadsheetApp.openById(PLANILHA_ID); const parts = idUnico.split('-'); const linha = parseInt(parts[1]); const sheetCons = ss.getSheetByName(NOME_ABA_CONSULTAS); sheetCons.getRange(linha, 13).setValue("Cancelado"); const dadosOrig = sheetCons.getRange(linha, 1, 1, 25).getValues()[0]; atualizarOuCriarNaAgenda(ss, dadosOrig, "Disponível", true); return { success: true }; } catch (e) { return { error: e.toString() }; } }
function excluirLinha(id) { try { const ss = SpreadsheetApp.openById(PLANILHA_ID); const parts = id.split('-'); const tipo = parts[0]; const linha = parseInt(parts[1]); const sheet = (tipo === 'A') ? ss.getSheetByName(NOME_ABA_AGENDA) : ss.getSheetByName(NOME_ABA_CONSULTAS); sheet.deleteRow(linha); return { success: true }; } catch (e) { return { error: e.toString() }; } }

function atualizarLocalIsolado(idUnico, novoLocal) {
  try { const ss = SpreadsheetApp.openById(PLANILHA_ID); const parts = idUnico.split('-'); const tipo = parts[0]; const numLinha = parseInt(parts[1]); let sheet; let colIndex; if (tipo === 'A') { sheet = ss.getSheetByName(NOME_ABA_AGENDA); colIndex = 15; } else { sheet = ss.getSheetByName(NOME_ABA_CONSULTAS); colIndex = 14; } sheet.getRange(numLinha, colIndex).setValue(novoLocal); return { success: true }; } catch (e) { return { success: false, error: e.toString() }; }
}

function formatarDataParaPlanilha(dataIso) {
  if (!dataIso) return "";
  let p = dataIso.split('-');
  if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
  return dataIso;
}

function formatDateToISO(cellValue) {
  if (!cellValue) return "";
  if (cellValue instanceof Date) {
    let d = cellValue.getDate(); let m = cellValue.getMonth() + 1; let y = cellValue.getFullYear();
    return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  }
  let s = String(cellValue).trim();
  if (s.includes('/')) {
    let p = s.split('/');
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  if (s.includes('-')) return s.substring(0, 10);
  return s;
}

function salvarAlteracao(idUnico, d, userCodigoEmpresa) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const tipo = idUnico.toString().split('-')[0];
    const numLinha = parseInt(idUnico.toString().split('-')[1]);

    if (d.status !== "Cancelado" && d.status !== "Arquivado" && d.status !== "Disponível" && d.status !== "Indefinido" && d.status !== "") {
      const emailLogado = d.prop.toLowerCase().trim();
      const sheetAg = ss.getSheetByName(NOME_ABA_AGENDA);
      const dadosAg = sheetAg.getDataRange().getValues();
      const sheetCons = ss.getSheetByName(NOME_ABA_CONSULTAS);
      const dadosCons = sheetCons ? sheetCons.getDataRange().getValues() : [];

      for (let i = 1; i < dadosAg.length; i++) {
        if (tipo === 'A' && (i + 1) === numLinha) continue;
        let st = (dadosAg[i][13] || "").toString().trim();
        if (st === "Cancelado" || st === "Arquivado" || st === "Disponível" || st === "Indefinido" || st === "") continue;
        if ((dadosAg[i][6] || "").toString().toLowerCase().trim() !== emailLogado) continue;

        if (formatDateToISO(dadosAg[i][7]) === d.data) {
          let ini = (dadosAg[i][8] || "00:00").toString();
          let fim = (dadosAg[i][9] || "00:00").toString();
          if (d.h_ini < fim && d.h_fim > ini) {
            return { success: false, conflict: true };
          }
        }
      }
      for (let i = 1; i < dadosCons.length; i++) {
        if (tipo === 'C' && (i + 1) === numLinha) continue;
        let st = (dadosCons[i][12] || "").toString().trim();
        if (st === "Cancelado" || st === "Arquivado" || st === "Disponível" || st === "Indefinido" || st === "") continue;
        if ((dadosCons[i][21] || "").toString().toLowerCase().trim() !== emailLogado) continue;

        if (formatDateToISO(dadosCons[i][5]) === d.data) {
          let ini = (dadosCons[i][6] || "00:00").toString();
          let fim = (dadosCons[i][7] || "00:00").toString();
          if (d.h_ini < fim && d.h_fim > ini) {
            return { success: false, conflict: true };
          }
        }
      }
    }

    if (tipo === 'A') {
      const sheet = ss.getSheetByName(NOME_ABA_AGENDA);
      if (d.status !== "Disponível" && d.status !== "Indefinido" && d.status !== "") { moverParaConsultas(sheet, numLinha, d, userCodigoEmpresa); return { success: true, movido: true }; }
      const maxCol = Math.max(sheet.getLastColumn(), 20); const range = sheet.getRange(numLinha, 1, 1, maxCol); const vals = range.getValues()[0];
      vals[0] = d.ativ; vals[1] = d.ult_ev; vals[2] = d.forma; vals[7] = formatarDataParaPlanilha(d.data); vals[8] = d.h_ini; vals[9] = d.h_fim; vals[13] = d.status; vals[19] = d.obs;
      range.setValues([vals]);
    } else if (tipo === 'C') {
      const sheet = ss.getSheetByName(NOME_ABA_CONSULTAS); const maxCol = Math.max(sheet.getLastColumn(), 25); const range = sheet.getRange(numLinha, 1, 1, maxCol); const vals = range.getValues()[0];
      vals[1] = d.forma; vals[5] = formatarDataParaPlanilha(d.data); vals[6] = d.h_ini; vals[7] = d.h_fim; vals[12] = d.status; vals[17] = d.obs; vals[18] = d.obs_cliente; vals[22] = d.obs_para_cliente; vals[23] = d.visto_cli; vals[24] = d.visto_p_cli;
      range.setValues([vals]);
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.toString() }; }
}

function moverParaConsultas(sheetAg, linhaAg, d, userCodigoEmpresa) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sheetCons = ss.getSheetByName(NOME_ABA_CONSULTAS);

  const cabecalhoAg = sheetAg.getRange(1, 1, 1, sheetAg.getLastColumn()).getValues()[0];
  const dadosOrig = sheetAg.getRange(linhaAg, 1, 1, sheetAg.getLastColumn()).getValues()[0];

  const colCodEmpresaAg = encontrarColuna(cabecalhoAg, "codigoempresa");
  let codigoempresaReal = userCodigoEmpresa;

  // Se veio vazio do front, tenta pegar da linha original na Agenda
  if (!codigoempresaReal && colCodEmpresaAg > -1) {
    codigoempresaReal = dadosOrig[colCodEmpresaAg];
  }

  const cabecalhoCons = sheetCons.getRange(1, 1, 1, sheetCons.getLastColumn()).getValues()[0];
  const colCodEmpresaCons = encontrarColuna(cabecalhoCons, "codigoempresa");

  // Mapeamento manual mantendo a ordem esperada da aba Consultas
  const novaLinha = [
    new Date(),                      // 0: Timestamp
    d.forma,                         // 1: Forma
    dadosOrig[3],                    // 2: Especialista Cod
    dadosOrig[5],                    // 3: Nome Especialista
    dadosOrig[4],                    // 4: Celular Especialista
    formatarDataParaPlanilha(d.data), // 5: Data
    d.h_ini,                         // 6: Início
    d.h_fim,                         // 7: Fim
    dadosOrig[10],                   // 8: Especialidade
    dadosOrig[17],                   // 9: Valor
    dadosOrig[11],                   // 10: Cliente
    dadosOrig[12],                   // 11: Celular Cliente
    d.status,                        // 12: Status
    dadosOrig[14],                   // 13: Local
    dadosOrig[15],                   // 14: ID Pag
    dadosOrig[18],                   // 15: Status Conf
    dadosOrig[16],                   // 16: Link Pag
    d.obs,                           // 17: Obs
    d.obs_cliente || "",             // 18: Obs Cliente
    "",                              // 19: Relatorio
    "",                              // 20: Status Cliente
    d.prop,                          // 21: Proprietario (E-mail)
    d.obs_para_cliente || "",        // 22: Obs para Cliente
    d.visto_cli || "",               // 23: Visto Cli
    d.visto_p_cli || ""              // 24: Visto p Cli
  ];

  // 🔥 ADICIONA O CÓDIGO DA EMPRESA SE A COLUNA EXISTIR EM CONSULTAS
  if (colCodEmpresaCons > -1) {
    // Garante que o array tenha tamanho suficiente
    while (novaLinha.length < colCodEmpresaCons) novaLinha.push("");
    novaLinha[colCodEmpresaCons] = codigoempresaReal;
  } else {
    // Se não existir a coluna, adiciona ao final por segurança
    novaLinha.push(codigoempresaReal);
  }

  sheetCons.appendRow(novaLinha);
  sheetAg.deleteRow(linhaAg);
}

// INTEGRAÇÕES WHATSAPP E N8N
function listarDisponiveis(data, especialistaEmail) {
  try {
    limparAgendasAutomaticamente();
    const res = _obterDados(NOME_ABA_AGENDA);
    if (!res.sucesso) return [];
    const { displayValues: dadosAg, headers } = res;

    const indexData = _encontrarColuna(headers, ["Data"]);
    const indexProprietario = _encontrarColuna(headers, ["Proprietario", "Proprietário"]);
    const indexStatus = _encontrarColuna(headers, ["Status"]);
    const indexHorarioInicio = _encontrarColuna(headers, ["Horarioinicio", "Horário início"]);

    const resultados = [];
    for (let i = 1; i < dadosAg.length; i++) {
      const row = dadosAg[i];
      const statusRaw = String(row[indexStatus] || "");
      if (statusRaw.trim().toLowerCase() !== "disponível") continue;

      if (data) {
        let stringDataPlanilha = String(row[indexData] || "").trim();
        if (stringDataPlanilha !== String(data).trim()) continue;
      }

      if (especialistaEmail) {
        let emailProp = String(row[indexProprietario] || "").toLowerCase().trim();
        if (emailProp !== String(especialistaEmail).toLowerCase().trim()) continue;
      }

      let horarioEncontrado = String(row[indexHorarioInicio] || "").trim();
      if (horarioEncontrado) { resultados.push(horarioEncontrado); }
    }
    return resultados;
  } catch (e) { return { erro: "Erro ao listar disponíveis: " + e.toString() }; }
}

function listarDatasDisponiveis(especialistaCodigo, codigoempresaAlvo) {
  try {
    limparAgendasAutomaticamente();
    const res = _obterDados(NOME_ABA_AGENDA);
    if (!res.sucesso) return { sucesso: false, erro: res.erro };
    const { displayValues: dadosAg, headers } = res;

    if (dadosAg.length <= 1) return { sucesso: true, codigoEspecialista: especialistaCodigo, datasDisponiveis: [] };

    const idxStatus = _encontrarColuna(headers, ["Status"]);
    const idxData = _encontrarColuna(headers, ["Data"]);
    const idxEsp = _encontrarColuna(headers, ["Especialista"]);
    const idxForma = _encontrarColuna(headers, ["Formadaconsulta", "Forma da consulta"]);
    const idxHIni = _encontrarColuna(headers, ["Horarioinicio", "Horário início"]);
    const idxEmpresa = _encontrarColuna(headers, ["codigoempresa", "codigo_empresa"]);
    const idxNomeEsp = _encontrarColuna(headers, ["NomeEspecialista", "Nome do Especialista"]);
    const idxCelEsp = _encontrarColuna(headers, ["CelularEspecialista", "Celular do Especialista"]);

    const datasMap = new Map();
    const tempoLimite = new Date();
    tempoLimite.setHours(tempoLimite.getHours() + 4);

    for (let i = 1; i < dadosAg.length; i++) {
      const row = dadosAg[i];
      const statusRaw = String(row[idxStatus] || "").trim().toLowerCase();
      if (statusRaw !== "disponível") continue;

      const espRaw = String(row[idxEsp] || "").trim();
      if (espRaw !== String(especialistaCodigo).trim()) continue;

      if (idxEmpresa !== -1) {
        const empRaw = String(row[idxEmpresa] || "").trim().toLowerCase();
        if (empRaw !== String(codigoempresaAlvo).trim().toLowerCase()) continue;
      } else {
        continue;
      }

      const dataCell = String(row[idxData] || "").trim();
      const horaIniCell = String(row[idxHIni] || "").trim();

      if (!dataCell || !horaIniCell) continue;

      const [dia, mes, ano] = dataCell.split('/');
      const [hora, min] = horaIniCell.split(':');
      if (!dia || !mes || !ano || !hora || !min) continue;

      const dataHoraPlanilha = new Date(ano, mes - 1, dia, hora, min);

      if (dataHoraPlanilha > tempoLimite) {
        if (!datasMap.has(dataCell)) {
          datasMap.set(dataCell, {
            data: dataCell,
            formaAtendimento: String(row[idxForma] || "").trim(),
            codigoEspecialista: espRaw,
            nomeEspecialista: String(row[idxNomeEsp] || "").trim(),
            celularEspecialista: String(row[idxCelEsp] || "").trim()
          });
        }
      }
    }

    let datasArray = Array.from(datasMap.values());
    datasArray.sort((a, b) => {
      const [diaA, mesA, anoA] = a.data.split('/');
      const [diaB, mesB, anoB] = b.data.split('/');
      return new Date(anoA, mesA - 1, diaA).getTime() - new Date(anoB, mesB - 1, diaB).getTime();
    });

    const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const waRows = datasArray.map(item => {
      const [dia, mes, ano] = item.data.split('/');
      const dtObj = new Date(ano, mes - 1, dia);
      const nomeDia = diasDaSemana[dtObj.getDay()];

      const waId = `dataVerHorarios_${item.codigoEspecialista}_${item.data}`.substring(0, 200);
      const waTitle = `🗓️ ${item.data} - ${nomeDia}`.substring(0, 24);
      const waDesc = `${item.nomeEspecialista} - ${item.formaAtendimento}`.substring(0, 72);

      return { id: waId, title: waTitle, description: waDesc };
    });

    const mensagensWhatsApp = [];
    const chunkSize = 10;
    for (let i = 0; i < waRows.length; i += chunkSize) {
      const chunk = waRows.slice(i, i + chunkSize);
      mensagensWhatsApp.push({
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "Datas Disponíveis" },
          body: { text: "Selecione a data desejada para o atendimento:" },
          action: {
            button: "Ver Datas",
            sections: [{ title: "Agendamento", rows: chunk }]
          }
        }
      });
    }

    return {
      sucesso: true,
      codigoEspecialista: especialistaCodigo,
      datasDisponiveis: datasArray,
      mensagensWhatsApp: mensagensWhatsApp
    };
  } catch (e) { return { sucesso: false, erro: e.toString() }; }
}

function listarHorariosDisponiveis(especialistaCodigo, dataAlvo, codigoempresaAlvo) {
  try {
    limparAgendasAutomaticamente();
    const res = _obterDados(NOME_ABA_AGENDA);
    if (!res.sucesso) return { sucesso: false, erro: res.erro };
    const { displayValues: dadosAg, headers } = res;

    if (dadosAg.length <= 1) return { sucesso: true, dadosEspecialista: {}, horarios: [] };

    const idxStatus = _encontrarColuna(headers, ["Status"]);
    const idxData = _encontrarColuna(headers, ["Data"]);
    const idxEsp = _encontrarColuna(headers, ["Especialista"]);
    const idxHIni = _encontrarColuna(headers, ["Horarioinicio", "Horário início"]);
    const idxHFim = _encontrarColuna(headers, ["HorarioFim", "Horário fim"]);
    const idxNomeEsp = _encontrarColuna(headers, ["NomeEspecialista", "Nome do Especialista"]);
    const idxCelEsp = _encontrarColuna(headers, ["CelularEspecialista", "Celular do Especialista"]);
    const idxProp = _encontrarColuna(headers, ["Proprietario", "Proprietário"]);
    const idxForma = _encontrarColuna(headers, ["Formadaconsulta", "Forma da consulta"]);
    const idxEmpresa = _encontrarColuna(headers, ["codigoempresa", "codigo_empresa"]);

    const horarios = [];
    let dadosEspecialista = null;

    const tempoLimite = new Date();
    tempoLimite.setHours(tempoLimite.getHours() + 4);

    for (let i = 1; i < dadosAg.length; i++) {
      const row = dadosAg[i];
      const statusRaw = String(row[idxStatus] || "").trim().toLowerCase();
      if (statusRaw !== "disponível") continue;

      const espRaw = String(row[idxEsp] || "").trim();
      if (espRaw !== String(especialistaCodigo).trim()) continue;

      if (idxEmpresa !== -1) {
        const empRaw = String(row[idxEmpresa] || "").trim().toLowerCase();
        if (empRaw !== String(codigoempresaAlvo).trim().toLowerCase()) continue;
      } else { continue; }

      const dataCell = String(row[idxData] || "").trim();
      if (dataCell !== String(dataAlvo).trim()) continue;

      const horaIniCell = String(row[idxHIni] || "").trim();
      if (!horaIniCell) continue;

      const [dia, mes, ano] = dataCell.split('/');
      const [hora, min] = horaIniCell.split(':');
      if (!dia || !mes || !ano || !hora || !min) continue;

      const dataHoraPlanilha = new Date(ano, mes - 1, dia, hora, min);

      if (dataHoraPlanilha <= tempoLimite) { continue; }

      if (!dadosEspecialista) {
        dadosEspecialista = {
          codigoEspecialista: espRaw,
          nomeEspecialista: String(row[idxNomeEsp] || "").trim(),
          celularEspecialista: String(row[idxCelEsp] || "").trim(),
          emailEspecialista: String(row[idxProp] || "").trim()
        };
      }

      horarios.push({
        dataInicio: String(row[idxHIni] || "").trim(),
        dataFim: String(row[idxHFim] || "").trim(),
        formaAtendimento: String(row[idxForma] || "").trim(),
        codigoEspecialista: espRaw,
        nomeEspecialista: String(row[idxNomeEsp] || "").trim(),
        celularEspecialista: String(row[idxCelEsp] || "").trim()
      });
    }

    const horariosMap = new Map();
    for (const h of horarios) { if (!horariosMap.has(h.dataInicio)) { horariosMap.set(h.dataInicio, h); } }
    const horariosUnicos = Array.from(horariosMap.values());

    horariosUnicos.sort((a, b) => {
      const [hA, mA] = a.dataInicio.split(':');
      const [hB, mB] = b.dataInicio.split(':');
      return new Date(1970, 0, 1, hA, mA).getTime() - new Date(1970, 0, 1, hB, mB).getTime();
    });

    const waRows = horariosUnicos.map(item => {
      const waId = `horaDeAgendamento_${item.codigoEspecialista}_${dataAlvo}_${item.dataInicio}`.substring(0, 200);
      const fimTxt = item.dataFim ? ` às ${item.dataFim}` : '';
      const waTitle = `🕒 ${item.dataInicio}${fimTxt}`.substring(0, 24);
      const rawDesc = `${dataAlvo} - ${item.nomeEspecialista || item.codigoEspecialista}`;
      const waDesc = rawDesc.substring(0, 72);

      return { id: waId, title: waTitle, description: waDesc };
    });

    const mensagensWhatsApp = [];
    const chunkSize = 10;
    const totalPages = Math.ceil(waRows.length / chunkSize) || 1;

    for (let i = 0; i < waRows.length; i += chunkSize) {
      const chunk = waRows.slice(i, i + chunkSize);
      const pageNumber = Math.floor(i / chunkSize) + 1;

      let bodyText = "Selecione o horário desejado para o atendimento:";
      if (totalPages > 1) { bodyText = `🕒 HORÁRIOS DISPONÍVEIS (${pageNumber}/${totalPages})`; }

      mensagensWhatsApp.push({
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "Horários Disponíveis" },
          body: { text: bodyText },
          action: {
            button: "Ver Horários",
            sections: [{ title: "Agendamento", rows: chunk }]
          }
        }
      });
    }

    return {
      sucesso: true,
      dadosEspecialista: dadosEspecialista || { codigoEspecialista: especialistaCodigo },
      horariosDisponiveis: horariosUnicos,
      mensagensWhatsApp: mensagensWhatsApp
    };
  } catch (e) { return { sucesso: false, erro: e.toString() }; }
}

function buscarEspecialistaNoServico(codigoempresaAlvo, codEspecialistaAlvo) {
  try {
    const res = _obterDados(NOME_ABA_ESPECIALISTAS);
    if (!res.sucesso) return res;
    const { displayValues: dadosEsp, headers } = res;

    let idxCod = _encontrarColuna(headers, ["cod_especialista"]);
    let idxEmp = _encontrarColuna(headers, ["codigoempresa", "codigo_empresa"]);
    let idxStatus = _encontrarColuna(headers, ["status", "ativo"]);

    for (let i = 1; i < dadosEsp.length; i++) {
      const row = dadosEsp[i];
      const matchCodigo = String(row[idxCod]).trim() === String(codEspecialistaAlvo).trim();
      const matchEmpresa = String(row[idxEmp]).trim().toLowerCase() === String(codigoempresaAlvo).trim().toLowerCase();

      if (matchCodigo && matchEmpresa) {
        if (idxStatus !== -1) {
          const status = String(row[idxStatus]).toLowerCase();
          if (["inativo", "não", "false", "0"].includes(status)) {
            return { sucesso: false, erro: "Especialista inativo." };
          }
        }

        const especialista = {};
        headers.forEach((header, index) => { especialista[header] = row[index]; });
        return { sucesso: true, especialista: especialista };
      }
    }
    return { sucesso: false, erro: "Especialista não encontrado." };
  } catch (e) { return { sucesso: false, erro: e.toString() }; }
}


function buscarAgendamentoServico(payload) {
  try {
    const res = _obterDados(NOME_ABA_AGENDA);
    if (!res.sucesso) return res;
    const { displayValues: dataFull, headers } = res;

    const codEmpIdx = _encontrarColuna(headers, ["codigoempresa", "codigo_empresa"]);
    const espIdx = _encontrarColuna(headers, ["Especialista"]);
    const statusIdx = _encontrarColuna(headers, ["Status"]);
    const dataIdx = _encontrarColuna(headers, ["Data"]);
    // Adicionei um segundo nome de busca para garantir
    const hIniIdx = _encontrarColuna(headers, ["Horarioinicio", "Horário início"]);

    const empresaBuscada = String(payload.codigoempresa || "").trim();
    if (!empresaBuscada) return { sucesso: false, erro: "codigoempresa é obrigatório." };

    const filtros = {
      especialista: String(payload.especialista || "").trim().toLowerCase(),
      status: String(payload.status || "").trim().toLowerCase(),
      // MUDANÇA SALVADORA: Formata a data do n8n para bater com a planilha
      data: planilhaParaHtmlData(String(payload.data || "").trim()).toLowerCase(),
      hIni: String(payload.horarioInicio || "").trim().toLowerCase()
    };

    for (let i = 1; i < dataFull.length; i++) {
      const row = dataFull[i];
      const codEmpLinha = codEmpIdx > -1 ? String(row[codEmpIdx] || "").trim() : "";
      if (codEmpLinha !== empresaBuscada) continue;

      const espLinha = espIdx > -1 ? String(row[espIdx] || "").trim().toLowerCase() : "";
      const statusLinha = statusIdx > -1 ? String(row[statusIdx] || "").trim().toLowerCase() : "";
      const dataLinha = dataIdx > -1 ? planilhaParaHtmlData(row[dataIdx]).toLowerCase() : "";
      const hIniLinha = hIniIdx > -1 ? String(row[hIniIdx] || "").trim().toLowerCase() : "";

      if (espLinha === filtros.especialista && statusLinha === filtros.status &&
        dataLinha === filtros.data && hIniLinha === filtros.hIni) {

        let objResultado = {};
        for (let j = 0; j < headers.length; j++) {
          const cabecalho = String(headers[j] || "").trim();
          if (cabecalho) objResultado[cabecalho] = row[j];
        }
        return { sucesso: true, dados: objResultado };
      }
    }
    return { sucesso: false, erro: "Agendamento não encontrado." };
  } catch (e) {
    return { sucesso: false, erro: "Erro na busca: " + e.toString() };
  }
}

/**
 * Atualiza o status de um agendamento específico na aba Agendas vindo de webhook (n8n)
 * @param {Object} payload Filtros e novo status enviados pelo n8n
 */
function atualizarStatusAgendaWebhook(payload) {
  try {
    const res = _obterDados(NOME_ABA_AGENDA);
    if (!res.sucesso) return res;

    const { sheet, displayValues: dataFull, headers } = res;
    if (dataFull.length < 2) return { sucesso: false, erro: "Planilha vazia ou sem dados." };

    const codEmpIdx = _encontrarColuna(headers, ["codigoempresa", "codigo_empresa"]);
    const espIdx = _encontrarColuna(headers, ["Especialista"]);
    const dataIdx = _encontrarColuna(headers, ["Data"]);
    const hIniIdx = _encontrarColuna(headers, ["Horarioinicio", "Horário início"]);
    const statusIdx = _encontrarColuna(headers, ["Status"]);

    if (codEmpIdx === -1 || espIdx === -1 || dataIdx === -1 || hIniIdx === -1 || statusIdx === -1) {
      return { sucesso: false, erro: "Colunas obrigatórias não encontradas na aba Agendas." };
    }

    const filtros = {
      empresa: String(payload.codigoempresa || "").trim(),
      especialista: String(payload.especialista || "").trim().toLowerCase(),
      data: planilhaParaHtmlData(String(payload.data || "").trim()).toLowerCase(),
      hIni: String(payload.horarioInicio || "").trim().toLowerCase()
    };

    if (!filtros.empresa) return { sucesso: false, erro: "codigoempresa é obrigatório." };

    for (let i = 1; i < dataFull.length; i++) {
      const row = dataFull[i];

      const codEmpLinha = String(row[codEmpIdx] || "").trim();
      if (codEmpLinha !== filtros.empresa) continue;

      const espLinha = String(row[espIdx] || "").trim().toLowerCase();
      const dataLinha = planilhaParaHtmlData(row[dataIdx]).toLowerCase();
      const hIniLinha = String(row[hIniIdx] || "").trim().toLowerCase();

      if (espLinha === filtros.especialista && dataLinha === filtros.data && hIniLinha === filtros.hIni) {
        const novoStatus = payload.novoStatus || "Não confirmado";
        sheet.getRange(i + 1, statusIdx + 1).setValue(novoStatus);
        return { sucesso: true, mensagem: "Status atualizado com sucesso para: " + novoStatus };
      }
    }

    return { sucesso: false, erro: "Agendamento não encontrado para os filtros informados." };
  } catch (e) {
    return { sucesso: false, erro: "Erro ao atualizar status: " + e.toString() };
  }
}

/**
 * Lista as consultas de um cliente específico na aba Consultas categorizadas.
 * Gera arrays originais, mensagens interativas para remarcação e strings p/ WhatsApp.
 * @param {Object} payload Parâmetros codigoempresa, celularCliente e horasMinimas
 */
function listarConsultasClienteWebhook(payload) {
  try {
    const res = _obterDados(NOME_ABA_CONSULTAS);
    if (!res.sucesso) return res;

    const { displayValues: dataFull, headers } = res;
    if (dataFull.length < 2) {
      return {
        sucesso: true, total: 0, consultas: [], mensagensWhatsApp: [],
        textoConsultasDentroHorario: "Não foram encontradas consultas.",
        textoConsultasConfirmadaVencida: "Não foram encontradas consultas.",
        textoConsultasAtendidas: "Não foram encontradas consultas."
      };
    }

    const codEmpIdx = _encontrarColuna(headers, ["codigoempresa", "codigo_empresa"]);
    const celCliIdx = _encontrarColuna(headers, ["Celular_Cliente", "celular cliente", "celular"]);
    const statusIdx = _encontrarColuna(headers, ["Status"]);
    const dataIdx = _encontrarColuna(headers, ["Data_Consulta", "Data", "Data da Consulta"]);
    const hIniIdx = _encontrarColuna(headers, ["Horário início", "Horario_inicio", "Início"]);
    const hFimIdx = _encontrarColuna(headers, ["Horário Fim", "Horario_Fim", "Fim"]);

    const idxCodEsp = _encontrarColuna(headers, ["Codigo_Especialista", "Especialista"]);
    const idxForma = _encontrarColuna(headers, ["Forma", "Forma da Consulta", "Formadaconsulta"]);
    const idxEsp = _encontrarColuna(headers, ["Especialidade"]);
    const idxValor = _encontrarColuna(headers, ["Valor", "Valor_Consulta"]);
    const idxIdPag = _encontrarColuna(headers, ["ID Pag", "ID_pagamento"]);
    const idxNomeEsp = _encontrarColuna(headers, ["Nome Especialista", "Nome_Especialista"]);
    const idxLocal = _encontrarColuna(headers, ["Local"]);
    const idxLinkPag = _encontrarColuna(headers, ["Link_pagamento", "Link_Pagamento"]);
    const idxCodProd = _encontrarColuna(headers, ["Codigo_produto", "Codigo_Produto"]);

    if (codEmpIdx === -1 || celCliIdx === -1 || statusIdx === -1 || dataIdx === -1 || hIniIdx === -1) {
      return { sucesso: false, erro: "Colunas obrigatórias não encontradas na aba Consultas." };
    }

    const celProcurado = String(payload.celularCliente || "").replace(/\D/g, '');
    const empresaBuscada = String(payload.codigoempresa || "").trim();
    const textoBoasVindas = String(payload.boasVindas || "").trim();

    // Variável Temporal
    const horasMinimas = parseInt(payload.horasMinimas) || 4;
    const agora = new Date();
    const tempoLimite = new Date(agora.getTime() + (horasMinimas * 60 * 60 * 1000));

    // Arrays de Categorização
    const consultasParaRemarcacao = [];
    const consultasDentroHorario = [];
    const consultasConfirmadaVencida = [];
    let consultasAtendidas = [];
    const waRows = [];

    for (let i = 1; i < dataFull.length; i++) {
      const row = dataFull[i];

      const codEmpLinha = String(row[codEmpIdx] || "").trim();
      if (codEmpLinha !== "" && codEmpLinha !== empresaBuscada) continue;

      const celLinha = String(row[celCliIdx] || "").replace(/\D/g, '');
      if (celLinha !== "" && !celProcurado.includes(celLinha) && !celLinha.includes(celProcurado)) continue;

      const dataLinhaRaw = row[dataIdx];
      const hIniLinhaRaw = String(row[hIniIdx] || "").trim();
      if (!dataLinhaRaw || !hIniLinhaRaw) continue;

      const dataFormatada = planilhaParaHtmlData(dataLinhaRaw);
      const [ano, mes, dia] = dataFormatada.split('-');
      const [hora, min] = hIniLinhaRaw.split(':');

      if (!ano || !mes || !dia || !hora || !min) continue;

      const dataHoraPlanilha = new Date(ano, mes - 1, dia, hora, min);

      // Objeto completo da linha
      let objConsulta = {};
      for (let j = 0; j < headers.length; j++) {
        const cabecalho = String(headers[j] || "").trim();
        if (cabecalho) objConsulta[cabecalho] = row[j];
      }
      objConsulta.dataObj = dataHoraPlanilha;

      // Limpeza de Status e Storage Absoluto
      let statusOriginal = String(row[statusIdx] || "").trim();
      let statusLimpo = statusOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      objConsulta.statusOriginalAcesso = statusOriginal;
      objConsulta.statusLimpoAcesso = statusLimpo;

      // Flags de Validação Flexível O(-1)
      const isNaoConfirmado = statusLimpo.includes("nao") && statusLimpo.includes("confirmad");
      const isConfirmado = !statusLimpo.includes("nao") && statusLimpo.includes("confirmad");
      const isAdiado = statusLimpo.includes("adiad");
      const isAtendido = statusLimpo.includes("atendid");

      // Regras de Distribuição
      if (isConfirmado || isNaoConfirmado || isAdiado) {

        // Dentro do Horário Geral (Para Exibição do Usuário)
        if (dataHoraPlanilha > agora) {
          consultasDentroHorario.push(objConsulta);
        }

        // Remarcação e WhatsApp Botões (Apenas Limite +4h)
        if (dataHoraPlanilha > tempoLimite) {
          consultasParaRemarcacao.push(objConsulta);

          const codEsp = idxCodEsp > -1 ? String(row[idxCodEsp] || "").trim() : "";
          const forma = idxForma > -1 ? String(row[idxForma] || "").trim() : "";
          const especialidade = idxEsp > -1 ? String(row[idxEsp] || "").trim() : "";
          const valor = idxValor > -1 ? String(row[idxValor] || "").trim() : "";
          const idPagamento = idxIdPag > -1 ? String(row[idxIdPag] || "").trim() : "";
          const nomeEsp = idxNomeEsp > -1 ? String(row[idxNomeEsp] || "").trim() : "";
          const dataStr = String(dataLinhaRaw || "").trim();
          const horaStr = hIniLinhaRaw;

          const idBotao = `rmc_${codEsp}_${forma}_${especialidade}_${valor}_${idPagamento}_${dataStr}_${horaStr}`.substring(0, 200);
          const tituloBotao = `${dataStr} às ${horaStr}`.substring(0, 24);
          const descricaoBotao = `${especialidade} com ${nomeEsp} - ${forma}`.substring(0, 72);

          waRows.push({ id: idBotao, title: tituloBotao, description: descricaoBotao });
        }

        // Vencidas (Passadas, mas não atendidas)
        if (isConfirmado && dataHoraPlanilha < agora) {
          consultasConfirmadaVencida.push(objConsulta);
        }

      } else if (isAtendido && dataHoraPlanilha < agora) {
        consultasAtendidas.push(objConsulta);
      }
    }

    // Ordenação e Corte de Consultas Atendidas (Máx 3 mais recentes)
    consultasAtendidas.sort((a, b) => b.dataObj.getTime() - a.dataObj.getTime());
    consultasAtendidas = consultasAtendidas.slice(0, 3);

    // Paginação WhatsApp Botões
    const mensagensWhatsApp = [];
    const chunkSize = 10;
    for (let i = 0; i < waRows.length; i += chunkSize) {
      const chunk = waRows.slice(i, i + chunkSize);
      mensagensWhatsApp.push({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: celProcurado,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "Consultas disponíveis para remarcação (mínimo 4h de antecedência):" },
          action: { button: "Consultas", sections: [{ title: "Selecione", rows: chunk }] }
        }
      });
    }

    // Paginação WhatsApp Botões Atrasadas (Confirmadas Vencidas)
    const waRowsAtrasadas = [];
    for (let c of consultasConfirmadaVencida) {
      const codEsp = String(c["Codigo_Especialista"] || c["Especialista"] || "").trim();
      const forma = String(c["Forma"] || c["Forma da Consulta"] || c["Formadaconsulta"] || "").trim();
      const especialidade = String(c["Especialidade"] || "").trim();
      const valor = String(c["Valor"] || c["Valor_Consulta"] || "").trim();
      const idPagamento = String(c["ID Pag"] || c["ID_pagamento"] || "").trim();
      const nomeEsp = String(c["Nome Especialista"] || c["Nome_Especialista"] || "").trim();
      const dataStr = String(c["Data_Consulta"] || c["Data"] || c["Data da Consulta"] || "").trim();
      const horaStr = String(c["Horário início"] || c["Horario_inicio"] || c["Início"] || "").trim();

      const idBotao = `venc_${codEsp}_${forma}_${especialidade}_${valor}_${idPagamento}_${dataStr}_${horaStr}`.substring(0, 200);
      const tituloBotao = `${dataStr} às ${horaStr}`.substring(0, 24);
      const descricaoBotao = `${especialidade} com ${nomeEsp} - ${forma}`.substring(0, 72);

      waRowsAtrasadas.push({ id: idBotao, title: tituloBotao, description: descricaoBotao });
    }

    const mensagensAtrasadas = [];
    for (let i = 0; i < waRowsAtrasadas.length; i += chunkSize) {
      const chunk = waRowsAtrasadas.slice(i, i + chunkSize);
      mensagensAtrasadas.push({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: celProcurado,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "Consultas confirmadas que já passaram do horário:" },
          action: { button: "Consultas", sections: [{ title: "Selecione", rows: chunk }] }
        }
      });
    }

    // FORMATADOR DE TEXTO WHATSAPP (Helper Interno Padrão result3)
    const formatarTextoWA = (arrayConsultas, tipo) => {
      if (!arrayConsultas || arrayConsultas.length === 0) return "Não foram encontradas consultas.";

      let temNaoConfirmado = false;
      let stringStart = "Segue Consulta(s) até este momento:\n\n";

      let blocosTexto = arrayConsultas.map((c, idx) => {
        let forma = String(c["Forma da Consulta"] || c["Forma"] || c["Formadaconsulta"] || "Online");
        let esp = String(c["Especialidade"] || "");
        let nome = String(c["Nome Especialista"] || c["Nome_Especialista"] || "");
        let dataBr = planilhaParaHtmlData(c["Data_Consulta"] || c["Data"] || "");
        if (dataBr.includes("-")) {
          const p = dataBr.split('-');
          dataBr = `${p[2]}/${p[1]}/${p[0]}`; // DD/MM/YYYY
        }
        let hIni = String(c["Horário início"] || c["Horario_inicio"] || c["Início"] || "00:00");
        let hFim = String(c["Horário Fim"] || c["Horario_Fim"] || c["Fim"] || "00:00");
        let local = String(c["Local"] || "");
        let statusOrig = String(c.statusOriginalAcesso || "");
        let statusAvaliado = String(c.statusLimpoAcesso || "");
        let linkPag = String(c["Link_pagamento"] || c["Link_Pagamento"] || "");
        let codProd = String(c["Codigo_produto"] || c["Codigo_Produto"] || "");

        const flagNaoConf = statusAvaliado.includes("nao") && statusAvaliado.includes("confirmad");
        const flagConf = !statusAvaliado.includes("nao") && statusAvaliado.includes("confirmad");

        if (flagNaoConf) temNaoConfirmado = true;

        let trechoLocal = (forma.toLowerCase().includes("presencial") && local) ? `\n  - Local da Consulta: ${local}` : "";
        let txt = `*${idx + 1}.* ${esp} com ${nome} - ${forma} - dia ${dataBr}, das ${hIni} às ${hFim}${trechoLocal}\n  - Status: *${statusOrig}*`;

        if (tipo === "dentro_horario") {
          if (flagNaoConf && linkPag) {
            txt += `\n  - Link Pagamento: ${linkPag} \n⚠️*Agendamento não confirmado!* Clique no link acima para fazer o pagamento e confirmar o agendamento.`;
          }
          if (flagConf && codProd) {
            txt += `\n\nInformações importantes para esse encontro: https://www.datamarcada.com.br/?cod=${codProd}`;
          }
        }

        return txt;
      });

      let corpoLista = blocosTexto.join('\n\n');
      let stringFinal = stringStart + corpoLista;

      if (tipo === "dentro_horario" && temNaoConfirmado) {
        stringFinal += `\n\n❌ Lembrando que agendamentos com mais de *24 horas* e *sem pagamento*, serão *Cancelados*!`;
      }

      return stringFinal;
    };

    const textoDentroHorario = formatarTextoWA(consultasDentroHorario, "dentro_horario");
    const textoConfirmadaVencida = formatarTextoWA(consultasConfirmadaVencida, "vencida");
    const textoAtendidas = formatarTextoWA(consultasAtendidas, "atendida");

    // Verificação de Perfil na aba Temporario
    let temPerfil = false;
    let textoPerfil = "Perfil não encontrado.";
    const resTemp = _obterDados('Temporario');
    if (resTemp.sucesso && resTemp.displayValues && resTemp.displayValues.length > 1) {
      const tempHeaders = resTemp.headers;
      const idxCelTemp = _encontrarColuna(tempHeaders, ["celular", "Celular", "telefone"]);
      const idxEmailTemp = _encontrarColuna(tempHeaders, ["e-mail", "email", "E-mail", "Email"]);

      const idxNomeTemp = _encontrarColuna(tempHeaders, ["nome_sobrenome", "nome", "nome e sobrenome", "Nome"]);
      const idxTipoTemp = _encontrarColuna(tempHeaders, ["tipo usuário", "tipo", "tipo_usuario"]);
      const idxCodEmpresaTemp = _encontrarColuna(tempHeaders, ["codigoempresa", "codigo_empresa", "empresa"]);

      if (idxCelTemp > -1) {
        for (let i = 1; i < resTemp.displayValues.length; i++) {
          const rowTemp = resTemp.displayValues[i];
          const celTempLimpo = String(rowTemp[idxCelTemp] || "").replace(/\D/g, '');
          const codigoempresaTemp = idxCodEmpresaTemp > -1 ? String(rowTemp[idxCodEmpresaTemp] || "").trim() : "";

          if (celTempLimpo === celProcurado && codigoempresaTemp === empresaBuscada) {
            const nomeUsuario = idxNomeTemp > -1 ? String(rowTemp[idxNomeTemp] || "").trim() : "";
            const emailUsuario = idxEmailTemp > -1 ? String(rowTemp[idxEmailTemp] || "").trim() : "";
            const tipoUsuario = idxTipoTemp > -1 ? String(rowTemp[idxTipoTemp] || "").trim() : "";

            const linkPainel = String(payload.linkPainel || "").trim();

            if (emailUsuario !== "") {
              temPerfil = true;
              textoPerfil = "👤 Aqui estão as informações do seu Perfil:\n*Nome e sobrenome:* " + nomeUsuario + "\n*Email:* " + emailUsuario + "\n*Tipo Usuário:* " + tipoUsuario + "\n*Acesso a Painel Geral:* " + linkPainel;
            }

            break; // Já cruzamos telefone+empresa. Parando o loop.
          }
        }
      }
    }

    // Montagem das opções dinâmicas do Menu Principal
    const menuRows = [];

    if (temPerfil) {
      if (consultasDentroHorario.length > 0) {
        menuRows.push({ id: "listeConsultas_realizar", title: "1️⃣ Consultas à Realizar", description: "Veja suas Consultas agendadas." });
      }
      if (consultasParaRemarcacao.length > 0) {
        menuRows.push({ id: "listeConsultas_podeRemarcar", title: "2️⃣ Para Remarcar", description: "Consultas que ainda podem ser remarcadas." });
      }
      if (consultasConfirmadaVencida.length > 0) {
        menuRows.push({ id: "listeConsultas_naoRealizada", title: "3️⃣ Consultas Vencidas", description: "Consultas Agendadas e Vencidas." });
      }
      if (consultasAtendidas.length > 0) {
        menuRows.push({ id: "listeConsultas_atendidas", title: "4️⃣ Consultas Realizadas", description: "Consultas Atendidas." });
      }
      menuRows.push({ id: "meu_perfil", title: "5️⃣ Meu Perfil", description: "Acesse os dados do seu cadastro." });
    }

    // Array contendo o objeto Interativo (se houver opções)
    let menuGeral = [];
    if (menuRows.length > 0) {
      menuGeral.push({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: celProcurado,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "📋 MENU" },
          action: {
            button: "Menu de Opções",
            sections: [{ title: "Menu Principal", rows: menuRows }]
          }
        }
      });
    }

    return {
      sucesso: true,
      total: consultasParaRemarcacao.length,
      consultas: consultasParaRemarcacao,
      mensagensWhatsApp: mensagensWhatsApp,
      whatsappConfirmadaAtrasada: mensagensAtrasadas,
      menuGeral: menuRows.length > 0 ? menuRows : "Lista vazia",
      perfilUsuario: textoPerfil,
      boasVindas: textoBoasVindas,
      textoConsultasDentroHorario: textoDentroHorario,
      textoConsultasConfirmadaVencida: textoConfirmadaVencida,
      textoConsultasAtendidas: textoAtendidas
    };
  } catch (e) {
    return { sucesso: false, erro: "Erro ao listar consultas do cliente: " + e.toString() };
  }
}

/**
 * Função isolada para cadastrar ou atualizar o perfil do cliente na aba Temporario.
 */
function cadastrarUsuarioWebhook(payload) {
  try {
    if (!payload.codigoempresa || !payload.celularCliente) {
      return { sucesso: false, erro: "codigoempresa e celularCliente são obrigatórios." };
    }

    const celularCliente = String(payload.celularCliente).replace(/\D/g, '');
    const codigoempresa = String(payload.codigoempresa).trim();
    const nome_sobrenome = String(payload.nome_sobrenome || "").trim();
    const email = String(payload.email || "").trim();
    const tipo_usuario = String(payload.tipo_usuario || "").trim();

    const senhaGerada = String(Math.floor(Math.random() * 9000000000) + 1000000000);

    const sheet = SpreadsheetApp.openById('1AHEqD4FxrLumSwlXg8IcEdfZ7f8tGzUaH-AWWZ1kKXo').getSheetByName('Temporario');
    if (!sheet) return { sucesso: false, erro: "Aba Temporario não encontrada." };

    let lastCol = sheet.getLastColumn() || 1;
    const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Helper interno para achar indices (caso _encontrarColuna saia do escopo ou para garantir reuso isolado)
    const encontrarIdx = (array, nomes) => {
      const mapeio = array.map(h => String(h).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase());
      for (const arg of nomes) {
        const argLimpo = arg.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
        let i = mapeio.indexOf(argLimpo);
        if (i > -1) return i;
      }
      return -1;
    };

    let idxCel = encontrarIdx(headerRow, ["celular", "telefone", "Celular"]);
    let idxEmp = encontrarIdx(headerRow, ["codigoempresa", "codigo_empresa", "empresa", "codigo_empresa"]);
    let idxNome = encontrarIdx(headerRow, ["nome_sobrenome", "nome", "nome e sobrenome", "Nome"]);
    let idxEmail = encontrarIdx(headerRow, ["e-mail", "email", "E-mail", "Email"]);
    let idxSenha = encontrarIdx(headerRow, ["senha", "Senha"]);
    let idxTipo = encontrarIdx(headerRow, ["tipo usuário", "tipo", "tipo_usuario"]);

    // Gerador de Coluna Faltante Nativo
    const criarColunaSeVazia = (idx, nomeReal) => {
      if (idx === -1) {
        lastCol++;
        sheet.getRange(1, lastCol).setValue(nomeReal);
        headerRow.push(nomeReal);
        return lastCol - 1; // Array na base 0
      }
      return idx;
    };

    idxCel = criarColunaSeVazia(idxCel, "Celular");
    idxEmp = criarColunaSeVazia(idxEmp, "Codigo_Empresa");
    idxNome = criarColunaSeVazia(idxNome, "Nome e Sobrenome");
    idxEmail = criarColunaSeVazia(idxEmail, "E-mail");
    idxSenha = criarColunaSeVazia(idxSenha, "Senha");
    idxTipo = criarColunaSeVazia(idxTipo, "Tipo Usuário");

    let usuarioAtualizado = false;
    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
      const dados = sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, headerRow.length)).getValues();
      for (let i = 0; i < dados.length; i++) {
        const linhaAtual = dados[i];
        const celularTemp = String(linhaAtual[idxCel] || "").replace(/\D/g, '');
        const empTemp = String(linhaAtual[idxEmp] || "").trim();

        if (celularTemp === celularCliente && empTemp === codigoempresa) {
          const rowNum = i + 2; // Offset (1 por start do Index + 1 por pular linha dos titulos)
          if (nome_sobrenome) sheet.getRange(rowNum, idxNome + 1).setValue(nome_sobrenome);
          if (email) sheet.getRange(rowNum, idxEmail + 1).setValue(email);
          sheet.getRange(rowNum, idxSenha + 1).setValue(senhaGerada);
          if (tipo_usuario) sheet.getRange(rowNum, idxTipo + 1).setValue(tipo_usuario);

          usuarioAtualizado = true;
          break;
        }
      }
    }

    if (!usuarioAtualizado) {
      return { sucesso: false, erro: "Usuário não encontrado na aba Temporario para edição." };
    }

    return {
      sucesso: true,
      mensagem: "Cadastro processado com sucesso",
      senhaGerada: senhaGerada,
      dados: {
        nome: nome_sobrenome,
        email: email,
        tipo: tipo_usuario
      }
    };

  } catch (e) {
    return { sucesso: false, erro: "Erro ao cadastrar usuário: " + e.toString() };
  }
}

/**
 * Máquina de Estados de Remarcação Autônoma (WhatsApp)
 * Rota: datas_disponiveis_remarcacao
 */
function processarRemarcacaoWebhook(payload) {
  try {
    if (!payload.codigoempresa || !payload.telefone || !payload.infoGeral) {
      return { sucesso: false, erro: "codigoempresa, telefone e infoGeral são obrigatórios." };
    }

    const empresaBuscada = String(payload.codigoempresa).trim();
    const celularCliente = String(payload.telefone).replace(/\D/g, '');
    const novaData = String(payload.novaData || "").trim();

    // infoGeral => "rmc_CodigoEsp_Forma_NomeEsp_Valor_IDPag_DataAntiga_HoraAntiga"
    const infoParts = String(payload.infoGeral).split('_');
    const codEspAntigo = infoParts[1] || "";
    const formaAntigaNormalizada = limparTexto(infoParts[2] || "");
    const nomeEspAntigo = infoParts[3] || "";
    const dataAntiga = infoParts.length > 6 ? infoParts[infoParts.length - 2] : ""; // Array reverso pra evitar falhas
    const horaAntiga = infoParts.length > 7 ? infoParts[infoParts.length - 1] : "";

    // ======== PASSO 2: Listar Horários ========
    if (novaData.includes('rmc_dataVerHorarios_')) {
      const splitNova = novaData.split('_');
      const dataAlvoStr = splitNova[splitNova.length - 1];

      const resAgenda = _obterDados('Agendas');
      if (!resAgenda.sucesso) return resAgenda;

      const { displayValues: agendasData, headers: agHeaders } = resAgenda;
      const idxEmp = _encontrarColuna(agHeaders, ["codigoempresa", "codigo_empresa"]);
      const idxEsp = _encontrarColuna(agHeaders, ["Especialista", "Codigo_Especialista"]);
      const idxStat = _encontrarColuna(agHeaders, ["Status"]);
      const idxData = _encontrarColuna(agHeaders, ["Data_Consulta", "Data"]);
      const idxHIni = _encontrarColuna(agHeaders, ["Horário início", "Horario_inicio", "Início"]);
      const idxHFim = _encontrarColuna(agHeaders, ["Horário Fim", "Horario_Fim", "Fim"]);
      const idxNomeEspecialista = _encontrarColuna(agHeaders, ["Nome Especialista", "Nome_Especialista", "Nome"]);

      if (idxEmp === -1 || idxEsp === -1 || idxStat === -1 || idxData === -1 || idxHIni === -1 || idxHFim === -1) {
        return { sucesso: false, erro: "Colunas obrigatórias não encontradas na aba Agendas (Passo 2)." };
      }

      const horasDisponivel = [];
      for (let i = 1; i < agendasData.length; i++) {
        const row = agendasData[i];
        if (String(row[idxEmp]).trim() !== empresaBuscada) continue;
        if (String(row[idxEsp]).trim() !== codEspAntigo) continue;
        if (String(row[idxData]).trim() !== dataAlvoStr) continue;

        const statLimpo = limparTexto(row[idxStat] || "");
        if (statLimpo === "disponivel") {
          const hIni = String(row[idxHIni]).trim();
          const hFim = String(row[idxHFim]).trim();
          const nomeEspReal = idxNomeEspecialista > -1 ? String(row[idxNomeEspecialista] || "Especialista").trim() : "Especialista";

          const p = dataAlvoStr.split('/');
          const dt = new Date(p[2], p[1] - 1, p[0]);
          const diaSemanaCurto = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dt.getDay()];

          horasDisponivel.push({
            id: `rmc_horaAgendamento_${codEspAntigo}_${dataAlvoStr}_${hIni}_${hFim}`.substring(0, 200),
            title: `🕒 ${hIni} às ${hFim}`.substring(0, 24),
            description: `${dataAlvoStr} - ${diaSemanaCurto} - ${nomeEspReal}`.substring(0, 72)
          });
        }
      }

      return { sucesso: true, passo: 2, horasDisponivel };
    }

    // ======== PASSO 3: Efetivar Remarcação C.R.U.D ========
    if (novaData.includes('rmc_horaAgendamento_')) {
      // "rmc_horaAgendamento_{codigoEspecialista}_{data}_{h_ini}_{h_fim}"
      let templateSucesso = payload.mensagemSucesso || "Remarcação efetuada com sucesso!";

      const splitNova = novaData.split('_');
      const hFimNovo = splitNova[splitNova.length - 1];
      const hIniNovo = splitNova[splitNova.length - 2];
      const dataNova = splitNova[splitNova.length - 3];

      const sheetConsultas = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName('Consultas');
      const sheetAgendas = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName('Agendas');
      if (!sheetConsultas || !sheetAgendas) return { sucesso: false, erro: "Abas nativas não encontradas (Passo 3)." };

      const aData = sheetAgendas.getDataRange().getDisplayValues();
      const aHeaders = aData[0] || [];
      const aIdxEmp = _encontrarColuna(aHeaders, ["codigoempresa", "codigo_empresa"]);
      const aIdxEsp = _encontrarColuna(aHeaders, ["Especialista", "Codigo_Especialista"]);
      const aIdxData = _encontrarColuna(aHeaders, ["Data_Consulta", "Data"]);
      const aIdxHIni = _encontrarColuna(aHeaders, ["Horário início", "Horario_inicio", "Início"]);
      const aIdxStat = _encontrarColuna(aHeaders, ["Status"]);

      // TRAVA DE CONCORRÊNCIA (Double-Booking)
      let slotNovoLivre = false;
      for (let i = 1; i < aData.length; i++) {
        const row = aData[i];
        if (String(row[aIdxEmp]).trim() !== empresaBuscada) continue;
        if (String(row[aIdxEsp]).trim() !== codEspAntigo) continue;

        const dat = String(row[aIdxData]).trim();
        const hin = String(row[aIdxHIni]).trim();

        if (dat === dataNova && hin === hIniNovo) {
          const statLinha = limparTexto(row[aIdxStat] || "");
          if (statLinha === "disponivel") {
            slotNovoLivre = true;
          }
          break; // Achou a linha exata
        }
      }

      if (!slotNovoLivre) {
        return { sucesso: false, horarioOcupado: "⚠️ Infelizmente este horário, nesta data, não está mais disponível!" };
      }

      const cData = sheetConsultas.getDataRange().getDisplayValues();
      const cHeaders = cData[0] || [];
      const cIdxEmp = _encontrarColuna(cHeaders, ["codigoempresa", "codigo_empresa"]);
      const cIdxCel = _encontrarColuna(cHeaders, ["Celular_Cliente", "celular cliente", "celular"]);
      const cIdxData = _encontrarColuna(cHeaders, ["Data_Consulta", "Data"]);
      const cIdxHIni = _encontrarColuna(cHeaders, ["Horário início", "Horario_inicio", "Início"]);
      const cIdxHFim = _encontrarColuna(cHeaders, ["Horário Fim", "Horario_Fim", "Fim"]);
      const cIdxStat = _encontrarColuna(cHeaders, ["Status"]);
      const cIdxStatCli = _encontrarColuna(cHeaders, ["Status_cliente", "Status Cliente"]);
      const cIdxEspecialidade = _encontrarColuna(cHeaders, ["Especialidade"]);
      const cIdxForma = _encontrarColuna(cHeaders, ["Forma", "Forma da Consulta", "Formadaconsulta"]);
      const cIdxLocal = _encontrarColuna(cHeaders, ["Local"]);
      const cIdxNomeEsp = _encontrarColuna(cHeaders, ["Nome Especialista", "Nome_Especialista", "Nome"]);

      // Ação A: Edição Autônoma na Tabela de Consultas
      let consultaAtualizada = false;
      for (let i = 1; i < cData.length; i++) {
        const row = cData[i];
        const emp = String(row[cIdxEmp]).trim();
        const cel = String(row[cIdxCel]).replace(/\D/g, '');
        const dat = String(row[cIdxData]).trim();
        const hin = String(row[cIdxHIni]).trim();

        if (emp === empresaBuscada && cel === celularCliente && dat === dataAntiga && hin === horaAntiga) {
          let espReal = cIdxEspecialidade > -1 ? String(row[cIdxEspecialidade] || "") : "";
          let formaReal = cIdxForma > -1 ? String(row[cIdxForma] || "") : "";
          let localReal = cIdxLocal > -1 ? String(row[cIdxLocal] || "") : "";
          let nomeEspReal = cIdxNomeEsp > -1 ? String(row[cIdxNomeEsp] || "") : "";

          const p = dataNova.split('/');
          const dt = new Date(p[2], p[1] - 1, p[0]);
          const diaSemanaNova = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dt.getDay()];

          templateSucesso = templateSucesso
            .replace(/\[ESPECIALIDADE\]/g, espReal)
            .replace(/\[FORMA\]/g, formaReal)
            .replace(/\[LOCAL\]/g, localReal)
            .replace(/\[ESPECIALISTA\]/g, nomeEspReal)
            .replace(/\[DATA\]/g, dataNova)
            .replace(/\[DIA\]/g, diaSemanaNova)
            .replace(/\[H_INI\]/g, hIniNovo)
            .replace(/\[H_FIM\]/g, hFimNovo);

          const rowNum = i + 1; // Google array zero-index offset
          if (cIdxData > -1) sheetConsultas.getRange(rowNum, cIdxData + 1).setValue(dataNova);
          if (cIdxHIni > -1) sheetConsultas.getRange(rowNum, cIdxHIni + 1).setValue(hIniNovo);
          if (cIdxHFim > -1) sheetConsultas.getRange(rowNum, cIdxHFim + 1).setValue(hFimNovo);
          if (cIdxStat > -1) sheetConsultas.getRange(rowNum, cIdxStat + 1).setValue("Adiado");
          if (cIdxStatCli > -1) sheetConsultas.getRange(rowNum, cIdxStatCli + 1).setValue("Remarcado");
          consultaAtualizada = true;
          break;
        }
      }

      if (!consultaAtualizada) return { sucesso: false, erro: "Consulta original não encontrada para remarcação no C.R.U.D." };

      // Ações B & C: Edição Múltipla na Tabela de Agendas
      for (let i = 1; i < aData.length; i++) {
        const row = aData[i];
        if (String(row[aIdxEmp]).trim() !== empresaBuscada) continue;
        if (String(row[aIdxEsp]).trim() !== codEspAntigo) continue;

        const dat = String(row[aIdxData]).trim();
        const hin = String(row[aIdxHIni]).trim();

        // Bloquear Nova Cátedra do Horário (Action B)
        if (dat === dataNova && hin === hIniNovo) {
          sheetAgendas.getRange(i + 1, aIdxStat + 1).setValue("Confirmado");
        }

        // Liberar Antigo Horário que o cliente vagou (Action C)
        if (dat === dataAntiga && hin === horaAntiga) {
          sheetAgendas.getRange(i + 1, aIdxStat + 1).setValue("Disponível");
        }
      }

      return { sucesso: true, passo: 3, remarcacaoSucesso: templateSucesso };
    }

    // ======== PASSO 1: Listar Datas (Fallback Start) ========
    const resAgenda = _obterDados('Agendas');
    if (!resAgenda.sucesso) return resAgenda;

    const { displayValues: agendasData, headers: agHeaders } = resAgenda;
    const idxEmp = _encontrarColuna(agHeaders, ["codigoempresa", "codigo_empresa"]);
    const idxEsp = _encontrarColuna(agHeaders, ["Especialista", "Codigo_Especialista"]);
    const idxForma = _encontrarColuna(agHeaders, ["Forma", "Forma da Consulta", "Formadaconsulta"]);
    const idxStat = _encontrarColuna(agHeaders, ["Status"]);
    const idxData = _encontrarColuna(agHeaders, ["Data_Consulta", "Data", "Data da Consulta"]);
    const idxNomeEspecialista = _encontrarColuna(agHeaders, ["Nome_Especialista", "Nome Especialista"]);

    if (idxEmp === -1 || idxEsp === -1 || idxStat === -1 || idxData === -1) {
      return { sucesso: false, erro: "Colunas obrigatórias não encontradas na aba Agendas (Passo 1)." };
    }

    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    const datasUnicasValidas = new Map();

    for (let i = 1; i < agendasData.length; i++) {
      const row = agendasData[i];
      if (String(row[idxEmp]).trim() !== empresaBuscada) continue;
      if (String(row[idxEsp]).trim() !== codEspAntigo) continue;

      const statLimpo = limparTexto(row[idxStat] || "");
      if (statLimpo !== "disponivel") continue;

      // Restrição Condicional Isolada de "Forma"
      if (idxForma > -1 && formaAntigaNormalizada !== "") {
        const formaLinha = limparTexto(row[idxForma] || "");
        if (formaLinha !== "presencialouonline" && formaLinha !== formaAntigaNormalizada) {
          continue; // Pula se presencial não cruzar com online ou vice-versa
        }
      }

      const dataStr = String(row[idxData]).trim();
      if (!dataStr) continue;

      const dataFormatada = planilhaParaHtmlData(dataStr);
      if (dataFormatada) {
        const [a, m, d] = dataFormatada.split('-');
        const dataObj = new Date(a, m - 1, d);
        if (dataObj >= agora && !datasUnicasValidas.has(dataStr)) {
          const nomeEspReal = idxNomeEspecialista > -1 ? String(row[idxNomeEspecialista] || "Especialista").trim() : "Especialista";
          const formaReal = idxForma > -1 ? String(row[idxForma] || "Presencial/On-Line").trim() : "Presencial/On-Line";
          datasUnicasValidas.set(dataStr, { nome: nomeEspReal, forma: formaReal });
        }
      }
    }

    const dataDisponivel = [];
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (let [dataUnica, dados] of datasUnicasValidas.entries()) {
      const df = planilhaParaHtmlData(dataUnica);
      const [a, m, d] = df.split('-');
      const dObj = new Date(a, m - 1, d);
      const diaTexto = diasSemana[dObj.getDay()];

      dataDisponivel.push({
        id: `rmc_dataVerHorarios_${codEspAntigo}_${dataUnica}`.substring(0, 200),
        title: `🗓️ ${dataUnica} - ${diaTexto}`.substring(0, 24),
        description: `${dados.nome} - ${dados.forma}`.substring(0, 72)
      });
    }

    // Ordenação cronológica base
    dataDisponivel.sort((a, b) => {
      const dbA = planilhaParaHtmlData(a.title.split(' ')[1]);
      const dbB = planilhaParaHtmlData(b.title.split(' ')[1]);
      return new Date(dbA) - new Date(dbB);
    });

    return { sucesso: true, passo: 1, dataDisponivel: dataDisponivel };

  } catch (e) {
    return { sucesso: false, erro: "Erro na máquina de remarcação: " + e.toString() };
  }
}
