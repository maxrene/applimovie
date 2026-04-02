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
// --- NETTOYEUR AUTOMATIQUE DE MÉMOIRE ---
// On remplace temporairement la fonction de sauvegarde pour intercepter les erreurs de mémoire pleine
const originalSetItem = localStorage.setItem;

localStorage.setItem = function(key, value) {
    try {
        originalSetItem.call(localStorage, key, value);
    } catch (error) {
        // Si l'erreur est liée à un stockage plein (QuotaExceededError)
        if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
            console.warn("📦 Mémoire saturée : Nettoyage automatique du cache en cours...");
            
            // On cherche toutes les clés de cache inutiles (les gros JSON)
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('movie-details-') || k.startsWith('series-details-'))) {
                    keysToRemove.push(k);
                }
            }
            
            // On les supprime
            keysToRemove.forEach(k => localStorage.removeItem(k));
            
            // On retente la sauvegarde de ton film maintenant qu'il y a de la place !
            try {
                originalSetItem.call(localStorage, key, value);
            } catch (e2) {
                console.error("❌ Échec critique, la mémoire est toujours pleine.", e2);
            }
        } else {
            // Si c'est une autre erreur, on la laisse passer
            throw error;
        }
    }
};
