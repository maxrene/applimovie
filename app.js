// app.js

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';

document.addEventListener('DOMContentLoaded', () => {
    // Gestion Drapeau
    const userRegion = localStorage.getItem('userRegion') || 'FR';
    const flagImg = document.getElementById('header-flag');
    if (flagImg) {
        flagImg.src = `https://flagcdn.com/w40/${userRegion.toLowerCase()}.png`;
        flagImg.alt = userRegion;
    }

    // Containers
    const popularContainer = document.getElementById('popular-container');
    const netflixContainer = document.getElementById('netflix-container');
    const primeVideoContainer = document.getElementById('prime-video-container');
    const appleTvContainer = document.getElementById('apple-tv-container');
    const disneyPlusContainer = document.getElementById('disney-plus-container');
    const canalPlusContainer = document.getElementById('canal-plus-container');
    const paramountContainer = document.getElementById('paramount-container');

    const loadingSpinner = document.getElementById('loading-spinner');

    // Liste des sections à charger
    const platforms = [
        { id: 8, name: 'Netflix', container: netflixContainer, section: document.getElementById('netflix-section') },
        { id: 119, name: 'Prime Video', container: primeVideoContainer, section: document.getElementById('prime-video-section') },
        { id: 350, name: 'Apple TV+', container: appleTvContainer, section: document.getElementById('apple-tv-section') },
        { id: 337, name: 'Disney+', container: disneyPlusContainer, section: document.getElementById('disney-plus-section') },
        { id: 392, name: 'Canal+', container: canalPlusContainer, section: document.getElementById('canal-plus-section') },
        { id: 531, name: 'Paramount+', container: paramountContainer, section: document.getElementById('paramount-section') }
    ];

    async function fetchAPI(endpoint) {
        try {
            const separator = endpoint.includes('?') ? '&' : '?';
            const url = `${BASE_URL}/${endpoint}${separator}api_key=${TMDB_API_KEY}&watch_region=${userRegion}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API error: ${response.statusText}`);
            const data = await response.json();
            return data.results;
        } catch (error) {
            console.error(`Failed to fetch from ${endpoint}:`, error);
            return [];
        }
    }

    function getMediaStatus(id, type) {
        // Watchlist
        const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
        // Check ID equality loosely (string vs number)
        const isInWatchlist = watchlist.some(item => item.id == id);
        if (isInWatchlist) return 'watchlist';

        // Watched
        const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
        const watchedSeries = JSON.parse(localStorage.getItem('watchedSeries')) || [];

        const isWatched = (type === 'movie' && watchedMovies.includes(Number(id))) ||
                          (type === 'tv' && watchedSeries.includes(Number(id))) ||
                          (type === 'serie' && watchedSeries.includes(Number(id)));

        if (isWatched) return 'watched';

        return null;
    }

   function createMediaCard(media, cardType = 'platform') {
        const cardWidth = cardType === 'popular' ? 'w-36' : 'w-32'; // Un peu plus petit pour en mettre plus
        const posterRadius = 'rounded-lg';

        const isMovie = media.media_type === 'movie' || media.hasOwnProperty('title');
        const title = isMovie ? media.title : media.name;
        const id = media.id;
        const posterPath = media.poster_path;
        
        // Année
        const dateStr = isMovie ? media.release_date : media.first_air_date;
        const year = dateStr ? dateStr.split('-')[0] : '';

        if (!posterPath) return ''; 

        const link = isMovie ? `film.html?id=${id}` : `serie.html?id=${id}`;
        const posterUrl = IMG_BASE_POSTER + posterPath;

        const badgeHTML = !isMovie 
            ? `<div class="absolute top-1 left-1 z-10 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider border border-white/10">TV</div>`
            : '';

        const status = getMediaStatus(id, isMovie ? 'movie' : 'tv');
        let statusIconHTML = '';
        if (status === 'watchlist') {
             statusIconHTML = `<span class="material-symbols-outlined text-primary text-base">bookmark</span>`;
        } else if (status === 'watched') {
             statusIconHTML = `<span class="material-symbols-outlined text-gray-500 text-base">visibility</span>`;
        }

        return `
            <a href="${link}" class="flex-shrink-0 ${cardWidth} snap-start group flex flex-col">
                <div class="relative w-full aspect-[2/3] ${posterRadius} overflow-hidden bg-gray-800 shadow-md">
                    <img src="${posterUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                    ${badgeHTML}
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                </div>
                
                <div class="flex justify-between items-start mt-2">
                    <p class="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight flex-1 pr-1">${title}</p>
                    ${statusIconHTML}
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
    }

    function renderContent(container, content, cardType = 'platform') {
        if(!container) return;
        container.innerHTML = content.map(media => createMediaCard(media, cardType)).join('');
    }

    async function fetchAndDisplayContent() {
        loadingSpinner.style.display = 'flex';
        try {
            // 1. Fetch Popular (Mixte)
            const popularContent = await fetchAPI('trending/all/week?language=fr-FR');
            renderContent(popularContainer, popularContent, 'popular');

            // 2. Fetch par plateforme (Mixte Films/Séries triés par popularité)
            // Pour avoir un mix, on fait 2 requêtes (movie + tv) et on fusionne
            for (const platform of platforms) {
                if(!platform.container) continue;

                const [movies, series] = await Promise.all([
                    fetchAPI(`discover/movie?sort_by=popularity.desc&with_watch_providers=${platform.id}`),
                    fetchAPI(`discover/tv?sort_by=popularity.desc&with_watch_providers=${platform.id}`)
                ]);

                // Fusion et Tri
                let combined = [...movies, ...series];
                combined.sort((a, b) => b.popularity - a.popularity);
                
                // On garde les 20 premiers
                renderContent(platform.container, combined.slice(0, 20), 'platform');
                
                if(platform.section) {
                    platform.section.style.display = combined.length > 0 ? 'block' : 'none';
                }
            }
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    // Initial Load
    fetchAndDisplayContent();
});
