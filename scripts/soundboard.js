/* scripts/soundboard.js */
import { DXXMUtils } from "./utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DXXMSoundboard extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        const savedPosition = DXXMUtils.getWindowPosition('soundboard-pos');
        if (savedPosition) options.position = foundry.utils.mergeObject(options.position || {}, savedPosition);
        super(options);
        
        this.prefix = "soundboard";
        this.gridConfig = game.settings.get('ui-redesign', `${this.prefix}-grid-config`) || { containerCols: 1, itemCols: 3, itemRows: 1, preloadAudio: false };
        this.containers = game.settings.get('ui-redesign', `${this.prefix}-containers`) || [{ id: foundry.utils.randomID(), volume: 1.0, name: "..." }];
        this.slotsData = game.settings.get('ui-redesign', `${this.prefix}-slots-data`) || {};
        
        this.activeSounds = new Map();
    }

    static DEFAULT_OPTIONS = {
        id: "dxxm-soundboard-app",
        classes: ["dxxm-window-soundboard"],
        tag: "section",
        window: { 
            icon: "fas fa-music",
            title: "Soundboard", 
            resizable: true,
            controls: [{ icon: "fas fa-layer-group", label: "Grades", action: "configureGrid", align: "header" }]
        }
    };

    static PARTS = { main: { template: "modules/ui-redesign/templates/soundboard.html" } };

    async close(options = {}) {
        await DXXMUtils.saveWindowPosition('soundboard-pos', this.position);
        return super.close(options);
    }

    /**
     * GERENCIAMENTO DE SOM
     */
    _stopSound(slotId) {
        if (this.activeSounds.has(slotId)) {
            this.activeSounds.get(slotId).stop(); 
            this.activeSounds.delete(slotId); 
            // Remove a classe visual de "tocando"
            this.element?.querySelector(`[data-slot="${slotId}"]`)?.classList.remove('is-active'); 
        }
    }

    async _handleLeftClick(event, slotId) {
        const slotData = this.slotsData[slotId];
        if (!slotData?.hasItem) return;

        // Se já estiver tocando, o clique esquerdo para o som (Toggle)
        if (this.activeSounds.has(slotId)) return this._stopSound(slotId);

        if (this.gridConfig.preloadAudio) await foundry.audio.AudioHelper.preloadSound(slotData.src);

        event.currentTarget.classList.add('is-active'); 
        const containerId = slotId.split('-slot-')[0];
        const container = this.containers.find(c => c.id === containerId);
        
        const sound = await foundry.audio.AudioHelper.play({
            src: slotData.src, 
            volume: (slotData.volume || 1.0) * (container?.volume || 1.0), 
            loop: !!slotData.loop
        }, true);
        
        if (sound) {
            this.activeSounds.set(slotId, sound);
            sound.on("end", () => this._stopSound(slotId));
        }
    }

    async _handleRightClick(event, slotId) {
        if (!game.user.isGM) return;
        const slotData = this.slotsData[slotId] || { hasItem: false };
        
        const dialogContent = `
            <form class="dxxm-dialog-grid">
                <div class="form-group"><label>Nome do Áudio:</label><input type="text" name="name" value="${slotData.name || ''}"></div>
                <div class="form-group"><label>Ficheiro:</label><input type="text" name="src" value="${slotData.src || ''}"></div>
                <div class="form-group"><label>Ícone (ex: fas fa-ghost):</label><input type="text" name="img" value="${slotData.img || ''}"></div>
                <div class="form-group"><label>Volume:</label><input type="number" name="volume" value="${slotData.volume || 1.0}" step="0.1" min="0" max="1"></div>
                <div class="form-group">
                    <label><input type="checkbox" name="loop" ${slotData.loop ? 'checked' : ''}> Loop</label>
                </div>
            </form>`;

        const result = await foundry.applications.api.DialogV2.wait({
            window: { title: "Configurar Áudio", width: 400 },
            content: dialogContent,
            buttons: [
                { action: "save", label: "Salvar", icon: "fas fa-save", default: true, callback: (e, b) => new FormDataExtended(b.form).object },
                { action: "delete", label: "Excluir", icon: "fas fa-trash", callback: () => "delete" }
            ]
        });

        if (result === "delete") { 
            delete this.slotsData[slotId]; 
        } else if (result) { 
            this.slotsData[slotId] = { ...slotData, hasItem: true, ...result }; 
        }

        await game.settings.set('ui-redesign', `${this.prefix}-slots-data`, this.slotsData);
        this.render(true);
    }

    async _handleHeaderRename(event, containerId) {
        if (!game.user.isGM) return;
        const idx = this.containers.findIndex(c => c.id === containerId);
        const newName = await DXXMUtils.renameDialog("Renomear Grupo", this.containers[idx].name);
        if (newName !== null) {
            this.containers[idx].name = newName || "...";
            await game.settings.set('ui-redesign', `${this.prefix}-containers`, this.containers);
            this.render(true);
        }
    }

    /**
     * CONTROLES DE VOLUME
     */
    _onContainerVolumeInput(event) {
        const slider = event.currentTarget;
        const vol = parseFloat(slider.value);
        const containerId = slider.dataset.containerId;
        this.element.querySelector(`#volume-display-${containerId}`).innerText = `${Math.round(vol * 100)}%`;

        // Atualiza o volume de todos os sons ativos deste grupo em tempo real
        for (let [slotId, sound] of this.activeSounds.entries()) {
            if (slotId.startsWith(containerId + "-")) {
                sound.volume = (this.slotsData[slotId].volume || 1.0) * vol;
            }
        }
    }

    async _onContainerVolumeChange(event) {
        const containerId = event.currentTarget.dataset.containerId;
        const idx = this.containers.findIndex(c => c.id === containerId);
        if (idx !== -1) {
            this.containers[idx].volume = parseFloat(event.currentTarget.value);
            await game.settings.set('ui-redesign', `${this.prefix}-containers`, this.containers);
        }
    }

    _onRender(context, options) {
        super._onRender(context, options);

        // GridManager cuidando dos eventos base
        DXXMUtils.GridManager.setupEventListeners(this.element, {
            app: this, settingPrefix: this.prefix,
            onLeftClick: (ev, id) => this._handleLeftClick(ev, id),
            onRightClick: (ev, id) => this._handleRightClick(ev, id),
            onHeaderClick: (ev, id) => this._handleHeaderRename(ev, id),
            slotSelector: ".evidence-slot",
            headerSelector: ".slots-header"
        });

        // Eventos específicos de volume
        this.element.querySelectorAll('.container-volume-slider').forEach(s => {
            s.addEventListener('input', this._onContainerVolumeInput.bind(this));
            s.addEventListener('change', this._onContainerVolumeChange.bind(this));
        });

        // Drag & Drop (Mesma lógica do Evidence)
        if (game.user.isGM) {
            this.element.querySelectorAll('.evidence-slot').forEach(slot => {
                slot.setAttribute('draggable', true);
                slot.addEventListener('dragstart', ev => {
                    const slotId = ev.currentTarget.dataset.slot;
                    if (!this.slotsData[slotId]?.hasItem) return;
                    ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "SoundboardSlot", slotId }));
                });
                slot.addEventListener('dragover', ev => ev.preventDefault());
                slot.addEventListener('drop', ev => this._onDrop(ev));
            });
        }
    }

    async _onDrop(event) {
        if (!game.user.isGM) return;
        const targetId = event.currentTarget.closest('.evidence-slot')?.dataset.slot;
        if (!targetId) return;

        let data;
        try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch(e) { return; }

        if (data.type === "SoundboardSlot") {
            const sourceId = data.slotId;
            const sourceData = foundry.utils.deepClone(this.slotsData[sourceId]);
            const targetData = foundry.utils.deepClone(this.slotsData[targetId]);
            if (sourceData) this.slotsData[targetId] = sourceData; else delete this.slotsData[targetId];
            if (targetData) this.slotsData[sourceId] = targetData; else delete this.slotsData[sourceId];
        } else if (data.type === "PlaylistSound" || data.uuid) {
            const soundDoc = await fromUuid(data.uuid);
            if (!soundDoc) return;
            this.slotsData[targetId] = {
                hasItem: true, name: soundDoc.name, src: soundDoc.path || soundDoc.src,
                img: "fas fa-music", volume: soundDoc.volume || 1.0, loop: false
            };
        }

        await game.settings.set('ui-redesign', `${this.prefix}-slots-data`, this.slotsData);
        this.render(true);
    }

    async _prepareContext() {
        const grid = DXXMUtils.GridManager.prepareContext(this.gridConfig, this.containers, this.slotsData);
        
        const enrichedGrid = grid.map(c => ({
            ...c,
            volumeDisplay: Math.round((c.volume || 1.0) * 100),
            slots: c.slots.map(s => ({
                ...s,
                isActive: this.activeSounds.has(s.id)
            }))
        }));

        return { config: this.gridConfig, containers: enrichedGrid, isGM: game.user.isGM };
    }
}

DXXMSoundboard.DEFAULT_OPTIONS.actions = {
    configureGrid: function() { 
        DXXMUtils.GridManager.configureGrid(this.prefix, this.gridConfig, this.containers).then(r => {
            if(r) { this.gridConfig = r.newConfig; this.containers = r.newContainers; this.render(true); }
        });
    }
};
