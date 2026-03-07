/* scripts/citizens.js */
import { DXXMUtils } from "./utils.js";
import { DXXMInvestigation } from "./investigation.js"; // Importado para integração com a nova janela

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

    _onRender(context, options) {
        super._onRender(context, options);

        const journal = game.journal.getName("Banco de Personagens");

        // Eventos para as abas de páginas (Locais)
        const pageTabs = this.element.querySelectorAll('.page-tab');
        pageTabs.forEach(tab => {
            tab.addEventListener('click', (event) => {
                this.activePageId = event.currentTarget.dataset.page;
                this.activeGroupId = null;
                this.render(true);
            });

            // Ocultar/Revelar Página (Shift + Clique Direito) - Apenas GM
            tab.addEventListener('contextmenu', async (event) => {
                if (game.user.isGM && event.shiftKey) {
                    event.preventDefault();
                    const pageId = event.currentTarget.dataset.page;
                    const page = journal?.pages.get(pageId);
                    if (page) {
                        const isHidden = page.getFlag('ui-redesign', 'isHidden') || false;
                        await page.setFlag('ui-redesign', 'isHidden', !isHidden);
                        this.render(true);
                    }
                }
            });
        });

        // Eventos para as abas de grupos (Sub-categorias)
        const groupTabs = this.element.querySelectorAll('.group-tab');
        groupTabs.forEach(tab => {
            tab.addEventListener('click', (event) => {
                this.activeGroupId = event.currentTarget.dataset.group;
                this.render(true);
            });

            // Ocultar/Revelar Grupo (Shift + Clique Direito) - Apenas GM
            tab.addEventListener('contextmenu', async (event) => {
                if (game.user.isGM && event.shiftKey) {
                    event.preventDefault();
                    const groupId = event.currentTarget.dataset.group;
                    const page = journal?.pages.get(this.activePageId);
                    if (page) {
                        const hiddenGroups = page.getFlag('ui-redesign', 'hiddenGroups') || {};
                        hiddenGroups[groupId] = !hiddenGroups[groupId];
                        await page.setFlag('ui-redesign', 'hiddenGroups', hiddenGroups);
                        this.render(true);
                    }
                }
            });
        });

        // Lógica da Opinião Pública (Apenas GM)
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
                        const page = journal?.pages.get(this.activePageId);
                        if (page) await page.setFlag('ui-redesign', 'publicOpinion', percentage);
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

        // Lógica de Retratos (Clique para Investigação, Arraste e Ocultação)
        const container = this.element.querySelector('.citizens-portrait-container');
        const wrappers = this.element.querySelectorAll('.citizen-portrait-wrapper');
        wrappers.forEach(wrapper => {
            
            // Clique para abrir Investigação e FECHAR Citizens
            wrapper.addEventListener('click', (event) => {
                if (event.button !== 0) return; // Apenas clique esquerdo
                
                const npcId = wrapper.dataset.npcId;
                const npcData = context.activeNPCs.find(n => n.id === npcId);
                
                // --- NOVO: Captura o nome do grupo atual para enviar ao Investigation ---
                const currentGroup = context.groups.find(g => g.id === this.activeGroupId);
                const groupName = currentGroup ? currentGroup.name : "Geral";
                
                // Abre a investigação apenas se o NPC não estiver marcado como oculto
                if (npcData && !npcData.isHidden) {
                    // ALTERADO: Passando o groupName como 4º parâmetro
                    DXXMInvestigation.openForNPC(npcData.name, npcData.img, npcData.mask, groupName);
                    this.close(); // Fecha a Agenda de Contatos
                }
            });

            // Clique Direito para Ocultação (GM)
            wrapper.addEventListener('contextmenu', async (e) => {
                if (game.user.isGM && e.shiftKey) {
                    e.preventDefault(); e.stopPropagation();
                    const npcId = wrapper.dataset.npcId;
                    const page = journal?.pages.get(this.activePageId);
                    if (npcId && page) {
                        const currentHidden = page.getFlag('ui-redesign', `npcHidden.${this.activeGroupId}.${npcId}`) || false;
                        await page.setFlag('ui-redesign', `npcHidden.${this.activeGroupId}.${npcId}`, !currentHidden);
                        this.render(true);
                    }
                }
            });

            // Arraste de NPC (GM)
            wrapper.addEventListener('mousedown', (e) => {
                if (!game.user.isGM || e.button !== 0 || !e.shiftKey) return;
                const containerRect = container.getBoundingClientRect();
                const wrapperRect = wrapper.getBoundingClientRect();
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
                    wrapper.style.left = `${mv.clientX - containerRect.left + container.scrollLeft - offsetX}px`;
                    wrapper.style.top = `${mv.clientY - containerRect.top + container.scrollTop - offsetY}px`;
                };
                const onUp = async (up) => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    wrapper.style.zIndex = 10;
                    wrapper.style.transition = 'transform 0.2s ease';
                    if (isDragging) {
                        const page = journal?.pages.get(this.activePageId);
                        if (page) await page.setFlag('ui-redesign', `npcPositions.${this.activeGroupId}.${wrapper.dataset.npcId}`, { x: parseFloat(wrapper.style.left), y: parseFloat(wrapper.style.top) });
                    }
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
    }

    async _prepareContext(options) {
        const journal = game.journal.getName("Banco de Personagens");
        let pages = [];
        let groups = [];
        let activeNPCs = [];
        let locationFlag = null;
        let publicOpinion = 50; 
        let opinionTooltip = "0%";

        if (journal && journal.pages.size > 0) {
            pages = journal.pages.contents.map(p => ({
                id: p.id,
                name: p.name,
                active: false,
                isHidden: p.getFlag('ui-redesign', 'isHidden') || false
            }));

            if (!game.user.isGM) pages = pages.filter(p => !p.isHidden);

            if (!this.activePageId || !pages.find(p => p.id === this.activePageId)) {
                this.activePageId = pages[0]?.id;
            }

            const activePageObj = pages.find(p => p.id === this.activePageId);
            if (activePageObj) activePageObj.active = true;

            const activePage = journal.pages.get(this.activePageId);
            
            if (activePage) {
                publicOpinion = activePage.getFlag('ui-redesign', 'publicOpinion') ?? 50;
                const opinionValue = Math.round((publicOpinion - 50) * 2);
                opinionTooltip = `${opinionValue > 0 ? '+' : ''}${opinionValue}%`;

                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = activePage.text.content;
                const firstImg = tempDiv.querySelector('img');
                if (firstImg) { locationFlag = firstImg.getAttribute('src'); firstImg.remove(); }

                tempDiv.querySelectorAll('p, br, h1, h2, h3, h4, h5, h6').forEach(el => el.prepend('\n'));
                tempDiv.querySelectorAll('h1').forEach(h1 => { h1.prepend('[[[H1_START]]]'); h1.append('[[[H1_END]]]'); });

                let fullText = tempDiv.innerText;
                let lines = fullText.split('\n').map(l => l.trim());
                let firstIdx = lines.findIndex(l => l.length > 0);
                if (firstIdx !== -1 && !locationFlag && lines[firstIdx].match(/\.(png|webp|jpg|jpeg|gif|svg)$/i)) {
                    locationFlag = lines[firstIdx];
                    lines.splice(firstIdx, 1);
                    fullText = lines.join('\n');
                }
                
                let textToParse = "";
                if (fullText.includes('[[[H1_START]]]')) {
                    const parts = fullText.split('[[[H1_START]]]');
                    let groupIdCounter = 0;
                    const hiddenGroups = activePage.getFlag('ui-redesign', 'hiddenGroups') || {};
                    parts.forEach((part) => {
                        if (part.trim() === '' || !part.includes('[[[H1_END]]]')) return;
                        const splitPart = part.split('[[[H1_END]]]');
                        const groupId = `group-${groupIdCounter++}`;
                        groups.push({ id: groupId, name: splitPart[0].trim(), text: splitPart[1] || '', active: false, isHidden: hiddenGroups[groupId] || false });
                    });

                    if (!game.user.isGM) groups = groups.filter(g => !g.isHidden);

                    if (groups.length > 0) {
                        if (!this.activeGroupId || !groups.find(g => g.id === this.activeGroupId)) this.activeGroupId = groups[0].id;
                        const activeGroupInfo = groups.find(g => g.id === this.activeGroupId);
                        if (activeGroupInfo) { activeGroupInfo.active = true; textToParse = activeGroupInfo.text; }
                    }
                } else { textToParse = fullText; }

                if (textToParse) {
                    const regex = /([^|\n]+)\|([^|\n]+)\|([^|\n]+)(?:\|([^|\n]+))?/g;
                    const matches = [...textToParse.matchAll(regex)];
                    const savedPositions = activePage?.getFlag('ui-redesign', `npcPositions.${this.activeGroupId}`) || {};
                    const savedHidden = activePage?.getFlag('ui-redesign', `npcHidden.${this.activeGroupId}`) || {};
                    activeNPCs = matches.map((match, index) => {
                        const name = match[1]?.trim();
                        const npcId = `npc_${index}_${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
                        const pos = savedPositions[npcId];
                        const isHidden = savedHidden[npcId] || false;
                        return { name, nickname: match[2]?.trim(), displayName: isHidden ? "Desconhecido" : name, img: match[3]?.trim(), mask: match[4]?.trim(), id: npcId, style: pos ? `position: absolute; left: ${pos.x}px; top: ${pos.y}px; z-index: 10;` : '', isHidden };
                    });
                }
            }
        }
        return { pages, groups, activeNPCs, locationFlag, publicOpinion, opinionTooltip, isGM: game.user.isGM };
    }
}
