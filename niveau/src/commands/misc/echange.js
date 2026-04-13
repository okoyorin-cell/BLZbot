
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getOrCreateUser } = require('../../utils/db-users');
const { startTrade } = require('../../utils/trade-system');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('echange')
        .setDescription('Proposer un échange d\'items à un autre utilisateur.')
        .addUserOption(option => option.setName('utilisateur').setDescription('L\'utilisateur avec qui échanger').setRequired(true)),
    async execute(interaction) {
        try {
            await interaction.deferReply();
            const user1 = interaction.user;
            const user2 = interaction.options.getUser('utilisateur');

            if (user1.id === user2.id) {
                return interaction.editReply({ content: 'Vous ne pouvez pas échanger avec vous-même.' });
            }

            const user1Data = getOrCreateUser(user1.id, user1.username);
            const user2Data = getOrCreateUser(user2.id, user2.username);

            if (user1Data.level < 25 || user2Data.level < 25) {
                return interaction.editReply({ content: 'Les deux utilisateurs doivent être au moins niveau 25 pour échanger.' });
            }

            const tradeId = startTrade(user1.id, user2.id);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_trade_${tradeId}`)
                        .setLabel('Accepter')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`decline_trade_${tradeId}`)
                        .setLabel('Refuser')
                        .setStyle(ButtonStyle.Danger)
                );

            const shouldPing = user2Data.notify_trade !== 0;

            await interaction.editReply({
                content: `${user2}, ${user1.username} vous propose un échange. Acceptez-vous ?`,
                components: [row],
                allowedMentions: shouldPing ? undefined : { parse: [] }
            });
        } catch (error) {
            if (error.code !== 10062) {
                const { handleCommandError } = require('../../utils/error-handler');
                await handleCommandError(interaction, error);
            }
        }
    }
};
