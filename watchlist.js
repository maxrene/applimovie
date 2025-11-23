document.addEventListener('alpine:init', () => {
    Alpine.data('watchlistPage', () => ({
        watchlist: [],
        enrichedWatchlist: [],
        activeTab: 'tv',
        sortOrder: 'popularity',
        selectedPlatform: null,
        watchStatusFilter: 'unwatched',
        showPlatformModal: false,
        userRegion: localStorage.getItem('userRegion') || 'FR',
        
        // Liste des plateformes sélectionnées par l'utilisateur (chargées au init)
        myPlatformIds: [], 

        // Plateformes disponibles pour le filtre header (calculées dynamiquement)
        availableHeaderPlatforms: [],

        async init() {
            this.loadWatchlist();
            // Charge les préférences utilisateur
            const savedPlatforms = localStorage.getItem('selectedPlatforms');
            this.myPlatformIds = savedPlatforms ? JSON.parse(savedPlatforms) : [];

            await this.fetchAndEnrichWatchlist();
            
            // Construit la liste des plateformes pour le header en filtrant par celles de l'utilisateur
            this.extractUserPlatforms();

            this.$watch('activeTab', () => this.renderMedia());
            this.$watch('watchStatusFilter', () => this.renderMedia());
            this.$watch('selectedPlatform', () => this.renderMedia());

            await this.renderMedia();
        },

        // Nouvelle logique : On ne montre dans le header QUE les plateformes que l'utilisateur a configurées
        extractUserPlatforms() {
            const platformMap = new Map();
            
            this.enrichedWatchlist.forEach(item => {
                const providers = this.getProvidersForItem(item);
                providers.forEach(p => {
                    // On ne garde que si l'utilisateur a sélectionné cette plateforme dans ses préférences
                    // Note: Il faut mapper le nom du provider TMDB vers notre ID interne (ex: "Netflix" -> "netflix")
                    // Pour simplifier ici, on suppose que le nom match ou on utilise une map simple
                    const internalId = this.getInternalPlatformId(p.provider_name);
                    
                    if (this.myPlatformIds.includes(internalId)) {
                        const logoUrl = p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : p.logoUrl;
                        platformMap.set(internalId, { id: internalId, name: p.provider_name, logoUrl });
                    }
                });
            });
            this.availableHeaderPlatforms = Array.from(platformMap.values());
        },
        
        // Helper pour convertir les noms TMDB en IDs internes
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

        // C'EST ICI QUE LA LOGIQUE PAYS + CANAL SE JOUE
        getProvidersForItem(item) {
            if (!item.apiDetails || !item.apiDetails['watch/providers']) return [];
            
            const providersData = item.apiDetails['watch/providers'].results;
            let combinedProviders = [];

            // 1. Récupérer les providers du pays choisi (FR ou IE)
            if (providersData[this.userRegion] && providersData[this.userRegion].flatrate) {
                combinedProviders = [...providersData[this.userRegion].flatrate];
            }

            // 2. EXCEPTION CANAL+ : Si l'utilisateur est en IE mais a Canal dans ses préférences
            if (this.userRegion !== 'FR' && this.myPlatformIds.includes('canal')) {
                // On va chercher dans les providers FR s'il y a Canal+
                if (providersData['FR'] && providersData['FR'].flatrate) {
                    const canalProvider = providersData['FR'].flatrate.find(p => p.provider_id === 392 || p.provider_name.includes('Canal'));
                    if (canalProvider) {
                        // On vérifie qu'on ne l'a pas déjà (peu probable si on est en IE mais bon)
                        if (!combinedProviders.some(p => p.provider_id === canalProvider.provider_id)) {
                            combinedProviders.push(canalProvider);
                        }
                    }
                }
            }

            return combinedProviders;
        },

        // ... [loadWatchlist, setCachedData, etc. inchangés] ...
        // Important: Mettre à jour fetchMovieDetails et fetchFullSeriesDetails pour ne plus filtrer .FR uniquement
        // mais garder tout l'objet providers

        async fetchMovieDetails(movieId) {
            const cacheKey = `movie-details-${movieId}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;

            try {
                // On ne filtre plus par region ici, on prend tout
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
                
                // Fetch saisons (inchangé)
                const seasonPromises = seriesData.seasons
                    .filter(s => s.season_number > 0)
                    .map(season => fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${season.season_number}?api_key=${TMDB_API_KEY}`).then(r=>r.json()));
                
                const seasons = await Promise.all(seasonPromises);
                seriesData.seasons = seasons;

                this.setCachedData(cacheKey, seriesData);
                return seriesData;
            } catch (e) { return null; }
        },
        
        // ... [get filteredMedia modifié pour utiliser getProvidersForItem et filter par User Platforms] ...

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
                    
                    // On attache les providers calculés dynamiquement à l'objet pour l'utiliser dans le rendu
                    const dynamicProviders = this.getProvidersForItem(item);
                    
                    return { ...item, type: normalizedType, isWatched, dynamicProviders };
                })
                .filter(item => item && item.type === type);

            // FILTRE 1 : Si un bouton de plateforme est cliqué dans le header
            if (this.selectedPlatform) {
                filtered = filtered.filter(item => 
                    item.dynamicProviders.some(p => this.getInternalPlatformId(p.provider_name) === this.selectedPlatform.id)
                );
            }

            // FILTRE 2 : N'afficher que ce qui est dispo sur MES plateformes (Préférence globale)
            // Si l'utilisateur veut voir tout ce qu'il a ajouté même si pas dispo, commentez ce bloc.
            // Mais la demande dit "les plateformes selectionnees seront celles qui s'afficheront pour les dispos"
            // Généralement on veut voir sa watchlist complète, mais juste filtrer les icones. 
            // Si vous voulez masquer les films non dispos sur vos plateformes, décommentez ceci :
            /*
            filtered = filtered.filter(item => 
                item.dynamicProviders.some(p => this.myPlatformIds.includes(this.getInternalPlatformId(p.provider_name)))
            );
            */

            if (this.watchStatusFilter === 'watched') {
                filtered = filtered.filter(item => item.isWatched);
            } else if (this.watchStatusFilter === 'unwatched') {
                filtered = filtered.filter(item => !item.isWatched);
            }

            return filtered;
        },

        // ... [Rendu HTML : createMovieItemHTML et createUnwatchedTVItemHTML] ...
        // IMPORTANT : Utilisez item.dynamicProviders au lieu de item.apiDetails.providers ou item.availableOn

        createPlatformIconsHTML(providers) {
            if (!providers || providers.length === 0) return '';
            
            // On ne montre que les plateformes que l'utilisateur a configurées
            const myProviders = providers.filter(p => this.myPlatformIds.includes(this.getInternalPlatformId(p.provider_name)));
            
            if (myProviders.length === 0) return ''; // Ou afficher 'Not on your apps'

            return myProviders.map(p => {
                const logo = p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : p.logoUrl;
                return `<img src="${logo}" alt="${p.provider_name}" class="h-4 w-4 rounded-sm" title="${p.provider_name}">`;
            }).join('');
        },

        // ... [Reste des fonctions helpers, renderMedia, etc.] ...
        // Assurez-vous d'appeler createPlatformIconsHTML(item.dynamicProviders) dans le rendu
    }));
});
