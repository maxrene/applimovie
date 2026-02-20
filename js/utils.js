// js/utils.js

/**
 * Safely parses JSON from localStorage.
 * If the value is null, empty string, or invalid JSON, it returns the defaultValue.
 * This prevents app crashes due to corrupted localStorage data.
 *
 * @param {string} key The localStorage key to retrieve.
 * @param {any} defaultValue The value to return if parsing fails or key doesn't exist.
 * @returns {any} The parsed value or defaultValue.
 */
window.getSafeLocalStorage = function(key, defaultValue) {
    try {
        const item = localStorage.getItem(key);
        if (item === null || item === "undefined" || item === "") return defaultValue;
        return JSON.parse(item);
    } catch (e) {
        console.warn(`[Utils] Error parsing localStorage key "${key}". Resetting to default.`, e);
        // We return the default value, effectively "resetting" the state for this session.
        // The next save will overwrite the corrupted data with valid data.
        return defaultValue;
    }
};
