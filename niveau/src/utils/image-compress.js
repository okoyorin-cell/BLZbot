const sharp = require('sharp');

/**
 * Convertit une image en JPEG et la compresse pour passer sous une limite de poids.
 * @param {Buffer} inputBuffer - Le buffer de l'image originale
 * @param {number} limitKo - La limite en Ko (256 par défaut pour Discord)
 * @returns {Promise<Buffer>} - Le buffer du JPEG optimisé
 */
async function compressToJpeg(inputBuffer, limitKo = 256) {
    const LIMIT_BYTES = limitKo * 1024;
    let currentQuality = 90;
    let currentResolution = 1920;
    let finalBuffer = null;
    for (let attempts = 1; attempts <= 5; attempts++) {
        try {
            finalBuffer = await sharp(inputBuffer)
                .resize({
                    width: currentResolution,
                    height: currentResolution,
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({
                    quality: currentQuality,
                    mozjpeg: true
                })
                .toBuffer();
            if (finalBuffer.length <= LIMIT_BYTES) {
                return finalBuffer;
            }
            currentQuality -= 15;
            if (currentQuality < 50) {
                currentResolution = Math.floor(currentResolution * 0.75);
                currentQuality = 60;
            }
        } catch (error) {
            if (error.message && !error.message.includes('unsupported image format')) {
                console.error('Erreur lors de la compression JPEG :', error);
            }
            throw error;
        }
    }
    return finalBuffer;
}

module.exports = { compressToJpeg };
