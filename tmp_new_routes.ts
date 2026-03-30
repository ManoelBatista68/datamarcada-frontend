        case 'salvar_especialista': {
    try {
        const { id, nome, email, celular, sub_especialidades, codigoempresa,
            admin, silenciar_notificacao, ativo, info_geral } = payload;

        if (!nome || !codigoempresa) throw new Error("Nome e codigoempresa sao obrigatorios.");

        const adminVal = Boolean(admin);
        const silVal = Boolean(silenciar_notificacao);
        const infoVal = info_geral || null;
        const subEsp = Array.isArray(sub_especialidades) ? sub_especialidades : [];
        const now = new Date().toISOString();

        if (id) {
            // EDICAO: UPDATE com raw SQL via pool (bypass RLS)
            const ativoVal = typeof ativo !== 'undefined' ? Boolean(ativo) : true;
            await connection.queryObject<any>({
                text: `
                  UPDATE especialistas
                  SET nome = $1, email = $2, celular = $3,
                      sub_especialidades = $4, admin = $5,
                      silenciar_notificacao = $6, info_geral = $7,
                      ativo = $8, updated_at = $9
                  WHERE id = $10 AND codigoempresa = $11
                `,
                args: [
                    nome, email || null, celular || null,
                    JSON.stringify(subEsp), adminVal,
                    silVal, infoVal,
                    ativoVal, now,
                    id, codigoempresa
                ]
            });
            return responderJSON({ sucesso: true, mensagem: "Especialista atualizado com sucesso." });

        } else {
            // CRIACAO: busca ultimo codigo EP via pool e insere com raw SQL (bypass RLS)
            const lastRes = await connection.queryObject<any>({
                text: `
                  SELECT codigo_especialista FROM especialistas
                  WHERE codigoempresa = $1 AND codigo_especialista LIKE 'EP%'
                  ORDER BY codigo_especialista DESC LIMIT 1
                `,
                args: [codigoempresa]
            });

            let nextNum = 1;
            if (lastRes.rows && lastRes.rows.length > 0) {
                const match = (lastRes.rows[0].codigo_especialista as string).match(/\d+/);
                if (match) nextNum = parseInt(match[0]) + 1;
            }
            const novoCodigo = `EP${String(nextNum).padStart(2, '0')}`;
            const ativoVal = typeof ativo !== 'undefined' ? Boolean(ativo) : true;

            const ins = await connection.queryObject<any>({
                text: `
                  INSERT INTO especialistas
                    (nome, email, celular, sub_especialidades, admin,
                     silenciar_notificacao, info_geral, ativo,
                     codigo_especialista, codigoempresa, created_at, updated_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                  RETURNING *
                `,
                args: [
                    nome, email || null, celular || null,
                    JSON.stringify(subEsp), adminVal,
                    silVal, infoVal, ativoVal,
                    novoCodigo, codigoempresa, now, now
                ]
            });

            const criado = ins.rows?.[0] ?? null;
            return responderJSON({ sucesso: true, mensagem: "Especialista criado com sucesso.", dados: criado, novoCodigo });
        }
    } catch (e: any) {
        console.error("[ERRO SALVAR ESPECIALISTA]:", e.message);
        return responderJSON({ sucesso: false, erro: e.message }, 200);
    }
}

        // ROTA 32 - EXCLUIR ESPECIALISTA (SOFT DELETE via raw SQL - REGRA 17)
        case 'excluir_especialista': {
    try {
        const { id, codigoempresa } = payload;
        if (!id || !codigoempresa) throw new Error("ID e codigoempresa sao obrigatorios.");

        await connection.queryObject<any>({
            text: `
                UPDATE especialistas
                SET ativo = false, updated_at = $1
                WHERE id = $2 AND codigoempresa = $3
              `,
            args: [new Date().toISOString(), id, codigoempresa]
        });

        return responderJSON({ sucesso: true, mensagem: "Especialista removido (soft-delete) com sucesso." });
    } catch (e: any) {
        console.error("[ERRO EXCLUIR ESPECIALISTA]:", e.message);
        return responderJSON({ sucesso: false, erro: e.message }, 200);
    }
}
