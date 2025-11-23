document.addEventListener('alpine:init', () => {
    Alpine.data('watchlistPage', () => ({
        watchlist: [],
        enrichedWatchlist: [],
        activeTab: 'movie',
        sortOrder: 'popularity',
        
        // Bottom Sheets
        showSortSheet: false,
        showFilterSheet: false,

        // Filter State
        activePlatformFilters: [], 
        filterGenres: [], // Array of genre IDs
        filterYearMin: 1950,
        filterYearMax: new Date().getFullYear(),
        filterRating: 0,
        isThisYearSelected: false,

        watchStatusFilter: 'unwatched',
        showServiceBar: false,
        userRegion: localStorage.getItem('userRegion') || 'FR',
        myPlatformIds: [], 
        userSelectedPlatforms: [], 

        availablePlatforms: [
            { id: 'netflix', logoUrl: 'https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456' },
            { id: 'prime', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Amazon_Prime_Video_logo_%282024%29.svg/1024px-Amazon_Prime_Video_logo_%282024%29.svg.png' },
            { id: 'disney', logoUrl: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/25357066/Disney__Logo_March_2024.png?quality=90&strip=all&crop=0,0,100,100' },
            { id: 'apple', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/AppleTVLogo.svg/768px-AppleTVLogo.svg.png' },
            { id: 'canal', logoUrl: 'https://static1.purepeople.com/articles/0/46/23/10/@/6655765-logo-de-la-chaine-canal-1200x0-2.png' },
            { id: 'paramount', logoUrl: 'https://images.seeklogo.com/logo-png/39/1/paramount-logo-png_seeklogo-397501.png' },
            { id: 'max', logoUrl: 'https://logo.clearbit.com/max.com' },
            { id: 'skygo', logoUrl: 'https://logo.clearbit.com/sky.com' },
            { id: 'now', logoUrl: 'https://logo.clearbit.com/nowtv.com' }
        ],

        get sortLabel() {
            if (this.sortOrder === 'popularity') return 'Popularité';
            if (this.sortOrder === 'release_date') return 'Date de sortie';
            if (this.sortOrder === 'recently_added') return 'Date d\'ajout';
            return 'Tri';
        },

        get activeFiltersCount() {
            let count = 0;
            if (this.filterGenres.length > 0) count++;
            if (this.filterRating > 0) count++;
            if (this.filterYearMin > 1950 || this.filterYearMax < new Date().getFullYear()) count++;
            if (this.isThisYearSelected) count++;
            return count;
        },

        // Dynamically get all genres available in the current enriched watchlist
        get availableGenres() {
            const genres = new Map();
            const type = this.activeTab === 'movie' ? 'movie' : 'serie';

            this.enrichedWatchlist.forEach(item => {
                let itemType = item.type;
                if (!itemType && item.title) itemType = 'movie';
                if (!itemType && item.name) itemType = 'serie';
                if (itemType === 'tv') itemType = 'serie';

                if (itemType === type && item.apiDetails && item.apiDetails.genres) {
                    item.apiDetails.genres.forEach(g => {
                        if (!genres.has(g.id)) {
                            genres.set(g.id, g);
                        }
                    });
                }
            });
            return Array.from(genres.values()).sort((a, b) => a.name.localeCompare(b.name));
        },

        async init() {
            this.loadWatchlist();
            const flagImg = document.getElementById('header-flag');
            if (flagImg) flagImg.src = `https://flagcdn.com/w40/${this.userRegion.toLowerCase()}.png`;

            const savedPlatforms = localStorage.getItem('selectedPlatforms');
            this.myPlatformIds = savedPlatforms ? JSON.parse(savedPlatforms) : [];

            this.userSelectedPlatforms = this.availablePlatforms.filter(p => 
                this.myPlatformIds.includes(p.id)
            );

            // TOUT COCHÉ PAR DÉFAUT
            this.activePlatformFilters = [...this.myPlatformIds];

            await this.fetchAndEnrichWatchlist();
            
            this.$watch('activeTab', () => { this.filterGenres = []; this.renderMedia(); });
            this.$watch('watchStatusFilter', () => this.renderMedia());
            this.$watch('activePlatformFilters', () => this.renderMedia());

            await this.renderMedia();
        },

        togglePlatformFilter(platformId) {
            if (this.activePlatformFilters.includes(platformId)) {
                this.activePlatformFilters = this.activePlatformFilters.filter(id => id !== platformId);
            } else {
                this.activePlatformFilters.push(platformId);
            }
        },

        toggleGenre(genreId) {
            if (this.filterGenres.includes(genreId)) {
                this.filterGenres = this.filterGenres.filter(id => id !== genreId);
            } else {
                this.filterGenres.push(genreId);
            }
        },

        toggleThisYear() {
            this.isThisYearSelected = !this.isThisYearSelected;
            const currentYear = new Date().getFullYear();
            if (this.isThisYearSelected) {
                this.filterYearMin = currentYear;
                this.filterYearMax = currentYear;
            } else {
                // Reset to default range
                this.filterYearMin = 1950;
                this.filterYearMax = currentYear;
            }
        },

        resetFilters() {
            this.filterGenres = [];
            this.filterRating = 0;
            this.filterYearMin = 1950;
            this.filterYearMax = new Date().getFullYear();
            this.isThisYearSelected = false;
            this.showFilterSheet = false;
            this.renderMedia();
        },

        applyFilters() {
            this.showFilterSheet = false;
            this.renderMedia();
        },

        // ... (loadWatchlist, getInternalPlatformId inchangés) ...
        loadWatchlist() { const savedList = localStorage.getItem('watchlist'); this.watchlist = savedList ? JSON.parse(savedList) : []; },
        getInternalPlatformId(tmdbName) { const lower = tmdbName.toLowerCase(); if (lower.includes('netflix')) return 'netflix'; if (lower.includes('amazon') || lower.includes('prime')) return 'prime'; if (lower.includes('disney')) return 'disney'; if (lower.includes('apple')) return 'apple'; if (lower.includes('canal')) return 'canal'; if (lower.includes('paramount')) return 'paramount'; if (lower.includes('max') || lower.includes('hbo')) return 'max'; if (lower.includes('sky')) return 'skygo'; if (lower.includes('now')) return 'now'; return 'other'; },

        // CORRECTION DOUBLONS & LOGIQUE
        getProvidersForItem(item) {
            if (!item.apiDetails || !item.apiDetails['watch/providers']) return [];
            const providersData = item.apiDetails['watch/providers'].results;
            let rawProviders = [];

            if (providersData[this.userRegion] && providersData[this.userRegion].flatrate) {
                rawProviders = [...providersData[this.userRegion].flatrate];
            }
            if (this.userRegion !== 'FR' && this.myPlatformIds.includes('canal')) {
                if (providersData['FR'] && providersData['FR'].flatrate) {
                    const canal = providersData['FR'].flatrate.find(p => p.provider_id === 392 || p.provider_name.includes('Canal'));
                    if (canal) rawProviders.push(canal);
                }
            }

            // Dédoublonnage via Set sur provider_id
            const unique = [];
            const seen = new Set();
            for (const p of rawProviders) {
                if (!seen.has(p.provider_id)) {
                    unique.push(p);
                    seen.add(p.provider_id);
                }
            }
            return unique;
        },

        // ... (fetch functions unchanged) ...
        async fetchAndEnrichWatchlist() { const watchlistWithMediaData = this.watchlist.map(item => { const media = mediaData.find(m => m.id === item.id); return { ...media, ...item, apiDetails: null }; }); const promises = watchlistWithMediaData.map(item => { if (!item) return Promise.resolve(null); if (item.type === 'serie' || item.type === 'tv') { return this.fetchFullSeriesDetails(item.id); } else if (item.type === 'movie') { return this.fetchMovieDetails(item.id); } return Promise.resolve(null); }); const results = await Promise.all(promises); this.enrichedWatchlist = watchlistWithMediaData.map(item => { if (!item) return null; const details = results.find(d => d && d.id === item.id); if (details) { item.apiDetails = details; } return item; }).filter(Boolean); },
        getCachedData(key) { const cached = localStorage.getItem(key); if (!cached) return null; const { timestamp, data } = JSON.parse(cached); const isExpired = (new Date().getTime() - timestamp) > 24 * 60 * 60 * 1000; return isExpired ? null : data; },
        setCachedData(key, data) { const item = { timestamp: new Date().getTime(), data: data }; localStorage.setItem(key, JSON.stringify(item)); },
        async fetchMovieDetails(movieId) { const cacheKey = `movie-details-${movieId}`; const cachedData = this.getCachedData(cacheKey); if (cachedData) return cachedData; try { const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`); if (!res.ok) return null; const data = await res.json(); this.setCachedData(cacheKey, data); return data; } catch (e) { return null; } },
        async fetchFullSeriesDetails(seriesId) { const cacheKey = `series-details-${seriesId}`; const cachedData = this.getCachedData(cacheKey); if (cachedData) return cachedData; try { const seriesRes = await fetch(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`); if (!seriesRes.ok) return null; const seriesData = await seriesRes.json(); const seasonPromises = seriesData.seasons.filter(s => s.season_number > 0).map(season => fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${season.season_number}?api_key=${TMDB_API_KEY}`).then(res => res.ok ? res.json() : null)); const seasonsWithEpisodes = await Promise.all(seasonPromises); seriesData.seasons = seasonsWithEpisodes.filter(s => s); this.setCachedData(cacheKey, seriesData); return seriesData; } catch (e) { return null; } },

        get filteredMedia() {
            const type = this.activeTab === 'movie' ? 'movie' : 'serie';
            const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
            const watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];

            let filtered = this.enrichedWatchlist
                .map(item => {
                    if (!item.type && item.title) item.type = 'movie'; 
                    if (!item.type && item.name) item.type = 'serie';
                    const normalizedType = (item.type === 'tv') ? 'serie' : item.type;
                    const isWatched = (normalizedType === 'movie' && watchedMovies.includes(item.id)) ||
                                    (normalizedType === 'serie' && watchedSeries.includes(item.id));
                    const dynamicProviders = this.getProvidersForItem(item);
                    return { ...item, type: normalizedType, isWatched, dynamicProviders };
                })
                .filter(item => item && item.type === type);

            // 1. FILTER: WATCH STATUS
            if (this.watchStatusFilter === 'watched') {
                filtered = filtered.filter(item => item.isWatched);
            } else if (this.watchStatusFilter === 'unwatched') {
                filtered = filtered.filter(item => !item.isWatched);
            }

            // 2. FILTER: PLATFORMS
            if (this.activePlatformFilters.length > 0) {
                filtered = filtered.filter(item => {
                    const isAvailableOnActive = item.dynamicProviders.some(p =>
                        this.activePlatformFilters.includes(this.getInternalPlatformId(p.provider_name))
                    );
                    return isAvailableOnActive;
                });
            }

            // 3. FILTER: GENRES
            if (this.filterGenres.length > 0) {
                filtered = filtered.filter(item => {
                    if (!item.apiDetails || !item.apiDetails.genres) return false;
                    // Check if item has ANY of the selected genres
                    return item.apiDetails.genres.some(g => this.filterGenres.includes(g.id));
                });
            }

            // 4. FILTER: YEAR RANGE
            // Only apply if it differs from default
            const currentYear = new Date().getFullYear();
            if (this.filterYearMin > 1950 || this.filterYearMax < currentYear) {
                filtered = filtered.filter(item => {
                    const yearStr = item.year || (item.apiDetails ? (item.apiDetails.release_date || item.apiDetails.first_air_date) : '');
                    if (!yearStr) return false;
                    const year = parseInt(yearStr.split('-')[0] || yearStr.split(' ')[0]);
                    return year >= this.filterYearMin && year <= this.filterYearMax;
                });
            }

            // 5. FILTER: RATING
            if (this.filterRating > 0) {
                filtered = filtered.filter(item => {
                    const rating = item.vote_average || (item.apiDetails ? item.apiDetails.vote_average : 0);
                    // Also handle IMDb from data.js if needed, but consistency suggests TMDB rating
                    return parseFloat(rating) >= this.filterRating;
                });
            }

            return filtered;
        },

        // ... (setSort, renderMedia, createHTML functions unchanged) ...
        setSort(order) { this.sortOrder = order; this.renderMedia(); },
        async renderMedia() { const container = document.getElementById('media-list'); const emptyState = document.getElementById('empty-state'); if (!container) return; let itemsToRender = [...this.filteredMedia]; if (this.sortOrder === 'recently_added') { itemsToRender.sort((a, b) => new Date(b.added_at) - new Date(a.added_at)); } else if (this.sortOrder === 'release_date') { itemsToRender.sort((a, b) => { const yearAStr = String(a.year || ''); const yearBStr = String(b.year || ''); const dateA = new Date(yearAStr.split(' - ')[0]); const dateB = new Date(yearBStr.split(' - ')[0]); return dateB - dateA; }); } else { itemsToRender.sort((a, b) => { const imdbA = a.imdb === 'xx' || !a.imdb ? 0 : parseFloat(a.imdb); const imdbB = b.imdb === 'xx' || !b.imdb ? 0 : parseFloat(b.imdb); return imdbB - imdbA; }); } if (itemsToRender.length === 0) { container.innerHTML = ''; if (emptyState) emptyState.classList.remove('hidden'); return; } if (emptyState) emptyState.classList.add('hidden'); const mediaHTMLPromises = itemsToRender.map(item => this.createMediaItemHTML(item)); const mediaHTML = await Promise.all(mediaHTMLPromises); container.innerHTML = mediaHTML.join(''); },
        async createMediaItemHTML(item) { if (item.type === 'movie') return this.createMovieItemHTML(item); if (item.type === 'serie') return this.createTVItemHTML(item); return ''; },
        createCheckButtonHTML(itemId, isWatched, type, extraAction = '') { const action = type === 'movie' ? `toggleMovieWatched(${itemId})` : `markEpisodeWatched(${itemId}, ${extraAction})`; const bgClass = isWatched ? 'bg-primary border-primary text-white' : 'bg-black/40 border-gray-600 text-gray-500 hover:text-white hover:border-gray-400'; return ` <button @click.prevent.stop="${action}" class="flex h-8 w-8 items-center justify-center rounded-full border transition-all ${bgClass} z-10 shrink-0 ml-2"> <span class="material-symbols-outlined text-[20px]">check</span> </button>`; },
        createPlatformIconsHTML(providers) { if (!providers || providers.length === 0) return ''; const myProviders = providers.filter(p => this.myPlatformIds.includes(this.getInternalPlatformId(p.provider_name))); if (myProviders.length === 0) return ''; return myProviders.map(p => { const platformObj = this.availablePlatforms.find(ap => ap.id === this.getInternalPlatformId(p.provider_name)); const logo = platformObj ? platformObj.logoUrl : (p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : p.logoUrl); return `<img src="${logo}" alt="${p.provider_name}" class="h-4 w-4 rounded-sm object-cover bg-gray-800" title="${p.provider_name}">`; }).join(''); },
        formatDuration(runtime) { if (!runtime) return ''; const h = Math.floor(runtime / 60); const m = runtime % 60; return `${h}h ${m}m`; },
        createMovieItemHTML(item) { const link = `film.html?id=${item.id}`; const durationStr = item.duration || (item.apiDetails?.runtime ? this.formatDuration(item.apiDetails.runtime) : 'N/A'); const genresStr = item.genres && item.genres.length > 0 ? item.genres[0] : 'Genre'; const metaLine = `${item.year} • ${genresStr} • ${durationStr}`; const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders); const availableLine = platformsHTML ? `<div class="mt-5 flex items-center gap-2 text-xs text-gray-400"> <span>Available on:</span> <div class="flex items-center gap-1">${platformsHTML}</div> </div>` : ''; const checkButton = this.createCheckButtonHTML(item.id, item.isWatched, 'movie'); return ` <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg"> <a href="${link}" class="w-24 flex-shrink-0 group"> <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden"> <img src="${item.posterUrl}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform"> ${item.isWatched ? '<div class="absolute inset-0 bg-black/40 flex items-center justify-center"><span class="material-symbols-outlined text-white">visibility</span></div>' : ''} </div> </a> <div class="flex-1 min-w-0"> <div class="flex justify-between items-start"> <a href="${link}" class="block pr-2"> <h3 class="font-bold text-lg text-white truncate leading-tight">${item.title}</h3> </a> ${checkButton} </div> <p class="text-sm text-gray-400 mt-1">${metaLine}</p> ${availableLine} </div> </div>`; },
        createTVItemHTML(item) { const watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {}; const seriesWatchedEpisodes = new Set(watchedEpisodes[item.id] || []); const watchedCount = seriesWatchedEpisodes.size; if (item.isWatched || (item.apiDetails && watchedCount > 0 && watchedCount === item.apiDetails.number_of_episodes)) { const checkButton = this.createCheckButtonHTML(item.id, true, 'serie', 'all'); return ` <div class="relative flex items-center gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg"> <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0"> <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden"> <img src="${item.posterUrl}" class="w-full h-full object-cover"> <div class="absolute inset-0 flex items-center justify-center bg-black/60"> <span class="material-symbols-outlined text-white">visibility</span> </div> </div> </a> <div class="flex-1 min-w-0"> <div class="flex justify-between items-start"> <h3 class="font-bold text-lg text-white truncate">${item.title}</h3> ${checkButton} </div> <p class="text-sm text-gray-400">${String(item.year).split(' - ')[0]} • ${item.genres[0]}</p> <p class="text-xs text-green-500 mt-2 font-medium">Série terminée</p> </div> </div>`; } if (watchedCount > 0 && item.apiDetails) { return this.createInProgressTVItemHTML(item, seriesWatchedEpisodes); } return this.createUnwatchedTVItemHTML(item); },
        createUnwatchedTVItemHTML(item) { if (!item.apiDetails || !item.apiDetails.seasons) return '<div class="p-4 text-gray-400">Loading details...</div>'; const firstSeason = item.apiDetails.seasons.find(s => s.season_number === 1); if (!firstSeason || !firstSeason.episodes || firstSeason.episodes.length === 0) return ''; const firstEpisode = firstSeason.episodes.find(e => e.episode_number === 1); if (!firstEpisode) return ''; const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders); const totalSeasons = item.apiDetails.number_of_seasons; const startYear = String(item.year).split(' - ')[0]; const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"> <span>${totalSeasons} Saisons • ${startYear}</span> ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''} <div class="flex items-center gap-1">${platformsHTML}</div> </div>`; const checkButton = this.createCheckButtonHTML(item.id, false, 'tv', firstEpisode.id); return ` <div class="relative flex items-start gap-4 p-4 hover:bg-white/5 transition-colors rounded-lg"> <a href="serie.html?id=${item.id}" class="w-24 flex-shrink-0"> <img class="w-full aspect-[2/3] rounded-lg object-cover" src="${item.posterUrl}" alt="${item.title}"> </a> <div class="flex-1 min-w-0"> <div class="flex justify-between items-start"> <a href="serie.html?id=${item.id}" class="block"> <h3 class="font-bold text-lg text-white truncate leading-tight">${item.title}</h3> </a> ${checkButton} </div> ${infoLine} <div class="mt-3"> <p class="text-xs font-semibold text-primary uppercase tracking-wide">Prochain épisode</p> <p class="text-sm font-medium text-gray-300 mt-0.5 truncate">S01 E01 - ${firstEpisode.name}</p> </div> </div> </div>`; },
        createInProgressTVItemHTML(item, seriesWatchedEpisodes) { let nextEpisode = null; let currentSeasonForProgress = null; const sortedSeasons = item.apiDetails.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number); for (const season of sortedSeasons) { const sortedEpisodes = season.episodes.sort((a, b) => a.episode_number - b.episode_number); for (const episode of sortedEpisodes) { if (!seriesWatchedEpisodes.has(episode.id)) { nextEpisode = episode; currentSeasonForProgress = season; break; } } if (nextEpisode) break; } if (!nextEpisode || !currentSeasonForProgress) return this.createUnwatchedTVItemHTML(item); const seasonEpisodeIds = new Set(currentSeasonForProgress.episodes.map(e => e.id)); const seasonWatchedCount = [...seriesWatchedEpisodes].filter(id => seasonEpisodeIds.has(id)).length; const remainingInSeason = currentSeasonForProgress.episodes.length - seasonWatchedCount; const totalProgress = (seriesWatchedEpisodes.size / item.apiDetails.number_of_episodes) * 100; const platformsHTML = this.createPlatformIconsHTML(item.dynamicProviders); const totalSeasons = item.apiDetails.number_of_seasons; const startYear = String(item.year).split(' - ')[0]; const infoLine = `<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"> <span>${totalSeasons} Saisons • ${startYear}</span> ${platformsHTML ? '<span class="text-gray-600">•</span>' : ''} <div class="flex items-center gap-1">${platformsHTML}</div> </div>`; const checkButton = this.createCheckButtonHTML(item.id, false, 'tv', nextEpisode.id); return ` <div class="relative p-4 hover:bg-white/5 transition-colors rounded-lg"> <div class="flex gap-4"> <div class="w-24 flex-shrink-0"> <a href="serie.html?id=${item.id}"> <img alt="${item.title} cover" class="w-full aspect-[2/3] rounded-lg object-cover" src="${item.posterUrl}"> </a> </div> <div class="flex min-w-0 flex-1 flex-col"> <div class="flex justify-between items-start"> <a href="serie.html?id=${item.id}" class="block"> <h3 class="font-bold text-lg text-white truncate leading-tight">${item.title}</h3> </a> ${checkButton} </div> ${infoLine} <div class="mt-3"> <p class="text-xs font-semibold text-primary uppercase tracking-wide"> S${this.formatEpisodeNumber(nextEpisode.season_number)} E${this.formatEpisodeNumber(nextEpisode.episode_number)} <span class="text-gray-500 normal-case font-normal ml-1">(${remainingInSeason} restants)</span> </p> <p class="text-sm font-medium text-gray-300 mt-0.5 truncate">${nextEpisode.name}</p> </div> </div> </div> <div class="absolute bottom-0 left-4 right-4 h-1 bg-gray-700 rounded-full overflow-hidden mb-2"> <div class="h-full bg-primary" style="width: ${totalProgress}%"></div> </div> </div>`; },
        formatEpisodeNumber(num) { return String(num).padStart(2, '0'); },
        async markEpisodeWatched(seriesId, episodeId) { if(!episodeId) return; let watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {}; if (!watchedEpisodes[seriesId]) watchedEpisodes[seriesId] = []; const seriesIdNum = parseInt(seriesId, 10); if (!watchedEpisodes[seriesId].includes(episodeId)) { watchedEpisodes[seriesId].push(episodeId); localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes)); } const item = this.enrichedWatchlist.find(i => i.id === seriesIdNum); if (item && item.apiDetails && watchedEpisodes[seriesId].length >= item.apiDetails.number_of_episodes) { let watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || []; if (!watchedSeries.includes(seriesIdNum)) { watchedSeries.push(seriesIdNum); localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries)); } item.isWatched = true; } await this.renderMedia(); },
        async toggleMovieWatched(movieId) { let watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || []; const movieIdNum = parseInt(movieId, 10); if (watchedMovies.includes(movieIdNum)) { watchedMovies = watchedMovies.filter(id => id !== movieIdNum); } else { watchedMovies.push(movieIdNum); } localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies)); await this.renderMedia(); }
    }));
});
