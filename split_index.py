import re
import os

# Create directory for the split files if needed (in memory/files array)
# But here we'll just write them to disk to verify

def split_fn():
    with open(r'c:\Users\Administrador\DataMarcada\tmp_index.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Extract block: Preamble and Utils (up to case switch)
    preamble_end = content.find('switch (acao) {')
    if preamble_end == -1: return "Error: switch not found"
    
    preamble = content[:preamble_end + 15] # include switch(acao) {
    
    # 2. Extract cases
    cases_block = content[preamble_end + 15 : content.rfind('default:')]
    
    # 3. Extract footer
    footer = content[content.rfind('default:'):]

    # Modularization strategy:
    # Instead of one big switch, we'll have a main switch and a delegate function for legacy routes.
    
    new_index = """import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import * as utils from "./utils.ts"
import { handleLegacyRoutes } from "./legacy_routes.ts"
import { handleSpecialistRoutes } from "./specialist_routes.ts"

const corsHeaders = utils.corsHeaders;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return utils.responderJSON({ sucesso: false, erro: "Apenas POST permitido" }, 405);

  try {
    const payload = await req.json();
    const acao = payload.acao;
    if (!acao) return utils.responderJSON({ sucesso: false, erro: "Ação ausente" }, 400);

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });

    // Tente as rotas especialistas primeiro
    const resEsp = await handleSpecialistRoutes(acao, payload, supabase);
    if (resEsp) return resEsp;

    // Se não for especialista, tente as legadas
    return await handleLegacyRoutes(acao, payload, supabase);

  } catch (err: any) {
    return utils.responderJSON({ sucesso: false, erro: "Erro fatídico: " + err.message }, 200);
  }
});
"""

    # We'll put utilities in utils.ts
    # We'll put cases 1-30 in legacy_routes.ts
    # We'll put cases 31-32 in specialist_routes.ts

    # This is a bit complex for a quick script.
    # Let's just do a simpler split: part1.ts and part2.ts and the switch delegates.

split_fn()
print("Simplificando para deploy modular...")
