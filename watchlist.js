// Queue de requête rapide avec gestion automatique du rate-limit TMDB (429)
class RequestQueue {
    constructor(concurrency = 8, delay = 25) {
        this.concurrency = concurrency;
        this.delay = delay;
        this.queue = [];
        this.activeCount = 0;
    }

    add(fn, priority = false) {
        return new Promise((resolve, reject) => {
            if (priority) {
                this.queue.unshift({ fn, resolve, reject });
            } else {
                this.queue.push({ fn, resolve, reject });
            }
            this.process();
        });
    }

    async process() {
        if (this.activeCount >= this.concurrency || this.queue.length === 0) return;

        this.activeCount++;
        const { fn, resolve, reject } = this.queue.shift();

        try {
            if (this.delay > 0) {
                await new Promise(r => setTimeout(r, this.delay));
            }
            const result = await this.retry(fn);
            resolve(result);
        } catch (e) {
            reject(e);
        } finally {
            this.activeCount--;
            this.process();
        }
    }

    async retry(fn, retries = 3, backoff = 800) {
        try {
            const result = await fn();
            if (result instanceof Response && result.status === 429) {
                throw new Error('429');
            }
            return result;
        } catch (e) {
            if ((e.message === '429' || e.name === 'TypeError') && retries > 0) {
                await new Promise(r => setTimeout(r, backoff));
                return this.retry(fn, retries - 1, backoff * 2);
            }
            throw e;
        }
    }
}

const apiQueue = new RequestQueue(8, 25);

// Cache mémoire de session pour éviter de parser le localStorage en boucle à chaque clic d'onglet
const memoryMediaCache = new Map();

