// 1. Importer et configurer dotenv en PREMIER
import 'dotenv/config'; 

import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";

// 2. Récupérer la clé depuis process.env
const API_KEY = process.env.GEMINI_API_KEY;

// 3. (Optionnel mais important) Vérifier si la clé existe
if (!API_KEY) {
  console.error("Erreur : Variable d'environnement GEMINI_API_KEY non trouvée.");
  console.log("Veuillez créer un fichier .env et y ajouter votre clé.");
  process.exit(1); // Arrêter le script si la clé est absente
}

async function main() {
  // 4. Utiliser la clé chargée
  const ai = new GoogleGenAI(API_KEY);

  const prompt =
    "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme";

  console.log("Génération de l'image en cours...");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: prompt,
      config: {
        responseModalities: ["IMAGE", "TEXT"]
      },
    });

    // Le reste de votre code est bon
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        console.log(part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");
        fs.writeFileSync("image_generee.png", buffer);
        console.log("Image sauvegardée : image_generee.png");
      }
    }
  } catch (e) {
    console.error("Une erreur est survenue :");
    console.error(e.message);
  }
}

main();