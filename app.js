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

                // Check if content is stale (> 12 hours)
                const lastFetch = localStorage.getItem('lastHomeFetch');
                const now = Date.now();
                const twelveHours = 12 * 60 * 60 * 1000;

                if (!lastFetch || (now - parseInt(lastFetch) > twelveHours)) {
                    this.fetchAndDisplayContent();
                }
            });
        },

        async fetchAPI(endpoint) {
            try {
                const separator = endpoint.includes('?') ? '&' : '?';
                const url = `${BASE_URL}/${endpoint}${separator}api_key=${TMDB_API_KEY}&watch_region=${this.userRegion || 'FR'}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`API error: ${response.statusText}`);
                const data = await response.json();
                return data.results;
            } catch (error) {
                console.error(`Failed to fetch from ${endpoint}:`, error);
                return [];
            }
        },

        createMediaCard(media, cardType = 'platform') {
            const cardWidth = cardType === 'popular' ? 'w-36' : 'w-32';
            const posterRadius = 'rounded-lg';

            const isMovie = media.media_type === 'movie' || media.hasOwnProperty('title');
            const title = isMovie ? media.title : media.name;
            const id = media.id;
            const posterPath = media.poster_path;

            const dateStr = isMovie ? media.release_date : media.first_air_date;
            const year = dateStr ? dateStr.split('-')[0] : '';

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

        async fetchAndDisplayContent() {
            this.isLoading = true;
            try {
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
