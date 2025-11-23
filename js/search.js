document.addEventListener('alpine:init', () => {
    Alpine.data('search', () => ({
        searchQuery: '',
        searchResults: [],
        previousSearches: [],
        popularSearches: [],
        errorMessage: '',

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
            switch (item.media_type) {
                case 'movie': url = `film.html?id=${item.id}`; break;
                case 'tv': url = `serie.html?id=${item.id}`; break;
                case 'person': url = `person.html?id=${item.id}`; break;
                default: return;
            }
            window.location.href = url;
        },

        clearHistory() {
            this.previousSearches = [];
            localStorage.removeItem('previousSearches');
        },

        getItemType(item, forPopular = false) {
             const mediaType = forPopular ? item.media_type : (item.media_type || (item.known_for_department ? 'person' : 'movie'));
            switch (mediaType) {
                case 'movie': return 'Film';
                case 'tv': return 'Série TV';
                case 'person': return 'Acteur';
                default: return 'Inconnu';
            }
        }
    }));
});
