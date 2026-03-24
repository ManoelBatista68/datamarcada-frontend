function verificarLogin(email, senha) {
  try {
    const sheet = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(NOME_ABA_TEMPORARIO);
    if (!sheet) return { erro: "Base não encontrada." };
    const dados = sheet.getDataRange().getDisplayValues();
    const emailLogin = email.toLowerCase().trim();
    const senhaLogin = senha.toString().trim(); 
    for (let i = 1; i < dados.length; i++) {
      if (dados[i].length <= 4) continue;
      if (dados[i][4].toString().toLowerCase().trim() === emailLogin && dados[i][5].toString().trim() === senhaLogin) {
        return { sucesso: true, nome: dados[i][2], email: emailLogin, tipoUsuario: dados[i][6] };
      }
    }
    return { erro: "E-mail ou senha incorretos." };
  } catch(e) { return { erro: "Erro login: " + e.toString() }; }
}

function enviarCodigoRecuperacao(email) {
  try {
    const sheet = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(NOME_ABA_TEMPORARIO);
    const dados = sheet.getDataRange().getValues();
    const emailBusca = email.toLowerCase().trim();
    let encontrado = false;
    for (let i = 1; i < dados.length; i++) { if (dados[i][4] && dados[i][4].toString().toLowerCase().trim() === emailBusca) { encontrado = true; break; } }
    if (!encontrado) return { sucesso: false, erro: "O e-mail não está cadastrado na base." };
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    CacheService.getScriptCache().put('recup_' + emailBusca, codigo, 900); 
    MailApp.sendEmail({ to: emailBusca, subject: "Código - Minha Agenda", htmlBody: "<h3>Recuperação de Senha</h3><p>Seu código é: <b>" + codigo + "</b></p>" });
    return { sucesso: true };
  } catch(e) { return { sucesso: false, erro: "Erro permissão e-mail." }; }
}

function redefinirSenhaComCodigo(email, codigo, novaSenha) {
  try {
    const emailBusca = email.toLowerCase().trim();
    const codigoSalvo = CacheService.getScriptCache().get('recup_' + emailBusca);
    if (!codigoSalvo || codigoSalvo !== codigo.toString().trim()) return { sucesso: false, erro: "Código inválido." };
    const sheet = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(NOME_ABA_TEMPORARIO);
    const dados = sheet.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][4] && dados[i][4].toString().toLowerCase().trim() === emailBusca) {
        sheet.getRange(i + 1, 6).setValue(novaSenha); 
        CacheService.getScriptCache().remove('recup_' + emailBusca);
        return { sucesso: true };
      }
    }
    return { sucesso: false, erro: "Erro ao atualizar senha." };
  } catch(e) { return { sucesso: false, erro: e.toString() }; }
}

function trocarSenhaUsuario(u,n) { return {sucesso:true}; }
