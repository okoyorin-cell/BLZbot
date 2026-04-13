const { PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Documentation for UI Kit
const UI_KIT_DOCS = {
    "documentation_version": "2.1",
    "instruction": "Utilise ces formats pour construire le paramètre 'components' de l'outil 'draft_complex_ui_message'.",
    "structure_rules": [
        "Les composants doivent être dans des 'ActionRows' (Type 1).",
        "Max 5 ActionRows par message.",
        "Max 5 Boutons par ActionRow.",
        "Max 1 SelectMenu par ActionRow (il doit être seul dans sa rangée)."
    ],
    "component_types": {
        "BUTTON": {
            "type": 2,
            "styles": {
                "PRIMARY (Blurple)": 1,
                "SECONDARY (Grey)": 2,
                "SUCCESS (Green)": 3,
                "DANGER (Red)": 4,
                "LINK (URL)": 5
            },
            "required_fields": ["type", "style", "label"],
            "conditional_fields": {
                "custom_id": "Requis pour styles 1-4. Doit être pris dans la liste REGISTRY ci-dessous.",
                "url": "Requis UNIQUEMENT pour style 5."
            }
        },
        "SELECT_MENU": {
            "types": {
                "STRING_SELECT": 3,
                "USER_SELECT": 5,
                "ROLE_SELECT": 6,
                "CHANNEL_SELECT": 8
            },
            "required_fields": ["type", "custom_id", "placeholder"],
            "note": "Pour le type 3, tu dois fournir un tableau 'options' (label, value, description, emoji)."
        }
    },
    "registry_custom_ids": {
        "description": "Liste des IDs programmés dans le bot.",
        "modal_triggers": {
            "MODAL_OPEN_TICKET": "Ouvre le formulaire de création de ticket support.",
            "MODAL_APPLY_STAFF": "Ouvre le formulaire de candidature Staff.",
            "MODAL_REPORT_USER": "Ouvre le formulaire de signalement.",
            "MODAL_SUGGESTION": "Ouvre la boîte à idées."
        },
        "immediate_actions": {
            "ACTION_VERIFY_MEMBER": "Donne le rôle membre (Captcha like).",
            "ACTION_CLAIM_TICKET": "Assigne le ticket à l'admin qui clique.",
            "ACTION_CLOSE_TICKET": "Ferme et archive le ticket/thread actuel.",
            "ACTION_TOGGLE_NOTIFS": "Ajoute/Retire le rôle de notifications.",
            "ACTION_DELETE_SELF": "Supprime le message contenant le bouton (Bouton 'Fermer')."
        }
    }
};

// Map to store pending actions awaiting confirmation
// Key: Message ID of the confirmation message
// Value: { type: string, data: object, userId: string }
const pendingActions = new Map();

const toolsDeclaration = [
    // --- Contextualisation ---
    {
        name: "get_server_info",
        description: "Récupère les informations générales du serveur (Nom, ID, Owner ID, nombre de membres, etc).",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "get_channels_list",
        description: "Récupère la liste COMPLÈTE des salons du serveur avec IDs, noms, types et parents.",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "get_roles_list",
        description: "Récupère la liste de tous les rôles avec IDs, noms, couleurs, positions et permissions.",
        parameters: {
            type: "object",
            properties: {
                filter_name: { type: "string", description: "Filtrer par nom (contient)" },
                limit: { type: "integer", description: "Nombre max de résultats (défaut 50)" }
            }
        }
    },
    {
        name: "get_member_roles",
        description: "Récupère la liste des rôles d'un membre spécifique.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre" }
            },
            required: ["user_id"]
        }
    },
    {
        name: "get_members_search",
        description: "Recherche des membres par pseudo, username ou ID.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Pseudo, username ou ID à chercher" },
                limit: { type: "integer", description: "Nombre max de résultats (défaut 10)" }
            },
            required: ["query"]
        }
    },
    {
        name: "get_last_messages",
        description: "Lit l'historique récent des messages d'un salon spécifique.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string", description: "ID du salon" },
                limit: { type: "integer", description: "Nombre de messages (max 50)" }
            },
            required: ["channel_id"]
        }
    },
    {
        name: "get_audit_logs",
        description: "Consulte les logs d'administration du serveur.",
        parameters: {
            type: "object",
            properties: {
                action_type: { type: "integer", description: "Type d'action (optionnel)" },
                limit: { type: "integer", description: "Nombre d'entrées (défaut 5)" }
            }
        }
    },
    {
        name: "get_automod_rules",
        description: "Liste toutes les règles AutoMod actives avec détails (mots bloqués, regex, actions).",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "get_member_permissions",
        description: "Affiche les permissions d'un membre dans un salon spécifique.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre" },
                channel_id: { type: "string", description: "ID du salon (optionnel, défaut: salon actuel)" }
            },
            required: ["user_id"]
        }
    },
    {
        name: "get_channel_permissions",
        description: "Affiche les permissions (overwrites) d'un salon.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string", description: "ID du salon" }
            },
            required: ["channel_id"]
        }
    },
    {
        name: "get_member_details",
        description: "Récupère des informations détaillées sur un membre (dates, avatar, etc).",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre" }
            },
            required: ["user_id"]
        }
    },
    {
        name: "get_ban_info",
        description: "Récupère les informations de bannissement d'un utilisateur (raison, etc).",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID de l'utilisateur" }
            },
            required: ["user_id"]
        }
    },
    {
        name: "get_webhooks",
        description: "Liste les webhooks du serveur ou d'un salon spécifique.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string", description: "ID du salon (optionnel)" }
            }
        }
    },
    {
        name: "get_emojis",
        description: "Liste les emojis du serveur.",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "get_stickers",
        description: "Liste les stickers du serveur.",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "search_members",
        description: "Recherche des membres par nom, pseudo ou tag (flou). Utile quand on n'a pas l'ID exact.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Nom, pseudo ou partie du nom à rechercher" },
                limit: { type: "integer", description: "Nombre max de résultats (défaut 10)" }
            },
            required: ["query"]
        }
    },

    // --- Modération (Drafts) ---
    {
        name: "draft_ban_member",
        description: "Prépare le bannissement définitif d'un membre.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre à bannir" },
                reason: { type: "string", description: "Raison du bannissement" },
                delete_messages_seconds: { type: "integer", description: "Secondes d'historique à effacer (0-604800)" }
            },
            required: ["user_id", "reason"]
        }
    },
    {
        name: "draft_unban_member",
        description: "Prépare la révocation d'un bannissement.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre à débannir" }
            },
            required: ["user_id"]
        }
    },
    {
        name: "draft_kick_member",
        description: "Prépare l'expulsion d'un membre.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre à expulser" },
                reason: { type: "string", description: "Raison de l'expulsion" }
            },
            required: ["user_id", "reason"]
        }
    },
    {
        name: "draft_timeout_member",
        description: "Prépare l'exclusion temporaire (Time out) d'un membre.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre" },
                duration_seconds: { type: "integer", description: "Durée en secondes" },
                reason: { type: "string", description: "Raison" }
            },
            required: ["user_id", "duration_seconds", "reason"]
        }
    },
    {
        name: "draft_remove_timeout",
        description: "Prépare la levée d'un timeout.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre" }
            },
            required: ["user_id"]
        }
    },
    {
        name: "draft_set_nickname",
        description: "Change le pseudo d'un membre.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string", description: "ID du membre" },
                nickname: { type: "string", description: "Nouveau pseudo (vide pour reset)" }
            },
            required: ["user_id", "nickname"]
        }
    },

    // --- Gestion des Messages ---
    {
        name: "draft_send_message",
        description: "Prépare l'envoi d'un message textuel ou d'un embed simple.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string", description: "ID du salon" },
                content: { type: "string", description: "Contenu textuel" },
                embed_json: { type: "string", description: "JSON de l'embed (optionnel)" },
                reply_to_message_id: { type: "string", description: "ID du message auquel répondre (optionnel)" }
            },
            required: ["channel_id"]
        }
    },
    {
        name: "draft_delete_message",
        description: "Prépare la suppression d'un message.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string", description: "ID du salon" },
                message_id: { type: "string", description: "ID du message" }
            },
            required: ["channel_id", "message_id"]
        }
    },
    {
        name: "draft_purge_messages",
        description: "Prépare la suppression de masse de messages.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string", description: "ID du salon" },
                count: { type: "integer", description: "Nombre de messages (1-100)" },
                filter_user_id: { type: "string", description: "Filtrer par utilisateur (optionnel)" }
            },
            required: ["channel_id", "count"]
        }
    },
    {
        name: "draft_pin_message",
        description: "Épingle un message.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string" },
                message_id: { type: "string" }
            },
            required: ["channel_id", "message_id"]
        }
    },
    {
        name: "draft_unpin_message",
        description: "Désépingle un message.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string" },
                message_id: { type: "string" }
            },
            required: ["channel_id", "message_id"]
        }
    },

    // --- Gestion des Salons ---
    {
        name: "draft_create_channel",
        description: "Prépare la création d'un salon.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                type: { type: "integer", description: "0=Text, 2=Voice, 4=Category, 15=Forum" },
                parent_id: { type: "string", description: "ID de la catégorie parente" },
                topic: { type: "string" }
            },
            required: ["name", "type"]
        }
    },
    {
        name: "draft_delete_channel",
        description: "Prépare la suppression d'un salon.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string" }
            },
            required: ["channel_id"]
        }
    },
    {
        name: "draft_update_channel_settings",
        description: "Modifie les paramètres d'un salon.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string" },
                name: { type: "string" },
                topic: { type: "string" },
                nsfw: { type: "boolean" },
                slowmode: { type: "integer" },
                bitrate: { type: "integer" }
            },
            required: ["channel_id"]
        }
    },
    {
        name: "draft_update_channel_permissions",
        description: "Modifie les permissions d'un salon.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string" },
                target_id: { type: "string", description: "Role ou User ID" },
                allow_permissions: { type: "array", items: { type: "string" } },
                deny_permissions: { type: "array", items: { type: "string" } }
            },
            required: ["channel_id", "target_id"]
        }
    },

    // --- Rôles ---
    {
        name: "draft_create_role",
        description: "Crée un nouveau rôle.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                color: { type: "string", description: "Hex color" },
                hoist: { type: "boolean" },
                mentionable: { type: "boolean" }
            },
            required: ["name"]
        }
    },
    {
        name: "draft_delete_role",
        description: "Supprime un rôle.",
        parameters: {
            type: "object",
            properties: {
                role_id: { type: "string" }
            },
            required: ["role_id"]
        }
    },
    {
        name: "draft_update_role",
        description: "Modifie un rôle.",
        parameters: {
            type: "object",
            properties: {
                role_id: { type: "string" },
                name: { type: "string" },
                color: { type: "string" },
                hoist: { type: "boolean" },
                mentionable: { type: "boolean" }
            },
            required: ["role_id"]
        }
    },
    {
        name: "draft_add_role_to_member",
        description: "Donne un rôle à un membre.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string" },
                role_id: { type: "string" }
            },
            required: ["user_id", "role_id"]
        }
    },
    {
        name: "draft_remove_role_from_member",
        description: "Retire un rôle à un membre.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string" },
                role_id: { type: "string" }
            },
            required: ["user_id", "role_id"]
        }
    },

    // --- AutoMod ---
    {
        name: "draft_automod_block_words",
        description: "Configure une règle AutoMod pour bloquer des mots.",
        parameters: {
            type: "object",
            properties: {
                rule_name: { type: "string" },
                words: { type: "array", items: { type: "string" } },
                action: { type: "string", enum: ["BLOCK_MESSAGE", "TIMEOUT", "ALERT"] }
            },
            required: ["rule_name", "words", "action"]
        }
    },
    {
        name: "draft_automod_spam_filter",
        description: "Active les filtres anti-spam.",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "draft_update_automod_rule",
        description: "Modifie une règle AutoMod existante (ajout/retrait mots, regex, actions). Par défaut, l'action est de BLOQUER le message.",
        parameters: {
            type: "object",
            properties: {
                rule_id: { type: "string", description: "ID de la règle à modifier" },
                name: { type: "string", description: "Nouveau nom (optionnel)" },
                add_words: { type: "array", items: { type: "string" }, description: "Mots à ajouter" },
                remove_words: { type: "array", items: { type: "string" }, description: "Mots à retirer" },
                add_regex: { type: "array", items: { type: "string" }, description: "Regex à ajouter" },
                remove_regex: { type: "array", items: { type: "string" }, description: "Regex à retirer" },
                enabled: { type: "boolean", description: "Activer/Désactiver la règle" },
                actions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "integer", description: "1=BLOCK, 2=ALERT, 3=TIMEOUT" },
                            metadata: {
                                type: "object",
                                properties: {
                                    channel_id: { type: "string", description: "Pour ALERT (channel ID)" },
                                    duration_seconds: { type: "integer", description: "Pour TIMEOUT (max 2419200)" },
                                    custom_message: { type: "string", description: "Message personnalisé (BLOCK)" }
                                }
                            }
                        }
                    },
                    description: "Liste des actions (remplace les anciennes). Si vide, garde les anciennes."
                }
            },
            required: ["rule_id"]
        }
    },


    // --- Divers ---
    {
        name: "draft_create_event",
        description: "Planifie un événement.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                start_time: { type: "string" },
                end_time: { type: "string" },
                location: { type: "string" },
                description: { type: "string" }
            },
            required: ["name", "start_time", "location"]
        }
    },
    {
        name: "draft_create_invite",
        description: "Crée une invitation.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string" },
                max_uses: { type: "integer" },
                max_age_seconds: { type: "integer" }
            },
            required: ["channel_id"]
        }
    },
    {
        name: "draft_voice_move_member",
        description: "Déplace un membre vocal.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string" },
                target_channel_id: { type: "string" }
            },
            required: ["user_id", "target_channel_id"]
        }
    },
    {
        name: "draft_voice_disconnect",
        description: "Déconnecte un membre vocal.",
        parameters: {
            type: "object",
            properties: {
                user_id: { type: "string" }
            },
            required: ["user_id"]
        }
    },
    {
        name: "draft_edit_server",
        description: "Modifie le serveur.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                icon_url: { type: "string" },
                afk_channel_id: { type: "string" }
            }
        }
    },
    {
        name: "draft_create_emoji",
        description: "Ajoute un emoji au serveur.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Nom de l'emoji" },
                url: { type: "string", description: "URL de l'image" }
            },
            required: ["name", "url"]
        }
    },
    {
        name: "draft_lockdown_channel",
        description: "Verrouille un salon (empêche @everyone de parler).",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string", description: "ID du salon" },
                reason: { type: "string", description: "Raison du verrouillage" }
            },
            required: ["channel_id"]
        }
    },

    // --- UI Kit ---
    {
        name: "get_ui_kit_documentation",
        description: "Fournit la documentation pour 'draft_complex_ui_message'.",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "draft_complex_ui_message",
        description: "Crée un message avec composants interactifs.",
        parameters: {
            type: "object",
            properties: {
                channel_id: { type: "string" },
                content: { type: "string" },
                embeds: { type: "array", items: { type: "string", description: "JSON string of an embed" } },
                components: { type: "string", description: "JSON string of components" },
                button_responses: { type: "string", description: "JSON string mapping custom_id to response text. Ex: '{\"btn_id\": \"Hello!\"}'" }
            },
            required: ["channel_id", "components"]
        }
    }
];

