document.addEventListener('alpine:init', () => {
    Alpine.data('watchlistPage', () => ({
        watchlist: [],
        enrichedWatchlist: [],
        activeTab: 'tv', // 'movie' ou 'tv'
        sortOrder: 'popularity',
        selectedPlatform: null,
        watchStatusFilter: 'unwatched', // Par défaut sur "Watchlist" (non vu)
        
        // État de la modale et préférences utilisateur
        showPlatformModal: false,
        userRegion: localStorage.getItem('userRegion') || 'FR',
        myPlatformIds: [], // IDs des plateformes cochées dans le profil
        userSelectedPlatforms: [],
        // Liste pour la pop-up de filtre (Header) - calculée dynamiquement
        availableHeaderPlatforms: [],

        // Liste statique pour le mapping des logos (utilisée par la modale si besoin)
        availablePlatforms: [
            { id: 'netflix', name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjDaoV36ipKs6n.jpg' },
            { id: 'prime', name: 'Prime Video', logoUrl: 'https://image.tmdb.org/t/p/original/emthp39XA2YScoU8t5t7TB3Vgnh.jpg' },
            { id: 'disney', name: 'Disney+', logoUrl: 'https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
            { id: 'apple', name: 'Apple TV+', logoUrl: 'https://image.tmdb.org/t/p/original/2E03IAfXddG5uqCtzsME3sRSfvi.jpg' },
            { id: 'canal', name: 'Canal+', logoUrl: 'https://image.tmdb.org/t/p/original/9a1c28D5E3s5rY1s6t7Q8oJ8j8.jpg' },
            { id: 'paramount', name: 'Paramount+', logoUrl: 'https://image.tmdb.org/t/p/original/h5t071f4q5l9t5h4nK5j1l8f3.jpg' },
            { id: 'max', name: 'Max', logoUrl: 'https://image.tmdb.org/t/p/original/61M6r4f6p2p4p2p4p2p4.jpg' },
            { id: 'skygo', name: 'Sky Go', logoUrl: 'https://image.tmdb.org/t/p/original/1qm5l5r5l5r5l5.jpg' },
            { id: 'now', name: 'Now', logoUrl: 'https://image.tmdb.org/t/p/original/p3Z1z1z1z1.jpg' }
        ],

        async init() {
            this.loadWatchlist();
            
            // Charger les préférences de plateformes
            const savedPlatforms = localStorage.getItem('selectedPlatforms');
            this.myPlatformIds = savedPlatforms ? JSON.parse(savedPlatforms) : [];
            this.userSelectedPlatforms = this.availablePlatforms.filter(p => 
                this.myPlatformIds.includes(p.id)
            );
            await this.fetchAndEnrichWatchlist();
            
            // Construire la liste des filtres disponibles (basé sur le contenu ET mes plateformes)
            this.extractUserPlatforms();

            this.$watch('activeTab', () => this.renderMedia());
            this.$watch('watchStatusFilter', () => this.renderMedia());
            this.$watch('selectedPlatform', () => this.renderMedia());

            await this.renderMedia();
        },

        // Sélectionner une plateforme depuis la modale
        selectPlatformFromModal(platform) {
            if (this.selectedPlatform && this.selectedPlatform.id === platform.id) {
                this.selectedPlatform = null;
            } else {
                this.selectedPlatform = platform;
            }
            this.showPlatformModal = false;
        },

        loadWatchlist() {
            const savedList = localStorage.getItem('watchlist');
            this.watchlist = savedList ? JSON.parse(savedList) : [];
        },

        // Construit la liste des plateformes affichées dans le header (Pop-up)
        extractUserPlatforms() {
            const platformMap = new Map();
            
            this.enrichedWatchlist.forEach(item => {
                const providers = this.getProvidersForItem(item);
                providers.forEach(p => {
                    const internalId = this.getInternalPlatformId(p.provider_name);
                    // On ne montre dans le filtre que si l'utilisateur l'a dans ses "Mes Plateformes"
                    if (this.myPlatformIds.includes(internalId)) {
                        const logoUrl = p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : p.logoUrl;
                        platformMap.set(internalId, { id: internalId, name: p.provider_name, logoUrl });
                    }
                });
            });
            this.availableHeaderPlatforms = Array.from(platformMap.values());
        },

        getInternalPlatformId(tmdbName) {
            const lower = tmdbName.toLowerCase();
            if (lower.includes('netflix')) return 'netflix';
            if (lower.includes('amazon') || lower.includes('prime')) return 'prime';
            if (lower.includes('disney')) return 'disney';
            if (lower.includes('apple')) return 'apple';
            if (lower.includes('canal')) return 'canal';
            if (lower.includes('paramount')) return 'paramount';
            if (lower.includes('max') || lower.includes('hbo')) return 'max';
            if (lower.includes('sky')) return 'skygo';
            if (lower.includes('now')) return 'now';
            return 'other';
        },

        // LOGIQUE CENTRALE DE DISPONIBILITÉ (Pays + Canal)
        getProvidersForItem(item) {
            if (!item.apiDetails || !item.apiDetails['watch/providers']) return [];
            
            const providersData = item.apiDetails['watch/providers'].results;
            let combinedProviders = [];

            // 1. Providers du pays sélectionné (FR ou IE)
            if (providersData[this.userRegion] && providersData[this.userRegion].flatrate) {
                combinedProviders = [...providersData[this.userRegion].flatrate];
            }

            // 2. Exception Canal+ (Toujours vérifier la dispo FR si je suis en Irlande et que j'ai Canal)
            if (this.userRegion !== 'FR' && this.myPlatformIds.includes('canal')) {
                if (providersData['FR'] && providersData['FR'].flatrate) {
                    const canalProvider = providersData['FR'].flatrate.find(p => p.provider_id === 392 || p.provider_name.includes('Canal'));
                    if (canalProvider) {
                        // Éviter les doublons
                        if (!combinedProviders.some(p => p.provider_id === canalProvider.provider_id)) {
                            combinedProviders.push(canalProvider);
                        }
                    }
                }
            }
            return combinedProviders;
        },

        async fetchAndEnrichWatchlist() {
            const watchlistWithMediaData = this.watchlist.map(item => {
                const media = mediaData.find(m => m.id === item.id);
                return { ...media, ...item, apiDetails: null };
            });

            const promises = watchlistWithMediaData.map(item => {
                if (!item) return Promise.resolve(null);
                if (item.type === 'serie' || item.type === 'tv') {
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
            const item = { timestamp: new Date().getTime(), data: data };
            localStorage.setItem(key, JSON.stringify(item));
        },

        // Fetch sans filtrage de région ici (on récupère tout l'objet providers)
        async fetchMovieDetails(movieId) {
            const cacheKey = `movie-details-${movieId}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;

            try {
                const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`);
                if (!res.ok) return null;
                const data = await res.json();
                this.setCachedData(cacheKey, data);
                return data;
            } catch (e) { return null; }
        },

        async fetchFullSeriesDetails(seriesId) {
            const cacheKey = `series-details-${seriesId}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;

            try {
                const seriesRes = await fetch(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`);
                if (!seriesRes.ok) return null;
                const seriesData = await seriesRes.json();

                const seasonPromises = seriesData.seasons
                    .filter(s => s.season_number > 0)
                    .map(season =>
                        fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${season.season_number}?api_key=${TMDB_API_KEY}`)
                        .then(res => res.ok ? res.json() : null)
                    );

                const seasonsWithEpisodes = await Promise.all(seasonPromises);
                seriesData.seasons = seasonsWithEpisodes.filter(s => s);

                this.setCachedData(cacheKey, seriesData);
                return seriesData;
            } catch (e) { return null; }
        },

        get filteredMedia() {
            const type = this.activeTab === 'tv' ? 'serie' : 'movie';
            const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
            const watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];

            let filtered = this.enrichedWatchlist
                .map(item => {
                    if (!item.type && item.title) item.type = 'movie'; 
                    if (!item.type && item.name) item.type = 'serie';
                    const normalizedType = (item.type === 'tv') ? 'serie' : item.type;
                    
                    const isWatched = (normalizedType === 'movie' && watchedMovies.includes(item.id)) ||
                                    (normalizedType === 'serie' && watchedSeries.includes(item.id));
                    
                    // On calcule les providers dynamiques ici
                    const dynamicProviders = this.getProvidersForItem(item);

                    return { ...item, type: normalizedType, isWatched, dynamicProviders };
                })
                .filter(item => item && item.type === type);

            // Filtre Header (Plateforme unique sélectionnée)
            if (this.selectedPlatform) {
                filtered = filtered.filter(item =>
                    item.dynamicProviders.some(p => this.getInternalPlatformId(p.provider_name) === this.selectedPlatform.id)
                );
            }

            // Filtre Vu / Pas Vu
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
                if (emptyState) emptyState.style.display = 'block';
                return;
            }

            if (emptyState) emptyState.style.display = 'none';
            const mediaHTMLPromises = itemsToRender.map(item => this.createMediaItemHTML(item));
            const mediaHTML = await Promise.all(mediaHTMLPromises);
            container.innerHTML = mediaHTML.join('');
        },

        async createMediaItemHTML(item) {
            if (item.type === 'movie') return this.createMovieItemHTML(item);
            if (item.type === 'serie') return this.createTVItemHTML(item);
            return '';
        },

        // Générateur de bouton Check
        createCheckButtonHTML(itemId, isWatched, type, extraAction = '') {
            const action = type === 'movie' 
                ? `toggleMovieWatched(${itemId})` 
                : `markEpisodeWatched(${itemId}, ${extraAction})`; 

            const bgClass = isWatched ? 'bg-primary border-primary text-white' : 'bg-black/40 border-gray-600 text-gray-500 hover:text-white hover:border-gray-400';
            
            return `
            <button @click.prevent.stop="${action}" class="flex h-8 w-8 items-center justify-center rounded-full border transition-all ${bgClass} z-10 shrink-0 ml-2">
                <span class="material-symbols-outlined text-[20px]">check</span>
            </button>`;
        },

        // Générateur d'icones plateformes (filtrées par préférences)
        createPlatformIconsHTML(providers) {
            if (!providers || providers.length === 0) return '';
            
            const myProviders = providers.filter(p => this.myPlatformIds.includes(this.getInternalPlatformId(p.provider_name)));
            
            // Si aucune de mes plateformes n'a le contenu, on n'affiche rien (ou on pourrait afficher un message)
            if (myProviders.length === 0) return '';

            return myProviders.map(p => {
                const logo = p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : p.logoUrl;
                return `<img src="${logo}" alt="${p.provider_name}" class="h-4 w-4 rounded-sm" title="${p.provider_name}">`;
            }).join('');
        },

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
            const metaLine = `${item.year} • ${genresStr} • ${durationStr}`;
            
            const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
            
            const availableLine = platformsHTML 
                ? `<div class="mt-5 flex items-center gap-2 text-xs text-gray-400">
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
                 const checkButton = this.createCheckButtonHTML(item.id, true, 'serie', 'all'); 
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

            const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders);
            const totalSeasons = item.apiDetails.number_of_seasons;
            const startYear = String(item.year).split(' - ')[0];

            const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>${totalSeasons} Saisons • ${startYear}</span>
                ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''}
                <div class="flex items-center gap-1">${platformsHTML}</div>
            </div>`;

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
