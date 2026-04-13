/**
 * Module de bienvenue pour les nouveaux membres
 */
const { EmbedBuilder } = require('discord.js');
const CONFIG = require('../config.js');

// Anti-doublon : éviter les messages si le membre rejoint/quitte rapidement
const recentJoins = new Map();
const ANTI_DUPLICATE_MS = 5000; // 5 secondes

/**
 * Gère l'arrivée d'un nouveau membre
 * @param {GuildMember} member - Le membre qui vient de rejoindre
 */
async function handleMemberJoin(member) {
    // Vérifier si le système est activé
    if (!CONFIG.WELCOME?.ENABLED) return;

    // Anti-doublon
    const now = Date.now();
    const lastJoin = recentJoins.get(member.id);
    if (lastJoin && now - lastJoin < ANTI_DUPLICATE_MS) {
        return;
    }
    recentJoins.set(member.id, now);

    // Nettoyer les anciennes entrées (toutes les 100 entrées)
    if (recentJoins.size > 100) {
        const cutoff = now - ANTI_DUPLICATE_MS;
        for (const [id, time] of recentJoins) {
            if (time < cutoff) recentJoins.delete(id);
        }
    }

    try {
        const channel = member.guild.channels.cache.get(CONFIG.WELCOME.CHANNEL_ID);
        if (!channel) {
            console.error('❌ [Welcome] Salon de bienvenue introuvable:', CONFIG.WELCOME.CHANNEL_ID);
            return;
        }

        const avatar = member.user.displayAvatarURL({
            extension: 'png',
            size: 512
        });

        const embed = new EmbedBuilder()
            .setColor(CONFIG.WELCOME.EMBED_COLOR || '#2F3136')
            .setThumbnail(avatar)
            .setDescription(
                `# 👋 **Bienvenue, ${member} !**

➜ Nous sommes ravis de te voir sur le serveur **BLZstarss** !

➜ N'hésite pas à aller faire un tour dans  
<#${CONFIG.WELCOME.RULES_CHANNEL_ID}>  

➜ Si tu as besoin d'aide, ouvre un ticket :  
<#${CONFIG.WELCOME.TICKETS_CHANNEL_ID}>

➜ Passe un **agréable séjour** ici ! ✨`
            )
            .setFooter({ text: `Arrivé(e) le ${new Date().toLocaleDateString('fr-FR')}` });

        await channel.send({ embeds: [embed] });

        // Attribution automatique du rôle membre
        if (CONFIG.MEMBER_ROLE_ID) {
            try {
                const role = member.guild.roles.cache.get(CONFIG.MEMBER_ROLE_ID);
                if (role) {
                    await member.roles.add(role, 'Attribution automatique aux nouveaux arrivants');
                    console.log(`✅ Rôle membre attribué à ${member.user.tag}`);
                } else {
                    console.error('❌ [Welcome] Rôle membre introuvable:', CONFIG.MEMBER_ROLE_ID);
                }
            } catch (roleError) {
                console.error(
                    `❌ [Welcome] Rôle membre: ${roleError.code || ''} ${roleError.message || roleError} — place le rôle du bot au-dessus de celui attribué.`
                );
            }
        }

    } catch (error) {
        console.error('❌ [Welcome] Erreur lors de l\'envoi du message de bienvenue:', error);
    }
}

module.exports = {
    handleMemberJoin
};
