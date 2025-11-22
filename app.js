// app.js

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const TMDB_API_KEY = 'f1b07b5d2ac7a9f55c5b49a93b18bd33';

document.addEventListener('DOMContentLoaded', () => {
    // Containers
    const popularContainer = document.getElementById('popular-container');
    const netflixContainer = document.getElementById('netflix-container');
    const primeVideoContainer = document.getElementById('prime-video-container');
    const appleTvContainer = document.getElementById('apple-tv-container');
    const disneyPlusContainer = document.getElementById('disney-plus-container');
    const canalPlusContainer = document.getElementById('canal-plus-container');

    // Filter Buttons
    const filterBothBtn = document.getElementById('filter-both');
    const filterMoviesBtn = document.getElementById('filter-movies');
    const filterSeriesBtn = document.getElementById('filter-series');
    const loadingSpinner = document.getElementById('loading-spinner');

    const platforms = [
        { id: 8, name: 'Netflix', container: netflixContainer, section: document.getElementById('netflix-section') },
        { id: 119, name: 'Amazon Prime Video', container: primeVideoContainer, section: document.getElementById('prime-video-section') },
        { id: 350, name: 'Apple TV+', container: appleTvContainer, section: document.getElementById('apple-tv-section') },
        { id: 337, name: 'Disney+', container: disneyPlusContainer, section: document.getElementById('disney-plus-section') },
        { id: 392, name: 'Canal+', container: canalPlusContainer, section: document.getElementById('canal-plus-section') }
    ];

    async function fetchAPI(endpoint) {
        try {
            const response = await fetch(`${BASE_URL}/${endpoint}&api_key=${TMDB_API_KEY}&watch_region=FR`);
            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }
            const data = await response.json();
            return data.results;
        } catch (error) {
            console.error(`Failed to fetch from ${endpoint}:`, error);
            return []; // Return empty array on error
        }
    }

   function createMediaCard(media, cardType = 'platform') {
    const cardWidth = cardType === 'popular' ? 'w-48' : 'w-36';
    const posterRadius = cardType === 'popular' ? 'rounded-lg' : 'rounded';

    // Détection du type (Film vs Série)
    const isMovie = media.media_type === 'movie' || media.hasOwnProperty('title');
    const title = isMovie ? media.title : media.name;
    const id = media.id;
    const posterPath = media.poster_path;

    if (!posterPath) return ''; 

    const link = isMovie ? `film.html?id=${id}` : `serie.html?id=${id}`;
    const posterUrl = IMG_BASE_POSTER + posterPath;

    // --- MODIFICATION ICI ---
    // Création de la pastille TV si ce n'est pas un film
    // Style: Jaune, texte noir, gras, petite taille, en haut à gauche
    const badgeHTML = !isMovie 
        ? `<span class="absolute top-2 left-2 z-10 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-md uppercase tracking-wide">TV</span>`
        : '';

    return `
        <a href="${link}" class="flex-shrink-0 ${cardWidth} snap-start group">
            <div class="relative w-full bg-center bg-no-repeat aspect-[2/3] bg-cover ${posterRadius} overflow-hidden" style='background-image: url("${posterUrl}");'>
                ${badgeHTML}
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200"></div>
            </div>
            
            <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-primary transition-colors">${title}</p>
            <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <div class="flex items-center gap-1">
                    <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    <span>${media.vote_average ? media.vote_average.toFixed(1) : 'N/A'}</span>
                </div>
            </div>
        </a>
    `;
}

    function renderContent(container, content, cardType = 'platform') {
        container.innerHTML = content.map(media => createMediaCard(media, cardType)).join('');
    }

    async function fetchAndDisplayContent(filter = 'both') {
        loadingSpinner.style.display = 'flex';
        try {
            // Clear all containers first
            popularContainer.innerHTML = '';
            platforms.forEach(p => p.container.innerHTML = '');

            // 1. Fetch Popular
        let popularEndpoint = 'trending/all/week?language=en-US';
        if (filter === 'movie') popularEndpoint = 'trending/movie/week?language=en-US';
        if (filter === 'serie') popularEndpoint = 'trending/tv/week?language=en-US';

        const popularContent = await fetchAPI(popularEndpoint);
        renderContent(popularContainer, popularContent, 'popular');

        // 2. Fetch for each platform
        for (const platform of platforms) {
            let platformContent = [];

            if (filter === 'movie' || filter === 'both') {
                const movies = await fetchAPI(`discover/movie?sort_by=popularity.desc&with_watch_providers=${platform.id}`);
                platformContent.push(...movies);
            }
            if (filter === 'serie' || filter === 'both') {
                const series = await fetchAPI(`discover/tv?sort_by=popularity.desc&with_watch_providers=${platform.id}`);
                platformContent.push(...series);
            }

            // Sort combined content by popularity
            platformContent.sort((a, b) => b.popularity - a.popularity);

            renderContent(platform.container, platformContent, 'platform');

            // Hide section if no content
            platform.section.style.display = platformContent.length > 0 ? 'block' : 'none';
        }
        document.getElementById('popular-section').style.display = popularContent.length > 0 ? 'block' : 'none';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function updateFilterButtons(activeButton) {
        [filterBothBtn, filterMoviesBtn, filterSeriesBtn].forEach(btn => {
            btn.classList.remove('bg-primary', 'text-white');
            btn.classList.add('text-gray-600', 'dark:text-gray-300');
        });
        activeButton.classList.add('bg-primary', 'text-white');
        activeButton.classList.remove('text-gray-600', 'dark:text-gray-300');
    }

    filterBothBtn.addEventListener('click', () => {
        fetchAndDisplayContent('both');
        updateFilterButtons(filterBothBtn);
    });

    filterMoviesBtn.addEventListener('click', () => {
        fetchAndDisplayContent('movie');
        updateFilterButtons(filterMoviesBtn);
    });

    filterSeriesBtn.addEventListener('click', () => {
        fetchAndDisplayContent('serie');
        updateFilterButtons(filterSeriesBtn);
    });

    // Initial Load
    fetchAndDisplayContent('both');
});
