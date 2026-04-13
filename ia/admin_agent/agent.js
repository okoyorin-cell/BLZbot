const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config.js');
const { toolsDeclaration, toolsImplementation } = require('./tools.js');

const SYSTEM_PROMPT = `Tu es un assistant d'administration Discord professionnel et AUTONOME.

TES RÈGLES D'OR :
1. **Autonomie avant tout** : Ne demande pas d'informations que tu peux obtenir toi-même surtout au niveau des ID ou automod, pour automod tu dois être autonome et choisir toi même en fonction du contexte (noter que par défaut il faut mettre BLOCK_MESSAGE). Utilise tes outils pour explorer (get_server_info, get_channels_list, search_members, etc.) AVANT de poser des questions.
2. **Utilisation des Outils** : Tu DOIS utiliser les outils (Function Calling) pour TOUTE action ou récupération d'information. N'invente pas de données.
3. **Pas de Code** : N'écris JAMAIS de blocs de code (comme \`\`\`python ...\`\`\`) pour simuler une action. Utilise uniquement les appels de fonctions natifs fournis par le système.
4. **Sécurité** : Pour les actions sensibles (ban, kick, suppression), utilise les outils "draft_" qui génèrent une confirmation.
5. **Clarté** : Réponds en français naturel, de manière concise et professionnelle.
6. **ID** : pour les identifiants, ne demande pas a l'utilisateur directement quel est l'id si ce n'est pas fourni mais utilise tes outils pour trouver par toi même, si tu ne trouves vraiment pas (il peut y avoir des fautes de frappes dans ce que l'utilisateur te demadne de chercher donc utilise un esprit critique) alors tu peux demander a l'utilisateur de vérifier le nom ou le pseudo ou de te donner l'ID
NOTE : avant de poser une question tu dois te demander si l'utilisateur te dirait "trouve toi même" qu'est ce que tu trouverais
Exemple : Si on te demande "Qui est admin ?", ne demande pas "Quel rôle cherchez-vous ?", mais utilise \`get_roles_list\` pour trouver le rôle admin, puis \`get_member_roles\` ou \`get_members_search\` pour trouver les membres.`;

const MODELS = [
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro"
];

async function fetchHistory(channel, client, limit = 20) {
    try {
        const messages = await channel.messages.fetch({ limit });
        const history = [];

        // Iterate in reverse (oldest to newest)
        const sortedMessages = Array.from(messages.values()).reverse();

        for (const msg of sortedMessages) {
            // Filter: User '+' commands (or after mention) OR Bot responses
            const isUserCommand = msg.author.id !== client.user.id && (msg.content.includes('+') || msg.mentions.has(client.user));
            const isBotResponse = msg.author.id === client.user.id;

            if (isUserCommand) {
                // Extract prompt if it's a command
                const mentionRegex = new RegExp(`<@!?${client.user.id}>`, 'g');
                const contentWithoutMention = msg.content.replace(mentionRegex, "").trim();
                const plusIndex = contentWithoutMention.indexOf('+');

                if (plusIndex !== -1) {
                    history.push({ role: "user", parts: [{ text: contentWithoutMention.substring(plusIndex + 1).trim() }] });
                }
            } else if (isBotResponse) {
                if (msg.content) {
                    history.push({ role: "model", parts: [{ text: msg.content }] });
                }
            }
        }

        // Keep last 6 turns (3 exchanges)
        let slicedHistory = history.slice(-6);

        // Ensure the first message is from 'user'
        while (slicedHistory.length > 0 && slicedHistory[0].role !== "user") {
            slicedHistory.shift();
        }

        return slicedHistory;
    } catch (error) {
        console.error("[AdminAgent] Error fetching history:", error);
        return [];
    }
}

