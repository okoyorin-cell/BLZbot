/**
 * Module utilitaire pour créer des issues GitHub automatiquement.
 * Utilisé par le error-handler et la commande /bug.
 */

require('dotenv').config();

const GITHUB_ISSUES_URL = process.env.GITHUB_ISSUES_URL || 'https://api.github.com/repos/utilisateursrichard/BLZbot/issues';

/**
 * Crée une issue GitHub
 * @param {object} options
 * @param {string} options.title - Titre de l'issue
 * @param {string} options.body - Corps de l'issue (markdown)
 * @param {string[]} [options.labels] - Labels à appliquer
 * @returns {Promise<object>} L'issue créée
 */
async function creerIssueGitHub({ title, body, labels = ['bug', 'auto-generated'] }) {
    const token = process.env.GITHUB_TOKEN_ISSUE;

    if (!token) {
        throw new Error('GITHUB_TOKEN_ISSUE manquant dans le .env');
    }

    const issueData = { title, body, labels };

    const reponse = await fetch(GITHUB_ISSUES_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(issueData)
    });

    if (!reponse.ok) {
        const detail = await reponse.text();
        throw new Error(`Erreur HTTP ${reponse.status}: ${detail}`);
    }

    return reponse.json();
}

module.exports = { creerIssueGitHub };
