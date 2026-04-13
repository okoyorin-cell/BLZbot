const { SlashCommandBuilder } = require('discord.js');
const { getGuildOfUser, increaseGuildSlots, updateGuildDetails } = require('../../utils/db-guilds');
const { updateGuildPrivateChannelName } = require('../../utils/guild/guild-upgrades');
const { getOrCreateUser, grantResources } = require('../../utils/db-users');
const logger = require('../../utils/logger');
const { checkQuestProgress } = require('../../utils/quests');
const { handleCommandError } = require('../../utils/error-handler');

const SLOT_COST = 100000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guilde')
        .setDescription('Commandes relatives à la gestion de votre guilde.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('acheterplace')
                .setDescription(`Achète une place de membre supplémentaire pour ${SLOT_COST.toLocaleString('fr-FR')} Starss.`))
        .addSubcommand(subcommand =>
            subcommand
                .setName('changer-de-nom')
                .setDescription("Change le nom ou l'émoji de votre guilde (Chef de guilde uniquement).")
                .addStringOption(option =>
                    option.setName('nom')
                        .setDescription('Le nouveau nom de la guilde.')
                        .setRequired(false)
                        .setMinLength(3)
                        .setMaxLength(30))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Le nouvel émoji de la guilde.')
                        .setRequired(false))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'acheterplace') {
                const userId = interaction.user.id;
                const guild = getGuildOfUser(userId);

                if (!guild) {
                    return interaction.reply({ content: "Vous n'êtes pas dans une guilde.", flags: 64 });
                }

                if (guild.owner_id !== userId) {
                    return interaction.reply({ content: 'Seul le chef de guilde peut acheter des places supplémentaires.', flags: 64 });
                }

                if (guild.member_slots >= 15) {
                    return interaction.reply({ content: 'Votre guilde a déjà atteint le nombre maximum de 15 places.', flags: 64 });
                }

                const user = getOrCreateUser(userId, interaction.user.username);
                if (user.stars < SLOT_COST) {
                    return interaction.reply({ content: `Il vous manque **${(SLOT_COST - user.stars).toLocaleString('fr-FR')}** Starss pour acheter une place.`, flags: 64 });
                }

                // Procéder à l'achat
                grantResources(interaction.client, userId, { stars: -SLOT_COST, source: 'guild' });
                increaseGuildSlots(guild.id, 1);

                const newSlots = guild.member_slots + 1;
                await interaction.reply({ content: `Vous avez acheté une place de membre ! Votre guilde a maintenant **${newSlots}** places.` });

                // Vérifier la quête d'achat de place
                checkQuestProgress(interaction.client, 'GUILD_ACTION', interaction.user, { action: 'buy_slot' });

            } else if (subcommand === 'changer-de-nom') {
                const userId = interaction.user.id;
                const guild = getGuildOfUser(userId);

                if (!guild) {
                    return interaction.reply({ content: "Vous n'êtes pas dans une guilde.", flags: 64 });
                }

                if (guild.owner_id !== userId) {
                    return interaction.reply({ content: 'Seul le chef de guilde peut modifier la guilde.', flags: 64 });
                }

                const newName = interaction.options.getString('nom') || guild.name;
                const newEmoji = interaction.options.getString('emoji') || guild.emoji;

                if (newName === guild.name && newEmoji === guild.emoji) {
                    return interaction.reply({ content: 'Vous devez spécifier au moins un nouveau nom ou un nouvel émoji.', flags: 64 });
                }

                updateGuildDetails(guild.id, newName, newEmoji);

                // Mettre à jour le nom du salon Discord
                await updateGuildPrivateChannelName(interaction.client, guild, newName, newEmoji);

                await interaction.reply({ content: `Les informations de votre guilde ont été mises à jour ! Nouveau nom : ${newEmoji} **${newName}**.` });
            }
        } catch (error) {
            await handleCommandError(interaction, error);
        }
    },
};