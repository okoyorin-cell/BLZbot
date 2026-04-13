const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getEventState } = require('../../utils/db-halloween');
const { getEventState: getChristmasEventState } = require('../../utils/db-noel');
const logger = require('../../utils/logger');

// Safe interaction.update wrapper: catches Unknown Interaction errors (10062)
// and falls back to followUp or channel.send so the bot doesn't crash.
async function safeUpdate(interaction, options) {
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        } else {
            return await interaction.update(options);
        }
    } catch (err) {
        logger.error('safeUpdate failed:', err && err.code ? `${err.message} (code ${err.code})` : err);
        try {
            // If interaction is expired/unknown, try sending directly to the channel
            if (interaction.channel) {
                // If options contains ephemeral flag, remove it for channel.send
                const sendOptions = { ...options };
                // channel.send expects content/embeds/components similarly
                return await interaction.channel.send(sendOptions);
            }
            // Last resort: try replying if possible
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({ content: 'Action effectuée (interaction expirée).', flags: 64 });
            }
        } catch (err2) {
            logger.error('safeUpdate fallback failed:', err2);
            // swallow to avoid crashing the process
        }
    }
}

// --- Helper Functions ---
function formatDuration(ms) {
    if (!ms) return 'Non définie';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

function formatRewards(rewards) {
    if (!rewards || rewards.length === 0) return 'Aucune';
    return rewards.map(r => {
        if (r.type === 'autre') return r.value;
        if (r.type === 'role') return `<@&${r.value}>`;
        
        const formattedType = r.type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return `${parseInt(r.value).toLocaleString('fr-FR')} ${formattedType}`;
    }).join('\n');
}

function formatConditions(conditions) {
    if (!conditions || conditions.length === 0) return 'Aucune';
    const required = conditions.filter(c => c.type === 'role_required').map(c => `<@&${c.value}>`);
    const excluded = conditions.filter(c => c.type === 'role_excluded').map(c => `<@&${c.value}>`);
    
    let text = '';
    if (required.length > 0) {
        text += `**✅ Rôles Requis :**\n${required.join('\n')}\n\n`;
    }
    if (excluded.length > 0) {
        text += `**❌ Rôles Exclus :**\n${excluded.join('\n')}`;
    }
    const result = text.trim();
    return result || 'Aucune';
}

function buildGiveawayEmbed(giveawayData, isEnded = false) {
    const endsAt = giveawayData.ends_at || (Date.now() + giveawayData.duration);
    const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveawayData.title}`)
        .setDescription(giveawayData.description || 'Participez !')
        .setColor(isEnded ? 0xff0000 : 0x00ff00)
        .addFields(
            { name: '🏆 Gagnants', value: giveawayData.winner_count?.toString() || giveawayData.winnerCount?.toString() || '1', inline: true },
            { name: '⏰ Temps restant', value: isEnded ? 'Terminé' : `<t:${Math.floor(endsAt / 1000)}:R>`, inline: true },
            { name: '👥 Participants', value: (giveawayData.participants?.length || 0).toString(), inline: true },
            { name: '🎁 Récompenses', value: formatRewards(giveawayData.rewards), inline: false }
        );

    if (giveawayData.conditions && giveawayData.conditions.length > 0) {
        embed.addFields({ name: '📋 Conditions', value: formatConditions(giveawayData.conditions), inline: false });
    }

    return embed;
}

async function createRoleMenus(guild, customIdPrefix, maxMenus = 3, page = 0) {
    const parts = customIdPrefix.split('_');
    const userId = parts.pop();
    const prefix = parts.join('_');

    const roles = await guild.roles.fetch();
    const sortedRoles = Array.from(
        roles.filter(role => !role.managed && role.name !== '@everyone').values()
    ).sort((a, b) => a.name.localeCompare(b.name));

    if (sortedRoles.length === 0) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`${prefix}_0_${userId}`)
            .setPlaceholder('Aucun rôle disponible')
            .setDisabled(true)
            .addOptions({ label: 'aucun rôle', value: 'dummy' });
        return { menus: [new ActionRowBuilder().addComponents(menu)], totalPages: 1, currentPage: 0 };
    }

    // Grouper les rôles par lettre initiale
    const rolesByLetter = {};
    sortedRoles.forEach(role => {
        const firstLetter = role.name[0].toUpperCase();
        if (!rolesByLetter[firstLetter]) {
            rolesByLetter[firstLetter] = [];
        }
        rolesByLetter[firstLetter].push(role);
    });

    const letters = Object.keys(rolesByLetter).sort();
    const allMenus = [];
    let menuIndex = 0;
    let currentChunk = [];
    let startLetter = null;
    let endLetter = null;

    // Créer TOUS les menus possibles (sans limite pour la pagination)
    for (const letter of letters) {
        const rolesInLetter = rolesByLetter[letter];
        
        // Si ajouter cette lettre dépasse 25 rôles, créer un nouveau menu
        if (currentChunk.length + rolesInLetter.length > 25) {
            if (currentChunk.length > 0) {
                // Créer le menu avec le chunk actuel
                createMenuFromChunk(allMenus, currentChunk, startLetter, endLetter, prefix, menuIndex++, userId, sortedRoles.length);
                currentChunk = [];
                startLetter = null;
            }
        }

        // Ajouter les rôles de cette lettre au chunk actuel
        if (startLetter === null) {
            startLetter = letter;
        }
        endLetter = letter;
        
        // Si la lettre a plus de 25 rôles, il faut la découper
        if (rolesInLetter.length > 25) {
            // Créer un menu pour chaque tranche de 25 rôles
            for (let i = 0; i < rolesInLetter.length; i += 25) {
                const roleSlice = rolesInLetter.slice(i, i + 25);
                createMenuFromChunk(allMenus, roleSlice, letter, letter, prefix, menuIndex++, userId, sortedRoles.length);
            }
            // Réinitialiser pour la prochaine lettre
            currentChunk = [];
            startLetter = null;
        } else {
            currentChunk.push(...rolesInLetter);
        }
    }

    // Créer le dernier menu s'il reste des rôles
    if (currentChunk.length > 0) {
        createMenuFromChunk(allMenus, currentChunk, startLetter, endLetter, prefix, menuIndex++, userId, sortedRoles.length);
    }

    // Pagination : calculer le nombre total de pages
    const totalPages = Math.ceil(allMenus.length / maxMenus);
    const currentPage = Math.min(page, totalPages - 1);
    
    // Extraire les menus pour la page actuelle
    const startIdx = currentPage * maxMenus;
    const endIdx = Math.min(startIdx + maxMenus, allMenus.length);
    const pageMenus = allMenus.slice(startIdx, endIdx);

    return { menus: pageMenus, totalPages, currentPage, totalRoles: sortedRoles.length };
}

function createMenuFromChunk(menus, chunk, startLetter, endLetter, prefix, menuIndex, userId, totalRoles) {
    let placeholder;
    if (startLetter === endLetter) {
        placeholder = `Rôles (${startLetter})`;
    } else {
        placeholder = `Rôles (${startLetter} - ${endLetter})`;
    }
    
    // Ajouter le numéro de partie seulement s'il y a plusieurs menus
    if (totalRoles > 25) {
        placeholder += ` - ${menuIndex + 1}/${Math.ceil(totalRoles / 25)}`;
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`${prefix}_${menuIndex}_${userId}`)
        .setPlaceholder(placeholder.substring(0, 100));

    chunk.forEach(role => {
        menu.addOptions({
            label: role.name.substring(0, 100),
            value: role.id
        });
    });
    
    menus.push(new ActionRowBuilder().addComponents(menu));
}

// --- UI Steps ---

async function showInitialEmbed(interaction) {
    const embed = new EmbedBuilder().setTitle('🎉 Création d\'un Giveaway').setDescription('Cliquez sur le bouton ci-dessous pour commencer.').setColor(0x00ff00);
    const userId = interaction.user.id;
    const startButton = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway_start_${userId}`).setLabel('Créer un Giveaway').setStyle(ButtonStyle.Primary).setEmoji('🎉'));
    await interaction.reply({ embeds: [embed], components: [startButton] });
}

