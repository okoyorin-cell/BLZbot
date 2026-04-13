const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildOfUser } = require('../../../utils/db-guilds');
const { getOngoingWar, getWarStats } = require('../../../utils/guild/guild-wars');
const { handleCommandError } = require('../../../utils/error-handler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guerre-statut')
        .setDescription('Affiche le statut de la guerre en cours de votre guilde'),
    
    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guild = getGuildOfUser(userId);

            if (!guild) {
                return interaction.reply({ content: "❌ Vous n'êtes pas dans une guilde.", flags: 64 });
            }

            const war = getOngoingWar(guild.id);

            if (!war) {
                return interaction.reply({ content: '❌ Votre guilde n\'est actuellement pas en guerre.', flags: 64 });
            }

            const stats = getWarStats(war.id);
            
            if (!stats) {
                return interaction.reply({ content: '❌ Impossible de récupérer les statistiques de guerre.', flags: 64 });
            }

            const { guild1, guild2, points1, points2, percentage1, percentage2, timeRemaining } = stats;

            // Déterminer qui est qui
            const isGuild1 = guild.id === guild1.id;
            const myGuild = isGuild1 ? guild1 : guild2;
            const enemyGuild = isGuild1 ? guild2 : guild1;
            const myPoints = isGuild1 ? points1 : points2;
            const enemyPoints = isGuild1 ? points2 : points1;
            const myPercentage = isGuild1 ? percentage1 : percentage2;
            const enemyPercentage = isGuild1 ? percentage2 : percentage1;

            // Calcul du temps restant
            const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
            const timeString = `${hours}h ${minutes}m`;

            // Déterminer qui gagne
            const leader = myPoints > enemyPoints ? 'Vous menez !' : myPoints < enemyPoints ? 'Vous êtes en retard !' : 'Égalité !';
            const leaderColor = myPoints > enemyPoints ? '#00FF00' : myPoints < enemyPoints ? '#FF0000' : '#FFFF00';

            // Durée de guerre
            const durationText = war.duration_type === 'short' ? 'Guerre courte (12h)' : 
                                 war.duration_type === 'normal' ? 'Guerre classique (48h)' : 
                                 'Guerre longue (7 jours)';

            const embed = new EmbedBuilder()
                .setTitle(`⚔️ Guerre en cours - ${leader}`)
                .setDescription(`${myGuild.emoji} **${myGuild.name}** VS ${enemyGuild.emoji} **${enemyGuild.name}**`)
                .setColor(leaderColor)
                .addFields(
                    { name: '⏱️ Temps restant', value: timeString, inline: true },
                    { name: '🎯 Type', value: durationText, inline: true },
                    { name: '🔥 Forcée', value: war.forced ? 'Oui (Coup d\'État)' : 'Non', inline: true },
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: `${myGuild.emoji} Votre guilde`, value: `**Points:** ${myPoints.toFixed(0)}\n**Pourcentage:** ${myPercentage.toFixed(2)}%`, inline: true },
                    { name: 'VS', value: '⚔️', inline: true },
                    { name: `${enemyGuild.emoji} Guilde adverse`, value: `**Points:** ${enemyPoints.toFixed(0)}\n**Pourcentage:** ${enemyPercentage.toFixed(2)}%`, inline: true }
                )
                .setFooter({ text: 'Continuez à gagner XP, RP et Starss pour augmenter vos points de guerre !' });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            await handleCommandError(interaction, error);
        }
    },
};
