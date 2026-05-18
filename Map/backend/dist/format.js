export function formatCount(count) {
    if (count >= 1000) {
        const k = count / 1000;
        return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
    }
    return String(count);
}
