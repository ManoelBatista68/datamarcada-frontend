/**
 * Dicionário de Rotas Disponíveis (Strategy Pattern)
 * Cada chave é a 'acao' enviada pelo n8n/externo.
 * As validações de parâmetros obrigatórios foram migradas para dentro de cada rota.
 */
const ROTAS_DISPONIVEIS = {
  'ping': (request) => {
    return { sucesso: true, mensagem: "Webhook BMad online e operante!" };
  },

  'buscarEspecialista': (request) => {
    if (!request.codigoempresa || !request.codEspecialista) {
      return { sucesso: false, erro: "Parâmetros 'codigoempresa' e 'codEspecialista' são obrigatórios." };
    }
    return buscarEspecialistaNoServico(request.codigoempresa, request.codEspecialista);
  },

  'listar_especialistas': (request) => {
    if (!request.codigoempresa) return { sucesso: false, erro: "codigoempresa obrigatório." };
    return listarEspecialistas(request.codigoempresa);
  },

  'listar_datas_disponiveis': (request) => {
    if (!request.codigoempresa || !request.especialista) {
      return { sucesso: false, erro: "Empresa e Especialista são obrigatórios." };
    }
    return listarDatasDisponiveis(request.especialista, request.codigoempresa);
  },

  'listar_horarios_disponiveis': (request) => {
    if (!request.especialista || !request.data || !request.codigoempresa) {
      return { sucesso: false, erro: "Especialista, data e empresa são obrigatórios." };
    }
    return listarHorariosDisponiveis(request.especialista, request.data, request.codigoempresa);
  },

  'buscar_produto': (request) => {
    const codigoBuscado = String(request.codigo2 || request.codigo3 || '').trim().toUpperCase();
    return buscarProduto(codigoBuscado, request.codigoempresa);
  },

  'salvar_agendamento': (request) => {
    // Ação disparada pelo n8n com payload JSON completo
    return registrarAgendamentoWebhook(request);
  },

  'buscar_agendamento_especifico': (request) => {
    return buscarAgendamentoServico(request);
  },

  'buscar_temporario': (request) => {
    if (!request.codigoempresa || !request.celular) {
      return { sucesso: false, erro: "Parâmetros 'codigoempresa' e 'celular' são obrigatórios." };
    }
    return buscarTemporario(request.celular, request.codigoempresa);
  },

  'atualizar_status_agenda': (request) => {
    if (!request.codigoempresa || !request.especialista || !request.data || !request.horarioInicio) {
      return { sucesso: false, erro: "Parâmetros 'codigoempresa', 'especialista', 'data' e 'horarioInicio' são obrigatórios." };
    }
    return atualizarStatusAgendaWebhook(request);
  },

  'listar_consultas_cliente': (request) => {
    if (!request.codigoempresa || !request.celularCliente) {
      return { sucesso: false, erro: "Parâmetros 'codigoempresa' e 'celularCliente' são obrigatórios." };
    }
    return listarConsultasClienteWebhook(request);
  },

  'cadastrar_usuario': (request) => {
    return cadastrarUsuarioWebhook(request);
  },

  'datas_disponiveis_remarcacao': (request) => {
    return processarRemarcacaoWebhook(request);
  }
};

/**
 * Endpoint central imutável responsável pelo roteamento.
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const acao = request.acao;

    if (ROTAS_DISPONIVEIS[acao]) {
      const resultado = ROTAS_DISPONIVEIS[acao](request);
      return responderJSON(resultado);
    } else {
      return responderJSON({ sucesso: false, erro: "Ação não reconhecida: " + acao });
    }

  } catch (error) {
    return responderJSON({ sucesso: false, erro: "Erro ao processar requisição: " + error.toString() });
  }
}

/**
 * Função utilitária para formatar a resposta em JSON
 */
function responderJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}