async function handleAdminRequest(message, client) {
    // Extract prompt: Remove mention, find '+', take everything after
    const mentionRegex = new RegExp(`<@!?${client.user.id}>`, 'g');
    const contentWithoutMention = message.content.replace(mentionRegex, "").trim();

    let prompt = "";
    const plusIndex = contentWithoutMention.indexOf('+');

    if (plusIndex !== -1) {
        prompt = contentWithoutMention.substring(plusIndex + 1).trim();
    }

    if (!prompt) return message.reply("Veuillez entrer une commande après le '+'.");

    const guild = message.guild;
    if (!guild) return message.reply("Cette commande ne peut être utilisée que sur un serveur.");

    await message.channel.sendTyping();

    // Fetch history
    const history = await fetchHistory(message.channel, client);

    // Add user context
    const userContext = `Tu parles avec ${message.author.tag} (ID: ${message.author.id})`;

    let lastError = null;
    let hasReplied = false;

    // Smart Reply function
    const smartReply = async (content, options = {}) => {
        let payload = {};
        if (typeof content === 'string') {
            payload = { content, ...options };
        } else if (typeof content === 'object' && content !== null) {
            payload = { ...content, ...options };
        }

        let text = payload.content || "";

        // Sanitize mentions (Prevent pings)
        text = text.replace(/@/g, '@.');
        payload.content = text;

        const MAX_LENGTH = 2000;

        if (text.length > MAX_LENGTH) {
            const chunks = [];
            let remaining = text;
            while (remaining.length > 0) {
                let chunk = remaining.substring(0, MAX_LENGTH);
                const lastNewline = chunk.lastIndexOf('\n');
                if (lastNewline > -1 && lastNewline > 1000) {
                    chunk = remaining.substring(0, lastNewline);
                    remaining = remaining.substring(lastNewline + 1);
                } else {
                    remaining = remaining.substring(MAX_LENGTH);
                }
                chunks.push(chunk);
            }

            for (let i = 0; i < chunks.length; i++) {
                const chunkPayload = { ...payload, content: chunks[i] };
                if (i < chunks.length - 1) {
                    delete chunkPayload.embeds;
                    delete chunkPayload.components;
                }

                if (!hasReplied) {
                    hasReplied = true;
                    await message.reply(chunkPayload);
                } else {
                    await message.channel.send(chunkPayload);
                }
            }
            return;
        } else {
            if (!hasReplied) {
                hasReplied = true;
                return await message.reply(payload);
            } else {
                return await message.channel.send(payload);
            }
        }
    };

    for (const modelName of MODELS) {
        try {
            console.log(`[AdminAgent] Tentative avec le modèle: ${modelName}`);

            // Initialize Gemini Model with Tools
            const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: modelName,
                tools: [{ functionDeclarations: toolsDeclaration }],
                systemInstruction: SYSTEM_PROMPT + "\n" + userContext
            });

            const chat = model.startChat({
                history: history
            });

            let result = await chat.sendMessage(prompt);
            let response = await result.response;
            let text = response.text();
            let functionCalls = response.functionCalls();

            // Safety loop limit
            let loopCount = 0;
            const MAX_LOOPS = 10;

            while (loopCount < MAX_LOOPS) {
                loopCount++;

                // If no function calls, break the loop
                if (!functionCalls || functionCalls.length === 0) {
                    break;
                }

                const nativeResponses = [];

                // Execute Native Calls
                for (const call of functionCalls) {
                    const name = call.name;
                    const args = call.args;
                    console.log(`[AdminAgent] Calling native tool: ${name}`, args);

                    if (toolsImplementation[name]) {
                        try {
                            const output = await toolsImplementation[name]({ client, guild, message, smartReply }, args);
                            nativeResponses.push({
                                functionResponse: {
                                    name: name,
                                    response: { result: output }
                                }
                            });
                        } catch (error) {
                            console.error(`[AdminAgent] Error in native tool ${name}:`, error);
                            nativeResponses.push({
                                functionResponse: {
                                    name: name,
                                    response: { error: error.message }
                                }
                            });
                        }
                    } else {
                        nativeResponses.push({
                            functionResponse: {
                                name: name,
                                response: { error: "Tool not implemented" }
                            }
                        });
                    }
                }

                // Send outputs back to model
                if (text) await smartReply(text);
                await message.channel.sendTyping();

                if (nativeResponses.length > 0) {
                    result = await chat.sendMessage(nativeResponses);
                    response = await result.response;
                    text = response.text();
                    functionCalls = response.functionCalls();
                } else {
                    break;
                }
            }

            if (text) {
                await smartReply(text);
            }

            return;

        } catch (error) {
            console.error(`[AdminAgent] Erreur avec le modèle ${modelName}:`, error.message);
            lastError = error;
        }
    }

    console.error("[AdminAgent] Tous les modèles ont échoué.");
    await smartReply(`Désolé, impossible de traiter votre demande. Tous les modèles d'IA sont indisponibles ou ont rencontré une erreur.\nDernière erreur: ${lastError?.message}`);
}

module.exports = { handleAdminRequest };
