/* scripts/viewer.js */
import { DXXMUtils } from "./utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DXXMViewer extends HandlebarsApplicationMixin(ApplicationV2) {
    static activeViewers = 0;
    static lastPosition = null;
    // Mapa estático para rastrear instâncias abertas pelo ID único
    static openViewers = new Map(); 

    constructor(itemData, options = {}) {
        // Gera um ID único baseado no nome do item usando o slugify do Foundry
        const safeId = itemData.name.slugify({strict: true});
        options.id = `dxxm-viewer-${safeId}`;
        
        // Se já existir uma janela com este ID, trazemos para frente e não criamos outra
        const existing = DXXMViewer.openViewers.get(options.id);
        if (existing) {
            existing.bringToFront();
            throw new Error(`Viewer para ${itemData.name} já está aberto.`);
        }

        const savedPosition = DXXMUtils.getWindowPosition('viewer-default-pos');
        const evPos = options.evidencePosition;
        let startLeft = window.innerWidth / 2;
        let startTop = window.innerHeight / 2;

        if (DXXMViewer.activeViewers === 0 && savedPosition) {
            startLeft = savedPosition.left;
            startTop = savedPosition.top;
        } else if (DXXMViewer.activeViewers === 0 && evPos) {
            startLeft = evPos.left + evPos.width + 10;
            startTop = evPos.top;
        } else if (DXXMViewer.lastPosition) {
            startLeft = DXXMViewer.lastPosition.left + 30;
            startTop = DXXMViewer.lastPosition.top + 30;
        }

        if (startLeft + 400 > window.innerWidth) startLeft = window.innerWidth - 420; 

        options.position = foundry.utils.mergeObject(options.position || {}, { 
            left: startLeft, 
            top: startTop 
        });

        super(options);
        this.itemData = itemData;
        this.slotId = options.slotId; 

        // Registra a instância no mapa
        DXXMViewer.openViewers.set(this.id, this);

        DXXMViewer.lastPosition = { left: startLeft, top: startTop };
        DXXMViewer.activeViewers++;
    }

    static DEFAULT_OPTIONS = {
        classes: ["dxxm-window-viewer"],
        tag: "div",
        window: { icon: "fas fa-eye", resizable: true },
        position: { width: 350, height: "auto" }
    };

    static PARTS = { main: { template: "modules/ui-redesign/templates/viewer.html" } };

    get title() { return `Investigação: ${this.itemData.name}`; }

    async _prepareContext(options) {
        return { 
            name: this.itemData.name,
            img: this.itemData.img,
            isIcon: this.itemData.img?.trim().startsWith('fa'),
            shortDesc: this.itemData.shortDesc,
            longDesc: this.itemData.longDesc,
            isGM: game.user.isGM
        };
    }

    /**
     * Fecha a janela e limpa referências e estados visuais.
     */
    async close(options = {}) {
        // Tenta salvar a posição, mas não deixa um erro aqui travar o fechamento
        try {
            if (this.position) await DXXMUtils.saveWindowPosition('viewer-default-pos', this.position);
        } catch (e) { console.warn("DXXM | Erro ao salvar posição do Viewer:", e); }
        
        DXXMViewer.activeViewers = Math.max(0, DXXMViewer.activeViewers - 1);
        if (DXXMViewer.activeViewers === 0) DXXMViewer.lastPosition = null;

        // Remove do mapa usando o ID real da aplicação
        DXXMViewer.openViewers.delete(this.id);

        // Remove a classe 'is-active' do slot de origem
        if (this.slotId) {
            const slotElement = document.querySelector(`.evidence-slot[data-slot="${this.slotId}"]`);
            if (slotElement) slotElement.classList.remove('is-active');
        }
        
        return super.close(options);
    }
}
