const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';

// Fonction globale pour les statuts
function getMediaStatusGlobal(id, type) {
    const watchedMovies = getSafeLocalStorage('watchedMovies', []);
    const watchedSeries = getSafeLocalStorage('watchedSeries', []);

    const isWatched = (type === 'movie' && watchedMovies.includes(Number(id))) ||
                      ((type === 'tv' || type === 'serie') && watchedSeries.includes(Number(id)));

    if (isWatched) return 'watched';

    const watchlist = getSafeLocalStorage('watchlist', []);
    const isInWatchlist = watchlist.some(item => Number(item.id) === Number(id));
    if (isInWatchlist) return 'watchlist';

    return null;
}

// Fonction globale pour cocher rapidement le prochain épisode depuis "Reprendre la lecture"
window.markNextEpisodeWatched = function (event, seriesId, episodeId, isLastReleasedEpisode) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const sIdStr = String(seriesId);
    const sIdNum = Number(seriesId);
    const epIdNum = Number(episodeId);

    const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    if (!Array.isArray(watchedEpisodes[sIdStr])) {
        watchedEpisodes[sIdStr] = [];
    }
    if (!watchedEpisodes[sIdStr].includes(epIdNum)) {
        watchedEpisodes[sIdStr].push(epIdNum);
    }
    localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

    const seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});
    seriesLastWatchedDate[sIdStr] = Date.now();
    localStorage.setItem('seriesLastWatchedDate', JSON.stringify(seriesLastWatchedDate));

    if (isLastReleasedEpisode) {
        let watchedSeries = getSafeLocalStorage('watchedSeries', []);
        if (!watchedSeries.includes(sIdNum)) {
            watchedSeries.push(sIdNum);
            localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
        }
        let watchlist = getSafeLocalStorage('watchlist', []);
        watchlist = watchlist.filter(item => !(Number(item.id) === sIdNum && (item.type === 'tv' || item.type === 'serie')));
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
    }

    window.dispatchEvent(new CustomEvent('watchlist-updated'));
    window.dispatchEvent(new CustomEvent('view-changed', { detail: { tab: 'home' } }));
};

window.openWatchedListToRate = function (event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    window.dispatchEvent(new CustomEvent('open-watched-to-rate'));
};

