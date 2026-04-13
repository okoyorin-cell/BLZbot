const { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, TextDisplayBuilder, SectionBuilder, ContainerBuilder, MediaGalleryBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { getGuildOfUser, getGuildByName, getGuildMembersWithDetails, getGuildById, removeMemberFromGuild, dissolveGuild, addGuildSubChief, removeGuildSubChief, updateGuildOwnerAndSubChiefs, getGuildMemberCount, checkGuildPenalties, getGuildMaxSlots, GUILD_RANKS } = require('../../utils/db-guilds');
const { getOrCreateUser } = require('../../utils/db-users');
const { getOngoingWar } = require('../../utils/guild/guild-wars');
const logger = require('../../utils/logger');
const { renderGuildProfileV2 } = require('../../utils/canvas-guild-profile-v2');
const { updateGuildChannelPermissions } = require('../../utils/guild/guild-upgrades');
const db = require('../../database/database');
const roleConfig = require('../../config/role.config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil-guilde')
        .setDescription("Affiche les informations d'une guilde.")
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Le nom de la guilde à afficher (par default, la vôtre).')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const guildName = interaction.options.getString('nom');
        let guild = guildName ? getGuildByName(guildName) : getGuildOfUser(interaction.user.id);

        if (!guild) {
            // Error message using Components V2
            const errorText = new TextDisplayBuilder()
                .setContent("❌ **Erreur**\nGuilde non trouvée. Si vous n'êtes pas dans une guilde, vous devez spécifier un nom.");
            const container = new ContainerBuilder().addTextDisplayComponents(errorText);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // Récupérer les données nécessaires
        let members = getGuildMembersWithDetails(guild.id);
        let owner = await interaction.client.users.fetch(guild.owner_id).catch(() => null);
        const totalMembers = members.length;

        // Vérifier les pénalités de surcharge
        const penaltyCheck = checkGuildPenalties(guild.id);
        const maxSlots = getGuildMaxSlots(guild);

        // Si pénalité active, afficher un avertissement
        let penaltyWarning = null;
        if (penaltyCheck.isRestricted) {
            penaltyWarning = `⚠️ **ATTENTION : SURCHARGE DE MEMBRES** ⚠️\n` +
                `Votre guilde dépasse la limite autorisée (${totalMembers}/${maxSlots}).\n` +
                `**Sanctions actives :**\n` +
                `• Fonctionnalités bloquées (Guerres, Upgrades, etc.)\n` +
                `• Pénalité quotidienne : -${(penaltyCheck.excess * 1000).toLocaleString('fr-FR')} stars par membre !\n` +
                `👉 Excluez ${penaltyCheck.excess} membre(s) immédiatement.`;
        }

        // Info guerre
        const war = getOngoingWar(guild.id);
        let warInfo = null;
        if (war) {
            const opponentId = war.guild1_id === guild.id ? war.guild2_id : war.guild1_id;
            const opponent = getGuildById(opponentId);
            warInfo = {
                status: 'ongoing',
                opponent: opponent ? opponent.name : 'Inconnu',
                timeRemaining: war.end_time - Date.now()
            };
        }

        const isOwner = guild.owner_id === interaction.user.id;
        const isSubChief = guild.sub_chiefs && guild.sub_chiefs.includes(interaction.user.id);

        // Function to render and send the guild profile image
        const renderAndSendProfile = async (currentGuild = guild, currentMembers = members, currentOwner = owner) => {
            const png = await renderGuildProfileV2({
                guild: currentGuild,
                members: currentMembers.slice(0, 10),
                owner: currentOwner || { username: 'Inconnu' },
                warInfo: warInfo,
                totalMembers: currentMembers.length
            });
            const file = new AttachmentBuilder(png, { name: 'guild_profile_v2.png' });

            // Use MediaGallery for the image
            const mediaGallery = new MediaGalleryBuilder()
                .addItems({ media: { url: 'attachment://guild_profile_v2.png' } });

            const container = new ContainerBuilder().addMediaGalleryComponents(mediaGallery);

            return {
                files: [file],
                container: container, // Return container separately to add buttons later
                flags: MessageFlags.IsComponentsV2
            };
        };

        // Boutons interactifs
        const buildButtons = () => {
            // Row 1: General Info
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`guild_full_list_${guild.id}`)
                    .setLabel('Liste Complète')
                    .setEmoji('📋')
                    .setStyle(ButtonStyle.Primary), // Blue
                new ButtonBuilder()
                    .setCustomId(`guild_careers_${guild.id}`)
                    .setLabel('Carrières')
                    .setEmoji('🎓')
                    .setStyle(ButtonStyle.Secondary), // Grey
                new ButtonBuilder()
                    .setCustomId(`guild_quests_${guild.id}`)
                    .setLabel('Quêtes')
                    .setEmoji('📜')
                    .setStyle(ButtonStyle.Success) // Green
            );

            // Row 2: Actions (Leave, Manage, Dissolve)
            const row2 = new ActionRowBuilder();

            // Show "Quitter" if the user is a member (even owner, as per user request/screenshot)
            if (getGuildOfUser(interaction.user.id)?.id === guild.id) {
                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`guild_leave_${guild.id}`)
                        .setLabel('Quitter la guilde')
                        .setEmoji('🚪')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(isOwner)
                );
            }

            if (isOwner || isSubChief) {
                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`guild_rank_up_${guild.id}`) // Updated ID to match handler
                        .setLabel('Gérer les rangs')
                        .setEmoji('👑')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            // Bouton Gestion des Rôles (Upgrade 7+) pour le Chef uniquement
            if (isOwner && guild.upgrade_level >= 7) {
                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`guild_custom_roles_${guild.id}`)
                        .setLabel('Gérer Rôles')
                        .setEmoji('🎭')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            if (isOwner) {
                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`guild_dissolve_${guild.id}`)
                        .setLabel('Dissoudre')
                        .setEmoji('🔥')
                        .setStyle(ButtonStyle.Danger)
                );
            }

            const components = [row1];
            if (row2.components.length > 0) components.push(row2);

            return components;
        };

        // Note: ActionRow cannot be mixed directly in the same array as Section/MediaGallery if they are top-level?
        // Actually, MediaGallery is a top-level component. ActionRow is also top-level.
        // So we can have [MediaGallery, ActionRow, ActionRow...].

        // However, we need to split the buttons if there are too many.
        // The buildButtons function returns ONE ActionRow.
        // If we have many buttons, we might need multiple rows.
        // For now, let's assume it fits in one or two rows.
        // I'll adjust buildButtons to return an array of rows if needed, but for now it returns one.
        // Wait, I added "Quitter", "Gérer Rangs", "Dissoudre". That's 3 + 3 = 6 buttons.
        // Max 5 buttons per row.
        // I need to split them.

        // buildButtonRows removed as it is unused and replaced by buildButtons

        const initialReplyContent = await renderAndSendProfile();
        const initialContainer = initialReplyContent.container;

        // Ajouter l'avertissement de pénalité si nécessaire
        if (penaltyWarning) {
            const warningText = new TextDisplayBuilder().setContent(penaltyWarning);
            // On l'ajoute au début (ou on crée un container séparé, mais TextDisplayBuilder est empilable)
            // ContainerBuilder.addTextDisplayComponents accepte plusieurs
            // Mais attention, initialContainer a déjà un MediaGallery.
            // On peut ajouter du texte AVANT ou APRÈS.
            // Ajoutons le texte AVANT l'image pour qu'il soit bien visible.
            // Note: addTextDisplayComponents ajoute à la liste existante.

            // Astuce: créer un nouveau container avec l'avertissement et l'envoyer en premier dans la liste des components ?
            // Non, editReply prend un tableau de components (Containers).
            // Donc on peut créer un container d'alerte.

            const alertContainer = new ContainerBuilder().addTextDisplayComponents(warningText);
            // On insère ce container en premier

            const buttonRows = buildButtons();
            initialContainer.addActionRowComponents(...buttonRows);

            // On envoie [AlertContainer, MainContainer]
            await interaction.editReply({
                files: initialReplyContent.files,
                components: [alertContainer, initialContainer],
                flags: initialReplyContent.flags
            });
        } else {
            // Comportement normal
            const buttonRows = buildButtons();
            initialContainer.addActionRowComponents(...buttonRows);

            await interaction.editReply({
                files: initialReplyContent.files,
                components: [initialContainer],
                flags: initialReplyContent.flags
            });
        }

        // Get the message instance (editReply returns it)
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 10 * 60 * 1000,
            filter: (i) => i.user.id === interaction.user.id // Sécurité: seul l'utilisateur qui a lancé la commande peut interagir
        });

        collector.on('collect', async i => {
            try {
                // Recalculer les permissions à chaque interaction (au cas où les rôles ont changé)
                const currentGuild = getGuildById(guild.id);
                const currentIsOwner = currentGuild && currentGuild.owner_id === i.user.id;
                const currentIsSubChief = currentGuild && currentGuild.sub_chiefs && currentGuild.sub_chiefs.includes(i.user.id);

                // ============================================
                // BOUTON: Liste Complète des Membres
                // ============================================
                if (i.customId.startsWith('guild_full_list')) {
                    await i.deferUpdate();

                    // Récupérer les données fraîches de la guilde
                    guild = getGuildById(guild.id);
                    members = getGuildMembersWithDetails(guild.id);

                    // Afficher la liste complète des membres
                    const memberList = members.map((m, idx) => {
                        let roleName = 'Membre';
                        let roleIcon = '👤';

                        if (m.role === GUILD_RANKS.CHEF) {
                            roleName = 'Chef';
                            roleIcon = '👑';
                        } else if (m.role === GUILD_RANKS.SOUS_CHEF) {
                            roleName = 'Sous-Chef';
                            roleIcon = '⚔️';
                        }

                        return `${idx + 1}. ${roleIcon} **${m.username}** - Niveau ${m.level} - ${roleName}`;
                    }).join('\n');

                    const listText = new TextDisplayBuilder()
                        .setContent(`# 📋 Membres de ${guild.name}\n${memberList || 'Aucun membre.'}\n\n*Total: ${members.length}/${guild.member_slots} places*`);

                    const container = new ContainerBuilder().addTextDisplayComponents(listText);

                    await i.followUp({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
                }

                // ============================================
                // BOUTON: Carrières de Guilde (Statistiques de la guilde)
                // ============================================
                else if (i.customId.startsWith('guild_careers')) {
                    await i.deferUpdate();

                    guild = getGuildById(guild.id);

                    const statsText = `
### 📈 Niveau & Progression
• **Niveau:** ${guild.level}
• **Upgrade:** ${guild.upgrade_level}/10
• **Places:** ${members.length}/${guild.member_slots}

### 💰 Trésorerie ${guild.upgrade_level < 2 ? '(🔒 Déblocage à l\'Upgrade 2)' : ''}
${guild.upgrade_level >= 2 ? `• **Actuelle:** ${guild.treasury.toLocaleString('fr-FR')}⭐
• **Capacité:** ${guild.treasury_capacity.toLocaleString('fr-FR')}⭐
• **Total généré:** ${(guild.total_treasury_generated || 0).toLocaleString('fr-FR')}⭐` : '• Non débloquée'}

### ⚔️ Guerres ${guild.upgrade_level < 6 ? '(🔒 Déblocage à l\'Upgrade 6)' : ''}
${guild.upgrade_level >= 6 ? `• **Gagnées:** ${guild.wars_won}
• **Victoires 70%:** ${guild.wars_won_70}
• **Victoires 80%:** ${guild.wars_won_80}
• **Victoires 90%:** ${guild.wars_won_90}` : '• Non débloquées'}

### 🎯 Boosts Actifs
• **XP:** +${((guild.xp_boost_purchased || 0) * 100).toFixed(0)}%
• **Points:** +${((guild.points_boost_purchased || 0) * 100).toFixed(0)}%
• **Stars:** +${((guild.stars_boost_purchased || 0) * 100).toFixed(0)}%
• **Multiplicateur trésorerie:** x${guild.treasury_multiplier_purchased || 1}

### 📅 Informations
• **Créée le:** <t:${Math.floor(guild.created_at / 1000)}:D>
• **Salon privé:** ${guild.channel_id ? '✅ Créé' : '❌ Non créé'}
                    `.trim();

                    const careerText = new TextDisplayBuilder()
                        .setContent(`# 📊 Carrières - ${guild.name}\n${statsText}`);

                    const container = new ContainerBuilder().addTextDisplayComponents(careerText);

                    await i.followUp({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
                }

                // ============================================
                // BOUTON: Quêtes de Guilde
                // ============================================
                else if (i.customId.startsWith('guild_quests')) {
                    await i.deferUpdate();

                    const { getGuildQuestsWithProgress } = require('../../utils/guild/guild-quests');
                    // Note: guild is already defined in the scope and is the correct object.
                    // No need to re-fetch it using getGuildById, which might fail if ID types mismatch.

                    const quests = getGuildQuestsWithProgress(guild.id);

                    // Grouper par type
                    const questsByType = {
                        treasury: [],
                        level: [],
                        war_win: [],
                        war_win_70: [],
                        war_win_80: [],
                        war_win_90: [],
                        upgrade: [],
                        prestige: []
                    };

                    quests.forEach(quest => {
                        if (questsByType[quest.type]) {
                            questsByType[quest.type].push(quest);
                        }
                    });

                    let questTextContent = '';
                    const categories = [
                        { key: 'treasury', name: '💰 Trésorerie' },
                        { key: 'level', name: '⭐ Niveau' },
                        { key: 'war_win', name: '⚔️ Guerres' },
                        { key: 'upgrade', name: '🔼 Upgrades' },
                        { key: 'prestige', name: '👑 Prestige' }
                    ];

                    for (const category of categories) {
                        let categoryQuests = questsByType[category.key];

                        // Pour les guerres, regrouper toutes les sous-catégories
                        if (category.key === 'war_win') {
                            categoryQuests = [
                                ...questsByType.war_win,
                                ...questsByType.war_win_70,
                                ...questsByType.war_win_80,
                                ...questsByType.war_win_90
                            ];
                        }

                        if (categoryQuests.length > 0) {
                            questTextContent += `\n### ${category.name}\n`;
                            categoryQuests.forEach(q => {
                                const status = q.completed ? '✅' : '⏳';
                                const rarityEmojis = {
                                    'Commun': '⚪',
                                    'Rare': '🔵',
                                    'Épique': '🟣',
                                    'Légendaire': '🟠',
                                    'Mythique': '🔴',
                                    'Goatesque': '🌟'
                                };
                                const rarityEmoji = rarityEmojis[q.rarity] || '⭐';

                                let rewardText = '';
                                if (q.reward_type === 'xp') {
                                    rewardText = `${q.reward_amount.toLocaleString('fr-FR')} EXP`;
                                } else if (q.reward_type === 'stars') {
                                    rewardText = `${q.reward_amount.toLocaleString('fr-FR')} starss`;
                                } else if (q.reward_type === 'unlock') {
                                    rewardText = 'Déblocage';
                                } else if (q.reward_type === 'role') {
                                    rewardText = 'Rôles de prestige';
                                }

                                questTextContent += `${status} ${rarityEmoji} **${q.description}**\n└ Récompense: ${rewardText}\n`;
                            });
                        }
                    }

                    const questText = new TextDisplayBuilder()
                        .setContent(`# 🎯 Quêtes - ${guild.name}\n${questTextContent || 'Aucune quête disponible.'}\n\n*Complétées: ${quests.filter(q => q.completed).length}/${quests.length}*`);

                    const container = new ContainerBuilder().addTextDisplayComponents(questText);

                    // Add Back button if needed, but for now just display
                    // The user asked for the button to work, and I added "Back" button support in profile.js, 
                    // but profil-guilde.js uses a different structure (followUp).
                    // To support "Back", I would need to implement similar logic as profile.js, 
                    // but profil-guilde.js is already complex. 
                    // For now, I'll stick to followUp as it was before, but with fixed content.

                    await i.followUp({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
                }

                // --- LOGIC FOR LEAVE GUILD ---
                else if (i.customId.startsWith('guild_leave')) {
                    // Retirer les permissions du salon (V5)
                    if (guild.channel_id) {
                        await updateGuildChannelPermissions(interaction.client, guild, i.user.id, 'remove');
                    }
                    removeMemberFromGuild(i.user.id);
                    await i.reply({ content: `Vous avez quitté la guilde "**${guild.name}**".`, ephemeral: true });
                    collector.stop();
                }

                // --- LOGIC FOR DISSOLVE GUILD ---
                else if (i.customId.startsWith('guild_dissolve')) {
                    if (!currentIsOwner) {
                        return i.reply({ content: 'Seul le chef de guilde peut dissoudre la guilde.', ephemeral: true });
                    }

                    const confirmText = new TextDisplayBuilder()
                        .setContent(`# ⚠️ DISSOLUTION\nÊtes-vous absolument sûr de vouloir dissoudre la guilde **${guild.name}** ?\n\n**CETTE ACTION EST IRRÉVERSIBLE.**`);

                    const container = new ContainerBuilder().addTextDisplayComponents(confirmText);

                    const confirmButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dissolve_confirm').setLabel('Oui, dissoudre !').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('dissolve_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
                    );

                    const confirmMsg = await i.reply({
                        components: [container, confirmButtons],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true,
                        fetchReply: true
                    });

                    try {
                        const confirmation = await confirmMsg.awaitMessageComponent({ filter: click => click.user.id === i.user.id, time: 60_000 });
                        if (confirmation.customId === 'dissolve_confirm') {
                            const ownerId = guild.owner_id;
                            const discordGuild = interaction.guild;

                            // Supprimer le salon privé si existant
                            if (guild.channel_id) {
                                try {
                                    const channel = await discordGuild.channels.fetch(guild.channel_id).catch(() => null);
                                    if (channel) {
                                        await channel.delete('Guilde dissoute');
                                    }
                                } catch (error) {
                                    logger.error(`Impossible de supprimer le salon ${guild.channel_id}:`, error.message);
                                }
                            }

                            // Supprimer le rôle "Créateur de Guilde" du chef
                            const ownerMember = await discordGuild.members.fetch(ownerId).catch(() => null);
                            const creatorRole = discordGuild.roles.cache.find(r => r.name === roleConfig.questRewardRoles.guildCreator);

                            if (ownerMember && creatorRole) {
                                await ownerMember.roles.remove(creatorRole).catch(err => logger.error(`Failed to remove '${roleConfig.questRewardRoles.guildCreator}' role on dissolve:`, err));
                            }

                            dissolveGuild(guild.id);
                            const dissolveText = new TextDisplayBuilder().setContent(`La guilde **${guild.name}** a été dissoute.`);
                            const dissolveContainer = new ContainerBuilder().addTextDisplayComponents(dissolveText);
                            await interaction.editReply({ components: [dissolveContainer] });
                            const confirmDissolveText = new TextDisplayBuilder().setContent('Guilde dissoute.');
                            const confirmDissolveContainer = new ContainerBuilder().addTextDisplayComponents(confirmDissolveText);
                            await confirmation.update({ components: [confirmDissolveContainer] });
                            collector.stop();

                        } else {
                            const cancelText = new TextDisplayBuilder().setContent('Action annulée.');
                            const cancelContainer = new ContainerBuilder().addTextDisplayComponents(cancelText);
                            await confirmation.update({ components: [cancelContainer] });
                        }
                    } catch (e) {
                        const timeoutText = new TextDisplayBuilder().setContent('Confirmation non reçue, action annulée.');
                        const timeoutContainer = new ContainerBuilder().addTextDisplayComponents(timeoutText);
                        await i.editReply({ components: [timeoutContainer] });
                    }
                }

                // --- LOGIC FOR RANK MANAGEMENT ---
                else if (i.customId.startsWith('guild_rank_up')) { // Changed from guild_manage_rank to guild_rank_up to match button customId
                    // Constructing the modal using raw JSON to ensure Type 18 (Label) is used correctly
                    // as per Discord Components V2 Modal documentation.
                    // Type 18 = ComponentType.LABEL (container for components in modals)
                    // Type 5 = ComponentType.USER_SELECT
                    // Type 3 = ComponentType.STRING_SELECT
                    const modalData = {
                        title: 'Gestion des Rangs',
                        custom_id: `rank_action_modal_${guild.id}`,
                        components: [
                            {
                                type: 18, // ComponentType.LABEL
                                label: 'Membre à modifier',
                                component: {
                                    type: 5, // ComponentType.USER_SELECT
                                    custom_id: 'target_user_select',
                                    placeholder: 'Sélectionner un membre',
                                    max_values: 1,
                                    min_values: 1
                                }
                            },
                            {
                                type: 18, // ComponentType.LABEL
                                label: 'Nouveau rang',
                                component: {
                                    type: 3, // ComponentType.STRING_SELECT
                                    custom_id: 'target_rank_select',
                                    placeholder: 'Sélectionner un rang',
                                    options: [
                                        { label: 'Membre', value: GUILD_RANKS.MEMBRE, description: 'Rétrograder ou définir comme membre', emoji: { name: '👤' } },
                                        { label: 'Sous-Chef', value: GUILD_RANKS.SOUS_CHEF, description: 'Promouvoir comme Sous-Chef', emoji: { name: '⚔️' } },
                                        { label: 'Chef', value: GUILD_RANKS.CHEF, description: 'Transférer la propriété (Chef)', emoji: { name: '👑' } }
                                    ]
                                }
                            }
                        ]
                    };

                    await i.showModal(modalData);

                    try {
                        const modalSubmit = await i.awaitModalSubmit({ time: 120_000, filter: (submission) => submission.customId === `rank_action_modal_${guild.id}` });

                        // Defer the update to allow time for processing
                        await modalSubmit.deferReply({ ephemeral: true });

                        // Retrieve values from the modal submission
                        // Note: In V2 Modals with Type 18, values might be nested or accessible via standard fields.
                        // We check both standard fields and direct component access if needed.
                        // Usually modalSubmit.fields.getField('custom_id').values works.

                        let selectedUserId, selectedRank;

                        // Attempt to retrieve values safely
                        try {
                            // Access values from the new component structure
                            // For UserSelect (Type 5), values are in the 'values' array of the component data
                            selectedUserId = modalSubmit.fields.fields.get('target_user_select').values[0];
                            selectedRank = modalSubmit.fields.fields.get('target_rank_select').values[0];
                        } catch (err) {
                            logger.error('Error retrieving modal fields:', err);
                            const errorText = new TextDisplayBuilder().setContent('❌ Erreur lors de la récupération des données.');
                            const errorContainer = new ContainerBuilder().addTextDisplayComponents(errorText);
                            return modalSubmit.editReply({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 });
                        }

                        if (!selectedUserId || !selectedRank) {
                            const fillText = new TextDisplayBuilder().setContent('❌ Veuillez remplir tous les champs.');
                            const fillContainer = new ContainerBuilder().addTextDisplayComponents(fillText);
                            return modalSubmit.editReply({ components: [fillContainer], flags: MessageFlags.IsComponentsV2 });
                        }

                        // 1. Check if user exists in the server
                        const targetMember = await interaction.guild.members.fetch(selectedUserId).catch(() => null);
                        if (!targetMember) {
                            const notFoundText = new TextDisplayBuilder().setContent('❌ Ce membre est introuvable sur le serveur.');
                            const notFoundContainer = new ContainerBuilder().addTextDisplayComponents(notFoundText);
                            return modalSubmit.editReply({ components: [notFoundContainer], flags: MessageFlags.IsComponentsV2 });
                        }

                        // 2. Check if user is in the DB and in the SAME guild
                        const targetUserGuild = getGuildOfUser(selectedUserId);

                        if (!targetUserGuild || targetUserGuild.id !== guild.id) {
                            const notInGuildText = new TextDisplayBuilder().setContent(`❌ **${targetMember.displayName}** ne fait pas partie de votre guilde !`);
                            const notInGuildContainer = new ContainerBuilder().addTextDisplayComponents(notInGuildText);
                            return modalSubmit.editReply({ components: [notInGuildContainer], flags: MessageFlags.IsComponentsV2 });
                        }

                        // Permission checks and Logic
                        let replyMessage = '';
                        const targetUserDb = getOrCreateUser(selectedUserId);

                        if (selectedRank === GUILD_RANKS.CHEF) {
                            const chefOnlyText = new TextDisplayBuilder().setContent('❌ Seul le Chef peut transférer la propriété.');
                            const chefOnlyContainer = new ContainerBuilder().addTextDisplayComponents(chefOnlyText);
                            if (!currentIsOwner) return modalSubmit.editReply({ components: [chefOnlyContainer], flags: MessageFlags.IsComponentsV2 });

                            const oldOwnerId = guild.owner_id;
                            updateGuildOwnerAndSubChiefs(guild.id, selectedUserId, guild.sub_chiefs);

                            // Mettre à jour les permissions du salon (nouveau chef = ManageMessages, ancien chef = normal)
                            const updatedGuild = getGuildById(guild.id);
                            await updateGuildChannelPermissions(interaction.client, updatedGuild, selectedUserId, 'add');
                            await updateGuildChannelPermissions(interaction.client, updatedGuild, oldOwnerId, 'add');

                            replyMessage = `✅ La propriété de la guilde a été transférée à <@${selectedUserId}>.`;
                        } else if (selectedRank === GUILD_RANKS.SOUS_CHEF) {
                            const chefOnlySubText = new TextDisplayBuilder().setContent('❌ Seul le Chef peut nommer des Sous-Chefs.');
                            const chefOnlySubContainer = new ContainerBuilder().addTextDisplayComponents(chefOnlySubText);
                            if (!currentIsOwner) return modalSubmit.editReply({ components: [chefOnlySubContainer], flags: MessageFlags.IsComponentsV2 });
                            addGuildSubChief(guild.id, selectedUserId);
                            replyMessage = `✅ <@${selectedUserId}> a été promu Sous-Chef.`;
                        } else if (selectedRank === GUILD_RANKS.MEMBRE) {
                            const noDemoteChefText = new TextDisplayBuilder().setContent('❌ Le Chef ne peut pas être rétrogradé.');
                            const noDemoteChefContainer = new ContainerBuilder().addTextDisplayComponents(noDemoteChefText);
                            if (targetUserDb.id === guild.owner_id) return modalSubmit.editReply({ components: [noDemoteChefContainer], flags: MessageFlags.IsComponentsV2 });
                            // sub_chiefs est déjà un tableau (parsé par getGuildOfUser/getGuildById)
                            const subChiefs = Array.isArray(guild.sub_chiefs) ? guild.sub_chiefs : [];
                            const isTargetSubChief = subChiefs.includes(selectedUserId);
                            if (isTargetSubChief) {
                                const chefOnlyDemoteText = new TextDisplayBuilder().setContent('❌ Seul le Chef peut rétrograder un Sous-Chef.');
                                const chefOnlyDemoteContainer = new ContainerBuilder().addTextDisplayComponents(chefOnlyDemoteText);
                                if (!currentIsOwner) return modalSubmit.editReply({ components: [chefOnlyDemoteContainer], flags: MessageFlags.IsComponentsV2 });
                                removeGuildSubChief(guild.id, selectedUserId);
                                replyMessage = `✅ <@${selectedUserId}> a été rétrogradé Membre.`;
                            } else {
                                replyMessage = `ℹ️ <@${selectedUserId}> est déjà Membre.`;
                            }
                        }

                        const successText = new TextDisplayBuilder().setContent(replyMessage);
                        const successContainer = new ContainerBuilder().addTextDisplayComponents(successText);

                        await modalSubmit.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });

                        // Refresh profile
                        // We need to fetch updated data to re-render the profile
                        const updatedGuild = getGuildOfUser(guild.id); // Re-fetch guild data
                        if (updatedGuild) {
                            const updatedMembers = getGuildMembersWithDetails(updatedGuild.id);
                            const updatedOwner = await interaction.guild.members.fetch(updatedGuild.owner_id).catch(() => null);
                            const updatedReplyContent = await renderAndSendProfile(updatedGuild, updatedMembers, updatedOwner);
                            const updatedContainer = updatedReplyContent.container;
                            updatedContainer.addActionRowComponents(...buildButtons());
                            // Update the original interaction message (the profile)
                            await interaction.editReply({
                                files: updatedReplyContent.files,
                                components: [updatedContainer],
                                flags: updatedReplyContent.flags
                            });
                        }

                    } catch (err) {
                        if (err.code === 'InteractionCollectorError') {
                            // Modal timed out
                            return;
                        }
                        logger.error('Error in rank management modal:', err);
                        // Try to reply if not already replied
                        try { await i.followUp({ content: '❌ Une erreur est survenue.', ephemeral: true }); } catch (e) { }
                    }
                }

                // ============================================
                // BOUTON: Gérer les Rôles Personnalisés (Upgrade 7+)
                // ============================================
                else if (i.customId.startsWith('guild_custom_roles')) {
                    const { getGuildCustomRoles, saveGuildCustomRoles } = require('../../utils/db-guilds');

                    if (!isOwner) {
                        return i.reply({ content: '❌ Seul le Chef peut gérer les rôles personnalisés.', ephemeral: true });
                    }
                    if (guild.upgrade_level < 7) {
                        return i.reply({ content: '❌ Cette fonctionnalité nécessite le niveau d\'amélioration 7.', ephemeral: true });
                    }

                    // Récupérer les rôles existants
                    const customRoles = getGuildCustomRoles(guild.id) || [];

                    // Constuire l'interface de gestion
                    // On ne peut pas gérer dynamiquement complexe ici facilement sans une nouvelle commande/fichier dédié
                    // Mais on va faire un Select Menu pour choisir une action: "Créer un rôle", "Modifier un rôle", "Supprimer un rôle"

                    const options = [
                        { label: 'Créer un rôle', value: 'create_role', description: 'Ajouter un nouveau rôle personnalisé', emoji: { name: '➕' } }
                    ];

                    // Ajouter les rôles existants à la modification/suppression
                    if (customRoles.length > 0) {
                        options.push({ label: 'Supprimer un rôle', value: 'delete_role', description: 'Supprimer un rôle existant', emoji: { name: '🗑️' } });
                        options.push({ label: 'Modifier les permissions', value: 'edit_role', description: 'Changer les permissions d\'un rôle', emoji: { name: '⚙️' } });
                    }

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`custom_role_action_${guild.id}`)
                        .setPlaceholder('Que voulez-vous faire ?')
                        .addOptions(options);

                    const row = new ActionRowBuilder().addComponents(selectMenu);
                    const text = new TextDisplayBuilder().setContent(`# 🎭 Gestion des Rôles Personnalisés\nVous avez **${customRoles.length}/3** rôles configurés.\n\nSélectionnez une action ci-dessous.`);
                    const container = new ContainerBuilder().addTextDisplayComponents(text);

                    await i.reply({ components: [container, row], flags: MessageFlags.IsComponentsV2, ephemeral: true });
                }
            } catch (error) {
                logger.error('Erreur lors du traitement du bouton profil-guilde:', error);
                await i.reply({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => { });
            }
        });

        // --- SECOND COLLECTOR FOR CUSTOM ROLES ACTIONS (Ephemeral Interactions) ---
        // Since the previous collector is bound to the original message, ephemeral responses need their own handling logic
        // But `profil-guilde.js` uses a monolithic execute function.
        // Handling interactions on ephemeral messages sent by the bot *within* the same command execution context is tricky 
        // because we can't easily attach a collector to an ephemeral response unless we await it.
        // However, we just sent an ephemeral reply. We can create a collector on the interaction's channel or use a global handler.
        // Best practice in this simple architecture: Assume global interaction handler `interactionCreate.js` will route logic... 
        // BUT `profil-guilde` logic is self-contained in `execute`.
        // The "correct" way for ephemeral subsequent interactions is either to handle them via global event 
        // OR to attach a collector to the channel filtering by user (but ephemeral messages are invisible to channel collectors?).
        // Actually, `i.reply` returns a InteractionResponse not a Message for ephemeral? 
        // Wait, for ephemeral messages, you cannot fetch the message object easily to attach a collector.
        // A common pattern is to handle "sub-interactions" via `interactionCreate.js`.

        // HOWEVER, to keep it self-contained for this task without modifying `interactionCreate.js` globally:
        // We will switch the `guild_custom_roles` logic to send a MODAL directly for creation if requested via a button in the menu?
        // No, we used a Select Menu.
        // We need a way to handle the select menu selection.
        // Since we cannot easily attach a collector to the ephemeral message *we just sent*,
        // we might need to use a non-ephemeral message or rely on `interactionCreate.js`.

        // Let's check `interactionCreate.js` to see how it handles custom IDs.
        // Typically it routes based on command name or custom ID prefixes.
        // If I create a new file `src/commands/guilds/roles.js` (as planned), I can move logic there.
        // The plan said: "[NEW] src/commands/guilds/roles.js - New command/interaction handler".
        // This is the cleanest way. `profil-guilde.js` just opens the menu, `roles.js` handles the rest via global routing.

        // So here in `profil-guilde.js`, I just output the initial menu.
        // AND I need to ensure `interactionCreate.js` routes `custom_role_action_` to the new handler.

        // BUT for now, let's look at `interactionCreate.js`.

        collector.on('end', () => {
            // Cleanup if needed
        });
    },
};