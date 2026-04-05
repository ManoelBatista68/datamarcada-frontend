// js/components/CardSubEspecialidade.js
// Renderiza o card de uma sub-especialidade com seu accordion de produtos.

function renderCardSubEspecialidade(sub, espId, espNome, produtos) {
    const subContainerId = `prod-sub-${sub.id}`;
    const subIconId = `icon-sub-${sub.id}`;
    const nomeEsp = escapeHtml(espNome).replace(/'/g, "\\'");
    const nomeSub = escapeHtml(sub.nome).replace(/'/g, "\\'");

    const gridProdutos = produtos.length > 0
        ? produtos.map(renderCardProduto).join('')
        : renderGradeProdutosVazia();

    return `
    <div class="tw-space-y-4">
        <div class="tw-bg-white tw-flex tw-items-center tw-justify-between tw-p-3 md:tw-p-5 tw-rounded-xl tw-shadow-sm tw-border-l-4 tw-border-blue-500 tw-border-y tw-border-r tw-border-slate-100">
            <div class="tw-flex tw-items-center tw-gap-2">
                <span class="material-symbols-outlined tw-text-outline tw-shrink-0">subdirectory_arrow_right</span>
                <h4 class="tw-font-bold tw-text-on-surface-variant tw-text-sm md:tw-text-base">
                    ${escapeHtml(sub.nome)}
                    <span class="material-symbols-outlined tw-text-xl tw-text-slate-400 hover:tw-text-primary tw-ml-2 tw-cursor-pointer tw-transition-colors" title="Editar Sub"
                        onclick="window.parent.prepararEdicaoSubEspecialidade('${sub.id}', '${nomeSub}', '${espId}')">settings</span>
                </h4>
            </div>
            <div class="tw-flex tw-items-center tw-gap-1 md:tw-gap-3 tw-shrink-0">
                <button onclick="window.parent.prepararNovoProduto('${sub.id}', '${nomeSub}', '${espId}', '${nomeEsp}')"
                    class="tw-h-[36px] tw-rounded-lg tw-text-sm tw-font-bold tw-flex tw-items-center tw-gap-1 tw-px-2 md:tw-px-4 tw-bg-primary tw-text-white hover:tw-bg-blue-700 tw-transition-colors tw-border-none tw-cursor-pointer">
                    <span class="material-symbols-outlined tw-text-lg">add</span>
                    <span class="tw-hidden sm:tw-inline">Novo Produto</span>
                </button>
                <div class="tw-h-8 tw-w-[1px] tw-bg-outline-variant/30"></div>
                <button type="button" onclick="window.parent.toggleHierarquia('${subContainerId}', '${subIconId}')"
                    class="tw-p-2 tw-rounded-lg tw-text-outline hover:tw-text-primary hover:tw-bg-primary-fixed/30 tw-transition-all tw-flex tw-items-center tw-justify-center tw-w-10 tw-h-10 tw-border-none tw-bg-transparent tw-cursor-pointer" title="Expandir/Recolher">
                    <span id="${subIconId}" class="material-symbols-outlined tw-text-2xl">visibility_off</span>
                </button>
            </div>
        </div>
        <div id="${subContainerId}" class="tw-hidden tw-grid tw-grid-cols-1 md:tw-grid-cols-2 xl:tw-grid-cols-3 tw-gap-6 tw-transition-all">
            ${gridProdutos}
        </div>
    </div>`;
}

function renderSubsVazias() {
    return `<div class="tw-p-4 tw-text-center tw-text-slate-400 tw-text-xs tw-italic tw-bg-slate-50/50 tw-rounded-lg">Nenhuma sub-especialidade vinculada.</div>`;
}
