
const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { getOrCreateUser, updateUserItemQuantity, grantResources } = require('../utils/db-users');
const { getBattlePassReward, getTierFromXp, BATTLE_PASS_REWARDS } = require('../utils/battle-pass');
const db = require('../database/database');
const { ITEMS } = require('../utils/items');
const roleConfig = require('../config/role.config.json');

// IDs des rôles VIP Discord (rôle principal + aliases)
const VIP_ROLE_IDS = [
    roleConfig.specialRoles?.vip?.id || roleConfig.roleIds?.vip,
    ...(roleConfig.roleIds?.vipAliases || [])
].filter(Boolean);

// Helper pour obtenir le nom d'affichage d'un item
function getItemDisplayName(itemId) {
    const item = ITEMS[itemId];
    return item ? item.name : itemId;
}

// Helper pour donner une récompense (free ou vip)
function giveReward(client, userId, reward) {
    if (typeof reward === 'string') {
        // Récompense simple (string = item ID)
        updateUserItemQuantity(userId, reward, 1);
        return getItemDisplayName(reward);
    } else if (reward.type && reward.amount) {
        // Récompense avec type et amount
        // Vérifier si c'est une ressource (starss, xp, points) ou un item
        const resourceTypes = ['starss', 'xp', 'points', 'stars'];
        if (resourceTypes.includes(reward.type)) {
            // C'est une ressource
            // Correction: starss -> stars pour grantResources
            const grantKey = reward.type === 'starss' ? 'stars' : reward.type;
            grantResources(client, userId, { [grantKey]: reward.amount, source: 'battlepass' });

            // Pour l'affichage, on garde le type original ou on formate joli
            return `${reward.amount.toLocaleString('fr-FR')} ${reward.type === 'starss' ? 'stars' : reward.type}`;
        } else {
            // C'est un item avec une quantité
            updateUserItemQuantity(userId, reward.type, reward.amount);
            return `${reward.amount}x ${getItemDisplayName(reward.type)}`;
        }
    }
    return null;
}

