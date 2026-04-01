window.onerror = function (msg, url, line) {
    console.error("Erro: " + msg + " na linha " + line);
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
};

let userEmail = "";
let tipoUsuarioAtual = "Especialista";
let userCodigoEmpresa = ""; // 🔥 VARIÁVEL GLOBAL DO CÓDIGO DA EMPRESA
let dadosGlobais = [];
let listaClientesUnicos = [];
let listaEspecialidadesUnicas = [];
let filtroSinoAtivo = null;
let debounceTimer;
let _funcaoConfirmacaoPendente = null;
let _funcaoConfirmacaoNao = null;
let clienteSelecionadoCelular = null;

const LOG_SEPARATOR = "\n---[LOG]---\n";
let logsAtuais = [];
let indiceEditando = -1;
let campoAlvo = "";
let idUnicoAberto = "";
let arquivoPendenteParaUpload = null;

let speechRec = null;
let logIndexSendoRespondido = -1;
let windowBloqueada = false;

let timerInatividade;
const TEMPO_INATIVIDADE = 60000;

window.onload = async function () {
    const salvoEmail = localStorage.getItem('appAgendaUserEmail');
    const salvoTipo = localStorage.getItem('appAgendaUserTipo');
    const salvoCodEmpresa = localStorage.getItem('appAgendaUserCodigoEmpresa');

    if (salvoEmail && salvoTipo) {
        userEmail = salvoEmail;
        tipoUsuarioAtual = salvoTipo;
        userCodigoEmpresa = salvoCodEmpresa || ""; // Recupera do storage
        await iniciarApp();
    } else {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.style.display = 'flex';
    }
};

function isClient() { return tipoUsuarioAtual === "Cliente"; }

function resetarTimerInatividade() {
    clearTimeout(timerInatividade);
    if (userEmail) {
        timerInatividade = setTimeout(function () {
            let modais = document.querySelectorAll('.modal-overlay');
            let algumModalAberto = false;
            modais.forEach(function (m) { if (m.style.display === 'flex') algumModalAberto = true; });

            if (algumModalAberto) { resetarTimerInatividade(); }
            else { carregar(); }
        }, TEMPO_INATIVIDADE);
    }
}

function iniciarRastreadorInatividade() {
    window.addEventListener('mousemove', resetarTimerInatividade);
    window.addEventListener('mousedown', resetarTimerInatividade);
    window.addEventListener('keypress', resetarTimerInatividade);
    window.addEventListener('touchstart', resetarTimerInatividade);
    window.addEventListener('scroll', resetarTimerInatividade);
    resetarTimerInatividade();
}

async function iniciarApp() {
    // Camada A: Sincronização e Validação Preventiva
    const token = localStorage.getItem('saas_token_jwt');
    if (!token || token === 'null' || token === 'undefined') {
        console.warn("⚠️ App impedida de iniciar: Token ausente no Storage.");
        fazerLogout();
        return;
    }

    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';

    const appContent = document.getElementById('app-content');
    if (appContent) appContent.style.display = 'block';

    const dispUserEmail = document.getElementById('display-user-email');
    if (dispUserEmail) dispUserEmail.textContent = "Usuário: " + userEmail + " (" + tipoUsuarioAtual + ")";

    const dispUserEmailRep = document.getElementById('display-user-email-rep');
    if (dispUserEmailRep) dispUserEmailRep.textContent = "Usuário: " + userEmail + " (" + tipoUsuarioAtual + ")";

    if (isClient()) {
        const opStatus = '<option value="">Status: Todos</option><option value="Confirmado">Confirmado</option><option value="Atendido">Atendido</option><option value="Adiado">Adiado</option>';
        if (document.getElementById('filtro-status')) document.getElementById('filtro-status').innerHTML = opStatus;
        if (document.getElementById('filtro-status-mobile')) document.getElementById('filtro-status-mobile').innerHTML = opStatus;
        if (document.getElementById('filtro-status-periodo-mobile')) document.getElementById('filtro-status-periodo-mobile').innerHTML = opStatus;
        if (document.getElementById('filtro-status-periodo')) document.getElementById('filtro-status-periodo').innerHTML = opStatus;

        if (document.getElementById('filtro-cliente')) document.getElementById('filtro-cliente').placeholder = "Busca Especialista...";
        if (document.getElementById('filtro-cliente-mobile')) document.getElementById('filtro-cliente-mobile').placeholder = "Busca Especialista...";

        document.querySelectorAll('.btn-periodo, .dash-btn-alert.outline-blue, .dash-btn-alert.action-add, .fab, .header-totals').forEach(function (el) { el.style.display = 'none'; });

        if (document.getElementById('wrapper-janela-pc')) document.getElementById('wrapper-janela-pc').style.display = 'none';
        if (document.getElementById('wrapper-janela-mobile')) document.getElementById('wrapper-janela-mobile').style.display = 'none';
    } else {
        const opStatusEsp = '<option value="">Status: Todos</option><option value="Disponível">Disponível</option><option value="Indefinido">Indefinido</option><option value="Confirmado">Confirmado</option><option value="Não confirmado">Não confirmado</option><option value="Atendido">Atendido</option><option value="Adiado">Adiado</option><option value="Cancelado">Cancelado</option><option value="Arquivado">Arquivados</option>';
        const opStatusRep = '<option value="">Status: Todos</option><option value="Confirmado">Confirmado</option><option value="Atendido">Atendido</option><option value="Cancelado">Cancelado</option><option value="Adiado">Adiado</option>';

        if (document.getElementById('filtro-status')) document.getElementById('filtro-status').innerHTML = opStatusEsp;
        if (document.getElementById('filtro-status-mobile')) document.getElementById('filtro-status-mobile').innerHTML = opStatusEsp;
        if (document.getElementById('filtro-status-periodo-mobile')) document.getElementById('filtro-status-periodo-mobile').innerHTML = opStatusRep;
        if (document.getElementById('filtro-status-periodo')) document.getElementById('filtro-status-periodo').innerHTML = opStatusRep;

        if (document.getElementById('filtro-cliente')) document.getElementById('filtro-cliente').placeholder = "Busca Cliente...";
        if (document.getElementById('filtro-cliente-mobile')) document.getElementById('filtro-cliente-mobile').placeholder = "Busca Cliente...";

        if (document.getElementById('wrapper-janela-pc')) document.getElementById('wrapper-janela-pc').style.display = 'flex';
        if (document.getElementById('wrapper-janela-mobile')) document.getElementById('wrapper-janela-mobile').style.display = 'flex';

        // [DEBUG - Auditoria Tech Lead]
        console.log("🔍 Verificando permissões de acesso...");
        console.log("👤 Usuário:", userEmail);
        console.log("🎭 Role detectada:", tipoUsuarioAtual);

        // Trava de segurança RBAC: Cadastro Geral
        console.log("🔍 Verificando permissões de acesso...");
        console.log("👤 Usuário:", userEmail);
        console.log("🎭 Role detectada:", tipoUsuarioAtual);

        const btnCadastro = document.getElementById('btn-cadastro-geral');
        if (btnCadastro) {
            const roleNormalizada = (tipoUsuarioAtual || "").toString().trim().toLowerCase();
            const eAdmin = roleNormalizada === 'admim';

            console.log("🛡️ RBAC Match ('admim'):", eAdmin);
            btnCadastro.style.display = eAdmin ? 'flex' : 'none';
        }
    }

    // Tick do Event Loop para garantir que o DOM e Storage estão estáveis
    await new Promise(resolve => setTimeout(resolve, 50));
    await carregar();
    iniciarRastreadorInatividade();
    await carregarEspecialidades();
}

async function fazerLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    if (!email || !senha) return alert("Preencha todos os campos.");

    const btnEntrar = document.getElementById('btn-entrar');
    if (btnEntrar) {
        btnEntrar.disabled = true;
        btnEntrar.textContent = "CONECTANDO...";
    }

    try {
        const res = await ApiClient.post('/auth/v1/token?grant_type=password', {
            email: email,
            password: senha
        }, { skipAuth: true });

        // 🛡️ BLINDAGEM: Caçando o token onde quer que ele esteja no JSON
        const token = res.access_token || res.data?.access_token || res.session?.access_token || res.data?.session?.access_token;
        const user = res.user || res.data?.user || res.session?.user || res.data?.session?.user;

        // 🛑 TRAVA DE LIXO: Se o token for falso ou "undefined", aborta!
        if (!token || token === "undefined" || token === "null") {
            throw new Error("Token corrompido ou não encontrado na resposta da API.");
        }

        const metadata = user.user_metadata || {};
        const codigoempresa = metadata.codigoempresa || metadata.codigoEmpresa || "";
        const tipoUsuario = metadata.tipoUsuario || "Especialista";

        // Salva os dados corretos no disco
        localStorage.setItem('appAgendaUserEmail', user.email);
        localStorage.setItem('appAgendaUserTipo', tipoUsuario);
        localStorage.setItem('appAgendaUserCodigoEmpresa', codigoempresa);
        localStorage.setItem('saas_token_jwt', token);

        // Aguarda a gravação no disco
        await new Promise((resolve) => {
            const check = () => localStorage.getItem('saas_token_jwt') ? resolve() : setTimeout(check, 10);
            check();
        });

        console.log("✅ Token perfeito salvo. Recarregando a página...");
        // Recarrega a página para iniciar o sistema limpo
        window.location.reload();

    } catch (err) {
        console.error("Erro no login:", err);
        alert("Falha de Autenticação. Verifique seu email e senha.");
        if (btnEntrar) {
            btnEntrar.disabled = false;
            btnEntrar.textContent = "ENTRAR";
        }
    }
}

function fazerLogout() {
    // Limpeza em massa de modais (Garante que nenhum overlay obstrua o login - Superando especificidade do Tailwind)
    try {
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
            m.style.setProperty('display', 'none', 'important');
        });
    } catch (err) {
        console.warn("⚠️ [UI] Falha na limpeza de modais durante o logout:", err);
    }

    if (typeof ApiClient !== 'undefined') ApiClient.isExpiredAlerted = false;

    localStorage.removeItem('appAgendaUserEmail');
    localStorage.removeItem('appAgendaUserTipo');
    localStorage.removeItem('appAgendaUserCodigoEmpresa');
    localStorage.removeItem('saas_token_jwt'); // Garante limpeza total de segurança

    userEmail = "";
    tipoUsuarioAtual = "Especialista";
    userCodigoEmpresa = "";
    dadosGlobais = [];
    clearTimeout(timerInatividade);
    alternarTela('principal');

    const appContent = document.getElementById('app-content');
    if (appContent) appContent.style.display = 'none';

    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        // Fallback: Desfaz a cegueira do Spinner Anti-FOUC se este for um LogOut tradicional (sem full reload)
        if (document.getElementById('form-login')) document.getElementById('form-login').style.display = 'block';
        if (document.getElementById('login-title-text')) document.getElementById('login-title-text').style.display = 'block';
        if (document.querySelector('.forgot-link')) document.querySelector('.forgot-link').style.display = 'inline-block';
        if (document.getElementById('login-rehydration-spinner')) document.getElementById('login-rehydration-spinner').style.display = 'none';
    }

    if (document.getElementById('login-senha')) document.getElementById('login-senha').value = '';
    if (document.getElementById('btn-entrar')) document.getElementById('btn-entrar').disabled = false;

    // Reload completo: mata a instância do ApiClient em memória e o flag isExpiredAlerted
    window.location.reload();
}

function salvarJanelaUI(val) {
    if (document.getElementById('janela-interacao-pc')) document.getElementById('janela-interacao-pc').value = val;
    if (document.getElementById('janela-interacao-mobile')) document.getElementById('janela-interacao-mobile').value = val;
    ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'salvarJanelaInteracao', email: userEmail, codigoempresa: userCodigoEmpresa, dias: val }).catch(e => console.error("Erro ao salvar janela:", e));
}

function getHojeStr() { const h = new Date(); return h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, '0') + "-" + String(h.getDate()).padStart(2, '0'); }
function formatarDataBr(d) { if (!d) return ""; const p = d.split('-'); if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0]; return d; }
function escapeHtml(text) { if (text === null || text === undefined) return ""; return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function parseDate(d, h) { if (!d) return null; const p = d.split('-'); const hrStr = h || "00:00"; const t = hrStr.split(':'); return new Date(p[0], p[1] - 1, p[2], t[0], t[1]); }

function ordenarCards(a, b) {
    const agoraSort = new Date();
    const dtA = parseDate(String(a.data).substring(0, 10), a.h_ini);
    const isVencidoA = dtA && dtA < agoraSort;
    let rankA = 9;
    if (a.status === 'Confirmado') { rankA = isVencidoA ? 2 : 1; }
    else if (a.status === 'Atendido' || a.status === 'Aconteceu') rankA = 3;
    else if (a.status === 'Cancelado' || a.status === 'Adiado') rankA = 4;
    else if (a.status === 'Arquivado') rankA = 5;
    else if (a.status === 'Não confirmado') rankA = 6;
    else if (a.status === 'Disponível') rankA = 7;
    else if (a.status === 'Indefinido') rankA = 8;

    const dtB = parseDate(String(b.data).substring(0, 10), b.h_ini);
    const isVencidoB = dtB && dtB < agoraSort;
    let rankB = 9;
    if (b.status === 'Confirmado') { rankB = isVencidoB ? 2 : 1; }
    else if (b.status === 'Atendido' || b.status === 'Aconteceu') rankB = 3;
    else if (b.status === 'Cancelado' || b.status === 'Adiado') rankB = 4;
    else if (b.status === 'Arquivado') rankB = 5;
    else if (b.status === 'Não confirmado') rankB = 6;
    else if (b.status === 'Disponível') rankB = 7;
    else if (b.status === 'Indefinido') rankB = 8;

    if (rankA !== rankB) return rankA - rankB;
    const strDataA = String(a.data).substring(0, 10);
    const strDataB = String(b.data).substring(0, 10);
    if (strDataA !== strDataB) return strDataA.localeCompare(strDataB);
    const hrA = a.h_ini || ""; const hrB = b.h_ini || ""; return hrA.localeCompare(hrB);
}

function gV(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function getValorNumerico(v) {
    if (!v) return 0;
    let s = v.toString().replace(/[R$\s]/g, "");
    if (s.includes(',')) {
        s = s.replace(/\./g, "").replace(",", ".");
    }
    return parseFloat(s) || 0;
}
function copiarLink(id) { const el = document.getElementById(id); if (el && el.value) { navigator.clipboard.writeText(el.value).then(function () { const t = document.getElementById("toast-notification"); if (t) { t.className = "toast show"; setTimeout(function () { t.className = t.className.replace("show", ""); }, 3000); } }).catch(function (err) { el.select(); document.execCommand('copy'); }); } }

function mostrarConfirmacao(titulo, mensagem, funcaoSim, funcaoNao = null) {
    if (document.getElementById('confirm-title')) document.getElementById('confirm-title').textContent = titulo;
    if (document.getElementById('confirm-msg')) document.getElementById('confirm-msg').textContent = mensagem;
    _funcaoConfirmacaoPendente = funcaoSim;
    _funcaoConfirmacaoNao = funcaoNao;

    if (document.getElementById('modal-confirmacao')) document.getElementById('modal-confirmacao').style.display = 'flex';

    const btnSim = document.getElementById('btn-confirm-yes');
    if (btnSim) {
        const novoBtn = btnSim.cloneNode(true);
        btnSim.parentNode.replaceChild(novoBtn, btnSim);
        novoBtn.onclick = function () { if (_funcaoConfirmacaoPendente) _funcaoConfirmacaoPendente(); fecharModalConfirmacao(); };
    }
}
function recusarConfirmacao() { if (_funcaoConfirmacaoNao) _funcaoConfirmacaoNao(); fecharModalConfirmacao(); }
function fecharModalConfirmacao() { if (document.getElementById('modal-confirmacao')) document.getElementById('modal-confirmacao').style.display = 'none'; _funcaoConfirmacaoPendente = null; _funcaoConfirmacaoNao = null; }
function mostrarMensagem(titulo, mensagem) {
    if (document.getElementById('msg-title')) document.getElementById('msg-title').textContent = titulo;
    if (document.getElementById('msg-content')) document.getElementById('msg-content').textContent = mensagem;
    if (document.getElementById('modal-mensagem')) document.getElementById('modal-mensagem').style.display = 'flex';
}
function fecharModalMensagem() { if (document.getElementById('modal-mensagem')) document.getElementById('modal-mensagem').style.display = 'none'; }
function formatarTextoPopup(texto) { if (!texto) return "(Vazio)"; if (String(texto).includes("---[LOG]---")) { let logs = parseLogs(texto); return logs.map(function (l) { return (l.date ? "<b>📅 " + l.date + "</b><br>" : "<b>📅 Registro antigo</b><br>") + linkify(escapeHtml(l.text)); }).join("<br><br>"); } return String(texto).replace(/\*(.*?)\*/g, "<b>$1</b>").replace(/\n/g, "<br>"); }
function abrirModalInfo(titulo, idInput) {
    const inputEl = document.getElementById(idInput);
    const valorOriginal = inputEl ? inputEl.value : "";
    if (document.getElementById('modal-info-title')) document.getElementById('modal-info-title').textContent = titulo;
    if (document.getElementById('modal-info-content')) document.getElementById('modal-info-content').innerHTML = formatarTextoPopup(valorOriginal);
    if (document.getElementById('modal-info')) document.getElementById('modal-info').style.display = 'flex';
}
function fecharModalInfo() { if (document.getElementById('modal-info')) document.getElementById('modal-info').style.display = 'none'; }

window.toggleCardEl = function (elemento) {
    const card = elemento.closest('.card');
    if (!card) return;
    card.classList.toggle('expanded');
    const icon = card.querySelector('.btn-expand-row .material-icons');
    if (icon) {
        icon.textContent = card.classList.contains('expanded') ? 'expand_less' : 'visibility';
    }
};

function abrirModalRecuperar() {
    if (document.getElementById('modal-recuperar')) document.getElementById('modal-recuperar').style.display = 'flex';
    if (document.getElementById('recup-step-1')) document.getElementById('recup-step-1').style.display = 'block';
    if (document.getElementById('recup-step-2')) document.getElementById('recup-step-2').style.display = 'none';
    if (document.getElementById('recup-email')) document.getElementById('recup-email').value = "";
}
function fecharModalRecuperar() { if (document.getElementById('modal-recuperar')) document.getElementById('modal-recuperar').style.display = 'none'; }
function voltarStep1() {
    if (document.getElementById('recup-step-1')) document.getElementById('recup-step-1').style.display = 'block';
    if (document.getElementById('recup-step-2')) document.getElementById('recup-step-2').style.display = 'none';
}
function enviarCodigo() {
    const e = document.getElementById('recup-email') ? document.getElementById('recup-email').value : "";
    if (!e) return alert("E-mail inválido");
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'enviarCodigoRecuperacao', email: e }).then(res => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        if (res.sucesso) {
            if (document.getElementById('recup-step-1')) document.getElementById('recup-step-1').style.display = 'none';
            if (document.getElementById('recup-step-2')) document.getElementById('recup-step-2').style.display = 'block';
        } else alert(res.erro || "Erro ao enviar código");
    }).catch(err => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        alert("Falha de conexão: " + err);
    });
}
function confirmarNovaSenha() {
    const e = document.getElementById('recup-email') ? document.getElementById('recup-email').value : "";
    const c = document.getElementById('recup-codigo') ? document.getElementById('recup-codigo').value : "";
    const n = document.getElementById('recup-nova-senha') ? document.getElementById('recup-nova-senha').value : "";

    if (!c) return alert("Preencha tudo");
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'redefinirSenhaComCodigo', email: e, codigo: c, novaSenha: n }).then(res => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        if (res.sucesso) { alert("Sucesso! Pode fazer login."); fecharModalRecuperar(); } else alert(res.erro || "Falha");
    }).catch(err => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        alert("Falha de conexão: " + err);
    });
}
function abrirModalTrocaSenha() {
    if (document.getElementById('modal-troca-senha')) document.getElementById('modal-troca-senha').style.display = 'flex';
    if (document.getElementById('nova-senha-logado')) document.getElementById('nova-senha-logado').value = "";
}
function fecharModalTrocaSenha() { if (document.getElementById('modal-troca-senha')) document.getElementById('modal-troca-senha').style.display = 'none'; }
function confirmarTrocaSenhaLogado() {
    const n = document.getElementById('nova-senha-logado') ? document.getElementById('nova-senha-logado').value : "";
    if (!n) return alert("Digite a senha");

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
    fecharModalTrocaSenha();

    ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'trocarSenhaUsuario', email: userEmail, novaSenha: n }).then(res => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        if (res.sucesso) alert("Sucesso!"); else alert(res.erro || "Falha");
    }).catch(err => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        alert("Falha de conexão: " + err);
    });
}

function alternarDitado() {
    const btn = document.getElementById('btn-mic-log'); const textArea = document.getElementById('modal-log-text');
    if (!btn || !textArea) return;

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { mostrarMensagem("Aviso", "Seu navegador não suporta a digitação por voz integrada. Por favor, use o ícone de microfone nativo no teclado do seu celular ou os atalhos do computador (Win + H)."); return; }
    if (speechRec && speechRec.isStarted) { speechRec.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; speechRec = new SpeechRecognition(); speechRec.lang = 'pt-BR'; speechRec.continuous = true; speechRec.interimResults = true;
    let textoInicial = textArea.value;
    speechRec.onstart = function () { speechRec.isStarted = true; btn.style.background = "#ea4335"; btn.style.color = "white"; btn.innerHTML = '<span class="material-icons" style="font-size:14px; vertical-align:middle;">mic</span> Gravando (Clique para parar)'; };
    speechRec.onresult = function (event) {
        let transcricaoParcial = ''; let transcricaoFinal = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) { transcricaoFinal += event.results[i][0].transcript; } else { transcricaoParcial += event.results[i][0].transcript; } }
        if (transcricaoFinal) { textoInicial += (textoInicial && !textoInicial.endsWith(' ') ? " " : "") + transcricaoFinal; textArea.value = textoInicial; } else { textArea.value = textoInicial + (textoInicial && !textoInicial.endsWith(' ') ? " " : "") + transcricaoParcial; }
    };
    speechRec.onerror = function (event) { console.error("Erro voz:", event.error); };
    speechRec.onend = function () { speechRec.isStarted = false; btn.style.background = "#e8f0fe"; btn.style.color = "#1a73e8"; btn.innerHTML = '<span class="material-icons" style="font-size:14px; vertical-align:middle;">mic</span> Ditar'; };
    speechRec.start();
}

function inserirEmoji(emoji) { const textarea = document.getElementById('modal-log-text'); if (!textarea) return; const start = textarea.selectionStart; const end = textarea.selectionEnd; const text = textarea.value; textarea.value = text.slice(0, start) + emoji + text.slice(end); textarea.selectionStart = textarea.selectionEnd = start + emoji.length; textarea.focus(); }

