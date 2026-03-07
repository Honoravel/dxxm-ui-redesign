import { DXXMUtils } from "./utils.js";

export function registerSkillSheetV3() {
    // Busca a classe base de forma resiliente para evitar falhas no registro
    const skillSheets = CONFIG.Item.sheetClasses?.skill || {};
    const baseClassConfig = skillSheets["CoC7.CoC7ItemSheetV2"] || Object.values(skillSheets)[0];
    const BaseSkillSheet = baseClassConfig?.cls || ItemSheet;

    class DXXMSkillSheetV3 extends BaseSkillSheet {
        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                classes: ["coc7", "sheet", "item", "dxxm-item-v3", "dxxm-skill-v3"],
                template: "modules/ui-redesign/templates/item-skill-sheetV3.html",
                width: 380,
                height: 450,
                tabs: [{ 
                    navSelector: ".dxxm-v3-tabs", 
                    contentSelector: ".dxxm-group-body", 
                    initial: "description" 
                }]
            });
        }

        get template() {
            return "modules/ui-redesign/templates/item-skill-sheetV3.html";
        }

        async getData(options) {
            const context = await super.getData(options);
            
            // Variáveis essenciais para o funcionamento do editor de texto e permissões
            context.isKeeper = game.user.isGM;
            context.owner = this.item.isOwner;
            context.editable = this.isEditable;
            context.hasOwner = this.item.isEmbedded;
            
            // Garantia de propriedades oriundas do sistema CoC7 para o HTML
            context.isSpecialized = context.isSpecialized ?? (this.item.system.specialization !== undefined && this.item.system.specialization !== "");
            context.canModifySpec = context.canModifySpec ?? true;
            context.hadNonCharacterOwner = context.hadNonCharacterOwner ?? (!this.item.actor || this.item.actor.type !== "character");
            context._properties = context._properties ?? {};
            context._eras = context._eras ?? {};
            
            context.tabsActive = localStorage.getItem(`dxxm-tabs-state-${this.item.id}`) === "true";
            
            // Lógica de Ícone de Cabeçalho
            const itemImg = this.item.img || "";
            let headerIcon = "fa-solid fa-briefcase"; 
            if (itemImg.includes("fa_")) {
                try {
                    const fileName = itemImg.split('/').pop().split('.')[0]; 
                    headerIcon = fileName.replaceAll('_', '-').replace(/^(fa-[a-z]+)-fa-/, '$1 fa-');
                } catch (e) {}
            }
            context.headerIcon = headerIcon;
            this.dxxmHeaderIcon = headerIcon;

            // Preparação dos textos para os editores Prosemirror (Namespace V13)
            context.enrichedDescriptionValue = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.item.system.description?.value || "", {
                async: true
            });
            context.enrichedDescriptionKeeper = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.item.system.description?.keeper || "", {
                async: true
            });

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

            // Injeção do Ícone no Cabeçalho da Janela
            const windowHeaderTitle = this.element[0]?.querySelector('.window-header .window-title');
            if (windowHeaderTitle) {
                const iconClass = this.dxxmHeaderIcon || "fa-solid fa-book-open";
                windowHeaderTitle.innerHTML = `<i class="${iconClass} dxxm-header-icon" style="margin-left: 5px;"></i>${this.item.name}`;
            }

            // Geração de Ícone FA via contextmenu
            html.find('.dxxm-group-icon img').contextmenu(ev => {
                ev.preventDefault();
                if (this.isEditable) DXXMUtils.generateFAIcon(this.item);
            });

            // Lógica de Abas Retráteis (usando a mesma chave padrão dxxm-tabs-state-)
            const tabsToggle = html.find('.dxxm-tabs-toggle');
            const tabsNav = html.find('.dxxm-group-tabs');
            const storageKey = `dxxm-tabs-state-${this.item.id}`;

            if (localStorage.getItem(storageKey) === "true") {
                tabsToggle.addClass('active');
                tabsNav.show();
            }

            tabsToggle.click(ev => {
                ev.preventDefault();
                const isActive = tabsToggle.toggleClass('active').hasClass('active');
                localStorage.setItem(storageKey, isActive.toString());
                tabsNav.slideToggle(200, () => this.setPosition());
            });

            // Scroll Indicator logic via Utils
            const body = html.find('.dxxm-group-body')[0];
            const indicator = html.find('.scroll-indicator')[0];
            
            if (body && indicator) {
                this._dxxmScrollObserver = DXXMUtils.setupScrollIndicator(body, indicator);
            }
            
            // Salvar aba ativa
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

    foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, "ui-redesign", DXXMSkillSheetV3, {
        types: ["skill"],
        makeDefault: true,
        label: "DXXM Skill V3"
    });
}