// Fonction pour récupérer tous les tiers non réclamés jusqu'au tier actuel
function getUnclaimedTiers(userId, currentTier, isVip) {
    const unclaimedFree = [];
    const unclaimedVip = [];

    for (let tier = 1; tier <= currentTier; tier++) {
        const claimed = db.prepare('SELECT * FROM battle_pass WHERE user_id = ? AND tier = ?').get(userId, tier);
        const reward = getBattlePassReward(tier);

        if (!reward) continue;

        // Vérifier récompense gratuite non réclamée
        if (!claimed || !claimed.claimed_free) {
            unclaimedFree.push({ tier, reward: reward.free });
        }

        // Vérifier récompense VIP non réclamée (si l'utilisateur est VIP)
        // Inclut les tiers où le free a été claim mais pas le VIP (nouveaux VIP)
        if (isVip && (!claimed || !claimed.claimed_vip)) {
            unclaimedVip.push({ tier, reward: reward.vip });
        }
    }

    return { unclaimedFree, unclaimedVip };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('battlepass')
        .setDescription('Affiche votre progression dans le Battle Pass.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('afficher')
                .setDescription('Affiche votre progression dans le Battle Pass.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('claim')
                .setDescription('Récupérer toutes les récompenses non réclamées jusqu\'à votre tier actuel.')),
    async execute(interaction) {
        const user = interaction.user;
        const userData = getOrCreateUser(user.id, user.username);

        const currentTier = getTierFromXp(userData.seasonal_xp);

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'afficher') {
            // Defer la réponse pour avoir plus de temps (le rendu du canvas peut prendre du temps)
            await interaction.deferReply();

            const { renderBattlePassCard } = require('../utils/canvas-battle-pass');
            const currentTier = getTierFromXp(userData.seasonal_xp);
            // VIP = Pass DB (non expiré) OU rôle Discord VIP
            const hasVipPass = userData.is_vip === 1 && (userData.vip_expires_at || 0) > Date.now();
            const hasVipRole = interaction.member?.roles?.cache?.some(r => VIP_ROLE_IDS.includes(r.id)) || false;
            let isVip = hasVipPass || hasVipRole;
            // Auto-expirer le pass DB si expiré
            if (userData.is_vip === 1 && !hasVipPass) {
                db.prepare('UPDATE users SET is_vip = 0, vip_expires_at = 0 WHERE id = ?').run(user.id);
            }

            const image = await renderBattlePassCard(userData, BATTLE_PASS_REWARDS, currentTier, isVip);
            const file = new AttachmentBuilder(image, { name: 'battlepass.png' });

            const mediaGallery = new MediaGalleryBuilder()
                .addItems({ media: { url: 'attachment://battlepass.png' } });

            const container = new ContainerBuilder().addMediaGalleryComponents(mediaGallery);

            // Afficher combien de récompenses sont disponibles
            const { unclaimedFree, unclaimedVip } = getUnclaimedTiers(user.id, currentTier, isVip);
            const totalUnclaimed = unclaimedFree.length + unclaimedVip.length;

            if (totalUnclaimed > 0) {
                const infoText = new TextDisplayBuilder().setContent(
                    `### 🎁 Récompenses disponibles\n` +
                    `Vous avez **${unclaimedFree.length}** récompense(s) gratuite(s) et ` +
                    `**${unclaimedVip.length}** récompense(s) VIP non réclamée(s).\n` +
                    `Utilisez \`/battlepass claim\` pour tout récupérer !`
                );
                const infoContainer = new ContainerBuilder().addTextDisplayComponents(infoText);
                await interaction.editReply({ files: [file], components: [container, infoContainer], flags: MessageFlags.IsComponentsV2 });
            } else {
                await interaction.editReply({ files: [file], components: [container], flags: MessageFlags.IsComponentsV2 });
            }
        } else if (subcommand === 'claim') {
            // Vérifier si le joueur a atteint au moins le tier 1
            if (currentTier < 1) {
                const errorText = new TextDisplayBuilder().setContent('Vous n\'avez pas encore atteint le premier tier du Battle Pass !');
                const container = new ContainerBuilder().addTextDisplayComponents(errorText);
                return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
            }

            // VIP = Pass DB (non expiré) OU rôle Discord VIP
            const hasVipPass = userData.is_vip === 1 && (userData.vip_expires_at || 0) > Date.now();
            const hasVipRole = interaction.member?.roles?.cache?.some(r => VIP_ROLE_IDS.includes(r.id)) || false;
            let isVip = hasVipPass || hasVipRole;
            // Auto-expirer le pass DB si expiré
            if (userData.is_vip === 1 && !hasVipPass) {
                db.prepare('UPDATE users SET is_vip = 0, vip_expires_at = 0 WHERE id = ?').run(user.id);
            }

            // Récupérer tous les tiers non réclamés (y compris VIP rétroactifs pour les nouveaux boosters)
            const { unclaimedFree, unclaimedVip } = getUnclaimedTiers(user.id, currentTier, isVip);

            if (unclaimedFree.length === 0 && unclaimedVip.length === 0) {
                const errorText = new TextDisplayBuilder().setContent('✅ Vous avez déjà réclamé toutes vos récompenses jusqu\'au tier ' + currentTier + ' !')
                const container = new ContainerBuilder().addTextDisplayComponents(errorText);
                return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
            }

            const claimedRewardsList = [];

            // Réclamer toutes les récompenses gratuites non réclamées
            for (const { tier, reward } of unclaimedFree) {
                if (reward) {
                    const rewardName = giveReward(interaction.client, user.id, reward);
                    if (rewardName) {
                        claimedRewardsList.push(`Tier ${tier} - **Gratuit:** ${rewardName}`);
                    }
                }

                // Enregistrer le claim (upsert)
                db.prepare(`
                    INSERT INTO battle_pass (user_id, tier, claimed_free, claimed_vip)
                    VALUES (?, ?, 1, 0)
                    ON CONFLICT(user_id, tier) DO UPDATE SET claimed_free = 1
                `).run(user.id, tier);
            }

            // Réclamer toutes les récompenses VIP non réclamées (y compris rétroactives)
            for (const { tier, reward } of unclaimedVip) {
                if (reward) {
                    const rewardName = giveReward(interaction.client, user.id, reward);
                    if (rewardName) {
                        claimedRewardsList.push(`Tier ${tier} - **VIP:** ${rewardName}`);
                    }
                }

                // Enregistrer le claim VIP
                db.prepare(`
                    INSERT INTO battle_pass (user_id, tier, claimed_free, claimed_vip)
                    VALUES (?, ?, 0, 1)
                    ON CONFLICT(user_id, tier) DO UPDATE SET claimed_vip = 1
                `).run(user.id, tier);
            }

            // Créer l'affichage détaillé avec toutes les récompenses (V2)
            const rewardsSummary = claimedRewardsList.length > 15
                ? claimedRewardsList.slice(0, 15).join('\n') + `\n... et ${claimedRewardsList.length - 15} autres récompenses !`
                : claimedRewardsList.join('\n');

            const claimContent = `# 🎁 Récompenses Réclamées !\n` +
                `Vous avez réclamé **${claimedRewardsList.length}** récompense(s) !\n\n` +
                `### 📜 Détails\n${rewardsSummary}\n\n` +
                `### 📊 Progression\n` +
                `Tier ${currentTier} / 50\n\n` +
                `### 👤 Joueur\n` +
                `${user.username}` +
                (isVip ? ' 👑 VIP' : '');

            const claimText = new TextDisplayBuilder().setContent(claimContent);
            const container = new ContainerBuilder().addTextDisplayComponents(claimText);

            await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }
    }
};

