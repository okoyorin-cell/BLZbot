function msToTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60).toString().padStart(2, '0');
    const minutes = Math.floor((ms / (1000 * 60)) % 60).toString().padStart(2, '0');
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24).toString();

    if (parseInt(hours) > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (parseInt(minutes) > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

module.exports = { msToTime };