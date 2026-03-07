/* scripts/investigation.js */
import { DXXMUtils } from "./utils.js";
import { DXXMCitizens } from "./citizens.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class DXXMInvestigation extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        const savedPosition = DXXMUtils.getWindowPosition('investigation-pos');
        if (savedPosition) {
            options.position = foundry.utils.mergeObject(options.position || {}, savedPosition);
        }
        super(options);

        this.activePageId = options.pageId || null; 
        this.activeGroupId = options.groupId || null; // Nova variável para o grupo
        this.expandedTopics = new Set();
        this.editingTopic = null;
    }

    static DEFAULT_OPTIONS = {
        id: "dxxm-investigation-app",
        classes: ["dxxm-window-investigation"],
        tag: "section",
        window: { 
            icon: "fas fa-magnifying-glass",
            title: "Diário de Investigação", 
            resizable: true
        },
        position: { width: 650, height: 848 },
        actions: {
            toggleTopic: this.#onToggleTopic,
            editTopic: this.#onEditTopic,
            saveTopic: this.#onSaveTopic,
            addTopic: this.#onAddTopic,
            topicMenu: this.#onTopicMenu
        }
    };

    async close(options = {}) {
        await DXXMUtils.saveWindowPosition('investigation-pos', this.position);
        return super.close(options);
    }

    static PARTS = {
        main: { template: "modules/ui-redesign/templates/investigation.html" }
    };

    static async #onTopicMenu(event, target) {
        event.stopPropagation();
        const title = target.dataset.topic;
        const app = foundry.applications.instances.get("dxxm-investigation-app");

        const result = await DialogV2.wait({
            id: "dxxm-topic-menu-dialog", 
            window: { title: `Gerenciar: ${title}`, icon: "fas fa-cog" },
            content: `
                <div class="form-group" style="margin-bottom: 10px;">
                    <label><strong>Novo Nome:</strong></label>
                    <input type="text" name="newTitle" value="${title}" autofocus>
                </div>
            `,
            buttons: [
                {
                    action: "save",
                    label: "Salvar Nome",
                    icon: "fas fa-save",
                    callback: (event, button) => ({ action: "rename", value: button.form.elements.newTitle.value })
                },
                {
                    action: "delete",
                    label: "Excluir Nota",
                    icon: "fas fa-trash",
                    callback: () => ({ action: "delete" })
                }
            ]
        });

        if (!result) return;

        if (result.action === "rename") {
            app.#renameTopicLogic(title, result.value);
        } else if (result.action === "delete") {
            app.#deleteTopicLogic(title);
        }
    }

    async #renameTopicLogic(oldTitle, newTitle) {
        if (!newTitle || newTitle === oldTitle) return;

        const journal = game.journal.find(j => j.name === `Diário: ${game.user.name}`);
        const page = journal?.pages.get(this.activePageId);

        if (page) {
            const updatedContent = page.text.content.replace(`<h1>${oldTitle}</h1>`, `<h1>${newTitle}</h1>`);
            await page.update({ "text.content": updatedContent });

            if (this.expandedTopics.has(oldTitle)) {
                this.expandedTopics.delete(oldTitle);
                this.expandedTopics.add(newTitle);
            }
            if (this.editingTopic === oldTitle) this.editingTopic = newTitle;
            this.render(true);
        }
    }

    async #deleteTopicLogic(title) {
        const journal = game.journal.find(j => j.name === `Diário: ${game.user.name}`);
        const page = journal?.pages.get(this.activePageId);

        if (page) {
            const rawSections = page.text.content.split(/(?=<h1>)/g);
            const updatedSections = rawSections.filter(s => !s.startsWith(`<h1>${title}</h1>`));
            
            await page.update({ "text.content": updatedSections.join("") });
            this.expandedTopics.delete(title);
            if (this.editingTopic === title) this.editingTopic = null;
            this.render(true);
        }
    }

    async _prepareContext(options) {
        const journal = game.journal.find(j => j.name === `Diário: ${game.user.name}`);
        const pages = journal ? journal.pages.contents : [];
        
        // Mapeia os grupos existentes salvos nas flags
        let groupsMap = new Map();
        pages.forEach(p => {
            const groupName = p.getFlag('ui-redesign', 'group') || "Geral";
            if (!groupsMap.has(groupName)) groupsMap.set(groupName, []);
            groupsMap.get(groupName).push(p);
        });

        if (!this.activePageId && pages.length > 0) this.activePageId = pages[0].id;
        const activePage = pages.find(p => p.id === this.activePageId);

        // Se o activeGroupId estiver vazio, define com base no personagem ativo
        if (!this.activeGroupId && activePage) {
            this.activeGroupId = activePage.getFlag('ui-redesign', 'group') || "Geral";
        } else if (!this.activeGroupId && groupsMap.size > 0) {
            this.activeGroupId = Array.from(groupsMap.keys())[0];
        }

        // Formata os dados para o HTML (Grupos)
        let npcGroups = Array.from(groupsMap.keys()).map(g => ({
            id: g,
            name: g,
            active: g === this.activeGroupId
        }));

        // Formata os dados para o HTML (NPCs filtrados pelo Grupo Ativo)
        let currentGroupPages = groupsMap.get(this.activeGroupId) || [];
        let npcPages = currentGroupPages.map(p => ({
            id: p.id,
            name: p.name,
            active: p.id === this.activePageId
        }));

        let topics = [];
        if (activePage) {
            const rawSections = activePage.text.content.split(/(?=<h1>)/g);
            topics = await Promise.all(rawSections.filter(s => s.includes('<h1>')).map(async s => {
                const title = s.match(/<h1>(.*?)<\/h1>/)?.[1] || "Sem Título";
                const content = s.replace(/<h1>.*?<\/h1>/, "");
                return {
                    title: title,
                    rawContent: content,
                    enrichedContent: await TextEditor.enrichHTML(content, {async: true}),
                    expanded: this.expandedTopics.has(title),
                    isEditing: this.editingTopic === title
                };
            }));
        }

        return {
            journalId: journal?.id,
            npcGroups, // Envia a lista de grupos para a 1ª Linha
            npcPages,  // Envia a lista de NPCs do grupo para a 2ª Linha
            topics,
            activePage,
            npcPortrait: activePage?.getFlag('ui-redesign', 'portrait') || "icons/svg/mystery-man.svg",
            npcMask: activePage?.getFlag('ui-redesign', 'mask') || "" 
        };
    }

    static #onToggleTopic(event, target) {
        const topic = target.dataset.topic;
        const app = foundry.applications.instances.get("dxxm-investigation-app");
        if (app.expandedTopics.has(topic)) app.expandedTopics.delete(topic);
        else app.expandedTopics.add(topic);
        app.render(true);
    }

    static #onEditTopic(event, target) {
        event.stopPropagation();
        const app = foundry.applications.instances.get("dxxm-investigation-app");
        app.editingTopic = target.dataset.topic;
        app.expandedTopics.add(app.editingTopic);
        app.render(true);
    }

    static async #onSaveTopic(event, target) {
        event.stopPropagation();
        const app = foundry.applications.instances.get("dxxm-investigation-app");
        const topicTitle = target.dataset.topic;
        const proseMirror = app.element.querySelector(`prose-mirror[data-topic="${topicTitle}"]`);
        const journal = game.journal.find(j => j.name === `Diário: ${game.user.name}`);
        const page = journal?.pages.get(app.activePageId);

        if (page && proseMirror) {
            const rawSections = page.text.content.split(/(?=<h1>)/g);
            const updatedSections = rawSections.map(s => {
                if (s.startsWith(`<h1>${topicTitle}</h1>`)) return `<h1>${topicTitle}</h1>` + proseMirror.value;
                return s;
            });
            await page.update({ "text.content": updatedSections.join("") });
            app.editingTopic = null;
            app.render(true);
        }
    }

    static async #onAddTopic() {
        const app = foundry.applications.instances.get("dxxm-investigation-app");
        const journal = game.journal.find(j => j.name === `Diário: ${game.user.name}`);
        const page = journal?.pages.get(app.activePageId);
        if (!page) return;

        const newTopicName = "Nova Anotação";
        const newContent = page.text.content + `\n<h1>${newTopicName}</h1><p>Escreva aqui...</p>`;
        await page.update({ "text.content": newContent });
        app.editingTopic = newTopicName;
        app.expandedTopics.add(newTopicName);
        app.render(true);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        
        // Listener para os botões da 1ª Linha (Grupos)
        this.element.querySelectorAll('.inv-group-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const newGroupId = e.currentTarget.dataset.groupId;
                if (this.activeGroupId !== newGroupId) {
                    this.activeGroupId = newGroupId;
                    
                    // Ao trocar de grupo, seleciona o 1º NPC do grupo automaticamente
                    const journal = game.journal.find(j => j.name === `Diário: ${game.user.name}`);
                    const pages = journal ? journal.pages.contents : [];
                    const groupPages = pages.filter(p => (p.getFlag('ui-redesign', 'group') || "Geral") === this.activeGroupId);
                    
                    this.activePageId = groupPages.length > 0 ? groupPages[0].id : null;
                    
                    this.expandedTopics.clear();
                    this.editingTopic = null;
                    this.render(true);
                }
            });
        });

        // Listener para os botões da 2ª Linha (NPCs)
        this.element.querySelectorAll('.inv-npc-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.activePageId = e.currentTarget.dataset.pageId;
                this.expandedTopics.clear();
                this.editingTopic = null;
                this.render(true);
            });
        });

        // Clique no Retrato -> Volta ao Citizens
        const portraitWrapper = this.element.querySelector('.inv-portrait-wrapper');
        if (portraitWrapper) {
            portraitWrapper.addEventListener('click', (event) => {
                event.preventDefault();
                this.close(); 
                if (game.modules.get("ui-redesign")?.active) {
                    new DXXMCitizens().render(true); 
                }
            });
        }
    }

    // Agora recebe o "npcGroup" no momento em que cria ou abre o NPC!
    static async openForNPC(npcName, npcImg, npcMask = "", npcGroup = "Geral") {
        let journal = game.journal.find(j => j.name === `Diário: ${game.user.name}`);
        if (!journal) journal = await JournalEntry.create({ name: `Diário: ${game.user.name}`, ownership: { [game.user.id]: 3 } });
        
        let page = journal.pages.find(p => p.name === npcName);
        
        if (!page) {
            const createdPages = await journal.createEmbeddedDocuments("JournalEntryPage", [{
                name: npcName, type: "text",
                text: { content: `<h1>Histórico</h1><p>Início da investigação.</p>`, format: 1 },
                flags: { "ui-redesign": { portrait: npcImg, mask: npcMask, group: npcGroup } } // Salva o grupo
            }]);
            page = createdPages[0]; 
        }

        const app = Object.values(foundry.applications.instances).find(a => a.id === "dxxm-investigation-app") || new DXXMInvestigation();
        
        app.activePageId = page.id;
        app.activeGroupId = page.getFlag('ui-redesign', 'group') || "Geral"; // Define o grupo ativo para focar no NPC
        
        app.expandedTopics.clear();
        app.editingTopic = null;

        app.render(true, {focus: true});
    }
}
