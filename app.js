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

            window.addEventListener('cloud-data-synced', () => {
                this.userRegion = localStorage.getItem('userRegion') || 'FR';
            });
        },

        switchTab(tab) {
            this.activeTab = tab;
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
        lastUpdate: Date.now(),

        async init() {
            await this.fetchAndDisplayContent();

            window.addEventListener('view-changed', (e) => {
                if (!e.detail || e.detail.tab === 'home') {
                    this.updateMediaStatuses();
                    this.loadContinueWatching();
                }
            });

            window.addEventListener('cloud-data-synced', () => {
                this.updateMediaStatuses();
                this.loadContinueWatching();
            });

            window.addEventListener('pageshow', () => {
                this.updateMediaStatuses();
                this.loadContinueWatching();

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
                statusIconHTML = `<span class="material-symbols-outlined text-green-500 text-base">visibility</span>`;
            }

            const cachedRatings = window.getCachedMediaRatings ? window.getCachedMediaRatings(id, normType) : null;
            const rtBadgeHTML = (cachedRatings?.rt && window.createRTBadgeHTML) ? window.createRTBadgeHTML(cachedRatings.rt, 'xs') : '';

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
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    data: compacted
                }));
            } catch (e) {}

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

        async fetchAndDisplayContent() {
            this.isLoading = true;
            try {
                // Lance "Reprendre la lecture" sans bloquer le reste
                this.loadContinueWatching();

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

                const platforms = [
                    { key: 'netflix', id: '8', name: 'Netflix', containerId: 'netflix-container', sectionId: 'netflix-section' },
                    { key: 'prime', id: '119', name: 'Prime Video', containerId: 'prime-video-container', sectionId: 'prime-video-section' },
                    { key: 'apple', id: '350', name: 'Apple TV+', containerId: 'apple-tv-container', sectionId: 'apple-tv-section' },
                    { key: 'disney', id: '337', name: 'Disney+', containerId: 'disney-plus-container', sectionId: 'disney-plus-section' },
                    { key: 'canal', id: '381|392', name: 'Canal+', containerId: 'canal-plus-container', sectionId: 'canal-plus-section' },
                    { key: 'paramount', id: '531', name: 'Paramount+', containerId: 'paramount-container', sectionId: 'paramount-section' }
                ];

                const userSelectedPlatforms = getSafeLocalStorage('selectedPlatforms', []);

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

                    const combined = [...movies, ...series].sort((a, b) => b.popularity - a.popularity);
                    this.renderContent(platform.containerId, combined.slice(0, 20), 'platform');

                    if (section) {
                        section.style.display = combined.length > 0 ? 'block' : 'none';
                    }
                }));

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
                    statusIconHTML = `<span class="material-symbols-outlined text-green-500 text-base">visibility</span>`;
                }
                statusContainer.innerHTML = statusIconHTML;
            });
        }
    }));
});
