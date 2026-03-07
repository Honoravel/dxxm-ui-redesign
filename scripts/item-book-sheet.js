/* item-book-sheet.js - DXXM Redesign V3.11 */

import { DXXMUtils } from "./utils.js";

export function registerBookSheetV3() {
    const bookSheets = CONFIG.Item.sheetClasses.book || {};
    
    const baseBookConfig = bookSheets["CoC7.CoC7ItemBookSheet"] 
                        || bookSheets["CoC7ItemBookSheet"] 
                        || Object.values(bookSheets)[0];

    if (!baseBookConfig) {
        console.error("UI-Redesign | Erro: Nenhuma ficha base de 'book' encontrada.");
        return;
    }

    const BaseBookSheet = baseBookConfig.cls;

    class DXXMBookSheetV3 extends BaseBookSheet {
        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                classes: ["coc7", "sheet", "item", "dxxm-item-v3", "dxxm-book-v3"],
                template: "modules/ui-redesign/templates/item-book-sheetV3.html",
                width: 380,
                height: 600,
                resizable: true,
                tabs: [{ 
                    navSelector: ".dxxm-v3-tabs", 
                    contentSelector: ".dxxm-group-body", 
                    initial: "description" 
                }]
            });
        }

async getData(options) {
            const context = await super.getData(options);
            context.isKeeper = game.user.isGM;
            context.editable = this.isEditable;
            context.owner = this.item.isOwner;
            context.tabsActive = localStorage.getItem(`dxxm-tabs-state-${this.item.id}`) === "true";

            // Correção Versão 13: Uso do namespace completo e proteção contra campos indefinidos
            context.enrichedDescriptionValue = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.item.system.description?.value || "", { async: true });
            context.enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.item.system.content || "", { async: true });
            context.enrichedDescriptionKeeper = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.item.system.description?.keeper || "", { async: true });

            context.difficultyLevels = {
                "0": game.i18n.localize("CoC7.Normal"),
                "1": game.i18n.localize("CoC7.Hard"),
                "2": game.i18n.localize("CoC7.Extreme")
            };

            context.otherGains = {
                "1": "1",
                "1d3": "1d3",
                "1d4": "1d4",
                "1d6": "1d6",
                "1d10": "1d10",
                "2d6": "2d6"
            };

            const itemImg = this.item.img || "";
            let headerIcon = "fa-solid fa-book"; 
            if (itemImg.includes("fa_")) {
                try {
                    const fileName = itemImg.split('/').pop().split('.')[0]; 
                    let converted = fileName.replaceAll('_', '-');
                    headerIcon = converted.replace(/^(fa-[a-z]+)-fa-/, '$1 fa-');
                } catch (e) {}
            }
            context.headerIcon = headerIcon;
            this.dxxmHeaderIcon = headerIcon;

            return context;
        }

        render(force = false, options = {}) {
            options = options || {};

            if (!this.rendered) {
                const savedPos = localStorage.getItem(`dxxm-pos-${this.item.id}`);
                if (savedPos) try { foundry.utils.mergeObject(options, JSON.parse(savedPos)); } catch(e) {}
            }

            const savedTab = localStorage.getItem(`dxxm-active-tab-${this.item.id}`);
            if (savedTab) {
                options.tabs = [{ 
                    navSelector: ".dxxm-v3-tabs", 
                    contentSelector: ".dxxm-group-body", 
                    initial: savedTab 
                }];
            }

            return super.render(force, options);
        }

        activateListeners(html) {
            super.activateListeners(html);

            const windowHeaderTitle = this.element[0]?.querySelector('.window-header .window-title');
            if (windowHeaderTitle) {
                const iconClass = this.dxxmHeaderIcon || "fa-solid fa-book";
                windowHeaderTitle.innerHTML = `<i class="${iconClass} dxxm-header-icon" style="margin-left: 5px;"></i>${this.item.name}`;
            }

            html.find('.dxxm-group-icon img').contextmenu(async ev => {
                if (!this.isEditable) return;
                ev.preventDefault();
                DXXMUtils.generateFAIcon(this.item);
            });

            const isTabsStoredOpen = localStorage.getItem(`dxxm-tabs-state-${this.item.id}`) === "true";
            const tabsToggle = html.find('.dxxm-tabs-toggle');
            const tabsNav = html.find('.dxxm-group-tabs');

            if (isTabsStoredOpen) { tabsToggle.addClass('active'); tabsNav.show(); }

            tabsToggle.click(ev => {
                ev.preventDefault();
                tabsToggle.toggleClass('active');
                const newState = tabsToggle.hasClass('active');
                localStorage.setItem(`dxxm-tabs-state-${this.item.id}`, newState.toString());
                tabsNav.slideToggle(200, () => { this.setPosition(); });
            });

            const body = html.find('.dxxm-group-body')[0];
            const indicator = html.find('.scroll-indicator')[0];

            if (body && indicator) {
                this._dxxmScrollObserver = DXXMUtils.setupScrollIndicator(body, indicator);
            }

            html.find('.dxxm-v3-tabs .item').click(ev => {
                const tab = ev.currentTarget.dataset.tab;
                if (tab) localStorage.setItem(`dxxm-active-tab-${this.item.id}`, tab);
            });

            if (!this.options.editable) return;

            html.find('.dxxm-type-btn').click(async ev => {
                const type = ev.currentTarget.querySelector('input').name;
                const value = !foundry.utils.getProperty(this.item, type);
                await this.item.update({ [type]: value });
            });

            html.find('#increase-progress').click(async () => {
                const current = this.item.system.study.progress || 0;
                const max = this.item.system.study.necessary || 0;
                if (current < max) await this.item.update({ "system.study.progress": current + 1 });
            });

            html.find('#decrease-progress').click(async () => {
                const current = this.item.system.study.progress || 0;
                if (current > 0) await this.item.update({ "system.study.progress": current - 1 });
            });

            html.find('.add-other-gains').click(async () => {
                const others = foundry.utils.deepClone(this.item.system.gains.others || []);
                others.push({ name: "Nova Perícia", value: "1" });
                await this.item.update({ "system.gains.others": others });
            });

            html.find('.remove-other-gains').click(async ev => {
                const idx = parseInt(ev.currentTarget.closest('.dxxm-skill-row').dataset.index);
                const others = foundry.utils.deepClone(this.item.system.gains.others);
                others.splice(idx, 1);
                await this.item.update({ "system.gains.others": others });
            });

            html.find('.change-other-gains').change(async ev => {
                const idx = parseInt(ev.currentTarget.closest('.dxxm-skill-row').dataset.index);
                const others = foundry.utils.deepClone(this.item.system.gains.others);
                if (ev.currentTarget.tagName === "INPUT") others[idx].name = ev.currentTarget.value;
                else others[idx].value = ev.currentTarget.value;
                await this.item.update({ "system.gains.others": others });
            });

            html.find('.edit-spell').off('click').click(ev => {
                ev.preventDefault();
                const id = ev.currentTarget.closest('.spell').dataset.id;
                const spellData = this.item.system.spells.find(s => s._id === id);
                if (spellData) {
                    const item = new Item.implementation(spellData);
                    item.update = async (updateData) => {
                        const spells = foundry.utils.deepClone(this.item.system.spells);
                        const index = spells.findIndex(s => s._id === id);
                        if (index !== -1) {
                            spells[index] = foundry.utils.mergeObject(spells[index], updateData);
                            return this.item.update({ "system.spells": spells });
                        }
                    };
                    item.sheet.render(true);
                }
            });

            html.find('.delete-spell').off('click').click(async ev => {
                ev.preventDefault();
                const id = ev.currentTarget.closest('.spell').dataset.id;
                const spells = this.item.system.spells.filter(s => s._id !== id);
                await this.item.update({ "system.spells": spells });
            });
        }

        async _onDrop(event) {
            if (!this.isEditable) return;
            const data = event.dataTransfer.getData('text/plain') ? JSON.parse(event.dataTransfer.getData('text/plain')) : null;
            if (!data || data.type !== "Item") return super._onDrop(event);

            const droppedItem = await Item.fromDropData(data);
            
            // Lógica para Magias
            if (droppedItem.type === "spell") {
                const spells = foundry.utils.deepClone(this.item.system.spells || []);
                if (spells.find(s => s._id === droppedItem.id)) return;
                spells.push(droppedItem.toObject());
                return await this.item.update({ "system.spells": spells });
            }

            // Lógica para Perícias (Skills)
            if (droppedItem.type === "skill") {
                const others = foundry.utils.deepClone(this.item.system.gains.others || []);
                if (others.find(s => s.name === droppedItem.name)) return;
                others.push({ name: droppedItem.name, value: "1d6" });
                return await this.item.update({ "system.gains.others": others });
            }

            return super._onDrop(event);
        }

        async close(options) {
            if (this._dxxmScrollObserver) {
                this._dxxmScrollObserver.disconnect();
                delete this._dxxmScrollObserver;
            }

            const pos = { left: this.position.left, top: this.position.top, width: this.position.width, height: this.position.height };
            localStorage.setItem(`dxxm-pos-${this.item.id}`, JSON.stringify(pos));
            return super.close(options);
        }
    }

    foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, "ui-redesign", DXXMBookSheetV3, {
        types: ["book"],
        makeDefault: true,
        label: "DXXM Livro V3"
    });
}
