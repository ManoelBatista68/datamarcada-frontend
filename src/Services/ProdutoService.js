/**
 * ProdutoService.gs
 * Serviço responsável por buscar produtos catalogados na aba Principal com cache de 6 horas.
 */

function buscarProduto(codigoBuscado, codigoempresaAlvo) {
    try {
        if (!codigoBuscado) {
            return { sucesso: false, erro: "Nenhum código de produto fornecido." };
        }

        const cache = CacheService.getScriptCache();
        const CACHE_KEY_HEADERS = 'cache_cabecalhos_v3';
        const CACHE_KEY_MAPMap = 'cache_mapa_linhas_v3';

        let headersJson = cache.get(CACHE_KEY_HEADERS);
        let mapaJson = cache.get(CACHE_KEY_MAPMap);

        let headers = null;
        let mapaLinhas = null;
        let idxCodProduto = -1;

        // Se o cache expirou ou não existe, vamos construir o mapa de índices
        if (!headersJson || !mapaJson) {
            const ss = SpreadsheetApp.openById(PLANILHA_ID);
            const sheetPrin = ss.getSheetByName(NOME_ABA_PRINCIPAL);

            if (!sheetPrin) return { sucesso: false, erro: "Aba Principal não encontrada." };

            const dadosPrin = sheetPrin.getDataRange().getDisplayValues();
            if (dadosPrin.length <= 1) return { sucesso: false, erro: "Aba Principal vazia." };

            headers = dadosPrin[0].map(h => String(h).trim());

            let idxCodProduto = -1;
            let idxEmpresa = -1;

            // Localiza a coluna que identifica o COD_PRODUTO e a EMPRESA
            for (let c = 0; c < headers.length; c++) {
                let h = headers[c].toLowerCase();
                if (h === 'cod_produto') {
                    idxCodProduto = c;
                }
                if (h === 'codigoempresa' || h === 'codigo_empresa') {
                    idxEmpresa = c;
                }
            }

            // Se não achou literais obrigatórios, avisa erro 
            if (idxCodProduto === -1) {
                return { sucesso: false, erro: "Coluna 'COD_PRODUTO' não encontrada no cabeçalho." };
            }
            if (idxEmpresa === -1) {
                return { sucesso: false, erro: "Coluna 'codigoempresa' não encontrada no cabeçalho." };
            }

            mapaLinhas = {};

            // Mapeia onde está cada código usando chave composta
            for (let i = 1; i < dadosPrin.length; i++) {
                const row = dadosPrin[i];
                const isEmpty = row.every(val => String(val || "").trim() === "");
                if (isEmpty) continue;

                // Multi-tenant chave composta: EMPRESA_PRODUTO
                // Trata a empresa para evitar conflitos de Sheets (ex: ler 23 ao invés de 23.0)
                let codEmpresaRaw = String(row[idxEmpresa] || "").trim().split('.')[0].toUpperCase();
                let codLinha = String(row[idxCodProduto] || "").trim().toUpperCase();

                if (codLinha && codEmpresaRaw) {
                    const chaveComposta = codEmpresaRaw + '_' + codLinha;
                    // Arrays em js são 0-indexed, Google Sheets range é 1-indexed. i = 1 é a linha 2.
                    mapaLinhas[chaveComposta] = i + 1;
                }
            }

            // Salva no cache
            cache.put(CACHE_KEY_HEADERS, JSON.stringify(headers), 21600);
            cache.put(CACHE_KEY_MAPMap, JSON.stringify({
                mapa: mapaLinhas,
                idxCod: idxCodProduto
            }), 21600);

        } else {
            // Se já estava no cache, recupera
            headers = JSON.parse(headersJson);
            let payloadMapa = JSON.parse(mapaJson);
            mapaLinhas = payloadMapa.mapa;
            idxCodProduto = payloadMapa.idxCod;
        }

        // Com o mapa pronto (da memória ou da planilha), busca em milissegundos a O(1)
        const codigoFiltrado = String(codigoBuscado).trim().toUpperCase();

        // Tratamento de segurança contra decimais também no payload Json da requisição
        const codigoempresaFiltrado = String(codigoempresaAlvo).trim().split('.')[0].toUpperCase();
        const chaveBusca = codigoempresaFiltrado + '_' + codigoFiltrado;

        console.log('Buscando Produto Multitenant - Chave Buscada:', chaveBusca);

        if (!mapaLinhas[chaveBusca]) {
            console.log('Mapa de chaves atual (Slice 0/5):', Object.keys(mapaLinhas).slice(0, 5));
            return { sucesso: false, erro: "Produto não encontrado na lista." };
        }

        // Sabe qual linha está o produto, lê apenas aquela linha
        const linhaExata = mapaLinhas[chaveBusca];
        const ss = SpreadsheetApp.openById(PLANILHA_ID);
        const sheetPrin = ss.getSheetByName(NOME_ABA_PRINCIPAL);

        // Leitura única e cirúrgica na linha exata
        const linhaValores = sheetPrin.getRange(linhaExata, 1, 1, headers.length).getValues()[0];

        // Constrói o OBJ completo
        const produtoEncontrado = {};
        for (let c = 0; c < headers.length; c++) {
            let key = headers[c] || ("Coluna_" + c);
            produtoEncontrado[key] = String(linhaValores[c] || "").trim();
        }

        // Função helper para extrair valor com case-insensitive fallback na chave
        function extrairValor(obj, nomeChaveEsperada) {
            const keyMatch = Object.keys(obj).find(k => k.toLowerCase() === nomeChaveEsperada.toLowerCase());
            return keyMatch ? obj[keyMatch] : "";
        }

        // Constrói a estrutura obrigatória da resposta
        const resultadoMontado = {
            sucesso: true,
            minima: {
                codigoProduto: extrairValor(produtoEncontrado, 'COD_PRODUTO'),
                valorReal: extrairValor(produtoEncontrado, 'VALOR_REAL'),
                valorProm: extrairValor(produtoEncontrado, 'VALOR_PROM'),
                subEspecialidade: extrairValor(produtoEncontrado, 'SUB_ESPECIALIDADE'),
                especialista: extrairValor(produtoEncontrado, 'ESPECIALISTAS'),
                celularEspecialista: extrairValor(produtoEncontrado, 'CELULAR_ESPECIALISTA'),
                localAtendimento: extrairValor(produtoEncontrado, 'LOCAL_ATENDIMENTO'),
                formaAtendimento: extrairValor(produtoEncontrado, 'FORMA_ATENDIMENTO')
            },
            completa: produtoEncontrado
        };

        return resultadoMontado;

    } catch (e) {
        return { sucesso: false, erro: "Erro ao buscar produto: " + e.toString() };
    }
}
