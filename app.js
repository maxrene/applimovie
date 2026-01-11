// app.js

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';

// Global shared helper for media status
function getMediaStatusGlobal(id, type) {
    const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
    const watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];

    const isWatched = (type === 'movie' && watchedMovies.includes(Number(id))) ||
                      (type === 'tv' && watchedSeries.includes(Number(id))) ||
                      (type === 'serie' && watchedSeries.includes(Number(id)));

    if (isWatched) return 'watched';

    const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    const isInWatchlist = watchlist.some(item => item.id == id);
    if (isInWatchlist) return 'watchlist';

    return null;
}

document.addEventListener('alpine:init', () => {
    // -------------------------------------------------------------------------
    // APP SHELL
    // -------------------------------------------------------------------------
    Alpine.data('app', () => ({
        activeTab: 'home', // 'home' | 'popular' | 'search' | 'watchlist'
        userRegion: localStorage.getItem('userRegion') || 'FR',

        init() {
            // Restore tab from history state if needed or default to home
            // For now, simpler is better.
            // Flag logic moved to data binding in HTML
        },

        switchTab(tab) {
            this.activeTab = tab;
            // Dispatch event for components to refresh their data
            // Use setTimeout to allow x-show to toggle first if needed
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('view-changed', { detail: { tab: tab } }));
            }, 50);
        }
    }));

    // -------------------------------------------------------------------------
    // HOME PAGE LOGIC
    // -------------------------------------------------------------------------
    Alpine.data('homePage', () => ({
        isLoading: false,
        lastUpdate: Date.now(),

        async init() {
            // Initial Load
            await this.fetchAndDisplayContent();

            // SPA view change
            window.addEventListener('view-changed', (e) => {
                if (!e.detail || e.detail.tab === 'home') {
                    this.updateMediaStatuses();
                }
            });

            window.addEventListener('pageshow', () => {
                this.updateMediaStatuses();
                this.loadContinueWatching();

                // Check if content is stale (> 12 hours)
                const lastFetch = localStorage.getItem('lastHomeFetch');
                const now = Date.now();
                const twelveHours = 12 * 60 * 60 * 1000;

                if (!lastFetch || (now - parseInt(lastFetch) > twelveHours)) {
                    this.fetchAndDisplayContent();
                }
            });
        },

        async fetchAPI(endpoint, returnsList = true) {
            try {
                const separator = endpoint.includes('?') ? '&' : '?';
                const url = `${BASE_URL}/${endpoint}${separator}api_key=${TMDB_API_KEY}&watch_region=${this.userRegion || 'FR'}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`API error: ${response.statusText}`);
                const data = await response.json();
                return returnsList ? data.results : data;
            } catch (error) {
                console.error(`Failed to fetch from ${endpoint}:`, error);
                return returnsList ? [] : null;
            }
        },

        createContinueWatchingCard(series, nextEpisode, progress) {
            const posterUrl = IMG_BASE_POSTER + series.poster_path;
            const link = `serie.html?id=${series.id}`;

            const seasonCode = String(nextEpisode.season_number).padStart(2, '0');
            const episodeCode = String(nextEpisode.episode_number).padStart(2, '0');
            const nextEpisodeString = `S${seasonCode}E${episodeCode} - ${nextEpisode.name}`;

            return `
                <a href="${link}" data-id="${series.id}" data-type="tv" class="flex-shrink-0 w-32 snap-start group flex flex-col media-card-link">
                    <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-md">
                        <img src="${posterUrl}" loading="lazy" class="w-full h-full object-cover">
                        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50 backdrop-blur-sm">
                            <div class="h-full bg-primary" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <p class="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight">${series.name}</p>
                        <p class="text-[10px] font-semibold text-primary truncate leading-tight mt-0.5">${nextEpisodeString}</p>
                    </div>
                </a>
            `;
        },

        createMediaCard(media, cardType = 'platform') {
            const cardWidth = cardType === 'popular' ? 'w-36' : 'w-32';
            const posterRadius = 'rounded-lg';

            const isMovie = media.media_type === 'movie' || media.hasOwnProperty('title');
            const title = isMovie ? media.title : media.name;
            const id = media.id;
            const posterPath = media.poster_path;

            const dateStr = isMovie ? media.release_date : media.first_air_date;
            let year = dateStr ? dateStr.split('-')[0] : '';

            if (!isMovie) {
                const seriesDatesCache = JSON.parse(localStorage.getItem('seriesDatesCache')) || {};
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

            const status = getMediaStatusGlobal(id, isMovie ? 'movie' : 'tv');
            let statusIconHTML = '';
            if (status === 'watchlist') {
                statusIconHTML = `<span class="material-symbols-outlined text-primary text-base">bookmark</span>`;
            } else if (status === 'watched') {
                statusIconHTML = `<span class="material-symbols-outlined text-green-500 text-base">visibility</span>`;
            }

            return `
                <a href="${link}" data-id="${id}" data-type="${isMovie ? 'movie' : 'tv'}" class="flex-shrink-0 ${cardWidth} snap-start group flex flex-col media-card-link">
                    <div class="relative w-full aspect-[2/3] ${posterRadius} overflow-hidden bg-gray-800 shadow-md">
                        <img src="${posterUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                        ${badgeHTML}
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                    </div>

                    <div class="flex justify-between items-start mt-2">
                        <p class="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight flex-1 pr-1">${title}</p>
                        <div class="status-container">${statusIconHTML}</div>
                    </div>

                    <div class="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        <span>${year}</span>
                        <span class="text-gray-400">•</span>
                        <div class="flex items-center gap-0.5 text-yellow-500">
                            <span class="material-symbols-outlined text-[10px] filled">star</span>
                            <span class="text-gray-600 dark:text-gray-300 font-medium">${media.vote_average ? media.vote_average.toFixed(1) : 'N/A'}</span>
                        </div>
                    </div>
                </a>
            `;
        },

        renderContent(containerId, content, cardType = 'platform') {
            const container = document.getElementById(containerId);
            if(!container) return;
            container.innerHTML = content.map(media => this.createMediaCard(media, cardType)).join('');
        },

        async loadContinueWatching() {
            const watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
            const seriesInProgress = {};

            // 1. Group watched episodes by series ID
            // Format: { "seriesId": [episodeId1, episodeId2], ... }
            for (const seriesId in watchedEpisodes) {
                if (watchedEpisodes[seriesId] && watchedEpisodes[seriesId].length > 0) {
                    seriesInProgress[seriesId] = true;
                }
            }
            const seriesIds = Object.keys(seriesInProgress);

            if (seriesIds.length === 0) {
                document.getElementById('continue-watching-section').style.display = 'none';
                return;
            }

            // 2. Fetch all series data concurrently
            const MAX_SEASONS_TO_APPEND = 20;
            const seasonsToAppend = Array.from({ length: MAX_SEASONS_TO_APPEND }, (_, i) => `season/${i + 1}`).join(',');

            const promises = seriesIds.map(id =>
                this.fetchAPI(`tv/${id}?language=fr-FR&append_to_response=${seasonsToAppend}`, false)
            );
            const results = await Promise.all(promises);

            const seriesToDisplay = [];

            // 3. Process each fetched series
            for (const seriesDetails of results) {
                if (!seriesDetails) continue;

                const seriesIdStr = String(seriesDetails.id);
                let totalEpisodes = 0;
                let watchedCount = 0;
                let nextEpisode = null;
                let foundNext = false;

                const seasons = seriesDetails.seasons.sort((a, b) => a.season_number - b.season_number);

                for (const season of seasons) {
                    if (season.season_number === 0) continue;

                    const seasonDetail = seriesDetails[`season/${season.season_number}`];
                    if (!seasonDetail || !seasonDetail.episodes) continue;

                    totalEpisodes += seasonDetail.episodes.length;

                    for (const episode of seasonDetail.episodes) {
                        // Check if this episode ID is in the watched list for this series
                        const isWatched = watchedEpisodes[seriesIdStr] && watchedEpisodes[seriesIdStr].includes(episode.id);

                        if (isWatched) {
                            watchedCount++;
                        } else if (!foundNext) {
                            nextEpisode = episode;
                            foundNext = true;
                        }
                    }
                }

                if (nextEpisode) {
                    const progress = totalEpisodes > 0 ? (watchedCount / totalEpisodes) * 100 : 0;
                    seriesToDisplay.push({ series: seriesDetails, nextEpisode, progress });
                }
            }

            // 4. Render
            const container = document.getElementById('continue-watching-container');
            const section = document.getElementById('continue-watching-section');

            if (seriesToDisplay.length > 0) {
                seriesToDisplay.sort((a, b) => b.progress - a.progress);
                container.innerHTML = seriesToDisplay.map(item => this.createContinueWatchingCard(item.series, item.nextEpisode, item.progress)).join('');
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        },

        async fetchAndDisplayContent() {
            this.isLoading = true;
            try {
                // 0. Continue Watching
                this.loadContinueWatching();

                // 1. Fetch Popular
                const popularContent = await this.fetchAPI('trending/all/week?language=fr-FR');
                this.renderContent('popular-container', popularContent, 'popular');

                // 1b. Fetch Favorite Actors
                const favoriteActors = JSON.parse(localStorage.getItem('favoriteActors')) || [];
                const favoriteActorsSection = document.getElementById('favorite-actors-section');

                if (favoriteActors.length > 0) {
                    const actorIds = favoriteActors.map(a => a.id).join('|');
                    const favoriteMovies = await this.fetchAPI(`discover/movie?with_people=${actorIds}&sort_by=release_date.desc&vote_count.gte=10`);

                    if (favoriteMovies && favoriteMovies.length > 0) {
                        this.renderContent('favorite-actors-container', favoriteMovies, 'platform');
                        if(favoriteActorsSection) favoriteActorsSection.style.display = 'block';
                    } else {
                        if(favoriteActorsSection) favoriteActorsSection.style.display = 'none';
                    }
                } else {
                    if(favoriteActorsSection) favoriteActorsSection.style.display = 'none';
                }

                // 2. Fetch Platforms
                 const platforms = [
                    { id: 8, name: 'Netflix', containerId: 'netflix-container', sectionId: 'netflix-section' },
                    { id: 119, name: 'Prime Video', containerId: 'prime-video-container', sectionId: 'prime-video-section' },
                    { id: 350, name: 'Apple TV+', containerId: 'apple-tv-container', sectionId: 'apple-tv-section' },
                    { id: 337, name: 'Disney+', containerId: 'disney-plus-container', sectionId: 'disney-plus-section' },
                    { id: 392, name: 'Canal+', containerId: 'canal-plus-container', sectionId: 'canal-plus-section' },
                    { id: 531, name: 'Paramount+', containerId: 'paramount-container', sectionId: 'paramount-section' }
                ];

                for (const platform of platforms) {
                    const [movies, series] = await Promise.all([
                        this.fetchAPI(`discover/movie?sort_by=popularity.desc&with_watch_providers=${platform.id}`),
                        this.fetchAPI(`discover/tv?sort_by=popularity.desc&with_watch_providers=${platform.id}`)
                    ]);

                    let combined = [...movies, ...series];
                    combined.sort((a, b) => b.popularity - a.popularity);

                    this.renderContent(platform.containerId, combined.slice(0, 20), 'platform');

                    const section = document.getElementById(platform.sectionId);
                    if(section) {
                        section.style.display = combined.length > 0 ? 'block' : 'none';
                    }
                }
                localStorage.setItem('lastHomeFetch', Date.now());
            } finally {
                this.isLoading = false;
            }
        },

        updateMediaStatuses() {
            // Re-use logic for live update
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
