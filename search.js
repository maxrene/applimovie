document.addEventListener('alpine:init', () => {
    Alpine.data('searchComponent', () => ({
        previousSearches: [],
        popularSearches: [],
        searchResults: [],
        searchQuery: '',
        loading: false,

        init() {
            this.loadPreviousSearches();
            this.loadPopularSearches();
        },

        loadPreviousSearches() {
            const searches = localStorage.getItem('previousSearches');
            if (searches) {
                try {
                    const parsed = JSON.parse(searches);
                    if (Array.isArray(parsed)) {
                        this.previousSearches = parsed;
                    } else {
                        this.previousSearches = [];
                        localStorage.removeItem('previousSearches');
                    }
                } catch (e) {
                    console.error("Failed to parse previousSearches from localStorage", e);
                    this.previousSearches = [];
                    localStorage.removeItem('previousSearches');
                }
            }
        },

        async loadPopularSearches() {
            try {
                const response = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=fr-FR&watch_region=FR`);
                const data = await response.json();
                this.popularSearches = data.results.slice(0, 10);
            } catch (error) {
                console.error('Error fetching popular searches:', error);
                // Fallback to static data if API fails
                this.popularSearches = window.popularSearchesData || [];
            }
        },

        getMediaType(media_type) {
            switch (media_type) {
                case 'movie': return 'Film';
                case 'tv': return 'Série';
                case 'person': return 'Personne';
                default: return '';
            }
        },

        handleSearch() {
            if (this.searchQuery.length < 2) {
                this.searchResults = [];
                this.loading = false;
                return;
            }
            this.loading = true;
            this.debouncedSearch();
        },

        debouncedSearch: _.debounce(async function() {
            if (this.searchQuery.length > 1) {
                try {
                    const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(this.searchQuery)}&page=1&include_adult=false&watch_region=FR`);
                    const data = await response.json();
                    this.searchResults = data.results;
                } catch (error) {
                    console.error('Error during search:', error);
                } finally {
                    this.loading = false;
                }
            } else {
                this.searchResults = [];
                this.loading = false;
            }
        }, 300)
    }));
});

// Static data for fallback
window.popularSearchesData = [
    { id: 1022789, title: "Inside Out 2", name: "Inside Out 2", poster_path: "/6VkapHlYxlTvSkm54NsoZpStKzU.jpg", vote_average: 7.7, media_type: "movie" },
    { id: 94997, title: "House of the Dragon", name: "House of the Dragon", poster_path: "/5w2pzqztzG3vgr4glg2bT2Pl2w7.jpg", vote_average: 8.4, media_type: "tv" },
    { id: 693134, title: "Dune: Part Two", name: "Dune: Part Two", poster_path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", vote_average: 8.2, media_type: "movie" },
    { id: 1399, title: "Game of Thrones", name: "Game of Thrones", poster_path: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", vote_average: 8.4, media_type: "tv" }
];
