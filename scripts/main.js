/* main.js */
import { registerSettings } from "./settings.js";
import { DXXMEvidence } from "./evidence.js";
import { DXXMCitizens } from "./citizens.js";
import { DXXMInvestigation } from "./investigation.js"; 
import { DXXMSoundboard } from "./soundboard.js";
import { DXXMViewer } from "./viewer.js";
import { registerItemSheetV3 } from "./item-sheet.js"; 
import { registerBookSheetV3 } from "./item-book-sheet.js"; 
import { registerSpellSheetV3 } from "./item-spell-sheet.js";
import { registerSkillSheetV3 } from "./item-skill-sheet.js";
import { registerOccupationSheetV3 } from "./item-occupation-sheet.js";

const initDXXM = () => {
    // Inicializa o objeto global do módulo para ser acessado por macros
    game.dxxm = game.dxxm || {};

    /**
     * Helper para gerenciar a instância única das janelas (Singleton)
     * Compatível com ApplicationV2 do Foundry V12/13
     */
    const _openApp = (ClassRef, id, data = {}) => {
        const existing = foundry.applications.instances.get(id);
        if (existing) {
            return existing.render(true, { focus: true });
        }
        return new ClassRef(data).render(true);
    };
    
    // API exposta para as macros do Compêndio
    game.dxxm.openEvidence = () => _openApp(DXXMEvidence, "dxxm-evidence-app");
    game.dxxm.openCitizens = () => _openApp(DXXMCitizens, "dxxm-citizens-app");
    game.dxxm.openInvestigation = () => _openApp(DXXMInvestigation, "dxxm-investigation-app");
    game.dxxm.openSoundboard = () => {
        if (!game.user.isGM) return ui.notifications.warn("Acesso negado.");
        _openApp(DXXMSoundboard, "dxxm-soundboard-app");
    };

    game.dxxm.openViewer = (data = {}) => _openApp(DXXMViewer, "dxxm-viewer-app", data);
};

Hooks.once('init', () => {
    registerSettings();
    
    game.settings.register("ui-redesign", "currency-icon", {
        name: "Ícone de Moeda Padrão",
        scope: "world",
        config: false,
        type: String,
        default: "fa-tag"
    });

    // Registro dos dados dos Cidadãos via Settings
    game.settings.register("ui-redesign", "citizensData", {
        name: "Dados dos Cidadãos",
        scope: "world",
        config: false,
        type: Object,
        default: { locations: [] }
    });

    // --- Registro de Helpers Handlebars ---
    
    Handlebars.registerHelper('array', function(...args) {
        return args.slice(0, -1);
    });

    Handlebars.registerHelper('upperCase', function(str) {
        if (!str || typeof str !== 'string') return '';
        return str.toUpperCase();
    });

    Handlebars.registerHelper('capitalize', function(str) {
        if (!str || typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    });

    Handlebars.registerHelper('times', function(n, block) {
        var accum = [];
        for(var i = 0; i < n; ++i) accum.push(block.fn(i));
        return accum.join('');
    });
});

Hooks.once('setup', () => {
    if (!game.dxxm || !game.dxxm.openEvidence) {
        initDXXM();
    }
});

Hooks.once('ready', () => {
    console.log("DXXM UI-Redesign | Sistema pronto e API de macros carregada.");
    
    registerItemSheetV3();
    registerBookSheetV3();
    registerSpellSheetV3(); 
    registerSkillSheetV3();
    registerOccupationSheetV3();
});

// Atualização em tempo real da janela de Cidadãos
Hooks.on("updateSetting", (setting) => {
    if (setting.key === "ui-redesign.citizensData") {
        const app = foundry.applications.instances.get("dxxm-citizens-app");
        if (app) app.render(true);
    }
});
