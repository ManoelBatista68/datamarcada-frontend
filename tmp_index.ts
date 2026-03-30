import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as postgres from "https://deno.land/x/postgres@v0.14.2/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

// ==========================================
// 1. Connection Pool Initialization
// ==========================================
const databaseUrl = Deno.env.get("DB_URL")!;
const pool = new postgres.Pool(databaseUrl, 3, true);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Utility Helper
function responderJSON(objeto: any, status = 200) {
  return new Response(JSON.stringify(objeto), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status: status
  });
}

function paraISO(data: any): string {
  if (!data) return "";
  const str = String(data).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return str;
}

function limparMonetario(valorStr: any): number {
  if (!valorStr) return 0;
  let s = String(valorStr).trim().replace(/R\$\s*/gi, '').trim();
  // Se contém vírgula, assume formato BR (1.380,00) -> remove pontos e troca vírgula
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Se não contém vírgula, o ponto já é o decimal (ex: 380.00) -> mantém como está
  return isNaN(Number(s)) ? 0 : Number(s);
}

function paraBR(data: any): string {
  if (!data) return "";
  try {
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) {
      const str = String(data).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const parts = str.substring(0, 10).split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return String(data);
    }
    const iso = d.toISOString().split('T')[0];
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  } catch (e) { return String(data); }
}

function formatarHora(horaStr: any): string {
  if (!horaStr) return "";
  return String(horaStr).substring(0, 5);
}

function formatarTimestampBR(val: any): string {
  if (!val) return "";
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const iso = d.toISOString();
    const [dataObj, timeObj] = iso.split('T');
    const [ano, mes, dia] = dataObj.split('-');
    const horaMinuto = timeObj.substring(0, 5);
    return `${dia}/${mes}/${ano} ${horaMinuto}`;
  } catch (e) {
    return String(val);
  }
}

