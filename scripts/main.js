/* main.js - v2.2.8 (Helpers Handlebars Adicionados) */
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
    game.dxxm = game.dxxm || {};

    const _openApp = (ClassRef, id, data = {}) => {
        const existing = foundry.applications.instances.get(id);
        if (existing) {
            return existing.render(true, { focus: true });
        }
        return new ClassRef(data).render(true);
    };
    
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

    // --- Registro de Helpers Handlebars ---
    
    // Cria um array a partir de argumentos: (array "item1" "item2")
    Handlebars.registerHelper('array', function(...args) {
        return args.slice(0, -1);
    });

    // Transforma string em Maiúsculas
    Handlebars.registerHelper('upperCase', function(str) {
        if (!str || typeof str !== 'string') return '';
        return str.toUpperCase();
    });

    // Capitaliza a primeira letra: "classic" -> "Classic"
    Handlebars.registerHelper('capitalize', function(str) {
        if (!str || typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Helper de repetição (já existente no seu código)
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
    console.log("UI-Redesign | Sistema pronto.");
    
    registerItemSheetV3();
    registerBookSheetV3();
    registerSpellSheetV3(); 
    registerSkillSheetV3();
    registerOccupationSheetV3();
});
