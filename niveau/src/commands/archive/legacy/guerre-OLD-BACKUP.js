
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildOfUser, getGuildByName } = require('../../../utils/db-guilds');
const db = require('../../../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guerre')
        .setDescription('Gérer les guerres de guildes.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('declarer')
                .setDescription('Déclarer la guerre à une autre guilde.')
                .addStringOption(option => option.setName('guilde').setDescription('Le nom de la guilde à attaquer').setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Le type de guerre')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Courte (12h)', value: 'courte' },
                            { name: 'Classique (48h)', value: 'classique' },
                            { name: 'Longue (168h)', value: 'longue' }
                        )))
    ,
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'declarer') {
            const user = interaction.user;
            const guild = getGuildOfUser(user.id);

            if (!guild) {
                return interaction.reply({ content: 'Vous n\'êtes dans aucune guilde.', ephemeral: true });
            }

            if (guild.owner_id !== user.id) {
                return interaction.reply({ content: 'Seul le chef de guilde peut déclarer la guerre.', ephemeral: true });
            }

            if (guild.upgrade_level < 6) {
                return interaction.reply({ content: 'Votre guilde doit être au moins niveau d\'amélioration 6 pour déclarer la guerre.', ephemeral: true });
            }

            const opponentGuildName = interaction.options.getString('guilde');
            const opponentGuild = getGuildByName(opponentGuildName);

            if (!opponentGuild) {
                return interaction.reply({ content: `La guilde "${opponentGuildName}" n\'existe pas.`, ephemeral: true });
            }

            if (opponentGuild.id === guild.id) {
                return interaction.reply({ content: 'Vous ne pouvez pas déclarer la guerre à votre propre guilde.', ephemeral: true });
            }

            if (opponentGuild.upgrade_level < 6) {
                return interaction.reply({ content: `La guilde "${opponentGuildName}" doit être au moins niveau d\'amélioration 6 pour participer à une guerre.`, ephemeral: true });
            }

            const warType = interaction.options.getString('type');

            // Mapper les types de guerre vers les types attendus par guild-wars.js
            const durationTypeMap = {
                'courte': 'short',
                'classique': 'normal',
                'longue': 'long'
            };
            const durationType = durationTypeMap[warType] || 'normal';

            // Utiliser le système de déclaration de guerre approprié
            const { declareWar } = require('../../../utils/guild/guild-wars');

            try {
                const declarationId = await declareWar(interaction.client, guild.id, opponentGuild.id, durationType, false);
                await interaction.reply({ content: `⚔️ Vous avez déclaré la guerre à la guilde **${opponentGuild.name}** ! Le chef adverse doit accepter ou refuser.` });
            } catch (error) {
                return interaction.reply({ content: `❌ Erreur: ${error.message}`, ephemeral: true });
            }
            return; // Exit early since declareWar handles the rest
        }
    }
};
