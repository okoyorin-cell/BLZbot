const giveawaySessions = new Map();

/**
 * Gets the giveaway creation session for a user.
 * @param {string} userId The user's ID.
 * @returns {object|undefined} The session object, or undefined if not found.
 */
function getSession(userId) {
    return giveawaySessions.get(userId);
}

/**
 * Creates a new giveaway creation session for a user.
 * @param {string} userId The user's ID.
 * @returns {object} The newly created session object.
 */
function createSession(userId) {
    const session = {
        step: 'start',
        data: {
            title: null,
            description: null,
            winnerCount: 1,
            duration: null,
            durationInput: '',
            rewards: [],
            conditions: [],
            repeatInterval: null
        }
    };
    giveawaySessions.set(userId, session);
    return session;
}

/**
 * Deletes a giveaway creation session for a user.
 * @param {string} userId The user's ID.
 */
function deleteSession(userId) {
    giveawaySessions.delete(userId);
}

module.exports = {
    getSession,
    createSession,
    deleteSession,
    sessions: giveawaySessions
};