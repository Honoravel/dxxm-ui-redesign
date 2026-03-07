/* scripts/settings.js */

export function registerSettings() {
    console.log("UI-Redesign | Registrando configurações...");

    // --- QUADRO DE EVIDÊNCIAS ---
    game.settings.register('ui-redesign', 'evidence-header-icon', {
        scope: 'world',
        config: false,
        type: String,
        default: "icons/svg/d20-grey.svg"
    });

    game.settings.register('ui-redesign', 'evidence-grid-config', {
        scope: 'world',
        config: false,
        type: Object,
        default: { containerCols: 1, itemCols: 3, itemRows: 1 }
    });
    
    game.settings.register('ui-redesign', 'evidence-slots-data', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register('ui-redesign', 'evidence-containers', {
        scope: 'world',
        config: false,
        type: Array,
        default: [{ id: foundry.utils.randomID() }]
    });

    // --- SOUNDBOARD (EXCLUSIVO GM) ---
    game.settings.register('ui-redesign', 'soundboard-header-icon', {
        scope: 'world',
        config: false,
        type: String,
        default: "icons/svg/sound.svg"
    });

    game.settings.register('ui-redesign', 'soundboard-grid-config', {
        scope: 'world',
        config: false,
        type: Object,
        default: { containerCols: 1, itemCols: 3, itemRows: 1, preloadAudio: false }
    });

    game.settings.register('ui-redesign', 'soundboard-slots-data', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register('ui-redesign', 'soundboard-containers', {
        scope: 'world',
        config: false,
        type: Array,
        default: [{ id: foundry.utils.randomID(), volume: 1.0 }]
    });

    // --- PERSISTÊNCIA DE POSIÇÃO (Lado do Cliente) ---
    const posDefault = { left: null, top: null, width: null, height: null };
    
    game.settings.register('ui-redesign', 'evidence-pos', { scope: 'client', config: false, type: Object, default: posDefault });
    game.settings.register('ui-redesign', 'viewer-pos', { scope: 'client', config: false, type: Object, default: posDefault });
    game.settings.register('ui-redesign', 'citizens-pos', { scope: 'client', config: false, type: Object, default: posDefault });
    game.settings.register('ui-redesign', 'investigation-pos', { scope: 'client', config: false, type: Object, default: posDefault });
    game.settings.register('ui-redesign', 'soundboard-pos', { scope: 'client', config: false, type: Object, default: posDefault });
}
