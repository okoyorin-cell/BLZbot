const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, ChannelType, PermissionFlagsBits } = require('discord.js');
const { getGuildOfUser, getGuildMemberCount, getLatestInviteForUser, getRecentInvitesByInviter, createInvitation, addMemberToGuild, updateGuildLevel, getGuildById, removeMemberFromGuild, dissolveGuild } = require('../../utils/db-guilds');
const { updateGuildChannelPermissions } = require('../../utils/guild/guild-upgrades');
const { areGuildFeaturesDisabled } = require('../../utils/guild/guild-overstaffing');
const { hasCustomPermission, CUSTOM_ROLE_PERMISSIONS } = require('../../utils/guild/guild-custom-roles');
const { msToTime } = require('../../utils/time');
const { checkQuestProgress } = require('../../utils/quests');
const db = require('../../database/database');
const logger = require('../../utils/logger');
const roleConfig = require('../../config/role.config.json');

const INVITE_COOLDOWN_USER = 12 * 60 * 60 * 1000; // 12 heures
const INVITE_COOLDOWN_INVITER_LIMIT = 3;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guilde-admin')
        .setDescription('Gérer les membres de votre guilde (Chef/Sous-chefs)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('inviter')
                .setDescription('Inviter un membre à rejoindre votre guilde')
                .addUserOption(option =>
                    option.setName('membre')
                        .setDescription('Le membre à inviter')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('exclure')
                .setDescription('Exclure un membre de votre guilde')
                .addUserOption(option =>
                    option.setName('membre')
                        .setDescription('Le membre à exclure')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'inviter') {
            await handleInviter(interaction);
        } else if (subcommand === 'exclure') {
            await handleExclure(interaction);
        }
    },
};

