const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_PROFILE = 'https://image.tmdb.org/t/p/w185';

// On déclare une fonction globale simple
function personProfile() {
    return {
        person: {
            name: '',
            biography: '',
            profile_path: null,
            images: {}
        },
        credits: [],
        activeTab: 'tout', // 'tout', 'movie', 'tv'
        sortBy: 'popularity', // 'popularity', 'date'
        isBioExpanded: false,
        isLoading: true,
        isFavorite: false,

        async init() {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const personId = urlParams.get('id');

                if (!personId) {
                    console.error("Person ID is missing from the URL");
                    this.isLoading = false;
                    return;
                }

                this.checkIfFavorite(personId);
                await this.fetchPersonDetails(personId);
            } catch (error) {
                console.error("Initialization error:", error);
                this.isLoading = false;
            }
        },

        checkIfFavorite(id) {
            const favorites = JSON.parse(localStorage.getItem('favoriteActors')) || [];
            this.isFavorite = favorites.some(actor => actor.id == id);
        },

        toggleFavorite() {
            const favorites = JSON.parse(localStorage.getItem('favoriteActors')) || [];
            const index = favorites.findIndex(actor => actor.id == this.person.id);

            if (index > -1) {
                // Remove
                favorites.splice(index, 1);
                this.isFavorite = false;
            } else {
                // Add
                favorites.push({
                    id: this.person.id,
                    name: this.person.name,
                    profile_path: this.person.profile_path
                });
                this.isFavorite = true;
            }
            localStorage.setItem('favoriteActors', JSON.stringify(favorites));
        },

        async fetchPersonDetails(personId) {
            if (typeof TMDB_API_KEY === 'undefined') {
                console.error("TMDB_API_KEY is not defined. Check config.js.");
                this.isLoading = false;
                return;
            }

            const url = `${BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=movie_credits,tv_credits`;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch person details: ${response.statusText}`);
                }
                const data = await response.json();
                this.processData(data);
            } catch (error) {
                console.error(error);
            } finally {
                this.isLoading = false;
            }
        },

        processData(data) {
            document.title = `${data.name} | Actor Profile`;
            this.person = data;

            const films = (data.movie_credits.cast || []).concat(data.movie_credits.crew || []);
            const series = (data.tv_credits.cast || []).concat(data.tv_credits.crew || []);

            const processedFilms = this.normalizeMedia(films, 'movie');
            const processedSeries = this.normalizeMedia(series, 'tv');

            this.credits = [...processedFilms, ...processedSeries];
        },

        normalizeMedia(list, type) {
            const uniqueMap = new Map();

            list.forEach(item => {
                const id = item.id;
                if (id && !uniqueMap.has(id)) {
                    uniqueMap.set(id, {
                        id: id,
                        title: type === 'movie' ? (item.title || item.original_title) : (item.name || item.original_name),
                        poster_path: item.poster_path,
                        date: type === 'movie' ? item.release_date : item.first_air_date,
                        popularity: item.popularity || 0,
                        type: type
                    });
                }
            });

            return Array.from(uniqueMap.values());
        },

        get bioText() {
            const fullBio = this.person.biography || "No biography available.";
            const bioMaxLength = 300;

            if (this.isBioExpanded || fullBio.length <= bioMaxLength) {
                return fullBio;
            }
            return `${fullBio.substring(0, bioMaxLength)}...`;
        },

        get showReadMore() {
            return (this.person.biography || "").length > 300;
        },

        toggleBio() {
            this.isBioExpanded = !this.isBioExpanded;
        },

        toggleSort() {
            this.sortBy = this.sortBy === 'popularity' ? 'date' : 'popularity';
        },

        get filteredCredits() {
            let filtered = this.credits;

            if (this.activeTab !== 'tout') {
                filtered = filtered.filter(item => item.type === this.activeTab);
            }

            return filtered.sort((a, b) => {
                if (this.sortBy === 'popularity') {
                    return b.popularity - a.popularity;
                } else {
                    const dateA = new Date(a.date || '0000-01-01');
                    const dateB = new Date(b.date || '0000-01-01');
                    return dateB - dateA;
                }
            });
        },

        formatYear(dateString) {
            if (!dateString) return 'N/A';
            return new Date(dateString).getFullYear();
        },

        getImageUrl(path) {
            return path ? `${IMG_BASE_POSTER}${path}` : 'https://placehold.co/64x96';
        },

        getProfileUrl(path) {
            return path ? `${IMG_BASE_PROFILE}${path}` : 'https://placehold.co/160x160';
        },

        get sortLabel() {
            return this.sortBy === 'popularity' ? 'Popularité' : 'Année';
        }
    };
}