function parseLogs(raw) { if (!raw) return []; let rawStr = String(raw); let chunks = rawStr.split(LOG_SEPARATOR); let logs = []; chunks.forEach(function (chunk) { let ch = chunk.trim(); if (!ch) return; let m = ch.match(/^📅 (.*?)\n([\s\S]*)$/); if (m) { logs.push({ date: m[1].trim(), text: m[2].trim() }); } else { logs.push({ date: "", text: ch }); } }); return logs; }
function stringifyLogs(logs) { return logs.map(function (l) { return l.date ? "📅 " + l.date + "\n" + l.text : l.text; }).join(LOG_SEPARATOR); }
function formatarLogResumo(raw) { if (!raw) return ""; let logs = parseLogs(raw); if (logs.length === 0) return ""; let last = logs[logs.length - 1]; let text = (last.text || "").replace(/\n/g, " "); let prefix = logs.length > 1 ? "(" + logs.length + ") " : ""; let trunc = text.substring(0, 30) + (text.length > 30 ? "..." : ""); return prefix + trunc; }
function linkify(text) { var urlRegex = /(https?:\/\/[^\s]+)/g; return text.replace(urlRegex, function (url) { return '<a href="' + url + '" target="_blank" style="color: #1a73e8; text-decoration: underline;">' + url + '</a>'; }); }

function prepararResposta(index) {
    if (windowBloqueada && isClient()) {
        if (document.getElementById('modal-janela-fechada')) document.getElementById('modal-janela-fechada').style.display = 'flex';
        return;
    }
    logIndexSendoRespondido = index;
    let msgCompleta = logsAtuais[index].text.replace(/\n/g, " ");
    let excerpt = msgCompleta.length > 40 ? msgCompleta.substring(0, 40) + "..." : msgCompleta;

    if (document.getElementById('area-digitacao-log')) document.getElementById('area-digitacao-log').style.display = 'block';
    if (document.getElementById('label-modo-log')) document.getElementById('label-modo-log').innerHTML = '<span style="color:#e91e63;">Respondendo a:</span> "' + escapeHtml(excerpt) + '" <span style="cursor:pointer; color:#888; margin-left:5px; text-decoration:underline;" onclick="cancelarRespostaEspecifica()">[Cancelar]</span>';
    if (document.getElementById('btn-salvar-log')) document.getElementById('btn-salvar-log').textContent = "Responder / Marcar Visto";

    if (campoAlvo === 'obscli' && !isClient() && document.getElementById('chk-visto-cli')) { document.getElementById('chk-visto-cli').checked = true; }
    if (campoAlvo === 'obspcli' && isClient() && document.getElementById('chk-visto-esp')) { document.getElementById('chk-visto-esp').checked = true; }

    if (document.getElementById('modal-log-text')) document.getElementById('modal-log-text').focus();
    const modalBox = document.querySelector('#modal-log .modal-box'); if (modalBox) modalBox.scrollTop = modalBox.scrollHeight;
}

function cancelarRespostaEspecifica() {
    logIndexSendoRespondido = -1;
    if (document.getElementById('area-digitacao-log')) document.getElementById('area-digitacao-log').style.display = 'none';
    if (document.getElementById('modal-log-text')) document.getElementById('modal-log-text').value = "";
    if (document.getElementById('btn-salvar-log')) document.getElementById('btn-salvar-log').textContent = "Salvar Confirmação";
}

function checarBloqueioTexto() {
    if (windowBloqueada && isClient()) {
        if (document.getElementById('modal-janela-fechada')) document.getElementById('modal-janela-fechada').style.display = 'flex';
    }
}

function abrirModalLog(idUnico, tipoCampo, titulo) {
    idUnicoAberto = idUnico; campoAlvo = tipoCampo; logIndexSendoRespondido = -1;
    const item = dadosGlobais.find(d => d.id_unico === idUnico); if (!item) return;

    let interacaoBloqueada = false;
    if (isClient() && (item.status === 'Atendido' || item.status === 'Arquivado')) {
        if (item.janela && item.janela.trim() !== "") {
            let limiteDias = parseInt(item.janela);
            let dtObj = parseDate(String(item.data).substring(0, 10), "00:00");
            let agora = new Date(); agora.setHours(0, 0, 0, 0);
            if (dtObj) {
                let diffDias = Math.floor((agora.getTime() - dtObj.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDias > limiteDias) { interacaoBloqueada = true; }
            }
        }
    }

    windowBloqueada = interacaoBloqueada;
    if (document.getElementById('modal-log-title')) document.getElementById('modal-log-title').textContent = titulo;

    const textElement = document.getElementById(tipoCampo + '_' + idUnico);
    let rawText = textElement ? textElement.value : "";

    logsAtuais = parseLogs(rawText);
    cancelarEdicaoLog();

    let isReadOnlyLog = (!isClient() && tipoCampo === "obscli") || (isClient() && tipoCampo === "obspcli");
    renderizarListaLogs(isReadOnlyLog, interacaoBloqueada);

    const contVistoCli = document.getElementById('container-visto-cli');
    const contVistoEsp = document.getElementById('container-visto-esp');

    if (isReadOnlyLog) {
        if (!isClient()) {
            if (contVistoCli) contVistoCli.style.display = 'flex';
            if (contVistoEsp) contVistoEsp.style.display = 'none';
            const cliValEl = document.getElementById('vistocli_' + idUnico);
            if (document.getElementById('chk-visto-cli')) document.getElementById('chk-visto-cli').checked = (cliValEl && cliValEl.value === "Visto");
        } else {
            if (contVistoCli) contVistoCli.style.display = 'none';
            if (contVistoEsp) contVistoEsp.style.display = 'flex';
            const espValEl = document.getElementById('vistopcli_' + idUnico);
            if (document.getElementById('chk-visto-esp')) document.getElementById('chk-visto-esp').checked = (espValEl && espValEl.value === "Visto");
        }

        if (document.getElementById('area-digitacao-log')) document.getElementById('area-digitacao-log').style.display = 'none';
        if (document.getElementById('modal-log-text')) document.getElementById('modal-log-text').value = "";

        if (interacaoBloqueada) {
            if (document.getElementById('btn-anexo-log')) document.getElementById('btn-anexo-log').style.display = 'none';
            if (document.getElementById('btn-salvar-log')) document.getElementById('btn-salvar-log').textContent = "Marcar Visto e Fechar";
        } else {
            if (document.getElementById('btn-anexo-log')) document.getElementById('btn-anexo-log').style.display = 'inline-block';
            if (document.getElementById('btn-salvar-log')) document.getElementById('btn-salvar-log').textContent = "Salvar Confirmação";
        }
    } else {
        if (contVistoCli) contVistoCli.style.display = 'none';
        if (contVistoEsp) contVistoEsp.style.display = 'none';
        if (document.getElementById('label-modo-log')) document.getElementById('label-modo-log').textContent = "Nova entrada:";
        if (document.getElementById('area-digitacao-log')) document.getElementById('area-digitacao-log').style.display = 'block';
        if (document.getElementById('btn-anexo-log')) document.getElementById('btn-anexo-log').style.display = 'inline-block';
        if (document.getElementById('btn-salvar-log')) {
            document.getElementById('btn-salvar-log').style.display = 'inline-block';
            document.getElementById('btn-salvar-log').textContent = "Adicionar e Salvar";
        }

        if (interacaoBloqueada) {
            if (document.getElementById('modal-log-text')) {
                document.getElementById('modal-log-text').readOnly = true;
                document.getElementById('modal-log-text').placeholder = "Prazo esgotado. Use o botão 📎 Anexo para enviar arquivos.";
            }
            if (document.getElementById('emoji-bar')) document.getElementById('emoji-bar').style.display = 'none';
        } else {
            if (document.getElementById('modal-log-text')) {
                document.getElementById('modal-log-text').readOnly = false;
                document.getElementById('modal-log-text').placeholder = "Clique aqui e use o microfone do seu teclado para ditar (ou aperte Win+H no PC)...";
            }
            if (document.getElementById('emoji-bar')) document.getElementById('emoji-bar').style.display = 'flex';
        }
    }

    if (document.getElementById('modal-log')) document.getElementById('modal-log').style.display = 'flex';
}

function fecharModalLog() {
    if (document.getElementById('modal-log')) document.getElementById('modal-log').style.display = 'none';
    if (document.getElementById('modal-log-text')) document.getElementById('modal-log-text').value = "";
    idUnicoAberto = ""; campoAlvo = ""; logsAtuais = []; logIndexSendoRespondido = -1;
    if (speechRec && speechRec.isStarted) { speechRec.stop(); }
}

function renderizarListaLogs(isReadOnlyLog, interacaoBloqueada = false) {
    const container = document.getElementById('log-list-container');
    if (!container) return;

    if (logsAtuais.length === 0) {
        container.innerHTML = '<div style="font-size: 11px; color: #888; text-align: center; padding: 10px;">Nenhum registro.</div>';
        return;
    }

    let html = '';
    logsAtuais.forEach(function (log, index) {
        let dt = log.date ? "📅 " + log.date : "📅 Registro antigo";
        let iconsHtml = '';
        let responderTexto = '';

        if (!isReadOnlyLog) {
            if (!(interacaoBloqueada && isClient())) {
                iconsHtml = '<div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px;"><span class="material-icons" style="font-size: 16px; cursor: pointer; color: #fbbc04;" onclick="editarLog(' + index + ')" title="Editar">edit</span><span class="material-icons" style="font-size: 16px; cursor: pointer; color: #ea4335;" onclick="excluirLog(' + index + ')" title="Excluir">delete</span></div>';
            }
        } else if (!interacaoBloqueada) {
            iconsHtml = '<div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px;"><span class="material-icons" style="font-size: 16px; cursor: pointer; color: #1a73e8;" onclick="prepararResposta(' + index + ')" title="Responder a esta mensagem">reply</span></div>';
            responderTexto = '<div style="margin-top:8px; font-size:11px; color:#34a853; cursor:pointer; font-weight:bold; display:inline-block;" onclick="prepararResposta(' + index + ')">↪ Responder essa mensagem</div>';
        }
        html += '<div class="log-item"><div style="font-size: 10px; color: #1a73e8; font-weight: bold; margin-bottom: 4px;">' + escapeHtml(dt) + '</div><div style="font-size: 12px; color: var(--text-main); white-space: pre-wrap;">' + linkify(escapeHtml(log.text)) + '</div>' + responderTexto + iconsHtml + '</div>';
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function editarLog(index) {
    indiceEditando = index;
    if (document.getElementById('modal-log-text')) document.getElementById('modal-log-text').value = logsAtuais[index].text;
    if (document.getElementById('label-modo-log')) document.getElementById('label-modo-log').textContent = "Editando registro de: " + (logsAtuais[index].date || "Legado");

    const btnSalvar = document.getElementById('btn-salvar-log');
    if (btnSalvar) {
        btnSalvar.textContent = "Atualizar e Salvar";
        btnSalvar.style.background = "#fbbc04";
        btnSalvar.style.color = "#333";
    }

    if (document.getElementById('btn-cancelar-edit')) document.getElementById('btn-cancelar-edit').style.display = "inline-block";
    if (document.getElementById('area-digitacao-log')) document.getElementById('area-digitacao-log').style.display = 'block';
}

function cancelarEdicaoLog() {
    indiceEditando = -1;
    if (document.getElementById('modal-log-text')) document.getElementById('modal-log-text').value = "";
    if (document.getElementById('label-modo-log')) document.getElementById('label-modo-log').textContent = "Nova entrada:";

    const btnSalvar = document.getElementById('btn-salvar-log');
    if (btnSalvar) {
        btnSalvar.textContent = "Adicionar e Salvar";
        btnSalvar.style.background = "#3b82f6";
        btnSalvar.style.color = "white";
    }

    if (document.getElementById('btn-cancelar-edit')) document.getElementById('btn-cancelar-edit').style.display = "none";
}

function getAgoraStrLog() { const h = new Date(); const ano = h.getFullYear(); const mes = String(h.getMonth() + 1).padStart(2, '0'); const dia = String(h.getDate()).padStart(2, '0'); const hora = String(h.getHours()).padStart(2, '0') + ":" + String(h.getMinutes()).padStart(2, '0'); return dia + "/" + mes + "/" + ano + " às " + hora; }

function salvarEntradaLog() {
    let isReadOnlyLog = (!isClient() && campoAlvo === "obscli") || (isClient() && campoAlvo === "obspcli");

    const modalLogText = document.getElementById('modal-log-text');
    const text = modalLogText ? modalLogText.value.trim() : "";

    if (isReadOnlyLog) {
        let isCheckedCli = document.getElementById('chk-visto-cli') ? document.getElementById('chk-visto-cli').checked : false;
        let isCheckedEsp = document.getElementById('chk-visto-esp') ? document.getElementById('chk-visto-esp').checked : false;

        if (text) {
            if (campoAlvo === 'obscli' && !isClient()) {
                if (document.getElementById('chk-visto-cli')) document.getElementById('chk-visto-cli').checked = true;
                isCheckedCli = true;
            }
            if (campoAlvo === 'obspcli' && isClient()) {
                if (document.getElementById('chk-visto-esp')) document.getElementById('chk-visto-esp').checked = true;
                isCheckedEsp = true;
            }
        }

        const novoRawAtual = stringifyLogs(logsAtuais);
        if (document.getElementById(campoAlvo + '_' + idUnicoAberto)) document.getElementById(campoAlvo + '_' + idUnicoAberto).value = novoRawAtual;

        if (campoAlvo === 'obscli' && !isClient()) {
            if (document.getElementById('vistocli_' + idUnicoAberto)) document.getElementById('vistocli_' + idUnicoAberto).value = isCheckedCli ? "Visto" : "";
            const disp = document.getElementById('obscli_display_' + idUnicoAberto);
            if (disp) { if (isCheckedCli) disp.classList.remove('obs-unread'); else if (novoRawAtual) disp.classList.add('obs-unread'); }
        }

        if (campoAlvo === 'obspcli' && isClient()) {
            if (document.getElementById('vistopcli_' + idUnicoAberto)) document.getElementById('vistopcli_' + idUnicoAberto).value = isCheckedEsp ? "Visto" : "";
            const disp = document.getElementById('obspcli_display_' + idUnicoAberto);
            if (disp) { if (isCheckedEsp) disp.classList.remove('obs-unread'); else if (novoRawAtual) disp.classList.add('obs-unread'); }
        }

        if (text) {
            let campoDestino = (campoAlvo === 'obspcli') ? 'obscli' : 'obspcli';
            let vistoDestino = (campoDestino === 'obscli') ? 'vistocli' : 'vistopcli';

            const campoDestinoEl = document.getElementById(campoDestino + '_' + idUnicoAberto);
            let rawDestino = campoDestinoEl ? campoDestinoEl.value : "";
            let logsDestino = parseLogs(rawDestino);
            let textoComContexto = text;

            if (logIndexSendoRespondido >= 0) {
                let msgEspecifica = logsAtuais[logIndexSendoRespondido].text.replace(/\n/g, " ");
                if (msgEspecifica.length > 80) msgEspecifica = msgEspecifica.substring(0, 80) + "...";
                textoComContexto = "Em resposta a: \"" + msgEspecifica + "\"\n↳ " + text;
            } else {
                textoComContexto = "Em resposta: " + text;
            }

            logsDestino.push({ date: getAgoraStrLog(), text: textoComContexto });
            let novoRawDestino = stringifyLogs(logsDestino);

            if (document.getElementById(campoDestino + '_' + idUnicoAberto)) document.getElementById(campoDestino + '_' + idUnicoAberto).value = novoRawDestino;
            if (document.getElementById(vistoDestino + '_' + idUnicoAberto)) document.getElementById(vistoDestino + '_' + idUnicoAberto).value = "";

            const elDisplay = document.getElementById(campoDestino + '_display_' + idUnicoAberto);
            if (elDisplay) {
                elDisplay.textContent = formatarLogResumo(novoRawDestino) || "Clique para visualizar...";
                elDisplay.classList.remove('obs-placeholder');
            }
        }
        salvar(idUnicoAberto);
        fecharModalLog();
        return;
    }

    if (!text && !windowBloqueada) { mostrarMensagem("Atenção", "Digite um texto antes de salvar."); return; }
    if (!text && windowBloqueada) { fecharModalLog(); return; }

    if (indiceEditando >= 0) {
        logsAtuais[indiceEditando].text = text;
        cancelarEdicaoLog();
    } else {
        logsAtuais.push({ date: getAgoraStrLog(), text: text });
        if (document.getElementById('modal-log-text')) document.getElementById('modal-log-text').value = "";
    }

    renderizarListaLogs(false, windowBloqueada);
    aplicarMudancasLog();
    if (speechRec && speechRec.isStarted) { speechRec.stop(); }
}

function excluirLog(index) {
    mostrarConfirmacao("Excluir Registro", "Deseja apagar esta entrada?", function () {
        logsAtuais.splice(index, 1);
        if (indiceEditando === index) { cancelarEdicaoLog(); } else if (indiceEditando > index) { indiceEditando--; }
        renderizarListaLogs(false, windowBloqueada);
        aplicarMudancasLog();
    });
}

function aplicarMudancasLog() {
    const novoRaw = stringifyLogs(logsAtuais);
    if (document.getElementById(campoAlvo + '_' + idUnicoAberto)) document.getElementById(campoAlvo + '_' + idUnicoAberto).value = novoRaw;

    if (campoAlvo === 'obscli' && !isClient()) {
        const isChecked = document.getElementById('chk-visto-cli') ? document.getElementById('chk-visto-cli').checked : false;
        if (document.getElementById('vistocli_' + idUnicoAberto)) document.getElementById('vistocli_' + idUnicoAberto).value = isChecked ? "Visto" : "";
    }
    if (campoAlvo === 'obspcli' && isClient()) {
        const isChecked = document.getElementById('chk-visto-esp') ? document.getElementById('chk-visto-esp').checked : false;
        if (document.getElementById('vistopcli_' + idUnicoAberto)) document.getElementById('vistopcli_' + idUnicoAberto).value = isChecked ? "Visto" : "";
    }

    const elDisplay = document.getElementById(campoAlvo + '_display_' + idUnicoAberto);
    if (elDisplay) {
        elDisplay.textContent = formatarLogResumo(novoRaw) || (isClient() ? "Clique para visualizar..." : "Clique para adicionar...");
        if (!novoRaw) { elDisplay.classList.add('obs-placeholder'); } else { elDisplay.classList.remove('obs-placeholder'); }

        if (campoAlvo === 'obscli' && !isClient()) {
            const vistoval = document.getElementById('vistocli_' + idUnicoAberto) ? document.getElementById('vistocli_' + idUnicoAberto).value : "";
            if (novoRaw && vistoval !== "Visto") { elDisplay.classList.add('obs-unread'); } else { elDisplay.classList.remove('obs-unread'); }
        }
        if (campoAlvo === 'obspcli' && isClient()) {
            const vistoval = document.getElementById('vistopcli_' + idUnicoAberto) ? document.getElementById('vistopcli_' + idUnicoAberto).value : "";
            if (novoRaw && vistoval !== "Visto") { elDisplay.classList.add('obs-unread'); } else { elDisplay.classList.remove('obs-unread'); }
        }
    }
    salvar(idUnicoAberto);
}

function processarArquivo(event) {
    const file = event.target.files[0];
    if (!file) return;
    arquivoPendenteParaUpload = file;
    if (document.getElementById('upload-desc-input')) document.getElementById('upload-desc-input').value = "";
    if (document.getElementById('modal-upload-desc')) document.getElementById('modal-upload-desc').style.display = 'flex';
}

function fecharModalUploadDesc() {
    if (document.getElementById('modal-upload-desc')) document.getElementById('modal-upload-desc').style.display = 'none';
    arquivoPendenteParaUpload = null;
    if (document.getElementById('file-upload')) document.getElementById('file-upload').value = '';
}

function confirmarUploadDesc() {
    const descInput = document.getElementById('upload-desc-input');
    const desc = descInput ? descInput.value.trim() : "";

    if (!desc) { alert("Por favor, informe a descrição do arquivo."); return; }
    const fileToUpload = arquivoPendenteParaUpload;

    if (document.getElementById('modal-upload-desc')) document.getElementById('modal-upload-desc').style.display = 'none';
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result; const fileName = fileToUpload.name; const mimeType = fileToUpload.type;
        // Nota: O upload para Drive requer integração OAuth2 no serverless. 
        // Por agora, informamos sobre a necessidade de migração para Supabase Storage.
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        if (document.getElementById('file-upload')) document.getElementById('file-upload').value = '';
        arquivoPendenteParaUpload = null;
        mostrarMensagem("Aviso de Migração", "O sistema de anexos via Google Drive está desativado nesta versão. Utilize o Supabase Storage ou envie o link manualmente.");
    };
    reader.readAsDataURL(fileToUpload);
}

function abrirModalLocal(idUnico) {
    const el = document.getElementById('loc_' + idUnico);
    if (el) {
        if (document.getElementById('input-edit-local')) document.getElementById('input-edit-local').value = el.value;
        if (document.getElementById('id-edit-local-hidden')) document.getElementById('id-edit-local-hidden').value = idUnico;
        if (document.getElementById('modal-edit-local')) document.getElementById('modal-edit-local').style.display = 'flex';
    }
}
function fecharModalLocal() { if (document.getElementById('modal-edit-local')) document.getElementById('modal-edit-local').style.display = 'none'; }
function salvarLocalUnicoFrontend() {
    const idUnico = document.getElementById('id-edit-local-hidden') ? document.getElementById('id-edit-local-hidden').value : "";
    const novoValor = document.getElementById('input-edit-local') ? document.getElementById('input-edit-local').value : "";

    if (document.getElementById('modal-edit-local')) document.getElementById('modal-edit-local').style.display = 'none';
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    ApiClient.post('/functions/v1/gerenciar-agendamentos', {
        acao: 'atualizarLocalIsolado',
        idUnico: idUnico,
        novoLocal: novoValor,
        codigoempresa: userCodigoEmpresa
    }).then(res => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        if (res.sucesso) {
            const el = document.getElementById('loc_' + idUnico);
            if (el) el.value = novoValor;
            mostrarMensagem("Sucesso", "Local/Link atualizado com sucesso!");
        } else {
            mostrarMensagem("Erro", "Erro ao salvar: " + (res.erro || "Falha desconhecida"));
        }
    }).catch(err => {
        if (err.message === "SESSION_EXPIRED") return;
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        mostrarMensagem("Erro", "Falha de conexão: " + err);
    });
}

function abrirRelatorio() {
    let chkPc = document.getElementById('chk-relatorio-pc');
    let chkMob = document.getElementById('chk-relatorio-mobile');
    if ((chkPc && !chkPc.checked) && (chkMob && !chkMob.checked)) return;
    if (!clienteSelecionadoCelular) { mostrarMensagem("Atenção", "Selecione um cliente válido da lista."); fecharRelatorio(); return; }
    fecharMenuSeMobile('menu-principal');
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    ApiClient.post('/functions/v1/gerenciar-agendamentos', {
        acao: 'gerarRelatorioCliente',
        celularCliente: clienteSelecionadoCelular,
        codigoempresa: userCodigoEmpresa
    }).then(res => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        if (res.sucesso) { renderizarHTMLRelatorio(res.dados); }
        else { mostrarMensagem("Erro", "Erro ao buscar relatório: " + (res.erro || "Falha")); fecharRelatorio(); }
    }).catch(err => {
        if (err.message === "SESSION_EXPIRED") return;
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        mostrarMensagem("Erro", "Falha de conexão: " + err); fecharRelatorio();
    });
}

function renderizarHTMLRelatorio(dados) {
    const container = document.getElementById('relatorio-content');
    if (!container) return;

    if (!dados || dados.length === 0) {
        container.innerHTML = "<div>Nenhum atendimento finalizado encontrado para este cliente.</div>";
    } else {
        let emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        let html = "";
        dados.forEach(function (item, index) {
            let numIcon = index < 10 ? emojis[index] : (index + 1) + "️⃣";
            let dStr = formatarDataBr(item.dataRaw);
            html += '<div style="margin-bottom: 25px; border-bottom: 1px solid var(--border-light); padding-bottom: 15px;">';
            html += '<b>' + numIcon + ' Especialidade:</b> ' + escapeHtml(item.esp) + '<br><b>Data:</b> ' + dStr + '<br><b>Profissional:</b> ' + escapeHtml(item.prof) + '<br><br>';
            html += '<b style="color:#1a73e8;">1- CONSIDERAÇÕES DO ESPECIALISTA</b><br>' + formatarLogsRelatorio(item.obs_esp) + '<br><br>';
            html += '<b style="color:#1a73e8;">2- INFORMAÇÕES PARA O CLIENTE</b><br>' + formatarLogsRelatorio(item.obs_p_cli) + '<br><br>';
            html += '<b style="color:#1a73e8;">3- INFORMAÇÕES DO PRÉ-ATENDIMENTO</b><br>' + (item.relatorio ? escapeHtml(item.relatorio).replace(/\n/g, '<br>') : "Sem registro.") + '<br><br>';
            html += '<b style="color:#1a73e8;">4- INFORMAÇÕES DO CLIENTE</b><br>' + formatarLogsRelatorio(item.obs_cli) + '<br></div>';
        });
        container.innerHTML = html;
    }
    if (document.getElementById('modal-relatorio-cliente')) document.getElementById('modal-relatorio-cliente').style.display = 'flex';
}

function fecharRelatorio() {
    if (document.getElementById('modal-relatorio-cliente')) document.getElementById('modal-relatorio-cliente').style.display = 'none';
    let chkPc = document.getElementById('chk-relatorio-pc');
    let chkMob = document.getElementById('chk-relatorio-mobile');
    if (chkPc) chkPc.checked = false;
    if (chkMob) chkMob.checked = false;
}

function carregarListaFavoritos() {
    if (!userEmail) return;
    ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'listarFavoritos', email: userEmail, codigoempresa: userCodigoEmpresa }).then(res => {
        const sel = document.getElementById('sel-favoritos');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Selecione para preencher --</option>';
        if (res.sucesso && res.dados) {
            const favs = res.dados; window.meusFavoritos = favs;
            for (const nome in favs) {
                const opt = document.createElement('option'); opt.value = nome; opt.textContent = nome; sel.appendChild(opt);
            }
        }
    }).catch(e => { if (e.message !== "SESSION_EXPIRED") console.error("Erro favoritos:", e); });
}