// --- 1. LOGIQUE ALPINE.JS ---
document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        activeTab: 'home',
        userRegion: localStorage.getItem('userRegion') || 'FR',

        init() {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            if (tabParam && ['home', 'popular', 'search', 'watchlist'].includes(tabParam)) {
                this.switchTab(tabParam);
            }

            const refreshRegion = () => {
                this.userRegion = localStorage.getItem('userRegion') || 'FR';
                if (window.updateHeaderFlags) window.updateHeaderFlags();
            };

            window.addEventListener('cloud-data-synced', refreshRegion);
            window.addEventListener('region-changed', refreshRegion);
            window.addEventListener('pageshow', refreshRegion);
            window.addEventListener('focus', refreshRegion);
            window.addEventListener('storage', (e) => {
                if (!e.key || e.key === 'userRegion') refreshRegion();
            });

            window.addEventListener('open-watched-to-rate', () => {
                this.switchTab('watchlist');
            });
        },

        switchTab(tab) {
            this.activeTab = tab;
            this.userRegion = localStorage.getItem('userRegion') || 'FR';
            if (window.updateHeaderFlags) window.updateHeaderFlags();
            // Met à jour l'URL sans recharger la page pour garder l'onglet actif au retour arrière
            try {
                const url = new URL(window.location.href);
                if (tab === 'home') {
                    url.searchParams.delete('tab');
                } else {
                    url.searchParams.set('tab', tab);
                }
                window.history.replaceState({}, '', url.toString());
            } catch (e) {}

            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('view-changed', { detail: { tab: tab } }));
            }, 30);
        }
    }));

    Alpine.data('homePage', () => ({
        isLoading: false,
        isLoadingRecos: false,
        recoRefreshCycle: 0,
        lastUpdate: Date.now(),
        lastFetchedRegion: null,
        lastFetchedPlatforms: '',

        hasCatalogContextChanged() {
            const currentRegion = localStorage.getItem('userRegion') || 'FR';
            const currentPlatforms = localStorage.getItem('selectedPlatforms') || '[]';
            return this.lastFetchedRegion !== currentRegion || this.lastFetchedPlatforms !== currentPlatforms;
        },

        async init() {
            await this.fetchAndDisplayContent();

            window.addEventListener('view-changed', (e) => {
                if (!e.detail || e.detail.tab === 'home') {
                    if (this.hasCatalogContextChanged()) {
                        this.fetchAndDisplayContent();
                    } else {
                        this.updateMediaStatuses();
                        this.loadContinueWatching();
                        this.loadRecommendations(false);
                    }
                }
            });

            window.addEventListener('cloud-data-synced', () => {
                if (this.hasCatalogContextChanged()) {
                    this.fetchAndDisplayContent();
                } else {
                    this.updateMediaStatuses();
                    this.loadContinueWatching();
                    this.loadRecommendations(false);
                }
            });

            window.addEventListener('region-changed', () => {
                if (this.hasCatalogContextChanged()) {
                    this.fetchAndDisplayContent();
                }
            });

            window.addEventListener('user-rating-changed', () => {
                this.updateMediaStatuses();
                this.loadRecommendations(true);
            });

            window.addEventListener('pageshow', () => {
                if (this.hasCatalogContextChanged()) {
                    this.fetchAndDisplayContent();
                    return;
                }

                this.updateMediaStatuses();
                this.loadContinueWatching();
                this.loadRecommendations(false);

                const lastFetch = localStorage.getItem('lastHomeFetch');
                const now = Date.now();
                const twelveHours = 12 * 60 * 60 * 1000;

                if (!lastFetch || (now - parseInt(lastFetch) > twelveHours)) {
                    this.fetchAndDisplayContent();
                }
            });

            window.addEventListener('rt-rating-loaded', (e) => {
                if (!e.detail || !e.detail.rt) return;
                const { tmdbId, type, rt } = e.detail;
                const normType = (type === 'tv' || type === 'serie') ? 'tv' : 'movie';
                document.querySelectorAll(`#home-view [data-rt-slot="${normType}-${tmdbId}"]`).forEach(slot => {
                    if (window.createRTBadgeHTML) {
                        slot.innerHTML = window.createRTBadgeHTML(rt, 'xs');
                    }
                });
            });
        },

        async fetchAPI(endpoint, returnsList = true) {
            try {
                const separator = endpoint.includes('?') ? '&' : '?';
                const apiKey = window.TMDB_API_KEY || '';
                const region = localStorage.getItem('userRegion') || 'FR';
                const url = `${BASE_URL}/${endpoint}${separator}api_key=${apiKey}&watch_region=${region}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`API error: ${response.statusText}`);
                const data = await response.json();
                return returnsList ? (data.results || []) : data;
            } catch (error) {
                console.error(`Failed to fetch from ${endpoint}:`, error);
                return returnsList ? [] : null;
            }
        },

        createContinueWatchingCard(series, nextEpisode, progress, isLastReleasedEpisode) {
            const posterUrl = series.poster_path
                ? IMG_BASE_POSTER + series.poster_path
                : 'https://placehold.co/300x450?text=No+Image';
            const link = `serie.html?id=${series.id}`;

            const seasonCode = String(nextEpisode.season_number).padStart(2, '0');
            const episodeCode = String(nextEpisode.episode_number).padStart(2, '0');
            const nextEpisodeString = `S${seasonCode}E${episodeCode}${nextEpisode.name ? ' - ' + nextEpisode.name : ''}`;

            return `
                <div class="flex-shrink-0 w-32 snap-start group flex flex-col relative">
                    <a href="${link}" data-id="${series.id}" data-type="tv" class="flex flex-col media-card-link">
                        <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-md">
                            <img src="${posterUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                            <button
                                onclick="window.markNextEpisodeWatched(event, ${series.id}, ${nextEpisode.id}, ${Boolean(isLastReleasedEpisode)})"
                                title="Marquer S${seasonCode}E${episodeCode} comme vu"
                                class="absolute bottom-2.5 right-1.5 z-20 flex items-center gap-0.5 px-2 py-1 rounded-full bg-black/80 hover:bg-primary text-white text-[10px] font-bold border border-white/20 shadow-lg backdrop-blur-sm transition-colors active:scale-95">
                                <span class="material-symbols-outlined text-[13px]">check</span>
                                <span>S${seasonCode}E${episodeCode}</span>
                            </button>
                            <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-700/70 backdrop-blur-sm">
                                <div class="h-full bg-primary transition-all duration-300" style="width: ${Math.min(100, Math.max(0, progress))}%"></div>
                            </div>
                        </div>
                        <div class="mt-2">
                            <p class="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight">${series.name}</p>
                            <p class="text-[10px] font-semibold text-primary truncate leading-tight mt-0.5">${nextEpisodeString}</p>
                        </div>
                    </a>
                </div>
            `;
        },

        createMediaCard(media, cardType = 'platform') {
            const cardWidth = cardType === 'popular' ? 'w-36' : 'w-32';
            const posterRadius = 'rounded-lg';

            const isMovie = media.media_type === 'movie' || media.hasOwnProperty('title');
            const normType = isMovie ? 'movie' : 'tv';
            const title = isMovie ? media.title : media.name;
            const id = media.id;
            const posterPath = media.poster_path;

            const dateStr = isMovie ? media.release_date : media.first_air_date;
            let year = dateStr ? dateStr.split('-')[0] : '';

            if (!isMovie) {
                const seriesDatesCache = getSafeLocalStorage('seriesDatesCache', {});
                const cached = seriesDatesCache[id];
                if (cached) {
                    if (cached.status === 'Returning Series') {
                        year = `${cached.start} - Présent`;
                    } else if (cached.status === 'Ended') {
                        year = (cached.end && cached.start !== cached.end) ? `${cached.start} - ${cached.end}` : cached.start;
                    }
                }
            }

            if (!posterPath) return '';

            const link = isMovie ? `film.html?id=${id}` : `serie.html?id=${id}`;
            const posterUrl = IMG_BASE_POSTER + posterPath;

            const badgeHTML = !isMovie
                ? `<div class="absolute top-1 left-1 z-10 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider border border-white/10">TV</div>`
                : '';

            const status = getMediaStatusGlobal(id, normType);
            let statusIconHTML = '';
            if (status === 'watchlist') {
                statusIconHTML = `<span class="material-symbols-outlined text-primary text-base">bookmark</span>`;
            } else if (status === 'watched') {
                const ratingBadge = window.createUserRatingBadgeHTML ? window.createUserRatingBadgeHTML(id, normType, 'sm') : '';
                statusIconHTML = ratingBadge || `<span class="material-symbols-outlined text-green-500 text-base">visibility</span>`;
            }

            const cachedRatings = window.getCachedMediaRatings ? window.getCachedMediaRatings(id, normType) : null;
            const rtBadgeHTML = (cachedRatings?.rt && window.createRTBadgeHTML) ? window.createRTBadgeHTML(cachedRatings.rt, 'xs') : '';
            const recoReasonHTML = media._recoReason
                ? `<p class="text-[10px] font-semibold text-primary/90 truncate leading-tight mt-0.5">${media._recoReason}</p>`
                : '';

            return `
                <a href="${link}" data-id="${id}" data-type="${normType}" class="flex-shrink-0 ${cardWidth} snap-start group flex flex-col media-card-link">
                    <div class="relative w-full aspect-[2/3] ${posterRadius} overflow-hidden bg-gray-800 shadow-md">
                        <img src="${posterUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                        ${badgeHTML}
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                    </div>

                    <div class="flex justify-between items-start mt-2">
                        <p class="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight flex-1 pr-1">${title}</p>
                        <div class="status-container">${statusIconHTML}</div>
                    </div>

                    <div class="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
                        <span>${year}</span>
                        <span class="text-gray-400">•</span>
                        <div class="flex items-center gap-0.5 text-yellow-500">
                            <span class="material-symbols-outlined text-[10px] filled">star</span>
                            <span class="text-gray-600 dark:text-gray-300 font-medium">${media.vote_average ? media.vote_average.toFixed(1) : 'N/A'}</span>
                        </div>
                        <span data-rt-slot="${normType}-${id}" class="inline-flex items-center ml-0.5">${rtBadgeHTML}</span>
                    </div>
                    ${recoReasonHTML}
                </a>
            `;
        },

        renderContent(containerId, content, cardType = 'platform') {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = content.map(media => this.createMediaCard(media, cardType)).join('');

            // Enrichir en arrière-plan les notes Rotten Tomatoes des premières cartes visibles du carrousel
            if (window.fetchMediaRatings) {
                content.slice(0, 8).forEach(media => {
                    const isMovie = media.media_type === 'movie' || media.hasOwnProperty('title');
                    const normType = isMovie ? 'movie' : 'tv';
                    const cached = window.getCachedMediaRatings ? window.getCachedMediaRatings(media.id, normType) : null;
                    if (!cached || !cached.rt) {
                        window.fetchMediaRatings({
                            tmdbId: media.id,
                            type: normType,
                            title: isMovie ? media.title : media.name,
                            originalTitle: isMovie ? media.original_title : media.original_name,
                            year: (isMovie ? media.release_date : media.first_air_date) || '',
                            priority: false
                        });
                    }
                });
            }
        },

        async fetchSeriesForContinueWatching(id) {
            const cacheKey = `series-details-${id}`;
            if (window.CineDB) {
                const fromDb = window.CineDB.getMediaSync(cacheKey);
                if (fromDb && Array.isArray(fromDb.seasons) && fromDb.seasons.some(s => s.season_number > 0 && Array.isArray(s.episodes))) {
                    return fromDb;
                }
            }
            const cachedRaw = localStorage.getItem(cacheKey);
            const ONE_DAY = 24 * 60 * 60 * 1000;

            if (cachedRaw) {
                try {
                    const parsed = JSON.parse(cachedRaw);
                    const payload = parsed.data || parsed;
                    const isRecent = parsed.timestamp && (Date.now() - parsed.timestamp < ONE_DAY);
                    if (payload && Array.isArray(payload.seasons) && (isRecent || !navigator.onLine)) {
                        const hasSeasonEpisodes = payload.seasons.some(s => s.season_number > 0 && Array.isArray(s.episodes));
                        if (hasSeasonEpisodes) {
                            return payload;
                        }
                    }
                } catch (e) {}
            }

            const MAX_SEASONS_TO_APPEND = 12;
            const seasonsToAppend = Array.from({ length: MAX_SEASONS_TO_APPEND }, (_, i) => `season/${i + 1}`).join(',');
            const rawData = await this.fetchAPI(`tv/${id}?language=fr-FR&append_to_response=watch/providers,${seasonsToAppend}`, false);
            if (!rawData) return null;

            if (Array.isArray(rawData.seasons)) {
                rawData.seasons.forEach(s => {
                    if (s.season_number > 0 && rawData[`season/${s.season_number}`]?.episodes) {
                        s.episodes = rawData[`season/${s.season_number}`].episodes;
                    }
                });

                const today = new Date().toISOString().split('T')[0];
                const missingSeasons = rawData.seasons.filter(
                    s => s.season_number > MAX_SEASONS_TO_APPEND && (!s.air_date || s.air_date <= today) && !Array.isArray(s.episodes)
                );
                if (missingSeasons.length > 0) {
                    const extraSeasons = await Promise.all(
                        missingSeasons.map(s => this.fetchAPI(`tv/${id}/season/${s.season_number}?language=fr-FR`, false))
                    );
                    extraSeasons.filter(Boolean).forEach(extra => {
                        const target = rawData.seasons.find(s => s.season_number === extra.season_number);
                        if (target && Array.isArray(extra.episodes)) {
                            target.episodes = extra.episodes;
                        }
                    });
                }
            }

            const compacted = window.compactSeriesForCache ? window.compactSeriesForCache(rawData) : rawData;
            if (window.CineDB) {
                window.CineDB.setMedia(cacheKey, compacted);
            } else {
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: Date.now(),
                        data: compacted
                    }));
                } catch (e) {}
            }

            return compacted;
        },

        async loadContinueWatching() {
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const seriesIds = Object.keys(watchedEpisodes).filter(
                sId => Array.isArray(watchedEpisodes[sId]) && watchedEpisodes[sId].length > 0
            );

            const section = document.getElementById('continue-watching-section');
            if (seriesIds.length === 0) {
                if (section) section.style.display = 'none';
                return;
            }

            const results = await Promise.all(seriesIds.map(id => this.fetchSeriesForContinueWatching(id)));
            const seriesToDisplay = [];
            const today = new Date().toISOString().split('T')[0];

            for (const seriesDetails of results) {
                if (!seriesDetails) continue;

                const seriesIdStr = String(seriesDetails.id);
                const userWatchedEps = watchedEpisodes[seriesIdStr] || [];
                let totalReleasedEpisodes = 0;
                let watchedCount = 0;
                let nextEpisode = null;
                let remainingUnwatchedReleased = 0;

                const seasons = seriesDetails.seasons
                    ? [...seriesDetails.seasons].sort((a, b) => a.season_number - b.season_number)
                    : [];

                for (const season of seasons) {
                    if (season.season_number === 0) continue;

                    const episodes = season.episodes || seriesDetails[`season/${season.season_number}`]?.episodes;
                    if (!Array.isArray(episodes)) continue;

                    for (const episode of episodes) {
                        const isReleased = !episode.air_date || episode.air_date <= today;
                        const isWatched = userWatchedEps.includes(episode.id);

                        if (isReleased) {
                            totalReleasedEpisodes++;
                        }

                        if (isWatched) {
                            watchedCount++;
                        } else if (isReleased) {
                            remainingUnwatchedReleased++;
                            if (!nextEpisode) {
                                nextEpisode = {
                                    ...episode,
                                    season_number: episode.season_number || season.season_number
                                };
                            }
                        }
                    }
                }

                if (nextEpisode && totalReleasedEpisodes > 0) {
                    const progress = (watchedCount / totalReleasedEpisodes) * 100;
                    const isLastReleasedEpisode = remainingUnwatchedReleased === 1;
                    seriesToDisplay.push({
                        series: seriesDetails,
                        nextEpisode,
                        progress,
                        isLastReleasedEpisode
                    });
                }
            }

            const container = document.getElementById('continue-watching-container');

            if (seriesToDisplay.length > 0) {
                const seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});

                seriesToDisplay.sort((a, b) => {
                    const timeA = seriesLastWatchedDate[a.series.id] || 0;
                    const timeB = seriesLastWatchedDate[b.series.id] || 0;

                    if (timeA > 0 && timeB > 0) return timeB - timeA;
                    if (timeA > 0) return -1;
                    if (timeB > 0) return 1;

                    return b.progress - a.progress;
                });

                if (container) {
                    container.innerHTML = seriesToDisplay
                        .map(item => this.createContinueWatchingCard(item.series, item.nextEpisode, item.progress, item.isLastReleasedEpisode))
                        .join('');
                }
                if (section) section.style.display = 'block';
            } else {
                if (section) section.style.display = 'none';
            }
        },

        computeRecoSignature() {
            return [
                localStorage.getItem('userRatings') || '{}',
                localStorage.getItem('watchedMovies') || '[]',
                localStorage.getItem('watchedSeries') || '[]',
                localStorage.getItem('watchlist') || '[]',
                localStorage.getItem('selectedPlatforms') || '[]',
                localStorage.getItem('userRegion') || 'FR'
            ].join('|');
        },

        addCrossGenreWeight(genreId, weight, movieWeights, tvWeights) {
            const g = Number(genreId);
            if (!g) return;

            const addW = (map, id, w) => {
                map.set(id, (map.get(id) || 0) + w);
            };

            // Genres communs entre Film et Série TV sur TMDB
            const sharedIds = [16, 35, 80, 99, 18, 10751, 9648, 37];
            if (sharedIds.includes(g)) {
                addW(movieWeights, g, weight);
                addW(tvWeights, g, weight);
                return;
            }

            // Correspondances Film -> Série TV
            if (g === 28 || g === 12) {
                addW(movieWeights, g, weight);
                addW(tvWeights, 10759, weight); // Action & Adventure TV
            } else if (g === 878 || g === 14) {
                addW(movieWeights, g, weight);
                addW(tvWeights, 10765, weight); // Sci-Fi & Fantasy TV
            } else if (g === 10752) {
                addW(movieWeights, g, weight);
                addW(tvWeights, 10768, weight); // War & Politics TV
            } else if (g === 53 || g === 27) {
                addW(movieWeights, g, weight);
                addW(tvWeights, 9648, weight * 0.8); // Mystery TV
                addW(tvWeights, 80, weight * 0.6);   // Crime TV
            } else if (g === 36 || g === 10749 || g === 10402) {
                addW(movieWeights, g, weight);
                addW(tvWeights, 18, weight * 0.7);   // Drama TV
            }
            // Correspondances Série TV -> Film
            else if (g === 10759) {
                addW(tvWeights, g, weight);
                addW(movieWeights, 28, weight);
                addW(movieWeights, 12, weight * 0.8);
            } else if (g === 10765) {
                addW(tvWeights, g, weight);
                addW(movieWeights, 878, weight);
                addW(movieWeights, 14, weight * 0.8);
            } else if (g === 10768) {
                addW(tvWeights, g, weight);
                addW(movieWeights, 10752, weight);
                addW(movieWeights, 36, weight * 0.7);
            } else {
                addW(movieWeights, g, weight);
                addW(tvWeights, g, weight);
            }
        },

        async resolveItemMetadata(id, type) {
            const numId = Number(id);
            const normType = (type === 'tv' || type === 'serie') ? 'tv' : 'movie';
            const cacheKey = normType === 'tv' ? `series-details-${numId}` : `movie-details-${numId}`;
            const cineDbData = window.CineDB && window.CineDB.getMediaSync ? window.CineDB.getMediaSync(cacheKey, true) : null;
            const cachedRaw = cineDbData || getSafeLocalStorage(cacheKey, null);
            let details = cachedRaw ? (cachedRaw.data || cachedRaw) : null;

            if (!details || details.error || !Array.isArray(details.genres)) {
                const fetched = await this.fetchAPI(`${normType}/${numId}?language=fr-FR`, false);
                if (fetched && !fetched.error) {
                    details = fetched;
                }
            }

            if (!details) return { title: '', genreIds: [], genres: [] };
            const title = details.title || details.name || '';
            const extracted = window.extractGenreIdsAndNames
                ? window.extractGenreIdsAndNames(details.genres, details.genre_ids)
                : { genreIds: [], genres: [] };
            return { title, ...extracted };
        },

        isAvailableOnUserPlatforms(providersResults, allowedProviderIds, userSelectedPlatforms, region) {
            if (!providersResults) return false;
            if (userSelectedPlatforms.length === 0) return true;

            let flatrate = [];
            if (providersResults[region] && Array.isArray(providersResults[region].flatrate)) {
                flatrate = [...providersResults[region].flatrate];
            }
            if (region !== 'FR' && userSelectedPlatforms.includes('canal') && providersResults['FR']?.flatrate) {
                flatrate.push(...providersResults['FR'].flatrate.filter(
                    p => p.provider_id === 381 || p.provider_id === 392 || String(p.provider_name).toLowerCase().includes('canal')
                ));
            }

            return flatrate.some(p => {
                if (allowedProviderIds.has(Number(p.provider_id))) return true;
                if (window.getInternalPlatformId) {
                    const internalKey = window.getInternalPlatformId(p.provider_name, p.provider_id);
                    return userSelectedPlatforms.includes(internalKey);
                }
                return false;
            });
        },

        async loadRecommendations(forceRefresh = false) {
            const section = document.getElementById('recommendations-section');
            const container = document.getElementById('recommendations-container');
            const subtitleEl = document.getElementById('recommendations-subtitle');
            const tipEl = document.getElementById('recommendations-tip');
            if (!section || !container) return;

            const watchedMovies = getSafeLocalStorage('watchedMovies', []).map(Number).filter(Boolean);
            const watchedSeries = getSafeLocalStorage('watchedSeries', []).map(Number).filter(Boolean);
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const watchlist = getSafeLocalStorage('watchlist', []);
            const userRatingsRaw = getSafeLocalStorage('userRatings', {});
            const userSelectedPlatforms = getSafeLocalStorage('selectedPlatforms', []);
            const region = localStorage.getItem('userRegion') || 'FR';

            const ratingEntries = Object.entries(userRatingsRaw || {}).map(([key, val]) => {
                const parts = key.split('-');
                const inferredType = parts[0] === 'tv' || parts[0] === 'serie' ? 'tv' : 'movie';
                const inferredId = Number(parts[1] || val?.id || 0);
                if (typeof val === 'string') {
                    return { key, id: inferredId, type: inferredType, rating: val, genreIds: [], genres: [], title: '' };
                }
                return {
                    key,
                    id: Number(val.id || inferredId),
                    type: (val.type === 'tv' || val.type === 'serie') ? 'tv' : 'movie',
                    rating: val.rating,
                    title: val.title || '',
                    genreIds: Array.isArray(val.genreIds) ? val.genreIds : [],
                    genres: Array.isArray(val.genres) ? val.genres : [],
                    updatedAt: Number(val.updatedAt || 0)
                };
            }).filter(e => e.id && ['love', 'ok', 'dislike'].includes(e.rating));

            const totalWatchedCount = watchedMovies.length + watchedSeries.length;

            // Si aucun film/série vu et aucune note : afficher une carte d'accueil invitant à noter ses films/séries vus
            if (ratingEntries.length === 0 && totalWatchedCount === 0) {
                section.style.display = 'block';
                if (subtitleEl) subtitleEl.textContent = 'Notez vos films et séries vus (Pas aimé, OK, Adoré) pour activer vos recommandations';
                if (tipEl) {
                    tipEl.style.display = 'block';
                    tipEl.innerHTML = `
                        <div class="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
                            <div class="flex items-center gap-2.5">
                                <span class="material-symbols-outlined text-primary text-xl shrink-0">psychology</span>
                                <span>Marquez des films ou séries comme <b>Vus</b> puis indiquez <b>Pas aimé</b>, <b>OK</b> ou <b>Adoré</b> pour débloquer vos recommandations personnalisées sur vos plateformes.</span>
                            </div>
                        </div>
                    `;
                }
                container.innerHTML = '';
                return;
            }

            // Vérifier le cache de session si non forcé
            const currentSig = this.computeRecoSignature();
            if (!forceRefresh) {
                const cachedReco = getSafeLocalStorage('recoCacheV1', null);
                if (cachedReco && cachedReco.signature === currentSig && Array.isArray(cachedReco.items) && cachedReco.items.length > 0) {
                    const age = Date.now() - (cachedReco.timestamp || 0);
                    if (age < 30 * 60 * 1000) {
                        section.style.display = 'block';
                        if (subtitleEl) subtitleEl.textContent = cachedReco.subtitle || '';
                        if (tipEl) {
                            if (cachedReco.tipHTML) {
                                tipEl.style.display = 'block';
                                tipEl.innerHTML = cachedReco.tipHTML;
                            } else {
                                tipEl.style.display = 'none';
                            }
                        }
                        this.renderContent('recommendations-container', cachedReco.items, 'platform');
                        return;
                    }
                }
            } else {
                this.recoRefreshCycle = (this.recoRefreshCycle + 1) % 3;
            }

            this.isLoadingRecos = true;
            try {
                // 1. Enrichir les entrées notées qui n'ont pas encore leurs genres en cache
                let ratingsUpdated = false;
                const missingGenreEntries = ratingEntries.filter(e => !e.genreIds || e.genreIds.length === 0).slice(0, 6);
                if (missingGenreEntries.length > 0) {
                    await Promise.all(missingGenreEntries.map(async (entry) => {
                        const meta = await this.resolveItemMetadata(entry.id, entry.type);
                        if (meta.genreIds.length > 0 || meta.title) {
                            entry.genreIds = meta.genreIds;
                            entry.genres = meta.genres;
                            if (!entry.title) entry.title = meta.title;
                            if (userRatingsRaw[entry.key] && typeof userRatingsRaw[entry.key] === 'object') {
                                userRatingsRaw[entry.key].genreIds = meta.genreIds;
                                userRatingsRaw[entry.key].genres = meta.genres;
                                if (!userRatingsRaw[entry.key].title) userRatingsRaw[entry.key].title = meta.title;
                                ratingsUpdated = true;
                            }
                        }
                    }));
                    if (ratingsUpdated) {
                        localStorage.setItem('userRatings', JSON.stringify(userRatingsRaw));
                    }
                }

                const lovedItems = ratingEntries.filter(e => e.rating === 'love').sort((a, b) => b.updatedAt - a.updatedAt);
                const okItems = ratingEntries.filter(e => e.rating === 'ok').sort((a, b) => b.updatedAt - a.updatedAt);
                const dislikedItems = ratingEntries.filter(e => e.rating === 'dislike');
                const hasPositiveRatings = lovedItems.length > 0 || okItems.length > 0;

                // Fallback progressif : si l'utilisateur a des films/séries vus mais n'a pas encore voté "OK" ou "Adoré",
                // on s'appuie provisoirement sur ses derniers films/séries vus tout en l'invitant à les noter
                let fallbackSeeds = [];
                if (!hasPositiveRatings && totalWatchedCount > 0) {
                    const dislikedKeys = new Set(dislikedItems.map(d => `${d.type}-${d.id}`));
                    const sampleMovies = watchedMovies.slice(-4).reverse().map(id => ({ id, type: 'movie', rating: 'watched' }));
                    const sampleSeries = watchedSeries.slice(-3).reverse().map(id => ({ id, type: 'tv', rating: 'watched' }));
                    const candidates = [...sampleMovies, ...sampleSeries].filter(c => !dislikedKeys.has(`${c.type}-${c.id}`)).slice(0, 5);

                    fallbackSeeds = await Promise.all(candidates.map(async (c) => {
                        const meta = await this.resolveItemMetadata(c.id, c.type);
                        return { ...c, ...meta, weight: 1 };
                    }));
                }

                // 2. Calculer le profil d'affinité par genre (pondéré par Adoré = +3, OK = +1, Pas aimé = -2)
                const movieGenreWeights = new Map();
                const tvGenreWeights = new Map();

                ratingEntries.forEach(entry => {
                    const weight = entry.rating === 'love' ? 3 : (entry.rating === 'ok' ? 1 : -2);
                    (entry.genreIds || []).forEach(gId => {
                        this.addCrossGenreWeight(gId, weight, movieGenreWeights, tvGenreWeights);
                    });
                });

                fallbackSeeds.forEach(seed => {
                    (seed.genreIds || []).forEach(gId => {
                        this.addCrossGenreWeight(gId, 1, movieGenreWeights, tvGenreWeights);
                    });
                });

                const getSortedGenres = (weightMap, minScore = 0.5) =>
                    Array.from(weightMap.entries())
                        .filter(([, score]) => score >= minScore)
                        .sort((a, b) => b[1] - a[1])
                        .map(([id]) => id);

                const getDislikedGenres = (weightMap) =>
                    Array.from(weightMap.entries())
                        .filter(([, score]) => score <= -2)
                        .map(([id]) => id);

                const topMovieGenres = getSortedGenres(movieGenreWeights);
                const topTvGenres = getSortedGenres(tvGenreWeights);
                const dislikedMovieGenres = getDislikedGenres(movieGenreWeights);
                const dislikedTvGenres = getDislikedGenres(tvGenreWeights);

                // 3. Construire le filtre des plateformes de l'utilisateur
                const catalog = window.PLATFORMS_CATALOG || [];
                const allowedProviderIds = new Set();
                if (userSelectedPlatforms.length > 0) {
                    catalog.forEach(p => {
                        if (userSelectedPlatforms.includes(p.id)) {
                            (p.providerIds || [p.apiId]).forEach(pid => {
                                String(pid).split('|').forEach(sub => allowedProviderIds.add(Number(sub)));
                            });
                        }
                    });
                } else {
                    [8, 119, 337, 350, 381, 392, 531].forEach(pid => allowedProviderIds.add(pid));
                }
                const providerPipeStr = Array.from(allowedProviderIds).filter(Boolean).join('|');

                // 4. Sélectionner les œuvres "graines" (Seeds) pour les recommandations directes TMDB
                const allPositiveSeeds = [...lovedItems, ...okItems, ...fallbackSeeds];
                const seedPool = forceRefresh && allPositiveSeeds.length > 3
                    ? [...allPositiveSeeds].sort(() => Math.random() - 0.5)
                    : allPositiveSeeds;
                const activeSeeds = seedPool.slice(0, 3);

                const pageNum = (this.recoRefreshCycle % 2) + 1;
                const withoutMovieParam = dislikedMovieGenres.length > 0 ? `&without_genres=${dislikedMovieGenres.join(',')}` : '';
                const withoutTvParam = dislikedTvGenres.length > 0 ? `&without_genres=${dislikedTvGenres.join(',')}` : '';

                const movieGenreStrict = topMovieGenres.slice(0, 2).join(',');
                const movieGenreBroad = topMovieGenres.slice(0, 3).join('|');
                const tvGenreStrict = topTvGenres.slice(0, 2).join(',');
                const tvGenreBroad = topTvGenres.slice(0, 3).join('|');

                const discoverPromises = [];

                // Requêtes Films disponibles sur les plateformes de l'utilisateur
                if (movieGenreStrict) {
                    discoverPromises.push(
                        this.fetchAPI(`discover/movie?sort_by=popularity.desc&with_watch_providers=${providerPipeStr}&with_genres=${movieGenreStrict}${withoutMovieParam}&vote_count.gte=50&vote_average.gte=6.4&page=${pageNum}&language=fr-FR`)
                            .then(list => list.map(m => ({ ...m, media_type: 'movie', _fromDiscover: true })))
                    );
                }
                if (movieGenreBroad) {
                    discoverPromises.push(
                        this.fetchAPI(`discover/movie?sort_by=vote_average.desc&with_watch_providers=${providerPipeStr}&with_genres=${movieGenreBroad}${withoutMovieParam}&vote_count.gte=180&vote_average.gte=7.0&page=${pageNum}&language=fr-FR`)
                            .then(list => list.map(m => ({ ...m, media_type: 'movie', _fromDiscover: true })))
                    );
                } else {
                    discoverPromises.push(
                        this.fetchAPI(`discover/movie?sort_by=vote_average.desc&with_watch_providers=${providerPipeStr}${withoutMovieParam}&vote_count.gte=250&vote_average.gte=7.2&page=${pageNum}&language=fr-FR`)
                            .then(list => list.map(m => ({ ...m, media_type: 'movie', _fromDiscover: true })))
                    );
                }

                // Requêtes Séries disponibles sur les plateformes de l'utilisateur
                if (tvGenreStrict) {
                    discoverPromises.push(
                        this.fetchAPI(`discover/tv?sort_by=popularity.desc&with_watch_providers=${providerPipeStr}&with_genres=${tvGenreStrict}${withoutTvParam}&vote_count.gte=40&vote_average.gte=6.6&page=${pageNum}&language=fr-FR`)
                            .then(list => list.map(t => ({ ...t, media_type: 'tv', _fromDiscover: true })))
                    );
                }
                if (tvGenreBroad) {
                    discoverPromises.push(
                        this.fetchAPI(`discover/tv?sort_by=vote_average.desc&with_watch_providers=${providerPipeStr}&with_genres=${tvGenreBroad}${withoutTvParam}&vote_count.gte=120&vote_average.gte=7.2&page=${pageNum}&language=fr-FR`)
                            .then(list => list.map(t => ({ ...t, media_type: 'tv', _fromDiscover: true })))
                    );
                } else {
                    discoverPromises.push(
                        this.fetchAPI(`discover/tv?sort_by=vote_average.desc&with_watch_providers=${providerPipeStr}${withoutTvParam}&vote_count.gte=150&vote_average.gte=7.4&page=${pageNum}&language=fr-FR`)
                            .then(list => list.map(t => ({ ...t, media_type: 'tv', _fromDiscover: true })))
                    );
                }

                // Requêtes directes /recommendations à partir des films/séries adorés ou appréciés
                const seedPromises = activeSeeds.map(seed =>
                    this.fetchAPI(`${seed.type}/${seed.id}/recommendations?language=fr-FR`)
                        .then(list => (list || []).map(item => ({
                            ...item,
                            media_type: seed.type,
                            _seedTitle: seed.title,
                            _seedRating: seed.rating
                        })))
                );

                const [discoverLists, seedLists] = await Promise.all([
                    Promise.all(discoverPromises),
                    Promise.all(seedPromises)
                ]);

                // Ensemble des IDs à exclure (déjà vus, en cours, dans la watchlist ou déjà notés)
                const excludedKeys = new Set();
                watchedMovies.forEach(id => excludedKeys.add(`movie-${Number(id)}`));
                watchedSeries.forEach(id => excludedKeys.add(`tv-${Number(id)}`));
                Object.entries(watchedEpisodes || {}).forEach(([sId, eps]) => {
                    if (Array.isArray(eps) && eps.length > 0) excludedKeys.add(`tv-${Number(sId)}`);
                });
                watchlist.forEach(item => {
                    if (!item || !item.id) return;
                    const t = (item.type === 'tv' || item.type === 'serie') ? 'tv' : 'movie';
                    excludedKeys.add(`${t}-${Number(item.id)}`);
                });
                ratingEntries.forEach(e => excludedKeys.add(`${e.type}-${Number(e.id)}`));

                const candidateMap = new Map();
                const discoverConfirmedKeys = new Set();

                discoverLists.flat().forEach(item => {
                    if (!item || !item.id || !item.poster_path) return;
                    const key = `${item.media_type}-${item.id}`;
                    if (excludedKeys.has(key)) return;
                    discoverConfirmedKeys.add(key);
                    if (!candidateMap.has(key)) {
                        candidateMap.set(key, item);
                    }
                });

                // Vérifier la disponibilité sur les plateformes de l'utilisateur pour les meilleures recommandations directes (Seeds)
                const rawSeedCandidates = seedLists.flat().filter(item => {
                    if (!item || !item.id || !item.poster_path) return false;
                    return !excludedKeys.has(`${item.media_type}-${item.id}`);
                });

                const unverifiedSeeds = [];
                rawSeedCandidates.forEach(item => {
                    const key = `${item.media_type}-${item.id}`;
                    if (discoverConfirmedKeys.has(key)) {
                        const existing = candidateMap.get(key);
                        candidateMap.set(key, {
                            ...existing,
                            _seedTitle: item._seedTitle || existing._seedTitle,
                            _seedRating: item._seedRating || existing._seedRating
                        });
                    } else if (unverifiedSeeds.length < 10 && !unverifiedSeeds.some(u => `${u.media_type}-${u.id}` === key)) {
                        unverifiedSeeds.push(item);
                    }
                });

                if (unverifiedSeeds.length > 0) {
                    await Promise.all(unverifiedSeeds.map(async (item) => {
                        const key = `${item.media_type}-${item.id}`;
                        const cacheKey = item.media_type === 'tv' ? `series-details-${item.id}` : `movie-details-${item.id}`;
                        const cached = getSafeLocalStorage(cacheKey, null);
                        let providersResults = cached?.data?.['watch/providers']?.results || cached?.['watch/providers']?.results || null;

                        if (!providersResults) {
                            const provData = await this.fetchAPI(`${item.media_type}/${item.id}/watch/providers`, false);
                            providersResults = provData?.results || null;
                        }

                        if (this.isAvailableOnUserPlatforms(providersResults, allowedProviderIds, userSelectedPlatforms, region)) {
                            candidateMap.set(key, item);
                        }
                    }));
                }

                // 5. Scorer et classer tous les candidats selon le profil de goûts
                const scoredCandidates = [];
                candidateMap.forEach((item) => {
                    const isMovie = item.media_type === 'movie';
                    const weightMap = isMovie ? movieGenreWeights : tvGenreWeights;
                    const gIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];

                    let genreScore = 0;
                    let matchedPosGenres = [];

                    gIds.forEach(gid => {
                        const w = weightMap.get(Number(gid)) || 0;
                        genreScore += w;
                        if (w > 0) {
                            matchedPosGenres.push({
                                id: Number(gid),
                                weight: w,
                                name: window.TMDB_GENRE_LABELS_FR?.[Number(gid)] || ''
                            });
                        }
                    });

                    // Exclure les contenus dont les genres sont globalement rejetés par l'utilisateur
                    if (genreScore < 0 && item._seedRating !== 'love') return;

                    matchedPosGenres.sort((a, b) => b.weight - a.weight);

                    const synergyBonus = matchedPosGenres.length >= 2 ? 3.5 : 0;
                    const seedBonus = item._seedRating === 'love' ? 7 : (item._seedRating === 'ok' ? 3.5 : (item._seedTitle ? 2.5 : 0));
                    const voteAvg = Number(item.vote_average || 6.5);
                    const pop = Number(item.popularity || 10);
                    const qualityScore = (voteAvg - 6.0) * 1.6 + Math.min(2.5, Math.log10(pop + 1));
                    const jitter = forceRefresh ? (Math.random() * 2.2) : 0;

                    const totalScore = genreScore + synergyBonus + seedBonus + qualityScore + jitter;

                    // Construire l'étiquette explicative sous la carte
                    let recoReason = '';
                    if (item._seedTitle) {
                        const prefix = item._seedRating === 'love' ? '❤️ Comme' : '👍 Comme';
                        recoReason = `${prefix} ${item._seedTitle}`;
                    } else if (matchedPosGenres.length > 0) {
                        const genreLabels = matchedPosGenres.map(g => g.name).filter(Boolean).slice(0, 2);
                        if (genreLabels.length > 0) {
                            recoReason = `Style : ${genreLabels.join(' • ')}`;
                        }
                    }

                    scoredCandidates.push({
                        ...item,
                        _recoScore: totalScore,
                        _recoReason: recoReason
                    });
                });

                scoredCandidates.sort((a, b) => b._recoScore - a._recoScore);
                const finalRecos = scoredCandidates.slice(0, 20);

                // 6. Mettre à jour le sous-titre et l'éventuelle bannière de conseil
                const topGenreLabels = topMovieGenres
                    .slice(0, 3)
                    .map(id => window.TMDB_GENRE_LABELS_FR?.[id])
                    .filter(Boolean);

                const platformText = userSelectedPlatforms.length > 0
                    ? 'Dispo sur vos plateformes'
                    : 'Toutes plateformes';

                let subtitleText = '';
                if (hasPositiveRatings) {
                    const posCount = lovedItems.length + okItems.length;
                    const genreSummary = topGenreLabels.length > 0 ? ` (${topGenreLabels.join(', ')})` : '';
                    const posLabel = posCount === 1 ? 'Selon votre avis positif' : `Selon vos ${posCount} avis positifs`;
                    subtitleText = `${posLabel}${genreSummary} • ${platformText}`;
                } else {
                    subtitleText = `Selon votre historique de visionnage • ${platformText}`;
                }

                // Compter combien de films/séries vus ne sont pas encore notés
                const ratedKeysSet = new Set(ratingEntries.map(e => `${e.type}-${e.id}`));
                const unratedWatchedCount =
                    watchedMovies.filter(id => !ratedKeysSet.has(`movie-${id}`)).length +
                    watchedSeries.filter(id => !ratedKeysSet.has(`tv-${id}`)).length;

                let tipHTML = '';
                if (!hasPositiveRatings && unratedWatchedCount > 0) {
                    tipHTML = `
                        <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-primary/10 border border-primary/25 text-xs">
                            <div class="flex items-center gap-2 text-gray-200">
                                <span class="material-symbols-outlined text-primary text-lg shrink-0">tips_and_updates</span>
                                <span>Vous avez <b>${unratedWatchedCount} film${unratedWatchedCount > 1 ? 's' : ''}/série${unratedWatchedCount > 1 ? 's' : ''} vu${unratedWatchedCount > 1 ? 's' : ''}</b> non noté${unratedWatchedCount > 1 ? 's' : ''}. Notez-les (👎 / 👍 / ❤️) pour affiner ce carrousel !</span>
                            </div>
                            <button onclick="window.openWatchedListToRate(event)" class="px-3 py-1.5 rounded-lg bg-primary text-white font-bold text-[11px] shrink-0 hover:bg-primary/90 transition-colors active:scale-95">
                                Noter mes vus
                            </button>
                        </div>
                    `;
                }

                if (finalRecos.length > 0) {
                    if (subtitleEl) subtitleEl.textContent = subtitleText;
                    if (tipEl) {
                        if (tipHTML) {
                            tipEl.style.display = 'block';
                            tipEl.innerHTML = tipHTML;
                        } else {
                            tipEl.style.display = 'none';
                        }
                    }
                    this.renderContent('recommendations-container', finalRecos, 'platform');
                    section.style.display = 'block';

                    try {
                        localStorage.setItem('recoCacheV1', JSON.stringify({
                            timestamp: Date.now(),
                            signature: currentSig,
                            subtitle: subtitleText,
                            tipHTML,
                            items: finalRecos
                        }));
                    } catch (e) {}
                } else {
                    section.style.display = 'none';
                }
            } catch (err) {
                console.error('Erreur lors du calcul des recommandations :', err);
            } finally {
                this.isLoadingRecos = false;
            }
        },

        async fetchAndDisplayContent() {
            const currentRegion = localStorage.getItem('userRegion') || 'FR';
            const currentPlatformsRaw = localStorage.getItem('selectedPlatforms') || '[]';
            const feedCacheKey = `home-feed-v1-${currentRegion}-${currentPlatformsRaw}`;
            const cachedFeed = window.CineDB ? window.CineDB.getKVSync(feedCacheKey, null) : null;

            const platforms = [
                { key: 'netflix', id: '8', name: 'Netflix', containerId: 'netflix-container', sectionId: 'netflix-section' },
                { key: 'prime', id: '119', name: 'Prime Video', containerId: 'prime-video-container', sectionId: 'prime-video-section' },
                { key: 'apple', id: '350', name: 'Apple TV+', containerId: 'apple-tv-container', sectionId: 'apple-tv-section' },
                { key: 'disney', id: '337', name: 'Disney+', containerId: 'disney-plus-container', sectionId: 'disney-plus-section' },
                { key: 'canal', id: '381|392', name: 'Canal+', containerId: 'canal-plus-container', sectionId: 'canal-plus-section' },
                { key: 'paramount', id: '531', name: 'Paramount+', containerId: 'paramount-container', sectionId: 'paramount-section' }
            ];

            // Si un cache du catalogue existe en mémoire / IndexedDB, l'afficher en 0ms sans spinner bloquant
            if (cachedFeed && Array.isArray(cachedFeed.popular) && cachedFeed.popular.length > 0) {
                this.renderContent('popular-container', cachedFeed.popular, 'popular');
                if (cachedFeed.platforms) {
                    platforms.forEach(p => {
                        const sec = document.getElementById(p.sectionId);
                        const list = cachedFeed.platforms[p.key];
                        if (Array.isArray(list) && list.length > 0) {
                            this.renderContent(p.containerId, list, 'platform');
                            if (sec) sec.style.display = 'block';
                        } else if (sec) {
                            sec.style.display = 'none';
                        }
                    });
                }
                this.lastFetchedRegion = currentRegion;
                this.lastFetchedPlatforms = currentPlatformsRaw;
            } else {
                this.isLoading = true;
            }

            try {
                // Lance "Reprendre la lecture" et "Recommandations" sans bloquer le reste
                this.loadContinueWatching();
                this.loadRecommendations(false);

                const popularContent = await this.fetchAPI('trending/all/week?language=fr-FR');
                this.renderContent('popular-container', popularContent, 'popular');

                const favoriteActors = getSafeLocalStorage('favoriteActors', []);
                const favoriteActorsSection = document.getElementById('favorite-actors-section');

                if (favoriteActors.length > 0) {
                    const actorIds = favoriteActors.map(a => a.id).join('|');
                    const favoriteMovies = await this.fetchAPI(`discover/movie?with_people=${actorIds}&sort_by=release_date.desc&vote_count.gte=10&language=fr-FR`);

                    if (favoriteMovies && favoriteMovies.length > 0) {
                        this.renderContent('favorite-actors-container', favoriteMovies, 'platform');
                        if (favoriteActorsSection) favoriteActorsSection.style.display = 'block';
                    } else {
                        if (favoriteActorsSection) favoriteActorsSection.style.display = 'none';
                    }
                } else {
                    if (favoriteActorsSection) favoriteActorsSection.style.display = 'none';
                }

                const userSelectedPlatforms = getSafeLocalStorage('selectedPlatforms', []);
                const platformSnapshot = {};

                await Promise.all(platforms.map(async (platform) => {
                    const section = document.getElementById(platform.sectionId);
                    // Si l'utilisateur a personnalisé ses plateformes, masquer celles qu'il n'a pas sélectionnées
                    if (userSelectedPlatforms.length > 0 && !userSelectedPlatforms.includes(platform.key)) {
                        if (section) section.style.display = 'none';
                        return;
                    }

                    const [movies, series] = await Promise.all([
                        this.fetchAPI(`discover/movie?sort_by=popularity.desc&with_watch_providers=${platform.id}&language=fr-FR`),
                        this.fetchAPI(`discover/tv?sort_by=popularity.desc&with_watch_providers=${platform.id}&language=fr-FR`)
                    ]);

                    const combined = [...movies, ...series].sort((a, b) => b.popularity - a.popularity).slice(0, 20);
                    platformSnapshot[platform.key] = combined;
                    this.renderContent(platform.containerId, combined, 'platform');

                    if (section) {
                        section.style.display = combined.length > 0 ? 'block' : 'none';
                    }
                }));

                if (window.CineDB && popularContent && popularContent.length > 0) {
                    window.CineDB.setKV(feedCacheKey, {
                        popular: popularContent.slice(0, 20),
                        platforms: platformSnapshot
                    });
                }

                this.lastFetchedRegion = currentRegion;
                this.lastFetchedPlatforms = currentPlatformsRaw;
                localStorage.setItem('lastHomeFetch', Date.now());
            } finally {
                this.isLoading = false;
            }
        },

        updateMediaStatuses() {
            document.querySelectorAll('#home-view .media-card-link').forEach(card => {
                const id = Number(card.dataset.id);
                const type = card.dataset.type;
                const statusContainer = card.querySelector('.status-container');
                if (!statusContainer) return;

                const status = getMediaStatusGlobal(id, type);
                let statusIconHTML = '';
                if (status === 'watchlist') {
                    statusIconHTML = `<span class="material-symbols-outlined text-primary text-base">bookmark</span>`;
                } else if (status === 'watched') {
                    const ratingBadge = window.createUserRatingBadgeHTML ? window.createUserRatingBadgeHTML(id, type, 'sm') : '';
                    statusIconHTML = ratingBadge || `<span class="material-symbols-outlined text-green-500 text-base">visibility</span>`;
                }
                statusContainer.innerHTML = statusIconHTML;
            });
        }
    }));
});
