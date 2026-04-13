const { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, EmbedBuilder } = require('discord.js');
const { getGuildOfUser, getGuildByName, getGuildMembersWithDetails, getGuildById } = require('../utils/db-guilds');
const { getOrCreateUser } = require('../utils/db-users');
const { getOngoingWar } = require('../utils/guild/guild-wars');
const logger = require('../utils/logger');
const { renderGuildProfileV2 } = require('../utils/canvas-guild-profile-v2');
const db = require('../database/database');
const roleConfig = require('../config/role.config.json');

const { guildCreator, ultimateGuildCreator } = roleConfig.questRewardRoles;

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
            return interaction.editReply({ content: "Guilde non trouvée. Si vous n'êtes pas dans une guilde, vous devez spécifier un nom.", ephemeral: true });
        }

        // Récupérer les données nécessaires
        let members = getGuildMembersWithDetails(guild.id);
        let owner = await interaction.client.users.fetch(guild.owner_id).catch(() => null);
        const totalMembers = members.length;
        
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

        // Function to render and send the guild profile image
        const renderAndSendProfile = async () => {
            const png = await renderGuildProfileV2({
                guild: guild,
                members: members.slice(0, 10), // Seulement les 10 premiers pour le canvas
                owner: owner || { username: 'Inconnu' },
                warInfo: warInfo,
                totalMembers: totalMembers
            });
            const file = new AttachmentBuilder(png, { name: 'guild_profile_v2.png' });
            return { files: [file] };
        };

        // Boutons interactifs
        const buildButtons = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`guild_full_list_${guild.id}`)
                .setLabel('📋 Liste Complète')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`guild_careers_${guild.id}`)
                .setLabel('📊 Carrières')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`guild_quests_${guild.id}`)
                .setLabel('🎯 Quêtes')
                .setStyle(ButtonStyle.Success)
        );

        const initialReplyContent = await renderAndSendProfile();
        const message = await interaction.editReply({
            ...initialReplyContent,
            components: [buildButtons()]
        });

        const collector = message.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 10 * 60 * 1000 
        });

        collector.on('collect', async i => {
            try {
                // ============================================
                // BOUTON: Liste Complète des Membres
                // ============================================
                if (i.customId.startsWith('guild_full_list')) {
                await i.deferUpdate();

                if (currentGuildData.member_slots >= 15) {
                    return i.followUp({ content: 'Votre guilde a déjà atteint le nombre maximum de 15 places.', ephemeral: true });
                }

                const user = getOrCreateUser(i.user.id, i.user.username);
                if (user.stars < SLOT_COST) {
                    return i.followUp({ content: `Il vous manque **${(SLOT_COST - user.stars).toLocaleString('fr-FR')}** Starss.`, ephemeral: true });
                }
                grantResources(i.client, i.user.id, { stars: -SLOT_COST });
                increaseGuildSlots(currentGuildData.id, 1);
                const updatedGuild = getGuildOfUser(i.user.id);
                const updatedMembers = getGuildMembersWithDetails(updatedGuild.id);
                const updatedOwner = await interaction.guild.members.fetch(updatedGuild.owner_id).catch(() => null);
                const updatedReplyContent = await renderAndSendProfile(updatedGuild, updatedMembers, updatedOwner);
                await interaction.editReply({ ...updatedReplyContent, components: [buildButtons()] });
                await i.followUp({ content: `Place achetée ! Votre guilde a maintenant **${updatedGuild.member_slots}** places.`, ephemeral: true });
            }

            // --- LOGIC FOR LEAVE GUILD ---
            else if (i.customId.startsWith('guild_leave')) {
                removeMemberFromGuild(i.user.id);
                await i.reply({ content: `Vous avez quitté la guilde "**${guild.name}**".`, ephemeral: true });
                collector.stop();
            }

            // --- LOGIC FOR DISSOLVE GUILD ---
            else if (i.customId.startsWith('guild_dissolve')) {
                if (!isOwner) {
                    return i.reply({ content: 'Seul le chef de guilde peut dissoudre la guilde.', ephemeral: true });
                }
                const confirmButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('dissolve_confirm').setLabel('Oui, dissoudre !').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('dissolve_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
                );
                const confirmMsg = await i.reply({ content: `Êtes-vous absolument sûr de vouloir dissoudre la guilde **${guild.name}** ? Cette action est irréversible.`, components: [confirmButtons], ephemeral: true, fetchReply: true });
                
                try {
                    const confirmation = await confirmMsg.awaitMessageComponent({ filter: click => click.user.id === i.user.id, time: 60_000 });
                    if (confirmation.customId === 'dissolve_confirm') {
                        const ownerId = guild.owner_id;
                        const ownerMember = await interaction.guild.members.fetch(ownerId).catch(() => null);
                        const creatorRole = interaction.guild.roles.cache.find(r => r.name === guildCreator);

                        if (ownerMember && creatorRole) {
                            await ownerMember.roles.remove(creatorRole).catch(err => logger.error(`Failed to remove '${guildCreator}' role on dissolve:`, err));
                        }

                        dissolveGuild(guild.id);
                        await interaction.editReply({ content: `La guilde **${guild.name}** a été dissoute.`, embeds: [], components: [] });
                        await confirmation.update({ content: 'Guilde dissoute.', components: [] });
                        collector.stop();
                    } else {
                        await confirmation.update({ content: 'Action annulée.', components: [] });
                    }
                } catch (e) {
                    await i.editReply({ content: 'Confirmation non reçue, action annulée.', components: []});
                }
            }

            // --- LOGIC FOR RANK UP ---
            else if (i.customId.startsWith('guild_rank_up')) {
                await i.deferUpdate();

                const rankUpButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rank_action_promote_${guild.id}`).setLabel('Promouvoir').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`rank_action_demote_${guild.id}`).setLabel('Rétrograder').setStyle(ButtonStyle.Danger)
                );
                await interaction.editReply({ content: 'Choisissez une action de rang:', components: [rankUpButtons] });

                let rankActionInteraction;
                try {
                    rankActionInteraction = await message.awaitMessageComponent({ filter: click => click.user.id === i.user.id && (click.customId.startsWith('rank_action_promote') || click.customId.startsWith('rank_action_demote')), time: 60_000 });
                } catch (e) {
                    logger.warn('No rank action selected within timeout');
                    return;
                }

                const actionType = rankActionInteraction.customId.split('_')[2]; // 'promote' or 'demote'

                // Create the modal immediately and respond with it before waiting for rank selection
                // This avoids the 3-second interaction timeout
                let showConfirmation = false;
                
                if (actionType === 'promote' && isOwner) {
                    // Show confirmation modal for promoting to chief
                    const modal = new ModalBuilder()
                        .setCustomId(`rank_action_modal_${guild.id}`)
                        .setTitle(`Sélectionner le membre à promouvoir`);
                    const targetUserInput = new TextInputBuilder()
                        .setCustomId('target_user_id')
                        .setLabel("ID ou nom d'utilisateur du membre")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                    const targetRankInput = new TextInputBuilder()
                        .setCustomId('target_rank')
                        .setLabel("Rang (membre, sous-chef, chef)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('membre');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(targetUserInput),
                        new ActionRowBuilder().addComponents(targetRankInput)
                    );
                    
                    try {
                        await rankActionInteraction.showModal(modal);
                        logger.info(`Modal shown for promote action`);
                    } catch (err) {
                        logger.error(`Failed to show modal for promote:`, err);
                        await rankActionInteraction.deferUpdate();
                        return interaction.editReply({ content: 'Erreur lors de l\'ouverture du modal.', components: [buildButtons()] });
                    }
                } else {
                    // For demote or non-owner promote, use simpler modal
                    await rankActionInteraction.deferUpdate();
                    
                    const rankSelectionButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`rank_select_member_${guild.id}`).setLabel('Membre').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`rank_select_subchief_${guild.id}`).setLabel('Sous-Chef').setStyle(ButtonStyle.Primary).setDisabled(actionType === 'promote'), // Can't promote to sub-chef if not owner
                        new ButtonBuilder().setCustomId(`rank_select_chief_${guild.id}`).setLabel('Chef').setStyle(ButtonStyle.Danger).setDisabled(true) // Can't select chief from here
                    );
                    await interaction.editReply({ content: `Choisissez le rang à ${actionType === 'promote' ? 'promouvoir' : 'rétrograder'} vers:`, components: [rankSelectionButtons] });

                    let rankSelectInteraction;
                    try {
                        rankSelectInteraction = await message.awaitMessageComponent({ filter: click => click.user.id === i.user.id && click.customId.startsWith('rank_select'), time: 60_000 });
                    } catch (e) {
                        logger.warn('No rank selected within timeout');
                        return;
                    }

                    const targetRank = rankSelectInteraction.customId.split('_')[2]; // 'member' or 'subchief'
                    
                    const modal = new ModalBuilder()
                        .setCustomId(`rank_target_modal_${guild.id}`)
                        .setTitle(`Sélectionner le membre à ${actionType === 'promote' ? 'promouvoir' : 'rétrograder'}`);
                    const targetUserInput = new TextInputBuilder()
                        .setCustomId('target_user_id')
                        .setLabel("ID ou nom d'utilisateur du membre")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(targetUserInput));

                    try {
                        await rankSelectInteraction.showModal(modal);
                        logger.info(`Modal shown for ${actionType} action`);
                    } catch (err) {
                        logger.error(`Failed to show modal for ${actionType}:`, err);
                        await rankSelectInteraction.deferUpdate();
                        return interaction.editReply({ content: 'Erreur lors de l\'ouverture du modal.', components: [buildButtons()] });
                    }

                    try {
                        const modalSubmit = await rankSelectInteraction.awaitModalSubmit({ time: 120_000 });
                        await modalSubmit.deferReply({ ephemeral: true });
                        
                        const targetUserId = modalSubmit.fields.getTextInputValue('target_user_id');
                        logger.info(`User provided target identifier='${targetUserId}' (user=${i.user.id})`);
                        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

                        if (!targetMember) {
                            logger.warn(`Target member not found for identifier='${targetUserId}'`);
                            return modalSubmit.editReply({ content: `Membre introuvable pour : ${targetUserId}` });
                        }
                        const targetUserGuildData = getGuildOfUser(targetMember.id);
                        if (!targetUserGuildData || targetUserGuildData.id !== guild.id) {
                            return modalSubmit.editReply({ content: `${targetMember.displayName} n'est pas dans votre guilde.` });
                        }

                        let replyMessage = '';
                        let currentGuild = getGuildOfUser(guild.owner_id);
                        let currentSubChiefs = currentGuild.sub_chiefs;

                        if (actionType === 'promote') {
                            if (targetRank === 'member') {
                                if (currentSubChiefs.includes(targetMember.id)) {
                                    removeGuildSubChief(guild.id, targetMember.id);
                                    replyMessage = `${targetMember.displayName} a été rétrogradé au rang de Membre.`;
                                } else {
                                    replyMessage = `${targetMember.displayName} est déjà un Membre.`;
                                }
                            } else if (targetRank === 'subchief') {
                                if (targetMember.id === currentGuild.owner_id) {
                                    replyMessage = `${targetMember.displayName} est déjà le Chef de guilde.`;
                                } else if (currentSubChiefs.includes(targetMember.id)) {
                                    replyMessage = `${targetMember.displayName} est déjà un Sous-Chef.`;
                                } else {
                                    addGuildSubChief(guild.id, targetMember.id);
                                    replyMessage = `${targetMember.displayName} a été promu Sous-Chef !`;
                                }
                            }
                        } else if (actionType === 'demote') {
                            if (targetRank === 'member') {
                                if (targetMember.id === currentGuild.owner_id) {
                                    return modalSubmit.editReply({ content: 'Vous ne pouvez pas rétrograder le Chef de guilde en Membre directement.' });
                                } else if (currentSubChiefs.includes(targetMember.id)) {
                                    removeGuildSubChief(guild.id, targetMember.id);
                                    replyMessage = `${targetMember.displayName} a été rétrogradé au rang de Membre.`;
                                } else {
                                    replyMessage = `${targetMember.displayName} est déjà un Membre.`;
                                }
                            } else if (targetRank === 'subchief') {
                                if (targetMember.id === currentGuild.owner_id) {
                                    return modalSubmit.editReply({ content: 'Vous ne pouvez pas rétrograder le Chef de guilde en Sous-Chef directement.' });
                                } else if (currentSubChiefs.includes(targetMember.id)) {
                                    replyMessage = `${targetMember.displayName} est déjà un Sous-Chef.`;
                                } else {
                                    replyMessage = `${targetMember.displayName} est déjà un Membre, ne peut pas être rétrogradé en Sous-Chef.`;
                                }
                            }
                        }

                        const updatedGuild = getGuildOfUser(guild.owner_id);
                        const updatedMembers = getGuildMembersWithDetails(updatedGuild.id);
                        const updatedOwner = await interaction.guild.members.fetch(updatedGuild.owner_id).catch(() => null);
                        const updatedReplyContent = await renderAndSendProfile(updatedGuild, updatedMembers, updatedOwner);
                        await interaction.editReply({ ...updatedReplyContent, components: [buildButtons()] });
                        await modalSubmit.editReply({ content: replyMessage });

                    } catch (e) {
                        logger.error('Erreur lors de la soumission du modal de rang:', e);
                        return interaction.editReply({ content: 'Action annulée ou erreur lors de la soumission du modal.', components: [buildButtons()] });
                    }
                    return; // Exit here for non-chief promotion
                }

                // Handle chief promotion (separate path)
                try {
                    const modalSubmit = await rankActionInteraction.awaitModalSubmit({ time: 120_000 });
                    await modalSubmit.deferReply({ ephemeral: true });
                    
                    const targetUserId = modalSubmit.fields.getTextInputValue('target_user_id');
                    const targetRankStr = modalSubmit.fields.getTextInputValue('target_rank').toLowerCase();
                    const targetRank = targetRankStr === 'chef' ? 'chief' : (targetRankStr === 'sous-chef' ? 'subchief' : 'member');
                    
                    logger.info(`User provided target identifier='${targetUserId}' rank='${targetRank}' (user=${i.user.id})`);
                    const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

                    if (!targetMember) {
                        logger.warn(`Target member not found for identifier='${targetUserId}'`);
                        return modalSubmit.editReply({ content: `Membre introuvable pour : ${targetUserId}` });
                    }
                    const targetUserGuildData = getGuildOfUser(targetMember.id);
                    if (!targetUserGuildData || targetUserGuildData.id !== guild.id) {
                        return modalSubmit.editReply({ content: `${targetMember.displayName} n'est pas dans votre guilde.` });
                    }

                    let replyMessage = '';
                    let currentGuild = getGuildOfUser(guild.owner_id);
                    let currentSubChiefs = currentGuild.sub_chiefs;

                    if (targetRank === 'chief') {
                        if (targetMember.id === currentGuild.owner_id) {
                            replyMessage = `${targetMember.displayName} est déjà le Chef de guilde.`;
                        } else {
                            const newSubChiefs = currentSubChiefs.filter(id => id !== targetMember.id);
                            logger.info(`About to update guild owner. guild=${guild.id} oldOwner=${currentGuild.owner_id} newOwner=${targetMember.id} by=${i.user.id}`);
                            try {
                                updateGuildOwnerAndSubChiefs(guild.id, targetMember.id, newSubChiefs);
                                logger.info(`updateGuildOwnerAndSubChiefs succeeded for guild=${guild.id}`);
                            } catch (updateErr) {
                                logger.error(`updateGuildOwnerAndSubChiefs failed for guild=${guild.id}:`, updateErr);
                            }

                            const oldOwnerMember = i.member;
                            const newOwnerMember = targetMember;
                            const creatorRole = interaction.guild.roles.cache.find(r => r.name === guildCreator);
                            const ultimateRole = interaction.guild.roles.cache.find(r => r.name === ultimateGuildCreator);

                            if (creatorRole) {
                                if (oldOwnerMember) {
                                    await oldOwnerMember.roles.remove(creatorRole).catch(err => logger.error(`Failed to remove role from old owner:`, err));
                                    logger.info(`Removed role '${guildCreator}' from ${oldOwnerMember.id}`);
                                }
                                if (newOwnerMember) {
                                    await newOwnerMember.roles.add(creatorRole).catch(err => logger.error(`Failed to add role to new owner:`, err));
                                    logger.info(`Added role '${guildCreator}' to ${newOwnerMember.id}`);
                                }
                            }

                            if (ultimateRole) {
                                const memberCount = getGuildMemberCount(guild.id);
                                if (oldOwnerMember && oldOwnerMember.roles.cache.has(ultimateRole.id)) {
                                    await oldOwnerMember.roles.remove(ultimateRole).catch(err => logger.error(`Failed to remove ultimate role from old owner:`, err));
                                    logger.info(`Removed role '${ultimateGuildCreator}' from ${oldOwnerMember.id}`);
                                }
                                if (newOwnerMember && memberCount >= 15) {
                                    await newOwnerMember.roles.add(ultimateRole).catch(err => logger.error(`Failed to add ultimate role to new owner:`, err));
                                    logger.info(`Added role '${ultimateGuildCreator}' to ${newOwnerMember.id}`);
                                }
                            }

                            replyMessage = `${targetMember.displayName} est maintenant le nouveau Chef de guilde ! ${i.user.displayName} est maintenant Sous-Chef.`;
                        }
                    } else if (targetRank === 'subchief') {
                        if (targetMember.id === currentGuild.owner_id) {
                            replyMessage = `${targetMember.displayName} est déjà le Chef de guilde.`;
                        } else if (currentSubChiefs.includes(targetMember.id)) {
                            replyMessage = `${targetMember.displayName} est déjà un Sous-Chef.`;
                        } else {
                            addGuildSubChief(guild.id, targetMember.id);
                            replyMessage = `${targetMember.displayName} a été promu Sous-Chef !`;
                        }
                    } else if (targetRank === 'member') {
                        if (currentSubChiefs.includes(targetMember.id)) {
                            removeGuildSubChief(guild.id, targetMember.id);
                            replyMessage = `${targetMember.displayName} a été rétrogradé au rang de Membre.`;
                        } else {
                            replyMessage = `${targetMember.displayName} est déjà un Membre.`;
                        }
                    }

                    const updatedGuild = getGuildOfUser(guild.owner_id);
                    const updatedMembers = getGuildMembersWithDetails(updatedGuild.id);
                    const updatedOwner = await interaction.guild.members.fetch(updatedGuild.owner_id).catch(() => null);
                    const updatedReplyContent = await renderAndSendProfile(updatedGuild, updatedMembers, updatedOwner);
                    await interaction.editReply({ ...updatedReplyContent, components: [buildButtons()] });
                    await modalSubmit.editReply({ content: replyMessage });

                } catch (e) {
                    logger.error('Erreur lors de la soumission du modal de promotion:', e);
                    return interaction.editReply({ content: 'Action annulée ou erreur lors de la soumission du modal.', components: [buildButtons()] });
                }
            }
            } catch (error) {
                logger.error('Erreur lors du traitement du bouton profil-guilde:', error);
                if (i.deferred || i.replied) {
                    await i.editReply({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => {});
                } else {
                    await i.reply({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => {});
                }
            }
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    },
};