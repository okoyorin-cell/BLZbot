const usersInVoice = new Set();
let valentinMessageCount = 0;

/** Événements Saint-Valentin périodiques (boutons claim), partagé entre index et interactionCreate */
const valentinEvents = new Map();

module.exports = {
    usersInVoice,
    valentinEvents,
    getValentinMessageCount: () => valentinMessageCount,
    incrementValentinMessageCount: () => { valentinMessageCount++; },
    resetValentinMessageCount: () => { valentinMessageCount = 0; }
};