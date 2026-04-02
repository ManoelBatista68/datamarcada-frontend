// js/components/CardProduto.js
// Renderiza o card de um produto dentro da grade de uma sub-especialidade.

function renderCardProduto(prod) {
    const icone = prod.forma_atendimento === 'On-Line' ? 'videocam' : 'ecg';
    const preco = prod.valor_prom || prod.valor_real;
    return `
    <div class="tw-bg-white tw-p-5 tw-rounded-xl tw-shadow-sm tw-border tw-border-outline-variant/10 hover:tw-border-secondary/30 hover:tw-shadow-lg tw-transition-all tw-group">
        <div class="tw-flex tw-justify-between tw-items-start tw-mb-4">
            <div class="tw-p-2 tw-rounded-lg tw-bg-surface-container-low tw-text-primary">
                <span class="material-symbols-outlined">${icone}</span>
            </div>
            <div class="tw-flex tw-gap-1 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity">
                <button onclick="window.parent.prepararEdicaoProduto('${prod.id}')"
                    class="tw-p-1.5 hover:tw-bg-slate-100 tw-rounded tw-text-slate-400 hover:tw-text-primary tw-transition-colors tw-border-none tw-bg-transparent tw-cursor-pointer">
                    <span class="material-symbols-outlined tw-text-xl">settings</span>
                </button>
                <button onclick="window.parent.prepararExclusaoProduto('${prod.id}', '${escapeHtml(prod.nome_produto).replace(/'/g, "\\'")}')"
                    class="tw-p-1.5 hover:tw-bg-error-container tw-rounded tw-text-slate-400 hover:tw-text-error tw-transition-colors tw-border-none tw-bg-transparent tw-cursor-pointer">
                    <span class="material-symbols-outlined tw-text-xl">delete</span>
                </button>
            </div>
        </div>
        <h5 class="tw-font-bold tw-text-on-surface tw-mb-1 tw-text-base">${escapeHtml(prod.nome_produto)}</h5>
        <div class="tw-flex tw-items-center tw-justify-between tw-mt-4 tw-pt-4 tw-border-t tw-border-outline-variant/10">
            <div>
                <span class="tw-text-xs tw-text-outline tw-font-medium tw-block tw-uppercase">Preço</span>
                <span class="tw-text-primary tw-font-extrabold">R$ ${preco}</span>
            </div>
            <div class="tw-text-right">
                <span class="tw-text-xs tw-text-outline tw-font-medium tw-block tw-uppercase">Tipo</span>
                <span class="tw-text-on-surface tw-text-sm tw-font-semibold">${escapeHtml(prod.forma_atendimento)}</span>
            </div>
        </div>
    </div>`;
}

function renderGradeProdutosVazia() {
    return `<div class="tw-col-span-full tw-p-4 tw-text-center tw-text-slate-400 tw-text-xs tw-italic tw-border tw-border-dashed tw-border-slate-100 tw-rounded-lg">Nenhum produto cadastrado neste nível.</div>`;
}
