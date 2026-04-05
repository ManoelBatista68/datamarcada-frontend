// js/components/CardEspecialidade.js
// Renderiza o card de uma especialidade com seu accordion de sub-especialidades.

function renderCardEspecialidade(esp, subs, prodMap) {
    const espContainerId = `subs-esp-${esp.id}`;
    const espIconId = `icon-esp-${esp.id}`;
    const nomeEsp = escapeHtml(esp.nome).replace(/'/g, "\\'");

    const listaSubs = subs.length > 0
        ? subs.map(sub => {
            const produtos = prodMap[sub.codigo_sub_especialidade] || prodMap[sub.id] || prodMap[sub.nome] || [];
            return renderCardSubEspecialidade(sub, esp.id, esp.nome, produtos);
        }).join('')
        : renderSubsVazias();

    return `
    <section class="tw-space-y-6 tw-mb-12 tw-fade-in-smooth">
        <div class="tw-bg-white tw-p-3 md:tw-p-6 tw-rounded-xl tw-flex tw-items-center tw-justify-between tw-shadow-sm tw-border-l-4 tw-border-primary tw-group hover:tw-shadow-md tw-transition-shadow" style="border-left-color: #3F76CB;">
            <div class="tw-flex tw-items-center tw-gap-2 md:tw-gap-5">
                <div class="tw-w-9 tw-h-9 md:tw-w-12 md:tw-h-12 tw-rounded-full tw-bg-primary-fixed tw-flex tw-items-center tw-justify-center tw-text-primary group-hover:tw-scale-110 tw-transition-transform tw-shrink-0">
                    <span class="material-symbols-outlined tw-text-xl md:tw-text-2xl">stethoscope</span>
                </div>
                <div>
                    <h3 class="tw-font-bold tw-text-on-surface tw-flex tw-items-center tw-text-base md:tw-text-lg">
                        ${escapeHtml(esp.nome)}
                        <span class="material-symbols-outlined tw-text-xl tw-text-slate-400 hover:tw-text-primary tw-ml-2 tw-cursor-pointer tw-transition-colors" title="Editar Especialidade"
                            onclick="window.parent.prepararEdicaoEspecialidade('${esp.id}', '${nomeEsp}')">settings</span>
                    </h3>
                </div>
            </div>
            <div class="tw-flex tw-items-center tw-gap-1 md:tw-gap-3 tw-shrink-0">
                <button onclick="window.parent.prepararNovoSubEspecialidade('${esp.id}', '${nomeEsp}')"
                    class="tw-h-[36px] tw-rounded-lg tw-text-sm tw-font-bold tw-flex tw-items-center tw-gap-1 tw-px-2 md:tw-px-4 tw-bg-blue-50 tw-text-primary hover:tw-bg-blue-100 tw-transition-colors tw-border-none tw-cursor-pointer">
                    <span class="material-symbols-outlined tw-text-lg">add_circle</span>
                    <span class="tw-hidden sm:tw-inline">Adicionar Sub</span>
                </button>
                <div class="tw-h-8 tw-w-[1px] tw-bg-outline-variant/30"></div>
                <button onclick="window.parent.toggleHierarquia('${espContainerId}', '${espIconId}')"
                    class="tw-p-2 tw-rounded-lg tw-text-outline hover:tw-text-primary hover:tw-bg-primary-fixed/30 tw-transition-all tw-flex tw-items-center tw-justify-center tw-w-10 tw-h-10 tw-border-none tw-bg-transparent tw-cursor-pointer" title="Expandir/Recolher">
                    <span id="${espIconId}" class="material-symbols-outlined tw-text-2xl">visibility_off</span>
                </button>
            </div>
        </div>
        <div class="tw-ml-12 tw-space-y-8 diagnostic-thread tw-hidden" id="${espContainerId}">
            ${listaSubs}
        </div>
    </section>`;
}

function renderHierarquiaVazia() {
    return `<div class="tw-p-10 tw-text-center tw-text-slate-400 tw-italic tw-bg-white tw-rounded-lg tw-border-2 tw-border-dashed tw-border-slate-100">
        Nenhuma especialidade cadastrada ainda. Use o botão acima para começar.
    </div>`;
}
