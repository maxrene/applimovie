document.addEventListener('alpine:init', () => {
    Alpine.data('popularPage', () => ({
        activeTab: 'movie', // 'movie' ou 'tv'
        items: [],
        isLoading: true,
        showServiceBar: false,
        
        // Filtres
        activePlatformFilters: [],
        userSelectedPlatforms: [],
        myPlatformIds: [],
        userRegion: localStorage.getItem('userRegion') || 'FR',
        sortOrder: 'popularity.desc',

        // Mapping interne pour convertir nos IDs (netflix) en IDs TMDB (8)
        // Ces IDs sont spécifiques pour la France/Europe en général, mais peuvent varier légèrement.
        // 8: Netflix, 119: Prime, 337: Disney+, 350: AppleTV+, 392: Canal+, 531: Paramount+
        tmdbProviderMap: {
            'netflix': 8,
            'prime': 119,
            'disney': 337,
            'apple': 350,
            'canal': 392, // Canal+ VOD/Series
            'paramount': 531,
            'max': 1899,
            'skygo': 29,
            'now': 39
        },

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

        init() {
            // Gestion du drapeau
            const flagImg = document.getElementById('header-flag');
            if (flagImg) {
                flagImg.src = `https://flagcdn.com/w40/${this.userRegion.toLowerCase()}.png`;
            }

            // Charger les plateformes de l'utilisateur
            const savedPlatforms = localStorage.getItem('selectedPlatforms');
            this.myPlatformIds = savedPlatforms ? JSON.parse(savedPlatforms) : [];

            // Préparer l'affichage des bulles
            this.userSelectedPlatforms = this.availablePlatforms.filter(p => 
                this.myPlatformIds.includes(p.id)
            );

            // Watchers pour recharger quand on change un filtre
            this.$watch('activePlatformFilters', () => this.fetchContent());
            
            this.fetchContent();
        },

        switchTab(tab) {
            this.activeTab = tab;
            this.fetchContent();
        },

        setSort(order) {
            this.sortOrder = order;
            this.fetchContent();
        },

        togglePlatformFilter(platformId) {
            if (this.activePlatformFilters.includes(platformId)) {
                this.activePlatformFilters = this.activePlatformFilters.filter(id => id !== platformId);
            } else {
                this.activePlatformFilters.push(platformId);
            }
        },

        async fetchContent() {
            this.isLoading = true;
            this.items = [];

            // Construction de la liste des IDs providers pour l'API
            // Si aucun filtre n'est cliqué dans le tiroir, on utilise TOUTES les plateformes de l'utilisateur (par défaut)
            // Si des filtres sont cliqués, on utilise seulement ceux-là.
            let targetPlatforms = this.activePlatformFilters.length > 0 
                ? this.activePlatformFilters 
                : this.myPlatformIds;

            // Conversion en IDs numériques TMDB (ex: 'netflix' -> 8)
            const providerIds = targetPlatforms
                .map(id => this.tmdbProviderMap[id])
                .filter(id => id !== undefined) // Enlever les inconnus
                .join('|'); // Le pipe '|' signifie OU pour l'API TMDB

            // Construction de l'URL API
            // On utilise /discover pour pouvoir filtrer par providers
            const endpoint = this.activeTab === 'movie' ? '/discover/movie' : '/discover/tv';
            let url = `https://api.themoviedb.org/3${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`;
            
            // Paramètres de tri et de région
            url += `&sort_by=${this.sortOrder}`;
            url += `&watch_region=${this.userRegion}`;
            
            // Ajouter le filtre de providers SEULEMENT si on a des providers à filtrer
            if (providerIds.length > 0) {
                url += `&with_watch_providers=${providerIds}`;
            }

            try {
                const res = await fetch(url);
                const data = await res.json();
                
                if (data.results) {
                    this.items = data.results.map(item => ({
                        id: item.id,
                        title: this.activeTab === 'movie' ? item.title : item.name,
                        poster_path: item.poster_path 
                            ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
                            : 'https://placehold.co/300x450?text=No+Image',
                        vote_average: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
                        year: (item.release_date || item.first_air_date || '').split('-')[0],
                        media_type: this.activeTab // Force le type pour les liens
                    }));
                }
            } catch (error) {
                console.error("Erreur lors du chargement :", error);
            } finally {
                this.isLoading = false;
            }
        }
    }));
});
