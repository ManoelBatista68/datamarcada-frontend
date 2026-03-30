// js/ApiClient.js
const SUPABASE_URL = "https://xugyekefbinusnrmzcrj.supabase.co";
// ATENÇÃO: Substitua a string abaixo pela sua ANON_KEY PÚBLICA do Supabase.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Z3lla2VmYmludXNucm16Y3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjE3NzEsImV4cCI6MjA4OTY5Nzc3MX0.dac0acC0OkKbJ48BM4c-PKZf8N0JOb3Xh7f47lkPd-Y";

class ApiClient {
    static isExpiredAlerted = false;

    static handleSessionExpired() {
        if (this.isExpiredAlerted || (typeof document !== 'undefined' && document.getElementById('modal-sessao-expirada'))) return; // Evita spam e stacking
        this.isExpiredAlerted = true;

        console.error("⛔ [SESSÃO] Expiração ou Token Inválido detectado. Limpando sessão...");

        // Full Swipe e Higiene Severa (Expurgo radical de tokens, IDs de cache e variáveis globais)
        localStorage.clear();
        if (typeof window !== 'undefined') {
            delete window._currentNovoProdutoSubId;
        }

        if (typeof document !== 'undefined') {
            // Injeção Dinâmica do Modal SaaS Premium (Anti-Alert)
            const m = (window.top ? window.top.document : document).createElement('div');
            m.id = 'modal-sessao-expirada';
            m.className = 'tw-fixed tw-inset-0 tw-z-[9999] tw-bg-slate-900/60 tw-backdrop-blur-sm tw-flex tw-items-center tw-justify-center tw-p-4';
            m.innerHTML = `
                <div class="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-p-8 tw-max-w-sm tw-w-full tw-mx-4 tw-text-center tw-transform tw-transition-all tw-scale-100">
                    <span class="material-icons tw-text-5xl tw-bg-amber-100 tw-text-amber-600 tw-p-4 tw-rounded-full tw-inline-block tw-mb-4">lock_clock</span>
                    <h2 class="tw-text-xl tw-font-bold tw-text-slate-800">Sessão Expirada</h2>
                    <p class="tw-text-sm tw-text-slate-500 tw-mt-3 tw-leading-relaxed">
                        Para a sua segurança, desconectamos sua conta após um período de inatividade. Por favor, faça login novamente para continuar.
                    </p>
                    <button id="btn-reconnect-session" class="tw-w-full tw-mt-6 tw-bg-primary hover:tw-bg-primary/90 tw-text-white tw-font-bold tw-py-3 tw-px-4 tw-rounded-xl tw-transition-colors">
                        Fazer Login Novamente
                    </button>
                </div>
            `;

            const targetBody = (window.top ? window.top.document.body : document.body);
            targetBody.appendChild(m);

            // Vinculando Ejeção Radical de Iframe ao Clique do Usuário
            const btn = (window.top ? window.top.document : document).getElementById('btn-reconnect-session');
            if (btn) {
                btn.onclick = () => {
                    if (window.top) window.top.location.href = 'index.html';
                    else window.location.href = 'index.html';
                };
            }
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

            const result = await response.json();

            // Interceptação Global de Erro em Edge Functions retornando 200 OK com payload falso auth
            if (result && result.sucesso === false && result.erro) {
                const errMsg = result.erro.toLowerCase();
                if (!isPublicRoute && (errMsg.includes("jwt") || errMsg.includes("token") || errMsg.includes("expired") || errMsg.includes("sessão") || errMsg.includes("autenticação"))) {
                    this.handleSessionExpired();
                    throw new Error("SESSION_EXPIRED");
                }
            }

            return result;
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
