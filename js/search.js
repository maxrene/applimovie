document.addEventListener('alpine:init', () => {
    Alpine.data('search', () => ({
        searchQuery: '',
        searchResults: [],
        previousSearches: [],
        popularSearches: [],
        errorMessage: '',
        lastUpdate: Date.now(),

        init() {
            const userRegion = localStorage.getItem('userRegion') || 'FR';
            const flagImg = document.getElementById('header-flag');
            if (flagImg) {
                flagImg.src = `https://flagcdn.com/w40/${userRegion.toLowerCase()}.png`;
                flagImg.alt = userRegion;
            }
            // Vérification de la clé API au démarrage
            if (!window.TMDB_API_KEY) {
                console.error("ERREUR CRITIQUE : TMDB_API_KEY est introuvable ! Vérifiez que config.js est bien chargé.");
                this.errorMessage = "Erreur de configuration : Clé API manquante.";
            }

            this.previousSearches = JSON.parse(localStorage.getItem('previousSearches')) || [];
            this.fetchPopular();

            this.$watch('searchQuery', (newValue) => {
                if (newValue.length > 1) {
                    this.fetchResults();
                } else {
                    this.searchResults = [];
                }
            });

            window.addEventListener('pageshow', () => {
                this.lastUpdate = Date.now();
                // Refresh previous searches as well since they are stored in localStorage
                this.previousSearches = JSON.parse(localStorage.getItem('previousSearches')) || [];
            });
        },

        async fetchPopular() {
            if (!window.TMDB_API_KEY) return;
            try {
                const response = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${window.TMDB_API_KEY}&language=fr-FR&watch_region=FR`);
                if (!response.ok) throw new Error(`Erreur API Popular: ${response.status}`);
                
                const data = await response.json();
                if (data.results) {
                    this.popularSearches = data.results.slice(0, 10);
                }
            } catch (error) {
                console.error('Erreur popular:', error);
            }
        },

        async fetchResults() {
            if (this.searchQuery.length <= 1) return;
            if (!window.TMDB_API_KEY) return;

            try {
                const url = `https://api.themoviedb.org/3/search/multi?api_key=${window.TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(this.searchQuery)}&include_adult=false&watch_region=FR`;
                
                const response = await fetch(url);
                if (!response.ok) {
                    // Si erreur 401/404, on ne plante pas toute la page
                    console.error(`Erreur API Search: ${response.status}`);
                    return;
                }

                const data = await response.json();
                
                // Vérification de sécurité avant d'utiliser .filter
                if (data.results) {
                    this.searchResults = data.results.filter(item => ['movie', 'tv'].includes(item.media_type));
                } else {
                    this.searchResults = [];
                }

            } catch (error) {
                console.error('Erreur lors de la recherche:', error);
            }
        },

        handleItemClick(item) {
            let history = JSON.parse(localStorage.getItem('previousSearches')) || [];
            history = history.filter(i => i.id !== item.id);
            history.unshift(item);
            history = history.slice(0, 10);
            localStorage.setItem('previousSearches', JSON.stringify(history));

            let url = '';
            // Ensure media_type is present for routing
            if (!item.media_type) {
                if (item.title) item.media_type = 'movie';
                else if (item.name) item.media_type = 'tv';
            }

            switch (item.media_type) {
                case 'movie': url = `film.html?id=${item.id}`; break;
                case 'tv': url = `serie.html?id=${item.id}`; break;
                case 'person': url = `person.html?id=${item.id}`; break;
                default: return;
            }
            window.location.href = url;
        },

        getItemType(item, forPopular = false) {
             const mediaType = forPopular ? item.media_type : (item.media_type || (item.known_for_department ? 'person' : 'movie'));
            switch (mediaType) {
                case 'movie': return 'Film';
                case 'tv': return 'Série TV';
                case 'person': return 'Acteur';
                default: return 'Inconnu';
            }
        },

        getMediaStatus(item) {
             // Dependency on lastUpdate to trigger re-render
             this.lastUpdate;

             const id = item.id;
             let type = item.media_type;
             if (!type) {
                if (item.title) type = 'movie';
                else if (item.name) type = 'tv';
             }

             // Normalize tv -> serie for local storage check if needed, but here we just need movie vs tv/serie logic

             // Watched
             const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
             const watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];

             // Check based on type
             const isMovie = type === 'movie';
             const isSerie = type === 'tv' || type === 'serie';

             const isWatched = (isMovie && watchedMovies.includes(Number(id))) ||
                               (isSerie && watchedSeries.includes(Number(id)));

             if (isWatched) return 'watched';

             // Watchlist
             const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
             const isInWatchlist = watchlist.some(w => w.id == id);
             if (isInWatchlist) return 'watchlist';

             return null;
        },

        clearHistory() {
            this.previousSearches = [];
            localStorage.removeItem('previousSearches');
        }
    }));
});