document.addEventListener('alpine:init', () => {
    Alpine.data('watchlistPage', () => ({
        watchlist: [],
        enrichedWatchlist: [],
        subTab: 'movie',
        sortOrder: 'popularity',

        activePlatformFilters: [],
        watchStatusFilter: 'unwatched',
        showServiceBar: false,

        // Nouveaux filtres ergonomiques pour Ma Liste
        showFilterModal: false,
        selectedGenre: '',
        maxDuration: 0, // 0 = tous, 100 = <1h40, 130 = <2h10
        randomPickItem: null,

        userRegion: localStorage.getItem('userRegion') || 'FR',
        myPlatformIds: [],
        userSelectedPlatforms: [],
        lastStateSignature: '',

        get availablePlatforms() {
            return window.PLATFORMS_CATALOG || [
                { id: 'netflix', logoUrl: 'https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456' },
                { id: 'prime', logoUrl: 'https://www.citypng.com/public/uploads/preview/amazon-prime-ios-app-icon-701751695133984u2yuon8nlu.png' },
                { id: 'disney', logoUrl: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/25357066/Disney__Logo_March_2024.png?quality=90&strip=all&crop=0,0,100,100' },
                { id: 'apple', logoUrl: 'https://image.tmdb.org/t/p/original/9icYBfYFcwgCbky5VdGUIKJ4C5i.png' },
                { id: 'canal', logoUrl: 'https://static1.purepeople.com/articles/0/46/23/10/@/6655765-logo-de-la-chaine-canal-1200x0-2.png' },
                { id: 'paramount', logoUrl: 'https://image.tmdb.org/t/p/original/pkx3klJlwW5JdtaulvDx6hDNtch.png' },
                { id: 'max', logoUrl: 'https://image.tmdb.org/t/p/original/skypuy7SXuugIQeYg0IglmzoKaS.png' },
                { id: 'crunchyroll', logoUrl: 'https://image.tmdb.org/t/p/original/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png' },
                { id: 'arte', logoUrl: 'https://image.tmdb.org/t/p/original/ieo2l4zOaljYqJNGxWY8jWryld5.png' },
                { id: 'rakuten', logoUrl: 'https://image.tmdb.org/t/p/original/872dfVu1biZISJ8rO143CZZutPR.png' },
                { id: 'pluto', logoUrl: 'https://image.tmdb.org/t/p/original/fN4czqaMQNLeF6sSSIjGbAWzvwK.png' },
                { id: 'skygo', logoUrl: 'https://image.tmdb.org/t/p/original/1Yvl9eP3pmktqChitnFhHJHcBtX.png' },
                { id: 'now', logoUrl: 'https://image.tmdb.org/t/p/original/oFAnvlaEW2KT6J7XM0DXjlWqKu9.png' }
            ];
        },

        computeStateSignature() {
            return [
                localStorage.getItem('watchlist') || '[]',
                localStorage.getItem('watchedMovies') || '[]',
                localStorage.getItem('watchedSeries') || '[]',
                localStorage.getItem('watchedEpisodes') || '{}',
                localStorage.getItem('selectedPlatforms') || '[]',
                localStorage.getItem('userRegion') || 'FR'
            ].join('|');
        },

        refreshUserPlatforms() {
            this.userRegion = localStorage.getItem('userRegion') || 'FR';
            this.myPlatformIds = getSafeLocalStorage('selectedPlatforms', []);
            this.userSelectedPlatforms = this.availablePlatforms.filter(p =>
                this.myPlatformIds.includes(p.id)
            );
        },

        async init() {
            this.refreshUserPlatforms();
            this.activePlatformFilters = [];
            this.loadWatchlist();
            this.lastStateSignature = this.computeStateSignature();

            await this.fetchAndEnrichWatchlist();

            this.$watch('subTab', () => {
                this.selectedGenre = '';
                this.maxDuration = 0;
                this.renderMedia();
            });
            this.$watch('watchStatusFilter', () => this.renderMedia());
            this.$watch('activePlatformFilters', () => this.renderMedia());
            this.$watch('selectedGenre', () => this.renderMedia());
            this.$watch('maxDuration', () => this.renderMedia());

            const handleRefreshIfChanged = async () => {
                const newSig = this.computeStateSignature();
                if (newSig !== this.lastStateSignature) {
                    this.lastStateSignature = newSig;
                    this.refreshUserPlatforms();
                    this.loadWatchlist();
                    await this.fetchAndEnrichWatchlist();
                } else {
                    this.renderMedia();
                }
            };

            window.addEventListener('view-changed', (e) => {
                if (!e.detail || e.detail.tab === 'watchlist') {
                    handleRefreshIfChanged();
                }
            });

            window.addEventListener('pageshow', () => {
                handleRefreshIfChanged();
            });

            window.addEventListener('cloud-data-synced', () => {
                handleRefreshIfChanged();
            });

            await this.renderMedia();
        },

        get isAllSelected() {
            return this.activePlatformFilters.length === 0;
        },

        get hasActiveExtraFilters() {
            return Boolean(this.selectedGenre) || this.maxDuration > 0;
        },

        get availableGenresInWatchlist() {
            const type = this.subTab === 'movie' ? 'movie' : 'serie';
            const genresSet = new Set();
            this.enrichedWatchlist.forEach(item => {
                const normalizedType = (item.type === 'tv') ? 'serie' : item.type;
                if (normalizedType === type && Array.isArray(item.genres)) {
                    item.genres.forEach(g => {
                        if (g) genresSet.add(typeof g === 'string' ? g : g.name);
                    });
                }
            });
            return Array.from(genresSet).sort((a, b) => a.localeCompare(b, 'fr'));
        },

        resetExtraFilters() {
            this.selectedGenre = '';
            this.maxDuration = 0;
            this.showFilterModal = false;
        },

        pickRandomMedia() {
            const pool = this.filteredMedia;
            if (!pool || pool.length === 0) return;
            const randomIndex = Math.floor(Math.random() * pool.length);
            this.randomPickItem = pool[randomIndex];
        },

        togglePlatformFilter(platformId) {
            if (platformId === 'all') {
                this.activePlatformFilters = [];
                return;
            }

            if (this.activePlatformFilters.includes(platformId)) {
                this.activePlatformFilters = this.activePlatformFilters.filter(id => id !== platformId);
            } else {
                this.activePlatformFilters.push(platformId);
            }
        },

        loadWatchlist() {
            const watchlist = getSafeLocalStorage('watchlist', []);
            const watchedMovies = getSafeLocalStorage('watchedMovies', []);
            const watchedSeries = getSafeLocalStorage('watchedSeries', []);

            const existingIds = new Set(watchlist.map(item => Number(item.id)));

            watchedMovies.forEach(id => {
                const numId = Number(id);
                if (!existingIds.has(numId)) {
                    watchlist.push({ id: numId, type: 'movie', isWatched: true, added_at: new Date(0).toISOString() });
                    existingIds.add(numId);
                }
            });

            watchedSeries.forEach(id => {
                const numId = Number(id);
                if (!existingIds.has(numId)) {
                    watchlist.push({ id: numId, type: 'serie', isWatched: true, added_at: new Date(0).toISOString() });
                    existingIds.add(numId);
                }
            });

            this.watchlist = watchlist;
        },

        getInternalPlatformId(tmdbName, providerId = null) {
            if (window.getInternalPlatformId) {
                return window.getInternalPlatformId(tmdbName, providerId);
            }
            const lower = String(tmdbName || '').toLowerCase();
            if (lower.includes('netflix')) return 'netflix';
            if (lower.includes('amazon') || lower.includes('prime')) return 'prime';
            if (lower.includes('disney')) return 'disney';
            if (lower.includes('apple')) return 'apple';
            if (lower.includes('canal')) return 'canal';
            if (lower.includes('paramount')) return 'paramount';
            if (lower.includes('max') || lower.includes('hbo')) return 'max';
            if (lower.includes('crunchyroll')) return 'crunchyroll';
            if (lower.includes('arte')) return 'arte';
            if (lower.includes('rakuten')) return 'rakuten';
            if (lower.includes('pluto')) return 'pluto';
            if (lower.includes('sky')) return 'skygo';
            if (lower.includes('now')) return 'now';
            return 'other';
        },

        getProvidersForItem(item) {
            if (!item.apiDetails || !item.apiDetails['watch/providers'] || !item.apiDetails['watch/providers'].results) return [];
            const providersData = item.apiDetails['watch/providers'].results;
            let rawProviders = [];

            if (providersData[this.userRegion] && providersData[this.userRegion].flatrate) {
                rawProviders = [...providersData[this.userRegion].flatrate];
            }
            if (this.userRegion !== 'FR' && this.myPlatformIds.includes('canal')) {
                if (providersData['FR'] && providersData['FR'].flatrate) {
                    const canal = providersData['FR'].flatrate.find(p =>
                        p.provider_id === 381 || p.provider_id === 392 || String(p.provider_name).toLowerCase().includes('canal')
                    );
                    if (canal) rawProviders.push(canal);
                }
            }

            const unique = [];
            const seen = new Set();
            for (const p of rawProviders) {
                const internalId = this.getInternalPlatformId(p.provider_name, p.provider_id);
                const dedupKey = internalId !== 'other' ? internalId : p.provider_id;
                if (!seen.has(dedupKey)) {
                    unique.push(p);
                    seen.add(dedupKey);
                }
            }
            return unique;
        },

        hydrateEnrichedItem(item, details) {
            const enriched = { ...item };
            if (details && !details.error) {
                enriched.apiDetails = details;
                enriched.title = details.title || details.name || enriched.title;
                enriched.posterUrl = details.poster_path
                    ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
                    : (enriched.posterUrl || 'https://placehold.co/300x450?text=No+Image');
                enriched.year = (details.release_date || details.first_air_date || enriched.year || '').split('-')[0];
                enriched.genres = details.genres
                    ? details.genres.map(g => (typeof g === 'string' ? g : g.name))
                    : (enriched.genres || []);
                enriched.imdb = details.vote_average ? Number(details.vote_average).toFixed(1) : (enriched.imdb || '0');
                enriched.runtime = details.runtime || enriched.runtime || 0;
            }
            if (!enriched.type) enriched.type = 'movie';
            if (!enriched.posterUrl) enriched.posterUrl = 'https://placehold.co/300x450?text=...';
            if (!enriched.title) enriched.title = `Chargement...`;
            return enriched;
        },

        async fetchAndEnrichWatchlist() {
            const watchedMovies = new Set(getSafeLocalStorage('watchedMovies', []));
            const watchedSeries = new Set(getSafeLocalStorage('watchedSeries', []));
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});

            const watchlistWithMediaData = this.watchlist.map(item => {
                const media = (typeof mediaData !== 'undefined') ? mediaData.find(m => m.id === item.id) : null;
                let base = { ...(media || {}), ...item, apiDetails: null };

                const isMovie = base.type === 'movie';
                const cacheKey = isMovie ? `movie-details-${base.id}` : `series-details-${base.id}`;
                const cachedDetails = memoryMediaCache.get(cacheKey) || this.getCachedData(cacheKey, true);

                if (cachedDetails) {
                    memoryMediaCache.set(cacheKey, cachedDetails);
                    base = this.hydrateEnrichedItem(base, cachedDetails);
                } else {
                    base = this.hydrateEnrichedItem(base, null);
                }

                return base;
            });

            this.enrichedWatchlist = watchlistWithMediaData;
            this.renderMedia();

            // Identifier uniquement les éléments qui ont réellement besoin d'une mise à jour réseau
            const itemsToFetch = this.enrichedWatchlist.filter(item => {
                const isMovie = item.type === 'movie';
                const cacheKey = isMovie ? `movie-details-${item.id}` : `series-details-${item.id}`;
                const cached = this.getCachedData(cacheKey, false);
                if (!cached) return true;

                if (!isMovie) {
                    const epWatchedCount = (watchedEpisodes[item.id] || []).length;
                    if (epWatchedCount > 0 && Array.isArray(cached.seasons)) {
                        const today = new Date().toISOString().split('T')[0];
                        const missingEpisodes = cached.seasons.some(s =>
                            s.season_number > 0 && (!s.air_date || s.air_date <= today) && !Array.isArray(s.episodes)
                        );
                        if (missingEpisodes) return true;
                    }
                }
                return false;
            });

            if (itemsToFetch.length === 0) return;

            // Trier pour charger EN PRIORITÉ les éléments non vus (Watchlist active) avant l'historique "Vu"
            itemsToFetch.sort((a, b) => {
                const aWatched = a.type === 'movie' ? watchedMovies.has(a.id) : watchedSeries.has(a.id);
                const bWatched = b.type === 'movie' ? watchedMovies.has(b.id) : watchedSeries.has(b.id);
                if (aWatched !== bWatched) return aWatched ? 1 : -1;
                return 0;
            });

            let renderTimeout;
            const triggerRender = () => {
                if (renderTimeout) clearTimeout(renderTimeout);
                renderTimeout = setTimeout(() => this.renderMedia(), 120);
            };

            itemsToFetch.forEach(async (item) => {
                const isPriority = !(item.type === 'movie' ? watchedMovies.has(item.id) : watchedSeries.has(item.id));
                let details = null;

                if (item.type === 'serie' || item.type === 'tv') {
                    details = await this.fetchFullSeriesDetails(item.id, isPriority);
                } else {
                    details = await this.fetchMovieDetails(item.id, isPriority);
                }

                const index = this.enrichedWatchlist.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    if (details) {
                        this.enrichedWatchlist[index] = this.hydrateEnrichedItem(this.enrichedWatchlist[index], details);
                    } else if (!this.enrichedWatchlist[index].apiDetails) {
                        this.enrichedWatchlist[index].apiDetails = { error: true };
                    }
                    triggerRender();
                }
            });
        },

        getCachedData(key, ignoreExpiration = false) {
            try {
                const cached = localStorage.getItem(key);
                if (!cached) return null;
                const { timestamp, data } = JSON.parse(cached);
                // Durée de validité portée à 7 jours pour éviter les rechargements lents inutiles
                const isExpired = (Date.now() - timestamp) > 7 * 24 * 60 * 60 * 1000;
                return (isExpired && !ignoreExpiration) ? null : data;
            } catch (e) {
                return null;
            }
        },

        setCachedData(key, rawData, isMovie = true) {
            const compacted = isMovie
                ? (window.compactMovieForCache ? window.compactMovieForCache(rawData) : rawData)
                : (window.compactSeriesForCache ? window.compactSeriesForCache(rawData) : rawData);
            memoryMediaCache.set(key, compacted);
            const item = { timestamp: Date.now(), data: compacted };
            localStorage.setItem(key, JSON.stringify(item));
            return compacted;
        },

        async fetchMovieDetails(movieId, priority = false) {
            const cacheKey = `movie-details-${movieId}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;

            try {
                const res = await apiQueue.add(
                    () => fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`),
                    priority
                );
                if (!res.ok) return this.getCachedData(cacheKey, true) || null;
                const data = await res.json();
                return this.setCachedData(cacheKey, data, true);
            } catch (e) {
                return this.getCachedData(cacheKey, true) || null;
            }
        },

        async fetchFullSeriesDetails(seriesId, priority = false) {
            const cacheKey = `series-details-${seriesId}`;
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const seriesWatched = watchedEpisodes[seriesId] || [];
            const cachedData = this.getCachedData(cacheKey);

            if (cachedData) {
                const today = new Date().toISOString().split('T')[0];
                const needsMoreSeasons = seriesWatched.length > 0 && Array.isArray(cachedData.seasons) &&
                    cachedData.seasons.some(s => s.season_number > 0 && (!s.air_date || s.air_date <= today) && !Array.isArray(s.episodes));
                if (!needsMoreSeasons) return cachedData;
            }

            try {
                // ASTUCE PERFORMANCE : On récupère la série, les plateformes ET jusqu'à 18 saisons en UNE SEULE requête HTTP !
                const seasonsAppend = Array.from({ length: 18 }, (_, i) => `season/${i + 1}`).join(',');
                const seriesRes = await apiQueue.add(
                    () => fetch(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers,${seasonsAppend}`),
                    priority
                );
                if (!seriesRes.ok) return this.getCachedData(cacheKey, true) || null;

                const seriesData = await seriesRes.json();

                // Injecter les épisodes directement dans seriesData.seasons à partir des clés season/X reçues
                seriesData.seasons = (seriesData.seasons || [])
                    .filter(s => s.season_number > 0)
                    .map(s => {
                        const appendedSeason = seriesData[`season/${s.season_number}`];
                        if (appendedSeason && Array.isArray(appendedSeason.episodes)) {
                            return { ...s, episodes: appendedSeason.episodes };
                        }
                        return s;
                    });

                return this.setCachedData(cacheKey, seriesData, false);
            } catch (e) {
                return this.getCachedData(cacheKey, true) || null;
            }
        },

        get filteredMedia() {
            const type = this.subTab === 'movie' ? 'movie' : 'serie';
            const watchedMovies = getSafeLocalStorage('watchedMovies', []);
            const watchedSeries = getSafeLocalStorage('watchedSeries', []);
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});

            let filtered = this.enrichedWatchlist
                .map(item => {
                    if (!item.type && item.title) item.type = 'movie';
                    if (!item.type && item.name) item.type = 'serie';
                    const normalizedType = (item.type === 'tv') ? 'serie' : item.type;

                    let isWatched = false;
                    try {
                        if (normalizedType === 'movie') {
                            isWatched = watchedMovies.includes(Number(item.id));
                        } else {
                            if (item.apiDetails && !item.apiDetails.error) {
                                const seriesWatched = watchedEpisodes[item.id] || [];
                                const totalEpisodes = this.getReleasedEpisodeCount(item.apiDetails);

                                if (totalEpisodes > 0 && seriesWatched.length >= totalEpisodes) {
                                    isWatched = true;
                                } else if (seriesWatched.length > 0 && seriesWatched.length < totalEpisodes) {
                                    isWatched = false;
                                } else {
                                    isWatched = watchedSeries.includes(Number(item.id));
                                }
                            } else {
                                isWatched = watchedSeries.includes(Number(item.id));
                            }
                        }
                    } catch (e) {
                        isWatched = false;
                    }

                    const dynamicProviders = this.getProvidersForItem(item);
                    return { ...item, type: normalizedType, isWatched, dynamicProviders };
                })
                .filter(item => item && item.type === type);

            if (this.activePlatformFilters.length > 0) {
                filtered = filtered.filter(item => {
                    if (!item.dynamicProviders || item.dynamicProviders.length === 0) return false;
                    return item.dynamicProviders.some(p =>
                        this.activePlatformFilters.includes(this.getInternalPlatformId(p.provider_name, p.provider_id))
                    );
                });
            }

            if (this.selectedGenre) {
                filtered = filtered.filter(item =>
                    Array.isArray(item.genres) && item.genres.some(g => (typeof g === 'string' ? g : g.name) === this.selectedGenre)
                );
            }

            if (this.maxDuration > 0 && type === 'movie') {
                filtered = filtered.filter(item => {
                    const runtime = item.runtime || item.apiDetails?.runtime || 0;
                    return runtime > 0 && runtime <= this.maxDuration;
                });
            }

            if (this.watchStatusFilter === 'watched') {
                filtered = filtered.filter(item => item.isWatched);
            } else if (this.watchStatusFilter === 'unwatched') {
                filtered = filtered.filter(item => !item.isWatched);
            }

            return filtered;
        },

        setSort(order) { this.sortOrder = order; this.renderMedia(); },
        get sortLabel() {
            if (this.sortOrder === 'popularity') return 'Note';
            if (this.sortOrder === 'release_date') return 'Sortie';
            return 'Ajout';
        },

        async renderMedia() {
            const container = document.getElementById('media-list');
            const emptyState = document.getElementById('empty-state');
            if (!container) return;
            let itemsToRender = [...this.filteredMedia];

            if (this.subTab === 'tv' || this.subTab === 'serie') {
                const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
                const seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});
                itemsToRender.forEach(item => {
                    const seriesWatched = watchedEpisodes[item.id] || [];
                    item._hasStarted = seriesWatched.length > 0;
                    item._lastWatchedAt = seriesLastWatchedDate[item.id] || 0;
                });
            }

            itemsToRender.sort((a, b) => {
                if (this.subTab === 'tv' || this.subTab === 'serie') {
                    const aStarted = a._hasStarted || false;
                    const bStarted = b._hasStarted || false;
                    if (aStarted && !bStarted) return -1;
                    if (!aStarted && bStarted) return 1;
                    if (aStarted && bStarted && a._lastWatchedAt !== b._lastWatchedAt) {
                        return b._lastWatchedAt - a._lastWatchedAt;
                    }
                }

                if (this.sortOrder === 'recently_added') {
                    return new Date(b.added_at || 0) - new Date(a.added_at || 0);
                } else if (this.sortOrder === 'release_date') {
                    const yearA = parseInt(String(a.year || '0').split(' - ')[0], 10) || 0;
                    const yearB = parseInt(String(b.year || '0').split(' - ')[0], 10) || 0;
                    return yearB - yearA;
                } else {
                    const ratingA = parseFloat(a.imdb || a.apiDetails?.vote_average || 0) || 0;
                    const ratingB = parseFloat(b.imdb || b.apiDetails?.vote_average || 0) || 0;
                    return ratingB - ratingA;
                }
            });

            if (itemsToRender.length === 0) {
                container.innerHTML = '';
                if (emptyState) emptyState.classList.remove('hidden');
                return;
            }
            if (emptyState) emptyState.classList.add('hidden');

            const mediaHTML = itemsToRender.map(item => {
                try {
                    return this.createMediaItemHTML(item);
                } catch (e) {
                    console.error('Error rendering item:', item.id, e);
                    return '';
                }
            });
            container.innerHTML = mediaHTML.join('');

            if (typeof Alpine !== 'undefined') {
                Alpine.initTree(container);
            }
        },

        createMediaItemHTML(item) {
            if (item.type === 'movie') return this.createMovieItemHTML(item);
            if (item.type === 'serie') return this.createTVItemHTML(item);
            return '';
        },

        createCheckButtonHTML(itemId, isWatched, type, extraAction = '') {
            const action = type === 'movie' ? `toggleMovieWatched(${itemId})` : `markEpisodeWatched(${itemId}, ${extraAction})`;
            const bgClass = isWatched
                ? 'bg-green-500 border-green-500 text-white'
                : 'bg-black/40 border-gray-600 text-gray-400 hover:text-white hover:border-primary';
            const titleAttr = type === 'movie'
                ? (isWatched ? 'Marquer comme non vu' : 'Marquer comme vu')
                : (isWatched ? 'Réinitialiser la série' : 'Marquer le prochain épisode comme vu');
            return `<button @click.prevent.stop="${action}" title="${titleAttr}" class="flex h-8 w-8 items-center justify-center rounded-full border transition-all active:scale-90 ${bgClass} z-10 shrink-0"><span class="material-symbols-outlined text-[18px]">check</span></button>`;
        },

        createRemoveButtonHTML(itemId, type) {
            return `<button @click.prevent.stop="removeFromWatchlist(${itemId}, '${type}')" title="Retirer de ma liste" class="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all z-10 shrink-0"><span class="material-symbols-outlined text-[18px]">delete</span></button>`;
        },

        createPlatformIconsHTML(providers) {
            if (!providers || providers.length === 0) return '';
            const myProviders = this.myPlatformIds.length > 0
                ? providers.filter(p => this.myPlatformIds.includes(this.getInternalPlatformId(p.provider_name, p.provider_id)))
                : providers.slice(0, 4);
            if (myProviders.length === 0) return '';

            const renderedPlatforms = new Set();
            return myProviders.map(p => {
                const internalId = this.getInternalPlatformId(p.provider_name, p.provider_id);
                const dedupKey = internalId !== 'other' ? internalId : p.provider_id;
                if (renderedPlatforms.has(dedupKey)) return '';
                renderedPlatforms.add(dedupKey);

                const platformObj = this.availablePlatforms.find(ap => ap.id === internalId);
                const logo = platformObj
                    ? platformObj.logoUrl
                    : (p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : p.logoUrl);
                return `<img src="${logo}" alt="${p.provider_name}" class="h-4 w-4 rounded-sm object-cover bg-gray-800" title="${p.provider_name}">`;
            }).join('');
        },

        formatDuration(runtime) {
            if (!runtime) return '';
            const h = Math.floor(runtime / 60);
            const m = runtime % 60;
            return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
        },

        createMovieItemHTML(item) {
            const link = `film.html?id=${item.id}`;
            const durationStr = item.duration || (item.apiDetails?.runtime ? this.formatDuration(item.apiDetails.runtime) : '');
            const genresStr = item.genres && item.genres.length > 0
                ? (typeof item.genres[0] === 'string' ? item.genres[0] : item.genres[0].name)
                : '';
            const ratingVal = item.apiDetails?.vote_average ? Number(item.apiDetails.vote_average).toFixed(1) : (item.imdb && item.imdb !== '0' ? item.imdb : '');
            const parts = [item.year, genresStr, durationStr].filter(Boolean);
            const metaLine = parts.join(' • ');
            const ratingBadge = ratingVal ? `<span class="inline-flex items-center gap-0.5 text-yellow-500 text-xs font-semibold ml-2"><span class="material-symbols-outlined text-[12px] filled">star</span>${ratingVal}</span>` : '';

            const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
            const availableLine = platformsHTML
                ? `<div class="mt-3 flex items-center gap-2 text-xs text-gray-400"><span>Disponible sur :</span><div class="flex items-center gap-1.5">${platformsHTML}</div></div>`
                : '';
            const checkButton = this.createCheckButtonHTML(item.id, item.isWatched, 'movie');
            const removeButton = this.createRemoveButtonHTML(item.id, 'movie');

            return `
            <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                <a href="${link}" class="w-24 flex-shrink-0 group">
                    <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-md">
                        <img src="${item.posterUrl}" alt="${item.title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                        ${item.isWatched ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="material-symbols-outlined text-green-400 text-3xl">check_circle</span></div>' : ''}
                    </div>
                </a>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start gap-1">
                        <a href="${link}" class="block pr-1 flex-1 min-w-0">
                            <h3 class="font-bold text-base sm:text-lg text-white line-clamp-2 leading-tight">${item.title}</h3>
                        </a>
                        <div class="flex items-center gap-1 shrink-0">
                            ${checkButton}
                            ${removeButton}
                        </div>
                    </div>
                    <p class="text-xs sm:text-sm text-gray-400 mt-1 flex items-center flex-wrap">${metaLine}${ratingBadge}</p>
                    ${availableLine}
                </div>
            </div>`;
        },

        createTVItemHTML(item) {
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const seriesWatchedEpisodes = new Set(watchedEpisodes[item.id] || []);
            const watchedCount = seriesWatchedEpisodes.size;

            const totalEpisodes = this.getReleasedEpisodeCount(item.apiDetails);

            if (item.isWatched || (item.apiDetails && totalEpisodes > 0 && watchedCount >= totalEpisodes)) {
                const checkButton = this.createCheckButtonHTML(item.id, true, 'serie', "'all'");
                const removeButton = this.createRemoveButtonHTML(item.id, 'serie');

                let statusText = "Série à jour";
                let textColorClass = "text-green-400";

                if (item.apiDetails) {
                    if (item.apiDetails.status === 'Ended' || item.apiDetails.status === 'Canceled') {
                        statusText = "Série terminée";
                    } else if (item.apiDetails.next_episode_to_air && item.apiDetails.next_episode_to_air.air_date) {
                        const dateObj = new Date(item.apiDetails.next_episode_to_air.air_date);
                        const month = dateObj.toLocaleString('fr-FR', { month: 'long' });
                        const year = dateObj.getFullYear();
                        statusText = `À jour • Prochain épisode en ${month} ${year}`;
                        textColorClass = "text-blue-400";
                    }
                }

                const genreText = item.genres && item.genres.length > 0
                    ? (typeof item.genres[0] === 'string' ? item.genres[0] : item.genres[0].name)
                    : '';
                const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);

                return `
                <div class="relative flex items-center gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                    <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0">
                        <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-md">
                            <img src="${item.posterUrl}" loading="lazy" class="w-full h-full object-cover">
                            <div class="absolute inset-0 flex items-center justify-center bg-black/50">
                                <span class="material-symbols-outlined text-green-400 text-3xl">check_circle</span>
                            </div>
                        </div>
                    </a>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start gap-1">
                            <a href="serie.html?id=${item.id}" class="block pr-1 flex-1 min-w-0">
                                <h3 class="font-bold text-base sm:text-lg text-white line-clamp-2 leading-tight">${item.title}</h3>
                            </a>
                            <div class="flex items-center gap-1 shrink-0">
                                ${checkButton}
                                ${removeButton}
                            </div>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            <span>${String(item.year || '').split(' - ')[0]}${genreText ? ' • ' + genreText : ''}</span>
                            ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}
                            <div class="flex items-center gap-1">${platformsHTML}</div>
                        </div>
                        <p class="text-xs ${textColorClass} mt-2 font-medium">${statusText}</p>
                    </div>
                </div>`;
            }

            if (watchedCount > 0 && item.apiDetails && !item.apiDetails.error) {
                return this.createInProgressTVItemHTML(item, seriesWatchedEpisodes);
            }
            return this.createUnwatchedTVItemHTML(item);
        },

        getReleasedEpisodeCount(data) {
            if (!data || !data.seasons || !Array.isArray(data.seasons)) return data ? (data.number_of_episodes || 0) : 0;

            const todayStr = new Date().toISOString().split('T')[0];
            let total = 0;

            data.seasons.forEach(season => {
                try {
                    if (!season || season.season_number === 0) return;
                    if (Array.isArray(season.episodes) && season.episodes.length > 0) {
                        const releasedInSeason = season.episodes.filter(e =>
                            e.air_date ? e.air_date <= todayStr : (!season.air_date || season.air_date <= todayStr)
                        ).length;
                        total += releasedInSeason;
                        return;
                    }
                    if (!season.air_date || season.air_date > todayStr) return;

                    if (data.next_episode_to_air && data.next_episode_to_air.season_number === season.season_number) {
                        total += Math.max(0, data.next_episode_to_air.episode_number - 1);
                    } else {
                        total += (season.episode_count || 0);
                    }
                } catch (e) {}
            });

            return total;
        },

        createUnwatchedTVItemHTML(item) {
            const removeButton = this.createRemoveButtonHTML(item.id, 'serie');
            if (item.apiDetails && item.apiDetails.error) {
                return `
                <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                    <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0">
                        <div class="w-full aspect-[2/3] rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                            <span class="material-symbols-outlined text-gray-500">broken_image</span>
                        </div>
                    </a>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <a href="serie.html?id=${item.id}" class="block">
                                <h3 class="font-bold text-base text-white leading-tight">Média indisponible (${item.id})</h3>
                            </a>
                            ${removeButton}
                        </div>
                    </div>
                </div>`;
            }

            if (!item.apiDetails || !item.apiDetails.seasons) {
                const startYear = String(item.year || '').split(' - ')[0];
                return `
                <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                    <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0">
                        <img class="w-full aspect-[2/3] rounded-lg object-cover bg-gray-800" src="${item.posterUrl}" alt="${item.title}">
                    </a>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <a href="serie.html?id=${item.id}" class="block">
                                <h3 class="font-bold text-base text-white line-clamp-2 leading-tight">${item.title}</h3>
                            </a>
                            ${removeButton}
                        </div>
                        <p class="text-xs text-gray-400 mt-1">${startYear}</p>
                        <div class="mt-3 flex items-center gap-2 text-gray-500 text-xs">
                            <span class="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                            <span>Synchronisation...</span>
                        </div>
                    </div>
                </div>`;
            }

            const firstSeason = item.apiDetails.seasons.find(s => s.season_number === 1);
            const firstEpisode = firstSeason && Array.isArray(firstSeason.episodes)
                ? firstSeason.episodes.find(e => e.episode_number === 1)
                : null;

            const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
            const totalSeasons = item.apiDetails.number_of_seasons || item.apiDetails.seasons.length;
            const startYear = String(item.year || '').split(' - ')[0];
            const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"><span>${totalSeasons} Saison${totalSeasons > 1 ? 's' : ''} • ${startYear}</span>${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}<div class="flex items-center gap-1">${platformsHTML}</div></div>`;
            const checkButton = firstEpisode ? this.createCheckButtonHTML(item.id, false, 'tv', firstEpisode.id) : '';
            const nextEpName = firstEpisode ? `S01 E01 - ${firstEpisode.name}` : 'Saison 1 • Épisode 1';

            return `
            <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0">
                    <img class="w-full aspect-[2/3] rounded-lg object-cover bg-gray-800 shadow-md" loading="lazy" src="${item.posterUrl}" alt="${item.title}">
                </a>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start gap-1">
                        <a href="serie.html?id=${item.id}" class="block pr-1 flex-1 min-w-0">
                            <h3 class="font-bold text-base sm:text-lg text-white line-clamp-2 leading-tight">${item.title}</h3>
                        </a>
                        <div class="flex items-center gap-1 shrink-0">
                            ${checkButton}
                            ${removeButton}
                        </div>
                    </div>
                    ${infoLine}
                    <div class="mt-3">
                        <p class="text-[11px] font-semibold text-primary uppercase tracking-wide">Commencer la série</p>
                        <p class="text-xs sm:text-sm font-medium text-gray-300 mt-0.5 truncate">${nextEpName}</p>
                    </div>
                </div>
            </div>`;
        },

        createInProgressTVItemHTML(item, seriesWatchedEpisodes) {
            let nextEpisode = null;
            let currentSeasonForProgress = null;

            if (!item.apiDetails.seasons) return this.createUnwatchedTVItemHTML(item);

            const today = new Date().toISOString().split('T')[0];
            const sortedSeasons = item.apiDetails.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);

            for (const season of sortedSeasons) {
                if (!season.episodes || !Array.isArray(season.episodes)) continue;

                const sortedEpisodes = [...season.episodes].sort((a, b) => a.episode_number - b.episode_number);
                for (const episode of sortedEpisodes) {
                    const isReleased = episode.air_date ? episode.air_date <= today : (!season.air_date || season.air_date <= today);
                    if (isReleased && !seriesWatchedEpisodes.has(episode.id)) {
                        nextEpisode = episode;
                        currentSeasonForProgress = season;
                        break;
                    }
                }
                if (nextEpisode) break;
            }

            if (!nextEpisode || !currentSeasonForProgress) return this.createUnwatchedTVItemHTML(item);

            const releasedSeasonEpisodes = currentSeasonForProgress.episodes.filter(e =>
                e.air_date ? e.air_date <= today : (!currentSeasonForProgress.air_date || currentSeasonForProgress.air_date <= today)
            );
            const seasonEpisodeIds = new Set(releasedSeasonEpisodes.map(e => e.id));
            const seasonWatchedCount = [...seriesWatchedEpisodes].filter(id => seasonEpisodeIds.has(id)).length;
            const remainingInSeason = Math.max(0, releasedSeasonEpisodes.length - seasonWatchedCount);
            const totalReleased = this.getReleasedEpisodeCount(item.apiDetails) || item.apiDetails.number_of_episodes || 1;
            const totalProgress = Math.min(100, (seriesWatchedEpisodes.size / totalReleased) * 100);
            const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
            const totalSeasons = item.apiDetails.number_of_seasons || sortedSeasons.length;
            const startYear = String(item.year || '').split(' - ')[0];
            const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"><span>${totalSeasons} Saison${totalSeasons > 1 ? 's' : ''} • ${startYear}</span>${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}<div class="flex items-center gap-1">${platformsHTML}</div></div>`;
            const checkButton = this.createCheckButtonHTML(item.id, false, 'tv', nextEpisode.id);
            const removeButton = this.createRemoveButtonHTML(item.id, 'serie');

            return `
            <div class="relative p-4 hover:bg-white/5 transition-colors rounded-lg">
                <div class="flex gap-4 pb-2">
                    <div class="w-24 flex-shrink-0">
                        <a href="serie.html?id=${item.id}">
                            <img alt="${item.title}" loading="lazy" class="w-full aspect-[2/3] rounded-lg object-cover bg-gray-800 shadow-md" src="${item.posterUrl}">
                        </a>
                    </div>
                    <div class="flex min-w-0 flex-1 flex-col">
                        <div class="flex justify-between items-start gap-1">
                            <a href="serie.html?id=${item.id}" class="block pr-1 flex-1 min-w-0">
                                <h3 class="font-bold text-base sm:text-lg text-white line-clamp-2 leading-tight">${item.title}</h3>
                            </a>
                            <div class="flex items-center gap-1 shrink-0">
                                ${checkButton}
                                ${removeButton}
                            </div>
                        </div>
                        ${infoLine}
                        <div class="mt-3">
                            <p class="text-xs font-semibold text-primary uppercase tracking-wide">
                                S${this.formatEpisodeNumber(nextEpisode.season_number || currentSeasonForProgress.season_number)} E${this.formatEpisodeNumber(nextEpisode.episode_number)}
                                <span class="text-gray-500 normal-case font-normal ml-1">(${remainingInSeason} restant${remainingInSeason > 1 ? 's' : ''} dans la saison)</span>
                            </p>
                            <p class="text-xs sm:text-sm font-medium text-gray-300 mt-0.5 truncate">${nextEpisode.name}</p>
                        </div>
                    </div>
                </div>
                <div class="absolute bottom-0 left-4 right-4 h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
                    <div class="h-full bg-primary transition-all duration-300" style="width: ${totalProgress}%"></div>
                </div>
            </div>`;
        },

        formatEpisodeNumber(num) { return String(num).padStart(2, '0'); },

        async removeFromWatchlist(mediaId, type) {
            const mediaIdNum = parseInt(mediaId, 10);
            const mediaIdStr = String(mediaId);

            let watchlist = getSafeLocalStorage('watchlist', []);
            watchlist = watchlist.filter(item => Number(item.id) !== mediaIdNum);
            localStorage.setItem('watchlist', JSON.stringify(watchlist));

            if (type === 'movie') {
                let watchedMovies = getSafeLocalStorage('watchedMovies', []);
                watchedMovies = watchedMovies.filter(id => Number(id) !== mediaIdNum);
                localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
            } else {
                let watchedSeries = getSafeLocalStorage('watchedSeries', []);
                watchedSeries = watchedSeries.filter(id => Number(id) !== mediaIdNum);
                localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));

                let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
                if (watchedEpisodes[mediaIdStr]) {
                    delete watchedEpisodes[mediaIdStr];
                    localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));
                }
            }

            this.watchlist = this.watchlist.filter(item => Number(item.id) !== mediaIdNum);
            this.enrichedWatchlist = this.enrichedWatchlist.filter(item => Number(item.id) !== mediaIdNum);
            this.lastStateSignature = this.computeStateSignature();
            await this.renderMedia();
        },

        async markEpisodeWatched(seriesId, episodeId) {
            if (!episodeId) return;

            const seriesIdNum = parseInt(seriesId, 10);
            const seriesIdStr = String(seriesId);

            if (episodeId === 'all') {
                let watchedSeries = getSafeLocalStorage('watchedSeries', []);
                watchedSeries = watchedSeries.filter(id => Number(id) !== seriesIdNum);
                localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));

                let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
                if (watchedEpisodes[seriesIdStr]) {
                    delete watchedEpisodes[seriesIdStr];
                    localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));
                }

                // S'assurer que la série reste dans la Watchlist ("Dans ma liste") quand on la décoche de "Vu"
                let watchlist = getSafeLocalStorage('watchlist', []);
                if (!watchlist.some(i => Number(i.id) === seriesIdNum)) {
                    watchlist.push({ id: seriesIdNum, type: 'serie', added_at: new Date().toISOString() });
                    localStorage.setItem('watchlist', JSON.stringify(watchlist));
                }

                const item = this.enrichedWatchlist.find(i => Number(i.id) === seriesIdNum);
                if (item) item.isWatched = false;

                this.lastStateSignature = this.computeStateSignature();
                await this.renderMedia();
                return;
            }

            let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            if (!watchedEpisodes[seriesIdStr]) watchedEpisodes[seriesIdStr] = [];

            if (!watchedEpisodes[seriesIdStr].includes(episodeId)) {
                watchedEpisodes[seriesIdStr].push(episodeId);
                localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

                let seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});
                seriesLastWatchedDate[seriesIdStr] = Date.now();
                localStorage.setItem('seriesLastWatchedDate', JSON.stringify(seriesLastWatchedDate));
            }

            const item = this.enrichedWatchlist.find(i => Number(i.id) === seriesIdNum);
            const totalEpisodes = this.getReleasedEpisodeCount(item ? item.apiDetails : null);

            if (item && item.apiDetails && totalEpisodes > 0 && watchedEpisodes[seriesIdStr].length >= totalEpisodes) {
                let watchedSeries = getSafeLocalStorage('watchedSeries', []);
                if (!watchedSeries.includes(seriesIdNum)) {
                    watchedSeries.push(seriesIdNum);
                    localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
                }
                item.isWatched = true;
            }
            this.lastStateSignature = this.computeStateSignature();
            await this.renderMedia();
        },

        async toggleMovieWatched(movieId) {
            let watchedMovies = getSafeLocalStorage('watchedMovies', []);
            let watchlist = getSafeLocalStorage('watchlist', []);
            const movieIdNum = parseInt(movieId, 10);

            if (watchedMovies.includes(movieIdNum)) {
                watchedMovies = watchedMovies.filter(id => Number(id) !== movieIdNum);
                // Remettre dans la watchlist si on le décoche de "Vu"
                if (!watchlist.some(i => Number(i.id) === movieIdNum)) {
                    watchlist.push({ id: movieIdNum, type: 'movie', added_at: new Date().toISOString() });
                    localStorage.setItem('watchlist', JSON.stringify(watchlist));
                }
            } else {
                watchedMovies.push(movieIdNum);
            }

            localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
            this.lastStateSignature = this.computeStateSignature();
            await this.renderMedia();
        }
    }));
});
