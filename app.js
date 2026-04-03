const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';

// Fonction globale pour les statuts
function getMediaStatusGlobal(id, type) {
    const watchedMovies = getSafeLocalStorage('watchedMovies', []);
    const watchedSeries = getSafeLocalStorage('watchedSeries', []);

    const isWatched = (type === 'movie' && watchedMovies.includes(Number(id))) ||
                      (type === 'tv' && watchedSeries.includes(Number(id))) ||
                      (type === 'serie' && watchedSeries.includes(Number(id)));

    if (isWatched) return 'watched';

    const watchlist = getSafeLocalStorage('watchlist', []);
    const isInWatchlist = watchlist.some(item => item.id == id);
    if (isInWatchlist) return 'watchlist';

    return null;
}

// --- 1. CHARGEMENT DES AWARDS VIA FIREBASE ---
// Notez l'utilisation de "await import(...)" au lieu de "import ... from" en haut du fichier
async function loadAwardsData() {
  try {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    const docRef = doc(db, "app_data", "awards");
    
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      window.awardsData = docSnap.data();
      console.log("🏆 Données des Awards chargées depuis Firebase !");
    } else {
      console.log("Aucune donnée d'awards trouvée en base.");
      window.awardsData = {};
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des awards :", error);
    window.awardsData = {}; 
  }
}

// On lance le chargement
loadAwardsData();

