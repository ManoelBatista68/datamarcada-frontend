// js/ApiClient.js
const SUPABASE_URL = "https://xugyekefbinusnrmzcrj.supabase.co";
// ATENÇÃO: Substitua a string abaixo pela sua ANON_KEY PÚBLICA do Supabase.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Z3lla2VmYmludXNucm16Y3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjE3NzEsImV4cCI6MjA4OTY5Nzc3MX0.dac0acC0OkKbJ48BM4c-PKZf8N0JOb3Xh7f47lkPd-Y";

class ApiClient {
    static async request(endpoint, options = {}) {
        // Busca o token do localStorage a cada requisição para ser sempre dinâmico
        const tokenRaw = localStorage.getItem('saas_token_jwt');

        // Camada de Sanitização: Remove aspas (JSON literal) e espaços invisíveis
        const token = tokenRaw ? tokenRaw.trim().replace(/^"|"$/g, '') : null;

        // Injeção de Debug Seguro (Apenas prefixo e comprimento)
        if (token) {
            console.log(`[DEBUG] 📡 API: ${endpoint} | Token: ${token.substring(0, 10)}... | Len: ${token.length}`);
        } else {
            console.warn(`[DEBUG] ⚠️ API: ${endpoint} | Token AUSENTE no localStorage!`);
        }

        // Camada B: Guarda de Segurança Ativa
        if (!token || token === 'undefined' || token === 'null' || token === '') {
            const errorMsg = "🛑 Interrupção Local: Tentativa de API sem Token de Sessão válido.";
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        const headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + token,
            'x-client-info': 'supabase-js/2.45.0'
        };

        if (options.headers) {
            Object.assign(headers, options.headers);
        }

        const config = { ...options, headers };

        try {
            const url = `${SUPABASE_URL}${endpoint}`;
            const response = await fetch(url, config);

            if (response.status === 401) {
                console.error("⛔ Sessão Expirada ou Acesso Negado.");
                if (typeof fazerLogout === 'function') fazerLogout();
                throw new Error("Sessão expirada. Faça login novamente.");
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error_description || errorData.message || 'Erro HTTP ' + response.status);
            }

            return await response.json();
        } catch (error) {
            console.error(`[API ERROR] Falha na rota ${endpoint}:`, error);
            throw error;
        }
    }

    static async get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
    static async post(endpoint, payload) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(payload) }); }
}
