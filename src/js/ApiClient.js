// js/ApiClient.js
const SUPABASE_URL = "https://xugyekefbinusnrmzcrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Z3lla2VmYmludXNucm16Y3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjE3NzEsImV4cCI6MjA4OTY5Nzc3MX0.dac0acC0OkKbJ48BM4c-PKZf8N0JOb3Xh7f47lkPd-Y";

class ApiClient {
    static isExpiredAlerted = false;

    // 🛡️ MODO PASSIVO: Sem localStorage.clear(), sem modal, sem loop.
    static handleSessionExpired() {
        console.error("⛔ API retornou 401, mas a autodestruição da sessão foi DESATIVADA.");
    }

    static async request(endpoint, options = {}) {
        const tokenRaw = localStorage.getItem('saas_token_jwt');

        // Sanitiza o token: remove aspas e espaços residuais
        const token = tokenRaw ? tokenRaw.trim().replace(/^"|"$/g, '') : null;

        // Detecção de Rota Pública ou Bypass Manual
        const isPublicRoute = (options && options.skipAuth) || endpoint.includes('/auth/v1/');

        // 🛑 ESCUDO DO INTERCEPTOR: Aborta se o token for lixo antes de enviar ao servidor
        const tokenInvalido = !token || token === 'undefined' || token === 'null' || token === '[object Object]' || token === '';
        if (!isPublicRoute && tokenInvalido) {
            console.warn('🔑 [Auth] Token interceptado para envio:', token);
            // Token de lixo detectado — limpa silenciosamente e redireciona
            localStorage.removeItem('saas_token_jwt');
            if (typeof window !== 'undefined') window.location.href = 'index.html';
            throw new Error("TOKEN_INVALIDO");
        }

        // Debug seguro no console
        console.warn('� [Auth] Token interceptado para envio:', token ? token.substring(0, 20) + '...' : 'PUBLIC');

        const headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'x-client-info': 'supabase-js/2.45.0'
        };

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

                // Detecta 401/403 — chama handler passivo (só loga, não faz loop)
                if (!isPublicRoute && (response.status === 401 || response.status === 403 || msg.includes("jwt") || msg.includes("token") || msg.includes("expired"))) {
                    this.handleSessionExpired();
                    throw new Error("SESSION_EXPIRED");
                }

                throw new Error(errorData.error_description || errorData.message || 'Erro HTTP ' + response.status);
            }

            const result = await response.json();

            // Interceptação de Edge Functions que retornam 200 OK com erro de auth no payload
            if (result && result.sucesso === false && result.erro) {
                const errMsg = result.erro.toLowerCase();
                if (!isPublicRoute && (errMsg.includes("jwt") || errMsg.includes("token") || errMsg.includes("expired") || errMsg.includes("sessão") || errMsg.includes("autenticação"))) {
                    this.handleSessionExpired();
                    throw new Error("SESSION_EXPIRED");
                }
            }

            return result;
        } catch (error) {
            if (error.message === "SESSION_EXPIRED" || error.message === "TOKEN_INVALIDO") throw error;
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
