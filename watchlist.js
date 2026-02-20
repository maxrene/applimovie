// Queue de requête pour éviter les limites de l'API (429 Too Many Requests)
class RequestQueue {
    constructor(concurrency = 5, delay = 150) {
        this.concurrency = concurrency;
        this.delay = delay;
        this.queue = [];
        this.activeCount = 0;
    }

    add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.activeCount >= this.concurrency || this.queue.length === 0) return;

        this.activeCount++;
        const { fn, resolve, reject } = this.queue.shift();

        try {
            await new Promise(r => setTimeout(r, this.delay));
            const result = await this.retry(fn);
            resolve(result);
        } catch (e) {
            reject(e);
        } finally {
            this.activeCount--;
            this.process();
        }
    }

    async retry(fn, retries = 3, backoff = 1000) {
        try {
            const result = await fn();
            // Si c'est une réponse Fetch, on vérifie le status 429
            if (result instanceof Response) {
                 if (result.status === 429) {
                     throw new Error('429');
                 }
            }
            return result;
        } catch (e) {
            if (e.message === '429' || e.name === 'TypeError') { // TypeError est souvent une erreur réseau
                if (retries > 0) {
                    await new Promise(r => setTimeout(r, backoff));
                    return this.retry(fn, retries - 1, backoff * 2);
                }
            }
            throw e;
        }
    }
}

const apiQueue = new RequestQueue();