function salvarFavoritoUI() {
    const nome = document.getElementById('nome-novo-fav') ? document.getElementById('nome-novo-fav').value : "";
    if (!nome) return mostrarMensagem("Atenção", "Digite um nome para o modelo.");

    const diasBlocks = document.querySelectorAll('.day-block'); let configModelo = {};
    diasBlocks.forEach(function (block) {
        const chk = block.querySelector('.day-header input');
        if (!chk || !chk.checked) return;
        const dataIso = block.dataset.isoDate; const p = dataIso.split('-'); const d = new Date(p[0], p[1] - 1, p[2]); const diaSemana = d.getDay();
        const rows = block.querySelectorAll('.time-row'); let horarios = [];
        rows.forEach(function (row) {
            const ini = row.querySelector('.t-ini').value; const fim = row.querySelector('.t-fim').value;
            if (ini && fim) horarios.push({ ini: ini, fim: fim });
        });
        if (horarios.length > 0) { configModelo[diaSemana] = horarios; }
    });

    if (Object.keys(configModelo).length === 0) return mostrarMensagem("Atenção", "Configure os dias e horários.");
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    ApiClient.post('/functions/v1/gerenciar-agendamentos', {
        acao: 'salvarFavorito',
        email: userEmail,
        nome: nome,
        config: configModelo,
        codigoempresa: userCodigoEmpresa
    }).then(res => {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        if (res.sucesso) {
            mostrarMensagem("Sucesso", "Modelo salvo com sucesso!");
            if (document.getElementById('nome-novo-fav')) document.getElementById('nome-novo-fav').value = "";
            carregarListaFavoritos();
        } else { mostrarMensagem("Erro", "Erro ao salvar: " + (res.erro || "Falha")); }
    }).catch(err => {
        if (err.message === "SESSION_EXPIRED") return;
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        mostrarMensagem("Erro", "Falha de conexão: " + err);
    });
}

function aplicarFavoritoUI() {
    const selObj = document.getElementById('sel-favoritos');
    const nome = selObj ? selObj.value : "";
    if (!nome || !window.meusFavoritos || !window.meusFavoritos[nome]) return;

    const modelo = window.meusFavoritos[nome]; const diasBlocks = document.querySelectorAll('.day-block');
    diasBlocks.forEach(function (block) {
        const dataIso = block.dataset.isoDate; const p = dataIso.split('-'); const d = new Date(p[0], p[1] - 1, p[2]); const diaSemana = d.getDay();
        const chk = block.querySelector('.day-header input'); const timesContainer = block.querySelector('.times-container');
        if (!chk || chk.disabled) return;

        if (modelo[diaSemana]) {
            chk.checked = true; toggleTimeBlock(chk); timesContainer.innerHTML = '';
            modelo[diaSemana].forEach(function (h) {
                const div = document.createElement('div'); div.className = 'time-row';
                div.innerHTML = '<input type="time" class="t-ini" value="' + h.ini + '"> às <input type="time" class="t-fim" value="' + h.fim + '"> <span style="color:red;cursor:pointer;margin-left:5px;" onclick="this.parentElement.remove()">x</span>';
                timesContainer.appendChild(div);
            });
        } else { chk.checked = false; toggleTimeBlock(chk); }
    });
}

function excluirFavoritoUI() {
    const selObj = document.getElementById('sel-favoritos');
    const nome = selObj ? selObj.value : "";
    if (!nome) return mostrarMensagem("Atenção", "Selecione um modelo para excluir.");

    mostrarConfirmacao("Excluir Modelo", "Deseja excluir o modelo '" + nome + "'?", function () {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
        ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'excluirFavorito', email: userEmail, nome: nome, codigoempresa: userCodigoEmpresa }).then(res => {
            if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
            carregarListaFavoritos(); mostrarMensagem("Sucesso", "Modelo excluído.");
        }).catch(err => {
            if (err.message === "SESSION_EXPIRED") return;
            if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
            mostrarMensagem("Erro", "Falha ao excluir: " + err);
        });
    });
}

function abrirModalNovoBloco() {
    const sel = document.getElementById('sel-mes-bloco');
    if (!sel) return;
    sel.innerHTML = '';
    const hoje = new Date();
    for (let i = 0; i < 6; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const opt = document.createElement('option');
        opt.value = d.toISOString().substring(0, 7);
        opt.textContent = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        sel.appendChild(opt);
    }
    renderizarSemanas(); carregarListaFavoritos();
    if (document.getElementById('modal-novo-bloco')) document.getElementById('modal-novo-bloco').style.display = 'flex';
}

function fecharModalNovoBloco() { if (document.getElementById('modal-novo-bloco')) document.getElementById('modal-novo-bloco').style.display = 'none'; }

function renderizarSemanas() {
    const selObj = document.getElementById('sel-mes-bloco');
    const val = selObj ? selObj.value : "";
    if (!val) return;

    const p = val.split('-'); const ano = p[0]; const mes = p[1];
    const container = document.getElementById('container-semanas');
    if (!container) return;
    container.innerHTML = '';

    if (document.getElementById('container-status-bloco')) document.getElementById('container-status-bloco').style.display = 'none';
    if (document.getElementById('container-favoritos-bloco')) document.getElementById('container-favoritos-bloco').style.display = 'none';
    if (document.getElementById('container-dias-wrapper')) document.getElementById('container-dias-wrapper').style.display = 'none';

    const limite = new Date(); limite.setHours(limite.getHours() + 24);
    const ultimoDia = new Date(ano, parseInt(mes), 0).getDate(); let semanas = {};

    for (let d = 1; d <= ultimoDia; d++) {
        const dataAtual = new Date(ano, parseInt(mes) - 1, d, 23, 59, 59);
        const numSemana = getWeekOfMonth(dataAtual);
        if (!semanas[numSemana]) semanas[numSemana] = [];
        semanas[numSemana].push(d);
    }

    if (Object.keys(semanas).length === 0) { container.innerHTML = '<div style="font-size:12px;color:#888;">Nenhuma data disponível neste mês.</div>'; return; }

    for (const sem in semanas) {
        const dias = semanas[sem]; const div = document.createElement('div'); div.className = 'week-checkbox-row';
        const idCheck = 'check-sem-' + sem; const labelStr = 'Semana ' + sem + ' (' + dias[0] + '/' + mes + ' a ' + dias[dias.length - 1] + '/' + mes + ')';
        div.innerHTML = '<input type="checkbox" id="' + idCheck + '" onchange="renderizarDiasSelecionados()"> <label for="' + idCheck + '">' + labelStr + '</label>';
        div.dataset.dias = JSON.stringify(dias); div.dataset.ano = ano; div.dataset.mes = mes;
        container.appendChild(div);
    }
}

function getWeekOfMonth(date) { const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay(); return Math.ceil((date.getDate() + firstDay) / 7); }

function renderizarDiasSelecionados() {
    const containerDias = document.getElementById('container-dias');
    const statusContainer = document.getElementById('container-status-bloco');
    const favContainer = document.getElementById('container-favoritos-bloco');
    const wrapper = document.getElementById('container-dias-wrapper');

    if (containerDias) containerDias.innerHTML = '';
    const checks = document.querySelectorAll('#container-semanas input[type="checkbox"]:checked');

    if (checks.length === 0) {
        if (statusContainer) statusContainer.style.display = 'none';
        if (favContainer) favContainer.style.display = 'none';
        if (wrapper) wrapper.style.display = 'none';
        return;
    } else {
        if (statusContainer) statusContainer.style.display = 'block';
        if (favContainer) favContainer.style.display = 'block';
        if (wrapper) wrapper.style.display = 'block';
    }

    const limite = new Date(); limite.setHours(limite.getHours() + 24);
    checks.forEach(function (chk) {
        const divPai = chk.parentElement; const dias = JSON.parse(divPai.dataset.dias); const ano = divPai.dataset.ano; const mes = divPai.dataset.mes;
        dias.forEach(function (dia) {
            const idDia = 'dia-' + ano + '-' + mes + '-' + dia;
            if (document.getElementById(idDia)) return;

            const block = document.createElement('div'); block.className = 'day-block'; block.id = idDia;
            const dateObj = new Date(ano, parseInt(mes) - 1, dia); const dataFinalDia = new Date(ano, parseInt(mes) - 1, dia, 23, 59, 59);
            const diaSemana = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }); const diaSemanaIndex = dateObj.getDay();
            const isWeekend = (diaSemanaIndex === 0 || diaSemanaIndex === 6); const isPast = (dataFinalDia < limite);
            const isChecked = (!isWeekend && !isPast) ? 'checked' : ''; const disableChk = isPast ? 'disabled' : '';
            const diaFmt = dia + '/' + mes + ' (' + diaSemana + ')'; const avisoPassado = isPast ? ' <span style="font-size:10px; color:#ea4335;">(Indisponível - Regra 24h)</span>' : '';
            const opacity = (!isWeekend && !isPast) ? 1 : 0.5; const pointerEvents = (!isWeekend && !isPast) ? 'auto' : 'none'; const displayBtn = (!isWeekend && !isPast) ? 'inline-block' : 'none';

            block.innerHTML = '<div class="day-header"><label><input type="checkbox" ' + isChecked + ' ' + disableChk + ' onchange="toggleTimeBlock(this)"> ' + diaFmt + avisoPassado + '</label></div><div class="times-container" style="opacity:' + opacity + '; pointer-events:' + pointerEvents + '"><div class="time-row"><input type="time" class="t-ini" value="08:00"> às <input type="time" class="t-fim" value="09:00"></div></div><button class="btn-add-time" onclick="addTimeRow(this)" style="display:' + displayBtn + '">+ Horário</button>';
            block.dataset.isoDate = ano + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
            if (containerDias) containerDias.appendChild(block);
        });
    });
    aplicarFavoritoUI();
}

function toggleTimeBlock(chk) {
    const container = chk.closest('.day-block').querySelector('.times-container');
    const btn = chk.closest('.day-block').querySelector('.btn-add-time');
    if (chk.checked) {
        if (container) { container.style.opacity = '1'; container.style.pointerEvents = 'auto'; }
        if (btn) btn.style.display = 'inline-block';
    } else {
        if (container) { container.style.opacity = '0.5'; container.style.pointerEvents = 'none'; }
        if (btn) btn.style.display = 'none';
    }
}

function addTimeRow(btn) {
    const container = btn.previousElementSibling;
    const div = document.createElement('div'); div.className = 'time-row';
    div.innerHTML = '<input type="time" class="t-ini" value="09:00"> às <input type="time" class="t-fim" value="10:00"> <span style="color:red;cursor:pointer;margin-left:5px;" onclick="this.parentElement.remove()">x</span>';
    if (container) container.appendChild(div);
}

// 🔥 SALVA O BLOCO DE AGENDAMENTOS 🔥
function salvarBloco() {
    const diasBlocks = document.querySelectorAll('.day-block'); let payload = [];
    const statusObj = document.getElementById('novo-status-bloco');
    const statusEscolhido = statusObj ? statusObj.value : "Indefinido";

    document.querySelectorAll('.error-overlap').forEach(function (el) { el.classList.remove('error-overlap'); });
    let temConflito = false; let horarioInvalido = false;

    diasBlocks.forEach(function (block) {
        const chk = block.querySelector('.day-header input'); if (!chk || !chk.checked) return;
        const dataIso = block.dataset.isoDate; const rows = block.querySelectorAll('.time-row');
        rows.forEach(function (row) {
            const iniInput = row.querySelector('.t-ini'); const fimInput = row.querySelector('.t-fim');
            if (!iniInput || !fimInput) return;
            const ini = iniInput.value; const fim = fimInput.value;
            if (ini && fim) {
                if (fim <= ini) { horarioInvalido = true; iniInput.classList.add('error-overlap'); fimInput.classList.add('error-overlap'); return; }
                let conflitoEncontrado = false;
                for (let i = 0; i < payload.length; i++) {
                    let p = payload[i];
                    if (p.data === dataIso) { if (ini < p.fim && fim > p.ini) { conflitoEncontrado = true; break; } }
                }
                if (conflitoEncontrado) { temConflito = true; iniInput.classList.add('error-overlap'); fimInput.classList.add('error-overlap'); }
                else { payload.push({ data: dataIso, ini: ini, fim: fim, status: statusEscolhido }); }
            }
        });
    });

    if (horarioInvalido) { mostrarMensagem("Atenção", "O horário final deve ser maior que o horário inicial. Corrija as marcações em vermelho."); return; }
    if (temConflito) { if (document.getElementById('modal-erro-conflito')) document.getElementById('modal-erro-conflito').style.display = 'flex'; return; }
    if (payload.length === 0) return mostrarMensagem("Atenção", "Nenhum horário selecionado.");

    mostrarConfirmacao("Criar Agendas", "Confirmar criação de " + payload.length + " agendamentos como '" + statusEscolhido + "'?", async function () {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
        fecharModalNovoBloco();

        try {
            const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
                acao: 'salvarAgendamentosEmLote',
                email: userEmail,
                codigoempresa: userCodigoEmpresa,
                payload: payload
            });

            if (res.conflict) {
                if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
                if (document.getElementById('modal-erro-conflito')) document.getElementById('modal-erro-conflito').style.display = 'flex';
            } else if (res.sucesso) {
                mostrarMensagem("Sucesso", "Agendamentos criados com sucesso!");
                await carregar();
            } else {
                if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
                mostrarMensagem("Erro", "Falha: " + res.erro);
            }
        } catch (err) {
            mostrarMensagem("Erro", "Erro: " + err);
            if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        }
    });
}

function acaoMarcarAtendido(idUnico, element) {
    mostrarConfirmacao("Confirmar Atendimento", "Marcar este agendamento como ATENDIDO?", async function () {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
        try {
            await ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'marcarAtendido', idUnico, codigoempresa: userCodigoEmpresa });
            await carregar();
        } catch (e) {
            if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
            mostrarMensagem("Erro", "Falha ao marcar: " + e);
        }
    }, function () { if (element) element.checked = !element.checked; });
}

function acaoMarcarCancelado(idUnico, element) {
    mostrarConfirmacao("Cancelar Agendamento", "Deseja realmente cancelar?", async function () {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
        try {
            await ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'marcarCancelado', idUnico, codigoempresa: userCodigoEmpresa });
            await carregar();
        } catch (e) {
            if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
            mostrarMensagem("Erro", "Falha ao cancelar: " + e);
        }
    }, function () { if (element) element.checked = !element.checked; });
}

function alternarArquivamento(idUnico, element) {
    if (element.checked) {
        mostrarConfirmacao("Arquivar", "Deseja mover este agendamento para os Arquivados?", function () { const elStatus = document.getElementById('status_' + idUnico); if (elStatus) elStatus.value = "Arquivado"; salvar(idUnico); }, function () { element.checked = false; });
    } else {
        mostrarConfirmacao("Desarquivar", "Deseja retornar este agendamento para Atendido?", function () { const elStatus = document.getElementById('status_' + idUnico); if (elStatus) elStatus.value = "Atendido"; salvar(idUnico); }, function () { element.checked = true; });
    }
}

function salvar(idUnico) {
    const dataCard = gV('data_' + idUnico); const iniCard = gV('ini_' + idUnico); const fimCard = gV('fim_' + idUnico); const statusCard = gV('status_' + idUnico);
    if (iniCard && fimCard && iniCard >= fimCard) { mostrarMensagem("Atenção", "O horário final deve ser maior que o horário inicial."); return; }
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    setTimeout(async function () {
        const d = {
            ativ: gV('ativ_' + idUnico), ult_ev: gV('ultev_' + idUnico), forma: gV('forma_' + idUnico), esp: gV('esp_' + idUnico), celesp: gV('celesp_' + idUnico), prop: userEmail,
            data: dataCard, h_ini: iniCard, h_fim: fimCard, especialidade: gV('spec_' + idUnico), cli: gV('cli_' + idUnico), cel_cli: gV('celcli_' + idUnico),
            status: statusCard, local: gV('loc_' + idUnico), id_pag: gV('idpag_' + idUnico), link_pag: gV('linkpag_' + idUnico), valor: gV('valor_' + idUnico), status_conf: gV('stconf_' + idUnico),
            obs: gV('obs_' + idUnico), obs_para_cliente: gV('obspcli_' + idUnico), obs_cliente: gV('obscli_' + idUnico), visto_cli: gV('vistocli_' + idUnico), visto_p_cli: gV('vistopcli_' + idUnico)
        };

        try {
            const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
                acao: 'salvarAlteracao',
                idUnico: idUnico,
                dados: d,
                codigoempresa: userCodigoEmpresa
            });
            if (res.conflict) { if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none'; if (document.getElementById('modal-erro-conflito')) document.getElementById('modal-erro-conflito').style.display = 'flex'; }
            else if (res.sucesso) { mostrarMensagem("Sucesso", "Agendamento salvo!"); await carregar(); }
            else { if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none'; mostrarMensagem("Erro", "Falha ao salvar: " + res.erro); }
        } catch (err) {
            if (err.message === "SESSION_EXPIRED") return;
            if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
            mostrarMensagem("Erro", "Falha ao salvar: " + err);
        }
    }, 100);
}

function excluir(idUnico) {
    mostrarConfirmacao("Excluir", "Deseja apagar este agendamento?", async function () {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
        try {
            await ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'excluirLinha', idUnico, codigoempresa: userCodigoEmpresa });
            await carregar();
        } catch (err) {
            if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
            mostrarMensagem("Erro", "Erro ao excluir: " + err);
        }
    });
}

