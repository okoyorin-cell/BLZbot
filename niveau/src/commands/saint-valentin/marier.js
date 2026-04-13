const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getPartner, createMarriage, getEventState } = require('../../utils/db-valentin');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('marier')
        .setDescription('S\'associer avec quelqu\'un pour bénéficier du boost maximum de la Bague de Mariage.')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('La personne avec qui vous voulez vous marier')
                .setRequired(true)),

    async execute(interaction) {
        if (!getEventState('valentin')) {
            return interaction.reply({ content: "L'événement Saint-Valentin n'est pas actif.", ephemeral: true });
        }

        const target = interaction.options.getUser('utilisateur');
        const author = interaction.user;

        if (target.id === author.id) {
            return interaction.reply({ content: "Vous ne pouvez pas vous marier avec vous-même... C'est triste, mais c'est comme ça.", ephemeral: true });
        }

        if (target.bot) {
            return interaction.reply({ content: "Les bots n'ont pas de cœur (enfin, sauf moi, mais je suis déjà pris par mon code).", ephemeral: true });
        }

        const currentPartner = getPartner(author.id);
        if (currentPartner) {
            if (currentPartner === target.id) {
                return interaction.reply({ content: `Vous êtes déjà marié avec **${target.username}** ! (Alzheimer, déjà ?)`, ephemeral: true });
            } else {
                return interaction.reply({ content: `Tu as déjà une alliance au doigt, n'essaie pas la polygamie, tu as déjà assez de soucis.`, ephemeral: true });
            }
        }

        const targetPartner = getPartner(target.id);
        if (targetPartner) {
            return interaction.reply({ content: `🚫 **Rateau en vue !** **${target.username}** est déjà maqué(e). Tu arrives après la guerre ! 🏳️`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('💍 Demande en Mariage 💍')
            .setDescription(`${author} demande à ${target} de s'associer ! \n\n*Être mariés permet de booster vos gains de 30% si vous possédez tous les deux une Bague de Mariage.*`)
            .setColor('#FF69B4')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('marry_accept')
                .setLabel('Accepter ❤️')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('marry_refuse')
                .setLabel('Refuser 💔')
                .setStyle(ButtonStyle.Danger)
        );

        const message = await interaction.reply({
            content: `${target}`,
            embeds: [embed],
            components: [row]
        });

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== target.id) {
                return i.reply({ content: "Seul l'élu(e) peut répondre à cette demande !", ephemeral: true });
            }

            if (i.customId === 'marry_accept') {
                createMarriage(author.id, target.id);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Vive les mariés ! 🎉')
                    .setDescription(`${author} et ${target} sont désormais unis ! Vos boosts de Bague de Mariage sont désormais à leur maximum (30%).`)
                    .setColor('#00FF00')
                    .setTimestamp();

                await i.update({ embeds: [successEmbed], components: [] });
                logger.info(`Mariage entre ${author.username} et ${target.username}`);
            } else {
                const refuseEmbed = new EmbedBuilder()
                    .setTitle('💔 Demande refusée')
                    .setDescription(`${target} a décliné la demande de ${author}. L'amour est rude...`)
                    .setColor('#FF0000')
                    .setTimestamp();

                await i.update({ embeds: [refuseEmbed], components: [] });
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({ content: "La demande a expiré...", components: [] }).catch(() => { });
            }
        });
    },
};