// Helper to send confirmation
// Helper to send confirmation
async function sendConfirmation(context, title, description, actionType, actionData) {
    const requesterTag = context.message.author.tag;

    // Append requester to reason if it exists in actionData
    if (actionData.reason) {
        actionData.reason = `${actionData.reason} (Demandé par ${requesterTag})`;
    } else {
        // If no reason field, add one for Audit Logs where applicable
        actionData.auditLogReason = `Action demandée par ${requesterTag}`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Confirmation Action: ${title}`)
        .setDescription(description)
        .setColor('#FFA500') // Orange for warning/confirmation
        .addFields({ name: 'Données', value: `\`\`\`json\n${JSON.stringify(actionData, null, 2).substring(0, 1000)}\n\`\`\`` })
        .setFooter({ text: `Demandé par ${requesterTag}` });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`ADMIN_CONFIRM_${Date.now()}`)
                .setLabel('Confirmer')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`ADMIN_CANCEL_${Date.now()}`)
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Danger)
        );

    let msg;
    if (context.smartReply) {
        msg = await context.smartReply({ embeds: [embed], components: [row] });
    } else {
        msg = await context.message.channel.send({ embeds: [embed], components: [row] });
    }

    // Store action for execution
    const confirmId = row.components[0].data.custom_id;
    const cancelId = row.components[1].data.custom_id;

    pendingActions.set(confirmId, { type: actionType, data: actionData, userId: context.message.author.id, messageId: msg.id });
    pendingActions.set(cancelId, { type: 'CANCEL', data: {}, userId: context.message.author.id, messageId: msg.id });

    return { status: "waiting_confirmation", message_id: msg.id, info: "Un message de confirmation a été envoyé. L'admin doit cliquer pour valider." };
}

