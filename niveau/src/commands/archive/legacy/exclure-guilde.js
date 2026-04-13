const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildOfUser, removeMemberFromGuild, updateGuildLevel, dissolveGuild, GUILD_RANKS } = require('../../../utils/db-guilds');
const { updateGuildChannelPermissions } = require('../../../utils/guild/guild-upgrades');
const { hasCustomPermission, CUSTOM_ROLE_PERMISSIONS } = require('../../../utils/guild/guild-custom-roles');
const logger = require('../../../utils/logger');
const roleConfig = require('../../../config/role.config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('exclureguilde')
        .setDescription('Exclure un membre de votre guilde (Chef de guilde ou Admin uniquement).')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à exclure.')
                .setRequired(true)),

    async execute(interaction) {
        const executor = interaction.member;
        const targetUser = interaction.options.getUser('membre');
        const isServerAdmin = executor.permissions.has(PermissionFlagsBits.Administrator);

        const executorGuild = getGuildOfUser(executor.id);
        const targetGuild = getGuildOfUser(targetUser.id);

        // --- Vérifications de base ---
        if (!targetGuild) {
            return interaction.reply({ content: `Ce membre ne fait partie d'aucune guilde.`, flags: 64 });
        }

        // --- Vérification des Permissions ---
        if (!isServerAdmin) {
            if (!executorGuild) {
                return interaction.reply({ content: 'Vous n\'êtes pas dans une guilde.', flags: 64 });
            }

            const isGuildOwner = executorGuild.owner_id === executor.id;
            const isSubChief = executorGuild.sub_chiefs && executorGuild.sub_chiefs.includes(executor.id);
            const hasCustomKickPermission = hasCustomPermission(executorGuild.id, executor.id, CUSTOM_ROLE_PERMISSIONS.KICK_MEMBER);

            if (!isGuildOwner && !isSubChief && !hasCustomKickPermission) {
                return interaction.reply({ content: 'Seul le chef, un sous-chef, un membre avec la permission "expulser" ou un administrateur du serveur peut utiliser cette commande.', flags: 64 });
            }

            if (targetGuild.id !== executorGuild.id) {
                return interaction.reply({ content: `Ce membre ne fait pas partie de votre guilde.`, flags: 64 });
            }

            if (targetUser.id === executorGuild.owner_id) {
                return interaction.reply({ content: 'Vous ne pouvez pas exclure le chef de la guilde.', flags: 64 });
            }

            if (targetUser.id === executor.id) {
                return interaction.reply({ content: 'Vous ne pouvez pas vous exclure vous-même.', flags: 64 });
            }
        }

        try {
            await interaction.deferReply();

            // --- Cas Spécial : Admin exclut le Chef de Guilde ---
            if (isServerAdmin && targetGuild.owner_id === targetUser.id) {
                const discordGuild = interaction.guild;

                // Supprimer le salon privé si existant
                if (targetGuild.channel_id) {
                    try {
                        const channel = await discordGuild.channels.fetch(targetGuild.channel_id).catch(() => null);
                        if (channel) {
                            await channel.delete('Guilde dissoute par admin');
                        }
                    } catch (error) {
                        logger.warn(`Impossible de supprimer le salon ${targetGuild.channel_id}:`, error.message);
                    }
                }

                // Supprimer le rôle "Créateur de Guilde" du chef
                try {
                    const ownerMember = await discordGuild.members.fetch(targetUser.id).catch(() => null);
                    const creatorRole = discordGuild.roles.cache.find(r => r.name === roleConfig.questRewardRoles.guildCreator);
                    if (ownerMember && creatorRole) {
                        await ownerMember.roles.remove(creatorRole);
                    }
                } catch (error) {
                    logger.warn(`Impossible de retirer le rôle "${roleConfig.questRewardRoles.guildCreator}":`, error.message);
                }

                // Dissoudre la guilde
                dissolveGuild(targetGuild.id);

                return interaction.editReply({ content: `🚨 **ACTION ADMIN** : Le chef de guilde **${targetUser.username}** a été exclu. La guilde **${targetGuild.name}** a été dissoute.` });
            }

            // Exclure le membre
            removeMemberFromGuild(targetUser.id);

            // Mettre à jour les permissions du salon (V5)
            if (targetGuild.channel_id) {
                await updateGuildChannelPermissions(interaction.client, targetGuild, targetUser.id, 'remove');
            }

            updateGuildLevel(targetGuild.id);

            await interaction.editReply({ content: `**${targetUser.username}** a été exclu(e) de la guilde "**${targetGuild.name}**".` });

            // Envoyer une notification à l'utilisateur exclu
            await targetUser.send(`Vous avez été exclu(e) de la guilde "**${targetGuild.name}**".`).catch(() => { logger.warn(`Impossible d'envoyer un message privé à ${targetUser.username} après son exclusion.`); });

        } catch (error) {
            logger.error(`Erreur lors de l'exclusion de ${targetUser.username} par ${executor.user.username}:`, error);
            await interaction.followUp({ content: 'Une erreur est survenue. Veuillez réessayer.', flags: 64 });
        }
    },
};