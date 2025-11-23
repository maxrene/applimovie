
document.addEventListener('alpine:init', () => {
    Alpine.data('myListPage', () => ({
        watchlist: [],
        enrichedWatchlist: [],
        activeTab: 'tv', // 'movie' or 'tv'
        sortOrder: 'popularity',
        selectedPlatform: null,
        platforms: [],
        watchStatusFilter: 'all', // 'all', 'watched', 'unwatched'

        async init() {
            this.loadWatchlist();
            this.extractPlatforms();
            await this.fetchSeriesDetails();

            this.$watch('activeTab', () => this.renderMedia());
            this.$watch('watchStatusFilter', () => this.renderMedia());
            this.$watch('selectedPlatform', () => this.renderMedia());

            this.renderMedia();
            this.renderPlatformFilters();
        },

        loadWatchlist() {
            const savedList = localStorage.getItem('watchlist');
            this.watchlist = savedList ? JSON.parse(savedList) : [];
        },

        extractPlatforms() {
            const platformSet = new Set();
            this.watchlist.forEach(item => {
                const media = mediaData.find(m => m.id === item.id);
                if (media && media.availableOn) {
                    media.availableOn.forEach(p => platformSet.add(JSON.stringify(p)));
                }
            });
            this.platforms = Array.from(platformSet).map(p => JSON.parse(p));
        },

        async fetchSeriesDetails() {
            const seriesOnWatchlist = this.watchlist
                .map(item => mediaData.find(m => m.id === item.id))
                .filter(item => item && item.type === 'serie');

            const promises = seriesOnWatchlist.map(series =>
                fetch(`https://api.themoviedb.org/3/tv/${series.id}?api_key=${TMDB_API_KEY}`)
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null)
            );

            const results = await Promise.all(promises);

            this.enrichedWatchlist = this.watchlist.map(item => {
                const media = mediaData.find(m => m.id === item.id);
                if (media && media.type === 'serie') {
                    const details = results.find(d => d && d.id === item.id);
                    return { ...media, ...item, seriesDetails: details };
                }
                return { ...media, ...item };
            });
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

        renderMedia() {
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
            container.innerHTML = itemsToRender.map(item => this.createMediaItemHTML(item)).join('');
        },

        createMediaItemHTML(item) {
            const isTV = item.type === 'serie';
            const link = isTV ? `serie.html?id=${item.id}` : `film.html?id=${item.id}`;
            const yearAndGenre = `${item.year} • ${item.genres[0]}`;

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
            } else if (isTV && item.seriesDetails) {
                const watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
                const seriesWatchedEpisodes = watchedEpisodes[item.id] || [];
                const watchedCount = seriesWatchedEpisodes.length;
                const totalEpisodes = item.seriesDetails.number_of_episodes;

                if (watchedCount > 0 && totalEpisodes > 0) {
                    const progress = (watchedCount / totalEpisodes) * 100;
                    const seasonText = item.seriesDetails.last_episode_to_air?.season_number ? `Season ${item.seriesDetails.last_episode_to_air.season_number} -` : '';
                    overlayHTML = `
                        <div class="absolute bottom-1 left-1 right-1 rounded bg-black/50 p-1 backdrop-blur-sm">
                            <div class="h-1 w-full rounded-full bg-gray-500/50">
                                <div class="h-1 rounded-full bg-primary" style="width: ${progress}%"></div>
                            </div>
                            <p class="mt-1 text-center text-[10px] font-semibold text-white">${seasonText} ${watchedCount}/${totalEpisodes} episodes</p>
                        </div>`;
                }
            }

            return `
                <a href="${link}" class="flex items-center gap-4 p-4">
                    <div class="relative h-24 w-40 flex-shrink-0">
                        <div class="h-full w-full rounded-lg bg-cover bg-center" style="background-image: url('${item.posterUrl}');"></div>
                        ${overlayHTML}
                    </div>
                    <div class="flex-1">
                        <p class="text-xs text-gray-500 dark:text-gray-400">${isTV ? 'TV Show' : 'Movie'}</p>
                        <h3 class="font-bold text-gray-900 dark:text-white">${item.title}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${yearAndGenre}</p>
                    </div>
                </a>
            `;
        }
    }));
});
