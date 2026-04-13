const fs = require('fs');
const pointsFilePath = './points.json';

let pointsData = {};

const loadPoints = () => {
    if (fs.existsSync(pointsFilePath)) {
        pointsData = JSON.parse(fs.readFileSync(pointsFilePath, 'utf8'));
        console.log('Le fichier points.json a été trouvé.');
    }
};

const savePoints = () => {
    fs.writeFileSync(pointsFilePath, JSON.stringify(pointsData, null, 2));
};

const getPoints = (userId) => {
    return pointsData[userId] || 0;
};

const getTopUsers = () => {
    const sortedUsers = Object.entries(pointsData).sort(([, a], [, b]) => b - a);
    return sortedUsers.slice(0, 10).map(([userId, points]) => ({ userId, points }));
};

const handlePoints = (message) => {
    const CHANNEL_IDS = ['1180905287532695593', '1323250755632631848', '1323250792697696336']; // Liste des ID de canaux autorisés
    const userId = message.author.id;
    const username = message.author.tag;

    // Vérifier si le message a été posté dans un des canaux autorisés et s'il contient uniquement un nombre
    if (CHANNEL_IDS.includes(message.channel.id) && /^\d+$/.test(message.content)) {
        if (!pointsData[userId]) {
            pointsData[userId] = 0;
        }
        pointsData[userId] += 1; // Ajouter 1 point par message
        savePoints();

        console.log(`${username} a gagné 1 point. Total: ${pointsData[userId]}`);
    }
};

module.exports = {
    loadPoints,
    savePoints,
    getPoints,
    getTopUsers,
    handlePoints
};
