/** Adjust thresholds in README if your map feels wrong. */
export function getZoomTier(zoom) {
    if (zoom <= 5)
        return 1;
    if (zoom <= 11)
        return 2;
    return 3;
}
