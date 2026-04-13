// imageGenerator.js
const sharp = require('sharp');
const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID } = require('./config');

const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// Stocke la dernière image générée (base64 PNG) pour la réutiliser comme contexte
let lastGeneratedImageBase64 = null;
let messagesSinceLastImage = 0; // Compteur de messages depuis la dernière génération

function getLastGeneratedImage() {
  return lastGeneratedImageBase64;
}

function setLastGeneratedImage(base64) {
  lastGeneratedImageBase64 = base64;
  messagesSinceLastImage = 0;
}

/**
 * Appelé à chaque nouveau message traité.
 * Expire l'image si elle date de plus de 1 message.
 */
function tickImageContext() {
  if (lastGeneratedImageBase64) {
    messagesSinceLastImage++;
    if (messagesSinceLastImage > 1) {
      log("🗑️ Image contexte expirée (plus de 1 message depuis la génération)");
      lastGeneratedImageBase64 = null;
      messagesSinceLastImage = 0;
    }
  }
}

/**
 * Redimensionne une image (buffer ou base64) en 512x512 via sharp
 * @param {Buffer|string} input - Buffer ou base64 string
 * @returns {Promise<Buffer>} - Image redimensionnée en PNG buffer
 */
async function resizeImageTo512(input) {
  try {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'base64');
    const resized = await sharp(buffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();
    log(`📐 Image redimensionnée en 512x512 (${resized.length} bytes)`);
    return resized;
  } catch (err) {
    log(`⚠️ Erreur resize sharp: ${err.message}`);
    return null;
  }
}

/**
 * Génère une image via Cloudflare Workers AI (flux-1-schnell)
 * @param {string} prompt - Le prompt texte
 * @param {Array} attachmentsParts - Images jointes au format Gemini [{inlineData:{data, mimeType}}]
 * @returns {Object} - {base64, mimeType, text, quotaExceeded}
 */
async function generateImage(prompt, attachmentsParts = []) {
  log("🖼️ Début de la génération d'image via Cloudflare Workers AI (flux-1-schnell)...");

  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    log("⚠️ Clés Cloudflare manquantes.");
    return {
      base64: null, mimeType: null,
      text: "La configuration de Cloudflare Workers AI est manquante.",
      quotaExceeded: false
    };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

  try {
    // Collecter les images d'entrée (max 4)
    const inputImages = [];

    // 1. Ajouter les images jointes par l'utilisateur (redimensionnées en 512x512)
    for (const part of attachmentsParts) {
      if (inputImages.length >= 4) break;
      if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
        const resized = await resizeImageTo512(part.inlineData.data);
        if (resized) {
          inputImages.push(resized);
          log(`📎 Image utilisateur ajoutée comme input_image_${inputImages.length - 1}`);
        }
      }
    }

    // 2. Ajouter la dernière image générée comme contexte (si disponible et pas déjà d'images)
    if (inputImages.length === 0 && lastGeneratedImageBase64) {
      const resized = await resizeImageTo512(lastGeneratedImageBase64);
      if (resized) {
        inputImages.push(resized);
        log(`🔄 Dernière image générée ajoutée comme input_image_0 (contexte)`);
      }
    }

    // Construire le payload JSON (flux-1-schnell n'accepte que JSON et pas d'images en entrée)
    const payload = {
      prompt: prompt,
      steps: 4
    };

    if (inputImages.length > 0) {
      log(`⚠️ flux-1-schnell ne supporte pas d'images en entrée. Les ${inputImages.length} image(s) sont ignorées.`);
    }

    log(`📤 Envoi requête Cloudflare (JSON, prompt: "${prompt}")`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`❌ Erreur Cloudflare API: ${response.status} ${errorText}`);
      return {
        base64: null, mimeType: null,
        text: "Erreur lors de la génération avec Cloudflare Workers AI.",
        quotaExceeded: false
      };
    }

    const result = await response.json();

    if (result.success && result.result && result.result.image) {
      log("✅ Image générée avec succès.");
      // Stocker pour la prochaine utilisation (même si on ne peut pas l'utiliser en input avec flux-1-schnell, on le garde au cas où le modèle change)
      lastGeneratedImageBase64 = result.result.image;
      return {
        base64: result.result.image,
        mimeType: "image/png",
        text: null,
        quotaExceeded: false
      };
    } else {
      log(`❌ Réponse Cloudflare inattendue: ${JSON.stringify(result)}`);
      return {
        base64: null, mimeType: null,
        text: "Erreur lors de la génération de l'image (réponse inattendue).",
        quotaExceeded: false
      };
    }

  } catch (error) {
    log(`❌ Erreur lors de l'appel à Cloudflare: ${error.message}`);
    return {
      base64: null, mimeType: null,
      text: "Une erreur interne est survenue lors de la génération de l'image.",
      quotaExceeded: false
    };
  }
}

module.exports = {
  generateImage,
  getLastGeneratedImage,
  setLastGeneratedImage,
  tickImageContext,
  resizeImageTo512,
  log
};
