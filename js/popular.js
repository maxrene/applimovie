document.addEventListener('alpine:init', () => {
    Alpine.data('popularPage', () => ({
        activeTab: 'movie',
        items: [],
        isLoading: true,
        isLoadingMore: false,
        showServiceBar: false,
        
        currentPage: 1,
        totalPages: 1,

        userRegion: localStorage.getItem('userRegion') || 'FR',
        sortOrder: 'popularity.desc',
        lastUpdate: Date.now(),
        
        // Filter states
        yearStart: 1900,
        yearEnd: new Date().getFullYear(),
        selectedGenres: [],
        availableGenres: [],

        // Modal states
        openSort: false,
        openYear: false,
        openGenre: false,

        // Temporary states for filters (before applying)
        tempYearStart: 1900,
        tempYearEnd: new Date().getFullYear(),
        tempSelectedGenres: [],

        get sortLabel() {
            if (this.sortOrder === 'popularity.desc') return 'Popularité';
            if (this.sortOrder === 'vote_average.desc') return 'Mieux notés';
            return 'Récents';
        },

        get yearLabel() {
            const currentYear = new Date().getFullYear();
            if (this.yearStart === 1900 && this.yearEnd === currentYear) return 'Année';
            if (this.yearStart === this.yearEnd) return `${this.yearStart}`;
            return `${this.yearStart}-${this.yearEnd}`;
        },

        get genreLabel() {
            if (this.selectedGenres.length === 0) return 'Genres';
            if (this.selectedGenres.length === 1) {
                const genre = this.availableGenres.find(g => g.id === this.selectedGenres[0]);
                return genre ? genre.name : '1 sélectionné';
            }
            return `${this.selectedGenres.length} sélectionnés`;
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
            const flagImg = document.getElementById('header-flag');
            if (flagImg) flagImg.src = `https://flagcdn.com/w40/${this.userRegion.toLowerCase()}.png`;

            window.addEventListener('pageshow', () => {
                this.lastUpdate = Date.now();
            });

            this.resetFilters();
            this.fetchGenres();
            this.resetAndFetch();
        },

        switchTab(tab) {
            this.activeTab = tab;
            this.resetFilters();
            this.fetchGenres(); // Fetch genres for new type
            this.resetAndFetch();
        },

        resetFilters() {
            const currentYear = new Date().getFullYear();
            this.yearStart = 1900;
            this.yearEnd = currentYear;
            this.selectedGenres = [];

            this.tempYearStart = 1900;
            this.tempYearEnd = currentYear;
            this.tempSelectedGenres = [];
        },

        async fetchGenres() {
            const type = this.activeTab === 'movie' ? 'movie' : 'tv';
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

        // Year Filter Actions
        openYearModal() {
            this.tempYearStart = this.yearStart;
            this.tempYearEnd = this.yearEnd;
            this.openYear = true;
        },

        applyYearFilter() {
            this.yearStart = parseInt(this.tempYearStart);
            this.yearEnd = parseInt(this.tempYearEnd);
            this.openYear = false;
            this.resetAndFetch();
        },

        clearYearFilter() {
            this.tempYearStart = 1900;
            this.tempYearEnd = new Date().getFullYear();
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

        // Genre Filter Actions
        openGenreModal() {
            this.tempSelectedGenres = [...this.selectedGenres];
            this.openGenre = true;
        },

        toggleGenre(id) {
            if (this.tempSelectedGenres.includes(id)) {
                this.tempSelectedGenres = this.tempSelectedGenres.filter(g => g !== id);
            } else {
                this.tempSelectedGenres.push(id);
            }
        },

        applyGenreFilter() {
            this.selectedGenres = [...this.tempSelectedGenres];
            this.openGenre = false;
            this.resetAndFetch();
        },

        clearGenreFilter() {
            this.tempSelectedGenres = [];
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

        async fetchContent(page) {
            if (page === 1) this.isLoading = true;
            else this.isLoadingMore = true;

            const endpoint = this.activeTab === 'movie' ? '/discover/movie' : '/discover/tv';
            let url = `https://api.themoviedb.org/3${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
            
            url += `&sort_by=${this.sortOrder}`;
            url += `&watch_region=${this.userRegion}`;
            url += `&vote_count.gte=100`;

            // Apply Year Filter
            if (this.yearStart > 1900 || this.yearEnd < new Date().getFullYear()) {
                if (this.activeTab === 'movie') {
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
