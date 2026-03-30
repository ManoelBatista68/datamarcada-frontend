import json
import os

# Load the original content from the saved output
# Using the path I know has the full JSON from get_edge_function
path_to_json = r'C:\Users\Administrador\.gemini\antigravity\brain\5f223b71-8406-4554-886d-288e65b41a7f\.system_generated\steps\1558\output.txt'

if not os.path.exists(path_to_json):
    print(f"Erro! Arquivo JSON não encontrado em: {path_to_json}")
    exit(1)

with open(path_to_json, 'r', encoding='utf-8') as f:
    data = json.load(f)

original_content = data['files'][0]['content']

# New Specialist CRUD Routes
new_routes = """
        // ROTA 31 - SALVAR ESPECIALISTA (CRIAR/ATUALIZAR)
        case 'salvar_especialista': {
          try {
            const { id, nome, email, celular, sub_especialidades, codigo_especialista, codigoempresa } = payload;
            if (!nome || !codigoempresa) throw new Error("Nome e codigoempresa são obrigatórios.");

            const dadosEspecialista: any = {
              nome,
              email: email || null,
              celular: celular || null,
              sub_especialidades: Array.isArray(sub_especialidades) ? sub_especialidades : [],
              codigo_especialista: codigo_especialista || `ESP_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
              codigoempresa,
              ativo: true
            };

            if (id) {
              const { error: updErr } = await supabase.from('especialistas').update(dadosEspecialista).eq('id', id).eq('codigoempresa', codigoempresa);
              if (updErr) throw updErr;
              return responderJSON({ sucesso: true, mensagem: "Especialista atualizado com sucesso." });
            } else {
              const { data, error: insErr } = await supabase.from('especialistas').insert([dadosEspecialista]).select().single();
              if (insErr) throw insErr;
              return responderJSON({ sucesso: true, mensagem: "Especialista criado com sucesso.", dados: data });
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
              .update({ ativo: false })
              .eq('id', id)
              .eq('codigoempresa', codigoempresa);

            if (softDelErr) throw softDelErr;
            return responderJSON({ sucesso: true, mensagem: "Especialista removido (soft-delete) com sucesso." });
          } catch (e: any) {
            console.error("🔥 [ERRO EXCLUIR ESPECIALISTA]:", e.message);
            return responderJSON({ sucesso: false, erro: e.message }, 200);
          }
        }
"""

# Find the insertion point: before the default case at the end
insertion_point = original_content.rfind('default:')
if insertion_point != -1:
    new_content = original_content[:insertion_point] + new_routes + original_content[insertion_point:]
    
    # Save the new version
    with open(r'c:\Users\Administrador\DataMarcada\tmp_index.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Sucesso! Novo index.ts gerado.")
else:
    print("Erro! Não foi possível encontrar o ponto de inserção 'default:'.")
