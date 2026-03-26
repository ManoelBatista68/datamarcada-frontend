// js/ApiClient.js
const SUPABASE_URL = "https://xugyekefbinusnrmzcrj.supabase.co";
// ATENÇÃO: Substitua a string abaixo pela sua ANON_KEY PÚBLICA do Supabase.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Z3lla2VmYmludXNucm16Y3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjE3NzEsImV4cCI6MjA4OTY5Nzc3MX0.dac0acC0OkKbJ48BM4c-PKZf8N0JOb3Xh7f47lkPd-Y";

class ApiClient {
    static handleSessionExpired() {
        console.error("⛔ [SESSÃO] Expiração ou Token Inválido detectado. Limpando sessão...");
        localStorage.removeItem('saas_token_jwt');

        if (typeof fazerLogout === 'function') {
            fazerLogout();
        } else {
            window.location.reload();
        }
    }

    static async request(endpoint, options = {}) {
        // Busca o token do localStorage a cada requisição para ser sempre dinâmico
        const tokenRaw = localStorage.getItem('saas_token_jwt');

        // Camada de Sanitização
        const token = tokenRaw ? tokenRaw.trim().replace(/^"|"$/g, '') : null;

        // Detecção de Rota Pública ou Bypass Manual (Prioriza flag skipAuth)
        const isPublicRoute = (options && options.skipAuth) || endpoint.includes('/auth/v1/');

        // Camada B: Guarda de Segurança Ativa (Apenas para rotas protegidas)
        if (!isPublicRoute && (!token || token === 'undefined' || token === 'null' || token === '')) {
            this.handleSessionExpired();
            throw new Error("SESSION_EXPIRED");
        }

        // Injeção de Debug Seguro
        if (token) {
            console.log(`[DEBUG] 📡 API: ${endpoint} | Token: ${token.substring(0, 10)}...`);
        } else {
            console.log(`[DEBUG] 📡 API (Public): ${endpoint}`);
        }

        const headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'x-client-info': 'supabase-js/2.45.0'
        };

        // Injeção Condicional do Authorization (Apenas se houver token)
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        if (options && options.headers) {
            Object.assign(headers, options.headers);
        }

        const config = { ...options, headers };

        try {
            const url = `${SUPABASE_URL}${endpoint}`;
            const response = await fetch(url, config);

            if (!response.ok) {
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: 'Erro HTTP ' + response.status };
                }

                const msg = (errorData.error_description || errorData.message || errorData.error || "").toLowerCase();

                // DETECÇÃO GLOBAL DE SESSÃO EXPIRADA (Broad Scope - Apenas para rotas não públicas)
                if (!isPublicRoute && (response.status === 401 || response.status === 403 || msg.includes("jwt") || msg.includes("token") || msg.includes("expired"))) {
                    this.handleSessionExpired();
                    throw new Error("SESSION_EXPIRED");
                }

                throw new Error(errorData.error_description || errorData.message || 'Erro HTTP ' + response.status);
            }

            return await response.json();
        } catch (error) {
            if (error.message === "SESSION_EXPIRED") throw error;
            console.error(`[API ERROR] Falha na rota ${endpoint}:`, error);
            throw error;
        }
    }

    static async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    static async post(endpoint, payload, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(payload) });
    }

    static async put(endpoint, payload, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(payload) });
    }

    static async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
}
