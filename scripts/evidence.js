/* scripts/evidence.js - v18 (Ultra-Robust Hook System) */
import { DXXMUtils } from "./utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DXXMEvidence extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        options.position = { width: "auto", height: "auto" }; 
        const savedPosition = DXXMUtils.getWindowPosition('evidence-pos');
        if (savedPosition) {
            options.position.top = savedPosition.top;
            options.position.left = savedPosition.left;
        }

        if (game.user.isGM) {
            options.window = foundry.utils.mergeObject(options.window || {}, {
                controls: [{ icon: "fas fa-layer-group", label: "Configurar Grade", action: "configureGrid" }]
            });
        }

        super(options);
        this.prefix = "evidence";
    }

    static DEFAULT_OPTIONS = {
        id: "dxxm-evidence-app",
        classes: ["dxxm-window-evidence"],
        tag: "section",
        position: { width: "auto", height: "auto" },
        window: { 
            icon: "fa-regular fa-paperclip",
            title: "Inventário de Evidências", 
            resizable: false,
            controls: [] 
        }
    };

    static PARTS = { main: { template: "modules/ui-redesign/templates/evidence.html" } };

    _parseFAIcon(path) {
        if (!path || typeof path !== "string") return null;
        const fileName = path.split('/').pop().split('.').shift();
        const match = fileName.match(/^(fas|far|fab|fa)[_-](?:solid[_-]fa[_-]|regular[_-]fa[_-]|brands[_-]fa[_-]|fa[_-])?([\w-]+)/);
        
        if (match) {
            const type = match[1] === "fa" ? "fas" : match[1];
            const iconName = match[2].replace(/_/g, "-");
            return `${type} fa-${iconName}`;
        }
        return null;
    }

    async close(options = {}) {
        await DXXMUtils.saveWindowPosition('evidence-pos', this.position);
        return super.close(options);
    }

    async _handleLeftClick(event, slotId) {
        const slotData = this.slotsData[slotId];
        if (!slotData?.hasItem || (slotData.hidden && !game.user.isGM)) return;
        
        // Verifica se já está aberta (V1 ou V2) para dar foco ou fechar
        const openApp = [...Object.values(ui.windows), ...foundry.applications.instances.values()]
            .find(app => app.document?.uuid === slotData.uuid);

        if (openApp && openApp.rendered) {
            await openApp.close();
        } else {
            const doc = await fromUuid(slotData.uuid);
            if (doc) doc.sheet.render(true);
        }
    }

    async _handleRightClick(event, slotId) {
        if (!game.user.isGM || !this.slotsData[slotId]?.hasItem) return;
        const confirm = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Remover Evidência" },
            yes: { label: "Remover", icon: "fas fa-trash" }
        });
        if (confirm) {
            delete this.slotsData[slotId];
            await game.settings.set('ui-redesign', `${this.prefix}-slots-data`, this.slotsData);
            this.render(true);
        }
    }

    async _toggleVisibility(slotId) {
        if (!game.user.isGM) return;
        const slotData = this.slotsData[slotId];
        if (!slotData?.hasItem) return;
        slotData.hidden = !slotData.hidden;
        const doc = await fromUuid(slotData.uuid);
        if (doc) {
            const level = slotData.hidden ? 0 : 2; 
            await doc.update({ "ownership.default": level });
        }
        await game.settings.set('ui-redesign', `${this.prefix}-slots-data`, this.slotsData);
        this.render(true);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        DXXMUtils.GridManager.setupEventListeners(this.element, {
            app: this, settingPrefix: this.prefix,
            onLeftClick: (ev, id) => this._handleLeftClick(ev, id),
            onRightClick: (ev, id) => this._handleRightClick(ev, id),
            onHeaderClick: () => {}, 
            onToggleVisibility: (ev, id) => { if(ev) { ev.preventDefault(); ev.stopPropagation(); } this._toggleVisibility(id); },
            slotSelector: ".group-grid-slots-unitary", headerSelector: ".group-grid-header"
        });

        if (game.user.isGM) {
            this.element.querySelectorAll('.group-grid-header-label input').forEach(input => {
                input.addEventListener('change', async ev => {
                    const containerId = ev.currentTarget.dataset.container;
                    const newName = ev.currentTarget.value.trim() || "Novo Grupo";
                    const idx = this.containers.findIndex(c => c.id === containerId);
                    if (idx !== -1) {
                        this.containers[idx].name = newName;
                        await game.settings.set('ui-redesign', `${this.prefix}-containers`, this.containers);
                    }
                });
                input.addEventListener('mousedown', ev => ev.stopPropagation());
            });

            this.element.querySelectorAll('.group-grid-slots-unitary').forEach(slot => {
                slot.setAttribute('draggable', true);
                slot.addEventListener('auxclick', ev => { if (ev.button === 1) { ev.preventDefault(); this._toggleVisibility(ev.currentTarget.dataset.slot); } });
                slot.addEventListener('dragstart', ev => {
                    const slotId = ev.currentTarget.dataset.slot;
                    if (!this.slotsData[slotId]?.hasItem) return;
                    ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "EvidenceSlot", slotId }));
                });
                slot.addEventListener('dragover', ev => ev.preventDefault());
                slot.addEventListener('drop', ev => this._onDrop(ev));
            });
        }
    }

    async _onDrop(event) {
        if (!game.user.isGM) return;
        const targetId = event.currentTarget.closest('.group-grid-slots-unitary')?.dataset.slot;
        if (!targetId) return;
        let data;
        try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch(e) { return; }
        if (data.type === "EvidenceSlot") {
            const sourceId = data.slotId;
            const sourceData = foundry.utils.deepClone(this.slotsData[sourceId]);
            const targetData = foundry.utils.deepClone(this.slotsData[targetId]);
            if (sourceData) this.slotsData[targetId] = sourceData; else delete this.slotsData[targetId];
            if (targetData) this.slotsData[sourceId] = targetData; else delete this.slotsData[sourceId];
        } else if (data.uuid) {
            this.slotsData[targetId] = { hasItem: true, uuid: data.uuid, hidden: true };
        }
        await game.settings.set('ui-redesign', `${this.prefix}-slots-data`, this.slotsData);
        this.render(true);
    }

    async _prepareContext() {
        this.gridConfig = game.settings.get('ui-redesign', `${this.prefix}-grid-config`);
        this.containers = game.settings.get('ui-redesign', `${this.prefix}-containers`);
        this.slotsData = game.settings.get('ui-redesign', `${this.prefix}-slots-data`);

        const grid = DXXMUtils.GridManager.prepareContext(this.gridConfig, this.containers, this.slotsData);
        
        // Coleta UUIDs de janelas V1 e V2 que estejam ATIVAMENTE renderizadas
        const openUuids = [
            ...Object.values(ui.windows).filter(app => app.rendered).map(app => app.document?.uuid),
            ...Array.from(foundry.applications.instances.values()).filter(app => app.rendered).map(app => app.document?.uuid)
        ].filter(u => !!u);

        grid.forEach(c => {
            if (c.hidden && !game.user.isGM) {
                c.slots = []; 
            } else {
                c.slots.forEach(s => {
                    if (s.data?.uuid) {
                        const isVisible = game.user.isGM || !s.data.hidden;
                        if (isVisible) {
                            const doc = fromUuidSync(s.data.uuid);
                            if (doc) { s.data.name = doc.name; s.data.img = doc.img; s.data.faIcon = this._parseFAIcon(doc.img); }
                            if (openUuids.includes(s.data.uuid)) s.isActive = true;
                        }
                    }
                });
            }
        });
        return { config: this.gridConfig, containers: grid, isGM: game.user.isGM };
    }
}

