function salvarJanelaInteracao(email, dias) {
  try {
    PropertiesService.getScriptProperties().setProperty('janela_' + email.toLowerCase().trim(), dias.toString());
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function salvarFavorito(email, nomeModelo, dadosJson) { try { const userProps = PropertiesService.getUserProperties(); const chave = "fav_" + email.toLowerCase().trim(); let favoritos = {}; const atual = userProps.getProperty(chave); if(atual) favoritos = JSON.parse(atual); favoritos[nomeModelo] = dadosJson; userProps.setProperty(chave, JSON.stringify(favoritos)); return { success: true }; } catch(e) { return { success: false, error: e.toString() }; } }
function listarFavoritos(email) { try { const userProps = PropertiesService.getUserProperties(); const chave = "fav_" + email.toLowerCase().trim(); const atual = userProps.getProperty(chave); return { success: true, dados: atual ? JSON.parse(atual) : {} }; } catch(e) { return { success: false, error: e.toString() }; } }
function excluirFavorito(email, nomeModelo) { try { const userProps = PropertiesService.getUserProperties(); const chave = "fav_" + email.toLowerCase().trim(); let favoritos = {}; const atual = userProps.getProperty(chave); if(atual) favoritos = JSON.parse(atual); if(favoritos[nomeModelo]) { delete favoritos[nomeModelo]; userProps.setProperty(chave, JSON.stringify(favoritos)); } return { success: true }; } catch(e) { return { success: false, error: e.toString() }; } }
