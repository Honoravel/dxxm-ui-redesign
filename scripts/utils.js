/* scripts/utils.js - v6.1 (Pro: Group-Grid Architecture + FA Icon Generator + Scroll Indicator) */

export const DXXMUtils = {
    /**
     * Gerencia o indicador de scroll para qualquer container.
     * @param {HTMLElement} body - O elemento que possui o scroll.
     * @param {HTMLElement} indicator - O elemento do ícone indicador.
     * @returns {ResizeObserver} - Retorna o observer para ser desconectado no close() da sheet.
     */
    setupScrollIndicator(body, indicator) {
        if (!body || !indicator) return null;

        const updateScroll = () => {
            const isScrollable = body.scrollHeight > (body.clientHeight + 1);
            const isAtBottom = (body.scrollTop + body.clientHeight) >= (body.scrollHeight - 15);
            
            if (isScrollable && !isAtBottom) indicator.classList.add('visible');
            else indicator.classList.remove('visible');
        };

        // Inicia o Observer
        const observer = new ResizeObserver(() => updateScroll());
        observer.observe(body);

        // Listener de scroll manual
        body.addEventListener('scroll', updateScroll);

        // Execução inicial
        updateScroll();

        return observer;
    },

    /**
     * Alterna a visibilidade (hidden) de um item e persiste no banco de dados.
     * @param {Object|Array} data - Fonte de dados (Slots ou Containers).
     * @param {string} id - ID único do elemento.
     * @param {string} settingKey - Chave da configuração no Foundry.
     */
    async toggleVisibility(data, id, settingKey) {
        if (Array.isArray(data)) {
            const index = data.findIndex(c => c.id === id);
            if (index !== -1) data[index].hidden = !data[index].hidden;
        } else {
            if (!data[id]) data[id] = { hasItem: false, hidden: false };
            data[id].hidden = !data[id].hidden;
        }
        await game.settings.set('ui-redesign', settingKey, data);
        return data;
    },

    /**
     * Gerenciamento de persistência de posição da janela.
     */
    async saveWindowPosition(key, position) {
        if (!position?.top) return;
        await game.settings.set('ui-redesign', key, { 
            top: position.top, 
            left: position.left,
            width: position.width,
            height: position.height 
        });
    },

    getWindowPosition(key) {
        try { return game.settings.get('ui-redesign', key) || null; } 
        catch (e) { return null; }
    },

    /**
     * Interface de prompt para renomeação rápida.
     */
    async renameDialog(title, currentText = "") {
        const content = `
            <div class="form-group">
                <label>Novo Nome:</label>
                <input type="text" name="newName" value="${currentText}" autofocus style="width: 100%;">
            </div>`;
        try {
            return await foundry.applications.api.DialogV2.prompt({
                window: { title },
                content,
                ok: { label: "Salvar", callback: (event, button) => new FormDataExtended(button.form).object.newName },
                rejectClose: false
            });
        } catch (e) { return null; }
    },

    /**
     * Gerador Global de Ícones FontAwesome (Fundo Transparente + Cor #302831)
     */
    async generateFAIcon(item) {
        if (!item) return;

        new Dialog({
            title: `DXXM | Gerador de Ícone: ${item.name}`,
            content: `
                <div style="padding: 10px; font-family: 'Signika', sans-serif;">
                    <p style="margin-bottom: 10px;">Insira a classe do FontAwesome (ex: <b>fas fa-book-dead</b>):</p>
                    <div style="display: flex; gap: 5px; align-items: center; background: rgba(0,0,0,0.05); padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <i class="fas fa-search" style="color: #302831;"></i>
                        <input type="text" id="fa-class-input" placeholder="ex: fas fa-skull" style="flex: 1; border: none; background: transparent;">
                    </div>
                </div>
            `,
            buttons: {
                generate: {
                    icon: '<i class="fas fa-magic"></i>',
                    label: "Gerar e Aplicar",
                    callback: async (html) => {
                        const iconClass = html.find('#fa-class-input').val().trim();
                        if (!iconClass) return ui.notifications.warn("Classe vazia.");

                        try {
                            ui.notifications.info("Gerando ícone transparente...");
                            const path = await this._processIconImage(iconClass);
                            await item.update({ img: path });
                        } catch (err) {
                            console.error(err);
                            ui.notifications.error("Erro ao gerar ícone.");
                        }
                    }
                }
            },
            default: "generate"
        }).render(true);
    },

    async _processIconImage(iconClass) {
        const tempI = document.createElement("i");
        tempI.className = iconClass;
        tempI.style.visibility = "hidden";
        tempI.style.position = "absolute";
        document.body.appendChild(tempI);
        
        const style = window.getComputedStyle(tempI, ':before');
        const content = style.getPropertyValue('content').replace(/['"]/g, '');
        const fontFamily = style.getPropertyValue('font-family');
        const fontWeight = style.getPropertyValue('font-weight');
        document.body.removeChild(tempI);

        if (!content || content === "none") throw new Error("Ícone inválido.");

        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");

        // Fundo Transparente (Limpando o canvas por segurança)
        ctx.clearRect(0, 0, size, size);

        // Estilização do Glifo
        ctx.font = `${fontWeight} 186px ${fontFamily}`;
        ctx.fillStyle = "#302831"; // Cor do Ícone solicitada
        ctx.textAlign = "center"; 
        ctx.textBaseline = "middle";
        ctx.fillText(content, size / 2, size / 2);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp"));
        const safeName = iconClass.replace(/[^a-zA-Z0-9]/g, '_');
        const folder = `worlds/${game.world.id}/fa-icons`;

        try { await FilePicker.browse("data", folder); } 
        catch (e) { await FilePicker.createDirectory("data", folder); }

        const file = new File([blob], `${safeName}.webp`, { type: "image/webp" });
        const result = await FilePicker.upload("data", folder, file);
        return result.path;
    },

    /**
     * GridManager: Motor lógico para grades modulares dxxm.
     */
    GridManager: {
        /**
         * Transforma dados brutos em estrutura iterável para o Handlebars.
         */
        prepareContext(gridConfig, containers, slotsData) {
            const totalItems = (gridConfig.itemRows || 1) * (gridConfig.itemCols || 1);
            return containers.map(c => {
                const slots = [];
                for (let si = 1; si <= totalItems; si++) {
                    const slotId = `${c.id}-slot-${si}`;
                    slots.push({ id: slotId, data: slotsData[slotId] || { hasItem: false } });
                }
                return { ...c, slots };
            });
        },

        /**
         * Interface técnica para reconfigurar dimensões do grid.
         */
        async configureGrid(settingPrefix, currentConfig, currentContainers) {
            const content = `
                <form class="dxxm-grid-config-form">
                    <div class="form-group"><label>Qtd. Grupos:</label><input type="number" name="count" value="${currentContainers.length}"></div>
                    <div class="form-group"><label>Colunas (Main):</label><input type="number" name="containerCols" value="${currentConfig.containerCols}"></div>
                    <div></div>
                    <div class="form-group"><label>Colunas (Itens):</label><input type="number" name="itemCols" value="${currentConfig.itemCols}"></div>
                    <div class="form-group"><label>Linhas (Itens):</label><input type="number" name="itemRows" value="${currentConfig.itemRows}"></div>
                </form>`;

            const result = await foundry.applications.api.DialogV2.confirm({
                window: { title: "Configuração de Layout" },
                content,
                yes: { label: "Aplicar", callback: (ev, btn) => new FormDataExtended(btn.form).object }
            });

            if (result) {
                const newConfig = { 
                    containerCols: Number(result.containerCols), 
                    itemCols: Number(result.itemCols), 
                    itemRows: Number(result.itemRows) 
                };
                const newContainers = Array.from({ length: Number(result.count) }, (_, i) => 
                    currentContainers[i] || { id: foundry.utils.randomID(), name: "Novo Grupo" }
                );
                await game.settings.set('ui-redesign', `${settingPrefix}-grid-config`, newConfig);
                await game.settings.set('ui-redesign', `${settingPrefix}-containers`, newContainers);
                return { newConfig, newContainers };
            }
            return null;
        },

        /**
         * Inicializa ouvintes de eventos vinculados às novas classes group-grid.
         * Default: .group-grid-slots-unitary e .group-grid-header
         */
        setupEventListeners(html, { 
            app, settingPrefix, onLeftClick, onRightClick, onHeaderClick, onToggleVisibility,
            slotSelector = ".group-grid-slots-unitary", 
            headerSelector = ".group-grid-header" 
        }) {
            // Eventos dos Slots (Itens)
            html.querySelectorAll(slotSelector).forEach(slot => {
                const slotId = slot.dataset.slot;

                slot.addEventListener('click', (ev) => onLeftClick(ev, slotId));

                slot.addEventListener('contextmenu', async (ev) => {
                    ev.preventDefault();
                    if (ev.shiftKey && game.user.isGM) {
                        if (onToggleVisibility) return onToggleVisibility(ev, slotId);
                        app.slotsData = await DXXMUtils.toggleVisibility(app.slotsData, slotId, `${settingPrefix}-slots-data`);
                        return app.render();
                    }
                    onRightClick(ev, slotId);
                });
            });

            // Eventos dos Cabeçalhos (Apenas GM)
            if (game.user.isGM) {
                html.querySelectorAll(headerSelector).forEach(header => {
                    const containerId = header.dataset.container;

                    header.addEventListener('contextmenu', async (ev) => {
                        ev.preventDefault();
                        if (ev.shiftKey) {
                            app.containers = await DXXMUtils.toggleVisibility(app.containers, containerId, `${settingPrefix}-containers`);
                            return app.render();
                        }
                        onHeaderClick(ev, containerId);
                    });
                });
            }
        }
    }
};
