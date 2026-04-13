const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getGuildOfUser, getAllGuilds, getGuildById, getGuildMemberCount, addMemberToGuild, removeMemberFromGuild, addGuildApplicationRefusal, updateGuildLevel } = require('../../utils/db-guilds');
const { updateGuildChannelPermissions } = require('../../utils/guild/guild-upgrades');
const { checkQuestProgress } = require('../../utils/quests');
const logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guilde-membre')
        .setDescription('Actions membre pour les guildes')
        .addSubcommand(sub =>
            sub.setName('demander-rejoindre')
                .setDescription('Demander à rejoindre une guilde')
                .addStringOption(opt =>
                    opt.setName('nom')
                        .setDescription('Le nom de la guilde que vous souhaitez rejoindre')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'demander-rejoindre') {
            await handleDemanderRejoindre(interaction);
        }
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);

        if (focused.name !== 'nom') return;

        const allGuilds = getAllGuilds();
        const userInput = focused.value.toLowerCase();

        // Filtrer les guildes par correspondance (insensible à la casse)
        const filtered = allGuilds
            .filter(guild => guild.name.toLowerCase().includes(userInput))
            .slice(0, 25); // Discord limite à 25 choix

        await interaction.respond(
            filtered.map(guild => ({ name: guild.name, value: guild.name }))
        );
    },
};

// ============================================
// Handler: Demander à rejoindre une guilde
// ============================================
async function handleDemanderRejoindre(interaction) {
    const applicant = interaction.user;
    const guildName = interaction.options.getString('nom');

    const existingGuild = getGuildOfUser(applicant.id);
    if (existingGuild) {
        return interaction.reply({ content: `Vous êtes déjà dans la guilde **${existingGuild.name}**.`, flags: 64 });
    }

    const allGuilds = getAllGuilds();
    const guild = allGuilds.find(g => g.name.toLowerCase() === guildName.toLowerCase());
    if (!guild) {
        return interaction.reply({ content: `La guilde **${guildName}** n'existe pas.`, flags: 64 });
    }

    const memberCount = getGuildMemberCount(guild.id);
    if (memberCount >= guild.member_slots) {
        return interaction.reply({ content: `La guilde **${guild.name}** est déjà pleine. Elle ne peut plus accepter de nouveaux membres.`, flags: 64 });
    }

    await interaction.deferReply({ ephemeral: true });

    const guildChannel = await interaction.client.channels.fetch(process.env.GUILD_CHANNEL).catch(() => null);
    if (!guildChannel) {
        return interaction.editReply({ content: 'Le salon des guildes est introuvable. Contactez un administrateur.' });
    }

    const embed = new EmbedBuilder()
        .setTitle('Demande d\'adhésion')
        .setDescription(`**${applicant.username}** souhaite rejoindre votre guilde : **${guild.name}**`)
        .setThumbnail(applicant.displayAvatarURL())
        .setColor(0x00AAFF)
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`guild_apply_accept_${guild.id}_${applicant.id}`).setLabel('Accepter').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`guild_apply_refuse_${guild.id}_${applicant.id}`).setLabel('Refuser').setStyle(ButtonStyle.Danger)
    );

    const owner = await interaction.client.users.fetch(guild.owner_id).catch(() => null);
    let subChiefs = [];
    try {
        if (typeof guild.sub_chiefs === 'string') {
            subChiefs = JSON.parse(guild.sub_chiefs);
        } else if (Array.isArray(guild.sub_chiefs)) {
            subChiefs = guild.sub_chiefs;
        }
    } catch (e) {
        logger.error(`Erreur parsing sub_chiefs pour guilde ${guild.name}:`, e);
        subChiefs = [];
    }

    const mentionIds = [guild.owner_id, ...subChiefs];
    const mentions = mentionIds.map(id => `<@${id}>`).join(' ');

    try {
        const requestMsg = await guildChannel.send({ content: `Nouvelle demande pour **${guild.name}**. ${mentions}`, embeds: [embed], components: [buttons] });
        await interaction.editReply({ content: `Votre demande pour rejoindre "**${guild.name}**" a été envoyée dans le salon des guildes.` });

        const collector = requestMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 24 * 60 * 60 * 1000 }); // 24h

        collector.on('collect', async i => {
            const guildLeaders = [guild.owner_id, ...subChiefs];
            if (!guildLeaders.includes(i.user.id)) {
                return i.reply({ content: "Seuls le chef ou les sous-chefs de la guilde peuvent traiter cette demande.", ephemeral: true });
            }

            await i.deferUpdate();
            const applicantUser = await interaction.client.users.fetch(applicant.id).catch(() => null);

            if (i.customId.startsWith('guild_apply_accept')) {
                if (!applicantUser) {
                    return i.editReply({ content: "Cet utilisateur n'existe plus.", embeds: [], components: [] });
                }
                if (getGuildOfUser(applicant.id)) {
                    return i.editReply({ content: `**${applicantUser.username}** a rejoint une autre guilde entre-temps.`, embeds: [], components: [] });
                }
                const memberCount = getGuildMemberCount(guild.id);
                if (memberCount >= guild.member_slots) {
                    return i.editReply({ content: `Votre guilde est pleine. Vous ne pouvez pas accepter de nouveaux membres.`, embeds: [], components: [] });
                }

                addMemberToGuild(applicant.id, guild.id);
                updateGuildLevel(guild.id);

                // Mettre à jour les permissions du salon (V5)
                const updatedGuild = getGuildById(guild.id);
                if (updatedGuild && updatedGuild.channel_id) {
                    await updateGuildChannelPermissions(i.client, updatedGuild, applicant.id, 'add');
                }

                await i.editReply({ content: `Vous avez accepté **${applicantUser.username}** dans votre guilde !`, embeds: [], components: [] });
                await applicantUser.send(`Votre demande pour rejoindre **${guild.name}** a été acceptée !`).catch(() => { });

                // Vérifier la quête de "rejoindre une guilde"
                checkQuestProgress(i.client, 'GUILD_ACTION', applicantUser, { action: 'join' });

                // Vérifier la quête de taille de guilde pour le chef
                const newMemberCount = getGuildMemberCount(guild.id);
                if (owner) {
                    checkQuestProgress(i.client, 'GUILD_MEMBER_COUNT', owner, { memberCount: newMemberCount });
                }

                // Vérifier la quête de prestige (35 membres + Upgrade X)
                const { checkAndCompleteGuildQuests } = require('../../utils/guild/guild-quests');
                const freshGuild = getGuildById(guild.id);
                if (freshGuild) {
                    await checkAndCompleteGuildQuests(i.client, freshGuild, 'prestige');
                }

            } else if (i.customId.startsWith('guild_apply_refuse')) {
                addGuildApplicationRefusal(guild.id, applicant.id);
                const refuseMessage = applicantUser ? `Vous avez refusé la demande de **${applicantUser.username}**. Il/elle ne pourra plus postuler.` : 'Vous avez refusé la demande.';
                await i.editReply({ content: refuseMessage, embeds: [], components: [] });
                if (applicantUser) {
                    await applicantUser.send(`Votre demande pour rejoindre **${guild.name}** a été refusée.`).catch(() => { });
                }
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                requestMsg.edit({ content: 'Cette demande a expiré.', components: [] }).catch(() => { });
            }
        });

    } catch (error) {
        logger.error("Erreur lors de l'envoi de la demande de guilde:", error);
        await interaction.editReply({ content: "Une erreur est survenue lors de l'envoi de la demande dans le salon des guildes." });
    }
}