function renderizar(dados, containerAlvo) {
    if (!dados || dados.length === 0) return; let html = ''; const agora = new Date(); const hojeStr = getHojeStr();
    const amanhaObj = new Date(); amanhaObj.setDate(amanhaObj.getDate() + 1);
    const amanhaStr = amanhaObj.getFullYear() + "-" + String(amanhaObj.getMonth() + 1).padStart(2, '0') + "-" + String(amanhaObj.getDate()).padStart(2, '0');

    try {
        dados.forEach(function (item) {
            let rowCls = "status-indefinido"; let badgeCls = "badge-padrao"; let isExpired = false;
            const itemDataISO = String(item.data).substring(0, 10); const dtObj = parseDate(itemDataISO, item.h_ini);
            if (item.status === "Confirmado") { rowCls = "status-confirmado"; badgeCls = "badge-confirmado"; if (dtObj && dtObj < agora) { isExpired = true; rowCls += " bg-vencido"; } }
            else if (item.status === "Cancelado" || item.status === "Adiado") { rowCls = "status-cancelado"; badgeCls = "badge-cancelado"; } else if (item.status === "Atendido" || item.status === "Arquivado") { rowCls = "status-atendido"; badgeCls = "badge-atendido"; } else if (item.status === "Disponível") { rowCls = "status-disponivel"; } else if (item.status === "Não confirmado") { rowCls = "status-nao-confirmado"; badgeCls = "badge-nao-confirmado"; } else if (item.status === "Indefinido") { rowCls = "status-indefinido"; badgeCls = "badge-padrao"; }

            let podeEditar = (item.status === "Disponível" || item.status === "Indefinido" || isExpired); const podeExcluir = ["Disponível", "Indefinido"].includes(item.status);
            let valorFmt = ""; if (!isClient() && !podeEditar && item.valor) { valorFmt = '<span class="valor-display">' + getValorNumerico(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '</span>'; }

            let statusContent = "";

            if (podeEditar) {
                let opts = '<option value="Disponível" ' + (item.status === "Disponível" ? 'selected' : '') + '>Disponível</option><option value="Indefinido" ' + (item.status === "Indefinido" ? 'selected' : '') + '>Indefinido</option>';
                if (isExpired && item.status === "Confirmado") { opts = '<option value="Confirmado" selected>Confirmado (Vencido)</option><option value="Atendido">Atendido</option><option value="Adiado">Adiado</option><option value="Cancelado">Cancelado</option>'; }
                statusContent = '<select id="status_' + item.id_unico + '" style="height:32px;width:auto;cursor:pointer;border-radius:6px;border:1px solid var(--border-color);font-size:12px;padding:0 8px;" onclick="event.stopPropagation()">' + opts + '</select>';
            } else {
                statusContent = '<span class="status-badge ' + badgeCls + '">' + item.status + '</span><input type="hidden" id="status_' + item.id_unico + '" value="' + item.status + '">';
            }

            let finalStatusHtml = "";
            if (!isClient()) { finalStatusHtml = '<div class="status-wrapper" style="width: 100%; justify-content: center;">' + statusContent + '</div>'; }
            else { finalStatusHtml = '<span class="status-badge ' + badgeCls + '">' + item.status + '</span><input type="hidden" id="status_' + item.id_unico + '" value="' + item.status + '">'; }

            let htmlSpec = (item.especialidade) ? '<span class="spec-badge">★ ' + escapeHtml(item.especialidade) + '</span>' : "";
            let htmlNomeEsp = '<span class="prof-badge pc-hide">👨‍⚕️ ' + escapeHtml(item.nome_esp) + '</span>';

            let stCliClass = ""; let stCliVal = item.status_cliente || "";
            if (stCliVal === "Confirmado") stCliClass = "st-cli-confirmado"; else if (stCliVal === "Remarcado") stCliClass = "st-cli-remarcado"; else if (stCliVal === "Pendente") stCliClass = "st-cli-pendente";

            let nomePrincipal = isClient() ? escapeHtml(item.nome_esp) : escapeHtml(item.cli);
            if (!nomePrincipal) nomePrincipal = "Novo Agendamento";
            let subtitulo = item.especialidade ? escapeHtml(item.especialidade) : "";

            html += '<div class="card ' + rowCls + '" id="card_' + item.id_unico + '">';
            html += '<div class="card-header" onclick="toggleCardEl(this)">';

            html += '<div class="ch-col-info">';
            html += '<div class="client-name-big">' + nomePrincipal + '</div>';
            if (subtitulo) html += '<div style="font-size: 12px; color: var(--text-sec);">' + subtitulo + '</div>';
            html += htmlNomeEsp;
            html += '</div>';

            html += '<div class="datetime-block">' + formatarDataBr(itemDataISO) + ' - ' + item.h_ini + ' às ' + item.h_fim + '</div>';
            html += '<div class="ch-col-status">' + finalStatusHtml + '</div>';
            html += '<div class="valor-wrapper">' + valorFmt + '</div>';

            html += '<button class="btn-expand-row" onclick="event.stopPropagation(); toggleCardEl(this);"><span class="material-icons">visibility</span></button>';

            html += '</div>';

            html += '<div class="card-body" onclick="event.stopPropagation()">';
            html += '<input type="hidden" id="valor_' + item.id_unico + '" value="' + escapeHtml(item.valor) + '"><input type="hidden" id="spec_' + item.id_unico + '" value="' + escapeHtml(item.especialidade) + '"><input type="hidden" id="stconf_' + item.id_unico + '" value="' + escapeHtml(item.status_conf) + '">';

            let formaHtmlStr = ''; if (podeEditar) { formaHtmlStr = '<select id="forma_' + item.id_unico + '"><option value="Presencial ou On-Line" ' + (item.forma == "Presencial ou On-Line" ? 'selected' : '') + '>Híbrido</option><option value="Presencial" ' + (item.forma == "Presencial" ? 'selected' : '') + '>Presencial</option><option value="On-Line" ' + (item.forma == "On-Line" ? 'selected' : '') + '>On-Line</option></select>'; } else { formaHtmlStr = '<input type="text" id="forma_' + item.id_unico + '" value="' + escapeHtml(item.forma) + '" readonly>'; }

            if (isClient() || !podeEditar) {
                html += '<input type="hidden" id="ativ_' + item.id_unico + '" value="' + escapeHtml(item.ativ) + '"><input type="hidden" id="ultev_' + item.id_unico + '" value="' + escapeHtml(item.ult_ev) + '"><input type="hidden" id="data_' + item.id_unico + '" value="' + itemDataISO + '"><input type="hidden" id="ini_' + item.id_unico + '" value="' + item.h_ini + '"><input type="hidden" id="fim_' + item.id_unico + '" value="' + item.h_fim + '">';
                html += '<div class="row-client-4"><div class="form-group"><div class="label-row"><label>FORMA DE ATENDIMENTO</label></div>' + formaHtmlStr + '</div><div class="form-group"><div class="label-row"><label>Cliente</label></div><input type="text" id="cli_' + item.id_unico + '" value="' + escapeHtml(item.cli) + '" readonly></div><div class="form-group"><div class="label-row"><label>Celular</label></div><input type="text" id="celcli_' + item.id_unico + '" value="' + escapeHtml(item.cel_cli) + '" readonly></div><div class="form-group"><div class="label-row"><label>Status Cliente</label></div><input type="text" value="' + escapeHtml(item.status_cliente) + '" class="' + stCliClass + '" readonly></div></div>';
            } else {
                html += '<div class="row-grid-3"><div class="form-group"><div class="label-row"><label>Atividade</label></div><input type="text" id="ativ_' + item.id_unico + '" value="' + escapeHtml(item.ativ) + '" readonly></div><div class="form-group"><div class="label-row"><label>Último Evento</label></div><input type="text" id="ultev_' + item.id_unico + '" value="' + escapeHtml(item.ult_ev) + '" readonly></div><div class="form-group"><div class="label-row"><label>FORMA DE ATENDIMENTO</label></div>' + formaHtmlStr + '</div></div><div class="row-datetime"><div class="form-group"><div class="label-row"><label>Data</label></div><input type="date" id="data_' + item.id_unico + '" value="' + itemDataISO + '" ' + (!podeEditar ? 'readonly' : '') + '></div><div class="form-group"><div class="label-row"><label>Início</label></div><input type="time" id="ini_' + item.id_unico + '" value="' + item.h_ini + '" ' + (!podeEditar ? 'readonly' : '') + '></div><div class="form-group"><div class="label-row"><label>Fim</label></div><input type="time" id="fim_' + item.id_unico + '" value="' + item.h_fim + '" ' + (!podeEditar ? 'readonly' : '') + '></div></div><div class="row-client-group"><div class="form-group client-name-box"><div class="label-row"><label>Cliente</label></div><input type="text" id="cli_' + item.id_unico + '" value="' + escapeHtml(item.cli) + '" readonly></div><div class="form-group"><div class="label-row"><label>Celular</label></div><input type="text" id="celcli_' + item.id_unico + '" value="' + escapeHtml(item.cel_cli) + '" readonly></div><div class="form-group"><div class="label-row"><label>Status Cliente</label></div><input type="text" value="' + escapeHtml(item.status_cliente) + '" class="' + stCliClass + '" readonly></div></div>';
            }

            let labelLocal = "LOCAL DO EVENTO"; if (item.forma === "On-Line") labelLocal = "PLATAFORMA E/OU LINK DO EVENTO";
            let btnEditLocal = ""; if (!isClient() && item.status === "Confirmado") { btnEditLocal = '<span class="material-icons" style="cursor:pointer; font-size:16px; color:#fbbc04; margin-left:5px;" onclick="abrirModalLocal(\'' + item.id_unico + '\')" title="Editar Local/Link">edit</span>'; }

            html += '<div class="row-payment-group"><div class="form-group local-box"><div class="label-row" style="justify-content: space-between; width: 100%;"><label>' + labelLocal + '</label><div style="display:flex; align-items:center; gap:5px;"><span class="copy-link-btn" onclick="copiarLink(\'loc_' + item.id_unico + '\')" title="Copiar">📋</span>' + btnEditLocal + '</div></div><input type="text" id="loc_' + item.id_unico + '" value="' + escapeHtml(item.local) + '" readonly></div><div class="form-group"><div class="label-row"><label>ID Pag.</label><div style="display:flex; align-items:center; gap:5px; margin-left:auto;"><span class="copy-link-btn" onclick="copiarLink(\'idpag_' + item.id_unico + '\')" title="Copiar">📋</span></div></div><input type="text" id="idpag_' + item.id_unico + '" value="' + escapeHtml(item.id_pag) + '" readonly></div><div class="form-group"><div class="label-row"><label>Link Pag.</label><div style="display:flex; align-items:center; gap:5px; margin-left:auto;"><span class="copy-link-btn" onclick="copiarLink(\'linkpag_' + item.id_unico + '\')" title="Copiar">📋</span></div></div><input type="text" id="linkpag_' + item.id_unico + '" value="' + escapeHtml(item.link_pag) + '" readonly></div></div>';

            const gridClass = isClient() ? "row-info-group grid-client" : "row-info-group"; html += '<div class="' + gridClass + '">';

            if (!isClient()) { html += '<div class="form-group"><div class="label-row"><label>MINHAS CONSIDERAÇÕES</label></div><div id="obs_display_' + item.id_unico + '" class="obs-field ' + (item.obs ? '' : 'obs-placeholder') + '" onclick="abrirModalLog(\'' + item.id_unico + '\', \'obs\', \'Minhas Considerações\')">' + (escapeHtml(formatarLogResumo(item.obs)) || "Clique para editar...") + '</div><input type="hidden" id="obs_' + item.id_unico + '" value="' + escapeHtml(item.obs) + '"></div>'; }
            else { html += '<input type="hidden" id="obs_' + item.id_unico + '" value="' + escapeHtml(item.obs) + '">'; }

            let isUnreadCli = (isClient() && item.obs_para_cliente && item.obs_para_cliente.trim() !== "" && item.visto_p_cli !== "Visto");
            let obsPcliClass = "obs-field " + (item.obs_para_cliente ? "" : "obs-placeholder");
            if (isUnreadCli) obsPcliClass += " obs-unread";

            if (isClient()) { html += '<div class="form-group"><div class="label-row"><label>INFO PARA O CLIENTE</label></div><div id="obspcli_display_' + item.id_unico + '" class="' + obsPcliClass + '" onclick="abrirModalLog(\'' + item.id_unico + '\', \'obspcli\', \'Info para o Cliente\')">' + (escapeHtml(formatarLogResumo(item.obs_para_cliente)) || "Clique para visualizar...") + '</div><input type="hidden" id="obspcli_' + item.id_unico + '" value="' + escapeHtml(item.obs_para_cliente) + '"></div>'; }
            else { html += '<div class="form-group"><div class="label-row"><label>INFO PARA O CLIENTE</label></div><div id="obspcli_display_' + item.id_unico + '" class="obs-field ' + (item.obs_para_cliente ? '' : 'obs-placeholder') + '" onclick="abrirModalLog(\'' + item.id_unico + '\', \'obspcli\', \'Info para o Cliente\')">' + (escapeHtml(formatarLogResumo(item.obs_para_cliente)) || "Clique para editar...") + '</div><input type="hidden" id="obspcli_' + item.id_unico + '" value="' + escapeHtml(item.obs_para_cliente) + '"></div>'; }
            html += '<input type="hidden" id="vistopcli_' + item.id_unico + '" value="' + escapeHtml(item.visto_p_cli || "") + '">';

            let isUnreadEsp = (!isClient() && item.obs_cliente && item.obs_cliente.trim() !== "" && item.visto_cli !== "Visto");
            let obsCliClass = "obs-field " + (item.obs_cliente ? "" : "obs-placeholder");
            if (isUnreadEsp) obsCliClass += " obs-unread";

            if (isClient()) { html += '<div class="form-group"><div class="label-row"><label>INFO DO CLIENTE</label></div><div id="obscli_display_' + item.id_unico + '" class="obs-field ' + (item.obs_cliente ? '' : 'obs-placeholder') + '" onclick="abrirModalLog(\'' + item.id_unico + '\', \'obscli\', \'Info do Cliente\')">' + (escapeHtml(formatarLogResumo(item.obs_cliente)) || "Adicionar exames/infos...") + '</div><input type="hidden" id="obscli_' + item.id_unico + '" value="' + escapeHtml(item.obs_cliente) + '"></div>'; }
            else { html += '<div class="form-group"><div class="label-row"><label>INFO DO CLIENTE</label></div><div id="obscli_display_' + item.id_unico + '" class="' + obsCliClass + '" onclick="abrirModalLog(\'' + item.id_unico + '\', \'obscli\', \'Info do Cliente\')">' + (escapeHtml(formatarLogResumo(item.obs_cliente)) || "Clique para visualizar/editar...") + '</div><input type="hidden" id="obscli_' + item.id_unico + '" value="' + escapeHtml(item.obs_cliente) + '"></div>'; }
            html += '<input type="hidden" id="vistocli_' + item.id_unico + '" value="' + escapeHtml(item.visto_cli || "") + '">';

            html += '<div class="form-group"><div class="label-row"><label>INFO PRÉ-ATENDIMENTO</label></div><div class="info-readonly" onclick="abrirModalInfo(\'INFO PRÉ-ATENDIMENTO\', \'relatorio_' + item.id_unico + '\')">' + (escapeHtml(item.relatorio) || "...") + '</div><input type="hidden" id="relatorio_' + item.id_unico + '" value="' + escapeHtml(item.relatorio) + '"></div></div></div>';

            if (!isClient()) {
                html += '<div class="card-actions" onclick="event.stopPropagation()">';
                if (item.status === 'Confirmado') {
                    html += '<button class="btn" style="background:#fff; color:#ef4444; border: 1px solid #fecaca;" onclick="acaoMarcarCancelado(\'' + item.id_unico + '\', null)">❌ Cancelar</button>';
                    html += '<button class="btn btn-save" onclick="acaoMarcarAtendido(\'' + item.id_unico + '\', null)">✅ Atender</button>';
                }
                if (item.status === 'Atendido' || item.status === 'Arquivado') {
                    html += '<button class="btn" style="background:#f3e8ff; color:#7e22ce; border: 1px solid #e9d5ff;" onclick="alternarArquivamento(\'' + item.id_unico + '\', {checked: ' + (item.status !== "Arquivado") + '})">📦 ' + (item.status === "Arquivado" ? "Desarquivar" : "Arquivar") + '</button>';
                }
                if (podeExcluir) html += '<button class="btn btn-del" onclick="excluir(\'' + item.id_unico + '\')">🗑️</button>';
                if (podeEditar) html += '<button class="btn btn-save" onclick="salvar(\'' + item.id_unico + '\')">💾 Salvar</button>';
                html += '</div>';
            }
            html += '</div>';
        });
    } catch (err) { console.error("Erro render", err); }
    containerAlvo.innerHTML = html;
}

function aplicarFiltrosPrincipalDebounce() { clearTimeout(debounceTimer); debounceTimer = setTimeout(aplicarFiltrosPrincipal, 10); }

function aplicarFiltrosPrincipal() {
    try {
        const container = document.getElementById('cards-container'); const agora = new Date();
        if (!dadosGlobais || dadosGlobais.length === 0) {
            if (container) container.innerHTML = '<div style="text-align: center; padding: 40px;">Nenhum agendamento encontrado.<br><br><button class="btn-refresh" style="margin:0 auto; width:auto;" onclick="limparFiltros()">Limpar Filtros</button></div>';
            atualizarBadgeTotal('badge-total-confirmado', 'row-total-confirmado', '', 0, 0, false); atualizarBadgeTotal('badge-total-atendido', 'row-total-atendido', '', 0, 0, false); atualizarBadgeTotal('badge-total-cancelado', 'row-total-cancelado', '', 0, 0, false);
            return;
        }

        const hojeStr = getHojeStr(); let filtrados = [];
        const amanhaObj = new Date(); amanhaObj.setDate(amanhaObj.getDate() + 1);
        const amanhaStr = amanhaObj.getFullYear() + "-" + String(amanhaObj.getMonth() + 1).padStart(2, '0') + "-" + String(amanhaObj.getDate()).padStart(2, '0');

        const dataFiltroObj = document.getElementById('filtro-data'); const dataFiltro = dataFiltroObj ? dataFiltroObj.value : "";
        const statusFiltroObj = document.getElementById('filtro-status'); const statusFiltro = statusFiltroObj ? statusFiltroObj.value : "";
        const clienteFiltroObj = document.getElementById('filtro-cliente'); const clienteFiltro = clienteFiltroObj ? clienteFiltroObj.value.toLowerCase() : "";
        const especialidadeFiltroObj = document.getElementById('filtro-especialidade'); const especialidadeFiltro = especialidadeFiltroObj ? especialidadeFiltroObj.value.toLowerCase() : "";

        const mobDataObj = document.getElementById('filtro-data-mobile'); const mobData = mobDataObj ? mobDataObj.value : "";
        const mobStatusObj = document.getElementById('filtro-status-mobile'); const mobStatus = mobStatusObj ? mobStatusObj.value : "";
        const mobClienteObj = document.getElementById('filtro-cliente-mobile'); const mobCliente = mobClienteObj ? mobClienteObj.value.toLowerCase() : "";
        const mobEspecialidadeObj = document.getElementById('filtro-especialidade-mobile'); const mobEspecialidade = mobEspecialidadeObj ? mobEspecialidadeObj.value.toLowerCase() : "";

        const finalData = dataFiltro || mobData; const finalStatus = statusFiltro || mobStatus; const finalCliente = clienteFiltro || mobCliente; const finalEspecialidade = especialidadeFiltro || mobEspecialidade;

        if (filtroSinoAtivo) {
            filtrados = dadosGlobais.filter(function (item) {
                if (filtroSinoAtivo === 'unread') { if (isClient()) return (item.obs_para_cliente && item.obs_para_cliente.trim() !== "" && item.visto_p_cli !== "Visto"); else return (item.obs_cliente && item.obs_cliente.trim() !== "" && item.visto_cli !== "Visto"); }
                if (item.status !== 'Confirmado') return false;
                const itemData = String(item.data).substring(0, 10); const dt = parseDate(itemData, item.h_ini); if (!dt) return false;
                const diffMs = dt - agora; const isHoje = (itemData === hojeStr); const isAmanha = (itemData === amanhaStr);
                if (filtroSinoAtivo === 'vencido') return diffMs < 0; if (filtroSinoAtivo === 'hoje') return isHoje && diffMs >= 0; if (filtroSinoAtivo === '24h') return isAmanha; if (filtroSinoAtivo === 'futuro') return !isHoje && !isAmanha && diffMs > 0;
                return true;
            });
        } else {
            filtrados = dadosGlobais.filter(function (item) {
                const matchData = !finalData || String(item.data).substring(0, 10) === finalData;
                let matchStatus = true; if (finalStatus) { matchStatus = item.status && item.status.trim() === finalStatus; } else { matchStatus = item.status !== 'Arquivado'; }
                const matchCliente = !finalCliente || (isClient() ? (item.nome_esp && String(item.nome_esp).toLowerCase().includes(finalCliente)) : (item.cli && String(item.cli).toLowerCase().includes(finalCliente)));
                const matchEspecialidade = !finalEspecialidade || (item.especialidade && String(item.especialidade).toLowerCase().includes(finalEspecialidade));
                return matchData && matchStatus && matchCliente && matchEspecialidade;
            });
        }

        filtrados.sort(ordenarCards);

        let totalConfirmado = 0, qtdConfirmado = 0, totalAtendido = 0, qtdAtendido = 0, totalCancelado = 0, qtdCancelado = 0;
        filtrados.forEach(function (item) {
            let val = getValorNumerico(item.valor);
            if (item.status === 'Confirmado') { totalConfirmado += val; qtdConfirmado++; }
            if (item.status === 'Atendido' || item.status === 'Aconteceu') { totalAtendido += val; qtdAtendido++; }
            if (item.status === 'Cancelado') { totalCancelado += val; qtdCancelado++; }
        });

        let showConf = (finalStatus === "Confirmado"); let showAten = (finalStatus === "Atendido" || finalStatus === "Arquivado"); let showCanc = (finalStatus === "Cancelado");
        atualizarBadgeTotal('badge-total-confirmado', 'row-total-confirmado', 'Total (Confirmado): ', totalConfirmado, qtdConfirmado, showConf); atualizarBadgeTotal('badge-total-atendido', 'row-total-atendido', 'Total (Atendido): ', totalAtendido, qtdAtendido, showAten); atualizarBadgeTotal('badge-total-cancelado', 'row-total-cancelado', 'Total (Cancelado): ', totalCancelado, qtdCancelado, showCanc);

        if (filtrados.length === 0) { if (container) container.innerHTML = '<div style="text-align: center; padding: 40px; color:#888;">Nenhum agendamento para este filtro.<br><br><button class="btn-refresh" style="margin:0 auto; width:auto;" onclick="limparFiltros()">Limpar Filtros</button></div>'; } else { renderizar(filtrados, container); }
        verificarInputsPreenchidos();

        const qtdAtual = filtrados.length;
        if (document.getElementById('qtd-cards-pc')) document.getElementById('qtd-cards-pc').textContent = qtdAtual;
        if (document.getElementById('qtd-cards-mobile')) document.getElementById('qtd-cards-mobile').textContent = qtdAtual;

    } catch (e) { }
}

function aplicarFiltroPeriodo() {
    const isMobile = window.innerWidth <= 768;
    let periodo = isMobile ? gV('filtro-periodo-select-mobile') : gV('filtro-periodo-select');
    let statusFiltro = isMobile ? gV('filtro-status-periodo-mobile') : gV('filtro-status-periodo');
    let dtIni = isMobile ? gV('data-inicio-mobile') : gV('data-inicio-pc');
    let dtFim = isMobile ? gV('data-fim-mobile') : gV('data-fim-pc');

    const elIntervaloPc = document.getElementById('custom-interval-pc'); const elIntervaloMob = document.getElementById('custom-interval-mobile');
    if (elIntervaloPc) elIntervaloPc.style.display = (periodo === 'custom') ? 'flex' : 'none';
    if (elIntervaloMob) elIntervaloMob.style.display = (periodo === 'custom') ? 'flex' : 'none';

    ['filtro-periodo-select', 'filtro-periodo-select-mobile'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = periodo; });
    ['filtro-status-periodo', 'filtro-status-periodo-mobile'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = statusFiltro; });
    ['data-inicio-pc', 'data-inicio-mobile'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = dtIni; });
    ['data-fim-pc', 'data-fim-mobile'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = dtFim; });

    const container = document.getElementById('cards-container-periodo');
    if (!dadosGlobais || dadosGlobais.length === 0) { if (container) container.innerHTML = '<div style="padding:40px;text-align:center;">Sem dados.</div>'; return; }

    const agora = new Date(); const anoAtual = agora.getFullYear(); const mesAtual = agora.getMonth(); const diaAtual = agora.getDate();
    let iniCustom = dtIni ? parseDate(dtIni, "00:00") : null; let fimCustom = dtFim ? parseDate(dtFim, "23:59") : null;

    let filtrados = dadosGlobais.filter(function (item) {
        if (statusFiltro && item.status !== statusFiltro) return false;
        const dataItem = parseDate(String(item.data).substring(0, 10), "00:00"); if (!dataItem) return false;

        if (periodo === 'hoje') { return dataItem.getDate() === diaAtual && dataItem.getMonth() === mesAtual && dataItem.getFullYear() === anoAtual; }
        else if (periodo === 'mes') { return dataItem.getMonth() === mesAtual && dataItem.getFullYear() === anoAtual; }
        else if (periodo === 'trimestre') { const t = Math.floor(mesAtual / 3) * 3; return dataItem.getMonth() >= t && dataItem.getMonth() < t + 3 && dataItem.getFullYear() === anoAtual; }
        else if (periodo === 'semestre') { const s = mesAtual < 6 ? 0 : 6; return dataItem.getMonth() >= s && dataItem.getMonth() < s + 6 && dataItem.getFullYear() === anoAtual; }
        else if (periodo === 'ano') { return dataItem.getFullYear() === anoAtual; }
        else if (periodo === 'custom') { if (iniCustom && dataItem < iniCustom) return false; if (fimCustom && dataItem > fimCustom) return false; return true; }
        return true;
    });

    filtrados.sort(ordenarCards);

    let total = 0; let qtd = 0;
    filtrados.forEach(function (item) {
        if (!statusFiltro) { if (item.status === 'Atendido' || item.status === 'Confirmado') { total += getValorNumerico(item.valor); qtd++; } } else { if (item.status === statusFiltro) { total += getValorNumerico(item.valor); qtd++; } }
    });

    const badgePeriodoPc = document.getElementById('badge-total-periodo-pc'); const rowPeriodoPc = document.getElementById('row-total-periodo-pc');
    const badgePeriodoMob = document.getElementById('badge-total-periodo-mobile'); const rowPeriodoMob = document.getElementById('row-total-periodo-mobile');

    if (!isClient()) {
        let corClasse = "total-padrao"; let labelStatus = statusFiltro ? statusFiltro : "Todos";
        if (statusFiltro === "Confirmado") corClasse = "total-confirmado"; else if (statusFiltro === "Atendido" || statusFiltro === "Arquivado") corClasse = "total-atendido"; else if (statusFiltro === "Cancelado") corClasse = "total-cancelado";
        let txt = `Total (${labelStatus}): ` + total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' (' + qtd + ')';
        if (badgePeriodoPc) { badgePeriodoPc.className = "total-badge " + corClasse; badgePeriodoPc.textContent = txt; badgePeriodoPc.style.display = 'inline-block'; if (rowPeriodoPc) rowPeriodoPc.style.display = 'flex'; }
        if (badgePeriodoMob) { badgePeriodoMob.className = "total-badge " + corClasse; badgePeriodoMob.textContent = txt; badgePeriodoMob.style.display = 'inline-block'; if (rowPeriodoMob) rowPeriodoMob.style.display = 'flex'; }
    } else {
        if (badgePeriodoPc) { badgePeriodoPc.style.display = 'none'; if (rowPeriodoPc) rowPeriodoPc.style.display = 'none'; }
        if (badgePeriodoMob) { badgePeriodoMob.style.display = 'none'; if (rowPeriodoMob) rowPeriodoMob.style.display = 'none'; }
    }

    if (filtrados.length === 0) { if (container) container.innerHTML = '<div style="text-align: center; padding: 40px; color: #888;">Nada encontrado.</div>'; } else { renderizar(filtrados, container); } verificarInputsPreenchidos();
    const qtdAtualPer = filtrados.length;
    if (document.getElementById('qtd-cards-periodo-pc')) document.getElementById('qtd-cards-periodo-pc').textContent = qtdAtualPer;
    if (document.getElementById('qtd-cards-periodo-mobile')) document.getElementById('qtd-cards-periodo-mobile').textContent = qtdAtualPer;
}

