const { SlashCommandBuilder } = require('discord.js');
const { getGuildOfUser } = require('../../utils/db-guilds');
const { performUpgrade, getUpgradeRequirements } = require('../../utils/guild/guild-upgrades');
const { handleCommandError } = require('../../utils/error-handler');
const { areGuildFeaturesDisabled } = require('../../utils/guild/guild-overstaffing');
const db = require('../../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guilde-upgrade')
        .setDescription('Améliore votre guilde au niveau suivant')
        .addBooleanOption(option =>
            option.setName('upgrader')
                .setDescription('Utiliser un Guild Upgrader pour upgrade sans payer (mais avec les conditions)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const useUpgrader = interaction.options.getBoolean('upgrader') || false;
            const guild = getGuildOfUser(userId);

            if (!guild) {
                return interaction.reply({ content: "❌ Vous n'êtes pas dans une guilde.", flags: 64 });
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
                } else {
                    // Vous êtes passé sous la limite, c'est bon
                    return interaction.reply({
                        content: `✅ **Sureffectif résolu !**\n\nVotre guilde a maintenant **${memberCount} membres**. Les fonctionnalités sont rétablies.`,
                        flags: 64
                    });
                }
            }

            if (guild.owner_id !== userId) {
                return interaction.reply({ content: '❌ Seul le chef de guilde peut effectuer des upgrades.', flags: 64 });
            }

            const nextLevel = guild.upgrade_level + 1;

            if (nextLevel > 10) {
                return interaction.reply({ content: '✅ Votre guilde est déjà au niveau maximum (Upgrade 10) !', flags: 64 });
            }

            // Récupérer l'inventaire du chef
            const ownerInventory = db.prepare('SELECT * FROM user_inventory WHERE user_id = ?').all(userId);

            await interaction.deferReply();

            // Tenter l'upgrade
            const result = await performUpgrade(interaction.client, guild, userId, ownerInventory, useUpgrader);

            if (result.success) {
                // Vérifier les quêtes d'upgrade
                const { checkAndCompleteGuildQuests } = require('../../utils/guild/guild-quests');
                const { getGuildById } = require('../../utils/db-guilds');
                const updatedGuild = getGuildById(guild.id); // Forcer le refresh après l'upgrade
                await checkAndCompleteGuildQuests(interaction.client, updatedGuild, 'upgrade');
                // Vérifier aussi la quête de prestige (35 membres + Upgrade X)
                await checkAndCompleteGuildQuests(interaction.client, updatedGuild, 'prestige');

                await interaction.editReply({ content: result.message });
            } else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
        } catch (error) {
            await handleCommandError(interaction, error);
        }
    },
};
