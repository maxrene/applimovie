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
        
        // Label pour le tri affiché
        get sortLabel() {
            if (this.sortOrder === 'popularity.desc') return 'Popularité';
            if (this.sortOrder === 'vote_average.desc') return 'Mieux notés';
            return 'Récents';
        },

        getMediaStatus(item) {
             const id = item.id;
             const type = item.media_type === 'tv' ? 'serie' : 'movie';

             // Watchlist
             const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
             const isInWatchlist = watchlist.some(w => w.id == id);
             if (isInWatchlist) return 'watchlist';

             // Watched
             const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
             const watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];

             const isWatched = (type === 'movie' && watchedMovies.includes(Number(id))) ||
                               (type === 'serie' && watchedSeries.includes(Number(id)));

             if (isWatched) return 'watched';

             return null;
        },

        init() {
            const flagImg = document.getElementById('header-flag');
            if (flagImg) flagImg.src = `https://flagcdn.com/w40/${this.userRegion.toLowerCase()}.png`;

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

                    // Filtrage des doublons pour le chargement infini
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