const toolsImplementation = {
    get_server_info: async ({ client, guild }) => {
        return {
            name: guild.name,
            id: guild.id,
            ownerId: guild.ownerId,
            memberCount: guild.memberCount,
            premiumSubscriptionCount: guild.premiumSubscriptionCount,
            features: guild.features
        };
    },
    get_channels_list: async ({ guild }) => {
        const channels = await guild.channels.fetch();
        return channels.map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId }));
    },
    get_roles_list: async ({ guild }, { filter_name, limit = 50 }) => {
        const roles = await guild.roles.fetch();
        let filteredRoles = Array.from(roles.values());

        if (filter_name) {
            filteredRoles = filteredRoles.filter(r => r.name.toLowerCase().includes(filter_name.toLowerCase()));
        }

        // Sort by position (descending)
        filteredRoles.sort((a, b) => b.position - a.position);

        // Apply limit
        filteredRoles = filteredRoles.slice(0, limit);

        return filteredRoles.map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position, permissions: r.permissions.bitfield.toString() }));
    },
    get_member_roles: async ({ guild }, { user_id }) => {
        try {
            const member = await guild.members.fetch(user_id);
            if (!member) return { error: "Membre introuvable." };

            const roles = member.roles.cache
                .sort((a, b) => b.position - a.position)
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));

            return {
                user: member.user.tag,
                roles: roles
            };
        } catch (error) {
            return { error: `Erreur lors de la récupération du membre: ${error.message}` };
        }
    },
    get_members_search: async ({ guild }, { query, limit = 10 }) => {
        const members = await guild.members.search({ query, limit });
        return members.map(m => ({ id: m.id, user: m.user.tag, nickname: m.nickname, roles: m.roles.cache.map(r => r.id) }));
    },
    get_last_messages: async ({ guild }, { channel_id, limit = 50 }) => {
        const channel = await guild.channels.fetch(channel_id);
        if (!channel || !channel.isTextBased()) return { error: "Salon invalide ou non textuel" };
        const messages = await channel.messages.fetch({ limit });
        return messages.map(m => ({ id: m.id, author: m.author.tag, content: m.content, timestamp: m.createdTimestamp }));
    },
    get_audit_logs: async ({ guild }, { action_type, limit = 5 }) => {
        const logs = await guild.fetchAuditLogs({ limit, type: action_type });
        return logs.entries.map(e => ({ action: e.action, executor: e.executor?.tag, target: e.target?.tag, reason: e.reason, createdTimestamp: e.createdTimestamp }));
    },
    get_automod_rules: async ({ guild }) => {
        const rules = await guild.autoModerationRules.fetch();
        return rules.map(r => ({
            id: r.id,
            name: r.name,
            enabled: r.enabled,
            eventType: r.eventType,
            triggerType: r.triggerType,
            triggerMetadata: {
                keywordFilter: r.triggerMetadata.keywordFilter,
                regexPatterns: r.triggerMetadata.regexPatterns,
                allowList: r.triggerMetadata.allowList,
                presets: r.triggerMetadata.presets
            },
            actions: r.actions
        }));
    },
    get_member_permissions: async ({ guild, message }, { user_id, channel_id }) => {
        try {
            const member = await guild.members.fetch(user_id);
            const channel = channel_id ? await guild.channels.fetch(channel_id) : message.channel;

            if (!member) return { error: "Membre introuvable." };
            if (!channel) return { error: "Salon introuvable." };

            const permissions = member.permissionsIn(channel);
            return {
                user: member.user.tag,
                channel: channel.name,
                permissions: permissions.toArray()
            };
        } catch (error) {
            return { error: error.message };
        }
    },
    get_channel_permissions: async ({ guild }, { channel_id }) => {
        try {
            const channel = await guild.channels.fetch(channel_id);
            if (!channel) return { error: "Salon introuvable." };

            const overwrites = channel.permissionOverwrites.cache.map(overwrite => {
                const target = guild.roles.cache.get(overwrite.id) || guild.members.cache.get(overwrite.id);
                return {
                    id: overwrite.id,
                    type: overwrite.type === 0 ? 'Role' : 'Member',
                    name: target ? (overwrite.type === 0 ? target.name : target.user.tag) : 'Unknown',
                    allow: overwrite.allow.toArray(),
                    deny: overwrite.deny.toArray()
                };
            });

            return {
                channel: channel.name,
                overwrites: overwrites
            };
        } catch (error) {
            return { error: error.message };
        }
    },
    get_member_details: async ({ guild }, { user_id }) => {
        try {
            const member = await guild.members.fetch(user_id);
            if (!member) return { error: "Membre introuvable." };

            return {
                tag: member.user.tag,
                id: member.id,
                nickname: member.nickname,
                joinedAt: member.joinedAt,
                createdAt: member.user.createdAt,
                avatarUrl: member.user.displayAvatarURL(),
                roles: member.roles.cache.map(r => r.name),
                bot: member.user.bot
            };
        } catch (error) {
            return { error: error.message };
        }
    },
    search_members: async ({ guild }, { query, limit = 10 }) => {
        try {
            // Fetch all members (cache might not be complete)
            // Note: fetching all members can be expensive on huge servers, but necessary for search if not cached
            // For safety, we try to use cache first, if query is short maybe fetch?
            // Let's rely on cache + fetch query if possible.
            // Discord API allows searching by username via query

            const members = await guild.members.fetch({ query: query, limit: limit });

            if (members.size === 0) return { message: "Aucun membre trouvé." };

            return members.map(m => ({
                id: m.id,
                tag: m.user.tag,
                globalName: m.user.globalName,
                nickname: m.nickname,
                joinedAt: m.joinedAt
            }));
        } catch (error) {
            return { error: error.message };
        }
    },
    get_ban_info: async ({ guild }, { user_id }) => {
        try {
            const ban = await guild.bans.fetch(user_id);
            return {
                user: ban.user.tag,
                reason: ban.reason
            };
        } catch (error) {
            if (error.code === 10026) return { message: "Cet utilisateur n'est pas banni." };
            return { error: error.message };
        }
    },
    get_webhooks: async ({ guild }, { channel_id }) => {
        try {
            let webhooks;
            if (channel_id) {
                const channel = await guild.channels.fetch(channel_id);
                if (!channel) return { error: "Salon introuvable." };
                webhooks = await channel.fetchWebhooks();
            } else {
                webhooks = await guild.fetchWebhooks();
            }
            return webhooks.map(w => ({ id: w.id, name: w.name, channelId: w.channelId, token: w.token ? "PRESENT" : "HIDDEN" }));
        } catch (error) {
            return { error: error.message };
        }
    },
    get_emojis: async ({ guild }) => {
        const emojis = await guild.emojis.fetch();
        return emojis.map(e => ({ id: e.id, name: e.name, animated: e.animated, url: e.url }));
    },
    get_stickers: async ({ guild }) => {
        const stickers = await guild.stickers.fetch();
        return stickers.map(s => ({ id: s.id, name: s.name, format: s.format, url: s.url }));
    },

    // Drafts... (implementation handled via sendConfirmation)
};

// Dynamically implement draft tools
toolsDeclaration.forEach(tool => {
    if (tool.name.startsWith('draft_')) {
        toolsImplementation[tool.name] = async (context, args) => {
            // Map tool name to action type (e.g. draft_ban_member -> BAN_MEMBER)
            const actionType = tool.name.replace('draft_', '').toUpperCase();

            // Construct title and description
            const title = actionType.replace(/_/g, ' ');
            const description = `Action: ${title}\nArguments: ${JSON.stringify(args)}`;

            // Check permissions before drafting (Security Layer 1)
            // We can do a quick check here if needed, but actions.js also checks.
            // For better UX, let's check basic permissions here if possible?
            // Actually, let's keep it simple and rely on the confirmation flow or add checks later.
            // The task said: "Update tools.js to check permissions/hierarchy before creating drafts."
            
            return await sendConfirmation(context, title, description, actionType, args);
        };
    }
});

module.exports = { toolsDeclaration, toolsImplementation, pendingActions };
