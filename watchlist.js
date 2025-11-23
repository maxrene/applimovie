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
            this.extractPlatforms();

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
                if (item.type === 'serie' || item.type === 'tv') { // Ensure compatibility
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

        getCachedData(key) {
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const { timestamp, data } = JSON.parse(cached);
            const isExpired = (new Date().getTime() - timestamp) > 24 * 60 * 60 * 1000;

            return isExpired ? null : data;
        },

        setCachedData(key, data) {
            const item = {
                timestamp: new Date().getTime(),
                data: data
            };
            localStorage.setItem(key, JSON.stringify(item));
        },

        async fetchMovieDetails(movieId) {
            const cacheKey = `movie-details-${movieId}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;

            try {
                const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers&language=fr-FR`);
                if (!res.ok) return null;
                const data = await res.json();
                data.providers = data['watch/providers']?.results?.FR?.flatrate || [];
                this.setCachedData(cacheKey, data);
                return data;
            } catch (e) {
                return null;
            }
        },

        async fetchFullSeriesDetails(seriesId) {
            const cacheKey = `series-details-${seriesId}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;

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

                this.setCachedData(cacheKey, seriesData);
                return seriesData;
            } catch (e) {
                console.error(`Failed to fetch full details for series ${seriesId}:`, e);
                return null;
            }
        },

        renderPlatformFilters() {
            const container = document.getElementById('platform-filter');
            if (!container) return;

            container.innerHTML = ''; 
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
                        this.selectedPlatform = null; 
                    } else {
                        this.selectedPlatform = platform;
                    }
                    this.renderPlatformFilters(); 
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
                    // Patch temporaire si le type manque
                    if (!item.type && item.title) item.type = 'movie'; 
                    if (!item.type && item.name) item.type = 'serie';

                    // Normalisation type serie/tv
                    const normalizedType = (item.type === 'tv') ? 'serie' : item.type;
                    
                    const isWatched = (normalizedType === 'movie' && watchedMovies.includes(item.id)) ||
                                    (normalizedType === 'serie' && watchedSeries.includes(item.id));
                    return { ...item, type: normalizedType, isWatched };
                })
                .filter(item => item && item.type === type);

            if (this.selectedPlatform) {
                filtered = filtered.filter(item =>
                    (item.availableOn && item.availableOn.some(p => p.name === this.selectedPlatform.name)) ||
                    (item.apiDetails?.providers && item.apiDetails.providers.some(p => p.provider_name === this.selectedPlatform.name))
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
                    // Gestion sécurisée de l'année
                    const yearAStr = String(a.year || '');
                    const yearBStr = String(b.year || '');
                    const dateA = new Date(yearAStr.split(' - ')[0]);
                    const dateB = new Date(yearBStr.split(' - ')[0]);
                    return dateB - dateA;
                });
            } else { 
                 itemsToRender.sort((a, b) => {
                    const imdbA = a.imdb === 'xx' || !a.imdb ? 0 : parseFloat(a.imdb);
                    const imdbB = b.imdb === 'xx' || !b.imdb ? 0 : parseFloat(b.imdb);
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
            if (item.type === 'movie') {
                return this.createMovieItemHTML(item);
            }
            if (item.type === 'serie') {
                return this.createTVItemHTML(item);
            }
            return '';
        },

        // Helper pour générer l'icône de validation (Tick) style JustWatch
        createCheckButtonHTML(itemId, isWatched, type, extraAction = '') {
            const action = type === 'movie' 
                ? `toggleMovieWatched(${itemId})` 
                : `markEpisodeWatched(${itemId}, ${extraAction})`; // extraAction sera l'ID episode pour TV

            // Style inspiré du screenshot: rond, fond sombre, bordure légère, check gris si pas vu, check coloré/plein si vu
            const bgClass = isWatched ? 'bg-primary border-primary text-white' : 'bg-black/40 border-gray-600 text-gray-500 hover:text-white hover:border-gray-400';
            
            return `
            <button @click.prevent.stop="${action}" class="flex h-8 w-8 items-center justify-center rounded-full border transition-all ${bgClass} z-10 shrink-0 ml-2">
                <span class="material-symbols-outlined text-[20px]">check</span>
            </button>`;
        },

        // Helper pour afficher les plateformes en ligne
        createPlatformIconsHTML(providers) {
            if (!providers || providers.length === 0) return '';
            return providers.map(p => {
                const logo = p.logo_path ? `https://image.tmdb.org/t/p/w500${p.logo_path}` : p.logoUrl;
                return `<img src="${logo}" alt="${p.provider_name}" class="h-4 w-4 rounded-sm" title="${p.provider_name || p.name}">`;
            }).join('');
        },

        // Calcul de la durée formatée
        formatDuration(runtime) {
            if (!runtime) return '';
            const h = Math.floor(runtime / 60);
            const m = runtime % 60;
            return `${h}h ${m}m`;
        },

        createMovieItemHTML(item) {
            const link = `film.html?id=${item.id}`;
            const durationStr = item.duration || (item.apiDetails?.runtime ? this.formatDuration(item.apiDetails.runtime) : 'N/A');
            const genresStr = item.genres && item.genres.length > 0 ? item.genres[0] : 'Genre';
            
            // Ligne de métadonnées : Année • Genre • Durée
            const metaLine = `${item.year} • ${genresStr} • ${durationStr}`;
            
            const providers = item.apiDetails?.providers || item.availableOn || [];
            const platformsHTML = this.createPlatformIconsHTML(providers);
            const availableLine = platformsHTML 
                ? `<div class="mt-2 flex items-center gap-2 text-xs text-gray-400">
                     <span>Available on:</span>
                     <div class="flex items-center gap-1">${platformsHTML}</div>
                   </div>`
                : '';

            const checkButton = this.createCheckButtonHTML(item.id, item.isWatched, 'movie');

            return `
                <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                    <a href="${link}" class="w-24 flex-shrink-0 group">
                        <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden">
                             <img src="${item.posterUrl}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                             ${item.isWatched ? '<div class="absolute inset-0 bg-black/40 flex items-center justify-center"><span class="material-symbols-outlined text-white">visibility</span></div>' : ''}
                        </div>
                    </a>
                    <div class="flex-1 min-w-0">
                         <div class="flex justify-between items-start">
                             <a href="${link}" class="block pr-2">
                                <h3 class="font-bold text-lg text-white truncate leading-tight">${item.title}</h3>
                             </a>
                             ${checkButton}
                         </div>
                         <p class="text-sm text-gray-400 mt-1">${metaLine}</p>
                         ${availableLine}
                    </div>
                </div>`;
        },

        createTVItemHTML(item) {
            const watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
            const seriesWatchedEpisodes = new Set(watchedEpisodes[item.id] || []);
            const watchedCount = seriesWatchedEpisodes.size;

            if (item.isWatched || (item.apiDetails && watchedCount > 0 && watchedCount === item.apiDetails.number_of_episodes)) {
                 // Série entièrement vue
                 const checkButton = this.createCheckButtonHTML(item.id, true, 'serie', 'all'); // Fake ID for all
                 return `
                    <div class="relative flex items-center gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                        <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0">
                            <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden">
                                <img src="${item.posterUrl}" class="w-full h-full object-cover">
                                <div class="absolute inset-0 flex items-center justify-center bg-black/60">
                                    <span class="material-symbols-outlined text-white">visibility</span>
                                </div>
                            </div>
                        </a>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start">
                                <h3 class="font-bold text-lg text-white truncate">${item.title}</h3>
                                ${checkButton}
                            </div>
                            <p class="text-sm text-gray-400">${String(item.year).split(' - ')[0]} • ${item.genres[0]}</p>
                            <p class="text-xs text-green-500 mt-2 font-medium">Série terminée</p>
                        </div>
                    </div>`;
            }

            if (watchedCount > 0 && item.apiDetails) {
                return this.createInProgressTVItemHTML(item, seriesWatchedEpisodes);
            }

            return this.createUnwatchedTVItemHTML(item);
        },

        createUnwatchedTVItemHTML(item) {
            if (!item.apiDetails || !item.apiDetails.seasons) return '<div class="p-4 text-gray-400">Loading details...</div>';

            const firstSeason = item.apiDetails.seasons.find(s => s.season_number === 1);
            if (!firstSeason || !firstSeason.episodes || firstSeason.episodes.length === 0) return '';

            const firstEpisode = firstSeason.episodes.find(e => e.episode_number === 1);
            if (!firstEpisode) return '';

            const providers = item.apiDetails?.providers || item.availableOn || [];
            const platformsHTML = this.createPlatformIconsHTML(providers);
            const totalSeasons = item.apiDetails.number_of_seasons;
            const startYear = String(item.year).split(' - ')[0];

            // Ligne unifiée : Saisons • Année • Plateformes
            const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>${totalSeasons} Saisons • ${startYear}</span>
                ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}
                <div class="flex items-center gap-1">${platformsHTML}</div>
            </div>`;

            // Bouton check pour le premier épisode
            const checkButton = this.createCheckButtonHTML(item.id, false, 'tv', firstEpisode.id);

            return `
                <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg">
                    <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0">
                        <img class="w-full aspect-[2/3] rounded-lg object-cover" src="${item.posterUrl}" alt="${item.title}">
                    </a>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <a href="serie.html?id=${item.id}" class="block">
                                <h3 class="font-bold text-lg text-white truncate leading-tight">${item.title}</h3>
                            </a>
                            ${checkButton}
                        </div>
                        
                        ${infoLine}
                        
                        <div class="mt-3">
                            <p class="text-xs font-semibold text-primary uppercase tracking-wide">Prochain épisode</p>
                            <p class="text-sm font-medium text-gray-300 mt-0.5 truncate">S01 E01 - ${firstEpisode.name}</p>
                        </div>
                    </div>
                </div>`;
        },

        createInProgressTVItemHTML(item, seriesWatchedEpisodes) {
            let nextEpisode = null;
            let currentSeasonForProgress = null;

            const sortedSeasons = item.apiDetails.seasons
                .filter(s => s.season_number > 0)
                .sort((a, b) => a.season_number - b.season_number);

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

            if (!nextEpisode || !currentSeasonForProgress) {
                return this.createUnwatchedTVItemHTML(item);
            }

            const seasonEpisodeIds = new Set(currentSeasonForProgress.episodes.map(e => e.id));
            const seasonWatchedCount = [...seriesWatchedEpisodes].filter(id => seasonEpisodeIds.has(id)).length;
            const remainingInSeason = currentSeasonForProgress.episodes.length - seasonWatchedCount;
            const totalProgress = (seriesWatchedEpisodes.size / item.apiDetails.number_of_episodes) * 100;

            const providers = item.apiDetails?.providers || item.availableOn || [];
            const platformsHTML = this.createPlatformIconsHTML(providers);
            const totalSeasons = item.apiDetails.number_of_seasons;
            const startYear = String(item.year).split(' - ')[0];

             // Ligne unifiée : Saisons • Année • Plateformes
             const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>${totalSeasons} Saisons • ${startYear}</span>
                ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}
                <div class="flex items-center gap-1">${platformsHTML}</div>
            </div>`;

            const checkButton = this.createCheckButtonHTML(item.id, false, 'tv', nextEpisode.id);

            return `
                <div class="relative p-4 hover:bg-white/5 transition-colors rounded-lg">
                    <div class="flex gap-4">
                        <div class="w-24 flex-shrink-0">
                            <a href="serie.html?id=${item.id}">
                                <img alt="${item.title} cover" class="w-full aspect-[2/3] rounded-lg object-cover" src="${item.posterUrl}">
                            </a>
                        </div>
                        <div class="flex min-w-0 flex-1 flex-col">
                            <div class="flex justify-between items-start">
                                <a href="serie.html?id=${item.id}" class="block">
                                    <h3 class="font-bold text-lg text-white truncate leading-tight">${item.title}</h3>
                                </a>
                                ${checkButton}
                            </div>
                            
                            ${infoLine}

                            <div class="mt-3">
                                <p class="text-xs font-semibold text-primary uppercase tracking-wide">
                                    S${this.formatEpisodeNumber(nextEpisode.season_number)} E${this.formatEpisodeNumber(nextEpisode.episode_number)}
                                    <span class="text-gray-500 normal-case font-normal ml-1">(${remainingInSeason} restants)</span>
                                </p>
                                <p class="text-sm font-medium text-gray-300 mt-0.5 truncate">${nextEpisode.name}</p>
                            </div>
                        </div>
                    </div>
                    <div class="absolute bottom-0 left-4 right-4 h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
                        <div class="h-full bg-primary" style="width: ${totalProgress}%"></div>
                    </div>
                </div>`;
        },

        formatEpisodeNumber(num) {
            return String(num).padStart(2, '0');
        },

        async markEpisodeWatched(seriesId, episodeId) {
            if(!episodeId) return;
            let watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
            if (!watchedEpisodes[seriesId]) watchedEpisodes[seriesId] = [];

            const seriesIdNum = parseInt(seriesId, 10);

            if (!watchedEpisodes[seriesId].includes(episodeId)) {
                watchedEpisodes[seriesId].push(episodeId);
                localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));
            }

            const item = this.enrichedWatchlist.find(i => i.id === seriesIdNum);
            // Vérifier si série terminée
            if (item && item.apiDetails && watchedEpisodes[seriesId].length >= item.apiDetails.number_of_episodes) {
                let watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];
                if (!watchedSeries.includes(seriesIdNum)) {
                    watchedSeries.push(seriesIdNum);
                    localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
                }
                item.isWatched = true;
            }

            await this.renderMedia();
        },

        // Nouvelle fonction pour marquer un film comme vu directement depuis la liste
        async toggleMovieWatched(movieId) {
            let watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
            const movieIdNum = parseInt(movieId, 10);

            if (watchedMovies.includes(movieIdNum)) {
                watchedMovies = watchedMovies.filter(id => id !== movieIdNum);
            } else {
                watchedMovies.push(movieIdNum);
            }
            
            localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
            await this.renderMedia();
        }
    }));
});