async function carregar() {
    if (!userEmail) return;
    const menu = document.getElementById('menu-principal');
    if (menu) menu.classList.remove('show-menu');

    filtroSinoAtivo = null;
    let lblPc = document.getElementById('lbl-relatorio-pc');
    if (lblPc) lblPc.style.display = 'none';
    let lblMob = document.getElementById('lbl-relatorio-mobile');
    if (lblMob) lblMob.style.display = 'none';
    clienteSelecionadoCelular = null;

    if (document.getElementById('filtro-data')) document.getElementById('filtro-data').value = "";
    if (document.getElementById('filtro-status')) document.getElementById('filtro-status').value = "";
    if (document.getElementById('filtro-cliente')) document.getElementById('filtro-cliente').value = "";
    if (document.getElementById('filtro-especialidade')) document.getElementById('filtro-especialidade').value = "";

    const md = document.getElementById('filtro-data-mobile');
    if (md) { md.value = ""; atualizarPlaceholderData(); }
    const ms = document.getElementById('filtro-status-mobile'); if (ms) ms.value = "";
    const mc = document.getElementById('filtro-cliente-mobile'); if (mc) mc.value = "";
    const me = document.getElementById('filtro-especialidade-mobile'); if (me) me.value = "";

    atualizarEstiloSinos();

    const loaderEl = document.getElementById('loader');
    if (loaderEl) loaderEl.style.display = 'flex';

    try {
        const payload = {
            acao: 'listar_agenda',
            email: userEmail,
            codigoempresa: userCodigoEmpresa
        };

        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', payload);

        if (res.erro || !res.sucesso) {
            alert("Erro: " + (res.erro || "Falha desconhecida"));
            if (loaderEl) loaderEl.style.display = 'none';
            return;
        }

        let rawData = res.data || [];
        rawData.sort(ordenarCards);

        dadosGlobais = rawData;
        if (typeof processarClientesUnicos === 'function') processarClientesUnicos();
        if (typeof processarEspecialidadesUnicas === 'function') processarEspecialidadesUnicas();
        if (typeof atualizarSinos === 'function') atualizarSinos();

        if (typeof isClient === 'function' && !isClient() && res.janelaPropria !== undefined) {
            const jpPc = document.getElementById('janela-interacao-pc');
            if (jpPc) jpPc.value = res.janelaPropria;
            const jpMob = document.getElementById('janela-interacao-mobile');
            if (jpMob) jpMob.value = res.janelaPropria;
        }

        const viewPrincipal = document.getElementById('view-principal');
        if (viewPrincipal && viewPrincipal.style.display !== 'none') {
            if (typeof aplicarFiltrosPrincipal === 'function') aplicarFiltrosPrincipal();
        } else {
            if (typeof aplicarFiltroPeriodo === 'function') aplicarFiltroPeriodo();
        }

        if (loaderEl) loaderEl.style.display = 'none';
        if (typeof verificarInputsPreenchidos === 'function') verificarInputsPreenchidos();

    } catch (err) {
        if (err.message === "SESSION_EXPIRED") return;
        alert("Falha: " + err.message);
        if (loaderEl) loaderEl.style.display = 'none';
    }
}

/**
 * Busca Especialidades e Sub-especialidades em paralelo e renderiza a hierarquia no Iframe de Cadastros.
 * Este método utiliza a estratégia de "Iframe Bridge" para injetar dados reais no design Tailwind do mockup.
 */
/**
 * Busca Especialidades, Sub-especialidades e Produtos em paralelo e renderiza a hierarquia no Iframe.
 * Implementa o design Tailwind aprovado com suporte a CRUD completo.
 */
async function carregarEstruturaHierarquica() {
    // [RESILIÊNCIA] Garante que dados da empresa e roles estejam carregados (Polling Mestre)
    if (!localStorage.getItem('appAgendaUserCodigoEmpresa')) {
        console.warn("⏳ [RACE CONDITION] Token não encontrado no Iframe. Aguardando sincronização do Parent (500ms)...");
        setTimeout(carregarEstruturaHierarquica, 500);
        return;
    }
    if (!userCodigoEmpresa) userCodigoEmpresa = localStorage.getItem('appAgendaUserCodigoEmpresa') || "";
    if (!tipoUsuarioAtual) tipoUsuarioAtual = localStorage.getItem('appAgendaUserTipo') || "Especialista";

    console.log("📂 [HIERARQUIA] Iniciando carga dinâmica total...", { empresa: userCodigoEmpresa, role: tipoUsuarioAtual });
    const iframe = document.querySelector('iframe[src*="tela_cadastro_mockup"]');
    if (!iframe) return;

    try {
        // Busca tripla para montagem da árvore completa
        const [resEsp, resSub, resProd] = await Promise.all([
            ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'listar_especialidades_geral', codigoempresa: userCodigoEmpresa }),
            ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'listar_sub_especialidades', codigoempresa: userCodigoEmpresa }),
            ApiClient.post('/functions/v1/gerenciar-agendamentos', { acao: 'listar_produtos', codigoempresa: userCodigoEmpresa })
        ]);

        if (!resEsp.sucesso || !resSub.sucesso || !resProd.sucesso) {
            console.error("❌ [HIERARQUIA] Falha na busca de dados:", resEsp.erro || resSub.erro || resProd.erro);
            return;
        }

        const especialidades = resEsp.dados || [];
        const subEspecialidades = resSub.dados || [];
        const produtos = resProd.dados || [];

        // Agrupamento multinível (Especialidade -> Sub -> Produto)
        const subMap = {};
        subEspecialidades.forEach(s => {
            if (!subMap[s.especialidade_id]) subMap[s.especialidade_id] = [];
            subMap[s.especialidade_id].push(s);
        });

        const prodMap = {};
        produtos.forEach(p => {
            const key = p.cod_sub_especialidade || p.sub_especialidade_id || p.sub_especialidade;
            if (!prodMap[key]) prodMap[key] = [];
            prodMap[key].push(p);
        });

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const container = doc.getElementById('container-hierarquia');
        if (!container) return;

        if (especialidades.length === 0) {
            container.innerHTML = `
                <div class="tw-p-10 tw-text-center tw-text-slate-400 tw-italic tw-bg-white tw-rounded-lg tw-border-2 tw-border-dashed tw-border-slate-100">
                    Nenhuma especialidade cadastrada ainda. Use o botão acima para começar.
                </div>`;
            return;
        }

        let html = '';
        especialidades.forEach(esp => {
            const subs = subMap[esp.id] || [];
            const espContainerId = `subs-esp-${esp.id}`;
            const espIconId = `icon-esp-${esp.id}`;

            html += `
            <section class="tw-space-y-6 tw-mb-12 tw-fade-in-smooth">
                <!-- CARD ESPECIALIDADE -->
                <div class="tw-bg-white tw-p-6 tw-rounded-xl tw-flex tw-items-center tw-justify-between tw-shadow-sm tw-border-l-4 tw-border-primary tw-group hover:tw-shadow-md tw-transition-shadow" style="border-left-color: #3F76CB;">
                    <div class="tw-flex tw-items-center tw-gap-5">
                        <div class="tw-w-12 tw-h-12 tw-rounded-full tw-bg-primary-fixed tw-flex tw-items-center tw-justify-center tw-text-primary group-hover:tw-scale-110 tw-transition-transform">
                            <span class="material-symbols-outlined tw-text-2xl">stethoscope</span>
                        </div>
                        <div>
                            <h3 class="tw-font-bold tw-text-on-surface tw-flex tw-items-center tw-text-lg">
                                ${escapeHtml(esp.nome)} 
                                <span class="material-symbols-outlined tw-text-xl tw-text-slate-400 hover:tw-text-primary tw-ml-3 tw-cursor-pointer tw-transition-colors" title="Editar Especialidade"
                                    onclick="window.parent.prepararEdicaoEspecialidade('${esp.id}', '${escapeHtml(esp.nome)}')">settings</span>
                            </h3>
                        </div>
                    </div>
                    <div class="tw-flex tw-items-center tw-gap-3">
                        <button onclick="window.parent.prepararNovoSubEspecialidade('${esp.id}', '${escapeHtml(esp.nome)}')" 
                            class="tw-h-[36px] tw-rounded-lg tw-text-sm tw-font-bold tw-flex tw-items-center tw-gap-2 tw-px-4 tw-bg-blue-50 tw-text-primary hover:tw-bg-blue-100 tw-transition-colors tw-border-none tw-cursor-pointer">
                            <span class="material-symbols-outlined tw-text-lg">add_circle</span> Adicionar Sub
                        </button>
                        <div class="tw-h-8 tw-w-[1px] tw-bg-outline-variant/30"></div>
                        <button onclick="window.parent.toggleHierarquia('${espContainerId}', '${espIconId}')" 
                            class="tw-ml-4 tw-p-2 tw-rounded-lg tw-text-outline hover:tw-text-primary hover:tw-bg-primary-fixed/30 tw-transition-all tw-flex tw-items-center tw-justify-center tw-w-12 tw-h-12 tw-border-none tw-bg-transparent tw-cursor-pointer" title="Expandir/Recolher">
                            <span id="${espIconId}" class="material-symbols-outlined tw-text-2xl">visibility_off</span>
                        </button>
                    </div>
                </div>

                <!-- CONTAINER SUBS -->
                <div class="tw-ml-12 tw-space-y-8 diagnostic-thread tw-hidden" id="${espContainerId}">
                    ${subs.length > 0 ? subs.map(sub => {
                const subProds = prodMap[sub.codigo_sub_especialidade] || prodMap[sub.id] || prodMap[sub.nome] || [];
                const subContainerId = `prod-sub-${sub.id}`;
                const subIconId = `icon-sub-${sub.id}`;

                return `
                <div class="tw-space-y-4">
                    <!-- HEADER SUB-ESPECIALIDADE -->
                    <div class="tw-bg-white tw-flex tw-items-center tw-justify-between tw-p-5 tw-rounded-xl tw-shadow-sm tw-border-l-4 tw-border-blue-500 tw-border-y tw-border-r tw-border-slate-100">
                        <div class="tw-flex tw-items-center tw-gap-2">
                            <span class="material-symbols-outlined tw-text-outline">subdirectory_arrow_right</span>
                            <h4 class="tw-font-bold tw-text-on-surface-variant tw-text-base">
                                ${escapeHtml(sub.nome)} 
                                <span class="material-symbols-outlined tw-text-xl tw-text-slate-400 hover:tw-text-primary tw-ml-2 tw-cursor-pointer tw-transition-colors" title="Editar Sub"
                                    onclick="window.parent.prepararEdicaoSubEspecialidade('${sub.id}', '${escapeHtml(sub.nome)}', '${esp.id}')">settings</span>
                            </h4>
                        </div>
                        <div class="tw-flex tw-items-center tw-gap-3">
                            <button onclick="window.parent.prepararNovoProduto('${sub.id}', '${escapeHtml(sub.nome)}', '${esp.id}', '${escapeHtml(esp.nome)}')" 
                                class="tw-h-[36px] tw-rounded-lg tw-text-sm tw-font-bold tw-flex tw-items-center tw-gap-2 tw-px-4 tw-bg-primary tw-text-white hover:tw-bg-blue-700 tw-transition-colors tw-border-none tw-cursor-pointer">
                                <span class="material-symbols-outlined tw-text-lg">add</span> Novo Produto
                            </button>
                            <div class="tw-h-8 tw-w-[1px] tw-bg-outline-variant/30"></div>
                            <button type="button" onclick="window.parent.toggleHierarquia('${subContainerId}', '${subIconId}')" 
                                class="tw-p-2 tw-rounded-lg tw-text-outline hover:tw-text-primary hover:tw-bg-primary-fixed/30 tw-transition-all tw-flex tw-items-center tw-justify-center tw-w-10 tw-h-10 tw-border-none tw-bg-transparent tw-cursor-pointer" title="Expandir/Recolher">
                                <span id="${subIconId}" class="material-symbols-outlined tw-text-2xl">visibility_off</span>
                            </button>
                        </div>
                    </div>

                    <!-- GRID PRODUTOS -->
                    <div id="${subContainerId}" class="tw-hidden tw-grid tw-grid-cols-1 md:tw-grid-cols-2 xl:tw-grid-cols-3 tw-gap-6 tw-transition-all">
                        ${subProds.length > 0 ? subProds.map(prod => `
                        <div class="tw-bg-white tw-p-5 tw-rounded-xl tw-shadow-sm tw-border tw-border-outline-variant/10 hover:tw-border-secondary/30 hover:tw-shadow-lg tw-transition-all tw-group">
                            <div class="tw-flex tw-justify-between tw-items-start tw-mb-4">
                                <div class="tw-p-2 tw-rounded-lg tw-bg-surface-container-low tw-text-primary">
                                    <span class="material-symbols-outlined">${prod.forma_atendimento === 'On-Line' ? 'videocam' : 'ecg'}</span>
                                </div>
                                <div class="tw-flex tw-gap-1 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity">
                                    <button onclick="window.parent.prepararEdicaoProduto('${prod.id}')" 
                                        class="tw-p-1.5 hover:tw-bg-slate-100 tw-rounded tw-text-slate-400 hover:tw-text-primary tw-transition-colors tw-border-none tw-bg-transparent tw-cursor-pointer">
                                        <span class="material-symbols-outlined tw-text-xl">settings</span>
                                    </button>
                                    <button onclick="window.parent.prepararExclusaoProduto('${prod.id}', '${escapeHtml(prod.nome_produto)}')" 
                                        class="tw-p-1.5 hover:tw-bg-error-container tw-rounded tw-text-slate-400 hover:tw-text-error tw-transition-colors tw-border-none tw-bg-transparent tw-cursor-pointer">
                                        <span class="material-symbols-outlined tw-text-xl">delete</span>
                                    </button>
                                </div>
                            </div>
                            <h5 class="tw-font-bold tw-text-on-surface tw-mb-1 tw-text-base">${escapeHtml(prod.nome_produto)}</h5>
                            <div class="tw-flex tw-items-center tw-justify-between tw-mt-4 tw-pt-4 tw-border-t tw-border-outline-variant/10">
                                <div>
                                    <span class="tw-text-xs tw-text-outline tw-font-medium tw-block tw-uppercase">Preço</span>
                                    <span class="tw-text-primary tw-font-extrabold">R$ ${prod.valor_prom || prod.valor_real}</span>
                                </div>
                                <div class="tw-text-right">
                                    <span class="tw-text-xs tw-text-outline tw-font-medium tw-block tw-uppercase">Tipo</span>
                                    <span class="tw-text-on-surface tw-text-sm tw-font-semibold">${escapeHtml(prod.forma_atendimento)}</span>
                                </div>
                            </div>
                        </div>
                        `).join('') : `
                        <div class="tw-col-span-full tw-p-4 tw-text-center tw-text-slate-400 tw-text-xs tw-italic tw-border tw-border-dashed tw-border-slate-100 tw-rounded-lg">Nenhum produto cadastrado neste nível.</div>
                        `}
                    </div>
                </div>
                `;
            }).join('') : `
                <div class="tw-p-4 tw-text-center tw-text-slate-400 tw-text-xs tw-italic tw-bg-slate-50/50 tw-rounded-lg">Nenhuma sub-especialidade vinculada.</div>
            `}
                </div>
            </section>`;
        });

        container.innerHTML = html;

        // Auto-sincronização de altura
        if (iframe.contentWindow && typeof iframe.contentWindow.sendHeight === 'function') {
            setTimeout(() => iframe.contentWindow.sendHeight(), 100);
        }

    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("❌ [HIERARQUIA] Erro na renderização SaaS:", e);
    }
}

/**
 * Função de toggle para comportamento de Accordion na estrutura hierárquica.
 * Alterna a visibilidade do container e troca o ícone Material Symbols.
 */
function toggleHierarquia(containerId, iconId) {
    console.log("📂 [TOGGLE] Alternando visibilidade:", containerId);
    const iframe = document.querySelector('iframe[src*="tela_cadastro_mockup"]');
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const container = doc.getElementById(containerId);
    const icon = doc.getElementById(iconId);

    if (container && icon) {
        const isHidden = container.classList.contains('tw-hidden');

        if (isHidden) {
            container.classList.remove('tw-hidden');
            icon.textContent = 'visibility';
            container.classList.add('tw-animate-fade-in'); // Opcional: animação suave
        } else {
            container.classList.add('tw-hidden');
            icon.textContent = 'visibility_off';
        }

        // REZA A LENDA: Sincronizar altura com o parent para evitar cortes do iframe
        if (iframe.contentWindow && typeof iframe.contentWindow.sendHeight === 'function') {
            setTimeout(() => iframe.contentWindow.sendHeight(), 10);
        }
    }
}

function alternarTela(tela) {
    if (document.getElementById('menu-principal')) document.getElementById('menu-principal').classList.remove('show-menu');
    if (document.getElementById('menu-periodo')) document.getElementById('menu-periodo').classList.remove('show-menu');
    if (tela === 'periodo') {
        if (document.getElementById('view-principal')) document.getElementById('view-principal').style.display = 'none';
        if (document.getElementById('view-cadastro')) document.getElementById('view-cadastro').style.display = 'none';
        if (document.getElementById('view-periodo')) document.getElementById('view-periodo').style.display = 'block';
        if (document.getElementById('fab-novo')) document.getElementById('fab-novo').style.display = 'none';
        aplicarFiltroPeriodo();
    } else if (tela === 'cadastro') {
        // [MOCKUP UI - MedPavilion SaaS] - Integração via iFrame (Mesma Aba)
        if (document.getElementById('view-principal')) document.getElementById('view-principal').style.display = 'none';
        if (document.getElementById('view-periodo')) document.getElementById('view-periodo').style.display = 'none';
        if (document.getElementById('view-cadastro')) document.getElementById('view-cadastro').style.display = 'block';
        if (document.getElementById('fab-novo')) document.getElementById('fab-novo').style.display = 'none';
        if (typeof fecharMenuSeMobile === 'function') fecharMenuSeMobile('menu-principal');
        carregarEstruturaHierarquica();
    } else {
        if (document.getElementById('view-periodo')) document.getElementById('view-periodo').style.display = 'none';
        if (document.getElementById('view-cadastro')) document.getElementById('view-cadastro').style.display = 'none';
        if (document.getElementById('view-principal')) document.getElementById('view-principal').style.display = 'block';
        if (document.getElementById('fab-novo')) document.getElementById('fab-novo').style.display = 'flex';
        aplicarFiltrosPrincipal();
    }
}

