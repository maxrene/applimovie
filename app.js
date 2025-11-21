// app.js
document.addEventListener('DOMContentLoaded', () => {
    const popularContainer = document.getElementById('popular-container');
    const netflixContainer = document.getElementById('netflix-container');
    const primeVideoContainer = document.getElementById('prime-video-container');
    const appleTvContainer = document.getElementById('apple-tv-container');
    const disneyPlusContainer = document.getElementById('disney-plus-container');
    const canalPlusContainer = document.getElementById('canal-plus-container');

    const filterBothBtn = document.getElementById('filter-both');
    const filterMoviesBtn = document.getElementById('filter-movies');
    const filterSeriesBtn = document.getElementById('filter-series');

    const platforms = [
        { name: 'Netflix', container: netflixContainer, section: document.getElementById('netflix-section') },
        { name: 'Amazon Prime Video', container: primeVideoContainer, section: document.getElementById('prime-video-section') },
        { name: 'Apple TV+', container: appleTvContainer, section: document.getElementById('apple-tv-section') },
        { name: 'Disney+', container: disneyPlusContainer, section: document.getElementById('disney-plus-section') },
        { name: 'Canal+', container: canalPlusContainer, section: document.getElementById('canal-plus-section') }
    ];

    function createMediaCard(media) {
        const link = media.type === 'movie' ? `film.html?id=${media.id}` : `serie.html?id=${media.id}`;
        const cardWidth = media.type === 'movie' ? 'w-48' : 'w-36';

        return `
            <a href="${link}" class="flex-shrink-0 ${cardWidth} snap-start">
                <div class="w-full bg-center bg-no-repeat aspect-[2/3] bg-cover rounded-lg" style='background-image: url("${media.posterUrl}");'></div>
                <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">${media.title}</p>
                <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <div class="flex items-center gap-1">
                        <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                        <span>${media.imdb}</span>
                    </div>
                </div>
            </a>
        `;
    }

    function renderMedia(filter = 'both') {
        // Clear all containers
        popularContainer.innerHTML = '';
        platforms.forEach(p => p.container.innerHTML = '');

        const filteredMedia = mediaData.filter(item => {
            if (filter === 'both') return true;
            return item.type === filter;
        });

        // Populate Popular section
        filteredMedia.forEach(media => {
            popularContainer.innerHTML += createMediaCard(media);
        });

        // Populate platform-specific sections
        filteredMedia.forEach(media => {
            if (media.availableOn && Array.isArray(media.availableOn)) {
                media.availableOn.forEach(platformOnMedia => {
                    const platformConfig = platforms.find(p => p.name === platformOnMedia.name);
                    if (platformConfig) {
                        platformConfig.container.innerHTML += createMediaCard(media);
                    }
                });
            }
        });

        // Hide empty platform sections
        platforms.forEach(p => {
            p.section.style.display = p.container.innerHTML === '' ? 'none' : 'block';
        });

        document.getElementById('popular-section').style.display = popularContainer.innerHTML === '' ? 'none' : 'block';
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
        renderMedia('both');
        updateFilterButtons(filterBothBtn);
    });

    filterMoviesBtn.addEventListener('click', () => {
        renderMedia('movie');
        updateFilterButtons(filterMoviesBtn);
    });

    filterSeriesBtn.addEventListener('click', () => {
        renderMedia('serie');
        updateFilterButtons(filterSeriesBtn);
    });

    // Initial display
    renderMedia('both');
});
