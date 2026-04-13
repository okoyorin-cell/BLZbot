const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildOfUser, getGuildById } = require('../../../utils/db-guilds');
const { acceptWar, getActiveDeclaration } = require('../../../utils/guild/guild-wars');
const logger = require('../../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guerre-repondre')
        .setDescription('Répondre à une déclaration de guerre')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Accepter ou refuser la déclaration')
                .setRequired(true)
                .addChoices(
                    { name: '✅ Accepter', value: 'accept' },
                    { name: '❌ Refuser', value: 'refuse' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const action = interaction.options.getString('action');
        const userId = interaction.user.id;

        // Vérifier que l'utilisateur est dans une guilde
        const guildMembership = getGuildOfUser(userId);
        if (!guildMembership) {
            return await interaction.editReply({
                content: '❌ Vous devez être dans une guilde pour répondre à une déclaration de guerre.',
                ephemeral: true
            });
        }

        const guild = getGuildById(guildMembership.guild_id);
        if (!guild) {
            return await interaction.editReply({
                content: '❌ Erreur : impossible de récupérer votre guilde.',
                ephemeral: true
            });
        }

        // Vérifier que l'utilisateur est le chef
        if (guild.owner_id !== userId) {
            return await interaction.editReply({
                content: '❌ Seul le chef de guilde peut répondre à une déclaration de guerre.',
                ephemeral: true
            });
        }

        // Récupérer la déclaration de guerre en attente
        const declaration = getActiveDeclaration(guild.id);
        if (!declaration || declaration.status !== 'pending') {
            return await interaction.editReply({
                content: '❌ Aucune déclaration de guerre en attente pour votre guilde.',
                ephemeral: true
            });
        }

        const attackerGuild = getGuildById(declaration.attacker_guild_id);
        if (!attackerGuild) {
            return await interaction.editReply({
                content: '❌ Erreur : impossible de récupérer la guilde attaquante.',
                ephemeral: true
            });
        }

        // Traiter l'action
        if (action === 'accept') {
            try {
                await acceptWar(declaration.id, interaction.client);
                
                const embed = new EmbedBuilder()
                    .setTitle('⚔️ Guerre Acceptée !')
                    .setDescription(`Votre guilde **${guild.name}** a accepté la déclaration de guerre de **${attackerGuild.name}** !`)
                    .addFields(
                        { name: '⏱️ Durée', value: `${declaration.duration} heures`, inline: true },
                        { name: '💰 Mise en jeu', value: `${Math.round(declaration.plunder_percentage * 100)}% de la trésorerie`, inline: true }
                    )
                    .setColor(0xff0000)
                    .setTimestamp();

                // Notifier le chef de la guilde attaquante
                try {
                    const attackerUser = await interaction.client.users.fetch(attackerGuild.owner_id);
                    await attackerUser.send({
                        embeds: [embed.setDescription(`La guilde **${guild.name}** a accepté votre déclaration de guerre ! La guerre commence maintenant.`)]
                    });
                } catch (error) {
                    logger.error(`Impossible d'envoyer la notification au chef attaquant ${attackerGuild.owner_id}:`, error);
                }

                logger.info(`Guerre acceptée entre ${attackerGuild.name} et ${guild.name}`);
                return await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                logger.error('Erreur lors de l\'acceptation de la guerre:', error);
                return await interaction.editReply({
                    content: `❌ Erreur lors de l'acceptation de la guerre : ${error.message}`,
                    ephemeral: true
                });
            }

        } else if (action === 'refuse') {
            // Mettre à jour la déclaration en 'refused'
            const db = require('../../../database/database');
            db.prepare('UPDATE guild_war_declarations SET status = ? WHERE id = ?')
                .run('refused', declaration.id);

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Guerre Refusée')
                .setDescription(`Votre guilde **${guild.name}** a refusé la déclaration de guerre de **${attackerGuild.name}**.`)
                .setColor(0x808080)
                .setTimestamp();

            // Notifier le chef de la guilde attaquante
            try {
                const attackerUser = await interaction.client.users.fetch(attackerGuild.owner_id);
                await attackerUser.send({
                    embeds: [embed.setDescription(`La guilde **${guild.name}** a refusé votre déclaration de guerre.`)]
                });
            } catch (error) {
                logger.error(`Impossible d'envoyer la notification au chef attaquant ${attackerGuild.owner_id}:`, error);
            }

            logger.info(`Guerre refusée entre ${attackerGuild.name} et ${guild.name}`);
            return await interaction.editReply({ embeds: [embed] });
        }
    }
};
