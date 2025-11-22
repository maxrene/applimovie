document.addEventListener('alpine:init', () => {
    Alpine.data('search', () => ({
        searchQuery: '',
        searchResults: [],
        previousSearches: [],
        popularSearches: [],

        init() {
            this.previousSearches = JSON.parse(localStorage.getItem('previousSearches')) || [];
            this.fetchPopular();

            this.$watch('searchQuery', (newValue) => {
                if (newValue.length > 1) {
                    this.fetchResults();
                } else {
                    this.searchResults = [];
                }
            });
        },

        async fetchPopular() {
            try {
                const response = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${window.TMDB_API_KEY}&language=fr-FR&watch_region=FR`);
                const data = await response.json();
                this.popularSearches = data.results.slice(0, 10);
            } catch (error) {
                console.error('Erreur lors de la récupération des recherches populaires:', error);
            }
        },

        async fetchResults() {
            if (this.searchQuery.length <= 1) return;
            try {
                const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${window.TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(this.searchQuery)}&include_adult=false&watch_region=FR`);
                const data = await response.json();
                this.searchResults = data.results.filter(item => ['movie', 'tv'].includes(item.media_type));
            } catch (error) {
                console.error('Erreur lors de la recherche:', error);
            }
        },

        handleItemClick(item) {
            // Save to previous searches
            let history = JSON.parse(localStorage.getItem('previousSearches')) || [];
            // Avoid duplicates
            history = history.filter(i => i.id !== item.id);
            history.unshift(item);
            // Keep only the last 10 searches
            history = history.slice(0, 10);
            localStorage.setItem('previousSearches', JSON.stringify(history));

            // Navigate to the correct page
            let url = '';
            switch (item.media_type) {
                case 'movie':
                    url = `film.html?id=${item.id}`;
                    break;
                case 'tv':
                    url = `serie.html?id=${item.id}`;
                    break;
                case 'person':
                    url = `person.html?id=${item.id}`;
                    break;
                default:
                    console.warn(`Unknown media type for navigation: ${item.media_type}`);
                    return; // Do not navigate for unknown types
            }
            window.location.href = url;
        },

        getItemType(item, forPopular = false) {
             const mediaType = forPopular ? item.media_type : (item.media_type || (item.known_for_department ? 'person' : 'movie'));
            switch (mediaType) {
                case 'movie':
                    return 'Film';
                case 'tv':
                    return 'Série TV';
                case 'person':
                    return 'Acteur';
                default:
                    return 'Inconnu';
            }
        }
    }));
});
