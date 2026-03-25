/* scripts/citizens.js */
import { DXXMUtils } from "./utils.js";
import { DXXMInvestigation } from "./investigation.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DXXMCitizens extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        const savedPosition = DXXMUtils.getWindowPosition('citizens-pos');
        if (savedPosition) {
            options.position = foundry.utils.mergeObject(options.position || {}, savedPosition);
        }
        super(options);
        
        this.activePageId = null;
        this.activeGroupId = null;
    }

    static DEFAULT_OPTIONS = {
        id: "dxxm-citizens-app",
        classes: ["dxxm-window-citizens"],
        tag: "section",
        window: { 
            icon: "fas fa-users",
            title: "Agenda de Contatos", 
            resizable: true
        },
        position: {
            width: 850,
            height: 848
        }
    };

    static PARTS = {
        main: { template: "modules/ui-redesign/templates/citizens.html" }
    };

    async close(options = {}) {
        await DXXMUtils.saveWindowPosition('citizens-pos', this.position);
        return super.close(options);
    }

    async _getCitizensData() {
        try {
            return game.settings.get('ui-redesign', 'citizensData') || { locations: [] };
        } catch (e) {
            return { locations: [] };
        }
    }

    async _saveCitizensData(data) {
        if (game.user.isGM) {
            await game.settings.set('ui-redesign', 'citizensData', data);
        }
    }

    // Função auxiliar para abrir o Dialog de Edição/Exclusão
    _openEditDialog(type, id, currentName) {
        new Dialog({
            title: `Gerenciar ${type === 'page' ? 'Local' : 'Grupo'}`,
            content: `
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Nome:</label>
                    <input type="text" id="dxxm-dialog-name" value="${currentName}" autofocus>
                </div>
                <hr>
                <p style="color: darkred; font-size: 0.9em;">Aviso: Excluir um Local apagará seus Grupos. Excluir um Grupo apagará a organização de seus tokens.</p>
            `,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: "Salvar",
                    callback: async (html) => {
                        const newName = html.find('#dxxm-dialog-name').val();
                        if (newName && newName.trim() !== "") {
                            let data = await this._getCitizensData();
                            if (type === 'page') {
                                let loc = data.locations.find(l => l.id === id);
                                if (loc) loc.name = newName;
                            } else if (type === 'group') {
                                let loc = data.locations.find(l => l.id === this.activePageId);
                                let grp = loc?.groups.find(g => g.id === id);
                                if (grp) grp.name = newName;
                            }
                            await this._saveCitizensData(data);
                            this.render(true);
                        }
                    }
                },
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: "Excluir",
                    callback: async () => {
                        let data = await this._getCitizensData();
                        if (type === 'page') {
                            data.locations = data.locations.filter(l => l.id !== id);
                            if (this.activePageId === id) {
                                this.activePageId = data.locations.length > 0 ? data.locations[0].id : null;
                                this.activeGroupId = null;
                            }
                        } else if (type === 'group') {
                            let loc = data.locations.find(l => l.id === this.activePageId);
                            if (loc) {
                                loc.groups = loc.groups.filter(g => g.id !== id);
                                if (this.activeGroupId === id) {
                                    this.activeGroupId = loc.groups.length > 0 ? loc.groups[0].id : null;
                                }
                            }
                        }
                        await this._saveCitizensData(data);
                        this.render(true);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancelar"
                }
            },
            default: "save"
        }).render(true);
    }

    _onRender(context, options) {
        super._onRender(context, options);

        // Alterar Imagem do Local (FilePicker) - GM
        const locationFlagImg = this.element.querySelector('.location-flag');
        if (locationFlagImg && game.user.isGM) {
            locationFlagImg.style.cursor = 'pointer';
            locationFlagImg.title = "Clique com o botão direito para alterar a imagem do Local";
            
            locationFlagImg.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                if (!this.activePageId) {
                    ui.notifications.warn("Crie um Local primeiro antes de alterar a imagem.");
                    return;
                }

                let data = await this._getCitizensData();
                let loc = data.locations.find(l => l.id === this.activePageId);
                let currentPath = loc?.locationFlag || "icons/svg/d20-grey.svg";

                new FilePicker({
                    type: "image",
                    current: currentPath,
                    callback: async (path) => {
                        if (loc) {
                            loc.locationFlag = path;
                            await this._saveCitizensData(data);
                            this.render(true);
                        }
                    }
                }).browse();
            });
        }

        // Eventos para as abas de páginas (Locais)
        const pageTabs = this.element.querySelectorAll('.page-tab');
        pageTabs.forEach(tab => {
            tab.addEventListener('click', (event) => {
                this.activePageId = event.currentTarget.dataset.page;
                this.activeGroupId = null;
                this.render(true);
            });

            tab.addEventListener('contextmenu', async (event) => {
                if (!game.user.isGM) return;
                event.preventDefault();
                
                const pageId = event.currentTarget.dataset.page;
                
                // Shift + Clique Direito = Ocultar/Revelar
                if (event.shiftKey) {
                    let data = await this._getCitizensData();
                    let loc = data.locations.find(l => l.id === pageId);
                    if (loc) {
                        loc.isHidden = !loc.isHidden;
                        await this._saveCitizensData(data);
                        this.render(true);
                    }
                } else {
                    // Clique Direito = Dialog
                    const currentName = tab.innerText.trim();
                    this._openEditDialog('page', pageId, currentName);
                }
            });
        });

        // Eventos para as abas de grupos
        const groupTabs = this.element.querySelectorAll('.group-tab');
        groupTabs.forEach(tab => {
            tab.addEventListener('click', (event) => {
                this.activeGroupId = event.currentTarget.dataset.group;
                this.render(true);
            });

            tab.addEventListener('contextmenu', async (event) => {
                if (!game.user.isGM) return;
                event.preventDefault();
                
                const groupId = event.currentTarget.dataset.group;

                // Shift + Clique Direito = Ocultar/Revelar
                if (event.shiftKey) {
                    let data = await this._getCitizensData();
                    let loc = data.locations.find(l => l.id === this.activePageId);
                    let grp = loc?.groups.find(g => g.id === groupId);
                    if (grp) {
                        grp.isHidden = !grp.isHidden;
                        await this._saveCitizensData(data);
                        this.render(true);
                    }
                } else {
                    // Clique Direito = Dialog
                    const currentName = tab.innerText.trim();
                    this._openEditDialog('group', groupId, currentName);
                }
            });
        });

        // Adicionar Local (GM)
        const addPageBtn = this.element.querySelector('.add-page');
        if (addPageBtn) {
            addPageBtn.addEventListener('click', async () => {
                let data = await this._getCitizensData();
                const newLoc = { id: foundry.utils.randomID(), name: "Novo Local", isHidden: false, publicOpinion: 50, groups: [] };
                data.locations.push(newLoc);
                this.activePageId = newLoc.id;
                this.activeGroupId = null;
                await this._saveCitizensData(data);
                this.render(true);
            });
        }

        // Adicionar Grupo (GM)
        const addGroupBtn = this.element.querySelector('.add-group');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', async () => {
                if (!this.activePageId) return;
                let data = await this._getCitizensData();
                let loc = data.locations.find(l => l.id === this.activePageId);
                if (loc) {
                    const newGrp = { id: foundry.utils.randomID(), name: "Novo Grupo", isHidden: false, npcs: [] };
                    loc.groups.push(newGrp);
                    this.activeGroupId = newGrp.id;
                    await this._saveCitizensData(data);
                    this.render(true);
                }
            });
        }

        // Lógica da Opinião Pública (GM)
        if (game.user.isGM) {
            const opinionTrack = this.element.querySelector('.opinion-track');
            if (opinionTrack) {
                let isDraggingOpinion = false;
                const updateOpinion = async (e, save = false) => {
                    const rect = opinionTrack.getBoundingClientRect();
                    let clickX = e.clientX - rect.left;
                    let percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                    const marker = opinionTrack.querySelector('.opinion-marker');
                    const textLabel = this.element.querySelector('.opinion-percentage-text');
                    if (marker) marker.style.left = `${percentage}%`;
                    const opinionValue = Math.round((percentage - 50) * 2);
                    const tooltipText = `${opinionValue > 0 ? '+' : ''}${opinionValue}%`;
                    if (marker) marker.dataset.tooltip = tooltipText;
                    if (textLabel) textLabel.innerText = tooltipText;
                    if (save) {
                        let data = await this._getCitizensData();
                        let loc = data.locations.find(l => l.id === this.activePageId);
                        if (loc) {
                            loc.publicOpinion = percentage;
                            await this._saveCitizensData(data);
                        }
                    }
                };
                opinionTrack.addEventListener('mousedown', (e) => {
                    if (e.button !== 0 || !this.activePageId) return;
                    isDraggingOpinion = true;
                    updateOpinion(e, false);
                    const onMouseMoveOp = (mv) => { if (isDraggingOpinion) updateOpinion(mv, false); };
                    const onMouseUpOp = async (up) => {
                        if (isDraggingOpinion) {
                            isDraggingOpinion = false;
                            await updateOpinion(up, true);
                            document.removeEventListener('mousemove', onMouseMoveOp);
                            document.removeEventListener('mouseup', onMouseUpOp);
                        }
                    };
                    document.addEventListener('mousemove', onMouseMoveOp);
                    document.addEventListener('mouseup', onMouseUpOp);
                });
            }
        }

        const container = this.element.querySelector('.citizens-portrait-container');
        
        // Drag and Drop de Atores da aba lateral (GM)
        if (game.user.isGM && container) {
            container.addEventListener('dragover', e => e.preventDefault());
            container.addEventListener('drop', async e => {
                e.preventDefault();
                try {
                    const dataText = e.dataTransfer.getData('text/plain');
                    if (!dataText || !this.activePageId || !this.activeGroupId) return;
                    
                    const dropData = JSON.parse(dataText);
                    if (dropData.type !== 'Actor') return;
                    
                    const actor = await fromUuid(dropData.uuid);
                    if (!actor) return;

                    let data = await this._getCitizensData();
                    let loc = data.locations.find(l => l.id === this.activePageId);
                    let grp = loc?.groups.find(g => g.id === this.activeGroupId);
                    
                    if (grp) {
                        const containerRect = container.getBoundingClientRect();
                        const x = e.clientX - containerRect.left + container.scrollLeft - 40;
                        const y = e.clientY - containerRect.top + container.scrollTop - 40;

                        if (!grp.npcs) grp.npcs = [];
                        if (!grp.npcs.find(n => n.actorId === actor.id)) {
                            grp.npcs.push({ actorId: actor.id, x: x, y: y, isHidden: false });
                            await this._saveCitizensData(data);
                            this.render(true);
                        }
                    }
                } catch(err) {
                    console.error("DXXM | Erro ao soltar Ator na Agenda:", err);
                }
            });
        }

        // Interação com Retratos
        const wrappers = this.element.querySelectorAll('.citizen-portrait-wrapper');
        wrappers.forEach(wrapper => {
            
            // Clique Esquerdo: Abre Investigação ou Remove (se GM usar ALT)
            wrapper.addEventListener('click', async (event) => {
                if (event.button !== 0) return;
                
                // Trava para impedir a abertura ao soltar do arrasto
                if (wrapper.dataset.dragged === "true") return;

                const npcId = wrapper.dataset.npcId;

                // Remover NPC (Alt + Clique Esquerdo) - GM
                if (game.user.isGM && event.altKey) {
                    event.preventDefault();
                    let data = await this._getCitizensData();
                    let loc = data.locations.find(l => l.id === this.activePageId);
                    let grp = loc?.groups.find(g => g.id === this.activeGroupId);
                    if (grp) {
                        grp.npcs = grp.npcs.filter(n => n.actorId !== npcId);
                        await this._saveCitizensData(data);
                        this.render(true);
                    }
                    return;
                }
                
                // Abrir Investigação
                const npcData = context.activeNPCs.find(n => n.id === npcId);
                const currentGroup = context.groups.find(g => g.id === this.activeGroupId);
                const groupName = currentGroup ? currentGroup.name : "Geral";
                
                if (npcData && !npcData.isHidden) {
                    DXXMInvestigation.openForNPC(npcData.name, npcData.img, npcData.mask, groupName);
                    this.close();
                }
            });

            // Clique Direito: Ocultar/Revelar (Shift + Clique Direito) - GM
            wrapper.addEventListener('contextmenu', async (e) => {
                if (game.user.isGM && e.shiftKey) {
                    e.preventDefault(); e.stopPropagation();
                    const npcId = wrapper.dataset.npcId;
                    let data = await this._getCitizensData();
                    let loc = data.locations.find(l => l.id === this.activePageId);
                    let grp = loc?.groups.find(g => g.id === this.activeGroupId);
                    let npc = grp?.npcs.find(n => n.actorId === npcId);
                    
                    if (npc) {
                        npc.isHidden = !npc.isHidden;
                        await this._saveCitizensData(data);
                        this.render(true);
                    }
                }
            });

            // Arrastar NPC pela tela (Shift + Mouse Down) - GM
            wrapper.addEventListener('mousedown', (e) => {
                if (!game.user.isGM || e.button !== 0 || !e.shiftKey) return;
                const containerRect = container.getBoundingClientRect();
                const wrapperRect = wrapper.getBoundingClientRect();
                
                wrapper.dataset.dragged = "false"; // Reseta a flag de segurança inicial
                
                wrapper.style.position = 'absolute';
                wrapper.style.left = `${wrapperRect.left - containerRect.left + container.scrollLeft}px`;
                wrapper.style.top = `${wrapperRect.top - containerRect.top + container.scrollTop}px`;
                wrapper.style.zIndex = 1000;
                wrapper.style.transition = 'none';
                
                let offsetX = e.clientX - wrapperRect.left;
                let offsetY = e.clientY - wrapperRect.top;
                let isDragging = false;
                
                const onMove = (mv) => {
                    isDragging = true;
                    wrapper.dataset.dragged = "true"; // Sinaliza o elemento como sendo arrastado
                    wrapper.style.left = `${mv.clientX - containerRect.left + container.scrollLeft - offsetX}px`;
                    wrapper.style.top = `${mv.clientY - containerRect.top + container.scrollTop - offsetY}px`;
                };
                
                const onUp = async (up) => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    wrapper.style.zIndex = 10;
                    wrapper.style.transition = 'transform 0.2s ease';
                    
                    if (isDragging) {
                        // Salva os dados se ocorreu movimento
                        let data = await this._getCitizensData();
                        let loc = data.locations.find(l => l.id === this.activePageId);
                        let grp = loc?.groups.find(g => g.id === this.activeGroupId);
                        let npc = grp?.npcs.find(n => n.actorId === wrapper.dataset.npcId);
                        if (npc) {
                            npc.x = parseFloat(wrapper.style.left);
                            npc.y = parseFloat(wrapper.style.top);
                            await this._saveCitizensData(data);
                        }
                        
                        // Remove a flag após um pequeno intervalo para bloquear o engate de 'click'
                        setTimeout(() => {
                            wrapper.dataset.dragged = "false";
                        }, 50);
                    } else {
                        wrapper.dataset.dragged = "false";
                    }
                };
                
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
    }

    async _prepareContext(options) {
        let data = await this._getCitizensData();
        let pages = [];
        let groups = [];
        let activeNPCs = [];
        let locationFlag = null;
        let publicOpinion = 50; 
        let opinionTooltip = "0%";

        if (data.locations && data.locations.length > 0) {
            pages = data.locations.map(l => ({
                id: l.id,
                name: l.name,
                active: false,
                isHidden: l.isHidden || false
            }));

            if (!game.user.isGM) pages = pages.filter(p => !p.isHidden);

            if (pages.length > 0) {
                if (!this.activePageId || !pages.find(p => p.id === this.activePageId)) {
                    this.activePageId = pages[0].id;
                }
                const activePageObj = pages.find(p => p.id === this.activePageId);
                if (activePageObj) activePageObj.active = true;

                const activeLoc = data.locations.find(l => l.id === this.activePageId);
                if (activeLoc) {
                    publicOpinion = activeLoc.publicOpinion ?? 50;
                    const opinionValue = Math.round((publicOpinion - 50) * 2);
                    opinionTooltip = `${opinionValue > 0 ? '+' : ''}${opinionValue}%`;
                    locationFlag = activeLoc.locationFlag || null;

                    if (activeLoc.groups) {
                        groups = activeLoc.groups.map(g => ({
                            id: g.id,
                            name: g.name,
                            active: false,
                            isHidden: g.isHidden || false
                        }));

                        if (!game.user.isGM) groups = groups.filter(g => !g.isHidden);

                        if (groups.length > 0) {
                            if (!this.activeGroupId || !groups.find(g => g.id === this.activeGroupId)) {
                                this.activeGroupId = groups[0].id;
                            }
                            const activeGroupObj = groups.find(g => g.id === this.activeGroupId);
                            if (activeGroupObj) activeGroupObj.active = true;

                            const activeGrp = activeLoc.groups.find(g => g.id === this.activeGroupId);
                            if (activeGrp && activeGrp.npcs) {
                                activeNPCs = activeGrp.npcs.map(npc => {
                                    const actor = game.actors.get(npc.actorId);
                                    if (!actor) return null;
                                    const isHidden = npc.isHidden || false;
                                    
                                    return {
                                        name: actor.name,
                                        nickname: actor.getFlag('ui-redesign', 'nickname') || "",
                                        displayName: isHidden ? "Desconhecido" : actor.name,
                                        img: actor.img,
                                        mask: actor.getFlag('ui-redesign', 'mask') || null,
                                        id: npc.actorId,
                                        style: `position: absolute; left: ${npc.x}px; top: ${npc.y}px; z-index: 10;`,
                                        isHidden: isHidden
                                    };
                                }).filter(n => n !== null);
                            }
                        }
                    }
                }
            }
        }
        
        return { pages, groups, activeNPCs, locationFlag, publicOpinion, opinionTooltip, isGM: game.user.isGM };
    }
}
