/**
 * Utilitaires divers
 */

/**
 * Convertit des millisecondes en temps lisible
 */
function msToReadableTime(duration) {
    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));

    let time = '';
    if (days > 0) time += `${days} jour(s) `;
    if (hours > 0) time += `${hours} heure(s) `;
    if (minutes > 0) time += `${minutes} minute(s) `;
    if (seconds > 0) time += `${seconds} seconde(s)`;
    return time.trim();
}

/**
 * Parse une durée depuis une chaîne (ex: "10m", "2h", "1j", "3mo", "1y")
 */
function parseDuration(str) {
    if (!str) return null;
    
    // Supporte: s, m, h, d/j, w, mo/mois, y/an/ans
    const regex = /(\d+)\s*(mo|mois|y|an|ans|[smhdwjSMHDWJ])/gi;
    let totalMs = 0;
    let match;
    let hasMatch = false;

    while ((match = regex.exec(str)) !== null) {
        hasMatch = true;
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 's': 
                totalMs += value * 1000; 
                break;
            case 'm': 
                totalMs += value * 60 * 1000; 
                break;
            case 'h': 
                totalMs += value * 60 * 60 * 1000; 
                break;
            case 'd':
            case 'j': 
                totalMs += value * 24 * 60 * 60 * 1000; 
                break;
            case 'w': 
                totalMs += value * 7 * 24 * 60 * 60 * 1000; 
                break;
            case 'mo':
            case 'mois': 
                totalMs += value * 30 * 24 * 60 * 60 * 1000; 
                break;
            case 'y':
            case 'an':
            case 'ans': 
                totalMs += value * 365 * 24 * 60 * 60 * 1000; 
                break;
        }
    }

    return hasMatch ? totalMs : null;
}

/**
 * Échapper les mentions dans un texte
 */
function escapeMentions(str) {
    if (!str) return str;
    return str.replace(/@([^<>@ ]*)/g, '@.$1');
}

/**
 * Vérifie si une image est valide
 */
function isValidImage(attachment) {
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    return validExtensions.some(ext => attachment.name.toLowerCase().endsWith(ext));
}

/**
 * Trouve un rôle staff par son ID
 */
function getStaffRole(roleId) {
    const CONFIG = require('../config.js');
    return CONFIG.STAFF_ROLES.find(role => role.id === roleId);
}

/**
 * Trouve le rôle staff le plus élevé d'un membre
 */
function getHighestStaffRole(member) {
    const CONFIG = require('../config.js');
    return CONFIG.STAFF_ROLES
        .filter(role => member.roles.cache.has(role.id))
        .sort((a, b) => b.points - a.points)[0] || null;
}

/**
 * Obtient les points de vote d'un membre
 */
function getVotePoints(member) {
    const highestRole = getHighestStaffRole(member);
    return highestRole ? highestRole.points : 0;
}

/**
 * ID du rôle féminin
 */
const FEMALE_ROLE_ID = '1257638871899049984';

/**
 * Vérifie si un membre est féminin (basé sur le rôle)
 */
function isFemale(member) {
    return member.roles.cache.has(FEMALE_ROLE_ID);
}

/**
 * Obtient le déterminant approprié selon le mot et le genre du membre
 */
function getArticle(word, member) {
    const lowerWord = word.toLowerCase();
    const voyelles = ['a', 'e', 'i', 'o', 'u', 'h'];
    const isFem = member ? isFemale(member) : false;
    
    // Si le mot commence par une voyelle ou un h, utiliser l'
    if (voyelles.includes(lowerWord[0])) {
        return "l'";
    }
    
    // Déterminer le genre selon le rôle du membre
    if (isFem) {
        return 'la ';
    }
    
    return 'le ';
}

/**
 * Obtient le titre du grade avec le déterminant approprié
 */
function getModeratorTitleWithArticle(member) {
    const highestRole = getHighestStaffRole(member);
    
    if (!highestRole) {
        const isFem = isFemale(member);
        return isFem ? 'une Membre du staff' : 'un Membre du staff';
    }
    
    let title = highestRole.name;
    
    // Adapter le nom du grade selon le genre
    if (isFemale(member)) {
        title = title
            .replace(/Modérateur/gi, 'Modératrice')
            .replace(/Administrateur/gi, 'Administratrice');
    }
    
    const article = getArticle(title, member);
    return `${article}${title}`;
}

module.exports = {
    msToReadableTime,
    parseDuration,
    escapeMentions,
    isValidImage,
    getStaffRole,
    getHighestStaffRole,
    getVotePoints,
    isFemale,
    getArticle,
    getModeratorTitleWithArticle,
    FEMALE_ROLE_ID
};
