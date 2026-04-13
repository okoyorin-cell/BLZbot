const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { QUESTS } = require('../../utils/quests');

module.exports = {
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const choices = Object.values(QUESTS)
            .map(quest => ({ name: quest.name, value: quest.id }));

        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));

        // Discord's limit is 25 choices
        const resultsToSend = filtered.slice(0, 25);

        await interaction.respond(resultsToSend);
    },

    data: new SlashCommandBuilder()
        .setName('forcequestcomplete')
        .setDescription("Force la complétion d'une quête pour un membre.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre pour qui forcer la quête.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('id_quete')
                .setDescription("L'ID ou le nom de la quête à forcer (commencez à taper pour voir les options).")
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        const { getOrCreateUser, grantResources } = require('../../utils/db-users');
        const { grantEventCurrency } = require('../../utils/db-halloween');
        const { forceCompleteQuest } = require('../../utils/db-quests');
        const logger = require('../../utils/logger');

        const targetUser = interaction.options.getUser('membre');
        const questId = interaction.options.getString('id_quete');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Vous ne pouvez pas forcer une quête pour un bot.', flags: 64 });
        }

        const quest = QUESTS[questId];
        if (!quest) {
            return interaction.reply({ content: 'ID de quête invalide. Veuillez sélectionner une option dans la liste.', flags: 64 });
        }

        getOrCreateUser(targetUser.id, targetUser.username);

        try {
            forceCompleteQuest(targetUser.id, questId);

            // Accorder toutes les récompenses
            let rewardText = '';

            if (quest.reward.stars) {
                grantResources(interaction.client, targetUser.id, { stars: quest.reward.stars, source: 'quest' });
                rewardText = `${quest.reward.stars.toLocaleString('fr-FR')} Starss`;
            }

            if (quest.reward.bonbons) {
                grantEventCurrency(targetUser.id, { bonbons: quest.reward.bonbons });
                rewardText = `${quest.reward.bonbons.toLocaleString('fr-FR')} Bonbons`;
            }

            if (quest.reward.role) {
                const guild = interaction.guild;
                let role = guild.roles.cache.find(r => r.name === quest.reward.role);
                if (!role) {
                    role = await guild.roles.create({ name: quest.reward.role, reason: 'Récompense de quête forcée' });
                }
                const member = await guild.members.fetch(targetUser.id);
                if (member && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                    rewardText = `Rôle "${quest.reward.role}"`;
                } else if (member && member.roles.cache.has(role.id)) {
                    rewardText = `Rôle "${quest.reward.role}" (déjà possédé)`;
                }
            }

            await interaction.reply({
                content: `✅ La quête "**${quest.name}**" a été forcée comme complétée pour **${targetUser.username}**.\n🎁 Récompense donnée : ${rewardText}`,
                flags: 64
            });
        } catch (error) {
            logger.error(`Erreur lors de la complétion forcée de la quête ${questId} pour ${targetUser.username}:`, error);
            await interaction.reply({ content: 'Une erreur est survenue lors de la complétion forcée de la quête.', flags: 64 });
        }
    },
};