function processarClientesUnicos() { try { const map = new Map(); dadosGlobais.forEach(function (i) { if (isClient()) { if (i.nome_esp) map.set(i.nome_esp, { nome: i.nome_esp, cel: "" }); } else { if (i.cli) map.set(i.cli, { nome: i.cli, cel: i.cel_cli }); } }); listaClientesUnicos = Array.from(map.values()); } catch (e) { } }
function processarEspecialidadesUnicas() { try { const setSpec = new Set(); dadosGlobais.forEach(function (i) { if (i.especialidade && typeof i.especialidade === 'string' && i.especialidade.trim() !== "") { setSpec.add(i.especialidade.trim()); } }); listaEspecialidadesUnicas = Array.from(setSpec).sort(); } catch (e) { } }
function acionarFiltroManual() { desativarSinos(); aplicarFiltrosPrincipalDebounce(); }
function filtrarSugestoes(t) { desativarSinos(); aplicarFiltrosPrincipalDebounce(); const isMobile = window.innerWidth <= 768; const boxId = isMobile ? 'lista-sugestoes-mobile' : 'lista-sugestoes'; const b = document.getElementById(boxId); if (!b) return; b.innerHTML = ''; if (!t || t.length < 2) { b.style.display = 'none'; clienteSelecionadoCelular = null; let lblPc = document.getElementById('lbl-relatorio-pc'); if (lblPc) lblPc.style.display = 'none'; let lblMob = document.getElementById('lbl-relatorio-mobile'); if (lblMob) lblMob.style.display = 'none'; return; } const m = listaClientesUnicos.filter(function (c) { return c.nome.toLowerCase().includes(t.toLowerCase()); }).slice(0, 10); if (m.length > 0) { m.forEach(function (c) { const d = document.createElement('div'); d.className = 'suggestion-item'; d.innerHTML = '<span>' + escapeHtml(c.nome) + '</span>'; d.onclick = function () { selecionarCliente(c.nome); }; b.appendChild(d); }); b.style.display = 'block'; } else { b.style.display = 'none'; } }
function filtrarSugestoesEspecialidade(t) { desativarSinos(); aplicarFiltrosPrincipalDebounce(); const isMobile = window.innerWidth <= 768; const boxId = isMobile ? 'lista-sugestoes-especialidade-mobile' : 'lista-sugestoes-especialidade'; const b = document.getElementById(boxId); if (!b) return; b.innerHTML = ''; if (!t || t.length < 1) { b.style.display = 'none'; return; } const m = listaEspecialidadesUnicas.filter(function (s) { return String(s).toLowerCase().includes(t.toLowerCase()); }).slice(0, 10); if (m.length > 0) { m.forEach(function (s) { const d = document.createElement('div'); d.className = 'suggestion-item'; d.innerHTML = '<span>' + escapeHtml(s) + '</span>'; d.onclick = function () { selecionarEspecialidade(s); }; b.appendChild(d); }); b.style.display = 'block'; } else { b.style.display = 'none'; } }
function selecionarCliente(n) { const pc = document.getElementById('filtro-cliente'); if (pc) pc.value = n; const mob = document.getElementById('filtro-cliente-mobile'); if (mob) mob.value = n; if (document.getElementById('lista-sugestoes')) document.getElementById('lista-sugestoes').style.display = 'none'; const mobBox = document.getElementById('lista-sugestoes-mobile'); if (mobBox) mobBox.style.display = 'none'; let clienteEncontrado = listaClientesUnicos.find(function (c) { return c.nome === n; }); if (clienteEncontrado && !isClient()) { clienteSelecionadoCelular = clienteEncontrado.cel; let lblPc = document.getElementById('lbl-relatorio-pc'); if (lblPc) lblPc.style.display = 'inline-flex'; let lblMob = document.getElementById('lbl-relatorio-mobile'); if (lblMob) lblMob.style.display = 'inline-flex'; } else { clienteSelecionadoCelular = null; } acionarFiltroManual(); fecharMenuSeMobile('menu-principal'); }
function selecionarEspecialidade(n) { const pc = document.getElementById('filtro-especialidade'); if (pc) pc.value = n; const mob = document.getElementById('filtro-especialidade-mobile'); if (mob) mob.value = n; if (document.getElementById('lista-sugestoes-especialidade')) document.getElementById('lista-sugestoes-especialidade').style.display = 'none'; const mobBox = document.getElementById('lista-sugestoes-especialidade-mobile'); if (mobBox) mobBox.style.display = 'none'; acionarFiltroManual(); fecharMenuSeMobile('menu-principal'); }
function limparFiltroCliente() { if (document.getElementById('filtro-cliente')) document.getElementById('filtro-cliente').value = ""; const mob = document.getElementById('filtro-cliente-mobile'); if (mob) mob.value = ""; if (document.getElementById('lista-sugestoes')) document.getElementById('lista-sugestoes').style.display = 'none'; const mobBox = document.getElementById('lista-sugestoes-mobile'); if (mobBox) mobBox.style.display = 'none'; clienteSelecionadoCelular = null; let lblPc = document.getElementById('lbl-relatorio-pc'); if (lblPc) lblPc.style.display = 'none'; let lblMob = document.getElementById('lbl-relatorio-mobile'); if (lblMob) lblMob.style.display = 'none'; acionarFiltroManual(); }
function limparFiltroEspecialidade() { if (document.getElementById('filtro-especialidade')) document.getElementById('filtro-especialidade').value = ""; const mob = document.getElementById('filtro-especialidade-mobile'); if (mob) mob.value = ""; if (document.getElementById('lista-sugestoes-especialidade')) document.getElementById('lista-sugestoes-especialidade').style.display = 'none'; const mobBox = document.getElementById('lista-sugestoes-especialidade-mobile'); if (mobBox) mobBox.style.display = 'none'; acionarFiltroManual(); }
function sincronizarFiltros(origem) { if (origem === 'mobile') { if (document.getElementById('filtro-data') && document.getElementById('filtro-data-mobile')) document.getElementById('filtro-data').value = document.getElementById('filtro-data-mobile').value; if (document.getElementById('filtro-status') && document.getElementById('filtro-status-mobile')) document.getElementById('filtro-status').value = document.getElementById('filtro-status-mobile').value; } else { const mobDt = document.getElementById('filtro-data-mobile'); if (mobDt && document.getElementById('filtro-data')) mobDt.value = document.getElementById('filtro-data').value; const mobSt = document.getElementById('filtro-status-mobile'); if (mobSt && document.getElementById('filtro-status')) mobSt.value = document.getElementById('filtro-status').value; } acionarFiltroManual(); if (origem === 'mobile') fecharMenuSeMobile('menu-principal'); }
function atualizarPlaceholderData() { try { const input = document.getElementById('filtro-data-mobile'); const ph = document.getElementById('date-placeholder-mobile'); if (input && ph) { if (input.value) { ph.style.display = 'none'; input.classList.add('has-value'); } else { ph.style.display = 'block'; input.classList.remove('has-value'); } } } catch (e) { console.log("Aviso: Elementos de data mobile não encontrados.", e); } }
function toggleMobileMenu(id) { const el = document.getElementById(id); if (el) { el.classList.toggle('show-menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
function fecharMenuSeMobile(id) { if (window.innerWidth <= 768) { const el = document.getElementById(id); if (el) el.classList.remove('show-menu'); } }
function toggleTheme() { document.body.classList.toggle('dark-mode'); const icon = document.getElementById('icon-theme'); if (icon) icon.textContent = document.body.classList.contains('dark-mode') ? 'brightness_7' : 'brightness_6'; }
function toggleSenha() { const i = document.getElementById('login-senha'); const icon = document.querySelector('.toggle-pass'); if (!i) return; if (i.type === "password") { i.type = "text"; if (icon) icon.textContent = "visibility_off"; } else { i.type = "password"; if (icon) icon.textContent = "visibility"; } }
document.addEventListener('click', function (e) { if (!e.target.closest('#filtro-cliente-wrapper') && !e.target.closest('.input-busca-wrapper')) { const b = document.getElementById('lista-sugestoes'); if (b) b.style.display = 'none'; const mb = document.getElementById('lista-sugestoes-mobile'); if (mb) mb.style.display = 'none'; } if (!e.target.closest('#filtro-especialidade-wrapper') && !e.target.closest('.input-busca-wrapper')) { const b = document.getElementById('lista-sugestoes-especialidade'); if (b) b.style.display = 'none'; const mb = document.getElementById('lista-sugestoes-especialidade-mobile'); if (mb) mb.style.display = 'none'; } });

function verificarInputsPreenchidos() {
    try {
        const setStyle = function (id) { const el = document.getElementById(id); if (el) { if (el.value && el.value.trim() !== "") { el.classList.add('input-filled'); } else { el.classList.remove('input-filled'); } } };
        setStyle('filtro-data'); setStyle('filtro-status'); setStyle('filtro-cliente'); setStyle('filtro-especialidade'); setStyle('filtro-data-mobile'); setStyle('filtro-status-mobile'); setStyle('filtro-cliente-mobile'); setStyle('filtro-especialidade-mobile');
        const dateMob = document.getElementById('filtro-data-mobile'); const dateContainer = document.querySelector('.date-container');
        if (dateMob && dateContainer) { if (dateMob.value) dateContainer.classList.add('input-filled'); else dateContainer.classList.remove('input-filled'); }
        setStyle('filtro-periodo-select'); setStyle('filtro-status-periodo');
    } catch (e) { }
}

function atualizarEstiloSinos() {
    const btns = ['overdue', 'today', '24h', 'future', 'unread'];
    btns.forEach(b => {
        let el = document.getElementById('btn-alert-' + b);
        if (el) {
            if (filtroSinoAtivo === b) el.classList.add('active');
            else el.classList.remove('active');
        }
    });

    const mOver = document.getElementById('bell-overdue-mobile'); const mToday = document.getElementById('bell-today-mobile'); const mFuture = document.getElementById('bell-future-mobile'); const m24 = document.getElementById('bell-24h-mobile'); const mUnread = document.getElementById('alert-unread-mobile');
    if (mOver) {
        mOver.classList.remove('active-filter'); mToday.classList.remove('active-filter'); mFuture.classList.remove('active-filter'); m24.classList.remove('active-filter'); if (mUnread) mUnread.classList.remove('active-filter');
        if (filtroSinoAtivo === 'hoje') mToday.classList.add('active-filter'); if (filtroSinoAtivo === 'futuro') mFuture.classList.add('active-filter'); if (filtroSinoAtivo === 'vencido') mOver.classList.add('active-filter'); if (filtroSinoAtivo === '24h') m24.classList.add('active-filter'); if (filtroSinoAtivo === 'unread' && mUnread) mUnread.classList.add('active-filter');
    }
}

function atualizarSinos() {
    const agora = new Date(); const hojeStr = getHojeStr(); let cV = 0, cH = 0, cF = 0, c24 = 0, cUnread = 0;
    const amanhaObj = new Date(); amanhaObj.setDate(amanhaObj.getDate() + 1);
    const amanhaStr = amanhaObj.getFullYear() + "-" + String(amanhaObj.getMonth() + 1).padStart(2, '0') + "-" + String(amanhaObj.getDate()).padStart(2, '0');

    dadosGlobais.forEach(function (item) {
        if (item.status === 'Confirmado') {
            const itemData = String(item.data).substring(0, 10);
            const dtObj = parseDate(itemData, item.h_ini);
            if (dtObj) {
                const diffMs = dtObj - agora;
                const isHoje = (itemData === hojeStr);
                const isAmanha = (itemData === amanhaStr);
                if (diffMs < 0) { cV++; } else { if (isHoje) { cH++; } else if (isAmanha) { c24++; } else { cF++; } }
            }
        }
        if (!isClient() && item.obs_cliente && item.obs_cliente.trim() !== "" && item.visto_cli !== "Visto") { cUnread++; }
        if (isClient() && item.obs_para_cliente && item.obs_para_cliente.trim() !== "" && item.visto_p_cli !== "Visto") { cUnread++; }
    });

    const updateAlert = (id, count) => {
        const span = document.getElementById('bell-count-' + id);
        const btn = document.getElementById('btn-alert-' + id);
        if (span) span.textContent = count;
        if (btn) btn.style.display = (!isClient() && count > 0) ? 'flex' : 'none';
    }

    updateAlert('overdue', cV); updateAlert('today', cH); updateAlert('24h', c24); updateAlert('future', cF); updateAlert('unread', cUnread);

    const mOverC = document.getElementById('bell-count-overdue-mobile'); if (mOverC) mOverC.textContent = cV; const mOver = document.getElementById('bell-overdue-mobile'); if (mOver) mOver.style.display = (!isClient() && cV > 0) ? 'block' : 'none';
    const mTodayC = document.getElementById('bell-count-today-mobile'); if (mTodayC) mTodayC.textContent = cH; const mTodayB = document.getElementById('bell-today-mobile'); if (mTodayB) mTodayB.style.display = (!isClient() && cH > 0) ? 'block' : 'none';
    const mFutureC = document.getElementById('bell-count-future-mobile'); if (mFutureC) mFutureC.textContent = cF; const mFutureB = document.getElementById('bell-future-mobile'); if (mFutureB) mFutureB.style.display = (!isClient() && cF > 0) ? 'block' : 'none';
    const b24m = document.getElementById('bell-24h-mobile'); const count24m = document.getElementById('bell-count-24h-mobile'); if (b24m && count24m) { count24m.textContent = c24; b24m.style.display = (!isClient() && c24 > 0) ? 'block' : 'none'; if (c24 > 0) b24m.classList.add('bell-pulsing'); else b24m.classList.remove('bell-pulsing'); }
    const mUnreadC = document.getElementById('bell-count-unread-mobile'); if (mUnreadC) mUnreadC.textContent = cUnread; const mUnreadB = document.getElementById('alert-unread-mobile'); if (mUnreadB) mUnreadB.style.display = (!isClient() && cUnread > 0) ? 'block' : 'none';

    atualizarEstiloSinos();
}

function filtrarPorSino(tipo) {
    fecharMenuSeMobile('menu-principal');
    if (filtroSinoAtivo === tipo) { filtroSinoAtivo = null; } else {
        filtroSinoAtivo = tipo;
        if (document.getElementById('filtro-data')) document.getElementById('filtro-data').value = "";
        if (document.getElementById('filtro-status')) document.getElementById('filtro-status').value = "";
        if (document.getElementById('filtro-cliente')) document.getElementById('filtro-cliente').value = "";
        if (document.getElementById('filtro-especialidade')) document.getElementById('filtro-especialidade').value = "";

        const md = document.getElementById('filtro-data-mobile'); if (md) { md.value = ""; atualizarPlaceholderData(); }
        const ms = document.getElementById('filtro-status-mobile'); if (ms) ms.value = "";
        const mc = document.getElementById('filtro-cliente-mobile'); if (mc) mc.value = "";
        const me = document.getElementById('filtro-especialidade-mobile'); if (me) me.value = "";
    }
    atualizarEstiloSinos(); aplicarFiltrosPrincipal();
}

function limparFiltros() {
    filtroSinoAtivo = null; atualizarEstiloSinos();
    if (document.getElementById('filtro-data')) document.getElementById('filtro-data').value = "";
    if (document.getElementById('filtro-status')) document.getElementById('filtro-status').value = "";
    if (document.getElementById('filtro-cliente')) document.getElementById('filtro-cliente').value = "";
    if (document.getElementById('filtro-especialidade')) document.getElementById('filtro-especialidade').value = "";

    const md = document.getElementById('filtro-data-mobile'); if (md) { md.value = ""; atualizarPlaceholderData(); }
    const ms = document.getElementById('filtro-status-mobile'); if (ms) ms.value = "";
    const mc = document.getElementById('filtro-cliente-mobile'); if (mc) mc.value = "";
    const me = document.getElementById('filtro-especialidade-mobile'); if (me) me.value = "";
    aplicarFiltrosPrincipal();
}

function atualizarBadgeTotal(badgeId, rowId, label, valor, qtd, forceShow) {
    if (isClient()) return;
    const badgePC = document.getElementById(badgeId); const badgeMobile = document.getElementById(badgeId + '-mobile');
    if (forceShow) {
        const texto = label + valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + " (" + qtd + ")";
        if (badgePC) { const rowPC = document.getElementById(rowId); if (rowPC) rowPC.style.display = 'flex'; badgePC.textContent = texto; }
        if (badgeMobile) { badgeMobile.style.display = 'flex'; badgeMobile.textContent = texto; }
    } else {
        if (badgePC) { const rowPC = document.getElementById(rowId); if (rowPC) rowPC.style.display = 'none'; }
        if (badgeMobile) { badgeMobile.style.display = 'none'; }
    }
}
function desativarSinos() { if (filtroSinoAtivo !== null) { filtroSinoAtivo = null; atualizarEstiloSinos(); } }

// ==========================================
// CADASTRO GERAL: ESPECIALIDADES & SUBS
// ==========================================

async function carregarEspecialidades() {
    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'listar_especialidades_geral', // Rota segura do pool
            codigoempresa: userCodigoEmpresa     // Credencial multi-tenant
        });
        if (res.sucesso) {
            renderizarEspecialidades(res.dados);
            const selectPai = document.getElementById('sub-especialidade-pai');
            if (selectPai) {
                selectPai.innerHTML = '<option disabled selected value="">-- Selecione a Especialidade Pai --</option>';
                res.dados.forEach(e => {
                    selectPai.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
                });
                selectPai.onchange = (e) => carregarSubEspecialidades(e.target.value);
            }
            // Inicializa a UI do modal de Sub-especialidades com feedback:
            carregarSubEspecialidades(null);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao carregar especialidades:", e);
    }
}

function renderizarEspecialidades(dados) {
    const list = document.getElementById('lista-especialidades');
    if (!list) return;
    list.innerHTML = "";
    if (dados.length === 0) {
        list.innerHTML = "<p style='color: #666; font-size: 13px; text-align: center; padding: 20px;'>Nenhuma especialidade cadastrada.</p>";
        return;
    }
    dados.forEach(esp => {
        const div = document.createElement('div');
        div.innerHTML = `
<div class="item-especialidade tw-flex tw-items-center tw-justify-between tw-p-3 tw-bg-white tw-border tw-border-[#eee] tw-rounded-[8px] hover:tw-bg-[#eff6ff] tw-transition-all">
    <span class="nome-especialidade tw-text-sm tw-font-bold tw-text-on-surface">${escapeHtml(esp.nome)}</span>
    <div class="tw-flex tw-items-center tw-gap-3">
        <span class="tw-px-2 tw-py-0.5 tw-bg-green-50 tw-text-green-700 tw-text-[9px] tw-font-bold tw-rounded-full">ATIVO</span>
        <div class="tw-flex tw-gap-1">
            <button class="tw-p-1 tw-text-slate-400 hover:tw-text-primary tw-bg-transparent tw-border-none tw-cursor-pointer tw-transition-colors" 
                onclick="prepararEdicaoEspecialidade('${esp.id}', '${escapeHtml(esp.nome)}'); fecharModal('modal-nova-especialidade');" title="Editar">
                <span class="material-symbols-outlined" style="font-size: 18px;">edit</span>
            </button>
            <button class="tw-p-1 tw-text-slate-400 hover:tw-text-error tw-bg-transparent tw-border-none tw-cursor-pointer tw-transition-colors" 
                onclick="prepararExclusaoEspecialidade('${esp.id}', '${escapeHtml(esp.nome)}'); fecharModal('modal-nova-especialidade');" title="Excluir">
                <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
            </button>
        </div>
    </div>
</div>
`;
        list.appendChild(div);
    });
}

async function salvarEspecialidade() {
    // Busca input ID que atualizamos no index.html
    const inputNome = document.getElementById('especialidade-nome');
    if (!inputNome) return;
    const nome = inputNome.value.trim();
    if (!nome) return mostrarMensagem("Aviso", "Digite o nome da especialidade.");

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'salvar_especialidades',
            nome: nome
        });
        if (res.sucesso) {
            inputNome.value = "";
            if (typeof fecharModal === 'function') fecharModal('modal-nova-especialidade');
            mostrarMensagem("Sucesso", "Especialidade criada com o código: " + (res.dados?.codigo_especialidade || "Gerado pelo BD"));
            await carregarEspecialidades();
            await carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        mostrarMensagem("Erro", "Falha ao salvar especialidade.");
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

async function excluirEspecialidade(id) {
    mostrarConfirmacao("Excluir Especialidade", "Deseja realmente excluir esta especialidade? Todas as sub-especialidades vinculadas também serão removidas.", async () => {
        try {
            const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
                acao: 'excluir_especialidades',
                id: id
            });
            if (res.sucesso) {
                await carregarEspecialidades();
                await carregarEstruturaHierarquica();
            }
        } catch (e) {
            if (e.message === "SESSION_EXPIRED") return;
            mostrarMensagem("Erro", "Falha ao excluir especialidade.");
        }
    });
}

async function carregarSubEspecialidades(espId) {
    const list = document.getElementById('lista-sub-especialidades');
    if (!espId) {
        if (list) list.innerHTML = "<p style='color: #666; font-size: 13px; text-align: center; padding: 20px;'>👆 Selecione uma Especialidade Relacionada acima para listar.</p>";
        return;
    }
    if (list) list.innerHTML = "<p style='color: #1a73e8; font-size: 13px; text-align: center; padding: 20px; font-weight: bold;'>⌛ Carregando...</p>";

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'listar_sub_especialidades', // Rota segura do pool
            especialidade_id: espId,
            codigoempresa: userCodigoEmpresa   // Credencial multi-tenant
        });
        if (res.sucesso) {
            renderizarSubEspecialidades(res.dados);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao carregar sub-especialidades:", e);
    }
}

