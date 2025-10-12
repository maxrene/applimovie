// app.js
document.addEventListener('DOMContentLoaded', () => {
    const moviesContainer = document.getElementById('movies-container');
    const seriesContainer = document.getElementById('series-container');
    
    const filterBothBtn = document.getElementById('filter-both');
    const filterMoviesBtn = document.getElementById('filter-movies');
    const filterSeriesBtn = document.getElementById('filter-series');

    function renderMedia(filter = 'both') {
        // Vide les listes actuelles
        moviesContainer.innerHTML = '';
        seriesContainer.innerHTML = '';
        
        // Cache ou affiche les sections
        document.getElementById('movies-section').style.display = (filter === 'both' || filter === 'movie') ? 'block' : 'none';
        document.getElementById('series-section').style.display = (filter === 'both' || filter === 'serie') ? 'block' : 'none';

        const moviesToShow = mediaData.filter(item => item.type === 'movie');
        const seriesToShow = mediaData.filter(item => item.type === 'serie');

        // Affiche les films si nécessaire
        if (filter === 'both' || filter === 'movie') {
            moviesToShow.forEach(media => {
                const mediaCard = `
                    <a href="film.html?id=${media.id}" class="flex-shrink-0 w-48 snap-start">
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
                moviesContainer.innerHTML += mediaCard;
            });
        }

        // Affiche les séries si nécessaire
        if (filter === 'both' || filter === 'serie') {
            seriesToShow.forEach(media => {
                const mediaCard = `
                    <a href="serie.html?id=${media.id}" class="flex-shrink-0 w-36 snap-start">
                        <div class="w-full bg-center bg-no-repeat aspect-[2/3] bg-cover rounded" style='background-image: url("${media.posterUrl}");'></div>
                        <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">${media.title}</p>
                         <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <div class="flex items-center gap-1">
                                <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                <span>${media.imdb}</span>
                            </div>
                        </div>
                    </a>
                `;
                seriesContainer.innerHTML += mediaCard;
            });
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

    // Affichage initial
    renderMedia('both');
});