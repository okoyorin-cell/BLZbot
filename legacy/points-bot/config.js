const fs = require('fs');
const { WebhookClient } = require('discord.js');
require('dotenv').config();

const points = new Map();

const loadEnvVariables = () => {
    if (!process.env.BOT_TOKEN || !process.env.GUILD_ID) {
        console.error('Le fichier .env est manquant ou certaines variables d\'environnement ne sont pas définies.');
        process.exit(1);
    }
};

const loadPoints = () => {
    if (fs.existsSync('points.json')) {
        const data = fs.readFileSync('points.json');
        const jsonData = JSON.parse(data);
        for (const [userId, userPoints] of Object.entries(jsonData)) {
            points.set(userId, userPoints);
        }
    }
};

const savePoints = () => {
    const jsonData = {};
    for (const [userId, userPoints] of points.entries()) {
        jsonData[userId] = userPoints;
    }
    fs.writeFileSync('points.json', JSON.stringify(jsonData, null, 2));
};

const createWebhookClient = () => {
    return new WebhookClient({ url: process.env.WEBHOOK_URL });
};

module.exports = {
    loadEnvVariables,
    loadPoints,
    savePoints,
    createWebhookClient,
    points
};