// --- 2. LOGIQUE ALPINE.JS ---
document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        activeTab: 'home', 
        userRegion: localStorage.getItem('userRegion') || 'FR',

        init() {
        },

        switchTab(tab) {
            this.activeTab = tab;
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('view-changed', { detail: { tab: tab } }));
            }, 50);
        }
    }));

    Alpine.data('homePage', () => ({
        isLoading: false,
        lastUpdate: Date.now(),

        async init() {
            await this.fetchAndDisplayContent();

            window.addEventListener('view-changed', (e) => {
                if (!e.detail || e.detail.tab === 'home') {
                    this.updateMediaStatuses();
                    this.loadContinueWatching();
                }
            });

            window.addEventListener('pageshow', () => {
                this.updateMediaStatuses();
                this.loadContinueWatching();

                const lastFetch = localStorage.getItem('lastHomeFetch');
                const now = Date.now();
                const twelveHours = 12 * 60 * 60 * 1000;

                if (!lastFetch || (now - parseInt(lastFetch) > twelveHours)) {
                    this.fetchAndDisplayContent();
                }
            });
        },

        async fetchAPI(endpoint, returnsList = true) {
            try {
                const separator = endpoint.includes('?') ? '&' : '?';
                const apiKey = window.TMDB_API_KEY || ''; 
                const url = `${BASE_URL}/${endpoint}${separator}api_key=${apiKey}&watch_region=${this.userRegion || 'FR'}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`API error: ${response.statusText}`);
                const data = await response.json();
                return returnsList ? data.results : data;
            } catch (error) {
                console.error(`Failed to fetch from ${endpoint}:`, error);
                return returnsList ? [] : null;
            }
        },

        createContinueWatchingCard(series, nextEpisode, progress) {
            const posterUrl = IMG_BASE_POSTER + series.poster_path;
            const link = `serie.html?id=${series.id}`;

            const seasonCode = String(nextEpisode.season_number).padStart(2, '0');
            const episodeCode = String(nextEpisode.episode_number).padStart(2, '0');
            const nextEpisodeString = `S${seasonCode}E${episodeCode} - ${nextEpisode.name}`;

            return `
                <a href="${link}" data-id="${series.id}" data-type="tv" class="flex-shrink-0 w-32 snap-start group flex flex-col media-card-link">
                    <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-md">
                        <img src="${posterUrl}" loading="lazy" class="w-full h-full object-cover">
                        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50 backdrop-blur-sm">
                            <div class="h-full bg-primary" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <p class="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight">${series.name}</p>
                        <p class="text-[10px] font-semibold text-primary truncate leading-tight mt-0.5">${nextEpisodeString}</p>
                    </div>
                </a>
            `;
        },

        createMediaCard(media, cardType = 'platform') {
            const cardWidth = cardType === 'popular' ? 'w-36' : 'w-32';
            const posterRadius = 'rounded-lg';

            const isMovie = media.media_type === 'movie' || media.hasOwnProperty('title');
            const title = isMovie ? media.title : media.name;
            const id = media.id;
            const posterPath = media.poster_path;

            const dateStr = isMovie ? media.release_date : media.first_air_date;
            let year = dateStr ? dateStr.split('-')[0] : '';

            if (!isMovie) {
                const seriesDatesCache = getSafeLocalStorage('seriesDatesCache', {});
                const cached = seriesDatesCache[id];
                if (cached) {
                    if (cached.status === 'Returning Series') {
                        year = `${cached.start} - Présent`;
                    } else if (cached.status === 'Ended') {
                        year = (cached.end && cached.start !== cached.end) ? `${cached.start} - ${cached.end}` : cached.start;
                    }
                }
            }

            if (!posterPath) return '';

            const link = isMovie ? `film.html?id=${id}` : `serie.html?id=${id}`;
            const posterUrl = IMG_BASE_POSTER + posterPath;

            const badgeHTML = !isMovie
                ? `<div class="absolute top-1 left-1 z-10 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider border border-white/10">TV</div>`
                : '';

            const status = getMediaStatusGlobal(id, isMovie ? 'movie' : 'tv');
            let statusIconHTML = '';
            if (status === 'watchlist') {
                statusIconHTML = `<span class="material-symbols-outlined text-primary text-base">bookmark</span>`;
            } else if (status === 'watched') {
                statusIconHTML = `<span class="material-symbols-outlined text-green-500 text-base">visibility</span>`;
            }

            return `
                <a href="${link}" data-id="${id}" data-type="${isMovie ? 'movie' : 'tv'}" class="flex-shrink-0 ${cardWidth} snap-start group flex flex-col media-card-link">
                    <div class="relative w-full aspect-[2/3] ${posterRadius} overflow-hidden bg-gray-800 shadow-md">
                        <img src="${posterUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                        ${badgeHTML}
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                    </div>

                    <div class="flex justify-between items-start mt-2">
                        <p class="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight flex-1 pr-1">${title}</p>
                        <div class="status-container">${statusIconHTML}</div>
                    </div>

                    <div class="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        <span>${year}</span>
                        <span class="text-gray-400">•</span>
                        <div class="flex items-center gap-0.5 text-yellow-500">
                            <span class="material-symbols-outlined text-[10px] filled">star</span>
                            <span class="text-gray-600 dark:text-gray-300 font-medium">${media.vote_average ? media.vote_average.toFixed(1) : 'N/A'}</span>
                        </div>
                    </div>
                </a>
            `;
        },

        renderContent(containerId, content, cardType = 'platform') {
            const container = document.getElementById(containerId);
            if(!container) return;
            container.innerHTML = content.map(media => this.createMediaCard(media, cardType)).join('');
        },

        async loadContinueWatching() {
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const seriesInProgress = {};

            for (const seriesId in watchedEpisodes) {
                if (watchedEpisodes[seriesId] && watchedEpisodes[seriesId].length > 0) {
                    seriesInProgress[seriesId] = true;
                }
            }
            const seriesIds = Object.keys(seriesInProgress);

            const section = document.getElementById('continue-watching-section');
            if (seriesIds.length === 0) {
                if (section) section.style.display = 'none';
                return;
            }

            const MAX_SEASONS_TO_APPEND = 20;
            const seasonsToAppend = Array.from({ length: MAX_SEASONS_TO_APPEND }, (_, i) => `season/${i + 1}`).join(',');

            const promises = seriesIds.map(id =>
                this.fetchAPI(`tv/${id}?language=fr-FR&append_to_response=${seasonsToAppend}`, false)
            );
            const results = await Promise.all(promises);

            const seriesToDisplay = [];

            for (const seriesDetails of results) {
                if (!seriesDetails) continue;

                const seriesIdStr = String(seriesDetails.id);
                let totalEpisodes = 0;
                let watchedCount = 0;
                let nextEpisode = null;
                let foundNext = false;

                const seasons = seriesDetails.seasons ? seriesDetails.seasons.sort((a, b) => a.season_number - b.season_number) : [];

                for (const season of seasons) {
                    if (season.season_number === 0) continue;

                    const seasonDetail = seriesDetails[`season/${season.season_number}`];
                    if (!seasonDetail || !seasonDetail.episodes) continue;

                    totalEpisodes += seasonDetail.episodes.length;

                    for (const episode of seasonDetail.episodes) {
                        const isWatched = watchedEpisodes[seriesIdStr] && watchedEpisodes[seriesIdStr].includes(episode.id);

                        if (isWatched) {
                            watchedCount++;
                        } else if (!foundNext) {
                            const today = new Date().toISOString().split('T')[0];
                            if (episode.air_date && episode.air_date <= today) {
                                nextEpisode = episode;
                                foundNext = true;
                            } else {
                                foundNext = true;
                                nextEpisode = null;
                            }
                        }
                    }
                }

                if (nextEpisode) {
                    const progress = totalEpisodes > 0 ? (watchedCount / totalEpisodes) * 100 : 0;
                    seriesToDisplay.push({ series: seriesDetails, nextEpisode, progress });
                }
            }

            const container = document.getElementById('continue-watching-container');

            if (seriesToDisplay.length > 0) {
                const seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});

                seriesToDisplay.sort((a, b) => {
                    const timeA = seriesLastWatchedDate[a.series.id] || 0;
                    const timeB = seriesLastWatchedDate[b.series.id] || 0;

                    if (timeA > 0 && timeB > 0) return timeB - timeA;
                    if (timeA > 0) return -1;
                    if (timeB > 0) return 1;

                    return b.progress - a.progress;
                });

                if (container) container.innerHTML = seriesToDisplay.map(item => this.createContinueWatchingCard(item.series, item.nextEpisode, item.progress)).join('');
                if (section) section.style.display = 'block';
            } else {
                if (section) section.style.display = 'none';
            }
        },

        async fetchAndDisplayContent() {
            this.isLoading = true;
            try {
                this.loadContinueWatching();

                const popularContent = await this.fetchAPI('trending/all/week?language=fr-FR');
                this.renderContent('popular-container', popularContent, 'popular');

                const favoriteActors = getSafeLocalStorage('favoriteActors', []);
                const favoriteActorsSection = document.getElementById('favorite-actors-section');

                if (favoriteActors.length > 0) {
                    const actorIds = favoriteActors.map(a => a.id).join('|');
                    const favoriteMovies = await this.fetchAPI(`discover/movie?with_people=${actorIds}&sort_by=release_date.desc&vote_count.gte=10`);

                    if (favoriteMovies && favoriteMovies.length > 0) {
                        this.renderContent('favorite-actors-container', favoriteMovies, 'platform');
                        if(favoriteActorsSection) favoriteActorsSection.style.display = 'block';
                    } else {
                        if(favoriteActorsSection) favoriteActorsSection.style.display = 'none';
                    }
                } else {
                    if(favoriteActorsSection) favoriteActorsSection.style.display = 'none';
                }

                 const platforms = [
                    { id: 8, name: 'Netflix', containerId: 'netflix-container', sectionId: 'netflix-section' },
                    { id: 119, name: 'Prime Video', containerId: 'prime-video-container', sectionId: 'prime-video-section' },
                    { id: 350, name: 'Apple TV+', containerId: 'apple-tv-container', sectionId: 'apple-tv-section' },
                    { id: 337, name: 'Disney+', containerId: 'disney-plus-container', sectionId: 'disney-plus-section' },
                    { id: 392, name: 'Canal+', containerId: 'canal-plus-container', sectionId: 'canal-plus-section' },
                    { id: 531, name: 'Paramount+', containerId: 'paramount-container', sectionId: 'paramount-section' }
                ];

                for (const platform of platforms) {
                    const [movies, series] = await Promise.all([
                        this.fetchAPI(`discover/movie?sort_by=popularity.desc&with_watch_providers=${platform.id}`),
                        this.fetchAPI(`discover/tv?sort_by=popularity.desc&with_watch_providers=${platform.id}`)
                    ]);

                    let combined = [...movies, ...series];
                    combined.sort((a, b) => b.popularity - a.popularity);

                    this.renderContent(platform.containerId, combined.slice(0, 20), 'platform');

                    const section = document.getElementById(platform.sectionId);
                    if(section) {
                        section.style.display = combined.length > 0 ? 'block' : 'none';
                    }
                }
                localStorage.setItem('lastHomeFetch', Date.now());
            } finally {
                this.isLoading = false;
            }
        },

        updateMediaStatuses() {
            document.querySelectorAll('#home-view .media-card-link').forEach(card => {
                const id = Number(card.dataset.id);
                const type = card.dataset.type;
                const statusContainer = card.querySelector('.status-container');
                if (!statusContainer) return;

                const status = getMediaStatusGlobal(id, type);
                let statusIconHTML = '';
                if (status === 'watchlist') {
                    statusIconHTML = `<span class="material-symbols-outlined text-primary text-base">bookmark</span>`;
                } else if (status === 'watched') {
                    statusIconHTML = `<span class="material-symbols-outlined text-green-500 text-base">visibility</span>`;
                }
                statusContainer.innerHTML = statusIconHTML;
            });
        }
    }));
});

// --- 3. MIGRATION DES AWARDS ---
window.lancerMigrationAwards = async function() {
  try {
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    const docRef = doc(db, "app_data", "awards");
    
    const initialAwardsData = {
        "1054867": { "title": "The Battle of Baktan Cross", "year": 2025, "nominations": 8, "wins": 4, "type": "movie" },
        "1233413": { "title": "Sinners", "year": 2025, "nominations": 7, "wins": 4, "type": "movie" },
        "858024": { "title": "Hamnet", "year": 2025, "nominations": 4, "wins": 1, "type": "movie" },
        "1078605": { "title": "Weapons", "year": 2025, "nominations": 3, "wins": 1, "type": "movie" },
        "1124566": { "title": "Sentimental Value", "year": 2025, "nominations": 2, "wins": 1, "type": "movie" },
        "803796": { "title": "K-Pop: Demon Hunters", "year": 2025, "nominations": 1, "wins": 1, "type": "movie" },
        "872585": { "title": "Oppenheimer", "year": 2023, "nominations": 13, "wins": 7, "type": "movie" },
        "792307": { "title": "Poor Things", "year": 2023, "nominations": 11, "wins": 4, "type": "movie" },
        "466420": { "title": "Killers of the Flower Moon", "year": 2023, "nominations": 10, "wins": 0, "type": "movie" },
        "346698": { "title": "Barbie", "year": 2023, "nominations": 8, "wins": 1, "type": "movie" },
        "523607": { "title": "Maestro", "year": 2023, "nominations": 7, "wins": 0, "type": "movie" },
        "915935": { "title": "Anatomy of a Fall", "year": 2023, "nominations": 5, "wins": 1, "type": "movie" },
        "467244": { "title": "The Zone of Interest", "year": 2023, "nominations": 5, "wins": 2, "type": "movie" },
        "840430": { "title": "The Holdovers", "year": 2023, "nominations": 5, "wins": 1, "type": "movie" },
        "1056360": { "title": "American Fiction", "year": 2023, "nominations": 5, "wins": 1, "type": "movie" },
        "753342": { "title": "Napoleon", "year": 2023, "nominations": 3, "wins": 0, "type": "movie" },
        "666277": { "title": "Past Lives", "year": 2023, "nominations": 2, "wins": 0, "type": "movie" },
        "545611": { "title": "Everything Everywhere All At Once", "year": 2022, "nominations": 11, "wins": 7, "type": "movie" },
        "49046": { "title": "All Quiet on the Western Front", "year": 2022, "nominations": 9, "wins": 4, "type": "movie" },
        "674324": { "title": "The Banshees of Inisherin", "year": 2022, "nominations": 9, "wins": 0, "type": "movie" },
        "614934": { "title": "Elvis", "year": 2022, "nominations": 8, "wins": 0, "type": "movie" },
        "804095": { "title": "The Fabelmans", "year": 2022, "nominations": 7, "wins": 0, "type": "movie" },
        "361743": { "title": "Top Gun: Maverick", "year": 2022, "nominations": 6, "wins": 1, "type": "movie" },
        "817758": { "title": "Tár", "year": 2022, "nominations": 6, "wins": 0, "type": "movie" },
        "505642": { "title": "Black Panther: Wakanda Forever", "year": 2022, "nominations": 5, "wins": 1, "type": "movie" },
        "76600": { "title": "Avatar: The Way of Water", "year": 2022, "nominations": 4, "wins": 1, "type": "movie" },
        "785084": { "title": "Women Talking", "year": 2022, "nominations": 2, "wins": 1, "type": "movie" },
        "497828": { "title": "Triangle of Sadness", "year": 2022, "nominations": 3, "wins": 0, "type": "movie" },
        "600583": { "title": "The Power of the Dog", "year": 2021, "nominations": 12, "wins": 1, "type": "movie" },
        "438631": { "title": "Dune: Part One", "year": 2021, "nominations": 10, "wins": 6, "type": "movie" },
        "777270": { "title": "Belfast", "year": 2021, "nominations": 7, "wins": 1, "type": "movie" },
        "511809": { "title": "West Side Story", "year": 2021, "nominations": 7, "wins": 1, "type": "movie" },
        "614917": { "title": "King Richard", "year": 2021, "nominations": 6, "wins": 1, "type": "movie" },
        "646380": { "title": "Don't Look Up", "year": 2021, "nominations": 4, "wins": 0, "type": "movie" },
        "794883": { "title": "Drive My Car", "year": 2021, "nominations": 4, "wins": 1, "type": "movie" },
        "509967": { "title": "CODA", "year": 2021, "nominations": 3, "wins": 3, "type": "movie" },
        "739990": { "title": "Licorice Pizza", "year": 2021, "nominations": 3, "wins": 0, "type": "movie" },
        "614560": { "title": "Mank", "year": 2020, "nominations": 10, "wins": 2, "type": "movie" },
        "581734": { "title": "Nomadland", "year": 2020, "nominations": 6, "wins": 3, "type": "movie" },
        "600354": { "title": "The Father", "year": 2020, "nominations": 6, "wins": 2, "type": "movie" },
        "502033": { "title": "Sound of Metal", "year": 2020, "nominations": 6, "wins": 2, "type": "movie" },
        "583406": { "title": "Judas and the Black Messiah", "year": 2020, "nominations": 6, "wins": 2, "type": "movie" },
        "615643": { "title": "Minari", "year": 2020, "nominations": 6, "wins": 1, "type": "movie" },
        "556984": { "title": "The Trial of the Chicago 7", "year": 2020, "nominations": 6, "wins": 0, "type": "movie" },
        "582014": { "title": "Promising Young Woman", "year": 2020, "nominations": 5, "wins": 1, "type": "movie" },
        "475557": { "title": "Joker", "year": 2019, "nominations": 11, "wins": 2, "type": "movie" },
        "530915": { "title": "1917", "year": 2019, "nominations": 10, "wins": 3, "type": "movie" },
        "466272": { "title": "Once Upon a Time... in Hollywood", "year": 2019, "nominations": 10, "wins": 2, "type": "movie" },
        "398978": { "title": "The Irishman", "year": 2019, "nominations": 10, "wins": 0, "type": "movie" },
        "496243": { "title": "Parasite", "year": 2019, "nominations": 6, "wins": 4, "type": "movie" },
        "515001": { "title": "Jojo Rabbit", "year": 2019, "nominations": 6, "wins": 1, "type": "movie" },
        "492188": { "title": "Marriage Story", "year": 2019, "nominations": 6, "wins": 1, "type": "movie" },
        "331482": { "title": "Little Women", "year": 2019, "nominations": 6, "wins": 1, "type": "movie" },
        "426426": { "title": "Roma", "year": 2018, "nominations": 10, "wins": 3, "type": "movie" },
        "375262": { "title": "The Favourite", "year": 2018, "nominations": 10, "wins": 1, "type": "movie" },
        "332562": { "title": "A Star Is Born", "year": 2018, "nominations": 8, "wins": 1, "type": "movie" },
        "429197": { "title": "Vice", "year": 2018, "nominations": 8, "wins": 1, "type": "movie" },
        "284054": { "title": "Black Panther", "year": 2018, "nominations": 7, "wins": 3, "type": "movie" },
        "490132": { "title": "Green Book", "year": 2018, "nominations": 5, "wins": 3, "type": "movie" },
        "424694": { "title": "Bohemian Rhapsody", "year": 2018, "nominations": 5, "wins": 4, "type": "movie" },
        "399055": { "title": "The Shape of Water", "year": 2017, "nominations": 13, "wins": 4, "type": "movie" },
        "374720": { "title": "Dunkirk", "year": 2017, "nominations": 8, "wins": 3, "type": "movie" },
        "359940": { "title": "Three Billboards Outside Ebbing, Missouri", "year": 2017, "nominations": 7, "wins": 2, "type": "movie" },
        "313369": { "title": "La La Land", "year": 2016, "nominations": 14, "wins": 6, "type": "movie" },
        "329865": { "title": "Arrival", "year": 2016, "nominations": 8, "wins": 1, "type": "movie" },
        "376867": { "title": "Moonlight", "year": 2016, "nominations": 8, "wins": 3, "type": "movie" },
        "334541": { "title": "Manchester by the Sea", "year": 2016, "nominations": 6, "wins": 2, "type": "movie" },
        "324786": { "title": "Hacksaw Ridge", "year": 2016, "nominations": 6, "wins": 2, "type": "movie" },
        "281957": { "title": "The Revenant", "year": 2015, "nominations": 12, "wins": 3, "type": "movie" },
        "76341": { "title": "Mad Max: Fury Road", "year": 2015, "nominations": 10, "wins": 6, "type": "movie" },
        "286217": { "title": "The Martian", "year": 2015, "nominations": 7, "wins": 0, "type": "movie" },
        "314365": { "title": "Spotlight", "year": 2015, "nominations": 6, "wins": 2, "type": "movie" },
        "296098": { "title": "Bridge of Spies", "year": 2015, "nominations": 6, "wins": 1, "type": "movie" },
        "194662": { "title": "Birdman", "year": 2014, "nominations": 9, "wins": 4, "type": "movie" },
        "120467": { "title": "The Grand Budapest Hotel", "year": 2014, "nominations": 9, "wins": 4, "type": "movie" },
        "205596": { "title": "The Imitation Game", "year": 2014, "nominations": 8, "wins": 1, "type": "movie" },
        "190859": { "title": "American Sniper", "year": 2014, "nominations": 6, "wins": 1, "type": "movie" },
        "85350": { "title": "Boyhood", "year": 2014, "nominations": 6, "wins": 1, "type": "movie" },
        "244786": { "title": "Whiplash", "year": 2014, "nominations": 5, "wins": 3, "type": "movie" },
        "157336": { "title": "Interstellar", "year": 2014, "nominations": 5, "wins": 1, "type": "movie" },
        "49047": { "title": "Gravity", "year": 2013, "nominations": 10, "wins": 7, "type": "movie" },
        "168672": { "title": "American Hustle", "year": 2013, "nominations": 10, "wins": 0, "type": "movie" },
        "76203": { "title": "12 Years a Slave", "year": 2013, "nominations": 9, "wins": 3, "type": "movie" },
        "109424": { "title": "Captain Phillips", "year": 2013, "nominations": 6, "wins": 0, "type": "movie" },
        "152532": { "title": "Dallas Buyers Club", "year": 2013, "nominations": 6, "wins": 3, "type": "movie" },
        "152601": { "title": "Her", "year": 2013, "nominations": 5, "wins": 1, "type": "movie" },
        "106646": { "title": "The Wolf of Wall Street", "year": 2013, "nominations": 5, "wins": 0, "type": "movie" },
        "72976": { "title": "Lincoln", "year": 2012, "nominations": 12, "wins": 2, "type": "movie" },
        "87827": { "title": "Life of Pi", "year": 2012, "nominations": 11, "wins": 4, "type": "movie" },
        "82695": { "title": "Les Misérables", "year": 2012, "nominations": 8, "wins": 3, "type": "movie" },
        "82693": { "title": "Silver Linings Playbook", "year": 2012, "nominations": 8, "wins": 1, "type": "movie" },
        "68734": { "title": "Argo", "year": 2012, "nominations": 7, "wins": 3, "type": "movie" },
        "37724": { "title": "Skyfall", "year": 2012, "nominations": 5, "wins": 2, "type": "movie" },
        "68718": { "title": "Django Unchained", "year": 2012, "nominations": 5, "wins": 2, "type": "movie" },
        "97630": { "title": "Zero Dark Thirty", "year": 2012, "nominations": 5, "wins": 1, "type": "movie" },
        "44826": { "title": "Hugo", "year": 2011, "nominations": 11, "wins": 5, "type": "movie" },
        "74643": { "title": "The Artist", "year": 2011, "nominations": 10, "wins": 5, "type": "movie" },
        "60308": { "title": "Moneyball", "year": 2011, "nominations": 6, "wins": 0, "type": "movie" },
        "57212": { "title": "War Horse", "year": 2011, "nominations": 6, "wins": 0, "type": "movie" },
        "45269": { "title": "The King's Speech", "year": 2010, "nominations": 12, "wins": 4, "type": "movie" },
        "44264": { "title": "True Grit", "year": 2010, "nominations": 10, "wins": 0, "type": "movie" },
        "27205": { "title": "Inception", "year": 2010, "nominations": 8, "wins": 4, "type": "movie" },
        "37799": { "title": "The Social Network", "year": 2010, "nominations": 8, "wins": 3, "type": "movie" },
        "45317": { "title": "The Fighter", "year": 2010, "nominations": 7, "wins": 2, "type": "movie" },
        "44115": { "title": "127 Hours", "year": 2010, "nominations": 6, "wins": 0, "type": "movie" },
        "44214": { "title": "Black Swan", "year": 2010, "nominations": 5, "wins": 1, "type": "movie" },
        "10193": { "title": "Toy Story 3", "year": 2010, "nominations": 5, "wins": 2, "type": "movie" },
        "19995": { "title": "Avatar", "year": 2009, "nominations": 9, "wins": 3, "type": "movie" },
        "12162": { "title": "The Hurt Locker", "year": 2009, "nominations": 9, "wins": 6, "type": "movie" },
        "16869": { "title": "Inglourious Basterds", "year": 2009, "nominations": 8, "wins": 1, "type": "movie" },
        "25793": { "title": "Precious", "year": 2009, "nominations": 6, "wins": 2, "type": "movie" },
        "22947": { "title": "Up in the Air", "year": 2009, "nominations": 6, "wins": 0, "type": "movie" },
        "14160": { "title": "Up", "year": 2009, "nominations": 5, "wins": 2, "type": "movie" },
        "4922": { "title": "The Curious Case of Benjamin Button", "year": 2008, "nominations": 13, "wins": 3, "type": "movie" },
        "12405": { "title": "Slumdog Millionaire", "year": 2008, "nominations": 10, "wins": 8, "type": "movie" },
        "155": { "title": "The Dark Knight", "year": 2008, "nominations": 8, "wins": 2, "type": "movie" },
        "10139": { "title": "Milk", "year": 2008, "nominations": 8, "wins": 2, "type": "movie" },
        "10681": { "title": "Wall-E", "year": 2008, "nominations": 6, "wins": 1, "type": "movie" },
        "6977": { "title": "No Country for Old Men", "year": 2007, "nominations": 8, "wins": 4, "type": "movie" },
        "7345": { "title": "There Will Be Blood", "year": 2007, "nominations": 8, "wins": 2, "type": "movie" },
        "4347": { "title": "Atonement", "year": 2007, "nominations": 7, "wins": 1, "type": "movie" },
        "4566": { "title": "Michael Clayton", "year": 2007, "nominations": 7, "wins": 1, "type": "movie" },
        "2062": { "title": "Ratatouille", "year": 2007, "nominations": 5, "wins": 1, "type": "movie" },
        "1125": { "title": "Dreamgirls", "year": 2006, "nominations": 8, "wins": 2, "type": "movie" },
        "1164": { "title": "Babel", "year": 2006, "nominations": 7, "wins": 1, "type": "movie" },
        "1417": { "title": "Pan's Labyrinth", "year": 2006, "nominations": 6, "wins": 3, "type": "movie" },
        "1165": { "title": "The Queen", "year": 2006, "nominations": 6, "wins": 1, "type": "movie" },
        "1422": { "title": "The Departed", "year": 2006, "nominations": 5, "wins": 4, "type": "movie" },
        "1372": { "title": "Blood Diamond", "year": 2006, "nominations": 5, "wins": 0, "type": "movie" },
        "142": { "title": "Brokeback Mountain", "year": 2005, "nominations": 8, "wins": 3, "type": "movie" },
        "1640": { "title": "Crash", "year": 2005, "nominations": 6, "wins": 3, "type": "movie" },
        "1904": { "title": "Memoirs of a Geisha", "year": 2005, "nominations": 6, "wins": 3, "type": "movie" },
        "3291": { "title": "Good Night, and Good Luck", "year": 2005, "nominations": 6, "wins": 0, "type": "movie" },
        "69": { "title": "Walk the Line", "year": 2005, "nominations": 5, "wins": 1, "type": "movie" },
        "2567": { "title": "The Aviator", "year": 2004, "nominations": 11, "wins": 5, "type": "movie" },
        "70": { "title": "Million Dollar Baby", "year": 2004, "nominations": 7, "wins": 4, "type": "movie" },
        "866": { "title": "Finding Neverland", "year": 2004, "nominations": 7, "wins": 1, "type": "movie" },
        "1677": { "title": "Ray", "year": 2004, "nominations": 6, "wins": 2, "type": "movie" },
        "9675": { "title": "Sideways", "year": 2004, "nominations": 5, "wins": 1, "type": "movie" },
        "122": { "title": "The Lord of the Rings: The Return of the King", "year": 2003, "nominations": 11, "wins": 11, "type": "movie" },
        "8619": { "title": "Master and Commander", "year": 2003, "nominations": 10, "wins": 2, "type": "movie" },
        "2289": { "title": "Cold Mountain", "year": 2003, "nominations": 7, "wins": 1, "type": "movie" },
        "4464": { "title": "Seabiscuit", "year": 2003, "nominations": 7, "wins": 0, "type": "movie" },
        "322": { "title": "Mystic River", "year": 2003, "nominations": 6, "wins": 2, "type": "movie" },
        "22": { "title": "Pirates of the Caribbean: The Curse of the Black Pearl", "year": 2003, "nominations": 5, "wins": 0, "type": "movie" },
        "1574": { "title": "Chicago", "year": 2002, "nominations": 13, "wins": 6, "type": "movie" },
        "3131": { "title": "Gangs of New York", "year": 2002, "nominations": 10, "wins": 0, "type": "movie" },
        "423": { "title": "The Pianist", "year": 2002, "nominations": 7, "wins": 3, "type": "movie" },
        "121": { "title": "The Lord of the Rings: The Two Towers", "year": 2002, "nominations": 6, "wins": 2, "type": "movie" },
        "1360": { "title": "Frida", "year": 2002, "nominations": 6, "wins": 2, "type": "movie" },
        "4147": { "title": "Road to Perdition", "year": 2002, "nominations": 6, "wins": 1, "type": "movie" },
        "120": { "title": "The Lord of the Rings: The Fellowship of the Ring", "year": 2001, "nominations": 13, "wins": 4, "type": "movie" },
        "453": { "title": "A Beautiful Mind", "year": 2001, "nominations": 8, "wins": 4, "type": "movie" },
        "824": { "title": "Moulin Rouge!", "year": 2001, "nominations": 8, "wins": 2, "type": "movie" },
        "5279": { "title": "Gosford Park", "year": 2001, "nominations": 7, "wins": 1, "type": "movie" },
        "194": { "title": "Amélie", "year": 2001, "nominations": 5, "wins": 0, "type": "movie" },
        "855": { "title": "Black Hawk Down", "year": 2001, "nominations": 4, "wins": 2, "type": "movie" },
        "98": { "title": "Gladiator", "year": 2000, "nominations": 12, "wins": 5, "type": "movie" },
        "146": { "title": "Crouching Tiger, Hidden Dragon", "year": 2000, "nominations": 10, "wins": 4, "type": "movie" },
        "1900": { "title": "Traffic", "year": 2000, "nominations": 5, "wins": 4, "type": "movie" },
        "462": { "title": "Erin Brockovich", "year": 2000, "nominations": 5, "wins": 1, "type": "movie" },
        "392": { "title": "Chocolat", "year": 2000, "nominations": 5, "wins": 0, "type": "movie" },
        "250307": { "title": "The Pitt", "year": 2025, "nominations": 5, "wins": 3, "type": "tv" },
        "247767": { "title": "The Studio", "year": 2025, "nominations": 6, "wins": 4, "type": "tv" },
        "249042": { "title": "Adolescence", "year": 2025, "nominations": 4, "wins": 3, "type": "tv" },
        "225171": { "title": "Pluribus", "year": 2025, "nominations": 3, "wins": 1, "type": "tv" },
        "213713": { "title": "The Diplomat", "year": 2023, "nominations": 2, "wins": 1, "type": "tv" },
        "241405": { "title": "Dying for Sex", "year": 2025, "nominations": 2, "wins": 1, "type": "tv" },
        "126308": { "title": "Shōgun", "year": 2024, "nominations": 25, "wins": 18, "type": "tv" },
        "242311": { "title": "Baby Reindeer", "year": 2024, "nominations": 11, "wins": 6, "type": "tv" },
        "46648": { "title": "True Detective", "year": 2024, "nominations": 19, "wins": 1, "type": "tv" },
        "106379": { "title": "Fallout", "year": 2024, "nominations": 16, "wins": 2, "type": "tv" },
        "203744": { "title": "Ripley", "year": 2024, "nominations": 13, "wins": 4, "type": "tv" },
        "116362": { "title": "Mr. & Mrs. Smith", "year": 2024, "nominations": 16, "wins": 2, "type": "tv" },
        "196417": { "title": "Palm Royale", "year": 2024, "nominations": 11, "wins": 0, "type": "tv" },
        "136315": { "title": "The Bear", "year": 2022, "nominations": 23, "wins": 11, "type": "tv" },
        "95480": { "title": "Slow Horses", "year": 2022, "nominations": 15, "wins": 1, "type": "tv" },
        "76331": { "title": "Succession", "year": 2018, "nominations": 75, "wins": 19, "type": "tv" },
        "100088": { "title": "The Last of Us", "year": 2023, "nominations": 24, "wins": 8, "type": "tv" },
        "122226": { "title": "Hacks", "year": 2021, "nominations": 52, "wins": 10, "type": "tv" },
        "105248": { "title": "Beef", "year": 2023, "nominations": 13, "wins": 8, "type": "tv" },
        "111803": { "title": "The White Lotus", "year": 2021, "nominations": 43, "wins": 15, "type": "tv" },
        "125935": { "title": "Abbott Elementary", "year": 2021, "nominations": 15, "wins": 4, "type": "tv" },
        "93405": { "title": "Squid Game", "year": 2021, "nominations": 14, "wins": 6, "type": "tv" },
        "115264": { "title": "Severance", "year": 2022, "nominations": 14, "wins": 2, "type": "tv" },
        "115546": { "title": "Yellowjackets", "year": 2021, "nominations": 10, "wins": 0, "type": "tv" },
        "115646": { "title": "Only Murders in the Building", "year": 2021, "nominations": 49, "wins": 7, "type": "tv" },
        "97546": { "title": "Ted Lasso", "year": 2020, "nominations": 61, "wins": 13, "type": "tv" },
        "87739": { "title": "The Queen's Gambit", "year": 2020, "nominations": 18, "wins": 11, "type": "tv" },
        "115004": { "title": "Mare of Easttown", "year": 2021, "nominations": 16, "wins": 4, "type": "tv" },
        "85271": { "title": "WandaVision", "year": 2021, "nominations": 23, "wins": 3, "type": "tv" },
        "61662": { "title": "Schitt's Creek", "year": 2015, "nominations": 19, "wins": 9, "type": "tv" },
        "79788": { "title": "Watchmen", "year": 2019, "nominations": 26, "wins": 11, "type": "tv" },
        "87108": { "title": "Chernobyl", "year": 2019, "nominations": 19, "wins": 10, "type": "tv" },
        "67070": { "title": "Fleabag", "year": 2016, "nominations": 11, "wins": 6, "type": "tv" },
        "69740": { "title": "Ozark", "year": 2017, "nominations": 45, "wins": 4, "type": "tv" },
        "70796": { "title": "The Marvelous Mrs. Maisel", "year": 2017, "nominations": 66, "wins": 20, "type": "tv" },
        "69478": { "title": "The Handmaid's Tale", "year": 2017, "nominations": 76, "wins": 15, "type": "tv" },
        "66292": { "title": "Big Little Lies", "year": 2017, "nominations": 21, "wins": 8, "type": "tv" },
        "65494": { "title": "The Crown", "year": 2016, "nominations": 87, "wins": 21, "type": "tv" },
        "66732": { "title": "Stranger Things", "year": 2016, "nominations": 51, "wins": 12, "type": "tv" },
        "67136": { "title": "This Is Us", "year": 2016, "nominations": 40, "wins": 4, "type": "tv" },
        "65495": { "title": "Atlanta", "year": 2016, "nominations": 25, "wins": 6, "type": "tv" },
        "63247": { "title": "Westworld", "year": 2016, "nominations": 54, "wins": 7, "type": "tv" },
        "60059": { "title": "Better Call Saul", "year": 2015, "nominations": 53, "wins": 0, "type": "tv" },
        "60625": { "title": "Fargo", "year": 2014, "nominations": 70, "wins": 6, "type": "tv" },
        "2947": { "title": "Veep", "year": 2012, "nominations": 68, "wins": 17, "type": "tv" },
        "1399": { "title": "Game of Thrones", "year": 2011, "nominations": 160, "wins": 59, "type": "tv" },
        "1407": { "title": "Homeland", "year": 2011, "nominations": 35, "wins": 8, "type": "tv" },
        "42009": { "title": "Black Mirror", "year": 2011, "nominations": 14, "wins": 6, "type": "tv" },
        "33907": { "title": "Downton Abbey", "year": 2010, "nominations": 69, "wins": 15, "type": "tv" },
        "19885": { "title": "Sherlock", "year": 2010, "nominations": 39, "wins": 9, "type": "tv" },
        "1621": { "title": "Boardwalk Empire", "year": 2010, "nominations": 57, "wins": 20, "type": "tv" },
        "1421": { "title": "Modern Family", "year": 2009, "nominations": 85, "wins": 22, "type": "tv" },
        "1415": { "title": "Glee", "year": 2009, "nominations": 40, "wins": 6, "type": "tv" },
        "1396": { "title": "Breaking Bad", "year": 2008, "nominations": 58, "wins": 16, "type": "tv" },
        "1104": { "title": "Mad Men", "year": 2007, "nominations": 116, "wins": 16, "type": "tv" },
        "4608": { "title": "30 Rock", "year": 2006, "nominations": 103, "wins": 16, "type": "tv" },
        "1405": { "title": "Dexter", "year": 2006, "nominations": 24, "wins": 4, "type": "tv" },
        "2316": { "title": "The Office", "year": 2005, "nominations": 42, "wins": 5, "type": "tv" },
        "1416": { "title": "Grey's Anatomy", "year": 2005, "nominations": 39, "wins": 5, "type": "tv" },
        "4607": { "title": "Lost", "year": 2004, "nominations": 54, "wins": 10, "type": "tv" },
        "1408": { "title": "House", "year": 2004, "nominations": 25, "wins": 5, "type": "tv" },
        "693": { "title": "Desperate Housewives", "year": 2004, "nominations": 33, "wins": 7, "type": "tv" },
        "4589": { "title": "Arrested Development", "year": 2003, "nominations": 25, "wins": 6, "type": "tv" },
        "1438": { "title": "The Wire", "year": 2002, "nominations": 2, "wins": 0, "type": "tv" },
        "1973": { "title": "24", "year": 2001, "nominations": 68, "wins": 20, "type": "tv" },
        "1274": { "title": "Six Feet Under", "year": 2001, "nominations": 53, "wins": 9, "type": "tv" },
        "4546": { "title": "Curb Your Enthusiasm", "year": 2000, "nominations": 51, "wins": 2, "type": "tv" },
        "688": { "title": "The West Wing", "year": 1999, "nominations": 95, "wins": 26, "type": "tv" },
        "1398": { "title": "The Sopranos", "year": 1999, "nominations": 112, "wins": 21, "type": "tv" }
    };
    
    await setDoc(docRef, initialAwardsData);
    console.log("✅ Migration terminée avec succès !");
    alert("Migration terminée avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors de la migration :", error);
  }
};