function renderizarSubEspecialidades(dados) {
    const list = document.getElementById('lista-sub-especialidades');
    if (!list) return;
    list.innerHTML = "";

    if (dados.length === 0) {
        list.innerHTML = "<p style='color: #666; font-size: 13px; text-align: center; padding: 20px;'>Nenhuma sub-especialidade cadastrada.</p>";
        return;
    }

    dados.forEach(item => {
        const div = document.createElement('div');
        div.innerHTML = `
<div class="item-sub-especialidade tw-flex tw-items-center tw-justify-between tw-p-3 tw-bg-[#eff6ff]/30 tw-border tw-border-[#eee] tw-rounded-md tw-group tw-transition-all tw-duration-200 hover:tw-bg-[#eff6ff] hover:tw-border-[#bae6fd]">
    <div class="tw-flex tw-flex-col">
        <span class="nome-sub-especialidade tw-text-sm tw-font-medium tw-text-on-surface">${escapeHtml(item.nome)}</span>
        <div class="tw-flex tw-items-center tw-gap-2 tw-mt-1">
            <span class="tw-px-2 tw-py-0.5 tw-rounded-full tw-text-[9px] tw-font-bold tw-uppercase tw-bg-secondary-container/50 tw-text-on-secondary-container">Ativo</span>
        </div>
    </div>
    <div class="tw-flex tw-gap-1">
        <button class="tw-p-1.5 tw-text-on-surface-variant hover:tw-text-primary hover:tw-bg-white tw-rounded-md tw-transition-colors tw-bg-transparent tw-border-0 tw-cursor-pointer" 
            onclick="prepararEdicaoSubEspecialidade('${item.id}', '${escapeHtml(item.nome)}'); fecharModal('modal-nova-subespecialidade');" title="Editar">
            <span class="material-symbols-outlined tw-text-[18px]">edit</span>
        </button>
        <button class="tw-p-1.5 tw-text-on-surface-variant hover:tw-text-error hover:tw-bg-white tw-rounded-md tw-transition-colors tw-bg-transparent tw-border-0 tw-cursor-pointer" 
            onclick="prepararExclusaoSubEspecialidade('${item.id}', '${escapeHtml(item.nome)}'); fecharModal('modal-nova-subespecialidade');" title="Excluir">
            <span class="material-symbols-outlined tw-text-[18px]">delete</span>
        </button>
    </div>
</div>
`;
        list.appendChild(div);
    });
}

