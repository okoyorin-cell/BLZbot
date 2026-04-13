const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, ChannelType } = require('discord.js');
const { getGuildOfUser, getGuildMemberCount, getLatestInviteForUser, getRecentInvitesByInviter, createInvitation, addMemberToGuild, updateGuildLevel, getGuildById } = require('../../../utils/db-guilds');
const { updateGuildChannelPermissions } = require('../../../utils/guild/guild-upgrades');
const { areGuildFeaturesDisabled } = require('../../../utils/guild/guild-overstaffing');
const { msToTime } = require('../../../utils/time');
const { checkQuestProgress } = require('../../../utils/quests');
const db = require('../../../database/database');
const logger = require('../../../utils/logger');

const INVITE_COOLDOWN_USER = 12 * 60 * 60 * 1000; // 12 heures
const INVITE_COOLDOWN_INVITER_LIMIT = 3;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inviterguilde')
        .setDescription('Inviter un membre à rejoindre votre guilde.')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à inviter.')
                .setRequired(true)),

    async execute(interaction) {
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
        logger.info(`ID de l'invitant : ${inviterId}, Invitations récentes : ${recentInvitesByInviter.length}`);
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
        const guildChannel = await interaction.client.channels.fetch(process.env.GUILD_CHANNEL).catch(() => null);
        if (!guildChannel || guildChannel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: 'Le salon d\'invitation de guilde n\'est pas configuré correctement. Veuillez contacter un administrateur.', flags: 64 });
        }

        createInvitation(guild.id, targetUser.id, inviterId);

        const embed = new EmbedBuilder()
            .setTitle(`Invitation de Guilde : ${guild.name}`)
            .setDescription(`${interaction.user.username} vous a invité(e) à rejoindre sa guilde !`)
            .setColor('Green')
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`guild_accept_${guild.id}`).setLabel('Accepter').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`guild_refuse_${guild.id}`).setLabel('Refuser').setStyle(ButtonStyle.Danger),
        );

        const { getOrCreateUser } = require('../../../utils/db-users');
        const targetUserData = getOrCreateUser(targetUser.id, targetUser.username);
        const shouldPing = targetUserData.notify_guild_invite !== 0;

        const inviteMsg = await guildChannel.send({
            content: `${targetUser}`,
            embeds: [embed],
            components: [buttons],
            allowedMentions: shouldPing ? undefined : { parse: [] }
        });
        await interaction.reply({ content: `Invitation envoyée à **${targetUser.username}** dans le salon ${guildChannel}.`, flags: 64 });

        // --- Collecteur d'Interactions ---
        const collector = inviteMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000 });

        collector.on('collect', async i => {
            if (i.user.id !== targetUser.id) {
                return i.reply({ content: 'Cette invitation ne vous est pas destinée.', flags: 64 });
            }

            await i.deferUpdate();

            if (i.customId.startsWith('guild_accept')) {
                // Vérifications finales avant d'accepter
                if (getGuildOfUser(i.user.id)) {
                    return i.followUp({ content: 'Vous avez rejoint une autre guilde entre-temps.', flags: 64 });
                }
                const memberCount = getGuildMemberCount(guild.id);
                if (memberCount >= guild.member_slots) {
                    return i.followUp({ content: `Désolé, la guilde "${guild.name}" est pleine.`, flags: 64 });
                }

                addMemberToGuild(i.user.id, guild.id);
                updateGuildLevel(guild.id);

                // Mettre à jour les permissions du salon (V5)
                const updatedGuild = getGuildById(guild.id);
                if (updatedGuild && updatedGuild.channel_id) {
                    await updateGuildChannelPermissions(i.client, updatedGuild, i.user.id, 'add');
                }

                await i.editReply({ content: `Bienvenue à ${i.user.username} dans la guilde **${guild.name}** !`, embeds: [], components: [] });

                // Vérifier la quête de "rejoindre une guilde"
                checkQuestProgress(i.client, 'GUILD_ACTION', i.user, { action: 'join' });

                // Vérifier la quête de taille de guilde pour le chef
                const newMemberCount = getGuildMemberCount(guild.id);
                const guildOwner = await i.client.users.fetch(guild.owner_id).catch(() => null);
                if (guildOwner) {
                    checkQuestProgress(i.client, 'GUILD_MEMBER_COUNT', guildOwner, { memberCount: newMemberCount });
                }

                // Vérifier la quête de prestige (35 membres + Upgrade X)
                const { checkAndCompleteGuildQuests } = require('../../../utils/guild/guild-quests');
                const freshGuild = getGuildById(guild.id);
                if (freshGuild) {
                    await checkAndCompleteGuildQuests(i.client, freshGuild, 'prestige');
                }

            } else if (i.customId.startsWith('guild_refuse')) {
                await i.editReply({ content: `${i.user.username} a refusé l\'invitation de la guilde **${guild.name}**.`, embeds: [], components: [] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                inviteMsg.edit({ content: 'Cette invitation a expiré.', components: [] }).catch(() => { });
            }
        });
    },
};