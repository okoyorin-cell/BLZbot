const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags } = require('discord.js');
const { getGuildOfUser } = require('../../utils/db-guilds');
const { getAvailableBoosters, purchaseBooster } = require('../../utils/guild/guild-boosters');
const { handleCommandError } = require('../../utils/error-handler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guilde-tools')
        .setDescription('Boutique de boosters pour votre guilde (Upgrade 4+)'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guild = getGuildOfUser(userId);

            if (!guild) {
                const errorText = new TextDisplayBuilder().setContent("❌ Vous n'êtes pas dans une guilde.");
                const container = new ContainerBuilder().addTextDisplayComponents(errorText);
                return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            if (guild.upgrade_level < 4) {
                const errorText = new TextDisplayBuilder().setContent('❌ Les Guilds Tools sont débloqués à partir de l\'Upgrade 4.');
                const container = new ContainerBuilder().addTextDisplayComponents(errorText);
                return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            // Vérifier permissions (chef ou sous-chef)
            const subChiefs = guild.sub_chiefs || [];
            if (guild.owner_id !== userId && !subChiefs.includes(userId)) {
                const errorText = new TextDisplayBuilder().setContent('❌ Seuls le chef et les sous-chefs peuvent acheter des boosters.');
                const container = new ContainerBuilder().addTextDisplayComponents(errorText);
                return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            const availableBoosters = getAvailableBoosters(guild);

            if (availableBoosters.length === 0) {
                const errorText = new TextDisplayBuilder().setContent('❌ Aucun booster disponible pour votre niveau d\'upgrade.');
                const container = new ContainerBuilder().addTextDisplayComponents(errorText);
                return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            const renderShop = () => {
                const container = new ContainerBuilder();

                // Header
                const headerText = new TextDisplayBuilder()
                    .setContent(`# 🛠️ Guilds Tools - ${guild.emoji} ${guild.name}\n` +
                        `Achetez des boosters permanents avec la trésorerie de votre guilde.\n\n` +
                        `### 💰 Trésorerie\n` +
                        `**${guild.treasury.toLocaleString('fr-FR')}** / ${guild.treasury_capacity.toLocaleString('fr-FR')} starss`);

                container.addTextDisplayComponents(headerText);

                // Boosters
                availableBoosters.forEach(booster => {
                    const isPurchased = checkBoosterPurchased(guild, booster);
                    const statusIcon = isPurchased ? '✅' : '🔒';
                    const statusText = isPurchased ? 'Acheté' : 'Disponible';

                    let description = `**Prix:** ${booster.cost.toLocaleString('fr-FR')} starss\n` +
                        `**Statut:** ${statusIcon} ${statusText}`;

                    if (booster.type === 'xp') description += `\n*Augmente le gain d'XP de guilde.*`;
                    if (booster.type === 'points') description += `\n*Augmente le gain de Points de Rang.*`;
                    if (booster.type === 'treasury') description += `\n*Augmente la capacité de la trésorerie.*`;

                    const boosterText = new TextDisplayBuilder()
                        .setContent(`### 📦 ${booster.name}\n${description}`);

                    const button = new ButtonBuilder()
                        .setCustomId(`buy_booster_${booster.id}`)
                        .setLabel(isPurchased ? 'Déjà acheté' : 'Acheter')
                        .setStyle(isPurchased ? ButtonStyle.Success : ButtonStyle.Primary)
                        .setDisabled(isPurchased || guild.treasury < booster.cost);

                    if (!isPurchased) {
                        button.setEmoji('💸');
                    }

                    const section = new SectionBuilder()
                        .addTextDisplayComponents(boosterText)
                        .setButtonAccessory(button);

                    container.addSectionComponents(section);
                });

                return container;
            };

            const container = renderShop();
            const reply = await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                fetchReply: true
            });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.user.id !== userId) {
                    return i.reply({ content: '❌ Vous ne pouvez pas utiliser ces boutons.', ephemeral: true });
                }

                if (i.customId.startsWith('buy_booster_')) {
                    const boosterId = i.customId.replace('buy_booster_', '');
                    const selectedBooster = availableBoosters.find(b => b.id === boosterId);

                    if (!selectedBooster) return;

                    try {
                        purchaseBooster(guild.id, selectedBooster.id);

                        // Refresh guild data
                        const { getGuildOfUser: refreshGuild } = require('../../utils/db-guilds');
                        const updatedGuild = refreshGuild(userId);
                        Object.assign(guild, updatedGuild); // Update local guild object

                        const updatedContainer = renderShop();
                        await i.update({ components: [updatedContainer], flags: MessageFlags.IsComponentsV2 });
                        await i.followUp({ content: `✅ Booster **${selectedBooster.name}** acheté avec succès !`, ephemeral: true });

                    } catch (error) {
                        await i.reply({ content: `❌ ${error.message}`, ephemeral: true });
                    }
                }
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => { });
            });

        } catch (error) {
            await handleCommandError(interaction, error);
        }
    },
};

/**
 * Vérifie si un booster est déjà acheté
 */
function checkBoosterPurchased(guild, booster) {
    if (booster.type === 'xp') {
        return guild.xp_boost_purchased >= booster.level;
    } else if (booster.type === 'points') {
        return guild.points_boost_purchased >= booster.level;
    } else if (booster.type === 'treasury') {
        return guild.treasury_multiplier_purchased >= (booster.level + 1);
    }
    return false;
}