async function showConfigurationStep(interaction, session) {
    session.step = 'config';
    const embed = new EmbedBuilder().setTitle('🎉 Configuration du Giveaway').setDescription('Configurez les paramètres de base de votre giveaway.').setColor(0x00ff00)
        .addFields(
            { name: 'Titre', value: session.data.title || 'Non défini', inline: true },
            { name: 'Description', value: session.data.description || 'Non définie', inline: true },
            { name: 'Gagnants', value: session.data.winnerCount.toString(), inline: true },
            { name: 'Durée', value: formatDuration(session.data.duration), inline: true }
        );
    const userId = interaction.user.id;
    const actions = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_config_edit_${userId}`).setLabel('Modifier').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`giveaway_config_next_${userId}`).setLabel('Suivant →').setStyle(ButtonStyle.Primary).setDisabled(!session.data.title || !session.data.duration)
    );
    await safeUpdate(interaction, { embeds: [embed], components: [actions] });
}

async function showRewardStep(interaction, session) {
    session.step = 'rewards';
    const embed = new EmbedBuilder().setTitle('🎁 Récompenses').setDescription('Ajoutez les récompenses pour les gagnants.').setColor(0x00ff00).addFields({ name: 'Récompenses actuelles', value: formatRewards(session.data.rewards) });
    const userId = interaction.user.id;
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_add_reward_${userId}`).setLabel('Ajouter').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`giveaway_reward_next_${userId}`).setLabel('Suivant →').setStyle(ButtonStyle.Secondary).setDisabled(session.data.rewards.length === 0)
    );
    await safeUpdate(interaction, { embeds: [embed], components: [buttons] });
}

