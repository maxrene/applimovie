class OfflineManager {
    constructor() {
        this.cacheName = 'cinematch-v15-offline-capable';
        this.queue = [];
        this.isProcessing = false;
    }

    async cacheMedia(id, type) {
        this.queue.push({ id, type });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const { id, type } = this.queue.shift();

        try {
            await this.performCaching(id, type);
        } catch (e) {
            console.error(`[OfflineManager] Error caching ${type} ${id}:`, e);
        } finally {
            this.isProcessing = false;
            setTimeout(() => this.processQueue(), 400);
        }
    }

    async performCaching(id, type) {
        if (!window.TMDB_API_KEY) return;

        const apiType = (type === 'serie' || type === 'tv') ? 'tv' : 'movie';
        const cache = await caches.open(this.cacheName);
        const urlsToCache = new Set();

        let appendOptions = 'credits,watch/providers,similar,external_ids,videos';
        if (apiType === 'tv') {
            const seasonsToAppend = Array.from({ length: 14 }, (_, i) => `season/${i + 1}`).join(',');
            appendOptions += `,${seasonsToAppend}`;
        }

        const detailsUrl = `https://api.themoviedb.org/3/${apiType}/${id}?api_key=${window.TMDB_API_KEY}&language=fr-FR&include_video_language=fr,en&append_to_response=${appendOptions}`;

        try {
            const response = await fetch(detailsUrl);
            if (!response.ok) return;

            const data = await response.clone().json();
            await cache.put(detailsUrl, response);

            // Sauvegarder également dans le cache compacté localStorage pour Ma Liste
            if (apiType === 'tv') {
                if (Array.isArray(data.seasons)) {
                    data.seasons.forEach(s => {
                        if (s.season_number > 0 && data[`season/${s.season_number}`]?.episodes) {
                            s.episodes = data[`season/${s.season_number}`].episodes;
                        }
                    });
                }
                const compacted = window.compactSeriesForCache ? window.compactSeriesForCache(data) : data;
                try {
                    localStorage.setItem(`series-details-${id}`, JSON.stringify({ timestamp: Date.now(), data: compacted }));
                } catch (e) {}
            } else {
                const compacted = window.compactMovieForCache ? window.compactMovieForCache(data) : data;
                try {
                    localStorage.setItem(`movie-details-${id}`, JSON.stringify({ timestamp: Date.now(), data: compacted }));
                } catch (e) {}
            }

            if (data.poster_path) urlsToCache.add(`https://image.tmdb.org/t/p/w500${data.poster_path}`);
            if (data.backdrop_path) urlsToCache.add(`https://image.tmdb.org/t/p/original${data.backdrop_path}`);

            if (data.credits && data.credits.cast) {
                data.credits.cast.slice(0, 8).forEach(member => {
                    if (member.profile_path) {
                        urlsToCache.add(`https://image.tmdb.org/t/p/w185${member.profile_path}`);
                    }
                });
            }

            const urls = Array.from(urlsToCache);
            for (const url of urls) {
                try {
                    await cache.add(url);
                } catch (err) {}
            }
        } catch (e) {
            console.error(`[OfflineManager] Fetch failed for ${type} ${id}`, e);
        }
    }
}

window.offlineManager = new OfflineManager();
