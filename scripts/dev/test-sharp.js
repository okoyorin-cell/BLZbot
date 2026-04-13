const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
async function test() {
    try {
        const buf = fs.readFileSync(path.join(__dirname, 'test.webp'));
        const out = await sharp(buf).jpeg().toBuffer();
        console.log("Success, size:", out.length);
    } catch(err) {
        console.error("Error:", err);
    }
}
test();
