const fs = require('fs');
const p = require('path').join(__dirname, '../ia/handlers.js');
let s = fs.readFileSync(p, 'utf8');

const markerStart = '    const tickStreamEdit = async () => {';
const markerEnd = '        clearInterval(editInterval);';
const i0 = s.indexOf(markerStart);
const i1 = s.indexOf(markerEnd, i0);
if (i0 === -1 || i1 === -1) {
    console.error('markers not found', i0, i1);
    process.exit(1);
}

const replacement = `    const inThinkingBlock = () =>
        streamState.isThinking ||
        (streamState.content.includes('<redacted_thinking>') && !streamState.content.includes('</redacted_thinking>'));

    const tickStreamEdit = async () => {
        if (streamState.done) return;

        const visibleContent = streamState.content.trim();
        const thinking = inThinkingBlock();

        if (!thinking && !visibleContent) return;

        const displayContent = thinking ? '\\uD83E\\uDDE0' : visibleContent;

        if (displayContent !== lastEditContent) {
            try {
                await streamReplyMessage.edit({ content: displayContent, components: [] });
                lastEditContent = displayContent;
            } catch (e) {
                /* ignore */
            }
        }
    };

    const editMs = config.IA_STREAM_EDIT_INTERVAL_MS || 300;
    let primedFirstEdit = false;
    const editInterval = setInterval(tickStreamEdit, editMs);

    try {
        responseText = await queryFunction(async (progress) => {
            streamState = progress;
            if (progress.done) return;
            const v = (progress.content || '').trim();
            const th =
                progress.isThinking ||
                (progress.content &&
                    progress.content.includes('<redacted_thinking>') &&
                    !progress.content.includes('</redacted_thinking>'));
            if (!primedFirstEdit && (v.length > 0 || th)) {
                primedFirstEdit = true;
                void tickStreamEdit();
            }
        });

        clearInterval(editInterval);`;

// Fix emoji: use real brain emoji in output
const fixed = replacement.replace('\\uD83E\\uDDE0', '🧠');

const before = s.slice(0, i0);
const after = s.slice(i1);
const next = before + fixed + '\n\n' + after;
fs.writeFileSync(p, next);
console.log('patched', p, 'bytes', next.length);