document.addEventListener('alpine:init', () => {
    Alpine.data('watchlistPage', () => ({
        watchlist: [],
        enrichedWatchlist: [],
        subTab: 'movie', // Using subTab to avoid conflict with global app activeTab
        sortOrder: 'popularity',
        
        activePlatformFilters: [], 
        
        watchStatusFilter: 'unwatched',
        showServiceBar: false,
        userRegion: localStorage.getItem('userRegion') || 'FR',
        myPlatformIds: [], 
        userSelectedPlatforms: [], 

        availablePlatforms: [
            { id: 'netflix', logoUrl: 'https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456' },
            { id: 'prime', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Amazon_Prime_Video_logo_%282024%29.svg/1024px-Amazon_Prime_Video_logo_%282024%29.svg.png' },
            { id: 'disney', logoUrl: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/25357066/Disney__Logo_March_2024.png?quality=90&strip=all&crop=0,0,100,100' },
            { id: 'apple', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/AppleTVLogo.svg/768px-AppleTVLogo.svg.png' },
            { id: 'canal', logoUrl: 'https://static1.purepeople.com/articles/0/46/23/10/@/6655765-logo-de-la-chaine-canal-1200x0-2.png' },
            { id: 'paramount', logoUrl: 'https://images.seeklogo.com/logo-png/39/1/paramount-logo-png_seeklogo-397501.png' },
            { id: 'max', logoUrl: 'https://logo.clearbit.com/max.com' },
            { id: 'skygo', logoUrl: 'https://logo.clearbit.com/sky.com' },
            { id: 'now', logoUrl: 'https://logo.clearbit.com/nowtv.com' }
        ],

        async init() {
            this.loadWatchlist();
            // Flag logic moved to data binding in HTML

            this.myPlatformIds = getSafeLocalStorage('selectedPlatforms', []);

            this.userSelectedPlatforms = this.availablePlatforms.filter(p => 
                this.myPlatformIds.includes(p.id)
            );

            // TOUT COCHÉ PAR DÉFAUT (activePlatformFilters vide = TOUT)
            this.activePlatformFilters = [];

            await this.fetchAndEnrichWatchlist();
            
            this.$watch('subTab', () => this.renderMedia());
            this.$watch('watchStatusFilter', () => this.renderMedia());
            this.$watch('activePlatformFilters', () => this.renderMedia());

            window.addEventListener('pageshow', async () => {
                // Reload data from localStorage and re-enrich/re-render
                this.loadWatchlist();
                await this.fetchAndEnrichWatchlist();
                await this.renderMedia();
            });

            await this.renderMedia();

            // OFFLINE CACHING SYNC (Backfill existing items)
            if (navigator.onLine && window.offlineManager) {
                this.watchlist.forEach(item => {
                    // We simply add them to the queue. The manager handles concurrency.
                    // Ideally we check if it's already cached but the manager handles that efficiently enough (Network First)
                    // actually to save bandwidth on every load, maybe we shouldn't cache EVERYTHING every time.
                    // But requirement is "updates as soon as I have network".
                    // So let's rely on the fact that if user opens watchlist, they want it ready.
                    // To be safe, we can add a small check or just let it run in background slowly.
                    window.offlineManager.cacheMedia(item.id, item.type);
                });
            }
        },

        get isAllSelected() {
            return this.activePlatformFilters.length === 0;
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

            // Add watched items if not already in watchlist
            // We use a fake added_at date for sorting if needed, or just let it be null
            watchedMovies.forEach(id => {
                if (!watchlist.some(item => item.id === id)) {
                    watchlist.push({ id: id, type: 'movie', isWatched: true, added_at: new Date(0).toISOString() });
                }
            });

            watchedSeries.forEach(id => {
                if (!watchlist.some(item => item.id === id)) {
                    watchlist.push({ id: id, type: 'serie', isWatched: true, added_at: new Date(0).toISOString() });
                }
            });

            this.watchlist = watchlist;
        },
        getInternalPlatformId(tmdbName) { const lower = tmdbName.toLowerCase(); if (lower.includes('netflix')) return 'netflix'; if (lower.includes('amazon') || lower.includes('prime')) return 'prime'; if (lower.includes('disney')) return 'disney'; if (lower.includes('apple')) return 'apple'; if (lower.includes('canal')) return 'canal'; if (lower.includes('paramount')) return 'paramount'; if (lower.includes('max') || lower.includes('hbo')) return 'max'; if (lower.includes('sky')) return 'skygo'; if (lower.includes('now')) return 'now'; return 'other'; },

        getProvidersForItem(item) {
            if (!item.apiDetails || !item.apiDetails['watch/providers']) return [];
            const providersData = item.apiDetails['watch/providers'].results;
            let rawProviders = [];

            if (providersData[this.userRegion] && providersData[this.userRegion].flatrate) {
                rawProviders = [...providersData[this.userRegion].flatrate];
            }
            if (this.userRegion !== 'FR' && this.myPlatformIds.includes('canal')) {
                if (providersData['FR'] && providersData['FR'].flatrate) {
                    const canal = providersData['FR'].flatrate.find(p => p.provider_id === 392 || p.provider_name.includes('Canal'));
                    if (canal) rawProviders.push(canal);
                }
            }

            // Dédoublonnage via Set sur provider_id
            const unique = [];
            const seen = new Set();
            for (const p of rawProviders) {
                if (!seen.has(p.provider_id)) {
                    unique.push(p);
                    seen.add(p.provider_id);
                }
            }
            return unique;
        },

        async fetchAndEnrichWatchlist() {
            // 1. FAST INITIALIZATION (from Cache & Local Data)
            const watchlistWithMediaData = this.watchlist.map(item => {
                const media = (typeof mediaData !== 'undefined') ? mediaData.find(m => m.id === item.id) : null;
                // Merge local hardcoded data
                let enriched = { ...(media || {}), ...item, apiDetails: null };

                // Check LocalStorage Cache (ignoring expiration for instant display)
                let cachedDetails = null;
                if (item.type === 'movie') {
                    cachedDetails = this.getCachedData(`movie-details-${item.id}`, true);
                } else if (item.type === 'serie' || item.type === 'tv') {
                    const cacheKey = `series-details-${item.id}`;
                    cachedDetails = this.getCachedData(cacheKey, true);

                    // CACHE VALIDATION: Check if user watched episodes NOT in cache
                    // This fixes the issue where user watches new episodes in Detail view,
                    // but Watchlist uses old cache missing those episodes, causing "blocked" state.
                    if (cachedDetails && cachedDetails.seasons) {
                        const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
                        const seriesWatched = watchedEpisodes[item.id] || [];

                        // Collect all episode IDs known in cache
                        const cachedEpisodeIds = new Set();
                        cachedDetails.seasons.forEach(s => {
                            if (s.episodes) s.episodes.forEach(e => cachedEpisodeIds.add(e.id));
                        });

                        // If user watched an episode not in cache, force refresh
                        if (seriesWatched.some(id => !cachedEpisodeIds.has(id))) {
                            cachedDetails = null;
                            localStorage.removeItem(cacheKey); // Force fetch in step 2
                        }
                    }
                }

                if (cachedDetails) {
                    enriched.apiDetails = cachedDetails;
                    if (!enriched.title) enriched.title = cachedDetails.title || cachedDetails.name;
                    if (!enriched.posterUrl) enriched.posterUrl = cachedDetails.poster_path ? `https://image.tmdb.org/t/p/w500${cachedDetails.poster_path}` : 'https://placehold.co/300x450?text=No+Image';
                    if (!enriched.year) enriched.year = (cachedDetails.release_date || cachedDetails.first_air_date || '').split('-')[0];
                    if (!enriched.genres || enriched.genres.length === 0) enriched.genres = cachedDetails.genres ? cachedDetails.genres.map(g => g.name) : [];
                }
                 // Fallback defaults
                if (!enriched.type) enriched.type = 'movie';
                if (!enriched.posterUrl) enriched.posterUrl = 'https://placehold.co/300x450?text=No+Data';
                if (!enriched.title) enriched.title = `Unknown Title (${enriched.id})`;

                return enriched;
            });

            this.enrichedWatchlist = watchlistWithMediaData;
            this.renderMedia(); // Initial Fast Render

            // 2. BACKGROUND FETCH (Fresh Data)
            const itemsToFetch = this.enrichedWatchlist.filter(item => {
                const cacheKey = (item.type === 'movie') ? `movie-details-${item.id}` : `series-details-${item.id}`;
                return !this.getCachedData(cacheKey, false); // Fetch if expired/missing
            });

            if (itemsToFetch.length === 0) return;

            let renderTimeout;
            const triggerRender = () => {
                if (renderTimeout) clearTimeout(renderTimeout);
                renderTimeout = setTimeout(() => this.renderMedia(), 500);
            };

            itemsToFetch.forEach(async (item) => {
                 let details = null;
                 // Use existing type if known, otherwise try movie then series
                 if (item.type === 'serie' || item.type === 'tv') {
                     details = await this.fetchFullSeriesDetails(item.id);
                 } else if (item.type === 'movie') {
                     details = await this.fetchMovieDetails(item.id);
                 } else {
                     // Unknown type fallback logic
                     details = await this.fetchMovieDetails(item.id);
                     if (details) {
                         item.type = 'movie';
                     } else {
                         details = await this.fetchFullSeriesDetails(item.id);
                         if (details) item.type = 'serie';
                     }
                 }

                 if (details) {
                     const index = this.enrichedWatchlist.findIndex(i => i.id === item.id);
                     if (index !== -1) {
                         const updatedItem = this.enrichedWatchlist[index];
                         updatedItem.apiDetails = details;

                         // CORRECTION : Forcer la mise à jour si le titre est le fallback par défaut
                         if (updatedItem.title.startsWith("Unknown Title")) {
                             updatedItem.title = details.title || details.name;
                         }

                         updatedItem.posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : updatedItem.posterUrl;
                         updatedItem.year = (details.release_date || details.first_air_date || '').split('-')[0];
                         updatedItem.genres = details.genres ? details.genres.map(g => g.name) : [];
                         triggerRender();
                     }
                 } else {
                     // CORRECTION : Si l'API échoue (details = null), on flag l'erreur pour arrêter le chargement
                     const index = this.enrichedWatchlist.findIndex(i => i.id === item.id);
                     if (index !== -1) {
                         this.enrichedWatchlist[index].apiDetails = { error: true };
                         triggerRender();
                     }
                 }
            });
        },
        getCachedData(key, ignoreExpiration = false) {
            const cachedObj = getSafeLocalStorage(key, null);
            if (!cachedObj) return null;
            const { timestamp, data } = cachedObj;
            const isExpired = (new Date().getTime() - timestamp) > 24 * 60 * 60 * 1000;
            return (isExpired && !ignoreExpiration) ? null : data;
        },
        setCachedData(key, data) { const item = { timestamp: new Date().getTime(), data: data }; localStorage.setItem(key, JSON.stringify(item)); },

        async fetchMovieDetails(movieId) {
            const cacheKey = `movie-details-${movieId}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;
            try {
                const res = await apiQueue.add(() =>
                    fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`)
                );
                if (!res.ok) {
                    // Try to return stale data if available
                    return this.getCachedData(cacheKey, true) || null;
                }
                const data = await res.json();
                this.setCachedData(cacheKey, data);
                return data;
            } catch (e) {
                return this.getCachedData(cacheKey, true) || null;
            }
        },

        async fetchFullSeriesDetails(seriesId) {
            const cacheKey = `series-details-${seriesId}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;
            try {
                const seriesRes = await apiQueue.add(() =>
                    fetch(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`)
                );
                if (!seriesRes.ok) return this.getCachedData(cacheKey, true) || null;

                const seriesData = await seriesRes.json();

                // OPTIMIZATION: Check watched episodes to determine what to fetch
                const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
                const seriesWatched = watchedEpisodes[seriesId] || [];

                let seasonsToFetch = seriesData.seasons.filter(s => s.season_number > 0);

                // If NO episodes watched, only fetch Season 1
                if (seriesWatched.length === 0) {
                    seasonsToFetch = seasonsToFetch.filter(s => s.season_number === 1);
                }

                const seasonPromises = seasonsToFetch.map(season =>
                    apiQueue.add(() =>
                        fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${season.season_number}?api_key=${TMDB_API_KEY}`)
                            .then(res => res.ok ? res.json() : null)
                    )
                );

                const seasonsWithEpisodes = await Promise.all(seasonPromises);
                seriesData.seasons = seasonsWithEpisodes.filter(s => s);

                this.setCachedData(cacheKey, seriesData);
                return seriesData;
            } catch (e) {
                return this.getCachedData(cacheKey, true) || null;
            }
        },

        get filteredMedia() {
            const type = this.subTab === 'movie' ? 'movie' : 'serie';
            const watchedMovies = getSafeLocalStorage('watchedMovies', []);
            const watchedSeries = getSafeLocalStorage('watchedSeries', []);

            let filtered = this.enrichedWatchlist
                .map(item => {
                    if (!item.type && item.title) item.type = 'movie'; 
                    if (!item.type && item.name) item.type = 'serie';
                    const normalizedType = (item.type === 'tv') ? 'serie' : item.type;
                    const isWatched = (normalizedType === 'movie' && watchedMovies.includes(item.id)) ||
                                    (normalizedType === 'serie' && watchedSeries.includes(item.id));
                    const dynamicProviders = this.getProvidersForItem(item);
                    return { ...item, type: normalizedType, isWatched, dynamicProviders };
                })
                .filter(item => item && item.type === type);

            // Filter by selected platforms if any are selected (otherwise "All" shows everything)
            if (this.activePlatformFilters.length > 0) {
                filtered = filtered.filter(item => {
                    if (!item.dynamicProviders || item.dynamicProviders.length === 0) return false;
                    return item.dynamicProviders.some(p =>
                        this.activePlatformFilters.includes(this.getInternalPlatformId(p.provider_name))
                    );
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
        get sortLabel() { if (this.sortOrder === 'popularity') return 'Popularité'; if (this.sortOrder === 'release_date') return 'Date de sortie'; return 'Date d\'ajout'; },
        async renderMedia() {
            const container = document.getElementById('media-list');
            const emptyState = document.getElementById('empty-state');
            if (!container) return;
            let itemsToRender = [...this.filteredMedia];

            // Calculate "In Progress" status for sorting
            if (this.subTab === 'serie') {
                const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
                itemsToRender.forEach(item => {
                    const seriesWatched = watchedEpisodes[item.id] || [];
                    item._hasStarted = seriesWatched.length > 0;
                });
            }

            itemsToRender.sort((a, b) => {
                // 1. Primary Sort: Started Series First (Only for Series tab)
                if (this.subTab === 'serie') {
                    const aStarted = a._hasStarted || false;
                    const bStarted = b._hasStarted || false;
                    if (aStarted && !bStarted) return -1;
                    if (!aStarted && bStarted) return 1;
                }

                // 2. Secondary Sort: User Selection
                if (this.sortOrder === 'recently_added') {
                    return new Date(b.added_at) - new Date(a.added_at);
                } else if (this.sortOrder === 'release_date') {
                    const yearAStr = String(a.year || '');
                    const yearBStr = String(b.year || '');
                    const dateA = new Date(yearAStr.split(' - ')[0]);
                    const dateB = new Date(yearBStr.split(' - ')[0]);
                    return dateB - dateA;
                } else {
                    const imdbA = a.imdb === 'xx' || !a.imdb ? 0 : parseFloat(a.imdb);
                    const imdbB = b.imdb === 'xx' || !b.imdb ? 0 : parseFloat(b.imdb);
                    return imdbB - imdbA;
                }
            });

            if (itemsToRender.length === 0) { container.innerHTML = ''; if (emptyState) emptyState.classList.remove('hidden'); return; }
            if (emptyState) emptyState.classList.add('hidden');

            const mediaHTMLPromises = itemsToRender.map(item => this.createMediaItemHTML(item));
            const mediaHTML = await Promise.all(mediaHTMLPromises);
            container.innerHTML = mediaHTML.join('');

            // INITIALIZE ALPINE ON NEW CONTENT
            if (typeof Alpine !== 'undefined') {
                Alpine.initTree(container);
            }
        },
        async createMediaItemHTML(item) { if (item.type === 'movie') return this.createMovieItemHTML(item); if (item.type === 'serie') return this.createTVItemHTML(item); return ''; },
        createCheckButtonHTML(itemId, isWatched, type, extraAction = '') { const action = type === 'movie' ? `toggleMovieWatched(${itemId})` : `markEpisodeWatched(${itemId}, ${extraAction})`; const bgClass = isWatched ? 'bg-primary border-primary text-white' : 'bg-black/40 border-gray-600 text-gray-500 hover:text-white hover:border-gray-400'; return ` <button @click.prevent.stop="${action}" class="flex h-8 w-8 items-center justify-center rounded-full border transition-all ${bgClass} z-10 shrink-0 ml-2"> <span class="material-symbols-outlined text-[20px]">check</span> </button>`; },
        createPlatformIconsHTML(providers) {
            if (!providers || providers.length === 0) return '';
            // Show all icons available on user's platforms, regardless of the active filter
            // (The filter hides the card, but the card should show all valid icons)
            const myProviders = providers.filter(p => this.myPlatformIds.includes(this.getInternalPlatformId(p.provider_name)));
            if (myProviders.length === 0) return '';

            const renderedPlatforms = new Set();
            return myProviders.map(p => {
                const internalId = this.getInternalPlatformId(p.provider_name);
                if (renderedPlatforms.has(internalId)) return '';
                renderedPlatforms.add(internalId);

                const platformObj = this.availablePlatforms.find(ap => ap.id === internalId);
                const logo = platformObj ? platformObj.logoUrl : (p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : p.logoUrl);
                return `<img src="${logo}" alt="${p.provider_name}" class="h-4 w-4 rounded-sm object-cover bg-gray-800" title="${p.provider_name}">`;
            }).join('');
        },
        formatDuration(runtime) { if (!runtime) return ''; const h = Math.floor(runtime / 60); const m = runtime % 60; return `${h}h ${m}m`; },
        createMovieItemHTML(item) { const link = `film.html?id=${item.id}`; const durationStr = item.duration || (item.apiDetails?.runtime ? this.formatDuration(item.apiDetails.runtime) : 'N/A'); const genresStr = item.genres && item.genres.length > 0 ? item.genres[0] : 'Genre'; const metaLine = `${item.year} • ${genresStr} • ${durationStr}`; const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders); const availableLine = platformsHTML ? `<div class="mt-5 flex items-center gap-2 text-xs text-gray-400"> <span>Available on:</span> <div class="flex items-center gap-1">${platformsHTML}</div> </div>` : ''; const checkButton = this.createCheckButtonHTML(item.id, item.isWatched, 'movie'); return ` <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg"> <a href="${link}" class="w-24 flex-shrink-0 group"> <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden"> <img src="${item.posterUrl}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform"> ${item.isWatched ? '<div class="absolute inset-0 bg-black/40 flex items-center justify-center"><span class="material-symbols-outlined text-white">visibility</span></div>' : ''} </div> </a> <div class="flex-1 min-w-0"> <div class="flex justify-between items-start"> <a href="${link}" class="block pr-2"> <h3 class="font-bold text-lg text-white line-clamp-3 leading-tight">${item.title}</h3> </a> ${checkButton} </div> <p class="text-sm text-gray-400 mt-1">${metaLine}</p> ${availableLine} </div> </div>`; },
        createTVItemHTML(item) {
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const seriesWatchedEpisodes = new Set(watchedEpisodes[item.id] || []);
            const watchedCount = seriesWatchedEpisodes.size;

            // Use released count logic (exclude unreleased seasons)
            const totalEpisodes = this.getReleasedEpisodeCount(item.apiDetails);

            if (item.isWatched || (item.apiDetails && watchedCount > 0 && watchedCount >= totalEpisodes)) {
                 const checkButton = this.createCheckButtonHTML(item.id, true, 'serie', 'all');
                 return ` <div class="relative flex items-center gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg"> <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0"> <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden"> <img src="${item.posterUrl}" class="w-full h-full object-cover"> <div class="absolute inset-0 flex items-center justify-center bg-black/60"> <span class="material-symbols-outlined text-white">visibility</span> </div> </div> </a> <div class="flex-1 min-w-0"> <div class="flex justify-between items-start"> <h3 class="font-bold text-lg text-white line-clamp-3 leading-tight">${item.title}</h3> ${checkButton} </div> <p class="text-sm text-gray-400">${String(item.year).split(' - ')[0]} • ${item.genres[0]}</p> <p class="text-xs text-green-500 mt-2 font-medium">Série terminée</p> </div> </div>`;
            }

            // Fix: Check for API error to prevent crash in createInProgressTVItemHTML
            if (watchedCount > 0 && item.apiDetails && !item.apiDetails.error) {
                return this.createInProgressTVItemHTML(item, seriesWatchedEpisodes);
            }
            return this.createUnwatchedTVItemHTML(item);
        },
        getReleasedEpisodeCount(data) {
            if (!data || !data.seasons) return data ? data.number_of_episodes : 0;

            const today = new Date();
            let total = 0;

            data.seasons.forEach(season => {
                if (season.season_number === 0) return; // Skip specials
                if (!season.air_date) return; // Skip unreleased seasons without date

                const seasonDate = new Date(season.air_date);
                if (seasonDate > today) return; // Skip future seasons

                // Use detailed episodes if available for accuracy
                if (season.episodes && season.episodes.length > 0) {
                     season.episodes.forEach(ep => {
                         const epDate = ep.air_date ? new Date(ep.air_date) : seasonDate;
                         if (epDate <= today) total++;
                     });
                } else {
                    // Fallback to simple count if episodes not fetched
                    total += season.episode_count;
                }
            });

            return total;
        },
        createUnwatchedTVItemHTML(item) {
            // CORRECTION : Stopper le spinner et afficher une carte d'erreur si l'API a renvoyé null
            if (item.apiDetails && item.apiDetails.error) {
                 return `
                 <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                     <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0">
                         <div class="w-full aspect-[2/3] rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                             <span class="material-symbols-outlined text-gray-500">broken_image</span>
                         </div>
                     </a>
                     <div class="flex-1 min-w-0">
                         <a href="serie.html?id=${item.id}" class="block">
                             <h3 class="font-bold text-lg text-white leading-tight">Média indisponible</h3>
                         </a>
                         <p class="text-sm text-gray-500 mt-1">ID: ${item.id}</p>
                         <div class="mt-3 flex items-center gap-2 text-red-500 text-sm">
                             <span class="material-symbols-outlined text-base">error</span>
                             <span>Erreur réseau ou ID invalide</span>
                         </div>
                     </div>
                 </div>`;
            }

            if (!item.apiDetails || !item.apiDetails.seasons) {
                 const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
                 const startYear = String(item.year).split(' - ')[0];
                 return ` <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg"> <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0"> <img class="w-full aspect-[2/3] rounded-lg object-cover" src="${item.posterUrl}" alt="${item.title}"> </a> <div class="flex-1 min-w-0"> <div class="flex justify-between items-start"> <a href="serie.html?id=${item.id}" class="block"> <h3 class="font-bold text-lg text-white line-clamp-3 leading-tight">${item.title}</h3> </a> </div> <p class="text-sm text-gray-400 mt-1">${startYear}</p> <div class="mt-3 flex items-center gap-2 text-gray-500 text-sm"> <span class="material-symbols-outlined text-base animate-spin">progress_activity</span> <span>Chargement...</span> </div> </div> </div>`;
            }

            const firstSeason = item.apiDetails.seasons.find(s => s.season_number === 1);
            if (!firstSeason || !firstSeason.episodes || firstSeason.episodes.length === 0) return '';
            const firstEpisode = firstSeason.episodes.find(e => e.episode_number === 1);
            if (!firstEpisode) return '';
            const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
            const totalSeasons = item.apiDetails.number_of_seasons;
            const startYear = String(item.year).split(' - ')[0];
            const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"> <span>${totalSeasons} Saisons • ${startYear}</span> ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''} <div class="flex items-center gap-1">${platformsHTML}</div> </div>`;
            const checkButton = this.createCheckButtonHTML(item.id, false, 'tv', firstEpisode.id);
            return ` <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg"> <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0"> <img class="w-full aspect-[2/3] rounded-lg object-cover" src="${item.posterUrl}" alt="${item.title}"> </a> <div class="flex-1 min-w-0"> <div class="flex justify-between items-start"> <a href="serie.html?id=${item.id}" class="block"> <h3 class="font-bold text-lg text-white line-clamp-3 leading-tight">${item.title}</h3> </a> ${checkButton} </div> ${infoLine} <div class="mt-3"> <p class="text-xs font-semibold text-primary uppercase tracking-wide">Prochain épisode</p> <p class="text-sm font-medium text-gray-300 mt-0.5 truncate">S01 E01 - ${firstEpisode.name}</p> </div> </div> </div>`;
        },
        createInProgressTVItemHTML(item, seriesWatchedEpisodes) {
             let nextEpisode = null;
             let currentSeasonForProgress = null;

             // Safety check
             if (!item.apiDetails.seasons) return this.createUnwatchedTVItemHTML(item);

             const sortedSeasons = item.apiDetails.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);

             for (const season of sortedSeasons) {
                 const sortedEpisodes = season.episodes.sort((a, b) => a.episode_number - b.episode_number);
                 for (const episode of sortedEpisodes) {
                     if (!seriesWatchedEpisodes.has(episode.id)) {
                         nextEpisode = episode;
                         currentSeasonForProgress = season;
                         break;
                     }
                 }
                 if (nextEpisode) break;
             }

             if (!nextEpisode || !currentSeasonForProgress) return this.createUnwatchedTVItemHTML(item);

             const seasonEpisodeIds = new Set(currentSeasonForProgress.episodes.map(e => e.id));
             const seasonWatchedCount = [...seriesWatchedEpisodes].filter(id => seasonEpisodeIds.has(id)).length;
             const remainingInSeason = currentSeasonForProgress.episodes.length - seasonWatchedCount;
             const totalProgress = (seriesWatchedEpisodes.size / item.apiDetails.number_of_episodes) * 100;
             const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
             const totalSeasons = item.apiDetails.number_of_seasons;
             const startYear = String(item.year).split(' - ')[0];
             const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"> <span>${totalSeasons} Saisons • ${startYear}</span> ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''} <div class="flex items-center gap-1">${platformsHTML}</div> </div>`;
             const checkButton = this.createCheckButtonHTML(item.id, false, 'tv', nextEpisode.id);
             return ` <div class="relative p-4 hover:bg-white/5 transition-colors rounded-lg"> <div class="flex gap-4 pb-2"> <div class="w-24 flex-shrink-0"> <a href="serie.html?id=${item.id}"> <img alt="${item.title} cover" class="w-full aspect-[2/3] rounded-lg object-cover" src="${item.posterUrl}"> </a> </div> <div class="flex min-w-0 flex-1 flex-col"> <div class="flex justify-between items-start"> <a href="serie.html?id=${item.id}" class="block"> <h3 class="font-bold text-lg text-white line-clamp-3 leading-tight">${item.title}</h3> </a> ${checkButton} </div> ${infoLine} <div class="mt-3"> <p class="text-xs font-semibold text-primary uppercase tracking-wide"> S${this.formatEpisodeNumber(nextEpisode.season_number)} E${this.formatEpisodeNumber(nextEpisode.episode_number)} <span class="text-gray-500 normal-case font-normal ml-1">(${remainingInSeason} restants)</span> </p> <p class="text-sm font-medium text-gray-300 mt-0.5 truncate">${nextEpisode.name}</p> </div> </div> </div> <div class="absolute bottom-0 left-4 right-4 h-1 bg-gray-700 rounded-full overflow-hidden mb-2"> <div class="h-full bg-primary" style="width: ${totalProgress}%"></div> </div> </div>`;
        },
        formatEpisodeNumber(num) { return String(num).padStart(2, '0'); },
        async markEpisodeWatched(seriesId, episodeId) {
            if(!episodeId) return;
            let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            if (!watchedEpisodes[seriesId]) watchedEpisodes[seriesId] = [];
            const seriesIdNum = parseInt(seriesId, 10);
            if (!watchedEpisodes[seriesId].includes(episodeId)) {
                watchedEpisodes[seriesId].push(episodeId);
                localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

                // Update last watched timestamp for sorting
                let seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});
                seriesLastWatchedDate[seriesId] = Date.now();
                localStorage.setItem('seriesLastWatchedDate', JSON.stringify(seriesLastWatchedDate));
            }
            const item = this.enrichedWatchlist.find(i => i.id === seriesIdNum);
            const totalEpisodes = this.getReleasedEpisodeCount(item ? item.apiDetails : null);

            if (item && item.apiDetails && watchedEpisodes[seriesId].length >= totalEpisodes) {
                let watchedSeries = getSafeLocalStorage('watchedSeries', []);
                if (!watchedSeries.includes(seriesIdNum)) {
                    watchedSeries.push(seriesIdNum);
                    localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
                }
                item.isWatched = true;
            }
            await this.renderMedia();
        },
        async toggleMovieWatched(movieId) { let watchedMovies = getSafeLocalStorage('watchedMovies', []); const movieIdNum = parseInt(movieId, 10); if (watchedMovies.includes(movieIdNum)) { watchedMovies = watchedMovies.filter(id => id !== movieIdNum); } else { watchedMovies.push(movieIdNum); } localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies)); await this.renderMedia(); }
    }));
});