async function showRewardSelection(interaction) {
    const embed = new EmbedBuilder().setTitle('🎁 Sélection du Type de Récompense').setDescription('Choisissez le type de récompense à ajouter.').setColor(0x00ff00);
    const userId = interaction.user.id;
    const components = [];
    const mainButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_reward_role_${userId}`).setLabel('Rôle').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`giveaway_reward_xp_${userId}`).setLabel('XP').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`giveaway_reward_stars_${userId}`).setLabel('Starss').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`giveaway_reward_autre_${userId}`).setLabel('Autre').setStyle(ButtonStyle.Secondary)
    );
    components.push(mainButtons);
    if (getEventState('halloween')) {
        const halloweenButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`giveaway_reward_bonbons_${userId}`).setLabel('Bonbons').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`giveaway_reward_citrouilles_${userId}`).setLabel('Citrouilles').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`giveaway_reward_bonbons_surprise_${userId}`).setLabel('Bonbons Surprise').setStyle(ButtonStyle.Secondary)
        );
        components.push(halloweenButtons);
    }
    if (getChristmasEventState('noël')) {
        const christmasButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`giveaway_reward_rubans_${userId}`).setLabel('Rubans').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`giveaway_reward_cadeaux_surprise_${userId}`).setLabel('Cadeaux Surprise').setStyle(ButtonStyle.Secondary)
        );
        components.push(christmasButtons);
    }
    components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway_back_reward_${userId}`).setLabel('Retour').setStyle(ButtonStyle.Secondary)));
    await safeUpdate(interaction, { embeds: [embed], components });
}

async function showRoleSelection(interaction, session, context, page = 0) {
    const userId = interaction.user.id;
    
    // Limiter à 3 menus pour laisser la place aux boutons de navigation + bouton Retour (max 5 ActionRows)
    const { menus, totalPages, currentPage, totalRoles } = await createRoleMenus(interaction.guild, `roleMenu_${context}_${userId}`, 3, page);
    
    // Créer l'embed avec info de pagination
    let description = `Choisissez le rôle à utiliser comme récompense ou condition (${context}).\n\n`;
    if (totalPages > 1) {
        description += `📄 Page ${currentPage + 1}/${totalPages} • ${totalRoles} rôles au total`;
    } else {
        description += `📄 ${totalRoles} rôles disponibles`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('👤 Sélection du Rôle')
        .setDescription(description)
        .setColor(0x00ff00);
    
    const components = [...menus];
    
    // Ajouter les boutons de navigation si plusieurs pages
    if (totalPages > 1) {
        const navigationButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_role_prev_${context}_${userId}`)
                .setLabel('◀ Précédent')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`giveaway_role_next_${context}_${userId}`)
                .setLabel('Suivant ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages - 1)
        );
        components.push(navigationButtons);
    }
    
    // Bouton Retour
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`giveaway_back_${context.split('_')[0]}_${userId}`)
            .setLabel('Retour')
            .setStyle(ButtonStyle.Secondary)
    ));
    
    // Stocker la page actuelle dans la session
    if (!session.roleSelectionPages) session.roleSelectionPages = {};
    session.roleSelectionPages[context] = currentPage;
    
    await safeUpdate(interaction, { embeds: [embed], components });
}

async function showConditionStep(interaction, session) {
    session.step = 'conditions';
    const embed = new EmbedBuilder().setTitle('📋 Conditions de Participation').setDescription('Ajoutez des conditions de rôle.').setColor(0x00ff00).addFields({ name: 'Conditions actuelles', value: formatConditions(session.data.conditions) });
    const userId = interaction.user.id;
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_add_condition_${userId}`).setLabel('Ajouter une condition').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`giveaway_condition_next_${userId}`).setLabel('Suivant →').setStyle(ButtonStyle.Secondary)
    );
    await safeUpdate(interaction, { embeds: [embed], components: [buttons] });
}

