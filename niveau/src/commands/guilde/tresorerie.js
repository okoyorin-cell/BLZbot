const { SlashCommandBuilder } = require('discord.js');
const { getGuildOfUser } = require('../../utils/db-guilds');
const { addToTreasury, removeFromTreasury, distributeTreasuryEqually } = require('../../utils/guild/guild-treasury');
const { getOrCreateUser, grantResources } = require('../../utils/db-users');
const { handleCommandError } = require('../../utils/error-handler');
const { hasCustomPermission, CUSTOM_ROLE_PERMISSIONS } = require('../../utils/guild/guild-custom-roles');
const { areGuildFeaturesDisabled } = require('../../utils/guild/guild-overstaffing');
const db = require('../../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tresorerie')
        .setDescription('Gérez la trésorerie de votre guilde')
        .addSubcommand(subcommand =>
            subcommand
                .setName('deposer')
                .setDescription('Déposez vos propres starss dans la trésorerie')
                .addIntegerOption(option =>
                    option.setName('montant')
                        .setDescription('Montant en starss à déposer')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('donner')
                .setDescription('Donnez des starss de la trésorerie à un membre (Chef/Sous-chef uniquement)')
                .addUserOption(option =>
                    option.setName('membre')
                        .setDescription('Le membre à qui donner des starss')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('montant')
                        .setDescription('Montant en starss à donner')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('vider')
                .setDescription('Distribue équitablement la trésorerie à tous les membres (Chef/Sous-chef uniquement)')),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guild = getGuildOfUser(userId);

            if (!guild) {
                return interaction.reply({ content: "❌ Vous n'êtes pas dans une guilde.", flags: 64 });
            }

            if (guild.upgrade_level < 2) {
                return interaction.reply({ content: '❌ La trésorerie est débloquée à partir de l\'Upgrade 2.', flags: 64 });
            }

            // Vérifier le sureffectif pour toutes les actions sauf dépôt
            const subcommand = interaction.options.getSubcommand();
            if (subcommand !== 'deposer' && areGuildFeaturesDisabled(guild.id)) {
                const memberCount = db.prepare('SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?')
                    .get(guild.id).count;
                return interaction.reply({
                    content: `❌ **Guilde en sureffectif !**\n\n` +
                        `Votre guilde a **${memberCount} membres** mais ne peut en avoir que **12 maximum**.\n` +
                        `🚫 Toutes les fonctionnalités sont désactivées jusqu'à ce que vous excluiez des membres.`,
                    flags: 64
                });
            }

            if (subcommand === 'deposer') {
                const montant = interaction.options.getInteger('montant');
                const user = getOrCreateUser(userId, interaction.user.username);

                if (user.stars < montant) {
                    return interaction.reply({
                        content: `❌ Vous n'avez pas assez de starss. Il vous manque ${(montant - user.stars).toLocaleString('fr-FR')} starss.`,
                        flags: 64
                    });
                }

                try {
                    // D'abord vérifier et ajouter à la trésorerie (peut échouer si capacité dépassée)
                    const newTreasury = addToTreasury(guild.id, montant);

                    // Seulement si la trésorerie a bien reçu les starss, les retirer de l'utilisateur
                    grantResources(interaction.client, userId, { stars: -montant, source: 'guild_treasury' });

                    // Vérifier les quêtes de trésorerie
                    // IMPORTANT: Récupérer la guilde APRÈS la mise à jour pour avoir les bonnes valeurs
                    const { checkAndCompleteGuildQuests } = require('../../utils/guild/guild-quests');
                    const { getGuildById } = require('../../utils/db-guilds');
                    const updatedGuild = getGuildById(guild.id); // Utiliser getGuildById avec l'ID pour forcer le refresh
                    await checkAndCompleteGuildQuests(interaction.client, updatedGuild, 'treasury');

                    await interaction.reply({
                        content: `✅ Vous avez déposé **${montant.toLocaleString('fr-FR')}** starss dans la trésorerie de ${guild.emoji} **${guild.name}**.\n\n💰 Trésorerie: **${newTreasury.toLocaleString('fr-FR')}** / **${guild.treasury_capacity.toLocaleString('fr-FR')}** starss`
                    });
                } catch (error) {
                    await interaction.reply({ content: `❌ ${error.message}`, flags: 64 });
                }

            } else if (subcommand === 'donner') {
                // Vérifier les permissions (chef ou sous-chef)
                const subChiefs = guild.sub_chiefs || [];
                if (guild.owner_id !== userId && !subChiefs.includes(userId)) {
                    return interaction.reply({ content: '❌ Seuls le chef et les sous-chefs peuvent donner des starss de la trésorerie.', flags: 64 });
                }

                // Vérifier si la guilde est en guerre
                const { getOngoingWar } = require('../../utils/guild/guild-wars');
                const ongoingWar = getOngoingWar(guild.id);
                if (ongoingWar) {
                    return interaction.reply({ content: '❌ Vous ne pouvez pas retirer de starss de la trésorerie pendant une guerre !', flags: 64 });
                }

                const targetUser = interaction.options.getUser('membre');
                const montant = interaction.options.getInteger('montant');

                // Vérifier que le membre est dans la guilde
                const targetGuild = getGuildOfUser(targetUser.id);
                if (!targetGuild || targetGuild.id !== guild.id) {
                    return interaction.reply({ content: '❌ Ce membre ne fait pas partie de votre guilde.', flags: 64 });
                }

                try {
                    // Retirer de la trésorerie
                    removeFromTreasury(guild.id, montant);

                    // Donner au membre
                    grantResources(interaction.client, targetUser.id, { stars: montant, source: 'guild_treasury' });

                    await interaction.reply({
                        content: `✅ Vous avez donné **${montant.toLocaleString('fr-FR')}** starss de la trésorerie à ${targetUser}.`
                    });
                } catch (error) {
                    await interaction.reply({ content: `❌ ${error.message}`, flags: 64 });
                }

            } else if (subcommand === 'vider') {
                // Vérifier les permissions (chef ou sous-chef)
                const subChiefs = guild.sub_chiefs || [];
                if (guild.owner_id !== userId && !subChiefs.includes(userId)) {
                    return interaction.reply({ content: '❌ Seuls le chef et les sous-chefs peuvent vider la trésorerie.', flags: 64 });
                }

                // Vérifier si la guilde est en guerre
                const { getOngoingWar } = require('../../utils/guild/guild-wars');
                const ongoingWar = getOngoingWar(guild.id);
                if (ongoingWar) {
                    return interaction.reply({ content: '❌ Vous ne pouvez pas vider la trésorerie pendant une guerre !', flags: 64 });
                }

                try {
                    const result = distributeTreasuryEqually(interaction.client, guild.id);

                    await interaction.reply({
                        content: `✅ La trésorerie a été vidée et distribuée équitablement !\n\n**${result.amountPerMember.toLocaleString('fr-FR')}** starss ont été donnés à chacun des **${result.memberCount}** membres.\n\n💰 Total distribué: **${result.totalDistributed.toLocaleString('fr-FR')}** starss`
                    });
                } catch (error) {
                    await interaction.reply({ content: `❌ ${error.message}`, flags: 64 });
                }
            }
        } catch (error) {
            await handleCommandError(interaction, error);
        }
    },
};