function formatarParaLegado(r: any) {
  if (!r) return r;
  const original = { ...r };

  // Chaves específicas que o Dashboard (Global_JS.js / renderizar) espera
  original["id_unico"] = 'A-' + r.id;
  original["data"] = r.data_consulta || r.data_agenda;
  original["h_ini"] = formatarHora(r.horario_inicio || r.horarioinicio);
  original["h_fim"] = formatarHora(r.horario_fim || r.horariofim);
  original["status"] = r.status;
  original["cli"] = r.cliente_nome || r.cliente || "";
  original["cel_cli"] = r.cliente_celular || r.celular_cliente || "";
  original["nome_esp"] = r.nome_especialista || "";
  original["especialidade"] = r.especialidade || "";
  original["valor"] = r.valor_consulta || r.valor || 0;
  original["forma"] = r.forma_consulta || "";
  original["local"] = r.local_atendimento || "";
  original["obs"] = r.observacao_especialista || "";
  original["obs_para_cliente"] = r.observacoes_para_cliente || "";
  original["obs_cliente"] = r.observacao_cliente || "";

  // Mapeamento dinâmico expansivo para cobrir Agendas e Consultas (padrão legado CSV/Web)
  if (r.data_agenda) { original["Data_Consulta"] = paraBR(r.data_agenda); original["Data da Consulta"] = paraBR(r.data_agenda); original["Data"] = paraBR(r.data_agenda); }
  if (r.data_consulta) { original["Data_Consulta"] = paraBR(r.data_consulta); original["Data da Consulta"] = paraBR(r.data_consulta); original["Data"] = paraBR(r.data_consulta); }

  if (r.horario_inicio) { original["Horário início"] = formatarHora(r.horario_inicio); original["Início"] = formatarHora(r.horario_inicio); original["Horario_inicio"] = formatarHora(r.horario_inicio); }
  if (r.horario_fim) { original["Horário Fim"] = formatarHora(r.horario_fim); original["Fim"] = formatarHora(r.horario_fim); original["Horario_Fim"] = formatarHora(r.horario_fim); }

  if (r.forma_consulta) { original["Forma da Consulta"] = r.forma_consulta; original["Forma"] = r.forma_consulta; }
  if (r.codigo_especialista) { original["Codigo_Especialista"] = r.codigo_especialista; original["Especialista"] = r.codigo_especialista; }
  if (r.nome_especialista) { original["Nome Especialista"] = r.nome_especialista; original["Nome_Especialista"] = r.nome_especialista; }
  if (r.celular_especialista) { original["Celular Especialista"] = r.celular_especialista; original["Celular_Especialista"] = r.celular_especialista; }
  if (r.especialidade) { original["Especialidade"] = r.especialidade; }
  if (r.valor_consulta) { original["Valor"] = r.valor_consulta; original["Valor_Consulta"] = r.valor_consulta; }
  if (r.status) { original["Status"] = r.status; }
  if (r.cliente_nome) { original["Cliente"] = r.cliente_nome; }
  if (r.cliente_celular) { original["Celular Cliente"] = r.cliente_celular; original["Celular_Cliente"] = r.cliente_celular; }

  return original;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return responderJSON({ sucesso: false, erro: "Apenas requisições POST são permitidas." }, 405);
  }

  try {
    const payload = await req.json();
    const acao = payload.acao;
    const authHeader = req.headers.get('Authorization')!;

    // Instancia cliente Supabase com o JWT do usuário para respeitar RLS e Triggers
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log(`DEBUG PAYLOAD [Ação: ${acao || 'none'}]:`, JSON.stringify(payload));
    console.log("Recebi pedido de:", payload.email || payload.emailCliente || "desconhecido");

    if (!acao) {
      return responderJSON({ sucesso: false, erro: "Ação não reconhecida: undefined" }, 400);
    }

    const connection = await pool.connect();

    try {
      switch (acao) {

        case 'ping':
          return responderJSON({ sucesso: true, mensagem: "Webhook Supabase/Deno online e operante!" });

        // ROTA 1 - BUSCAR ESPECIALISTA
        case 'buscar_especialista': {
          const id = payload.id;
          const cod = payload.codigo_especialista || payload.codEspecialista;
          const emp = String(payload.codigoempresa || "").trim();

          if (!emp) return responderJSON({ sucesso: false, erro: "codigoempresa obrigatório." }, 200);

          let query = supabase.from('especialistas').select('*').eq('codigoempresa', emp).eq('ativo', true);
          if (id) query = query.eq('id', id);
          else if (cod) query = query.eq('codigo_especialista', cod);
          else return responderJSON({ sucesso: false, erro: "ID ou Código obrigatórios." }, 200);

          const { data, error } = await query.single();
          if (error || !data) return responderJSON({ sucesso: false, erro: "Especialista não encontrado." }, 200);
          return responderJSON({ sucesso: true, especialista: data });
        }

        // ROTA 2 - LISTAR ESPECIALISTAS ATIVOS
        case 'listar_especialistas': {
          const emp = String(payload.codigoempresa || "").trim();
          if (!emp) return responderJSON({ sucesso: false, erro: "codigoempresa ausente." }, 200);

          const { data, error } = await supabase
            .from('especialistas')
            .select('*')
            .eq('codigoempresa', emp)
            .eq('ativo', true)
            .order('nome', { ascending: true });

          if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
          return responderJSON({ sucesso: true, especialistas: data || [] });
        }

        // ROTA 3 - LISTAR DATAS DISPONÍVEIS
        case 'listar_datas_disponiveis': {
          const especialista = String(payload.especialista || "").trim();
          const codigoempresa = String(payload.codigoempresa || "").trim();

          const queryDatas = `
            SELECT DISTINCT data_agenda, forma_consulta, nome_especialista, celular_especialista
            FROM agendas 
            WHERE codigo_especialista = $1 AND codigoempresa = $2 
              AND status ILIKE '%ispon%' 
              AND (data_agenda + horario_inicio::time) > NOW() + interval '4 hours'
            ORDER BY data_agenda ASC;
          `;
          const resDatas = await connection.queryObject({ text: queryDatas, args: [especialista, codigoempresa] });

          const waRows = resDatas.rows.map((r: any) => {
            const dataValue = r.data_agenda instanceof Date ? r.data_agenda.toISOString().split('T')[0] : String(r.data_agenda);
            const [ano, mes, dia] = dataValue.split('-');
            const dt = new Date(Number(ano), Number(mes) - 1, Number(dia));
            const diaStr = `${dia}/${mes}/${ano}`;
            const diaDaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dt.getDay()];
            return {
              id: `dataVerHorarios_${especialista}_${diaStr}`.substring(0, 200),
              title: `??? ${diaStr} - ${diaDaSemana}`.substring(0, 24),
              description: `${r.celular_especialista} - ${r.forma_consulta}`.substring(0, 72)
            };
          });

          const mensagensWhatsApp = [];
          const chunkSize = 10;
          const totalPages = Math.ceil(waRows.length / chunkSize) || 1;
          for (let i = 0; i < waRows.length; i += chunkSize) {
            const chunk = waRows.slice(i, i + chunkSize);
            const pageNumber = Math.floor(i / chunkSize) + 1;
            let bodyText = "Selecione o Dia desejado:";
            if (totalPages > 1) bodyText = `??? DATAS DISPONÍVEIS (${pageNumber}/${totalPages})`;
            mensagensWhatsApp.push({
              type: "interactive",
              interactive: {
                type: "list", header: { type: "text", text: "Datas Disponíveis" }, body: { text: bodyText },
                action: { button: "Ver Datas", sections: [{ title: "Agenda", rows: chunk }] }
              }
            });
          }

          const retDatasCompativel = resDatas.rows.map((r: any) => {
            const dataValue = r.data_agenda instanceof Date ? r.data_agenda.toISOString().split('T')[0] : String(r.data_agenda);
            const [ano, mes, dia] = dataValue.split('-');
            return `${dia}/${mes}/${ano}`;
          });

          return responderJSON({
            sucesso: true,
            codigoEspecialista: especialista,
            datasDisponiveis: retDatasCompativel,
            mensagensWhatsApp: mensagensWhatsApp
          });
        }

        // ROTA 4 - LISTAR HORÁRIOS DISPONÍVEIS
        case 'listar_horarios_disponiveis': {
          const especialista = String(payload.especialista || "").trim();
          const codigoempresa = String(payload.codigoempresa || "").trim();
          const dataStr = String(payload.data || "").trim();
          const dataIso = paraISO(dataStr);

          const queryHorarios = `
            SELECT horario_inicio as dataInicio, horario_fim as dataFim, forma_consulta, nome_especialista, celular_especialista
            FROM agendas 
            WHERE codigo_especialista = $1 AND codigoempresa = $2 AND data_agenda = $3
              AND status ILIKE '%ispon%' 
              AND (data_agenda + horario_inicio::time) > NOW() + interval '4 hours'
            ORDER BY horario_inicio ASC;
          `;
          const resHorarios = await connection.queryObject({ text: queryHorarios, args: [especialista, codigoempresa, dataIso] });

          let dadosEspecialista: any = { codigoEspecialista: especialista };
          if (resHorarios.rowCount > 0) {
            const f: any = resHorarios.rows[0];
            dadosEspecialista = { codigoEspecialista: especialista, nomeEspecialista: f.nome_especialista, celularEspecialista: f.celular_especialista };
          }

          const waRows = resHorarios.rows.map((r: any) => {
            const hIni = String(r.datainicio).substring(0, 5);
            const hFim = String(r.datafim).substring(0, 5);
            return {
              id: `horaDeAgendamento_${especialista}_${dataStr}_${hIni}`.substring(0, 200),
              title: `?? ${hIni} às ${hFim}`.substring(0, 24),
              description: `${dataStr} - ${r.nome_especialista || especialista}`.substring(0, 72)
            };
          });

          const mensagensWhatsApp = [];
          const chunkSize = 10;
          const totalPages = Math.ceil(waRows.length / chunkSize) || 1;
          for (let i = 0; i < waRows.length; i += chunkSize) {
            const chunk = waRows.slice(i, i + chunkSize);
            const pageNumber = Math.floor(i / chunkSize) + 1;
            let bodyText = "Selecione o horário desejado para o atendimento:";
            if (totalPages > 1) bodyText = `?? HORÁRIOS DISPONÍVEIS (${pageNumber}/${totalPages})`;
            mensagensWhatsApp.push({
              type: "interactive",
              interactive: {
                type: "list", header: { type: "text", text: "Horários Disponíveis" }, body: { text: bodyText },
                action: { button: "Ver Horários", sections: [{ title: "Agendamento", rows: chunk }] }
              }
            });
          }

          return responderJSON({
            sucesso: true,
            dadosEspecialista,
            horariosDisponiveis: resHorarios.rows.map((r: any) => ({
              dataInicio: String(r.datainicio).substring(0, 5),
              dataFim: String(r.datafim).substring(0, 5),
              formaAtendimento: r.forma_consulta,
              nomeEspecialista: r.nome_especialista,
              celularEspecialista: r.celular_especialista
            })),
            mensagensWhatsApp
          });
        }

        // ROTA 5 - BUSCAR TEMPORARIO (USUARIOS)
        case 'buscar_temporario': {
          const celularRaw = String(payload.celularCliente || payload.celular || "");
          const celLimpo = celularRaw.replace(/\D/g, '');
          const emp = String(payload.codigoempresa || "").trim();

          const queryTemp = `SELECT * FROM usuarios WHERE celular = $1 AND codigoempresa = $2 LIMIT 1`;
          const resTemp = await connection.queryObject({ text: queryTemp, args: [celLimpo, emp] });
          if (resTemp.rowCount > 0) {
            return responderJSON({ sucesso: true, dados: resTemp.rows[0] });
          }
          return responderJSON({ sucesso: false, erro: "Usuário não encontrado." }, 200);
        }

        // ROTA 6 - BUSCAR PRODUTO
        case 'buscar_produto': {
          let codigoFinalProd = String(payload.codigoProduto || "").trim();
          const pCod2 = String(payload.codigo2 || "").trim();
          const pCod3 = String(payload.codigo3 || "").trim();

          if (!codigoFinalProd && (pCod2 || pCod3)) {
            codigoFinalProd = pCod3 ? pCod3 + "_" + pCod2 : pCod2;
          } else {
            if (pCod2) codigoFinalProd += "_" + pCod2;
            if (pCod3) codigoFinalProd += "_" + pCod3;
          }

          const empProd = String(payload.codigoempresa || "").trim();

          const queryProd = `SELECT * FROM produtos WHERE (codigo_produto = $1 OR id::text = $1) AND codigoempresa = $2 LIMIT 1`;
          const resProd = await connection.queryObject({ text: queryProd, args: [codigoFinalProd, empProd] });

          if (resProd.rowCount > 0) {
            const r: any = resProd.rows[0];
            const minima = {
              id: r.id,
              codigoProduto: r.codigo_produto,
              valorReal: String(r.valor_real),
              valorProm: String(r.valor_prom),
              subEspecialidade: r.sub_especialidade,
              especialista: "",
              celularEspecialista: "",
              localAtendimento: r.local_atendimento,
              formaAtendimento: r.forma_atendimento
            };
            return responderJSON({ sucesso: true, minima: minima, completa: r });
          }
          return responderJSON({ sucesso: false, erro: `Produto [${codigoFinalProd}] não encontrado.` }, 200);
        }

        // ROTA 6B - LISTAR PRODUTOS (SaaS)
        case 'listar_produtos': {
          try {
            const empProd = String(payload.codigoempresa || "").trim();
            const sub = String(payload.id_sub_especialidade || payload.subespecialidade || "").trim();
            if (!empProd) throw new Error("codigoempresa é obrigatório para listagem.");

            let realCod = sub;
            if (sub && /^[0-9a-fA-F-]{36}$/.test(sub)) {
              // A coluna real no Supabase é codigo_sub_especialidade
              const { data: subReg } = await supabase.from('sub_especialidades').select('codigo_sub_especialidade').eq('id', sub).single();
              if (subReg && subReg.codigo_sub_especialidade) {
                realCod = subReg.codigo_sub_especialidade;
              }
            }

            let query = supabase.from('produtos').select('*').eq('codigoempresa', empProd);
            if (realCod) {
              query = query.eq('cod_sub_especialidade', realCod);
            }

            const { data, error } = await query.order('nome_produto', { ascending: true });

            if (error) throw error;

            return responderJSON({
              sucesso: true,
              dados: data || []
            });
          } catch (e: any) {
            console.error("🔥 [ERRO LISTAR PRODUTOS]:", e.message);
            return responderJSON({ sucesso: false, erro: e.message }, 200);
          }
        }

        // ROTA 6C - CRIAR PRODUTO (SaaS)
        case 'criar_produto': {
          try {
            const empProd = String(payload.codigoempresa || "").trim();
            const idSubEsp = String(payload.id_sub_especialidade || payload.subespecialidade || "").trim();
            if (!empProd || !idSubEsp) throw new Error("codigoempresa e id_sub_especialidade são obrigatórios.");

            const isUUID = /^[0-9a-fA-F-]{36}$/.test(idSubEsp);
            const colName = isUUID ? 'id' : 'codigo_sub_especialidade';

            // 1. FinOps: Consulta Única com Entity JOIN (Single Fetch)
            const { data: subData, error: errSub } = await supabase
              .from('sub_especialidades')
              .select('*, especialidades(*)')
              .eq(colName, idSubEsp)
              .eq('codigo_empresa', empProd)
              .single();

            if (errSub || !subData) throw new Error("Sub-especialidade não encontrada para gerar contexto.");
            if (!subData.especialidades) throw new Error("Especialidade pai não encontrada na hierarquia.");

            const realCodEsp = subData.especialidades.codigo_especialidade; // O código string exato
            const realEsp = subData.especialidades.nome;
            const realCodSub = subData.codigo_sub_especialidade;
            const realSubEsp = subData.nome;
            const masterIdSubEsp = subData.id;

            // 2. Geração Automática do codigo_produto
            const { data: ultimos } = await supabase
              .from('produtos')
              .select('codigo_produto')
              .eq('codigoempresa', empProd)
              .eq('cod_sub_especialidade', realCodSub)
              .not('codigo_produto', 'is', null);

            let maxSeq = 0;
            if (ultimos && ultimos.length > 0) {
              ultimos.forEach((p: any) => {
                if (!p.codigo_produto) return;
                const parts = p.codigo_produto.split('_');
                if (parts.length > 1) {
                  const numMatch = parts[1].match(/\d+/);
                  if (numMatch) {
                    const seq = parseInt(numMatch[0]) || 0;
                    if (seq > maxSeq) maxSeq = seq;
                  }
                }
              });
            }
            const nextSeq = maxSeq + 1;
            const formaAtend = String(payload.forma_atendimento || "").trim();
            const sufixo = formaAtend.toLowerCase() === 'on-line' ? 'ON' : 'CP';
            const novoCodigoProduto = `${realCodSub}_${nextSeq}${sufixo}`;

            const novoProduto = {
              codigoempresa: empProd,
              cod_especialidade: realCodEsp,
              especialidade: realEsp,
              cod_sub_especialidade: realCodSub,
              sub_especialidade: realSubEsp,
              codigo_produto: novoCodigoProduto,
              nome_produto: String(payload.nome_produto || "").trim(),
              duracao_trabalho: String(payload.duracao_trabalho || "").trim(),
              valor_real: limparMonetario(payload.valor_real),
              valor_promo: payload.valor_promo ? limparMonetario(payload.valor_promo) : null,
              status: String(payload.status || "active").trim(),
              forma_atendimento: formaAtend,
              info_do_produto: String(payload.info_do_produto || "").trim(),
              orientacao_cliente: String(payload.orientacao_cliente || "").trim(),
              local_atendimento: String(payload.local_atendimento || "").trim()
            };

            const { error: insErr } = await supabase.from('produtos').insert([novoProduto]);
            if (insErr) throw insErr;

            return responderJSON({ sucesso: true, mensagem: `Produto ${novoCodigoProduto} cadastrado com sucesso.` });
          } catch (e: any) {
            console.error("🔥 [ERRO CRIAR PRODUTO]:", e.message);
            return responderJSON({ sucesso: false, erro: e.message }, 200);
          }
        }

        // ROTA 6D - ATUALIZAR PRODUTO (SaaS)
        case 'atualizar_produto': {
          try {
            const empProd = String(payload.codigoempresa || "").trim();
            const idProd = payload.id;
            if (!empProd || !idProd) throw new Error("codigoempresa e id são obrigatórios.");

            const produtoAtualizado: any = {
              nome_produto: String(payload.nome_produto || "").trim(),
              duracao_trabalho: String(payload.duracao_trabalho || "").trim(),
              valor_real: limparMonetario(payload.valor_real),
              valor_promo: payload.valor_promo ? limparMonetario(payload.valor_promo) : null,
              status: String(payload.status || "active").trim(),
              forma_atendimento: String(payload.forma_atendimento || "").trim(),
              info_do_produto: String(payload.info_do_produto || "").trim(),
              orientacao_cliente: String(payload.orientacao_cliente || "").trim(),
              local_atendimento: String(payload.local_atendimento || "").trim()
            };

            // Se alterou a Sub-especialidade (ID)
            const idSubEsp = String(payload.id_sub_especialidade || payload.subespecialidade || "").trim();
            if (idSubEsp) {
              const { data: subData } = await supabase.from('sub_especialidades').select('*').eq('id', idSubEsp).eq('codigoempresa', empProd).single();
              if (subData) {
                produtoAtualizado.cod_especialidade = subData.cod_especialidade;
                produtoAtualizado.especialidade = subData.especialidade;
                produtoAtualizado.cod_sub_especialidade = subData.cod_sub_especialidade;
                produtoAtualizado.sub_especialidade = subData.sub_especialidade;
              }
            }

            const { error: updErr } = await supabase.from('produtos').update(produtoAtualizado).eq('id', idProd).eq('codigoempresa', empProd);
            if (updErr) throw updErr;

            return responderJSON({ sucesso: true, mensagem: "Produto atualizado com sucesso." });
          } catch (e: any) {
            console.error("🔥 [ERRO ATUALIZAR PRODUTO]:", e.message);
            return responderJSON({ sucesso: false, erro: e.message }, 200);
          }
        }

        // ROTA 6E - EXCLUIR PRODUTO (SaaS)
        case 'excluir_produto': {
          try {
            const empProd = String(payload.codigoempresa || "").trim();
            const idProd = payload.id;
            if (!empProd || !idProd) throw new Error("codigoempresa e id são obrigatórios.");

            const { error: delErr } = await supabase.from('produtos').delete().eq('id', idProd).eq('codigoempresa', empProd);
            if (delErr) throw delErr;

            return responderJSON({ sucesso: true, mensagem: "Produto excluído com sucesso." });
          } catch (e: any) {
            console.error("🔥 [ERRO EXCLUIR PRODUTO]:", e.message);
            return responderJSON({ sucesso: false, erro: e.message }, 200);
          }
        }

        // ROTA 7 - BUSCAR AGENDAMENTO ESPECÍFICO
        case 'buscar_agendamento_especifico': {
          const codigoempresa = String(payload.codigoempresa || "").trim();
          const especialista = String(payload.especialista || "").trim();
          const status = String(payload.status || "").trim();
          const horarioInicio = String(payload.horarioInicio || "").trim();
          const dataIso = paraISO(String(payload.data || ""));

          const queryEspAg = `
            SELECT * FROM agendas 
            WHERE codigoempresa = $1 AND codigo_especialista = $2 
              AND data_agenda = $3 AND horario_inicio = $4 AND status ILIKE $5 LIMIT 1`;
          const resEspAg = await connection.queryObject({
            text: queryEspAg,
            args: [codigoempresa, especialista, dataIso, horarioInicio, status]
          });

          if (resEspAg.rowCount > 0) {
            const objFormatado = formatarParaLegado(resEspAg.rows[0]);
            return responderJSON({ sucesso: true, dados: objFormatado });
          }
          return responderJSON({ sucesso: false, erro: "Agendamento não encontrado." }, 200);
        }

        // ROTA 8 - SALVAR AGENDAMENTO
        case 'salvar_agendamento': {
          const codigoempresa = String(payload.codigoempresa || "").trim();
          if (!codigoempresa) return responderJSON({ sucesso: false, erro: "codigoempresa obrigatório." }, 400);

          const codEspecialista = String(payload.Codigo_Especialista || "").trim();
          const dataConsultaStr = String(payload.Data_Consulta || "").trim();
          const hInicio = String(payload["Horário início"] || payload.Horario_inicio || "00:00").trim();
          const hFim = String(payload["Horário Fim"] || payload.Horario_Fim || "00:00").trim();
          const dataConsultaIso = paraISO(dataConsultaStr);

          // OVERLAP CHECK
          const colisionCheckQuery = `
            SELECT id FROM consultas 
            WHERE codigoempresa = $1 
              AND codigo_especialista = $2 
              AND data_consulta = $3 
              AND status NOT IN ('Cancelado', 'Arquivado')
              AND (horario_inicio < $5 AND horario_fim > $4)
            LIMIT 1;
          `;
          const colisionRes = await connection.queryObject({
            text: colisionCheckQuery,
            args: [codigoempresa, codEspecialista, dataConsultaIso, hInicio, hFim]
          });

          if (colisionRes.rowCount > 0) {
            return responderJSON({ sucesso: false, erro: "Conflito de horário detectado para este especialista." }, 200);
          }

          const insertQuery = `
            INSERT INTO consultas (
              forma_consulta, codigo_especialista, nome_especialista, 
              celular_especialista, data_consulta, horario_inicio, horario_fim, 
              especialidade, valor_consulta, cliente_nome, cliente_celular, 
              status, local_atendimento, id_pagamento, status_pagamento, 
              link_pagamento, status_cliente, email_especialista, codigo_produto, codigoempresa
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            ) RETURNING id;
          `;
          const valorNumeric = limparMonetario(payload.Valor);

          await connection.queryObject({
            text: insertQuery,
            args: [
              String(payload["Forma da Consulta"] || payload.Forma_da_Consulta || "Presencial ou On-Line"),
              codEspecialista,
              String(payload.Nome_Especialista || ""),
              String(payload.Celular_Especialista || ""),
              dataConsultaIso,
              hInicio,
              hFim,
              String(payload.Especialidade || ""),
              valorNumeric,
              String(payload.Cliente || ""),
              String(payload.Celular_Cliente || ""),
              String(payload.Status || "Não confirmado"),
              String(payload.Local || ""),
              String(payload.ID_pagamento || ""),
              String(payload.Status_pagamento || ""),
              String(payload.Link_pagamento || payload.Link_Pagamento || ""),
              String(payload.Status_cliente || ""),
              String(payload.Email_Especialista || ""),
              String(payload.Codigo_produto || ""),
              codigoempresa
            ]
          });

          return responderJSON({
            sucesso: true,
            mensagem: "Agendamento inserido com sucesso na aba Consultas!",
            id_pagamento: String(payload.ID_pagamento || "")
          });
        }

        // ROTA 9 - ATUALIZAR STATUS AGENDA
        case 'atualizar_status_agenda': {
          const codigoempresa = String(payload.codigoempresa || "").trim();
          const especialista = String(payload.especialista || "").trim();
          const horarioInicio = String(payload.horarioInicio || "").trim();
          const novoStatus = String(payload.novoStatus || "").trim();
          const dataIso = paraISO(String(payload.data || ""));

          const updateQ = `
            UPDATE agendas 
            SET status = $1, updated_at = NOW() 
            WHERE codigoempresa = $2 AND codigo_especialista = $3 
              AND data_agenda = $4 AND horario_inicio = $5;
          `;
          await connection.queryObject({
            text: updateQ,
            args: [novoStatus, codigoempresa, especialista, dataIso, horarioInicio]
          });
          return responderJSON({ sucesso: true, mensagem: "Status atualizado com sucesso para: " + novoStatus });
        }

        // ROTA 10 - PONTO DE ENTRADA DO BOT N8N (LISTAR CONSULTAS CLIENTE)
        case 'listar_consultas_cliente': {
          console.log("DEBUG VARS ROTA 10:", { empresa: payload.codigoempresa, celular: payload.celularCliente });

          if (!payload.codigoempresa || !payload.celularCliente) {
            throw new Error("Parâmetros codigoempresa ou celularCliente ausentes no payload.");
          }

          const celProcurado = String(payload.celularCliente).replace(/\D/g, '');
          const empresaBuscada = String(payload.codigoempresa).trim();
          const textoBoasVindas = String(payload.boasVindas || "").trim();
          const horasMinimas = parseInt(payload.horasMinimas) || 4;
          const linkPainel = String(payload.linkPainel || "").trim();

          // 1. Fetch de todas as consultas do cliente
          const queryConsultas = `
            SELECT * FROM consultas 
            WHERE codigoempresa = $1 
              AND regexp_replace(COALESCE(cliente_celular, ''), '\\D', '', 'g') LIKE '%' || regexp_replace($2, '\\D', '', 'g') || '%'
            ORDER BY data_consulta DESC, horario_inicio DESC;
          `;
          const resConsultas = await connection.queryObject({
            text: queryConsultas,
            args: [String(payload.codigoempresa), String(payload.celularCliente)]
          });

          const agora = new Date();
          const tempoLimite = new Date(agora.getTime() + (horasMinimas * 60 * 60 * 1000));

          const consultasParaRemarcacao: any[] = [];
          const consultasDentroHorario: any[] = [];
          const consultasConfirmadaVencida: any[] = [];
          let consultasAtendidas: any[] = [];
          const waRows: any[] = [];
          const waRowsAtrasadas: any[] = [];

          const rawList = resConsultas.rows.map((r: any) => {
            const dataConsultaBr = paraBR(r.data_consulta);
            const hIni = formatarHora(r.horario_inicio);
            const hFim = formatarHora(r.horario_fim);

            return {
              ...r,
              // Sobreposição limpa dos dados crus do banco para evitar timestamps ISO:
              data_consulta: dataConsultaBr,
              horario_inicio: hIni,
              horario_fim: hFim,
              created_at: formatarTimestampBR(r.created_at),
              updated_at: formatarTimestampBR(r.updated_at),
              // Normaliza chaves ao padrão legado pra manter retrocompatibilidade
              "Forma da Consulta": r.forma_consulta,
              "Especialidade": r.especialidade,
              "Nome Especialista": r.nome_especialista,
              "Codigo_Especialista": r.codigo_especialista,
              "Data_Consulta": dataConsultaBr,
              "Data": dataConsultaBr,
              "Horário início": hIni,
              "Horário Fim": hFim,
              "Local": r.local_atendimento,
              "Status": r.status,
              "Link_pagamento": r.link_pagamento,
              "Codigo_produto": r.codigo_produto,
              "Valor": r.valor_consulta,
              "ID_pagamento": r.id_pagamento
            };
          });

          for (const c of rawList) {
            if (!c.Data_Consulta || !c["Horário início"]) continue;

            let dia, mes, ano;
            if (c.Data_Consulta.includes('/')) {
              [dia, mes, ano] = c.Data_Consulta.split('/');
            } else {
              [ano, mes, dia] = c.Data_Consulta.split('-');
            }

            const [hora, min] = c["Horário início"].split(':');
            const dataHoraPlanilha = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(min));

            const statusLimpo = String(c.Status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            c.statusOriginalAcesso = String(c.Status || "");
            c.statusLimpoAcesso = statusLimpo;
            c.dataObj = dataHoraPlanilha;

            const isNaoConfirmado = statusLimpo.includes("nao") && statusLimpo.includes("confirmad");
            const isConfirmado = !statusLimpo.includes("nao") && statusLimpo.includes("confirmad");
            const isAdiado = statusLimpo.includes("adiad");
            const isAtendido = statusLimpo.includes("atendid") || statusLimpo.includes("realizad");
            const isCancelado = statusLimpo.includes("cancelad");
            const isFaltou = statusLimpo.includes("faltou");

            // 1. Consultas à Realizar
            if ((isConfirmado || isNaoConfirmado || isAdiado) && dataHoraPlanilha > agora) {
              consultasDentroHorario.push(c);
            }

            // 2. Consultas para Remarcação
            if (isCancelado || isFaltou || ((isConfirmado || isNaoConfirmado || isAdiado) && dataHoraPlanilha > tempoLimite)) {
              consultasParaRemarcacao.push(c);
              const idBotao = `rmc_${c.Codigo_Especialista}_${c["Forma da Consulta"]}_${c.Especialidade}_${c.Valor}_${c.ID_pagamento}_${c.Data_Consulta}_${c["Horário início"]}`.substring(0, 200);
              const tituloBotao = `${c.Data_Consulta} às ${c["Horário início"]}`.substring(0, 24);
              const descricaoBotao = `${c.Especialidade} com ${c["Nome Especialista"]} - ${c["Forma da Consulta"]}`.substring(0, 72);
              waRows.push({ id: idBotao, title: tituloBotao, description: descricaoBotao });
            }

            // 3. Consultas Vencidas
            if (isConfirmado && dataHoraPlanilha < agora) {
              consultasConfirmadaVencida.push(c);
              const idBotaoV = `venc_${c.Codigo_Especialista}_${c["Forma da Consulta"]}_${c.Especialidade}_${c.Valor}_${c.ID_pagamento}_${c.Data_Consulta}_${c["Horário início"]}`.substring(0, 200);
              const tituloBotaoV = `${c.Data_Consulta} às ${c["Horário início"]}`.substring(0, 24);
              const descricaoBotaoV = `${c.Especialidade} com ${c["Nome Especialista"]} - ${c["Forma da Consulta"]}`.substring(0, 72);
              waRowsAtrasadas.push({ id: idBotaoV, title: tituloBotaoV, description: descricaoBotaoV });
            }

            // 4. Consultas Realizadas/Atendidas
            if (isAtendido && dataHoraPlanilha < agora) {
              consultasAtendidas.push(c);
            }
          }

          consultasAtendidas.sort((a, b) => b.dataObj.getTime() - a.dataObj.getTime());
          consultasAtendidas = consultasAtendidas.slice(0, 3);

          const chunkSize = 10;
          const mensagensWhatsApp = [];
          for (let i = 0; i < waRows.length; i += chunkSize) {
            const chunk = waRows.slice(i, i + chunkSize);
            mensagensWhatsApp.push({
              messaging_product: "whatsapp", recipient_type: "individual", to: celProcurado,
              type: "interactive",
              interactive: {
                type: "list", body: { text: "Consultas disponíveis para remarcação (mínimo 4h de antecedência):" },
                action: { button: "Consultas", sections: [{ title: "Selecione", rows: chunk }] }
              }
            });
          }

          const mensagensAtrasadas = [];
          for (let i = 0; i < waRowsAtrasadas.length; i += chunkSize) {
            const chunk = waRowsAtrasadas.slice(i, i + chunkSize);
            mensagensAtrasadas.push({
              messaging_product: "whatsapp", recipient_type: "individual", to: celProcurado,
              type: "interactive",
              interactive: {
                type: "list", body: { text: "Consultas confirmadas que já passaram do horário:" },
                action: { button: "Consultas", sections: [{ title: "Selecione", rows: chunk }] }
              }
            });
          }

          const formatarTextoWA = (arr: any[], tipo: string) => {
            if (!arr || arr.length === 0) return "Não foram encontradas consultas.";
            let temNaoConf = false;
            let stringStart = "Segue Consulta(s) até este momento:\n\n";

            const blocos = arr.map((c, idx) => {
              const forma = c["Forma da Consulta"] || "Online";
              const esp = c.Especialidade || "";
              const nome = c["Nome Especialista"] || "";
              let dataBr = c.Data_Consulta || "";
              if (dataBr.includes("-")) { const p = dataBr.split('-'); dataBr = `${p[2]}/${p[1]}/${p[0]}`; }
              const hIni = c["Horário início"] || "00:00";
              const hFim = c["Horário Fim"] || "00:00";
              const local = c.Local || "";
              const statusOrig = c.statusOriginalAcesso || "";
              const linkPag = c.Link_pagamento || "";
              const codProd = c.Codigo_produto || "";

              const isNao = c.statusLimpoAcesso.includes("nao") && c.statusLimpoAcesso.includes("confirmad");
              const isConf = !c.statusLimpoAcesso.includes("nao") && c.statusLimpoAcesso.includes("confirmad");
              if (isNao) temNaoConf = true;

              let trechoLocal = (forma.toLowerCase().includes("presencial") && local) ? `\n  - Local da Consulta: ${local}` : "";
              let txt = `*${idx + 1}.* ${esp} com ${nome} - ${forma} - dia ${dataBr}, das ${hIni} às ${hFim}${trechoLocal}\n  - Status: *${statusOrig}*`;

              if (tipo === "dentro_horario") {
                if (isNao && linkPag) txt += `\n  - Link Pagamento: ${linkPag} \n??*Agendamento não confirmado!* Clique no link acima para fazer o pagamento e confirmar o agendamento.`;
                if (isConf && codProd) txt += `\n\nInformações importantes para esse encontro: https://www.datamarcada.com.br/?cod=${codProd}`;
              }
              return txt;
            });

            let tx = stringStart + blocos.join('\n\n');
            if (tipo === "dentro_horario" && temNaoConf) {
              tx += `\n\n? Lembrando que agendamentos com mais de *24 horas* e *sem pagamento*, serão *Cancelados*!`;
            }
            return tx;
          };

          const textoDentroHorario = formatarTextoWA(consultasDentroHorario, "dentro_horario");
          const textoConfirmadaVencida = formatarTextoWA(consultasConfirmadaVencida, "vencida");
          const textoAtendidas = formatarTextoWA(consultasAtendidas, "atendida");

          let temPerfil = false;
          let textoPerfil = "Perfil não encontrado.";
          const menuRows = [];

          const queryUser = `SELECT * FROM usuarios WHERE celular = regexp_replace($1, '\\D', '', 'g') AND codigoempresa = $2 LIMIT 1`;
          const resUser = await connection.queryObject({
            text: queryUser,
            args: [String(payload.celularCliente), String(payload.codigoempresa)]
          });

          if (resUser.rowCount > 0) {
            const u: any = resUser.rows[0];
            if (u.email) {
              temPerfil = true;
              textoPerfil = `?? Aqui estão as informações do seu Perfil:\n*Nome e sobrenome:* ${u.nome_sobrenome}\n*Email:* ${u.email}\n*Tipo Usuário:* ${u.tipo_usuario}\n*Acesso a Painel Geral:* ${linkPainel}`;
            }
          }

          if (temPerfil) {
            if (consultasDentroHorario.length > 0) menuRows.push({ id: "consultas_a_realizar", title: "1?? Consultas à Realizar", description: "Veja suas Consultas agendadas." });
            if (consultasParaRemarcacao.length > 0) menuRows.push({ id: "para_remarcar", title: "2?? Para Remarcar", description: "Consultas que ainda podem ser remarcadas." });
            if (consultasConfirmadaVencida.length > 0) menuRows.push({ id: "consultas_vencidas", title: "3?? Consultas Vencidas", description: "Consultas Agendadas e Vencidas." });
            if (consultasAtendidas.length > 0) menuRows.push({ id: "historico_consultas", title: "4?? Consultas Realizadas", description: "Consultas Atendidas." });
            menuRows.push({ id: "meu_perfil", title: "5?? Meu Perfil", description: "Acesse os dados do seu perfil." });
          }

          const menuGeral: any = menuRows.length > 0 ? menuRows : "Lista vazia";

          const limparSaidaArray = (arr: any[]) => {
            return arr.map(c => {
              const o = { ...c };

              if (o.hasOwnProperty('dataObj')) delete o.dataObj;

              o.data_criacao = o.data_criacao ? paraBR(o.data_criacao) : null;
              o.created_at = o.created_at ? formatarTimestampBR(o.created_at) : null;
              o.updated_at = o.updated_at ? formatarTimestampBR(o.updated_at) : null;

              return o;
            });
          };

          return responderJSON({
            sucesso: true,
            total: consultasParaRemarcacao.length,
            consultas: limparSaidaArray(consultasParaRemarcacao),
            mensagensWhatsApp,
            whatsappConfirmadaAtrasada: mensagensAtrasadas,
            menuGeral: menuGeral,
            perfilUsuario: textoPerfil,
            boasVindas: textoBoasVindas,
            textoConsultasDentroHorario: textoDentroHorario,
            textoConsultasConfirmadaVencida: textoConfirmadaVencida,
            textoConsultasAtendidas: textoAtendidas
          });
        }

        // ROTA 11 - LISTAR PRODUTOS SUBMENU
        case 'listar_produtos_submenu': {
          console.log("DEBUG VARS ROTA 11:", { empresa: payload.codigoempresa, submenu: payload.codigo_subMenu });
          const submenuOriginal = String(payload.codigo_subMenu || "").trim();
          const emp = String(payload.codigoempresa || "").trim();

          if (!emp || !submenuOriginal) {
            throw new Error("Parâmetros codigoempresa ou codigo_subMenu ausentes no payload.");
          }

          const querySub = `SELECT * FROM produtos WHERE codigoempresa = $1 AND cod_sub_especialidade = $2`;
          const resSub = await connection.queryObject({
            text: querySub,
            args: [emp, submenuOriginal]
          });

          const rows = resSub.rows;
          if (rows.length === 0) {
            return responderJSON({ sucesso: false, erro: "Nenhum produto encontrado neste submenu." }, 200);
          }

          rows.sort((a: any, b: any) => {
            const aCod = String(a.codigo_produto || "").toUpperCase();
            const bCod = String(b.codigo_produto || "").toUpperCase();
            const aTemX = aCod.includes('X');
            const bTemX = bCod.includes('X');

            if (aTemX && !bTemX) return -1;
            if (!aTemX && bTemX) return 1;

            if (aCod < bCod) return -1;
            if (aCod > bCod) return 1;
            return 0;
          });

          let headerNome = "Selecione o Item desejado:";
          const itemX = rows.find((r: any) => String(r.codigo_produto).toUpperCase().includes('X'));
          if (itemX && itemX.nome_produto) {
            headerNome = itemX.nome_produto;
          }

          const waRows = rows.map((r: any) => {
            const temX = String(r.codigo_produto).toUpperCase().includes('X');
            const finalId = temX ? `cXt_${r.codigo_produto}` : `${r.codigo_produto}_PROD`;

            let descricao = "";
            const valRealNum = r.valor_real ? Number(r.valor_real) : 0;
            const valPromNum = r.valor_prom ? Number(r.valor_prom) : 0;

            if (r.forma_atendimento && valRealNum > 0) {
              descricao = `${r.forma_atendimento} : R$ ${valRealNum}`;
              if (valPromNum > 0) {
                descricao = `${r.forma_atendimento} : de R$ ${valRealNum} por R$ ${valPromNum}`;
              }
            } else if (r.forma_atendimento) {
              descricao = r.forma_atendimento;
            } else if (valRealNum > 0) {
              descricao = `R$ ${valRealNum}`;
            }

            return {
              id: finalId.substring(0, 200),
              title: String(r.nome_produto).substring(0, 24),
              description: descricao.substring(0, 72)
            };
          });

          const outPayload = [{
            tipo: "produtos",
            result: {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: String(payload.celular_Cliente || ""),
              type: "interactive",
              interactive: {
                type: "list",
                body: { text: headerNome },
                action: {
                  button: "Opções",
                  sections: [{ title: "Opções gerais", rows: waRows }]
                }
              }
            }
          }];

          return responderJSON(outPayload);
        }

        // ROTA 12 - MÁQUINA DE REMARCAÇÃO (3 PASSOS)
        case 'datas_disponiveis_remarcacao': {
          console.log("DEBUG VARS ROTA 12:", { emp: payload.codigoempresa, info: payload.infoGeral, nova: payload.novaData });

          const emp = String(payload.codigoempresa || "").trim();
          const celularRaw = String(payload.telefone || payload.celular_Cliente || payload.celularCliente || "").replace(/\D/g, '');
          const infoGeral = String(payload.infoGeral || "");
          const novaData = String(payload.novaData || "").trim();

          if (!emp || !celularRaw || !infoGeral) {
            return responderJSON({ sucesso: false, erro: "codigoempresa, telefone e infoGeral são obrigatórios." }, 200);
          }

          // Descriptografando a Máquina de Estado Segura via Array Reverse-Like
          // infoGeral = rmc_{codigoEspecialista}_{forma}_{especialidade}_{valor}_{idPagamento}_{dataAntiga}_{horaAntiga}
          const infoParts = infoGeral.split('_');
          const codEspAntigo = infoParts[1] || "";
          const formaAntiga = infoParts[2] || "";
          const especialidadeAntiga = infoParts.slice(3, infoParts.length - 4).join('_');
          const dataAntigaStr = infoParts[infoParts.length - 2] || "";
          const horaAntigaStr = infoParts[infoParts.length - 1] || "";

          // ==============================
          // PASSO 2: LISTAR HORÁRIOS A PARTIR DA DATA
          // ==============================
          if (novaData.includes('rmc_dataVerHorarios_')) {
            const splitNova = novaData.split('_');
            const dataAlvoStr = splitNova[splitNova.length - 1];

            const qDatas = `
                SELECT horario_inicio, horario_fim, nome_especialista 
                FROM agendas 
                WHERE codigoempresa = $1 AND codigo_especialista = $2 
                  AND data_agenda = $3 AND status ILIKE '%ispon%'
                  AND (forma_consulta ILIKE '%' || $4 || '%' OR forma_consulta ILIKE '%ou%on-line%' OR forma_consulta ILIKE '%ou%online%' OR forma_consulta IS NULL)
                  AND (especialidade ILIKE '%' || $5 || '%' OR especialidade IS NULL OR trim(especialidade) = '')
                ORDER BY horario_inicio ASC
              `;

            console.log("SQL ARGS (Passo 2):", [emp, codEspAntigo, paraISO(dataAlvoStr), formaAntiga, especialidadeAntiga]);

            const resH = await connection.queryObject({
              text: qDatas,
              args: [emp, codEspAntigo, paraISO(dataAlvoStr), formaAntiga, especialidadeAntiga]
            });

            const horasDisponivel = resH.rows.map((r: any) => {
              const hIn = formatarHora(r.horario_inicio);
              const hFi = formatarHora(r.horario_fim);

              const p = dataAlvoStr.split('/');
              const dt = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
              const diaSemanaCurto = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dt.getDay()];

              return {
                id: `rmc_horaAgendamento_${codEspAntigo}_${dataAlvoStr}_${hIn}_${hFi}`.substring(0, 200),
                title: `?? ${hIn} às ${hFi}`.substring(0, 24),
                description: `${dataAlvoStr} - ${diaSemanaCurto} - ${r.nome_especialista || ""}`.substring(0, 72)
              };
            });

            return responderJSON({ sucesso: true, passo: 2, horasDisponivel });
          }

          // ==============================
          // PASSO 3: EFETIVAR REMARCAÇÃO (TRANSACIONAL)
          // ==============================
          if (novaData.includes('rmc_horaAgendamento_')) {
            let templateSucesso = payload.mensagemSucesso || "Remarcação efetuada com sucesso!";

            const splitNova = novaData.split('_');
            const hFimNovo = splitNova[splitNova.length - 1];
            const hIniNovo = splitNova[splitNova.length - 2];
            const dataNova = splitNova[splitNova.length - 3];

            // Double-Booking Check (Trava de Concorrência)
            const qVerifica = `
                SELECT id FROM agendas 
                WHERE codigoempresa = $1 AND codigo_especialista = $2 
                  AND data_agenda = $3 AND horario_inicio = $4 AND status ILIKE '%ispon%' LIMIT 1
              `;
            const resDouble = await connection.queryObject({
              text: qVerifica,
              args: [emp, codEspAntigo, paraISO(dataNova), hIniNovo]
            });

            if (resDouble.rowCount === 0) {
              return responderJSON({ sucesso: false, horarioOcupado: "?? Infelizmente este horário, nesta data, não está mais disponível!" }, 200);
            }

            // Busca a Consulta Antiga para Update e Replace de Labels
            const qConsultaAntiga = `
                SELECT * FROM consultas 
                WHERE codigoempresa = $1 AND regexp_replace(COALESCE(cliente_celular, ''), '\\D', '', 'g') LIKE '%' || $2 || '%'
                  AND data_consulta = $3 AND horario_inicio = $4 LIMIT 1
              `;
            const resCons = await connection.queryObject({
              text: qConsultaAntiga,
              args: [emp, celularRaw, paraISO(dataAntigaStr), horaAntigaStr]
            });

            let especialidadeReal = especialidadeAntiga;
            let formaReal = formaAntiga;
            let localReal = "";
            let nomeEspReal = "";

            if (resCons.rowCount > 0) {
              const ro: any = resCons.rows[0];
              especialidadeReal = ro.especialidade || especialidadeReal;
              formaReal = ro.forma_consulta || formaReal;
              localReal = ro.local_atendimento || "";
              nomeEspReal = ro.nome_especialista || "";

              const updateCons = `
                    UPDATE consultas 
                    SET data_consulta = $1, horario_inicio = $2, horario_fim = $3, 
                        status = 'Adiado', status_cliente = 'Remarcado'
                    WHERE id = $4
                  `;
              await connection.queryObject({
                text: updateCons,
                args: [paraISO(dataNova), hIniNovo, hFimNovo, ro.id]
              });
            } else {
              return responderJSON({ sucesso: false, erro: "Consulta original não encontrada no banco." }, 200);
            }

            // Update Multiplo nas Agendas (Preenche o Novo, Libera o Velho)
            await connection.queryObject({
              text: `UPDATE agendas SET status = 'Confirmado', forma_consulta = $5, especialidade = $6 WHERE codigoempresa = $1 AND codigo_especialista = $2 AND data_agenda = $3 AND horario_inicio = $4`,
              args: [emp, codEspAntigo, paraISO(dataNova), hIniNovo, formaAntiga, especialidadeAntiga]
            });

            await connection.queryObject({
              text: `UPDATE agendas SET status = 'Disponível' WHERE codigoempresa = $1 AND codigo_especialista = $2 AND data_agenda = $3 AND horario_inicio = $4`,
              args: [emp, codEspAntigo, paraISO(dataAntigaStr), horaAntigaStr]
            });

            const dt = new Date(Number(dataNova.split('/')[2]), Number(dataNova.split('/')[1]) - 1, Number(dataNova.split('/')[0]));
            const diaSemanaNova = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dt.getDay()];

            templateSucesso = templateSucesso
              .replace(/\[ESPECIALIDADE\]/g, especialidadeReal)
              .replace(/\[FORMA\]/g, formaReal)
              .replace(/\[LOCAL\]/g, localReal)
              .replace(/\[ESPECIALISTA\]/g, nomeEspReal)
              .replace(/\[DATA\]/g, dataNova)
              .replace(/\[DIA\]/g, diaSemanaNova)
              .replace(/\[H_INI\]/g, hIniNovo)
              .replace(/\[H_FIM\]/g, hFimNovo);

            return responderJSON({ sucesso: true, passo: 3, remarcacaoSucesso: templateSucesso });
          }

          // ==============================
          // PASSO 1: LISTAR DATAS DISPONÍVEIS (Fallback Inicial)
          // ==============================
          const qDates = `
            SELECT data_agenda, nome_especialista, forma_consulta 
            FROM agendas 
            WHERE codigoempresa = $1 AND codigo_especialista = $2 
              AND status ILIKE '%ispon%' 
              AND (data_agenda + horario_inicio::time) > NOW() + interval '4 hours'
              AND (forma_consulta ILIKE '%' || $3 || '%' OR forma_consulta ILIKE '%ou%on-line%' OR forma_consulta ILIKE '%ou%online%' OR forma_consulta IS NULL)
              AND (especialidade ILIKE '%' || $4 || '%' OR especialidade IS NULL OR trim(especialidade) = '')
            ORDER BY data_agenda ASC
          `;

          console.log("SQL ARGS (Passo 1):", [emp, codEspAntigo, formaAntiga, especialidadeAntiga]);
          const resDates = await connection.queryObject({
            text: qDates,
            args: [emp, codEspAntigo, formaAntiga, especialidadeAntiga]
          });

          const validDatesMap = new Map();
          for (let r of resDates.rows) {
            const dFormat = paraBR((r as any).data_agenda);
            if (dFormat && !validDatesMap.has(dFormat)) {
              validDatesMap.set(dFormat, {
                nome: (r as any).nome_especialista || "",
                forma: (r as any).forma_consulta || ""
              });
            }
          }

          const dataDisponivel = [];
          for (let [dataUnica, dados] of validDatesMap.entries()) {
            const [dd, mm, aaaa] = dataUnica.split('/');
            const dObj = new Date(Number(aaaa), Number(mm) - 1, Number(dd));
            const diaTexto = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dObj.getDay()];

            dataDisponivel.push({
              id: `rmc_dataVerHorarios_${codEspAntigo}_${dataUnica}`.substring(0, 200),
              title: `??? ${dataUnica} - ${diaTexto}`.substring(0, 24),
              description: `${dados.nome} - ${dados.forma}`.substring(0, 72)
            });
          }

          return responderJSON({ sucesso: true, passo: 1, dataDisponivel });
        }

        // ROTA 13 - LISTAR AGENDA (UNIFICADA)
        case 'listar_agenda': {
          const emp = String(payload.codigoempresa || "").trim();
          const email = String(payload.email || "").trim();

          if (!emp || !email) {
            return responderJSON({ sucesso: false, erro: "codigoempresa e email são obrigatórios." }, 400);
          }

          // Query 1: Consultas firmadas
          const queryConsultas = `
            SELECT * FROM consultas 
            WHERE codigoempresa = $1 AND email_especialista = $2
          `;

          // Query 2: Slots de agenda (disponíveis/vazios)
          const queryAgendas = `
            SELECT * FROM agendas 
            WHERE codigoempresa = $1 AND email_proprietario = $2
          `;

          const [resConsultas, resAgendas] = await Promise.all([
            connection.queryObject({ text: queryConsultas, args: [emp, email] }),
            connection.queryObject({ text: queryAgendas, args: [emp, email] })
          ]);

          const unificado = [...resConsultas.rows, ...resAgendas.rows];

          // Ordenação cronológica (data + hora)
          unificado.sort((a: any, b: any) => {
            const d1 = a.data_consulta || a.data_agenda || "";
            const d2 = b.data_consulta || b.data_agenda || "";
            if (d1 !== d2) return String(d1).localeCompare(String(d2));

            const h1 = a.horario_inicio || "00:00";
            const h2 = b.horario_inicio || "00:00";
            return String(h1).localeCompare(String(h2));
          });

          // Formatar para o padrão legado consumido pelo frontend
          const dadosLegado = unificado.map((r: any) => formatarParaLegado(r));

          return responderJSON({
            sucesso: true,
            data: dadosLegado
          });
        }

        // ROTA 14 - MARCAR ATENDIDO
        case 'marcarAtendido': {
          const idUnico = String(payload.idUnico || "").replace('A-', '');
          const emp = String(payload.codigoempresa || "").trim();
          if (!idUnico) return responderJSON({ sucesso: false, erro: "ID ausente" }, 400);

          await connection.queryObject({
            text: `UPDATE consultas SET status = 'Atendido', updated_at = NOW() WHERE id = $1 AND codigoempresa = $2`,
            args: [idUnico, emp]
          });
          return responderJSON({ sucesso: true });
        }

        // ROTA 15 - MARCAR CANCELADO
        case 'marcarCancelado': {
          const idUnico = String(payload.idUnico || "").replace('A-', '');
          const emp = String(payload.codigoempresa || "").trim();
          if (!idUnico) return responderJSON({ sucesso: false, erro: "ID ausente" }, 400);

          await connection.queryObject({
            text: `UPDATE consultas SET status = 'Cancelado', updated_at = NOW() WHERE id = $1 AND codigoempresa = $2`,
            args: [idUnico, emp]
          });
          return responderJSON({ sucesso: true });
        }

        // ROTA 16 - EXCLUIR LINHA
        case 'excluirLinha': {
          const idUnico = String(payload.idUnico || "").replace('A-', '');
          const emp = String(payload.codigoempresa || "").trim();
          if (!idUnico) return responderJSON({ sucesso: false, erro: "ID ausente" }, 400);

          await connection.queryObject({
            text: `DELETE FROM consultas WHERE id = $1 AND codigoempresa = $2`,
            args: [idUnico, emp]
          });
          return responderJSON({ sucesso: true });
        }

        // ROTA 17 - SALVAR ALTERAÇÃO (DASHBOARD)
        case 'salvarAlteracao': {
          const idUnico = String(payload.idUnico || "").replace('A-', '');
          const emp = String(payload.codigoempresa || "").trim();
          const d = payload.dados;
          if (!idUnico || !d) return responderJSON({ sucesso: false, erro: "Dados ausentes" }, 400);

          const updateSql = `
            UPDATE consultas SET 
              data_consulta = $1, horario_inicio = $2, horario_fim = $3, 
              status = $4, forma_consulta = $5, local_atendimento = $6,
              id_pagamento = $7, link_pagamento = $8, valor_consulta = $9,
              especialidade = $10, cliente_nome = $11, cliente_celular = $12,
              observacao_especialista = $13, observacoes_para_cliente = $14, observacao_cliente = $15,
              updated_at = NOW()
            WHERE id = $16 AND codigoempresa = $17
          `;

          await connection.queryObject({
            text: updateSql,
            args: [
              paraISO(d.data), d.h_ini, d.h_fim, d.status, d.forma, d.local,
              d.id_pag, d.link_pag, limparMonetario(d.valor), d.especialidade,
              d.cli, d.cel_cli, d.obs || "", d.obs_para_cliente || "", d.obs_cliente || "",
              idUnico, emp
            ]
          });
          return responderJSON({ sucesso: true });
        }

        // ROTA 18 - SALVAR AGENDAMENTOS EM LOTE (NOVO BLOCO)
        case 'salvarAgendamentosEmLote': {
          const emp = String(payload.codigoempresa || "").trim();
          const email = String(payload.email || "").trim();
          const blocos = payload.payload; // Array de {data, ini, fim, status}
          if (!emp || !email || !blocos) return responderJSON({ sucesso: false, erro: "Payload incompleto" }, 400);

          console.log(`[LOTE] Processando ${blocos.length} blocos para ${email} (Empresa: ${emp})`);

          // CORREÇÃO 1: Usamos SELECT * para evitar falhar se a coluna se chamar apenas 'nome' ou 'celular'
          const resEsp = await connection.queryObject({
            text: `SELECT * FROM especialistas WHERE email = $1 AND codigoempresa = $2 LIMIT 1`,
            args: [email, emp]
          });

          let nome_esp = ""; let cel_esp = ""; let spec = ""; let cod_esp = "";
          if (resEsp.rowCount > 0) {
            const e: any = resEsp.rows[0];
            nome_esp = e.nome_especialista || e.nome || "";
            cel_esp = e.celular_especialista || e.celular || "";
            spec = e.especialidade || "";
            cod_esp = e.codigo_especialista || "";
          }

          for (const b of blocos) {
            // CORREÇÃO 2: Mapeamento EXATO respeitando o CSV da tabela 'agendas'
            await connection.queryObject({
              text: `INSERT INTO agendas (
                        codigoempresa, 
                        email_proprietario, 
                        codigo_especialista, 
                        nome_especialista, 
                        celular_especialista, 
                        especialidade, 
                        data_agenda, 
                        horario_inicio, 
                        horario_fim, 
                        status, 
                        created_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
              args: [
                emp,
                email, // Vai para email_proprietario
                cod_esp,
                nome_esp,
                cel_esp,
                spec,
                paraISO(b.data),
                b.ini,
                b.fim,
                b.status
              ]
            });
          }
          return responderJSON({ sucesso: true });
        }

        // ROTA 19 - SALVAR JANELA INTERACAO
        case 'salvarJanelaInteracao': {
          const emp = String(payload.codigoempresa || "").trim();
          const email = String(payload.email || "").trim();
          const dias = parseInt(payload.dias);
          if (!emp || !email) return responderJSON({ sucesso: false, erro: "Payload incompleto" }, 400);

          await connection.queryObject({
            text: `UPDATE especialistas SET janela = $1 WHERE email = $2 AND codigoempresa = $3`,
            args: [dias, email, emp]
          });
          return responderJSON({ sucesso: true });
        }

        // ROTA 20 - LISTAR FAVORITOS
        case 'listarFavoritos': {
          const emp = String(payload.codigoempresa || "").trim();
          const email = String(payload.email || "").trim();
          if (!emp || !email) return responderJSON({ sucesso: false, erro: "Payload incompleto" }, 400);

          const res = await connection.queryObject({
            text: `SELECT modelos_json FROM especialistas WHERE email = $1 AND codigoempresa = $2 LIMIT 1`,
            args: [email, emp]
          });

          let dados = {};
          if (res.rowCount > 0 && (res.rows[0] as any).modelos_json) {
            dados = (res.rows[0] as any).modelos_json;
          }
          return responderJSON({ sucesso: true, dados });
        }

        // ROTA 21 - SALVAR FAVORITO
        case 'salvarFavorito': {
          const emp = String(payload.codigoempresa || "").trim();
          const email = String(payload.email || "").trim();
          const nome = payload.nome;
          const config = payload.config;
          if (!emp || !email || !nome || !config) return responderJSON({ sucesso: false, erro: "Payload incompleto" }, 400);

          const res = await connection.queryObject({
            text: `SELECT modelos_json FROM especialistas WHERE email = $1 AND codigoempresa = $2 LIMIT 1`,
            args: [email, emp]
          });

          let favs: any = {};
          if (res.rowCount > 0 && (res.rows[0] as any).modelos_json) {
            favs = (res.rows[0] as any).modelos_json;
          }

          favs[nome] = config;

          const stringifyFavoritos = JSON.stringify(favs);
          await connection.queryObject({
            text: `UPDATE especialistas SET modelos_json = $1 WHERE email = $2 AND codigoempresa = $3`,
            args: [stringifyFavoritos, email, emp]
          });
          return responderJSON({ sucesso: true });
        }

        // ROTA 22 - EXCLUIR FAVORITO
        case 'excluirFavorito': {
          const emp = String(payload.codigoempresa || "").trim();
          const email = String(payload.email || "").trim();
          const nome = payload.nome;
          if (!emp || !email || !nome) return responderJSON({ sucesso: false, erro: "Payload incompleto" }, 400);

          const res = await connection.queryObject({
            text: `SELECT modelos_json FROM especialistas WHERE email = $1 AND codigoempresa = $2 LIMIT 1`,
            args: [email, emp]
          });

          if (res.rowCount > 0 && (res.rows[0] as any).modelos_json) {
            let favs = (res.rows[0] as any).modelos_json;
            if (favs[nome]) {
              delete favs[nome];
              await connection.queryObject({
                text: `UPDATE especialistas SET modelos_json = $1 WHERE email = $2 AND codigoempresa = $3`,
                args: [JSON.stringify(favs), email, emp]
              });
            }
          }
          return responderJSON({ sucesso: true });
        }

        // ROTA 23 - GERAR RELATORIO CLIENTE
        case 'gerarRelatorioCliente': {
          const emp = String(payload.codigoempresa || "").trim();
          const cel = String(payload.celularCliente || "").trim();
          if (!emp || !cel) return responderJSON({ sucesso: false, erro: "Payload incompleto" }, 400);

          const query = `
            SELECT * FROM consultas 
            WHERE (status = 'Atendido' OR status = 'Arquivado')
              AND cliente_celular = $1 
              AND codigoempresa = $2
            ORDER BY data_consulta DESC
          `;

          const res = await connection.queryObject({ text: query, args: [cel, emp] });

          const dados = res.rows.map((r: any) => ({
            dataRaw: r.data_consulta,
            esp: r.especialidade || "Geral",
            prof: r.nome_especialista || "Profissional",
            obs_esp: r.observacao_especialista || "",
            obs_p_cli: r.observacoes_para_cliente || "",
            obs_cli: r.observacao_cliente || "",
            relatorio: r.relatorio_atendimento || ""
          }));

          return responderJSON({ sucesso: true, dados });
        }

        // ROTA 25 - LISTAR ESPECIALIDADES GERAL
        case 'listar_especialidades_geral': {
          const emp = String(payload.codigoempresa || "").trim();
          if (!emp) return responderJSON({ sucesso: false, erro: "codigoempresa ausente" }, 400);

          const res = await connection.queryObject({
            text: `SELECT * FROM especialidades WHERE codigo_empresa = $1 ORDER BY nome ASC`,
            args: [emp]
          });
          return responderJSON({ sucesso: true, dados: res.rows });
        }

        // ROTA 26 - SALVAR ESPECIALIDADE
        case 'salvar_especialidade': {
          const emp = String(payload.codigoempresa || "").trim();
          const nome = String(payload.nome || "").trim();
          const id = payload.id;
          if (!emp || !nome) return responderJSON({ sucesso: false, erro: "Dados incompletos" }, 400);

          if (id) {
            await connection.queryObject({
              text: `UPDATE especialidades SET nome = $1 WHERE id = $2 AND codigo_empresa = $3`,
              args: [nome, id, emp]
            });
          } else {
            await connection.queryObject({
              text: `INSERT INTO especialidades (nome, codigo_empresa) VALUES ($1, $2)`,
              args: [nome, emp]
            });
          }
          return responderJSON({ sucesso: true });
        }

        // ROTA 27 - EXCLUIR ESPECIALIDADE
        case 'excluir_especialidade': {
          const emp = String(payload.codigoempresa || "").trim();
          const id = payload.id;
          if (!emp || !id) return responderJSON({ sucesso: false, erro: "Dados incompletos" }, 400);

          await connection.queryObject({
            text: `DELETE FROM especialidades WHERE id = $1 AND codigo_empresa = $2`,
            args: [id, emp]
          });
          return responderJSON({ sucesso: true });
        }

        // ROTA 28 - LISTAR SUB-ESPECIALIDADES
        case 'listar_sub_especialidades': {
          const emp = String(payload.codigoempresa || "").trim();
          const espId = payload.especialidade_id;
          if (!emp) return responderJSON({ sucesso: false, erro: "codigoempresa ausente" }, 400);

          let filter = "WHERE codigo_empresa = $1";
          let args = [emp];
          if (espId) {
            filter += " AND especialidade_id = $2";
            args.push(espId);
          }

          const res = await connection.queryObject({
            text: `SELECT * FROM sub_especialidades ${filter} ORDER BY nome ASC`,
            args: args
          });
          return responderJSON({ sucesso: true, dados: res.rows });
        }

        // ROTA 29 - SALVAR SUB-ESPECIALIDADE
        case 'salvar_sub_especialidade': {
          const emp = String(payload.codigoempresa || "").trim();
          const nome = String(payload.nome || "").trim();
          const espId = payload.especialidade_id;
          const id = payload.id;
          if (!emp || !nome || !espId) return responderJSON({ sucesso: false, erro: "Dados incompletos" }, 400);

          if (id) {
            await connection.queryObject({
              text: `UPDATE sub_especialidades SET nome = $1, especialidade_id = $2 WHERE id = $3 AND codigo_empresa = $4`,
              args: [nome, espId, id, emp]
            });
          } else {
            await connection.queryObject({
              text: `INSERT INTO sub_especialidades (nome, especialidade_id, codigo_empresa) VALUES ($1, $2, $3)`,
              args: [nome, espId, emp]
            });
          }
          return responderJSON({ sucesso: true });
        }

        // ROTA 30 - EXCLUIR SUB-ESPECIALIDADE
        case 'excluir_sub_especialidade': {
          const emp = String(payload.codigoempresa || "").trim();
          const id = payload.id;
          if (!emp || !id) return responderJSON({ sucesso: false, erro: "Dados incompletos" }, 400);

          await connection.queryObject({
            text: `DELETE FROM sub_especialidades WHERE id = $1 AND codigo_empresa = $2`,
            args: [id, emp]
          });
          return responderJSON({ sucesso: true });
        }

        // ==========================================
        // NOVAS ROTAS PLURALIZADAS (FASE 2)
        // ==========================================

        case 'salvar_especialidades': {
          const { nome, id } = payload;
          if (!nome) return responderJSON({ sucesso: false, erro: "Nome obrigatório" }, 200);

          if (id) {
            const { error } = await supabase.from('especialidades').update({ nome }).eq('id', id);
            if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
            return responderJSON({ sucesso: true });
          } else {
            // O Trigger AFTER INSERT capturará o codigo_empresa do JWT automaticamente
            const { data, error } = await supabase.from('especialidades').insert({ nome }).select().single();
            if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
            return responderJSON({ sucesso: true, dados: data });
          }
        }

        case 'excluir_especialidades': {
          const { id } = payload;
          if (!id) return responderJSON({ sucesso: false, erro: "ID ausente" }, 200);
          const { error } = await supabase.from('especialidades').delete().eq('id', id);
          if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
          return responderJSON({ sucesso: true });
        }

        case 'salvar_sub_especialidades': {
          const { nome, especialidade_id, id } = payload;
          if (!nome || !especialidade_id) return responderJSON({ sucesso: false, erro: "Dados incompletos" }, 200);

          if (id) {
            const { error } = await supabase.from('sub_especialidades').update({ nome, especialidade_id }).eq('id', id);
            if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
            return responderJSON({ sucesso: true });
          } else {
            const { data, error } = await supabase.from('sub_especialidades').insert({ nome, especialidade_id }).select().single();
            if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
            return responderJSON({ sucesso: true, dados: data });
          }
        }

        case 'excluir_sub_especialidades': {
          const { id } = payload;
          if (!id) return responderJSON({ sucesso: false, erro: "ID ausente" }, 200);
          const { error } = await supabase.from('sub_especialidades').delete().eq('id', id);
          if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
          return responderJSON({ sucesso: true });
        }

        case 'salvar_produto': {
          const {
            id, cod_especialidade, especialidade, cod_sub_especialidade, sub_especialidade,
            nome_produto, status, forma_atendimento, valor_real, valor_prom,
            duracao_trabalho, info_do_produto, orientacao_cliente, local_atendimento,
            codigoempresa
          } = payload;

          if (!nome_produto || !cod_sub_especialidade || !codigoempresa) {
            return responderJSON({ sucesso: false, erro: "Preencha todos os campos obrigatórios." }, 200);
          }

          if (id) {
            // Edição
            const { error } = await supabase.from('produtos').update({
              nome_produto, status, forma_atendimento,
              valor_real: limparMonetario(valor_real),
              valor_prom: limparMonetario(valor_prom),
              duracao_trabalho: parseInt(duracao_trabalho) || 0,
              info_do_produto, orientacao_cliente, local_atendimento
            }).eq('id', id).eq('codigoempresa', codigoempresa);

            if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
            return responderJSON({ sucesso: true });
          } else {
            // Novo Produto - Gerar Código
            const sufixo = (forma_atendimento === 'On-Line') ? 'ON' : 'CP';

            // Buscar sequencial por sub-especialidade + forma + empresa
            const { count, error: countErr } = await supabase
              .from('produtos')
              .select('*', { count: 'exact', head: true })
              .eq('codigoempresa', codigoempresa)
              .eq('cod_sub_especialidade', cod_sub_especialidade)
              .eq('forma_atendimento', forma_atendimento);

            if (countErr) return responderJSON({ sucesso: false, erro: countErr.message }, 200);

            const sequencial = (count || 0) + 1;
            const codigo_produto = `${cod_sub_especialidade}_${sequencial}${sufixo}`;

            const { data, error } = await supabase.from('produtos').insert({
              cod_especialidade, especialidade, cod_sub_especialidade, sub_especialidade,
              codigo_produto, nome_produto, status, forma_atendimento,
              valor_real: limparMonetario(valor_real),
              valor_prom: limparMonetario(valor_prom),
              duracao_trabalho: parseInt(duracao_trabalho) || 0,
              info_do_produto, orientacao_cliente, local_atendimento,
              codigoempresa
            }).select().single();

            if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
            return responderJSON({ sucesso: true, dados: data });
          }
        }

        case 'excluir_produto': {
          const { id, codigoempresa } = payload;
          if (!id || !codigoempresa) return responderJSON({ sucesso: false, erro: "ID ou empresa ausente" }, 200);
          const { error } = await supabase.from('produtos').delete().eq('id', id).eq('codigoempresa', codigoempresa);
          if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
          return responderJSON({ sucesso: true });
        }

        case 'listar_especialidades': {
          // O RLS cuidará do filtro por codigo_empresa automaticamente via JWT
          const { data, error } = await supabase.from('especialidades').select('*').order('nome', { ascending: true });
          if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
          return responderJSON({ sucesso: true, dados: data });
        }

        case 'listar_sub_especialidades_v2': {
          const { especialidade_id } = payload;
          let query = supabase.from('sub_especialidades').select('*').order('nome', { ascending: true });
          if (especialidade_id) query = query.eq('especialidade_id', especialidade_id);

          const { data, error } = await query;
          if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
          return responderJSON({ sucesso: true, dados: data });
        }

        case 'listar_produtos': {
          const { codigoempresa } = payload;
          if (!codigoempresa) return responderJSON({ sucesso: false, erro: "codigoempresa ausente" }, 200);
          const { data, error } = await supabase.from('produtos').select('*').eq('codigoempresa', codigoempresa).order('nome_produto', { ascending: true });
          if (error) return responderJSON({ sucesso: false, erro: error.message }, 200);
          return responderJSON({ sucesso: true, dados: data });
        }


        // ROTA 31 - SALVAR ESPECIALISTA (CRIAR/ATUALIZAR + LÓGICA EPXX) — connection.queryObject para bypass RLS
        case 'salvar_especialista': {
          try {
            const { id, nome, email, celular, sub_especialidades, codigoempresa,
              admin, silenciar_notificacao, ativo, info_geral } = payload;

            if (!nome || !codigoempresa) throw new Error("Nome e codigoempresa são obrigatórios.");

            const subEspArray = Array.isArray(sub_especialidades) ? sub_especialidades : [];
            const adminBool = Boolean(admin);
            const silenciarBool = Boolean(silenciar_notificacao);
            const infGeral = info_geral || null;
            const now = new Date().toISOString();

            if (id) {
              // UPDATE — bypasses RLS via connection.queryObject
              const ativoBool = typeof ativo !== 'undefined' ? Boolean(ativo) : true;
              await connection.queryObject<any>({
                text: `UPDATE especialistas
                       SET nome = $1, email = $2, celular = $3,
                           sub_especialidades = $4,
                           admin = $5, silenciar_notificacao = $6,
                           ativo = $7, info_geral = $8,
                           updated_at = $9
                       WHERE id = $10 AND codigoempresa = $11`,
                args: [nome, email || null, celular || null,
                  JSON.stringify(subEspArray),
                  adminBool, silenciarBool,
                  ativoBool, infGeral,
                  now, id, codigoempresa]
              });
              return responderJSON({ sucesso: true, mensagem: "Especialista atualizado com sucesso." });

            } else {
              // INSERT — gera código EPXX sequencial, bypasses RLS
              const codRes = await connection.queryObject<{ codigo_especialista: string }>({
                text: `SELECT codigo_especialista FROM especialistas
                       WHERE codigoempresa = $1 AND codigo_especialista LIKE 'EP%'
                       ORDER BY codigo_especialista DESC LIMIT 1`,
                args: [codigoempresa]
              });

              let nextNum = 1;
              if (codRes.rows.length > 0) {
                const match = codRes.rows[0].codigo_especialista.match(/\d+/);
                if (match) nextNum = parseInt(match[0]) + 1;
              }
              const novoCodigo = `EP${String(nextNum).padStart(2, '0')}`;
              const ativoBool = typeof ativo !== 'undefined' ? Boolean(ativo) : true;

              const insRes = await connection.queryObject<any>({
                text: `INSERT INTO especialistas
                         (nome, email, celular, sub_especialidades, codigoempresa,
                          codigo_especialista, admin, silenciar_notificacao, ativo,
                          info_geral, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                       RETURNING *`,
                args: [nome, email || null, celular || null,
                  JSON.stringify(subEspArray), codigoempresa,
                  novoCodigo, adminBool, silenciarBool, ativoBool,
                  infGeral, now, now]
              });

              return responderJSON({ sucesso: true, mensagem: "Especialista criado com sucesso.", dados: insRes.rows[0] ?? {} });
            }
          } catch (e: any) {
            console.error("🔥 [ERRO SALVAR ESPECIALISTA]:", e.message);
            return responderJSON({ sucesso: false, erro: e.message }, 200);
          }
        }

        // ROTA 32 - EXCLUIR ESPECIALISTA (SOFT DELETE - REGRA 17) — connection.queryObject para bypass RLS
        case 'excluir_especialista': {
          try {
            const { id, codigoempresa } = payload;
            if (!id || !codigoempresa) throw new Error("ID e codigoempresa são obrigatórios.");

            await connection.queryObject<any>({
              text: `UPDATE especialistas SET ativo = false, updated_at = $1
                     WHERE id = $2 AND codigoempresa = $3`,
              args: [new Date().toISOString(), id, codigoempresa]
            });

            return responderJSON({ sucesso: true, mensagem: "Especialista removido (soft-delete) com sucesso." });
          } catch (e: any) {
            console.error("🔥 [ERRO EXCLUIR ESPECIALISTA]:", e.message);
            return responderJSON({ sucesso: false, erro: e.message }, 200);
          }
        }
        default:
          return responderJSON({ sucesso: false, erro: "Ação não reconhecida: " + acao }, 200);
      }
    } finally {
      connection.release();
    }

  } catch (err: any) {
    return responderJSON({ sucesso: false, erro: "Erro ao processar requisição: " + err.message }, 200);
  }
});
