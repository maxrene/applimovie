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
            if (result instanceof Response && (result.status === 429 || result.status >= 500)) {
                throw new Error(String(result.status));
            }
            return result;
        } catch (e) {
            if (retries > 0) {
                await new Promise(r => setTimeout(r, backoff));
                return this.retry(fn, retries - 1, backoff * 2);
            }
            throw e;
        }
    }
}

const apiQueue = new RequestQueue(5, 40);

// Cache mémoire de session pour éviter de parser le localStorage en boucle à chaque clic d'onglet
const memoryMediaCache = new Map();
// Déduplication des requêtes réseau en cours pour éviter les doublons lors des synchros Cloud
const inFlightFetches = new Map();

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
        selectedRatingFilter: '', // '' | 'love' | 'ok' | 'dislike' | 'unrated'
        maxDuration: 0, // 0 = tous, 100 = <1h40, 130 = <2h10
        randomPickItem: null,

        // Mode "Pitch Me" (Aide au choix du soir sous forme de deck de cartes)
        showPitchModal: false,
        pitchDeck: [],
        pitchIndex: 0,
        pitchFilterMyPlatforms: false,
        pitchFilterShort: false,
        pitchLoadingDetails: false,
        pitchShowTrailer: false,
        pitchCardAnim: '', // '' | 'swipe-left' | 'swipe-right'
        pitchTouchStartX: 0,
        pitchTouchStartY: 0,
        pitchRtVersion: 0,

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
                localStorage.getItem('userRatings') || '{}',
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
            this.$watch('watchStatusFilter', (val) => {
                if (val !== 'watched') this.selectedRatingFilter = '';
                this.renderMedia();
            });
            this.$watch('activePlatformFilters', () => this.renderMedia());
            this.$watch('selectedGenre', () => this.renderMedia());
            this.$watch('selectedRatingFilter', () => this.renderMedia());
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

            window.addEventListener('user-rating-changed', () => {
                this.lastStateSignature = this.computeStateSignature();
                this.renderMedia();
            });

            window.addEventListener('open-watched-to-rate', () => {
                this.watchStatusFilter = 'watched';
                this.renderMedia();
            });

            window.addEventListener('rt-rating-loaded', (e) => {
                if (!e.detail || !e.detail.rt) return;
                const { tmdbId, type, rt } = e.detail;
                const normType = (type === 'tv' || type === 'serie') ? 'tv' : 'movie';
                const slots = document.querySelectorAll(`[data-rt-slot="${normType}-${tmdbId}"]`);
                slots.forEach(slot => {
                    if (window.createRTBadgeHTML) {
                        slot.innerHTML = window.createRTBadgeHTML(rt, 'sm');
                    }
                });
                if (this.showPitchModal) {
                    this.pitchRtVersion++;
                }
            });

            await this.renderMedia();
        },

        get isAllSelected() {
            return this.activePlatformFilters.length === 0;
        },

        get hasActiveExtraFilters() {
            return Boolean(this.selectedGenre) || Boolean(this.selectedRatingFilter) || this.maxDuration > 0;
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
            this.selectedRatingFilter = '';
            this.maxDuration = 0;
            this.showFilterModal = false;
        },

        get unwatchedPoolForCurrentTab() {
            const type = this.subTab === 'movie' ? 'movie' : 'serie';
            const watchedMovies = getSafeLocalStorage('watchedMovies', []);
            const watchedSeries = getSafeLocalStorage('watchedSeries', []);
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});

            return this.enrichedWatchlist
                .map(item => {
                    if (!item.type && item.title) item.type = 'movie';
                    if (!item.type && item.name) item.type = 'serie';
                    const normalizedType = (item.type === 'tv') ? 'serie' : item.type;
                    let isWatched = false;
                    try {
                        if (normalizedType === 'movie') {
                            isWatched = watchedMovies.includes(Number(item.id));
                        } else if (item.apiDetails && !item.apiDetails.error) {
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
                    } catch (e) {
                        isWatched = false;
                    }
                    const dynamicProviders = this.getProvidersForItem(item);
                    return { ...item, type: normalizedType, isWatched, dynamicProviders };
                })
                .filter(item => item && item.type === type && !item.isWatched);
        },

        pickRandomMedia() {
            this.openPitchMe();
        },

        openPitchMe() {
            this.refreshUserPlatforms();
            this.pitchShowTrailer = false;
            this.pitchCardAnim = '';
            this.buildPitchDeck();
            this.showPitchModal = true;
        },

        closePitchMe() {
            this.pitchShowTrailer = false;
            this.showPitchModal = false;
        },

        togglePitchMyPlatforms() {
            this.pitchFilterMyPlatforms = !this.pitchFilterMyPlatforms;
            this.pitchShowTrailer = false;
            this.buildPitchDeck();
        },

        togglePitchShort() {
            this.pitchFilterShort = !this.pitchFilterShort;
            this.pitchShowTrailer = false;
            this.buildPitchDeck();
        },

        getUserTasteContext(targetType) {
            const normTarget = (targetType === 'tv' || targetType === 'serie') ? 'tv' : 'movie';
            const ratings = getSafeLocalStorage('userRatings', {});
            const genreWeights = {};
            const lovedByGenre = {};

            Object.values(ratings).forEach(entry => {
                if (!entry || typeof entry !== 'object') return;
                const entryType = (entry.type === 'tv' || entry.type === 'serie') ? 'tv' : 'movie';
                if (entryType !== normTarget) return;

                const weight = entry.rating === 'love' ? 3 : (entry.rating === 'ok' ? 1 : (entry.rating === 'dislike' ? -2 : 0));
                if (weight === 0) return;

                let genres = Array.isArray(entry.genres) ? [...entry.genres] : [];
                let title = entry.title || '';

                if (genres.length === 0 || !title) {
                    const cacheKey = normTarget === 'tv' ? `series-details-${entry.id}` : `movie-details-${entry.id}`;
                    const cached = memoryMediaCache.get(cacheKey) || this.getCachedData(cacheKey, true);
                    if (cached && !cached.error) {
                        if (!title) title = cached.title || cached.name || '';
                        if (genres.length === 0 && Array.isArray(cached.genres)) {
                            genres = cached.genres.map(g => (typeof g === 'string' ? g : g.name)).filter(Boolean);
                        }
                    }
                }

                genres.forEach(gName => {
                    const cleanName = typeof gName === 'string' ? gName : (gName?.name || '');
                    if (!cleanName) return;
                    genreWeights[cleanName] = (genreWeights[cleanName] || 0) + weight;
                    if (entry.rating === 'love' && title) {
                        if (!lovedByGenre[cleanName]) lovedByGenre[cleanName] = [];
                        if (!lovedByGenre[cleanName].includes(title)) {
                            lovedByGenre[cleanName].push(title);
                        }
                    }
                });
            });

            return { genreWeights, lovedByGenre };
        },

        buildPitchDeck() {
            const type = this.subTab === 'movie' ? 'movie' : 'serie';
            let pool = [...this.unwatchedPoolForCurrentTab];

            // Appliquer les filtres de la barre principale s'ils sont actifs
            if (this.activePlatformFilters.length > 0) {
                pool = pool.filter(item =>
                    Array.isArray(item.dynamicProviders) && item.dynamicProviders.some(p =>
                        this.activePlatformFilters.includes(this.getInternalPlatformId(p.provider_name, p.provider_id))
                    )
                );
            }

            if (this.selectedGenre) {
                pool = pool.filter(item =>
                    Array.isArray(item.genres) && item.genres.some(g => (typeof g === 'string' ? g : g.name) === this.selectedGenre)
                );
            }

            if (this.maxDuration > 0 && type === 'movie') {
                pool = pool.filter(item => {
                    const runtime = item.runtime || item.apiDetails?.runtime || 0;
                    return runtime > 0 && runtime <= this.maxDuration;
                });
            }

            // Appliquer les filtres rapides internes au mode Pitch Me
            if (this.pitchFilterMyPlatforms && this.myPlatformIds.length > 0) {
                pool = pool.filter(item =>
                    Array.isArray(item.dynamicProviders) && item.dynamicProviders.some(p =>
                        this.myPlatformIds.includes(this.getInternalPlatformId(p.provider_name, p.provider_id))
                    )
                );
            }

            if (this.pitchFilterShort && type === 'movie') {
                pool = pool.filter(item => {
                    const runtime = item.runtime || item.apiDetails?.runtime || 0;
                    return runtime > 0 && runtime <= 115;
                });
            }

            const { genreWeights } = this.getUserTasteContext(type);

            const scored = pool.map(item => {
                const itemGenres = (item.genres || []).map(g => (typeof g === 'string' ? g : g.name)).filter(Boolean);
                let tasteScore = 0;
                itemGenres.forEach(g => {
                    if (genreWeights[g]) tasteScore += genreWeights[g];
                });

                const isOnMyPlatforms = this.myPlatformIds.length > 0 && Array.isArray(item.dynamicProviders) &&
                    item.dynamicProviders.some(p => this.myPlatformIds.includes(this.getInternalPlatformId(p.provider_name, p.provider_id)));

                const imdbNum = parseFloat(item.imdb || item.apiDetails?.vote_average || 0) || 0;
                const priorityScore =
                    (isOnMyPlatforms ? 6 : 0) +
                    Math.max(-4, Math.min(10, tasteScore)) * 1.4 +
                    (imdbNum >= 7.5 ? 2 : 0) +
                    (Math.random() * 5.5);

                return { item, priorityScore };
            });

            scored.sort((a, b) => b.priorityScore - a.priorityScore);
            this.pitchDeck = scored.map(s => s.item);
            this.pitchIndex = 0;
            this.enrichActivePitchWindow();
        },

        async enrichPitchItem(item) {
            if (!item || !item.id) return;
            const isMovie = item.type === 'movie';
            const cacheKey = isMovie ? `movie-details-${item.id}` : `series-details-${item.id}`;
            const details = item.apiDetails || memoryMediaCache.get(cacheKey) || this.getCachedData(cacheKey, true);

            // Déclencher la récupération prioritaire Rotten Tomatoes / IMDb
            const normType = isMovie ? 'movie' : 'tv';
            if (window.fetchMediaRatings && details && !details.error) {
                window.fetchMediaRatings({
                    tmdbId: item.id,
                    type: normType,
                    imdbId: details.imdb_id || details.external_ids?.imdb_id || null,
                    wikidataId: details.external_ids?.wikidata_id || null,
                    title: item.title || details.title || details.name || '',
                    originalTitle: details.original_title || details.original_name || '',
                    year: String(item.year || '').split(' - ')[0],
                    priority: true
                });
            }

            // Si les crédits et vidéos sont déjà chargés, rien de plus à requêter
            if (details && !details.error && details.credits && details.videos) {
                return;
            }

            try {
                if (this.pitchDeck[this.pitchIndex] && Number(this.pitchDeck[this.pitchIndex].id) === Number(item.id)) {
                    this.pitchLoadingDetails = true;
                }
                const endpoint = isMovie ? `movie/${item.id}` : `tv/${item.id}`;
                const res = await apiQueue.add(
                    () => fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers,external_ids,credits,videos&include_video_language=fr,en,null`),
                    true
                );
                if (!res.ok) return;
                const fullData = await res.json();

                // Conserver les saisons déjà chargées si c'est une série
                if (!isMovie && details && Array.isArray(details.seasons)) {
                    fullData.seasons = details.seasons;
                }

                const compacted = this.setCachedData(cacheKey, fullData, isMovie);
                const hydrated = this.hydrateEnrichedItem(item, compacted);

                // Mettre à jour dans pitchDeck et enrichedWatchlist
                const deckIdx = this.pitchDeck.findIndex(i => Number(i.id) === Number(item.id));
                if (deckIdx !== -1) {
                    const dynamicProviders = this.getProvidersForItem(hydrated);
                    this.pitchDeck[deckIdx] = { ...hydrated, type: item.type, dynamicProviders };
                }
                const listIdx = this.enrichedWatchlist.findIndex(i => Number(i.id) === Number(item.id));
                if (listIdx !== -1) {
                    this.enrichedWatchlist[listIdx] = hydrated;
                }

                if (window.fetchMediaRatings) {
                    window.fetchMediaRatings({
                        tmdbId: item.id,
                        type: normType,
                        imdbId: compacted.imdb_id || compacted.external_ids?.imdb_id || null,
                        wikidataId: compacted.external_ids?.wikidata_id || null,
                        title: compacted.title || compacted.name || '',
                        originalTitle: compacted.original_title || compacted.original_name || '',
                        year: String(hydrated.year || '').split(' - ')[0],
                        priority: true
                    });
                }
            } catch (e) {
                console.warn('[PitchMe] Erreur enrichissement carte:', e);
            } finally {
                this.pitchLoadingDetails = false;
            }
        },

        enrichActivePitchWindow() {
            const current = this.pitchDeck[this.pitchIndex];
            const next = this.pitchDeck[this.pitchIndex + 1];
            if (current) this.enrichPitchItem(current);
            if (next) this.enrichPitchItem(next);
        },

        pitchNextCard() {
            if (this.pitchDeck.length === 0) return;
            this.pitchShowTrailer = false;
            this.pitchCardAnim = 'swipe-left';
            setTimeout(() => {
                if (this.pitchIndex < this.pitchDeck.length - 1) {
                    this.pitchIndex++;
                } else {
                    // Boucler avec un nouveau mélange intelligent
                    this.buildPitchDeck();
                }
                this.pitchCardAnim = '';
                this.enrichActivePitchWindow();
            }, 140);
        },

        pitchPrevCard() {
            if (this.pitchIndex <= 0) return;
            this.pitchShowTrailer = false;
            this.pitchCardAnim = 'swipe-right';
            setTimeout(() => {
                this.pitchIndex = Math.max(0, this.pitchIndex - 1);
                this.pitchCardAnim = '';
            }, 140);
        },

        handlePitchTouchStart(e) {
            if (!e.touches || e.touches.length === 0) return;
            this.pitchTouchStartX = e.touches[0].clientX;
            this.pitchTouchStartY = e.touches[0].clientY;
        },

        handlePitchTouchEnd(e) {
            if (!e.changedTouches || e.changedTouches.length === 0) return;
            const dx = e.changedTouches[0].clientX - this.pitchTouchStartX;
            const dy = e.changedTouches[0].clientY - this.pitchTouchStartY;
            if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                if (dx < 0) {
                    this.pitchNextCard();
                } else if (dx > 0 && this.pitchIndex > 0) {
                    this.pitchPrevCard();
                }
            }
        },

        get currentPitchCard() {
            // Dépendance réactive pour rafraîchir dès que Rotten Tomatoes arrive
            void this.pitchRtVersion;
            if (!this.pitchDeck || this.pitchDeck.length === 0) return null;
            const item = this.pitchDeck[this.pitchIndex];
            if (!item) return null;

            const isMovie = item.type === 'movie';
            const normType = isMovie ? 'movie' : 'tv';
            const details = item.apiDetails && !item.apiDetails.error ? item.apiDetails : {};

            const title = details.title || details.name || item.title || 'Sans titre';
            const year = String(item.year || details.release_date || details.first_air_date || '').split('-')[0].trim();
            const posterUrl = item.posterUrl || (details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://placehold.co/300x450?text=No+Image');
            const backdropUrl = details.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}`
                : posterUrl;

            const genres = (details.genres || item.genres || [])
                .map(g => (typeof g === 'string' ? g : g.name))
                .filter(Boolean)
                .slice(0, 3);

            const runtime = details.runtime || item.runtime || 0;
            const totalSeasons = details.number_of_seasons || (Array.isArray(details.seasons) ? details.seasons.length : 0);
            const durationLabel = isMovie
                ? (runtime > 0 ? this.formatDuration(runtime) : '')
                : (totalSeasons > 0 ? `${totalSeasons} Saison${totalSeasons > 1 ? 's' : ''}` : '');

            const cachedRatings = window.getCachedMediaRatings ? window.getCachedMediaRatings(item.id, normType) : null;
            const imdbScore = cachedRatings?.imdb || (details.vote_average ? Number(details.vote_average).toFixed(1) : (item.imdb && item.imdb !== '0' ? item.imdb : ''));
            const rtScore = cachedRatings?.rt || ((item.rottenTomatoes && item.rottenTomatoes !== 'xx' && item.rottenTomatoes !== 'N/A') ? item.rottenTomatoes : null);
            const rtIconUrl = rtScore && window.getRTIconUrl ? window.getRTIconUrl(rtScore) : 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg';

            // Plateformes disponibles
            const providers = item.dynamicProviders || this.getProvidersForItem(item);
            const myPlatforms = [];
            const otherPlatforms = [];
            const seenPlat = new Set();

            providers.forEach(p => {
                const internalId = this.getInternalPlatformId(p.provider_name, p.provider_id);
                const key = internalId !== 'other' ? internalId : p.provider_id;
                if (seenPlat.has(key)) return;
                seenPlat.add(key);

                const catObj = this.availablePlatforms.find(ap => ap.id === internalId);
                const platInfo = {
                    id: internalId,
                    name: catObj ? catObj.name : p.provider_name,
                    logoUrl: catObj ? catObj.logoUrl : (p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : '')
                };

                if (this.myPlatformIds.includes(internalId)) {
                    myPlatforms.push(platInfo);
                } else {
                    otherPlatforms.push(platInfo);
                }
            });

            // Réalisateur / Créateur & Casting
            let directorOrCreator = '';
            if (isMovie && details.credits && Array.isArray(details.credits.crew)) {
                const dirs = details.credits.crew.filter(c => c.job === 'Director').map(c => c.name);
                if (dirs.length > 0) directorOrCreator = dirs.slice(0, 2).join(', ');
            } else if (!isMovie && Array.isArray(details.created_by) && details.created_by.length > 0) {
                directorOrCreator = details.created_by.map(c => c.name).slice(0, 2).join(', ');
            }

            const castNames = (details.credits && Array.isArray(details.credits.cast))
                ? details.credits.cast.slice(0, 3).map(c => c.name).filter(Boolean)
                : [];

            // Bande-annonce YouTube
            let trailerKey = null;
            if (details.videos && Array.isArray(details.videos.results)) {
                const ytVideos = details.videos.results.filter(v => v.site === 'YouTube' && v.key);
                const trailer = ytVideos.find(v => v.type === 'Trailer') || ytVideos.find(v => v.type === 'Teaser') || ytVideos[0];
                if (trailer) trailerKey = trailer.key;
            }

            // Génération des arguments "Pourquoi ce soir ?" (Pitch Hooks)
            const { genreWeights, lovedByGenre } = this.getUserTasteContext(isMovie ? 'movie' : 'tv');
            const pitchPoints = [];

            // 1. Hook d'affinité avec les films/séries notés par l'utilisateur
            let matchedLovedTitle = null;
            let matchedLovedGenre = null;
            let bestPositiveGenre = null;
            for (const g of genres) {
                if (lovedByGenre[g] && lovedByGenre[g].length > 0 && !matchedLovedTitle) {
                    const candidates = lovedByGenre[g].filter(t => t.toLowerCase() !== title.toLowerCase());
                    if (candidates.length > 0) {
                        matchedLovedTitle = candidates[0];
                        matchedLovedGenre = g;
                    }
                }
                if ((genreWeights[g] || 0) > 0 && !bestPositiveGenre) {
                    bestPositiveGenre = g;
                }
            }

            if (matchedLovedTitle) {
                pitchPoints.push({
                    icon: 'favorite',
                    badgeClass: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
                    iconClass: 'text-pink-400 filled',
                    text: `Dans la veine de « ${matchedLovedTitle} » que vous avez adoré (${matchedLovedGenre})`
                });
            } else if (bestPositiveGenre) {
                pitchPoints.push({
                    icon: 'thumb_up',
                    badgeClass: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
                    iconClass: 'text-amber-400 filled',
                    text: `Pile dans vos goûts du moment : ${bestPositiveGenre}`
                });
            }

            // 2. Hook Format & Rythme pour la soirée
            if (isMovie && runtime > 0) {
                if (runtime <= 100) {
                    pitchPoints.push({
                        icon: 'bolt',
                        badgeClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
                        iconClass: 'text-emerald-400',
                        text: `Format court & intense (${durationLabel}) — idéal pour se lancer sans veiller tard`
                    });
                } else if (runtime <= 125) {
                    pitchPoints.push({
                        icon: 'schedule',
                        badgeClass: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
                        iconClass: 'text-sky-400',
                        text: `Format équilibré pour ce soir (${durationLabel})`
                    });
                } else {
                    pitchPoints.push({
                        icon: 'theaters',
                        badgeClass: 'bg-purple-500/15 text-purple-200 border-purple-500/30',
                        iconClass: 'text-purple-400',
                        text: `Grande fresque cinéma (${durationLabel}) pour une immersion totale`
                    });
                }
            } else if (!isMovie) {
                const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
                const epCount = (watchedEpisodes[item.id] || []).length;
                if (epCount > 0) {
                    pitchPoints.push({
                        icon: 'play_circle',
                        badgeClass: 'bg-primary/15 text-blue-200 border-primary/30',
                        iconClass: 'text-primary filled',
                        text: `Série déjà commencée (${epCount} ép. vus) — prête à reprendre ce soir`
                    });
                } else if (totalSeasons === 1) {
                    pitchPoints.push({
                        icon: 'bolt',
                        badgeClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
                        iconClass: 'text-emerald-400',
                        text: `Format court (1 seule saison) — parfait pour commencer sans s'engager sur 10 ans`
                    });
                } else if (totalSeasons > 1) {
                    pitchPoints.push({
                        icon: 'tv',
                        badgeClass: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
                        iconClass: 'text-sky-400',
                        text: `${totalSeasons} saisons disponibles — un univers riche où plonger`
                    });
                }
            }

            // 3. Hook Critique / Prestige
            const rtNumeric = rtScore ? parseInt(String(rtScore).replace(/[^0-9]/g, ''), 10) : 0;
            const imdbNumeric = parseFloat(imdbScore || '0') || 0;
            if (rtNumeric >= 85 || imdbNumeric >= 7.8) {
                const scoreMention = rtNumeric >= 85 && imdbNumeric >= 7.5
                    ? `${rtScore} sur Rotten Tomatoes • ${imdbScore}/10 IMDb`
                    : (rtNumeric >= 85 ? `${rtScore} d'avis positifs sur Rotten Tomatoes` : `Noté ${imdbScore}/10 sur IMDb`);
                pitchPoints.push({
                    icon: 'workspace_premium',
                    badgeClass: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30',
                    iconClass: 'text-yellow-400 filled',
                    text: `Valeur sûre plébiscitée (${scoreMention})`
                });
            }

            // 4. Hook Casting / Réalisation
            if (directorOrCreator || castNames.length > 0) {
                const parts = [];
                if (directorOrCreator) parts.push(`${isMovie ? 'Réalisé par' : 'Créé par'} ${directorOrCreator}`);
                if (castNames.length > 0) parts.push(`avec ${castNames.join(', ')}`);
                pitchPoints.push({
                    icon: 'movie_filter',
                    badgeClass: 'bg-white/5 text-gray-200 border-white/10',
                    iconClass: 'text-primary',
                    text: parts.join(' • ')
                });
            }

            const tagline = details.tagline && String(details.tagline).trim().length > 0
                ? String(details.tagline).trim()
                : '';

            const overview = details.overview && String(details.overview).trim().length > 0
                ? String(details.overview).trim()
                : (item.synopsis || 'Découvrez cette œuvre dès ce soir depuis votre liste.');

            return {
                id: item.id,
                type: isMovie ? 'movie' : 'serie',
                detailUrl: `${isMovie ? 'film.html' : 'serie.html'}?id=${item.id}`,
                title,
                year,
                posterUrl,
                backdropUrl,
                genres,
                durationLabel,
                imdbScore,
                rtScore,
                rtIconUrl,
                myPlatforms,
                otherPlatforms,
                tagline,
                overview,
                trailerKey,
                pitchPoints: pitchPoints.slice(0, 3)
            };
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

            const existingEnrichedMap = new Map(
                (this.enrichedWatchlist || [])
                    .filter(i => i && i.apiDetails && !i.apiDetails.error)
                    .map(i => [Number(i.id), i.apiDetails])
            );

            const watchlistWithMediaData = this.watchlist.map(item => {
                const media = (typeof mediaData !== 'undefined') ? mediaData.find(m => m.id === item.id) : null;
                let base = { ...(media || {}), ...item, apiDetails: null };

                const isMovie = base.type === 'movie';
                const cacheKey = isMovie ? `movie-details-${base.id}` : `series-details-${base.id}`;
                const cachedDetails =
                    existingEnrichedMap.get(Number(base.id)) ||
                    memoryMediaCache.get(cacheKey) ||
                    this.getCachedData(cacheKey, true);

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
                const cached = memoryMediaCache.get(cacheKey) || this.getCachedData(cacheKey, false);
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
                    if (!details) {
                        details = await this.fetchMovieDetails(item.id, isPriority);
                        if (details) item.type = 'movie';
                    }
                } else {
                    details = await this.fetchMovieDetails(item.id, isPriority);
                    if (!details) {
                        details = await this.fetchFullSeriesDetails(item.id, isPriority);
                        if (details) item.type = 'serie';
                    }
                }

                const index = this.enrichedWatchlist.findIndex(i => Number(i.id) === Number(item.id));
                if (index !== -1) {
                    if (details) {
                        this.enrichedWatchlist[index].type = item.type;
                        this.enrichedWatchlist[index] = this.hydrateEnrichedItem(this.enrichedWatchlist[index], details);
                    } else if (!this.enrichedWatchlist[index].apiDetails) {
                        this.enrichedWatchlist[index].apiDetails = { error: true };
                    }
                    triggerRender();
                }
            });
        },

        getCachedData(key, ignoreExpiration = false) {
            if (window.CineDB) {
                const fromDb = window.CineDB.getMediaSync(key, ignoreExpiration);
                if (fromDb && (fromDb.title || fromDb.name)) return fromDb;
            }
            try {
                const cached = localStorage.getItem(key);
                if (!cached) return null;
                const { timestamp, data } = JSON.parse(cached);
                if (!data || data.error || (!data.title && !data.name)) return null;
                const isExpired = (Date.now() - timestamp) > 7 * 24 * 60 * 60 * 1000;
                return (isExpired && !ignoreExpiration) ? null : data;
            } catch (e) {
                return null;
            }
        },

        setCachedData(key, rawData, isMovie = true) {
            let compacted = rawData;
            try {
                compacted = isMovie
                    ? (window.compactMovieForCache ? window.compactMovieForCache(rawData) : rawData)
                    : (window.compactSeriesForCache ? window.compactSeriesForCache(rawData) : rawData);
            } catch (e) {
                console.warn('[Watchlist] Erreur lors du compactage du cache:', e);
            }
            memoryMediaCache.set(key, compacted);
            if (window.CineDB) {
                window.CineDB.setMedia(key, compacted);
            } else {
                try {
                    const item = { timestamp: Date.now(), data: compacted };
                    localStorage.setItem(key, JSON.stringify(item));
                } catch (e) {}
            }
            return compacted;
        },

        async fetchMovieDetails(movieId, priority = false) {
            const cacheKey = `movie-details-${movieId}`;
            const cachedData = memoryMediaCache.get(cacheKey) || this.getCachedData(cacheKey);
            if (cachedData) return cachedData;

            if (inFlightFetches.has(cacheKey)) {
                return inFlightFetches.get(cacheKey);
            }

            const fetchPromise = (async () => {
                try {
                    const res = await apiQueue.add(
                        () => fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers,external_ids`),
                        priority
                    );
                    if (!res.ok) return this.getCachedData(cacheKey, true) || null;
                    const data = await res.json();
                    return this.setCachedData(cacheKey, data, true);
                } catch (e) {
                    return this.getCachedData(cacheKey, true) || null;
                } finally {
                    inFlightFetches.delete(cacheKey);
                }
            })();

            inFlightFetches.set(cacheKey, fetchPromise);
            return fetchPromise;
        },

        async fetchFullSeriesDetails(seriesId, priority = false) {
            const cacheKey = `series-details-${seriesId}`;
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const seriesWatched = watchedEpisodes[seriesId] || [];
            const cachedData = memoryMediaCache.get(cacheKey) || this.getCachedData(cacheKey);

            if (cachedData) {
                const today = new Date().toISOString().split('T')[0];
                const needsMoreSeasons = seriesWatched.length > 0 && Array.isArray(cachedData.seasons) &&
                    cachedData.seasons.some(s => s.season_number > 0 && (!s.air_date || s.air_date <= today) && !Array.isArray(s.episodes));
                if (!needsMoreSeasons) return cachedData;
            }

            const flightKey = `${cacheKey}-${seriesWatched.length > 0 ? 'full' : 'init'}`;
            if (inFlightFetches.has(flightKey)) {
                return inFlightFetches.get(flightKey);
            }

            const fetchPromise = (async () => {
                try {
                    // Pour une série non commencée (0 épisode vu), seule la saison 1 est nécessaire (~20 Ko au lieu de ~1.5 Mo).
                    // Pour une série en cours, on récupère les 12 premières saisons d'un coup, puis les éventuelles suivantes.
                    const initialSeasonsCount = seriesWatched.length > 0 ? 12 : 1;
                    const seasonsAppend = Array.from({ length: initialSeasonsCount }, (_, i) => `season/${i + 1}`).join(',');

                    let seriesRes = await apiQueue.add(
                        () => fetch(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers,external_ids,${seasonsAppend}`),
                        priority
                    );

                    // Fallback de sécurité si append_to_response échoue sur TMDB
                    if (!seriesRes.ok && seriesRes.status !== 404) {
                        seriesRes = await apiQueue.add(
                            () => fetch(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers,external_ids`),
                            priority
                        );
                    }

                    if (!seriesRes.ok) return this.getCachedData(cacheKey, true) || null;

                    const seriesData = await seriesRes.json();

                    // Injecter les épisodes directement dans seriesData.seasons à partir des clés season/X reçues
                    seriesData.seasons = (seriesData.seasons || [])
                        .filter(s => s && s.season_number > 0)
                        .map(s => {
                            const appendedSeason = seriesData[`season/${s.season_number}`];
                            if (appendedSeason && Array.isArray(appendedSeason.episodes)) {
                                return { ...s, episodes: appendedSeason.episodes };
                            }
                            return s;
                        });

                    // Si la série est en cours et possède plus de 12 saisons déjà diffusées, récupérer les saisons manquantes
                    if (seriesWatched.length > 0 && Array.isArray(seriesData.seasons)) {
                        const today = new Date().toISOString().split('T')[0];
                        const missingSeasons = seriesData.seasons.filter(s =>
                            s.season_number > 0 && (!s.air_date || s.air_date <= today) && !Array.isArray(s.episodes)
                        );
                        if (missingSeasons.length > 0) {
                            const extraSeasons = await Promise.all(
                                missingSeasons.map(s =>
                                    apiQueue.add(
                                        () => fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${s.season_number}?api_key=${TMDB_API_KEY}&language=fr-FR`)
                                            .then(r => r.ok ? r.json() : null)
                                            .catch(() => null),
                                        priority
                                    )
                                )
                            );
                            const extraMap = new Map(extraSeasons.filter(Boolean).map(s => [s.season_number, s.episodes]));
                            seriesData.seasons = seriesData.seasons.map(s =>
                                extraMap.has(s.season_number) ? { ...s, episodes: extraMap.get(s.season_number) } : s
                            );
                        }
                    }

                    return this.setCachedData(cacheKey, seriesData, false);
                } catch (e) {
                    console.warn(`[Watchlist] Erreur réseau sur la série ${seriesId}:`, e);
                    return this.getCachedData(cacheKey, true) || null;
                } finally {
                    inFlightFetches.delete(flightKey);
                }
            })();

            inFlightFetches.set(flightKey, fetchPromise);
            return fetchPromise;
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
                if (this.selectedRatingFilter) {
                    filtered = filtered.filter(item => {
                        const rEntry = window.getUserRating ? window.getUserRating(item.id, item.type) : null;
                        const rVal = rEntry ? rEntry.rating : null;
                        if (this.selectedRatingFilter === 'unrated') return !rVal;
                        return rVal === this.selectedRatingFilter;
                    });
                }
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

        createRatingBadgesHTML(item) {
            const normType = (item.type === 'tv' || item.type === 'serie') ? 'tv' : 'movie';
            const cachedRatings = window.getCachedMediaRatings ? window.getCachedMediaRatings(item.id, normType) : null;

            const starScore = cachedRatings?.imdb ||
                (item.apiDetails?.vote_average ? Number(item.apiDetails.vote_average).toFixed(1) : (item.imdb && item.imdb !== '0' ? item.imdb : ''));
            const rtScore = cachedRatings?.rt ||
                ((item.rottenTomatoes && item.rottenTomatoes !== 'xx' && item.rottenTomatoes !== 'N/A') ? item.rottenTomatoes : null);

            if (!rtScore && item.apiDetails && !item.apiDetails.error && window.fetchMediaRatings) {
                window.fetchMediaRatings({
                    tmdbId: item.id,
                    type: normType,
                    imdbId: item.apiDetails.imdb_id || item.apiDetails.external_ids?.imdb_id || null,
                    wikidataId: item.apiDetails.external_ids?.wikidata_id || null,
                    title: item.title || item.apiDetails.title || item.apiDetails.name || '',
                    originalTitle: item.apiDetails.original_title || item.apiDetails.original_name || '',
                    year: String(item.year || '').split(' - ')[0],
                    priority: false
                });
            }

            const starHTML = starScore
                ? `<span class="inline-flex items-center gap-0.5 text-yellow-500 text-xs font-semibold"><span class="material-symbols-outlined text-[12px] filled">star</span>${starScore}</span>`
                : '';
            const rtHTML = (rtScore && window.createRTBadgeHTML) ? window.createRTBadgeHTML(rtScore, 'sm') : '';

            return `<span class="inline-flex items-center gap-2 ml-1.5">${starHTML}<span data-rt-slot="${normType}-${item.id}" class="inline-flex items-center">${rtHTML}</span></span>`;
        },

        createUserRatingSelectorHTML(item) {
            if (!item.isWatched) return '';
            const normType = (item.type === 'tv' || item.type === 'serie') ? 'tv' : 'movie';
            const rEntry = window.getUserRating ? window.getUserRating(item.id, normType) : null;
            const activeRating = rEntry ? rEntry.rating : null;

            const buttons = [
                {
                    key: 'dislike',
                    label: 'Pas aimé',
                    icon: 'thumb_down',
                    activeClass: 'bg-red-500/20 text-red-400 border-red-500/50'
                },
                {
                    key: 'ok',
                    label: 'OK',
                    icon: 'thumb_up',
                    activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                },
                {
                    key: 'love',
                    label: 'Adoré',
                    icon: 'favorite',
                    activeClass: 'bg-pink-500/20 text-pink-400 border-pink-500/50'
                }
            ];

            const btnsHTML = buttons.map(b => {
                const isSelected = activeRating === b.key;
                const styleClass = isSelected
                    ? `${b.activeClass} font-bold shadow-sm`
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200 font-medium';
                const iconClass = isSelected ? 'filled' : '';
                return `<button @click.prevent.stop="setItemRating(${item.id}, '${normType}', '${b.key}')" title="${b.label}" class="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] transition-all active:scale-95 ${styleClass}"><span class="material-symbols-outlined text-[13px] ${iconClass}">${b.icon}</span><span>${b.label}</span></button>`;
            }).join('');

            return `<div class="mt-2.5 flex items-center gap-1.5 flex-wrap">${btnsHTML}</div>`;
        },

        setItemRating(mediaId, type, ratingVal) {
            if (!window.setUserRating) return;
            const normTargetType = (type === 'tv' || type === 'serie') ? 'serie' : 'movie';
            const item = this.enrichedWatchlist.find(
                i => Number(i.id) === Number(mediaId) && ((i.type === 'tv' || i.type === 'serie') ? 'serie' : 'movie') === normTargetType
            ) || this.enrichedWatchlist.find(i => Number(i.id) === Number(mediaId));
            const meta = item ? {
                title: item.title || '',
                genres: item.apiDetails?.genres || item.genres || []
            } : {};
            window.setUserRating(mediaId, type, ratingVal, meta);
            this.lastStateSignature = this.computeStateSignature();
            this.renderMedia();
        },

        createMovieItemHTML(item) {
            const link = `film.html?id=${item.id}`;
            const durationStr = item.duration || (item.apiDetails?.runtime ? this.formatDuration(item.apiDetails.runtime) : '');
            const genresStr = item.genres && item.genres.length > 0
                ? (typeof item.genres[0] === 'string' ? item.genres[0] : item.genres[0].name)
                : '';
            const parts = [item.year, genresStr, durationStr].filter(Boolean);
            const metaLine = parts.join(' • ');
            const ratingBadge = this.createRatingBadgesHTML(item);

            const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
            const availableLine = platformsHTML
                ? `<div class="mt-2.5 flex items-center gap-2 text-xs text-gray-400"><span>Disponible sur :</span><div class="flex items-center gap-1.5">${platformsHTML}</div></div>`
                : '';
            const userRatingLine = this.createUserRatingSelectorHTML(item);
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
                    ${userRatingLine}
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
                const userRatingLine = this.createUserRatingSelectorHTML({ ...item, isWatched: true, type: 'tv' });

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
                const ratingBadge = this.createRatingBadgesHTML(item);

                return `
                <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
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
                        <div class="flex items-center flex-wrap gap-2 text-xs text-gray-400 mt-1">
                            <span>${String(item.year || '').split(' - ')[0]}${genreText ? ' • ' + genreText : ''}</span>
                            ${ratingBadge}
                            ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}
                            <div class="flex items-center gap-1">${platformsHTML}</div>
                        </div>
                        <p class="text-xs ${textColorClass} mt-1.5 font-medium">${statusText}</p>
                        ${userRatingLine}
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
                const fallbackTitle = (item.title && item.title !== 'Chargement...') ? item.title : `Média indisponible (${item.id})`;
                return `
                <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                    <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0">
                        <div class="w-full aspect-[2/3] rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                            <span class="material-symbols-outlined text-gray-500">broken_image</span>
                        </div>
                    </a>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start gap-2">
                            <a href="serie.html?id=${item.id}" class="block">
                                <h3 class="font-bold text-base text-white leading-tight">${fallbackTitle}</h3>
                            </a>
                            <div class="flex items-center gap-1 shrink-0">
                                <button @click.prevent.stop="retryFetchItem(${item.id}, 'serie')" title="Réessayer le chargement" class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-600 text-gray-300 hover:text-white hover:border-primary transition-all">
                                    <span class="material-symbols-outlined text-[18px]">refresh</span>
                                </button>
                                ${removeButton}
                            </div>
                        </div>
                        <p class="text-xs text-gray-400 mt-2">Impossible de charger les détails pour le moment.</p>
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
            const ratingBadge = this.createRatingBadgesHTML(item);
            const infoLine = `<div class="flex items-center flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"><span>${totalSeasons} Saison${totalSeasons > 1 ? 's' : ''} • ${startYear}</span>${ratingBadge}${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}<div class="flex items-center gap-1">${platformsHTML}</div></div>`;
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
            const ratingBadge = this.createRatingBadgesHTML(item);
            const infoLine = `<div class="flex items-center flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"><span>${totalSeasons} Saison${totalSeasons > 1 ? 's' : ''} • ${startYear}</span>${ratingBadge}${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}<div class="flex items-center gap-1">${platformsHTML}</div></div>`;
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
                if (window.setUserRating) window.setUserRating(mediaIdNum, 'movie', null);
            } else {
                let watchedSeries = getSafeLocalStorage('watchedSeries', []);
                watchedSeries = watchedSeries.filter(id => Number(id) !== mediaIdNum);
                localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
                if (window.setUserRating) window.setUserRating(mediaIdNum, 'tv', null);

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
                if (window.setUserRating) window.setUserRating(seriesIdNum, 'tv', null);

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

            // Si la série vient d'être commencée et que seules les données de la saison 1 étaient chargées,
            // récupérer les saisons suivantes en arrière-plan.
            if (item && item.apiDetails && Array.isArray(item.apiDetails.seasons)) {
                const today = new Date().toISOString().split('T')[0];
                const hasMissingSeasons = item.apiDetails.seasons.some(
                    s => s.season_number > 0 && (!s.air_date || s.air_date <= today) && !Array.isArray(s.episodes)
                );
                if (hasMissingSeasons) {
                    this.fetchFullSeriesDetails(seriesIdNum, true).then(fullDetails => {
                        if (fullDetails) {
                            const idx = this.enrichedWatchlist.findIndex(i => Number(i.id) === seriesIdNum);
                            if (idx !== -1) {
                                this.enrichedWatchlist[idx] = this.hydrateEnrichedItem(this.enrichedWatchlist[idx], fullDetails);
                                this.renderMedia();
                            }
                        }
                    });
                }
            }
        },

        async retryFetchItem(mediaId, type = 'serie') {
            const idNum = Number(mediaId);
            const index = this.enrichedWatchlist.findIndex(i => Number(i.id) === idNum);
            if (index !== -1) {
                this.enrichedWatchlist[index].apiDetails = null;
                await this.renderMedia();
            }
            const details = (type === 'movie')
                ? await this.fetchMovieDetails(idNum, true)
                : await this.fetchFullSeriesDetails(idNum, true);
            if (details && index !== -1) {
                this.enrichedWatchlist[index] = this.hydrateEnrichedItem(this.enrichedWatchlist[index], details);
            } else if (index !== -1) {
                this.enrichedWatchlist[index].apiDetails = { error: true };
            }
            await this.renderMedia();
        },

        async toggleMovieWatched(movieId) {
            let watchedMovies = getSafeLocalStorage('watchedMovies', []);
            let watchlist = getSafeLocalStorage('watchlist', []);
            const movieIdNum = parseInt(movieId, 10);

            if (watchedMovies.includes(movieIdNum)) {
                watchedMovies = watchedMovies.filter(id => Number(id) !== movieIdNum);
                if (window.setUserRating) window.setUserRating(movieIdNum, 'movie', null);
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
