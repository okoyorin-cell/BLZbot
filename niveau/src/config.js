module.exports = {
    valentin: {
        periodicEvent: {
            interval: 5 * 60 * 1000, // 5 minutes
            minHearts: 100,
            maxHearts: 300,
            maxClaims: 3,
            minMessages: 20, // Plus de 20 messages requis pour lancer l'évenement
            expiryTime: 10 * 60 * 1000, // 10 minutes (to clean memory)
            channelId: "1454466195167121610" // Canal pour l'événement périodique
        },
        rewards: {
            message: 3,
            voicePerMinute: 10
        }
    }
};
