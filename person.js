const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_PROFILE = 'https://image.tmdb.org/t/p/w185';

document.addEventListener('alpine:init', () => {
    Alpine.data('personProfile', () => ({
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

        async init() {
            const urlParams = new URLSearchParams(window.location.search);
            const personId = urlParams.get('id');

            if (!personId) {
                console.error("Person ID is missing from the URL");
                this.isLoading = false;
                return;
            }

            await this.fetchPersonDetails(personId);
        },

        async fetchPersonDetails(personId) {
            // TMDB_API_KEY is expected to be defined in config.js
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
            // Update Person Info
            document.title = `${data.name} | Actor Profile`;
            this.person = data;

            // Process Credits
            const films = (data.movie_credits.cast || []).concat(data.movie_credits.crew || []);
            const series = (data.tv_credits.cast || []).concat(data.tv_credits.crew || []);

            // Normalize and deduplicate
            const processedFilms = this.normalizeMedia(films, 'movie');
            const processedSeries = this.normalizeMedia(series, 'tv');

            // Combine all unique credits
            // We need to deduplicate across the entire set if needed, but usually movie and tv IDs are distinct namespaces in TMDB (but wait, an ID is an integer).
            // A movie ID 123 is different from TV ID 123. So we just dedup within types.

            this.credits = [...processedFilms, ...processedSeries];
        },

        normalizeMedia(list, type) {
            const uniqueMap = new Map();

            list.forEach(item => {
                if (!uniqueMap.has(item.id)) {
                    uniqueMap.set(item.id, {
                        id: item.id,
                        title: type === 'movie' ? item.title : item.name,
                        poster_path: item.poster_path,
                        date: type === 'movie' ? item.release_date : item.first_air_date,
                        popularity: item.popularity,
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

            // Filter by Tab
            if (this.activeTab !== 'tout') {
                filtered = filtered.filter(item => item.type === this.activeTab);
            }

            // Sort
            return filtered.sort((a, b) => {
                if (this.sortBy === 'popularity') {
                    return b.popularity - a.popularity;
                } else {
                    // Sort by date descending
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
    }));
});
