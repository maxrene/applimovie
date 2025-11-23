document.addEventListener('alpine:init', () => {
    Alpine.data('popularPage', () => ({
        activeTab: 'movie',
        items: [],
        isLoading: true,      // Chargement initial (gros spinner)
        isLoadingMore: false, // Chargement suite (petit spinner en bas)
        showServiceBar: false,
        
        // Pagination
        currentPage: 1,
        totalPages: 1,

        // Filtres
        activePlatformFilters: [],
        userSelectedPlatforms: [],
        myPlatformIds: [],
        userRegion: localStorage.getItem('userRegion') || 'FR',
        sortOrder: 'popularity.desc',

        tmdbProviderMap: {
            'netflix': 8, 'prime': 119, 'disney': 337, 'apple': 350,
            'canal': 392, 'paramount': 531, 'max': 1899, 'skygo': 29, 'now': 39
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
            const flagImg = document.getElementById('header-flag');
            if (flagImg) flagImg.src = `https://flagcdn.com/w40/${this.userRegion.toLowerCase()}.png`;

            const savedPlatforms = localStorage.getItem('selectedPlatforms');
            this.myPlatformIds = savedPlatforms ? JSON.parse(savedPlatforms) : [];

            this.userSelectedPlatforms = this.availablePlatforms.filter(p => 
                this.myPlatformIds.includes(p.id)
            );

            this.$watch('activePlatformFilters', () => this.resetAndFetch());
            
            this.resetAndFetch();
        },

        switchTab(tab) {
            this.activeTab = tab;
            this.resetAndFetch();
        },

        setSort(order) {
            this.sortOrder = order;
            this.resetAndFetch();
        },

        togglePlatformFilter(platformId) {
            if (this.activePlatformFilters.includes(platformId)) {
                this.activePlatformFilters = this.activePlatformFilters.filter(id => id !== platformId);
            } else {
                this.activePlatformFilters.push(platformId);
            }
        },

        // Réinitialise la liste pour une nouvelle recherche (filtre, tri...)
        resetAndFetch() {
            this.currentPage = 1;
            this.items = []; // Vide la liste
            this.fetchContent(1);
        },

        // Charge la page suivante (Scroll infini)
        loadMore() {
            if (!this.isLoading && !this.isLoadingMore && this.currentPage < this.totalPages) {
                this.fetchContent(this.currentPage + 1);
            }
        },

        // Détection du scroll (appelé depuis le HTML)
        handleScroll(e) {
            const el = e.target;
            // Si on est à 300px du bas, on charge la suite
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
                this.loadMore();
            }
        },

        async fetchContent(page) {
            if (page === 1) this.isLoading = true;
            else this.isLoadingMore = true;

            let targetPlatforms = this.activePlatformFilters.length > 0 
                ? this.activePlatformFilters 
                : this.myPlatformIds;

            const providerIds = targetPlatforms
                .map(id => this.tmdbProviderMap[id])
                .filter(id => id !== undefined)
                .join('|');

            const endpoint = this.activeTab === 'movie' ? '/discover/movie' : '/discover/tv';
            let url = `https://api.themoviedb.org/3${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
            
            url += `&sort_by=${this.sortOrder}`;
            url += `&watch_region=${this.userRegion}`;
            
            if (providerIds.length > 0) {
                url += `&with_watch_providers=${providerIds}`;
            }

            try {
                const res = await fetch(url);
                const data = await res.json();
                
                if (data.results) {
                    const newItems = data.results.map(item => ({
                        id: item.id,
                        title: this.activeTab === 'movie' ? item.title : item.name,
                        poster_path: item.poster_path 
                            ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
                            : 'https://placehold.co/300x450?text=No+Image',
                        vote_average: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
                        year: (item.release_date || item.first_air_date || '').split('-')[0],
                        media_type: this.activeTab
                    }));

                    if (page === 1) {
                        this.items = newItems;
                    } else {
                        // Ajoute à la suite sans doublons (sécurité)
                        const existingIds = new Set(this.items.map(i => i.id));
                        const filteredNew = newItems.filter(i => !existingIds.has(i.id));
                        this.items = [...this.items, ...filteredNew];
                    }
                    
                    this.currentPage = data.page;
                    this.totalPages = data.total_pages;
                }
            } catch (error) {
                console.error("Erreur lors du chargement :", error);
            } finally {
                this.isLoading = false;
                this.isLoadingMore = false;
            }
        }
    }));
});