async function handleInviter(interaction) {
    const inviterId = interaction.user.id;
    const targetUser = interaction.options.getUser('membre');

    // --- Vérifications Préliminaires ---
    const guild = getGuildOfUser(inviterId);
    if (!guild) {
        return interaction.reply({ content: 'Vous devez être dans une guilde pour pouvoir inviter des membres.', flags: 64 });
    }

    // Vérifier le sureffectif
    if (areGuildFeaturesDisabled(guild.id)) {
        const memberCount = db.prepare('SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?')
            .get(guild.id).count;
        const maxAllowed = 12;
        
        if (memberCount > maxAllowed) {
            return interaction.reply({
                content: `❌ **Guilde en sureffectif !**\n\n` +
                    `Votre guilde a **${memberCount} membres** mais ne peut en avoir que **${maxAllowed} maximum**.\n` +
                    `Vous devez éjecter **${memberCount - maxAllowed} membre(s)** pour lever cette restriction.`,
                flags: 64
            });
        }
    }

    const isOwner = guild.owner_id === inviterId;
    const isSubChief = guild.sub_chiefs && guild.sub_chiefs.includes(inviterId);

    if (!isOwner && !isSubChief) {
        return interaction.reply({ content: 'Seuls le chef ou les sous-chefs de guilde peuvent inviter des membres.', flags: 64 });
    }
    if (targetUser.bot) {
        return interaction.reply({ content: 'Vous ne pouvez pas inviter un bot dans votre guilde.', flags: 64 });
    }
    if (targetUser.id === inviterId) {
        return interaction.reply({ content: 'Vous ne pouvez pas vous inviter vous-même.', flags: 64 });
    }
    if (getGuildOfUser(targetUser.id)) {
        return interaction.reply({ content: `**${targetUser.username}** est déjà dans une guilde.`, flags: 64 });
    }

    // --- Vérification des Cooldowns ---
    const recentInvitesByInviter = getRecentInvitesByInviter(inviterId);
    if (inviterId !== '845654783264030721' && recentInvitesByInviter.length >= INVITE_COOLDOWN_INVITER_LIMIT) {
        return interaction.reply({ content: `Vous avez atteint votre limite de ${INVITE_COOLDOWN_INVITER_LIMIT} invitations par heure.`, flags: 64 });
    }

    const latestInviteForUser = getLatestInviteForUser(targetUser.id);
    if (inviterId !== '845654783264030721' && latestInviteForUser) {
        const timeSinceInvite = Date.now() - latestInviteForUser.timestamp;
        if (timeSinceInvite < INVITE_COOLDOWN_USER) {
            const remainingTime = INVITE_COOLDOWN_USER - timeSinceInvite;
            return interaction.reply({ content: `Vous ne pouvez inviter cette personne à nouveau que dans **${msToTime(remainingTime)}**.`, flags: 64 });
        }
    }

    // --- Envoi de l'Invitation ---
    const invitationId = createInvitation(guild.id, targetUser.id, inviterId);
    const embed = new EmbedBuilder()
        .setTitle(`Invitation de ${guild.name}`)
        .setDescription(`${guild.emoji} **${guild.name}** vous invite à rejoindre leur guilde !`)
        .addFields({ name: 'Invité par', value: `${interaction.user.username}` })
        .setColor('Gold')
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_invite_${invitationId}`).setLabel('Accepter').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`decline_invite_${invitationId}`).setLabel('Refuser').setStyle(ButtonStyle.Danger),
    );

    try {
        await targetUser.send({ embeds: [embed], components: [buttons] });
        await interaction.reply({ content: `Invitation envoyée à **${targetUser.username}** ! Il/elle a 7 jours pour répondre.`, flags: 64 });
    } catch (error) {
        return interaction.reply({ content: `Impossible d'envoyer l'invitation à **${targetUser.username}** (MP fermés).`, flags: 64 });
    }

    // Collector sur le message privé
    try {
        const dm = await targetUser.createDM();
        const filter = i => (i.customId.startsWith('accept_invite_') || i.customId.startsWith('decline_invite_')) && i.user.id === targetUser.id;
        const collector = dm.createMessageComponentCollector({ filter, time: 7 * 24 * 60 * 60 * 1000 });

        collector.on('collect', async i => {
            if (i.customId.startsWith('accept_invite_')) {
                if (getGuildOfUser(targetUser.id)) {
                    await i.update({ content: 'Vous avez déjà rejoint une autre guilde.', components: [], embeds: [] });
                    return;
                }

                const currentGuild = getGuildById(guild.id);
                const memberCount = getGuildMemberCount(guild.id);

                if (memberCount >= currentGuild.max_members) {
                    await i.update({ content: `Cette guilde est maintenant complète (${currentGuild.max_members}/${currentGuild.max_members} membres).`, components: [], embeds: [] });
                    return;
                }

                addMemberToGuild(targetUser.id, guild.id);
                await i.update({ content: `Vous avez rejoint la guilde **${guild.name}** !`, components: [], embeds: [] });

                if (currentGuild.channel_id) {
                    await updateGuildChannelPermissions(interaction.client, currentGuild, targetUser.id, 'add');
                }

                updateGuildLevel(guild.id);
                checkQuestProgress(interaction.client, 'GUILD_MEMBER_JOIN', interaction.user);

                // Notifier l'inviteur
                const inviter = await interaction.client.users.fetch(inviterId).catch(() => null);
                if (inviter) {
                    await inviter.send(`${targetUser.username} a accepté votre invitation et a rejoint **${guild.name}** !`).catch(() => {});
                }

            } else if (i.customId.startsWith('decline_invite_')) {
                await i.update({ content: 'Vous avez refusé cette invitation.', components: [], embeds: [] });

                const inviter = await interaction.client.users.fetch(inviterId).catch(() => null);
                if (inviter) {
                    await inviter.send(`${targetUser.username} a refusé votre invitation.`).catch(() => {});
                }
            }
        });
    } catch (err) {
        logger.error('Erreur lors de la création du collector d\'invitation:', err);
    }
}

async function handleExclure(interaction) {
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
                logger.warn(`Impossible de retirer le rôle Créateur de Guilde:`, error.message);
            }

            // Dissoudre la guilde
            dissolveGuild(targetGuild.id, discordGuild);

            return interaction.editReply({ content: `✅ Le chef ${targetUser.username} a été exclu et la guilde **${targetGuild.name}** a été dissoute.` });
        }

        // --- Cas Normal : Exclusion d'un Membre ---
        removeMemberFromGuild(targetUser.id);

        if (targetGuild.channel_id) {
            await updateGuildChannelPermissions(interaction.client, targetGuild, targetUser.id, 'remove');
        }

        updateGuildLevel(targetGuild.id);

        await interaction.editReply({ content: `✅ **${targetUser.username}** a été exclu de la guilde **${targetGuild.name}**.` });

        // Notifier le membre exclu
        try {
            await targetUser.send(`Vous avez été exclu de la guilde **${targetGuild.name}**.`);
        } catch (error) {
            logger.warn(`Impossible d'envoyer un MP à ${targetUser.username}:`, error.message);
        }

    } catch (error) {
        logger.error(`Erreur lors de l'exclusion de ${targetUser.username} de la guilde ${targetGuild.name}:`, error);
        await interaction.followUp({ content: 'Une erreur est survenue. Veuillez réessayer.', flags: 64 });
    }
}