async function salvarSubEspecialidade() {
    // Fallback: Tenta os dois ids (o antigo caso exista e o novo que injetamos)
    const espPai = document.getElementById('sub-especialidade-pai') || document.getElementById('select-pai-especialidade');
    const inputNome = document.getElementById('sub-especialidade-nome') || document.getElementById('nova-sub-especialidade');

    if (!espPai || !inputNome) return;

    const espId = espPai.value;
    const nome = inputNome.value.trim();
    const infoGeral = (document.getElementById('sub-info-geral') || {}).value || "";
    const infoCliente = (document.getElementById('sub-info-cliente') || {}).value || "";

    if (!espId) return mostrarMensagem("Aviso", "Selecione a especialidade pai.");
    if (!nome) return mostrarMensagem("Aviso", "Digite o nome da sub-especialidade.");

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'salvar_sub_especialidades',
            especialidade_id: espId,
            nome: nome,
            info_geral: infoGeral,
            info_cliente: infoCliente
        });
        if (res.sucesso) {
            inputNome.value = "";
            const elInfoGeral = document.getElementById('sub-info-geral');
            const elInfoCliente = document.getElementById('sub-info-cliente');
            if (elInfoGeral) elInfoGeral.value = "";
            if (elInfoCliente) elInfoCliente.value = "";
            if (typeof fecharModal === 'function') fecharModal('modal-nova-subespecialidade');
            mostrarMensagem("Sucesso", "Sub-especialidade criada com o código: " + (res.dados?.codigo_sub_especialidade || "Gerado pelo BD"));
            await carregarSubEspecialidades(espId);
            await carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        mostrarMensagem("Erro", "Falha ao salvar sub-especialidade.");
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

async function excluirSubEspecialidade(id) {
    const espId = document.getElementById('sub-especialidade-pai').value;
    mostrarConfirmacao("Excluir Sub-Especialidade", "Deseja realmente excluir esta sub-especialidade?", async () => {
        try {
            const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
                acao: 'excluir_sub_especialidades',
                id: id
            });
            if (res.sucesso) {
                await carregarSubEspecialidades(espId);
                await carregarEstruturaHierarquica();
            }
        } catch (e) {
            if (e.message === "SESSION_EXPIRED") return;
            mostrarMensagem("Erro", "Falha ao excluir sub-especialidade.");
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function filtrarListaSubEspecialidades() {
    const termo = (document.getElementById('busca-sub-especialidade').value || "").toLowerCase().trim();
    const items = document.querySelectorAll('.item-sub-especialidade');

    items.forEach(item => {
        const nome = (item.querySelector('.nome-sub-especialidade').textContent || "").toLowerCase();
        if (nome.includes(termo)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function prepararEdicaoSubEspecialidade(id, nome, espId) {
    const hiddenId = document.getElementById('edit-sub-especialidade-id');
    const inputNome = document.getElementById('edit-sub-especialidade-nome');
    const selectPai = document.getElementById('edit-sub-especialidade-pai') || document.getElementById('sub-especialidade-pai');

    if (hiddenId) hiddenId.value = id;
    if (inputNome) inputNome.value = nome;
    if (selectPai && espId) selectPai.value = espId;

    if (typeof abrirModal === 'function') abrirModal('modal-editar-subespecialidade');
}

async function prepararNovoSubEspecialidade(espId, espNome) {
    console.log("🛠️ [SUB] Preparando nova sub para:", espNome);
    const selPai = document.getElementById('sub-especialidade-pai');

    // Se o select estiver vazio (apenas placeholder), recarrega as especialidades
    if (selPai && selPai.options.length <= 1) {
        await carregarEspecialidades();
    }

    if (selPai) {
        selPai.value = espId;
        // [SINCRONIA] Força repintura e atualização dos listeners do onChange
        await Promise.resolve();
        selPai.dispatchEvent(new Event('change'));
    }

    // [SINCRONIA] Carrega as subs cadastradas para o container lateral
    if (typeof carregarSubEspecialidades === 'function') {
        await carregarSubEspecialidades(espId);
    }

    abrirModal('modal-nova-subespecialidade');
}

function prepararExclusaoSubEspecialidade(id, nome) {
    const hiddenId = document.getElementById('excluir-sub-especialidade-id');
    const displayNome = document.getElementById('excluir-sub-especialidade-nome-display');
    if (hiddenId) hiddenId.value = id;
    if (displayNome) displayNome.textContent = nome;
    if (typeof abrirModal === 'function') abrirModal('modal-excluir-subespecialidade');
}

async function atualizarSubEspecialidade() {
    const id = document.getElementById('edit-sub-especialidade-id')?.value;
    const nome = document.getElementById('edit-sub-especialidade-nome')?.value.trim();
    const espId = document.getElementById('sub-especialidade-pai')?.value;

    if (!nome) return mostrarMensagem("Aviso", "O nome não pode ser vazio.");

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'salvar_sub_especialidades',
            id: id,
            nome: nome,
            especialidade_id: espId,
            codigoempresa: userCodigoEmpresa
        });
        if (res.sucesso) {
            fecharModal('modal-editar-subespecialidade');
            mostrarMensagem("Sucesso", "Sub-especialidade atualizada.");
            await carregarSubEspecialidades(espId);
            await carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao atualizar sub-especialidade:", e);
        mostrarMensagem("Erro", "Falha ao atualizar.");
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

async function confirmarExclusaoSubEspecialidade() {
    const id = document.getElementById('excluir-sub-especialidade-id')?.value;
    const espId = document.getElementById('sub-especialidade-pai')?.value;

    if (!id) return;

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'excluir_sub_especialidades',
            id: id,
            codigoempresa: userCodigoEmpresa
        });
        if (res.sucesso) {
            fecharModal('modal-excluir-subespecialidade');
            await carregarSubEspecialidades(espId);
            await carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao excluir sub-especialidade:", e);
        mostrarMensagem("Erro", "Falha ao excluir.");
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

function filtrarListaEspecialidades() {
    const termo = (document.getElementById('busca-especialidade').value || "").toLowerCase().trim();
    const items = document.querySelectorAll('.item-especialidade');

    items.forEach(item => {
        const nome = (item.querySelector('.nome-especialidade').textContent || "").toLowerCase();
        if (nome.includes(termo)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function prepararEdicaoEspecialidade(id, nome) {
    const hiddenId = document.getElementById('edit-especialidade-id');
    const inputNome = document.getElementById('edit-especialidade-nome');
    if (hiddenId) hiddenId.value = id;
    if (inputNome) inputNome.value = nome;
    if (typeof abrirModal === 'function') abrirModal('modal-editar-especialidade');
}

function prepararExclusaoEspecialidade(id, nome) {
    const hiddenId = document.getElementById('excluir-especialidade-id');
    const displayNome = document.getElementById('excluir-especialidade-nome-display');
    if (hiddenId) hiddenId.value = id;
    if (displayNome) displayNome.textContent = nome;
    if (typeof abrirModal === 'function') abrirModal('modal-excluir-especialidade');
}

async function atualizarEspecialidade() {
    const id = document.getElementById('edit-especialidade-id')?.value;
    const nome = document.getElementById('edit-especialidade-nome')?.value.trim();

    if (!nome) return mostrarMensagem("Aviso", "O nome não pode ser vazio.");

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'salvar_especialidades',
            id: id,
            nome: nome,
            codigoempresa: userCodigoEmpresa
        });
        if (res.sucesso) {
            fecharModal('modal-editar-especialidade');
            mostrarMensagem("Sucesso", "Especialidade atualizada com sucesso.");
            await carregarEspecialidades();
            await carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao atualizar especialidade:", e);
        mostrarMensagem("Erro", "Falha ao atualizar.");
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

async function confirmarExclusaoEspecialidade() {
    const id = document.getElementById('excluir-especialidade-id')?.value;
    if (!id) return;

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'excluir_especialidades',
            id: id,
            codigoempresa: userCodigoEmpresa
        });
        if (res.sucesso) {
            fecharModal('modal-excluir-especialidade');
            mostrarMensagem("Sucesso", "Especialidade removida.");
            await carregarEspecialidades();
            await carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao excluir especialidade:", e);
        mostrarMensagem("Erro", "Falha ao excluir.");
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

/**
 * Funções de Preparação para CRUD de Produtos (SaaS)
 */
async function carregarProdutosNoModal(subId) {
    console.log("📂 [PRODUTO] Carregando lista dinâmica para SubId:", subId);
    const container = document.getElementById('lista-produtos-dinamica');
    if (!container) return;

    container.innerHTML = `
        <div class="tw-p-8 tw-text-center">
            <div class="tw-inline-block tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-4 tw-border-primary/20 tw-border-t-primary tw-mb-4"></div>
            <div class="tw-text-slate-500 tw-text-sm">Buscando produtos vinculados...</div>
        </div>
    `;

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'listar_produtos',
            subespecialidade: subId,
            codigoempresa: userCodigoEmpresa
        });

        if (res.sucesso && res.dados) {
            // Garante que res.dados seja um array para evitar erros de loop
            const lista = Array.isArray(res.dados) ? res.dados : [];

            if (lista.length === 0) {
                container.innerHTML = `
                    <div class="tw-p-10 tw-text-center tw-bg-slate-50 tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200">
                        <span class="material-symbols-outlined tw-text-slate-300 tw-mb-2" style="font-size: 40px;">inventory_2</span>
                        <div class="tw-text-slate-400 tw-text-sm tw-italic">Nenhum Produto ainda cadastrado</div>
                    </div>
                `;
                return;
            }

            let html = '';
            lista.forEach(p => {
                const domNomeProduto = typeof escapeHtml === 'function' ? escapeHtml(p.nome_produto || "") : (p.nome_produto || "");
                const paramNomeProduto = domNomeProduto.replace(/'/g, "\\'");

                const valorRealNum = parseFloat(p.valor_real || 0);
                const valorReal = isNaN(valorRealNum) ? "R$ 0,00" : valorRealNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                const valorPromoNum = p.valor_promo ? parseFloat(p.valor_promo) : null;
                const valorPromo = (valorPromoNum !== null && !isNaN(valorPromoNum)) ? valorPromoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;

                const statusClass = p.status === 'active' ? 'tw-bg-green-50 tw-text-green-700' : 'tw-bg-slate-100 tw-text-slate-500';
                const statusTexto = p.status === 'active' ? 'ATIVO' : 'INATIVO';

                html += `
                <div class="tw-bg-white tw-border tw-border-slate-100 tw-rounded-xl tw-p-4 tw-flex tw-items-center tw-justify-between hover:tw-border-primary/30 tw-transition-all tw-group">
                    <div class="tw-flex tw-items-center tw-gap-4">
                        <div class="tw-w-10 tw-h-10 tw-rounded-lg tw-bg-slate-50 tw-flex tw-items-center tw-justify-center tw-text-primary group-hover:tw-bg-primary/10">
                            <span class="material-symbols-outlined" style="font-size: 20px;">medical_services</span>
                        </div>
                        <div>
                            <div class="tw-text-sm tw-font-bold tw-text-slate-900">${domNomeProduto}</div>
                            <div class="tw-text-[10px] tw-text-slate-400 tw-font-mono tw-mt-0.5">ID: ${p.id}</div>
                        </div>
                    </div>

                    <div class="tw-flex tw-items-center tw-gap-6">
                        <div class="tw-text-right">
                            <div class="tw-text-xs tw-font-bold tw-text-slate-900">${valorReal}</div>
                            ${valorPromo ? `<div class="tw-text-[10px] tw-text-primary tw-font-bold">${valorPromo} (Promo)</div>` : ''}
                        </div>
                        
                        <div class="tw-hidden md:tw-block">
                             <span class="tw-px-2 tw-py-0.5 ${statusClass} tw-text-[9px] tw-font-bold tw-rounded-full">${statusTexto}</span>
                        </div>

                        <div class="tw-flex tw-items-center tw-gap-4">
                            <button onclick="fecharModal('modal-novo-produto'); prepararEdicaoProduto('${p.id}')" class="tw-bg-transparent tw-border-none tw-cursor-pointer hover:tw-opacity-80 tw-transition-all tw-p-0">
                                <span class="material-symbols-outlined tw-text-primary" style="font-size: 18px;">border_color</span>
                            </button>
                            <button onclick="fecharModal('modal-novo-produto'); prepararExclusaoProduto('${p.id}', '${paramNomeProduto}')" class="tw-bg-transparent tw-border-none tw-cursor-pointer hover:tw-opacity-80 tw-transition-all tw-p-0">
                                <span class="material-symbols-outlined tw-text-error tw-text-[24px]">delete</span>
                            </button>
                        </div>
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="tw-p-8 tw-text-center tw-text-error tw-text-sm">Erro ao carregar produtos.</div>';
        }
    } catch (e) {
        console.error("Erro no fetch de produtos:", e);
        container.innerHTML = '<div class="tw-p-8 tw-text-center tw-text-error tw-text-sm">Erro de conexão.</div>';
    }
}
function prepararNovoProduto(subId, subNome, espId, espNome) {
    console.log("🛠️ [PRODUTO] Preparando novo produto para:", subNome);

    // Salva UUID do payload invisível na memória (Higienizando anterior)
    delete window._currentNovoProdutoSubId;
    window._currentNovoProdutoSubId = subId;

    // [CONTEXTO ESTATICO] Injeta crachás visuais superiores (Substitui Select de formulario)
    const labelContexto = document.getElementById('novo-produto-contexto-especialidade');
    if (labelContexto) labelContexto.innerHTML = "<span class='tw-px-3 tw-py-1 tw-bg-blue-50 tw-text-primary tw-rounded-full tw-text-xs tw-font-bold'>Especialidade: " + (espNome || "N/D") + "</span>";

    const labelContextoSub = document.getElementById('novo-produto-contexto-sub-especialidade');
    if (labelContextoSub) labelContextoSub.innerHTML = "<span class='tw-px-3 tw-py-1 tw-bg-purple-50 tw-text-purple-700 tw-rounded-full tw-text-xs tw-font-bold'>Sub Especialidade: " + (subNome || "N/D") + "</span>";

    // Carrega a lista lateral de produtos para este subId
    carregarProdutosNoModal(subId);

    abrirModal('modal-novo-produto');
}

async function prepararEdicaoProduto(id) {
    console.log("🛠️ [PRODUTO] Preparando edição do ID:", id);
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'buscar_produto',
            codigoProduto: id,
            codigoempresa: userCodigoEmpresa
        });

        if (res.sucesso && res.completa) {
            const p = res.completa;
            // Preenchimento dos campos do modal de edição
            const fields = {
                'editar-produto-id': p.id,
                'editar-produto-nome': p.nome_produto,
                'editar-produto-duracao': p.duracao_trabalho,
                'editar-produto-valor-real': p.valor_real,
                'editar-produto-valor-promo': p.valor_promo,
                'editar-produto-status': p.status,
                'editar-produto-tipo': p.forma_atendimento,
                'editar-produto-info': p.info_do_produto,
                'editar-produto-orientacao': p.orientacao_cliente,
                'editar-produto-local': p.local_atendimento
            };

            for (let idField in fields) {
                const el = document.getElementById(idField);
                if (el) el.value = fields[idField] || "";
            }

            // Substituição Visual: Injeção de Tags de Contexto dinâmicas 
            const labelContexto = document.getElementById('editar-produto-contexto-especialidade');
            if (labelContexto) labelContexto.innerHTML = "<span class='tw-px-3 tw-py-1 tw-bg-blue-50 tw-text-primary tw-rounded-full tw-text-xs tw-font-bold'>Especialidade: " + (escapeHtml(p.especialidade) || "N/D") + "</span>";

            const labelContextoSub = document.getElementById('editar-produto-contexto-sub-especialidade');
            if (labelContextoSub) {
                const snome = p.nome_sub_especialidade || p.subespecialidade_nome || p.sub_especialidade || "N/A";
                labelContextoSub.innerHTML = "<span class='tw-px-3 tw-py-1 tw-bg-purple-50 tw-text-purple-700 tw-rounded-full tw-text-xs tw-font-bold'>Sub Especialidade: " + escapeHtml(snome) + "</span>";
            }

            // [SINCRONIA] Garante que o ID da sub-especialidade seja mapeado corretamente para o POST invisível
            const inputSubId = document.getElementById('editar-produto-sub-id');
            if (inputSubId) {
                inputSubId.value = p.sub_especialidade || p.id_sub_especialidade || "";
            }

            abrirModal('modal-editar-produto');
        } else {
            mostrarMensagem("Erro", "Produto não encontrado para edição.");
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao buscar produto:", e);
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

function prepararExclusaoProduto(id, nome) {
    const hiddenId = document.getElementById('excluir-produto-id');
    const displayNome = document.getElementById('excluir-produto-nome-display');

    if (hiddenId) hiddenId.value = id;
    if (displayNome) displayNome.textContent = nome;

    abrirModal('modal-excluir-produto');
}

/**
 * CRUD de Produtos: Salvar, Editar e Excluir
 */
async function salvarNovoProduto() {
    console.log("💾 [PRODUTO] Salvando novo produto...");

    const subId = window._currentNovoProdutoSubId || "";
    const nome = document.getElementById('novo-produto-nome') ? document.getElementById('novo-produto-nome').value : "";

    // Validação UX (Padrão 12 do .cursorrules)
    const inputsRequeridos = [
        { id: 'novo-produto-nome', val: nome, valid: (v) => v.trim() !== "" }
    ];

    // Limpa bordas de erro
    for (let campo of inputsRequeridos) {
        const el = document.getElementById(campo.id);
        if (el) el.classList.remove('tw-border-error', 'tw-ring-error/20');
    }

    // Checa campo a campo
    for (let campo of inputsRequeridos) {
        if (!campo.valid(campo.val)) {
            const el = document.getElementById(campo.id);
            if (el) {
                el.classList.add('tw-border-error', 'tw-ring-error/20');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return; // Bloqueia propagação silenciosamente guiando o UX
        }
    }

    const dados = {
        id_sub_especialidade: subId,
        nome_produto: nome,
        duracao_trabalho: document.getElementById('novo-produto-duracao') ? document.getElementById('novo-produto-duracao').value : "",
        valor_real: document.getElementById('novo-produto-valor-real') ? document.getElementById('novo-produto-valor-real').value : "",
        valor_promo: document.getElementById('novo-produto-valor-promo') ? document.getElementById('novo-produto-valor-promo').value : "",
        status: document.getElementById('novo-produto-status') ? document.getElementById('novo-produto-status').value : "active",
        forma_atendimento: document.getElementById('novo-produto-tipo') ? document.getElementById('novo-produto-tipo').value : "presencial",
        local_atendimento: document.getElementById('novo-produto-local') ? document.getElementById('novo-produto-local').value : "",
        codigoempresa: userCodigoEmpresa
    };

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'criar_produto',
            ...dados
        });

        if (res.sucesso) {
            fecharModal('modal-novo-produto');
            mostrarMensagem("Sucesso", "Produto cadastrado com sucesso!");
            carregarProdutosNoModal(dados.subespecialidade);
            carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao salvar produto:", e);
        mostrarMensagem("Erro Crítico", "A requisição falhou no sistema: " + e.message);
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

async function salvarEdicaoProduto() {
    console.log("💾 [PRODUTO] Salvando alterações do produto...");

    const id = document.getElementById('editar-produto-id').value;
    const dados = {
        subespecialidade: document.getElementById('editar-produto-sub-id') ? document.getElementById('editar-produto-sub-id').value : "",
        nome_produto: document.getElementById('editar-produto-nome') ? document.getElementById('editar-produto-nome').value : "",
        duracao_trabalho: document.getElementById('editar-produto-duracao') ? document.getElementById('editar-produto-duracao').value : "",
        valor_real: document.getElementById('editar-produto-valor-real') ? document.getElementById('editar-produto-valor-real').value : "",
        valor_promo: document.getElementById('editar-produto-valor-promo') ? document.getElementById('editar-produto-valor-promo').value : "",
        status: document.getElementById('editar-produto-status') ? document.getElementById('editar-produto-status').value : "active",
        forma_atendimento: document.getElementById('editar-produto-tipo') ? document.getElementById('editar-produto-tipo').value : "presencial",
        info_do_produto: document.getElementById('editar-produto-info') ? document.getElementById('editar-produto-info').value : "",
        orientacao_cliente: document.getElementById('editar-produto-orientacao') ? document.getElementById('editar-produto-orientacao').value : "",
        local_atendimento: document.getElementById('editar-produto-local') ? document.getElementById('editar-produto-local').value : "",
        codigoempresa: userCodigoEmpresa
    };

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'atualizar_produto',
            id: id,
            ...dados
        });

        if (res.sucesso) {
            fecharModal('modal-editar-produto');
            mostrarMensagem("Sucesso", "Produto atualizado com sucesso!");
            // Tenta recarregar a lista se houver um ID de sub ativo (poderia ser armazenado globalmente)
            carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao atualizar produto:", e);
        mostrarMensagem("Erro Crítico", "A requisição falhou no sistema: " + e.message);
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

async function confirmarExclusaoProduto() {
    const id = document.getElementById('excluir-produto-id').value;
    if (!id) return;

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'excluir_produto',
            codigoProduto: id,
            codigoempresa: userCodigoEmpresa
        });

        if (res.sucesso) {
            fecharModal('modal-excluir-produto');
            mostrarMensagem("Sucesso", "Produto excluído!");
            carregarEstruturaHierarquica();
        } else {
            mostrarMensagem("Erro", "Falha: " + res.erro);
        }
    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("Erro ao excluir produto:", e);
        mostrarMensagem("Erro Crítico", "A requisição falhou no sistema: " + e.message);
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

// --- CRUD DE ESPECIALISTAS (MODAL-BASED) ---

/**
 * Busca a lista de especialistas e renderiza a tabela no Iframe de Cadastro Geral.
 */
async function carregarEspecialistas() {
    if (!userCodigoEmpresa) userCodigoEmpresa = localStorage.getItem('appAgendaUserCodigoEmpresa') || "";
    console.log("👥 [ESPECIALISTAS] Carregando corpo clínico...");

    const iframe = document.querySelector('iframe[src*="tela_cadastro_mockup"]');
    if (!iframe) return;

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'listar_especialistas',
            codigoempresa: userCodigoEmpresa
        });

        if (!res.sucesso) {
            console.error("❌ [ESPECIALISTAS] Erro ao listar:", res.erro);
            return;
        }

        const especialistas = res.especialistas || [];
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const tbody = doc.querySelector('#content-2 table tbody');
        if (!tbody) return;

        if (especialistas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="tw-px-6 tw-py-10 tw-text-center tw-text-slate-400 tw-italic">Nenhum especialista cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = especialistas.map(esp => {
            const subs = Array.isArray(esp.sub_especialidades) ? esp.sub_especialidades :
                (typeof esp.sub_especialidades === 'string' ? esp.sub_especialidades.split(',').map(s => s.trim()).filter(Boolean) : []);

            return `
            <tr class="hover:tw-bg-[#eff6ff]/50 tw-transition-colors">
                <td class="tw-px-6 tw-py-4">
                    <div class="tw-flex tw-items-center tw-gap-3">
                        <div class="tw-w-10 tw-h-10 tw-rounded-full tw-bg-primary/10 tw-flex tw-items-center tw-justify-center tw-text-primary">
                            <span class="material-symbols-outlined">person</span>
                        </div>
                        <div>
                            <p class="tw-font-bold tw-text-on-surface tw-text-sm">${escapeHtml(esp.nome)}</p>
                            <p class="tw-text-[10px] tw-font-mono tw-text-outline tw-uppercase">${escapeHtml(esp.codigo_especialista || '---')}</p>
                        </div>
                    </div>
                </td>
                <td class="tw-px-6 tw-py-4">
                    <p class="tw-text-xs tw-font-medium tw-text-on-surface-variant">${escapeHtml(esp.celular || '---')}</p>
                    <p class="tw-text-[11px] tw-text-outline">${escapeHtml(esp.email || '---')}</p>
                </td>
                <td class="tw-px-6 tw-py-4">
                    <div class="tw-flex tw-flex-wrap tw-gap-1">
                        ${subs.length > 0 ? subs.map(s => `
                            <span class="tw-px-2 tw-py-0.5 tw-bg-[#eff6ff] tw-text-primary tw-text-[10px] tw-font-bold tw-rounded">${escapeHtml(s)}</span>
                        `).join('') : '<span class="tw-text-[10px] tw-text-slate-400 tw-italic">Atendimento Geral</span>'}
                    </div>
                </td>
                <td class="tw-px-6 tw-py-4 tw-text-right">
                    <div class="tw-flex tw-justify-end tw-gap-2">
                        <button onclick="window.parent.prepararEdicaoEspecialista('${esp.id}')" 
                            class="tw-w-8 tw-h-8 tw-rounded-lg tw-bg-primary/10 tw-text-primary hover:tw-bg-primary hover:tw-text-white tw-transition-all tw-border-none tw-cursor-pointer tw-flex tw-items-center tw-justify-center" title="Gerenciar Especialista">
                            <span class="material-symbols-outlined tw-text-lg">settings</span>
                        </button>
                        <button onclick="window.parent.prepararExclusaoEspecialista('${esp.id}', '${escapeHtml(esp.nome)}')" 
                            class="tw-w-8 tw-h-8 tw-rounded-lg tw-bg-error/10 tw-text-error hover:tw-bg-error hover:tw-text-white tw-transition-all tw-border-none tw-cursor-pointer tw-flex tw-items-center tw-justify-center" title="Excluir Especialista">
                            <span class="material-symbols-outlined tw-text-lg">delete</span>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch (e) {
        if (e.message === "SESSION_EXPIRED") return;
        console.error("❌ [ESPECIALISTAS] Falha na renderização:", e);
    }
}

/**
 * Limpa e abre o modal de criação de especialista.
 */
async function abrirModalNovoEspecialista() {
    const modal = window.top.document.getElementById('modal-novo-especialista');
    if (!modal) return;

    const topDoc = window.top.document;

    // Reset do form
    topDoc.getElementById('novo-especialista-nome').value = '';
    topDoc.getElementById('novo-especialista-email').value = '';
    topDoc.getElementById('novo-especialista-celular').value = '';
    const infoGeral = topDoc.getElementById('novo-especialista-info-geral');
    if (infoGeral) infoGeral.value = '';

    // Reset toggles
    const chkAdmin = topDoc.getElementById('novo-especialista-admin');
    const chkSil = topDoc.getElementById('novo-especialista-silenciar');
    const chkAtivo = topDoc.getElementById('novo-especialista-ativo');
    if (chkAdmin) chkAdmin.checked = false;
    if (chkSil) chkSil.checked = false;
    if (chkAtivo) chkAtivo.checked = true;

    // RBAC — exibe toggles Administrador/Ativo apenas para admins
    const isAdmin = typeof tipoUsuarioAtual !== 'undefined' && tipoUsuarioAtual.toLowerCase() === 'admim';
    const wAdmin = topDoc.getElementById('wrapper-novo-admin');
    const wAtivo = topDoc.getElementById('wrapper-novo-ativo');
    if (wAdmin) wAdmin.style.display = isAdmin ? '' : 'none';
    if (wAtivo) wAtivo.style.display = isAdmin ? '' : 'none';

    // Limpa tags
    const tagContainer = topDoc.getElementById('novo-especialista-tags');
    if (tagContainer) tagContainer.innerHTML = '';
    window._tagsEspecialistaPendente = [];

    // Carrega seletores encadeados
    await carregarEspecialidadesNoModal('novo');

    modal.style.display = 'flex';
}

/**
 * Salva um novo especialista via API.
 */
async function salvarNovoEspecialista() {
    const nome = window.top.document.getElementById('novo-especialista-nome').value.trim();
    const email = window.top.document.getElementById('novo-especialista-email').value.trim();
    const celular = window.top.document.getElementById('novo-especialista-celular').value.trim();

    if (!nome) return mostrarMensagem("Aviso", "O nome do especialista é obrigatório.");

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'salvar_especialista',
            codigoempresa: userCodigoEmpresa,
            nome,
            email,
            celular,
            sub_especialidades: window._tagsEspecialistaPendente || [],
            admin: !!window.top.document.getElementById('novo-especialista-admin')?.checked,
            silenciar_notificacao: !!window.top.document.getElementById('novo-especialista-silenciar')?.checked,
            ativo: !!window.top.document.getElementById('novo-especialista-ativo')?.checked,
            info_geral: (window.top.document.getElementById('novo-especialista-info-geral')?.value || '').trim()
        });

        if (res.sucesso) {
            if (window.top.document.getElementById('modal-novo-especialista'))
                window.top.document.getElementById('modal-novo-especialista').style.display = 'none';
            mostrarMensagem("Sucesso", "Especialista criado! Código gerado: " + (res.novoCodigo || ""));
            await carregarEspecialistas();
        } else {
            mostrarMensagem("Erro", res.erro || "Falha ao salvar especialista.");
        }
    } catch (e) {
        if (e.message !== "SESSION_EXPIRED") console.error(e);
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

/**
 * Busca dados e abre o modal de edição.
 */
async function prepararEdicaoEspecialista(id) {
    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'buscar_especialista',
            id: id,
            codigoempresa: userCodigoEmpresa
        });

        if (!res.sucesso) {
            mostrarMensagem("Erro", "Especialista não encontrado.");
            return;
        }

        const esp = res.especialista;
        const modal = window.top.document.getElementById('modal-editar-especialista');
        if (!modal) return;

        const topDoc = window.top.document;

        topDoc.getElementById('editar-especialista-id').value = esp.id;
        topDoc.getElementById('editar-especialista-nome').value = esp.nome;
        topDoc.getElementById('editar-especialista-email').value = esp.email || '';
        topDoc.getElementById('editar-especialista-celular').value = esp.celular || '';
        topDoc.getElementById('editar-especialista-codigo').value = esp.codigo_especialista || '';
        const infoGeral = topDoc.getElementById('editar-especialista-info-geral');
        if (infoGeral) infoGeral.value = esp.info_geral || '';

        // Toggles
        const chkAdmin = topDoc.getElementById('editar-especialista-admin');
        const chkSil = topDoc.getElementById('editar-especialista-silenciar');
        const chkAtivo = topDoc.getElementById('editar-especialista-ativo');
        if (chkAdmin) chkAdmin.checked = !!esp.admin;
        if (chkSil) chkSil.checked = !!esp.silenciar_notificacao;
        if (chkAtivo) chkAtivo.checked = esp.ativo !== false;

        // RBAC — exibe toggles Administrador/Ativo apenas para admins
        const isAdmin = typeof tipoUsuarioAtual !== 'undefined' && tipoUsuarioAtual.toLowerCase() === 'admim';
        const wAdmin = topDoc.getElementById('wrapper-editar-admin');
        const wAtivo = topDoc.getElementById('wrapper-editar-ativo');
        if (wAdmin) wAdmin.style.display = isAdmin ? '' : 'none';
        if (wAtivo) wAtivo.style.display = isAdmin ? '' : 'none';

        // Renderiza tags existentes
        window._tagsEspecialistaEdicao = Array.isArray(esp.sub_especialidades)
            ? esp.sub_especialidades
            : (esp.sub_especialidades ? esp.sub_especialidades.split(',').map(s => s.trim()).filter(Boolean) : []);
        renderizarTagsEspecialista('editar');

        // Carrega seletores encadeados
        await carregarEspecialidadesNoModal('editar');

        modal.style.display = 'flex';
    } catch (e) {
        if (e.message !== "SESSION_EXPIRED") console.error(e);
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

/**
 * Salva alterações de um especialista existente.
 */
async function salvarEdicaoEspecialista() {
    const id = window.top.document.getElementById('editar-especialista-id').value;
    const nome = window.top.document.getElementById('editar-especialista-nome').value.trim();
    const email = window.top.document.getElementById('editar-especialista-email').value.trim();
    const celular = window.top.document.getElementById('editar-especialista-celular').value.trim();
    const codigo = window.top.document.getElementById('editar-especialista-codigo').value.trim();

    if (!nome || !id) return mostrarMensagem("Aviso", "Nome é obrigatório.");

    if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'salvar_especialista',
            id,
            codigoempresa: userCodigoEmpresa,
            nome,
            email,
            celular,
            codigo_especialista: codigo,
            sub_especialidades: window._tagsEspecialistaEdicao || [],
            admin: !!window.top.document.getElementById('editar-especialista-admin')?.checked,
            silenciar_notificacao: !!window.top.document.getElementById('editar-especialista-silenciar')?.checked,
            ativo: !!window.top.document.getElementById('editar-especialista-ativo')?.checked,
            info_geral: (window.top.document.getElementById('editar-especialista-info-geral')?.value || '').trim()
        });

        if (res.sucesso) {
            if (window.top.document.getElementById('modal-editar-especialista'))
                window.top.document.getElementById('modal-editar-especialista').style.display = 'none';
            await carregarEspecialistas();
        } else {
            mostrarMensagem("Erro", res.erro || "Falha ao atualizar especialista.");
        }
    } catch (e) {
        if (e.message !== "SESSION_EXPIRED") console.error(e);
    } finally {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
}

/**
 * Executa o Soft Delete via API.
 */
async function prepararExclusaoEspecialista(id, nome) {
    mostrarConfirmacao("Excluir Especialista", `Deseja remover "${nome}"? O registro será mantido historicamente mas não aparecerá em novos agendamentos.`, async function () {
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
        try {
            const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
                acao: 'excluir_especialista',
                id: id,
                codigoempresa: userCodigoEmpresa
            });
            if (res.sucesso) {
                await carregarEspecialistas();
            } else {
                mostrarMensagem("Erro", res.erro || "Falha ao excluir.");
            }
        } catch (e) {
            if (e.message !== "SESSION_EXPIRED") console.error(e);
        } finally {
            if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
        }
    });
}

/**
 * Carrega Especialidades no select do modal (primeiro nível do encadeamento).
 */
async function carregarEspecialidadesNoModal(tipo) {
    const selectId = tipo === 'novo' ? 'novo-especialista-especialidade' : 'editar-especialista-especialidade';
    const subSelectId = tipo === 'novo' ? 'novo-especialista-sub-especialidade' : 'editar-especialista-sub-especialidade';
    const topDoc = window.top.document;
    const sel = topDoc.getElementById(selectId);
    const subSel = topDoc.getElementById(subSelectId);
    if (!sel) return;

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'listar_especialidades_geral',
            codigoempresa: userCodigoEmpresa
        });
        if (res.sucesso && res.dados && res.dados.length > 0) {
            sel.innerHTML = '<option value="">Selecione a Especialidade...</option>' +
                res.dados.map(e => `<option value="${e.id}">${escapeHtml(e.nome)}</option>`).join('');
        } else {
            sel.innerHTML = '<option value="">Nenhuma especialidade cadastrada</option>';
        }
        if (subSel) subSel.innerHTML = '<option value="">Selecione a Especialidade primeiro</option>';
    } catch (e) {
        if (e.message !== 'SESSION_EXPIRED') console.error('❌ [LOAD ESPECIALIDADES MODAL]:', e);
        if (sel) sel.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

/**
 * Chamado no onchange do select de Especialidade — carrega Sub-Especialidades filtradas.
 */
async function onChangeEspecialidadeModal(tipo) {
    const selectId = tipo === 'novo' ? 'novo-especialista-especialidade' : 'editar-especialista-especialidade';
    const subSelectId = tipo === 'novo' ? 'novo-especialista-sub-especialidade' : 'editar-especialista-sub-especialidade';
    const topDoc = window.top.document;
    const sel = topDoc.getElementById(selectId);
    const subSel = topDoc.getElementById(subSelectId);
    if (!sel || !subSel) return;

    const especialidadeId = sel.value;
    if (!especialidadeId) {
        subSel.innerHTML = '<option value="">Selecione a Especialidade primeiro</option>';
        return;
    }

    subSel.innerHTML = '<option value="">Carregando...</option>';

    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'listar_sub_especialidades_v2',
            codigoempresa: userCodigoEmpresa,
            especialidade_id: especialidadeId
        });
        if (res.sucesso && res.dados && res.dados.length > 0) {
            subSel.innerHTML = '<option value="">Selecione a Sub-Especialidade...</option>' +
                res.dados.map(s => `<option value="${escapeHtml(s.nome)}">${escapeHtml(s.nome)}</option>`).join('');
        } else {
            subSel.innerHTML = '<option value="">Nenhuma sub-especialidade encontrada</option>';
        }
    } catch (e) {
        if (e.message !== 'SESSION_EXPIRED') console.error('❌ [LOAD SUB-ESP MODAL]:', e);
        subSel.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

/**
 * Chamado no onchange do select de Sub-Especialidade — adiciona a tag automaticamente.
 */
function selecionarSubEspecialidadeTag(tipo) {
    const subSelectId = tipo === 'novo' ? 'novo-especialista-sub-especialidade' : 'editar-especialista-sub-especialidade';
    const topDoc = window.top.document;
    const subSel = topDoc.getElementById(subSelectId);
    if (!subSel) return;

    const nome = subSel.value;
    if (!nome) return;

    if (tipo === 'novo') {
        if (!window._tagsEspecialistaPendente) window._tagsEspecialistaPendente = [];
        if (!window._tagsEspecialistaPendente.includes(nome)) window._tagsEspecialistaPendente.push(nome);
    } else {
        if (!window._tagsEspecialistaEdicao) window._tagsEspecialistaEdicao = [];
        if (!window._tagsEspecialistaEdicao.includes(nome)) window._tagsEspecialistaEdicao.push(nome);
    }

    // Reset to prompt after selection
    subSel.value = '';
    renderizarTagsEspecialista(tipo);
}

/**
 * Carrega e cacheia sub-especialidades do backend para o typeahead (Regra 19).
 */
async function carregarSubEspecialidadesParaTags() {
    try {
        const res = await ApiClient.post('/functions/v1/gerenciar-agendamentos', {
            acao: 'listar_sub_especialidades',
            codigoempresa: userCodigoEmpresa
        });
        window._listaGlobalSubEspecialidades = (res.sucesso && res.dados) ? res.dados : [];
    } catch (e) {
        if (e.message !== 'SESSION_EXPIRED') console.error('❌ [TAGS SUB-ESP CACHE]:', e);
        window._listaGlobalSubEspecialidades = [];
    }
}

/**
 * Typeahead: filtra e exibe sugestões conforme o usuário digita.
 */
function filtrarSugestoesTag(tipo) {
    const inputId = tipo === 'novo' ? 'novo-especialista-input-tag' : 'editar-especialista-input-tag';
    const dropdownId = tipo === 'novo' ? 'novo-especialista-sugestoes-tags' : 'editar-especialista-sugestoes-tags';
    const topDoc = window.top.document;
    const input = topDoc.getElementById(inputId);
    const dropdown = topDoc.getElementById(dropdownId);
    if (!input || !dropdown) return;

    const query = input.value.trim().toLowerCase();

    if (!query) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
    }

    const lista = window._listaGlobalSubEspecialidades || [];
    const filtradas = lista.filter(s => s.nome && s.nome.toLowerCase().includes(query));

    if (filtradas.length === 0) {
        dropdown.innerHTML = '<div class="tw-px-4 tw-py-2 tw-text-sm tw-text-slate-400">Nenhum resultado encontrado</div>';
    } else {
        dropdown.innerHTML = filtradas.map(s => `
            <div class="tw-px-4 tw-py-2 tw-text-sm tw-text-slate-700 tw-cursor-pointer hover:tw-bg-[#eff6ff] hover:tw-text-primary tw-transition-colors tw-border-b tw-border-[#f5f5f5] last:tw-border-0"
                onmousedown="selecionarSugestaoTag('${tipo}', '${escapeHtml(s.nome).replace(/'/g, "\\'")}')">
                ${escapeHtml(s.nome)}
            </div>
        `).join('');
    }

    dropdown.style.display = 'block';
}

/**
 * Chamado ao clicar em uma sugestão — adiciona a tag direto sem precisar do botão +.
 */
function selecionarSugestaoTag(tipo, nome) {
    if (!nome) return;

    if (tipo === 'novo') {
        if (!window._tagsEspecialistaPendente) window._tagsEspecialistaPendente = [];
        if (!window._tagsEspecialistaPendente.includes(nome)) window._tagsEspecialistaPendente.push(nome);
    } else {
        if (!window._tagsEspecialistaEdicao) window._tagsEspecialistaEdicao = [];
        if (!window._tagsEspecialistaEdicao.includes(nome)) window._tagsEspecialistaEdicao.push(nome);
    }

    const topDoc = window.top.document;
    const inputId = tipo === 'novo' ? 'novo-especialista-input-tag' : 'editar-especialista-input-tag';
    const dropdownId = tipo === 'novo' ? 'novo-especialista-sugestoes-tags' : 'editar-especialista-sugestoes-tags';
    const input = topDoc.getElementById(inputId);
    const dropdown = topDoc.getElementById(dropdownId);
    if (input) input.value = '';
    if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }

    renderizarTagsEspecialista(tipo);
}

// Fecha dropdowns ao clicar fora (registrado no top-document uma vez)
if (!window._especialistaClickOutsideRegistered) {
    window._especialistaClickOutsideRegistered = true;
    (window.top.document || document).addEventListener('click', (e) => {
        const topDoc = window.top.document;
        ['novo', 'editar'].forEach(tipo => {
            const inputId = tipo === 'novo' ? 'novo-especialista-input-tag' : 'editar-especialista-input-tag';
            const dropdownId = tipo === 'novo' ? 'novo-especialista-sugestoes-tags' : 'editar-especialista-sugestoes-tags';
            const input = topDoc.getElementById(inputId);
            const dropdown = topDoc.getElementById(dropdownId);
            if (!dropdown) return;
            if (input && (input.contains(e.target) || dropdown.contains(e.target))) return;
            dropdown.style.display = 'none';
        });
    });
}

/**
 * Gerencia a adição manual de tags via botão "+" (texto digitado no input).
 */
function addTagEspecialista(tipo) {
    const inputId = tipo === 'novo' ? 'novo-especialista-input-tag' : 'editar-especialista-input-tag';
    const dropdownId = tipo === 'novo' ? 'novo-especialista-sugestoes-tags' : 'editar-especialista-sugestoes-tags';
    const topDoc = window.top.document;
    const el = topDoc.getElementById(inputId);
    const dropdown = topDoc.getElementById(dropdownId);
    const val = el ? el.value.trim() : '';
    if (!val) return;

    if (tipo === 'novo') {
        if (!window._tagsEspecialistaPendente) window._tagsEspecialistaPendente = [];
        if (!window._tagsEspecialistaPendente.includes(val)) window._tagsEspecialistaPendente.push(val);
    } else {
        if (!window._tagsEspecialistaEdicao) window._tagsEspecialistaEdicao = [];
        if (!window._tagsEspecialistaEdicao.includes(val)) window._tagsEspecialistaEdicao.push(val);
    }

    if (el) el.value = '';
    if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
    renderizarTagsEspecialista(tipo);
}

function renderizarTagsEspecialista(tipo) {
    const list = tipo === 'novo' ? window._tagsEspecialistaPendente : window._tagsEspecialistaEdicao;
    const containerId = tipo === 'novo' ? 'novo-especialista-tags' : 'editar-especialista-tags';
    const container = window.top.document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = (list || []).map((t, idx) => `
        <span class="tw-inline-flex tw-items-center tw-gap-1 tw-bg-[#eff6ff] tw-text-primary tw-px-2 tw-py-0.5 tw-rounded tw-text-xs tw-font-bold">
            ${escapeHtml(t)}
            <button type="button" onclick="removeTagEspecialista('${tipo}', ${idx})" 
                class="material-symbols-outlined tw-text-xs tw-bg-transparent tw-border-none tw-p-0 tw-cursor-pointer">close</button>
        </span>
    `).join('');
}

function removeTagEspecialista(tipo, idx) {
    if (tipo === 'novo') window._tagsEspecialistaPendente.splice(idx, 1);
    else window._tagsEspecialistaEdicao.splice(idx, 1);
    renderizarTagsEspecialista(tipo);
}
