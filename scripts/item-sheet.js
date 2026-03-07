/* item-sheet.js - v4.6.16 (Refatorado com Utils - Scroll Indicator) */

import { DXXMUtils } from "./utils.js";

export function registerItemSheetV3() {
    const baseClassConfig = CONFIG.Item.sheetClasses.item?.["CoC7.CoC7ItemSheetV2"];
    if (!baseClassConfig) return console.error("UI-Redesign | FALHA CRÍTICA: A ficha base não foi encontrada.");
    const BaseItemSheet = baseClassConfig.cls;

    class DXXMItemSheetV3 extends BaseItemSheet {
        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                classes: ["coc7", "sheet", "item", "dxxm-item-v3"],
                template: "modules/ui-redesign/templates/item-sheetV3.html",
                width: 355,
                height: 540,
                tabs: [{ 
                    navSelector: ".dxxm-v3-tabs", 
                    contentSelector: ".dxxm-group-body", 
                    initial: "description" 
                }]
            });
        }

        async getData(options) {
            const context = await super.getData(options);
            context.editable = this.isEditable;
            context.owner = this.item.isOwner;
            context.isKeeper = game.user.isGM;
            context.tabsActive = localStorage.getItem(`dxxm-tabs-state-${this.item.id}`) === "true";
            
            let priceIcon = "fa-tag";
            try { 
                priceIcon = game.settings.get("ui-redesign", "currency-icon") || "fa-tag";
            } catch(e) {}
            context.priceIcon = priceIcon;

            const itemImg = this.item.img || "";
            let headerIcon = "fa-solid fa-box"; 
            if (itemImg.includes("fa_")) {
                try {
                    const fileName = itemImg.split('/').pop().split('.')[0]; 
                    headerIcon = fileName.replaceAll('_', '-').replace(/^(fa-[a-z]+)-fa-/, '$1 fa-');
                } catch (e) {}
            }
            context.headerIcon = headerIcon;
            this.dxxmHeaderIcon = headerIcon;

            // LÓGICA DEFINITIVA DE ERAS (Usando os IDs exatos descobertos)
            const basePrices = this.item.system.price || {};
            let availableEras = [];

            // 1. Tenta usar as eras já processadas pelo sistema base (como visto no console)
            if (context._eras && context._eras.length > 0) {
                availableEras = context._eras;
            } else {
                // 2. Fallback com os IDs reais da base de dados do CoC7
                availableEras = [
                    { id: "standard", name: "Anos 1920" },
                    { id: "modern", name: "Moderno" },
                    { id: "gasLight", name: "Cthulhu Era Vitoriana" },
                    { id: "pulp", name: "Cthulhu Pulp" }
                ];
            }

            // Mapeia garantindo o estado isEnabled diretamente da base de dados do item
            context._eras = availableEras.map(era => ({
                id: era.id,
                name: era.name,
                isEnabled: basePrices[era.id] !== undefined && basePrices[era.id] !== null,
                price: basePrices[era.id] || ""
            }));

            // Era do Mundo (Fallback para 'standard' / 1920s)
            context.worldEra = game.settings.get("CoC7", "worldEra") || "standard";

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
                options.tabs = [{ navSelector: ".dxxm-v3-tabs", contentSelector: ".dxxm-group-body", initial: savedTab }];
            }
            return super.render(force, options);
        }

        activateListeners(html) {
            super.activateListeners(html);

            const windowHeaderTitle = this.element[0]?.querySelector('.window-header .window-title');
            if (windowHeaderTitle) {
                const iconClass = this.dxxmHeaderIcon || "fa-solid fa-box";
                windowHeaderTitle.innerHTML = `<i class="${iconClass} dxxm-header-icon" style="margin-left: 5px;"></i>${this.item.name}`;
            }

            html.find('.dxxm-group-icon img').contextmenu(ev => {
                ev.preventDefault();
                if (this.isEditable) DXXMUtils.generateFAIcon(this.item);
            });

            const isTabsStoredOpen = localStorage.getItem(`dxxm-tabs-state-${this.item.id}`) === "true";
            const tabsToggle = html.find('.dxxm-tabs-toggle');
            const tabsNav = html.find('.dxxm-group-tabs');

            if (isTabsStoredOpen) { tabsToggle.addClass('active'); tabsNav.show(); }

            tabsToggle.click(ev => {
                ev.preventDefault();
                tabsToggle.toggleClass('active');
                localStorage.setItem(`dxxm-tabs-state-${this.item.id}`, tabsToggle.hasClass('active').toString());
                tabsNav.slideToggle(200, () => this.setPosition());
            });

            html.find('.toggle-switch[data-action="set-currency"]').click(async ev => {
                ev.preventDefault();
                const icon = ev.currentTarget.dataset.icon;
                await game.settings.set("ui-redesign", "currency-icon", icon);
                this.render();
            });

            // ATUALIZAÇÃO DA BASE DE DADOS AO CLICAR NA ERA
            html.find('.dxxm-era-pill').click(async (ev) => {
                ev.preventDefault();
                ev.stopPropagation(); 
                
                const eraId = ev.currentTarget.dataset.property;
                const currentPrice = this.item.system.price?.[eraId];
                const isEnabled = currentPrice !== undefined && currentPrice !== null;

                if (isEnabled) {
                    await this.item.update({ [`system.price.-=${eraId}`]: null });
                } else {
                    const updateData = { "system.price": {} };
                    updateData[`system.price.${eraId}`] = "";
                    await this.item.update(updateData);
                }
            });

            // Lógica do Scroll Indicator usando Utils
            const body = html.find('.dxxm-group-body')[0];
            const indicator = html.find('.scroll-indicator')[0];
            
            if (body && indicator) {
                this._dxxmScrollObserver = DXXMUtils.setupScrollIndicator(body, indicator);
            }

            html.find('.dxxm-v3-tabs .item').click(ev => {
                localStorage.setItem(`dxxm-active-tab-${this.item.id}`, ev.currentTarget.dataset.tab);
                // setTimeout removidos, o Observer cuida disso
            });
            // setTimeout(updateScroll, 300) removido
        }

        async close(options) {
            // Limpeza do Observer para evitar memory leak
            if (this._dxxmScrollObserver) {
                this._dxxmScrollObserver.disconnect();
                delete this._dxxmScrollObserver;
            }

            const pos = { left: this.position.left, top: this.position.top, width: this.position.width, height: this.position.height };
            localStorage.setItem(`dxxm-pos-${this.item.id}`, JSON.stringify(pos));
            return super.close(options);
        }
    }

    foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, "ui-redesign", DXXMItemSheetV3, {
        types: ["item", "weapon", "armor"],
        makeDefault: true,
        label: "DXXM Item V3"
    });
}
