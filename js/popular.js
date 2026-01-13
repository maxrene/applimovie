document.addEventListener('alpine:init', () => {
    Alpine.data('popularPage', () => ({
        subTab: 'movie', // Use subTab to avoid conflict with global activeTab
        items: [],
        isLoading: true,
        isLoadingMore: false,
        showServiceBar: false,
        
        currentPage: 1,
        totalPages: 1,

        userRegion: localStorage.getItem('userRegion') || 'FR',
        sortOrder: 'popularity.desc',
        lastUpdate: Date.now(),
        
        // Platform Mapping
        allPlatforms: [
            { id: 'netflix', apiId: 8, name: 'Netflix', logoUrl: 'https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456' },
            { id: 'prime', apiId: 119, name: 'Prime Video', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Amazon_Prime_Video_logo_%282024%29.svg/1024px-Amazon_Prime_Video_logo_%282024%29.svg.png' },
            { id: 'disney', apiId: 337, name: 'Disney+', logoUrl: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/25357066/Disney__Logo_March_2024.png?quality=90&strip=all&crop=0,0,100,100' },
            { id: 'apple', apiId: 350, name: 'Apple TV+', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/AppleTVLogo.svg/768px-AppleTVLogo.svg.png' },
            { id: 'canal', apiId: 392, name: 'Canal+', logoUrl: 'https://static1.purepeople.com/articles/0/46/23/10/@/6655765-logo-de-la-chaine-canal-1200x0-2.png' },
            { id: 'paramount', apiId: 531, name: 'Paramount+', logoUrl: 'https://images.seeklogo.com/logo-png/39/1/paramount-logo-png_seeklogo-397501.png' },
            { id: 'max', apiId: 1899, name: 'Max', logoUrl: 'https://logo.clearbit.com/max.com' },
            { id: 'skygo', apiId: 29, name: 'Sky Go', logoUrl: 'https://logo.clearbit.com/sky.com' },
            { id: 'now', apiId: 39, name: 'Now', logoUrl: 'https://logo.clearbit.com/nowtv.com' },
            { id: 'rakuten', apiId: 35, name: 'Rakuten TV', logoUrl: 'https://logo.clearbit.com/rakuten.tv' },
            { id: 'pluto', apiId: 300, name: 'Pluto TV', logoUrl: 'https://logo.clearbit.com/pluto.tv' },
            { id: 'crunchyroll', apiId: 283, name: 'Crunchyroll', logoUrl: 'https://logo.clearbit.com/crunchyroll.com' },
            { id: 'arte', apiId: 234, name: 'Arte', logoUrl: 'https://logo.clearbit.com/arte.tv' }
        ],

        // Filter states
        yearStart: 1900,
        yearEnd: new Date().getFullYear(),
        selectedGenres: [],
        availableGenres: [],
        filterRating: 0, // 0 means any, 7, 8, 9
        filterPlatform: null, // null means all, otherwise apiId

        userPlatforms: [],

        // Modal states
        openSort: false,
        openFilter: false,
        openPlatform: false,

        // Temporary states for filters (before applying)
        tempYearStart: 1900,
        tempYearEnd: new Date().getFullYear(),
        tempSelectedGenres: [],
        tempFilterRating: 0,

        get sortLabel() {
            if (this.sortOrder === 'popularity.desc') return 'Popularité';
            if (this.sortOrder === 'vote_average.desc') return 'Mieux notés';
            return 'Récents';
        },

        getMediaStatus(item) {
             this.lastUpdate;

             const id = item.id;
             const type = item.media_type === 'tv' ? 'serie' : 'movie';

             const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
             const watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];

             const isWatched = (type === 'movie' && watchedMovies.includes(Number(id))) ||
                               (type === 'serie' && watchedSeries.includes(Number(id)));

             if (isWatched) return 'watched';

             const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
             const isInWatchlist = watchlist.some(w => w.id == id);
             if (isInWatchlist) return 'watchlist';

             return null;
        },

        init() {
            // SPA specific logic: Listen to global view change
            window.addEventListener('view-changed', () => {
                 this.lastUpdate = Date.now();
                 this.loadUserPlatforms(); // Reload platforms in case user changed them
            });

            // Keep pageshow for initial load or back/forward cache
            window.addEventListener('pageshow', () => {
                this.lastUpdate = Date.now();
                this.loadUserPlatforms();
            });

            this.loadUserPlatforms();
            this.resetFilters();
            this.fetchGenres();
            this.resetAndFetch();
        },

        loadUserPlatforms() {
            try {
                const selectedIds = JSON.parse(localStorage.getItem('selectedPlatforms')) || [];
                // Map the string IDs (e.g. 'netflix') to full platform objects
                this.userPlatforms = this.allPlatforms.filter(p => selectedIds.includes(p.id));
            } catch (e) {
                console.error("Error loading user platforms:", e);
                this.userPlatforms = [];
            }
        },

        setSubTab(tab) {
            this.subTab = tab;
            this.resetFilters();
            this.fetchGenres();
            this.resetAndFetch();
        },

        resetFilters() {
            const currentYear = new Date().getFullYear();
            this.yearStart = 1900;
            this.yearEnd = currentYear;
            this.selectedGenres = [];
            this.filterRating = 0;
            this.filterPlatform = null;

            this.tempYearStart = 1900;
            this.tempYearEnd = currentYear;
            this.tempSelectedGenres = [];
            this.tempFilterRating = 0;
        },

        async fetchGenres() {
            const type = this.subTab === 'movie' ? 'movie' : 'tv';
            try {
                const res = await fetch(`https://api.themoviedb.org/3/genre/${type}/list?api_key=${TMDB_API_KEY}&language=fr-FR`);
                const data = await res.json();
                if (data.genres) {
                    this.availableGenres = data.genres;
                }
            } catch (error) {
                console.error("Error fetching genres:", error);
            }
        },

        // Sort Actions
        setSort(order) {
            this.sortOrder = order;
            this.openSort = false;
            this.resetAndFetch();
        },

        // Combined Filter Modal Actions
        openFilterModal() {
            this.tempYearStart = this.yearStart;
            this.tempYearEnd = this.yearEnd;
            this.tempSelectedGenres = [...this.selectedGenres];
            this.tempFilterRating = this.filterRating;
            this.openFilter = true;
        },

        applyAllFilters() {
            this.yearStart = parseInt(this.tempYearStart);
            this.yearEnd = parseInt(this.tempYearEnd);
            this.selectedGenres = [...this.tempSelectedGenres];
            this.filterRating = this.tempFilterRating;

            this.openFilter = false;
            this.resetAndFetch();
        },

        clearAllFilters() {
            this.tempYearStart = 1900;
            this.tempYearEnd = new Date().getFullYear();
            this.tempSelectedGenres = [];
            this.tempFilterRating = 0;
        },

        setYearPreset(preset) {
            const currentYear = new Date().getFullYear();
            if (preset === 'this_year') {
                this.tempYearStart = currentYear;
                this.tempYearEnd = currentYear;
            } else if (preset === 'last_year') {
                this.tempYearStart = currentYear - 1;
                this.tempYearEnd = currentYear - 1;
            }
        },

        toggleGenre(id) {
            if (this.tempSelectedGenres.includes(id)) {
                this.tempSelectedGenres = this.tempSelectedGenres.filter(g => g !== id);
            } else {
                this.tempSelectedGenres.push(id);
            }
        },

        setRatingFilter(rating) {
            if (this.tempFilterRating === rating) {
                this.tempFilterRating = 0; // Toggle off if already selected
            } else {
                this.tempFilterRating = rating;
            }
        },

        // Platform Filter Actions
        togglePlatform(apiId) {
            if (this.filterPlatform === apiId) {
                this.filterPlatform = null; // Toggle off
            } else {
                this.filterPlatform = apiId;
            }
            this.openPlatform = false;
            this.resetAndFetch();
        },

        resetAndFetch() {
            this.currentPage = 1;
            this.items = [];
            this.fetchContent(1);
        },

        loadMore() {
            if (!this.isLoading && !this.isLoadingMore && this.currentPage < this.totalPages) {
                this.fetchContent(this.currentPage + 1);
            }
        },

        handleScroll(e) {
            const el = e.target;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
                this.loadMore();
            }
        },

        formatYear(item) {
            const dateStr = item.release_date || item.first_air_date;
            const startYear = dateStr ? dateStr.split('-')[0] : '';

            if (this.subTab === 'tv' || item.media_type === 'tv') {
                const seriesDatesCache = JSON.parse(localStorage.getItem('seriesDatesCache')) || {};
                const cached = seriesDatesCache[item.id];

                if (cached) {
                    if (cached.status === 'Returning Series') {
                        return `${cached.start} - Présent`;
                    } else if (cached.status === 'Ended') {
                        return (cached.end && cached.start !== cached.end) ? `${cached.start} - ${cached.end}` : cached.start;
                    }
                }
            }
            return startYear;
        },

        async fetchContent(page) {
            if (page === 1) this.isLoading = true;
            else this.isLoadingMore = true;

            const endpoint = this.subTab === 'movie' ? '/discover/movie' : '/discover/tv';
            let url = `https://api.themoviedb.org/3${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
            
            url += `&sort_by=${this.sortOrder}`;
            url += `&watch_region=${this.userRegion}`;
            url += `&vote_count.gte=100`;

            // Apply Year Filter
            if (this.yearStart > 1900 || this.yearEnd < new Date().getFullYear()) {
                if (this.subTab === 'movie') {
                    url += `&primary_release_date.gte=${this.yearStart}-01-01`;
                    url += `&primary_release_date.lte=${this.yearEnd}-12-31`;
                } else {
                    url += `&first_air_date.gte=${this.yearStart}-01-01`;
                    url += `&first_air_date.lte=${this.yearEnd}-12-31`;
                }
            }

            // Apply Genre Filter (OR logic: pipe separated)
            if (this.selectedGenres.length > 0) {
                url += `&with_genres=${this.selectedGenres.join('|')}`;
            }

            // Apply Rating Filter
            if (this.filterRating > 0) {
                url += `&vote_average.gte=${this.filterRating}`;
            }

            // Apply Platform Filter
            if (this.filterPlatform) {
                url += `&with_watch_providers=${this.filterPlatform}`;
            }
            
            try {
                const res = await fetch(url);
                const data = await res.json();
                
                if (data.results) {
                    const newItems = data.results.map(item => ({
                        id: item.id,
                        title: this.subTab === 'movie' ? item.title : item.name,
                        poster_path: item.poster_path 
                            ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
                            : 'https://placehold.co/300x450?text=No+Image',
                        vote_average: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
                        year: this.formatYear(item),
                        media_type: this.subTab
                    }));

                    if (page === 1) {
                        this.items = newItems;
                    } else {
                        const existingIds = new Set(this.items.map(i => i.id));
                        const filteredNew = newItems.filter(i => !existingIds.has(i.id));
                        this.items = [...this.items, ...filteredNew];
                    }
                    
                    this.currentPage = data.page;
                    this.totalPages = data.total_pages;
                }
            } catch (error) {
                console.error("Erreur:", error);
            } finally {
                this.isLoading = false;
                this.isLoadingMore = false;
            }
        }
    }));
});