async function showConditionSelection(interaction) {
    const embed = new EmbedBuilder().setTitle('📋 Sélection du Type de Condition').setDescription('Choisissez le type de condition de rôle à ajouter.').setColor(0x00ff00);
    const userId = interaction.user.id;
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_condition_role_required_${userId}`).setLabel('Rôle Requis').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`giveaway_condition_role_excluded_${userId}`).setLabel('Rôle Exclu').setStyle(ButtonStyle.Secondary)
    );
    const backButton = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway_back_condition_${userId}`).setLabel('Retour').setStyle(ButtonStyle.Secondary));
    await safeUpdate(interaction, { embeds: [embed], components: [buttons, backButton] });
}

async function showRepeatStep(interaction, session) {
    session.step = 'repeat';

    let intervalText = 'Aucun';
    if (session.data.repeatInterval) {
        // Simple format for display
        const totalSeconds = session.data.repeatInterval / 1000;
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        intervalText = [days > 0 ? `${days}j` : '', hours > 0 ? `${hours}h` : '', minutes > 0 ? `${minutes}m` : ''].filter(Boolean).join(' ');
    }

    const embed = new EmbedBuilder()
        .setTitle('🔁 Répétition du Giveaway')
        .setDescription('Voulez-vous que ce giveaway se répète automatiquement après sa fin ?')
        .setColor(0x00ff00)
        .addFields({ name: 'Intervalle actuel', value: intervalText });

    const userId = interaction.user.id;
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_repeat_set_${userId}`).setLabel('Définir/Modifier l\'intervalle').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`giveaway_repeat_clear_${userId}`).setLabel('Ne pas répéter').setStyle(ButtonStyle.Danger).setDisabled(!session.data.repeatInterval),
        new ButtonBuilder().setCustomId(`giveaway_repeat_next_${userId}`).setLabel('Suivant →').setStyle(ButtonStyle.Primary)
    );

    await safeUpdate(interaction, { embeds: [embed], components: [buttons] });
}

async function showConfirmStep(interaction, session) {
    session.step = 'confirm';
    const embed = new EmbedBuilder().setTitle('🎉 Confirmation du Giveaway').setDescription('Vérifiez les paramètres avant de lancer.').setColor(0x00ff00)
        .addFields(
            { name: 'Titre', value: session.data.title, inline: true },
            { name: 'Gagnants', value: session.data.winnerCount.toString(), inline: true },
            { name: 'Durée', value: formatDuration(session.data.duration), inline: true },
            { name: 'Description', value: session.data.description || 'Aucune', inline: false },
            { name: 'Récompenses', value: formatRewards(session.data.rewards), inline: false },
            { name: 'Conditions', value: formatConditions(session.data.conditions), inline: false }
        );
    const userId = interaction.user.id;
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_confirm_${userId}`).setLabel('Lancer le Giveaway').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`giveaway_cancel_${userId}`).setLabel('Annuler').setStyle(ButtonStyle.Danger)
    );
    await safeUpdate(interaction, { embeds: [embed], components: [buttons] });
}

module.exports = {
    showInitialEmbed,
    showConfigurationStep,
    showRewardStep,
    showRewardSelection,
    showRoleSelection,
    showConditionStep,
    showConditionSelection,
    showConfirmStep,
    showRepeatStep,
    formatRewards,
    formatDuration,
    buildGiveawayEmbed,
    safeUpdate
};