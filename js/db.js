// js/db.js - Base de données persistante IndexedDB + Cache RAM instantané (0ms)
(function () {
    const DB_NAME = 'CineMatchDB';
    const DB_VERSION = 1;
    const STORE_MEDIA = 'media';
    const STORE_KV = 'kv';
    const TTL_SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const ramMedia = new Map();
    const ramKV = new Map();
    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve) => {
            if (!('indexedDB' in window)) {
                resolve(null);
                return;
            }
            try {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_MEDIA)) {
                        db.createObjectStore(STORE_MEDIA, { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains(STORE_KV)) {
                        db.createObjectStore(STORE_KV, { keyPath: 'key' });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
        return dbPromise;
    }

    // Demander à iOS / navigateur de ne jamais purger le stockage de l'application
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
    }

    // Hydratation initiale en RAM depuis localStorage (pour compatibilité immédiate) puis IndexedDB
    function hydrateRamFromLocalStorage() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                if (
                    key.startsWith('movie-details-') ||
                    key.startsWith('series-details-') ||
                    key.startsWith('person-details-')
                ) {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;
                    const parsed = JSON.parse(raw);
                    const payload = parsed && parsed.data ? parsed : { timestamp: Date.now(), data: parsed };
                    if (payload.data && !payload.data.error) {
                        ramMedia.set(key, payload);
                    }
                }
            }
        } catch (e) {}
    }

    async function hydrateRamFromIndexedDB() {
        const db = await openDB();
        if (!db) return;
        try {
            const tx = db.transaction([STORE_MEDIA, STORE_KV], 'readonly');
            const mediaReq = tx.objectStore(STORE_MEDIA).getAll();
            const kvReq = tx.objectStore(STORE_KV).getAll();

            mediaReq.onsuccess = () => {
                const items = mediaReq.result || [];
                items.forEach(entry => {
                    if (!entry || !entry.key || !entry.data) return;
                    const existing = ramMedia.get(entry.key);
                    if (!existing || (entry.timestamp || 0) >= (existing.timestamp || 0)) {
                        ramMedia.set(entry.key, { timestamp: entry.timestamp || Date.now(), data: entry.data });
                    }
                });
            };

            kvReq.onsuccess = () => {
                const items = kvReq.result || [];
                items.forEach(entry => {
                    if (entry && entry.key) {
                        ramKV.set(entry.key, entry.value);
                    }
                });
            };
        } catch (e) {}
    }

    hydrateRamFromLocalStorage();
    hydrateRamFromIndexedDB();

    function getMediaSync(key, ignoreExpiration = false) {
        const inRam = ramMedia.get(key);
        if (inRam && inRam.data) {
            const expired = (Date.now() - (inRam.timestamp || 0)) > TTL_SEVEN_DAYS;
            if (!expired || ignoreExpiration || !navigator.onLine) {
                return inRam.data;
            }
        }
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const data = parsed.data || parsed;
            const ts = parsed.timestamp || Date.now();
            if (!data || data.error) return null;
            ramMedia.set(key, { timestamp: ts, data });
            const expired = (Date.now() - ts) > TTL_SEVEN_DAYS;
            return (!expired || ignoreExpiration || !navigator.onLine) ? data : null;
        } catch (e) {
            return null;
        }
    }

    async function getMedia(key, ignoreExpiration = false) {
        const syncHit = getMediaSync(key, ignoreExpiration);
        if (syncHit) return syncHit;

        const db = await openDB();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_MEDIA, 'readonly');
                const req = tx.objectStore(STORE_MEDIA).get(key);
                req.onsuccess = () => {
                    const entry = req.result;
                    if (!entry || !entry.data) return resolve(null);
                    ramMedia.set(key, { timestamp: entry.timestamp || Date.now(), data: entry.data });
                    const expired = (Date.now() - (entry.timestamp || 0)) > TTL_SEVEN_DAYS;
                    resolve((!expired || ignoreExpiration || !navigator.onLine) ? entry.data : null);
                };
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    }

    function setMedia(key, data, saveToLocalStorage = true) {
        if (!key || !data || data.error) return data;
        const timestamp = Date.now();
        ramMedia.set(key, { timestamp, data });

        if (saveToLocalStorage) {
            try {
                localStorage.setItem(key, JSON.stringify({ timestamp, data }));
            } catch (e) {
                // Pas grave si localStorage est plein : IndexedDB + RAM prennent le relais sans limite !
            }
        }

        openDB().then(db => {
            if (!db) return;
            try {
                const tx = db.transaction(STORE_MEDIA, 'readwrite');
                tx.objectStore(STORE_MEDIA).put({ key, timestamp, data });
            } catch (e) {}
        });

        return data;
    }

    function getKVSync(key, fallback = null) {
        if (ramKV.has(key)) return ramKV.get(key);
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            ramKV.set(key, parsed);
            return parsed;
        } catch (e) {
            return fallback;
        }
    }

    async function getKV(key, fallback = null) {
        if (ramKV.has(key)) return ramKV.get(key);
        const db = await openDB();
        if (db) {
            const fromIdb = await new Promise((resolve) => {
                try {
                    const tx = db.transaction(STORE_KV, 'readonly');
                    const req = tx.objectStore(STORE_KV).get(key);
                    req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
                    req.onerror = () => resolve(undefined);
                } catch (e) {
                    resolve(undefined);
                }
            });
            if (fromIdb !== undefined) {
                ramKV.set(key, fromIdb);
                return fromIdb;
            }
        }
        return getKVSync(key, fallback);
    }

    function setKV(key, value) {
        ramKV.set(key, value);
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
        openDB().then(db => {
            if (!db) return;
            try {
                const tx = db.transaction(STORE_KV, 'readwrite');
                tx.objectStore(STORE_KV).put({ key, value, timestamp: Date.now() });
            } catch (e) {}
        });
    }

    async function clearAllMediaCache() {
        ramMedia.clear();
        ramKV.clear();
        const db = await openDB();
        if (!db) return;
        await new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_MEDIA, STORE_KV], 'readwrite');
                tx.objectStore(STORE_MEDIA).clear();
                tx.objectStore(STORE_KV).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    }

    window.CineDB = {
        getMediaSync,
        getMedia,
        setMedia,
        getKVSync,
        getKV,
        setKV,
        clearAllMediaCache,
        ramMedia
    };
})();
