const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = "https://discord.com/api/webhooks/1373425814926004274/9BzLiKx2pbJjFneXqIQ8cimWlEJegR2GWd0_1GcQ-6L0C4nPK3R3LWU44nYn2cjZFuGn";

async function sendWebhookAlert() {
  const payload = {
    username: "BLZbot sécurité",
    avatar_url: "https://i.imgur.com/N6Vxysx.png",
    content: "⚠️ @here Une alerte requiert votre attention !",
    embeds: [
      {
        title: ":warning: urgence : le token du bot a été changé :warning:",
        description: "Le token du bot a été changé, cela signifie qu'une personne a accès au bot et donc a la permission administrateur\n",
        color: 15548997,
        fields: [
          {
            name: "importance du problème ",
            value: "élevée",
            inline: false
          },
          {
            name: "que faire ?",
            value: "- supprimer la permission administrateur du bot\n- le descendre en dessous des membres",
            inline: false
          }
        ],
        footer: {
          text: "systéme automatique du token",
          icon_url: "https://i.imgur.com/N6Vxysx.png"
        },
        timestamp: "2025-05-17T22:10:01.827Z",
        image: { url: "" },
        thumbnail: { url: "" }
      }
    ]
  };

  try {
    const response = await axios.post(WEBHOOK_URL, payload);
    console.log("Webhook envoyé avec succès :", response.data);
  } catch (error) {
    console.error("Erreur lors de l'envoi du webhook :", error.message);
  }
}

async function verifyToken() {
  try {
    const res = await axios.get("https://discord.com/api/v10/users/@me", {
      headers: { "Authorization": `Bot ${BOT_TOKEN}` }
    });
    console.log("Token valide. Informations sur le bot reçues :", res.data);
  } catch (err) {
    console.error("Token invalide ou erreur lors de la vérification :", err.response?.data || err.message);
    await sendWebhookAlert();
  }
}

verifyToken();
