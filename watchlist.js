
document.addEventListener('alpine:init', () => {
    Alpine.data('watchlistPage', () => ({
        watchlist: [],
        enrichedWatchlist: [],
        activeTab: 'tv', // 'movie' or 'tv'
        sortOrder: 'popularity',
        selectedPlatform: null,
        platforms: [],
        watchStatusFilter: 'all', // 'all', 'watched', 'unwatched'

        async init() {
            this.loadWatchlist();
            await this.fetchAndEnrichWatchlist();
            this.extractPlatforms(); // Keep for UI, but data comes from API

            this.$watch('activeTab', () => this.renderMedia());
            this.$watch('watchStatusFilter', () => this.renderMedia());
            this.$watch('selectedPlatform', () => this.renderMedia());

            await this.renderMedia();
            this.renderPlatformFilters();
        },

        loadWatchlist() {
            const savedList = localStorage.getItem('watchlist');
            this.watchlist = savedList ? JSON.parse(savedList) : [];
        },

        extractPlatforms() {
            const platformSet = new Set();
            this.enrichedWatchlist.forEach(item => {
                const providers = item.apiDetails?.providers || item.availableOn;
                if (providers) {
                    providers.forEach(p => {
                        const logoUrl = p.logo_path ? `https://image.tmdb.org/t/p/w500${p.logo_path}` : p.logoUrl;
                        const name = p.provider_name || p.name;
                        platformSet.add(JSON.stringify({ name, logoUrl }));
                    });
                }
            });
            this.platforms = Array.from(platformSet).map(p => JSON.parse(p));
        },

        async fetchAndEnrichWatchlist() {
            const watchlistWithMediaData = this.watchlist.map(item => {
                const media = mediaData.find(m => m.id === item.id);
                return { ...media, ...item, apiDetails: null };
            });

            const promises = watchlistWithMediaData.map(item => {
                if (!item) return Promise.resolve(null);
                if (item.type === 'serie') {
                    return this.fetchFullSeriesDetails(item.id);
                } else if (item.type === 'movie') {
                    return this.fetchMovieDetails(item.id);
                }
                return Promise.resolve(null);
            });

            const results = await Promise.all(promises);

            this.enrichedWatchlist = watchlistWithMediaData.map(item => {
                if (!item) return null;
                const details = results.find(d => d && d.id === item.id);
                if (details) {
                    item.apiDetails = details;
                }
                return item;
            }).filter(Boolean);
        },

        async fetchMovieDetails(movieId) {
            try {
                const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers&language=fr-FR`);
                if (!res.ok) return null;
                const data = await res.json();
                data.providers = data['watch/providers']?.results?.FR?.flatrate || [];
                return data;
            } catch (e) {
                return null;
            }
        },

        async fetchFullSeriesDetails(seriesId) {
            try {
                const seriesRes = await fetch(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers&language=fr-FR`);
                if (!seriesRes.ok) return null;
                const seriesData = await seriesRes.json();
                seriesData.providers = seriesData['watch/providers']?.results?.FR?.flatrate || [];

                const seasonPromises = seriesData.seasons
                    .filter(s => s.season_number > 0)
                    .map(season =>
                        fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=fr-FR`)
                        .then(res => res.ok ? res.json() : null)
                    );

                const seasonsWithEpisodes = await Promise.all(seasonPromises);
                seriesData.seasons = seasonsWithEpisodes.filter(s => s);
                return seriesData;
            } catch (e) {
                console.error(`Failed to fetch full details for series ${seriesId}:`, e);
                return null;
            }
        },

        renderPlatformFilters() {
            const container = document.getElementById('platform-filter');
            if (!container) return;

            container.innerHTML = ''; // Clear existing
            this.platforms.forEach((platform, index) => {
                const button = document.createElement('button');
                button.className = `z-${40 - index} h-8 w-8 rounded-full bg-cover bg-center ring-2 ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark transition-all hover:ring-primary`;
                button.style.backgroundImage = `url('${platform.logoUrl}')`;
                button.setAttribute('title', platform.name);

                if (this.selectedPlatform && this.selectedPlatform.name === platform.name) {
                    button.classList.add('ring-primary');
                } else {
                    button.classList.add('ring-transparent');
                }

                button.addEventListener('click', () => {
                    if (this.selectedPlatform && this.selectedPlatform.name === platform.name) {
                        this.selectedPlatform = null; // Deselect
                    } else {
                        this.selectedPlatform = platform;
                    }
                    this.renderPlatformFilters(); // Re-render to update styles
                });
                container.appendChild(button);
            });
        },

        get filteredMedia() {
            const type = this.activeTab === 'tv' ? 'serie' : 'movie';
            const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
            const watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];

            let filtered = this.enrichedWatchlist
                .map(item => {
                    const isWatched = (item.type === 'movie' && watchedMovies.includes(item.id)) ||
                                    (item.type === 'serie' && watchedSeries.includes(item.id));
                    return { ...item, isWatched };
                })
                .filter(item => item && item.type === type);

            if (this.selectedPlatform) {
                filtered = filtered.filter(item =>
                    item.availableOn && item.availableOn.some(p => p.name === this.selectedPlatform.name)
                );
            }

            if (this.watchStatusFilter === 'watched') {
                filtered = filtered.filter(item => item.isWatched);
            } else if (this.watchStatusFilter === 'unwatched') {
                filtered = filtered.filter(item => !item.isWatched);
            }

            return filtered;
        },

        setSort(order) {
            this.sortOrder = order;
            this.renderMedia();
        },

        get sortLabel() {
            if (this.sortOrder === 'popularity') return 'Popularité';
            if (this.sortOrder === 'release_date') return 'Date de sortie';
            return 'Date d\'ajout';
        },

        async renderMedia() {
            const container = document.getElementById('media-list');
            const emptyState = document.getElementById('empty-state');
            if (!container) return;

            let itemsToRender = [...this.filteredMedia];

            if (this.sortOrder === 'recently_added') {
                itemsToRender.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
            } else if (this.sortOrder === 'release_date') {
                itemsToRender.sort((a, b) => {
                    const dateA = new Date(a.year.split(' - ')[0]);
                    const dateB = new Date(b.year.split(' - ')[0]);
                    return dateB - dateA;
                });
            } else { // Popularity (default)
                 itemsToRender.sort((a, b) => {
                    const imdbA = a.imdb === 'xx' ? 0 : parseFloat(a.imdb);
                    const imdbB = b.imdb === 'xx' ? 0 : parseFloat(b.imdb);
                    return imdbB - imdbA;
                });
            }

            if (itemsToRender.length === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }

            emptyState.style.display = 'none';
            const mediaHTMLPromises = itemsToRender.map(item => this.createMediaItemHTML(item));
            const mediaHTML = await Promise.all(mediaHTMLPromises);
            container.innerHTML = mediaHTML.join('');
        },

        async createMediaItemHTML(item) {
            const isTV = item.type === 'serie';
            const link = isTV ? `serie.html?id=${item.id}` : `film.html?id=${item.id}`;
            const yearAndGenre = `${item.year} • ${item.genres[0]}`;

            const providers = item.apiDetails?.providers;
            const platformLogo = providers && providers.length > 0
                ? `<img src="https://image.tmdb.org/t/p/w500${providers[0].logo_path}" alt="${providers[0].provider_name}" class="h-4 w-4 rounded-sm">`
                : '';

            let overlayHTML = '';
            if (item.isWatched) {
                overlayHTML = `
                    <div class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60">
                        <div class="text-center">
                            <div class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
                                <svg fill="none" height="20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <p class="mt-1 text-xs font-semibold text-white">Watched</p>
                        </div>
                    </div>`;
            } else if (isTV && item.apiDetails) {
                const watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
                const seriesWatchedEpisodes = new Set(watchedEpisodes[item.id] || []);
                const watchedCount = seriesWatchedEpisodes.size;

                if (watchedCount > 0 && watchedCount < item.apiDetails.number_of_episodes) {
                    let nextEpisode = null;
                    const sortedSeasons = item.apiDetails.seasons
                        .filter(s => s.season_number > 0)
                        .sort((a, b) => a.season_number - b.season_number);

                    for (const season of sortedSeasons) {
                        const sortedEpisodes = season.episodes.sort((a, b) => a.episode_number - b.episode_number);
                        for (const episode of sortedEpisodes) {
                            if (!seriesWatchedEpisodes.has(episode.id)) {
                                nextEpisode = episode;
                                break;
                            }
                        }
                        if (nextEpisode) break;
                    }

                    if (nextEpisode) {
                        overlayHTML = `
                        <div class="absolute bottom-1 left-1 right-1 rounded bg-black/50 p-1 backdrop-blur-sm text-center">
                           <p class="text-[10px] font-semibold text-white">Next: S${this.formatEpisodeNumber(nextEpisode.season_number)}E${this.formatEpisodeNumber(nextEpisode.episode_number)}</p>
                        </div>`;
                    }
                }
            }

            return `
                <a href="${link}" class="flex items-center gap-4 p-4">
                    <div class="relative h-24 w-40 flex-shrink-0">
                        <div class="h-full w-full rounded-lg bg-cover bg-center" style="background-image: url('${item.posterUrl}');"></div>
                        ${overlayHTML}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                           ${platformLogo}
                           <p class="text-xs text-gray-500 dark:text-gray-400">${isTV ? 'TV Show' : 'Movie'}</p>
                        </div>
                        <h3 class="font-bold text-gray-900 dark:text-white mt-1">${item.title}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${yearAndGenre}</p>
                    </div>
                </a>
            `;
        },

        formatEpisodeNumber(num) {
            return String(num).padStart(2, '0');
        }
    }));
});
