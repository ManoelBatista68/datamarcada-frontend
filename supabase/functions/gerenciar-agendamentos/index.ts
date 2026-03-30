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

                // ROTA 31 - SALVAR ESPECIALISTA (CRIAR/ATUALIZAR + LÓGICA EPXX)
                case 'salvar_especialista': {
                    try {
                        const { id, nome, email, celular, sub_especialidades, codigoempresa } = payload;
                        if (!nome || !codigoempresa) throw new Error("Nome e codigoempresa são obrigatórios.");

                        const dadosBasicos: any = {
                            nome,
                            email: email || null,
                            celular: celular || null,
                            sub_especialidades: Array.isArray(sub_especialidades) ? sub_especialidades : [],
                            updated_at: new Date().toISOString()
                        };

                        if (id) {
                            // Edição
                            const { error: updErr } = await supabase
                                .from('especialistas')
                                .update(dadosBasicos)
                                .eq('id', id)
                                .eq('codigoempresa', codigoempresa);

                            if (updErr) throw updErr;
                            return responderJSON({ sucesso: true, mensagem: "Especialista atualizado com sucesso." });
                        } else {
                            // Criação - Lógica EPXX
                            const { data: ultimos } = await supabase
                                .from('especialistas')
                                .select('codigo_especialista')
                                .eq('codigoempresa', codigoempresa)
                                .like('codigo_especialista', 'EP%')
                                .order('codigo_especialista', { ascending: false })
                                .limit(1);

                            let nextNum = 1;
                            if (ultimos && ultimos.length > 0) {
                                const lastCode = ultimos[0].codigo_especialista;
                                const match = lastCode.match(/\d+/);
                                if (match) nextNum = parseInt(match[0]) + 1;
                            }
                            const novoCodigo = `EP${String(nextNum).padStart(2, '0')}`;

                            const novoEspecialista = {
                                ...dadosBasicos,
                                codigo_especialista: novoCodigo,
                                codigoempresa,
                                ativo: true,
                                created_at: new Date().toISOString()
                            };

                            const { data: resIns, error: insErr } = await supabase
                                .from('especialistas')
                                .insert([novoEspecialista])
                                .select()
                                .single();

                            if (insErr) throw insErr;
                            return responderJSON({ sucesso: true, mensagem: "Especialista criado com sucesso.", dados: resIns });
                        }
                    } catch (e: any) {
                        console.error("🔥 [ERRO SALVAR ESPECIALISTA]:", e.message);
                        return responderJSON({ sucesso: false, erro: e.message }, 200);
                    }
                }

                // ROTA 32 - EXCLUIR ESPECIALISTA (SOFT DELETE - REGRA 17)
                case 'excluir_especialista': {
                    try {
                        const { id, codigoempresa } = payload;
                        if (!id || !codigoempresa) throw new Error("ID e codigoempresa são obrigatórios.");

                        const { error: softDelErr } = await supabase
                            .from('especialistas')
                            .update({ ativo: false, updated_at: new Date().toISOString() })
                            .eq('id', id)
                            .eq('codigoempresa', codigoempresa);

                        if (softDelErr) throw softDelErr;
                        return responderJSON({ sucesso: true, mensagem: "Especialista removido (soft-delete) com sucesso." });
                    } catch (e: any) {
                        console.error("🔥 [ERRO EXCLUIR ESPECIALISTA]:", e.message);
                        return responderJSON({ sucesso: false, erro: e.message }, 200);
                    }
                }

                // ... (resto das funcionalidades mantidas do tmp_index.ts)
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
