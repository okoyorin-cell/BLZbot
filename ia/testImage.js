// Standalone test — no dependencies required (Node 18+)
const CLOUDFLARE_API_TOKEN = "y_WPOTBmXfNgCmgdAFcrwN44PXhanH12bUbbr9Uu";
const CLOUDFLARE_ACCOUNT_ID = "1951d3c93101f936e0f48eea74bc662e";

(async () => {
    console.log("🚀 Test direct de l'API Cloudflare flux-1-schnell...");
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt: "A red cat riding a bicycle", steps: 4 })
        });

        console.log("Status:", response.status);
        const contentType = response.headers.get("content-type");
        console.log("Content-Type:", contentType);

        if (!response.ok) {
            const errorText = await response.text();
            console.log("❌ Erreur:", errorText);
            return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        console.log(`✅ Image reçue ! Base64 length: ${base64.length}`);
    } catch (err) {
        console.error("❌ Erreur:", err.message);
    }
})();
