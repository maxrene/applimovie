
document.addEventListener('alpine:init', () => {
    Alpine.data('myListPage', () => ({
        watchlist: [],
        activeTab: 'tv', // 'movie' or 'tv'
        hideCompleted: false,
        hideWatched: false,
        sortOrder: 'popularity',
        selectedPlatform: null,
        platforms: [],

        init() {
            this.loadWatchlist();
            this.extractPlatforms();
            this.$watch('activeTab', () => this.renderMedia());
            this.$watch('hideCompleted', () => this.renderMedia());
            this.$watch('hideWatched', () => this.renderMedia());
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

            let filtered = this.watchlist
                .map(item => {
                    const media = mediaData.find(m => m.id === item.id);
                    if (!media) return null;
                    const isWatched = (media.type === 'movie' && watchedMovies.includes(media.id)) ||
                                    (media.type === 'serie' && watchedSeries.includes(media.id));
                    return { ...media, added_at: item.added_at, isWatched };
                })
                .filter(item => item && item.type === type);

            if (this.selectedPlatform) {
                filtered = filtered.filter(item =>
                    item.availableOn && item.availableOn.some(p => p.name === this.selectedPlatform.name)
                );
            }

            if (this.activeTab === 'tv' && this.hideCompleted) {
                filtered = filtered.filter(item => !item.isWatched);
            }

            if (this.activeTab === 'movie' && this.hideWatched) {
                filtered = filtered.filter(item => !item.isWatched);
            }

            return filtered;
        },

        sortMedia(order) {
            this.sortOrder = order;
            this.renderMedia();
        },

        renderMedia() {
            const container = document.getElementById('media-list');
            const emptyState = document.getElementById('empty-state');
            if (!container) return;

            let itemsToRender = [...this.filteredMedia];

            if (this.sortOrder === 'recently_added') {
                itemsToRender.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
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

            let watchedIconHTML = '';
            if (item.isWatched) {
                watchedIconHTML = `
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
            }

            return `
                <a href="${link}" class="flex items-center gap-4 p-4">
                    <div class="relative h-24 w-40 flex-shrink-0">
                        <div class="h-full w-full rounded-lg bg-cover bg-center" style="background-image: url('${item.posterUrl}');"></div>
                        ${watchedIconHTML}
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
