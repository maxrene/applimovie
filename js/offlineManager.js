class OfflineManager {
    constructor() {
        this.cacheName = 'cinematch-v11-offline-capable'; // Must match SW cache name for simplicity
        this.queue = [];
        this.isProcessing = false;
    }

    async cacheMedia(id, type) {
        // Queue the request to avoid flooding the network/API
        this.queue.push({ id, type });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const { id, type } = this.queue.shift();

        try {
            console.log(`[OfflineManager] Caching ${type} ${id}...`);
            await this.performCaching(id, type);
        } catch (e) {
            console.error(`[OfflineManager] Error caching ${type} ${id}:`, e);
        } finally {
            this.isProcessing = false;
            // Delay slightly to be nice to the API/Network
            setTimeout(() => this.processQueue(), 500);
        }
    }

    async performCaching(id, type) {
        if (!window.TMDB_API_KEY) return;

        const cache = await caches.open(this.cacheName);
        const urlsToCache = new Set();

        // 1. Details API URL (matching details.js exactly)
        const detailsUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${window.TMDB_API_KEY}&append_to_response=credits,watch/providers,similar,external_ids,videos`;
        urlsToCache.add(detailsUrl);

        try {
            // Fetch the details to find images and seasons
            const response = await fetch(detailsUrl);
            if (!response.ok) return;

            // Clone response because we can only read the body once,
            // but we also need to put it in cache (which consumes it, or we fetch again).
            // Actually, if we use cache.add(url), it fetches internally.
            // But we need to READ it to find sub-resources.
            // So we use fetch(), read json, then put a copy in cache.
            const data = await response.clone().json();

            // Put the main response in cache
            await cache.put(detailsUrl, response);

            // 2. Images (Poster & Banner)
            if (data.poster_path) urlsToCache.add(`https://image.tmdb.org/t/p/w500${data.poster_path}`);
            if (data.backdrop_path) urlsToCache.add(`https://image.tmdb.org/t/p/original${data.backdrop_path}`);

            // 3. Cast Images (Top 10)
            if (data.credits && data.credits.cast) {
                data.credits.cast.slice(0, 10).forEach(member => {
                    if (member.profile_path) {
                        urlsToCache.add(`https://image.tmdb.org/t/p/w185${member.profile_path}`);
                    }
                });
            }

            // 4. Series Seasons
            if (type === 'tv' || type === 'serie') {
                if (data.seasons) {
                    for (const season of data.seasons) {
                        if (season.season_number > 0) {
                             const seasonUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}?api_key=${window.TMDB_API_KEY}`;
                             urlsToCache.add(seasonUrl);
                        }
                    }
                }
            }

            // 5. Execute all cache adds
            // We do this individually to catch errors (like 404s on images) without breaking the whole batch
            const urls = Array.from(urlsToCache);
            for (const url of urls) {
                try {
                    // Check if already in cache to save bandwidth?
                    // "Update as soon as I have network" -> we should probably fetch fresh if online.
                    // cache.add() fetches and puts.
                    await cache.add(url);
                } catch (err) {
                    // Ignore individual failures (e.g. image 404)
                    // console.warn(`Failed to cache ${url}`, err);
                }
            }

            console.log(`[OfflineManager] Successfully cached ${type} ${id} (${urls.length} resources)`);

        } catch (e) {
            console.error(`[OfflineManager] Fetch failed for ${type} ${id}`, e);
        }
    }
}

// Global Instance
window.offlineManager = new OfflineManager();