DXXMEvidence.DEFAULT_OPTIONS.actions = {
    configureGrid: function() { 
        DXXMUtils.GridManager.configureGrid(this.prefix, this.gridConfig, this.containers).then(r => {
            if(r) { this.gridConfig = r.newConfig; this.containers = r.newContainers; this.render(true).then(() => this.setPosition({ width: "auto", height: "auto" })); }
        });
    }
};

/**
 * MOTOR DE SINCRONIZAÇÃO E HOOKS DE FECHAMENTO
 */
const refreshEvidence = () => {
    const app = foundry.applications.instances.get("dxxm-evidence-app");
    if (app) setTimeout(() => app.render({ force: true }), 150); // Aumentado para 150ms para garantir limpeza de memória
};

// Hook de Sincronização (GM -> Jogadores)
Hooks.on("updateSetting", (setting) => { if (setting.key.includes("evidence-")) refreshEvidence(); });

// Hooks de Estado (Quando janelas abrem ou fecham)
Hooks.on("renderApplication", (app) => { if (app.document?.uuid) refreshEvidence(); });
Hooks.on("closeApplication", (app) => { if (app.document?.uuid) refreshEvidence(); });

// Hooks Específicos para Sheets
Hooks.on("renderItemSheet", (app) => refreshEvidence());
Hooks.on("renderActorSheet", (app) => refreshEvidence());
Hooks.on("closeItemSheet", (app) => refreshEvidence());
Hooks.on("closeActorSheet", (app) => refreshEvidence());
