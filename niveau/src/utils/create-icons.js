
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const ICON_SIZE = 64;
const assetsPath = path.join(__dirname, '../assets/battlepass');

// Star icon
const starCanvas = createCanvas(ICON_SIZE, ICON_SIZE);
const starCtx = starCanvas.getContext('2d');
starCtx.fillStyle = '#ffd700';
starCtx.beginPath();
starCtx.moveTo(32, 0);
starCtx.lineTo(42, 20);
starCtx.lineTo(64, 22);
starCtx.lineTo(48, 38);
starCtx.lineTo(52, 60);
starCtx.lineTo(32, 50);
starCtx.lineTo(12, 60);
starCtx.lineTo(16, 38);
starCtx.lineTo(0, 22);
starCtx.lineTo(22, 20);
starCtx.closePath();
starCtx.fill();
fs.writeFileSync(path.join(assetsPath, 'star.png'), starCanvas.toBuffer('image/png'));

// XP icon
const xpCanvas = createCanvas(ICON_SIZE, ICON_SIZE);
const xpCtx = xpCanvas.getContext('2d');
xpCtx.fillStyle = '#00ff00';
xpCtx.font = '40px Poppins-Bold';
xpCtx.textAlign = 'center';
xpCtx.fillText('XP', 32, 42);
fs.writeFileSync(path.join(assetsPath, 'xp.png'), xpCanvas.toBuffer('image/png'));

// Chest icon
const chestCanvas = createCanvas(ICON_SIZE, ICON_SIZE);
const chestCtx = chestCanvas.getContext('2d');
chestCtx.fillStyle = '#a52a2a';
chestCtx.fillRect(10, 20, 44, 34);
chestCtx.fillStyle = '#d2691e';
chestCtx.fillRect(5, 15, 54, 10);
fs.writeFileSync(path.join(assetsPath, 'chest.png'), chestCanvas.toBuffer('image/png'));

// Lock icon
const lockCanvas = createCanvas(ICON_SIZE, ICON_SIZE);
const lockCtx = lockCanvas.getContext('2d');
lockCtx.fillStyle = '#ffffff';
lockCtx.beginPath();
lockCtx.arc(32, 32, 20, Math.PI, 0);
lockCtx.lineTo(52, 32);
lockCtx.lineTo(52, 52);
lockCtx.lineTo(12, 52);
lockCtx.lineTo(12, 32);
lockCtx.closePath();
lockCtx.fill();
fs.writeFileSync(path.join(assetsPath, 'lock.png'), lockCanvas.toBuffer('image/png'));
