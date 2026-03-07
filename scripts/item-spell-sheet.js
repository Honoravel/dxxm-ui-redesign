/* item-spell-sheet.js - v1.2.4 (Refatorado com Utils - Scroll Indicator) */
import { DXXMUtils } from "./utils.js";

export function registerSpellSheetV3() {
    const spellClasses = CONFIG.Item.sheetClasses.spell;
    const baseClassConfig = spellClasses?.["CoC7.CoC7ItemSheetV2"] || (spellClasses ? Object.values(spellClasses)[0] : null);
    
    if (!baseClassConfig) return console.error("UI-Redesign | Erro: Ficha base de Spell não encontrada.");

    const BaseSpellSheet = baseClassConfig.cls;

    class DXXMSpellSheetV3 extends BaseSpellSheet {
        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                classes: ["coc7", "sheet", "item", "dxxm-item-v3", "dxxm-spell-v3"],
                template: "modules/ui-redesign/templates/item-spell-sheetV3.html", 
                width: 380,
                height: 580,
                resizable: true,
                tabs: [{ navSelector: ".dxxm-v3-tabs", contentSelector: ".dxxm-group-body", initial: "description" }]
            });
        }

        async getData(options) {
            const context = await super.getData(options);
            
            context.isKeeper = game.user.isGM;
            context.editable = this.isEditable;
            context.owner = this.item.isOwner;
            context.canCast = this.item.isOwner || game.user.isGM;
            context.tabsActive = localStorage.getItem(`dxxm-tabs-state-${this.item.id}`) === "true";

            const spellTypes = this.item.system.type || {};
            context.formattedSpellTypes = Object.entries(spellTypes).map(([key, checked]) => {
                const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
                return {
                    id: key,
                    checked: checked,
                    label: game.i18n.localize(`CoC7.${capitalized}Spell`)
                };
            });

            const itemImg = this.item.img || "";
            let headerIcon = "fas fa-magic";
            if (itemImg.includes("fa_")) {
                try {
                    const fileName = itemImg.split('/').pop().split('.')[0]; 
                    headerIcon = fileName.replaceAll('_', '-').replace(/^(fa-[a-z]+)-fa-/, '$1 fa-');
                } catch (e) {}
            }
            context.headerIcon = headerIcon;
            this.dxxmHeaderIcon = headerIcon;

            return context;
        }

        render(force = false, options = {}) {
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
                const iconClass = this.dxxmHeaderIcon || "fas fa-magic";
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

            html.find('#cast-spell').click(ev => {
                ev.preventDefault();
                if (typeof this.item.castSpell === "function") this.item.castSpell();
            });

            const body = html.find('.dxxm-group-body')[0];
            const indicator = html.find('.scroll-indicator')[0];
            
            if (body && indicator) {
                this._dxxmScrollObserver = DXXMUtils.setupScrollIndicator(body, indicator);
            }

            html.find('.dxxm-v3-tabs .item').click(ev => {
                localStorage.setItem(`dxxm-active-tab-${this.item.id}`, ev.currentTarget.dataset.tab);
            });
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

    foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, "ui-redesign", DXXMSpellSheetV3, {
        types: ["spell"],
        makeDefault: true,
        label: "DXXM Spell V3"
    });
}
