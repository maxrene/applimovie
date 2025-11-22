document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const popularSearchesContainer = document.getElementById('popular-searches');
    const popularSearchesItemsContainer = document.getElementById('popular-searches-container');
    const previousSearchesContainer = document.getElementById('previous-searches');
    const previousSearchesItemsContainer = document.getElementById('previous-searches-container');

    const API_KEY = TMDB_API_KEY;
    const BASE_URL = 'https://api.themoviedb.org/3';
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

    let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

    async function fetchPopular() {
        try {
            const response = await fetch(`${BASE_URL}/trending/all/week?api_key=${API_KEY}&language=en-US&watch_region=FR`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            displayPopular(data.results);
        } catch (error) {
            console.error('Error fetching popular searches:', error);
            popularSearchesItemsContainer.innerHTML = '<p class="text-red-500">Could not fetch popular searches.</p>';
        }
    }

    function displayPopular(items) {
        popularSearchesItemsContainer.innerHTML = '';
        items.slice(0, 10).forEach(item => {
            const itemElement = document.createElement('a');
            const itemTitle = item.title || item.name;
            const itemType = item.media_type === 'movie' ? 'film' : 'serie';
            itemElement.href = `${itemType}.html?id=${item.id}`;
            itemElement.classList.add('group', 'block');
            itemElement.innerHTML = `
                <div class="relative aspect-w-2 aspect-h-3">
                    <img alt="${itemTitle}" class="w-full h-full object-cover rounded-lg group-hover:opacity-80 transition-opacity" src="${IMAGE_BASE_URL}${item.poster_path}"/>
                </div>
                <div class="mt-2 flex items-center justify-between text-sm">
                    <div class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-yellow-400 text-base">star</span>
                        <span class="font-semibold text-gray-800 dark:text-gray-200">${item.vote_average.toFixed(1)}</span>
                    </div>
                </div>
            `;
            popularSearchesItemsContainer.appendChild(itemElement);
        });
    }

    function displaySearchHistory() {
        previousSearchesItemsContainer.innerHTML = '';
        if (searchHistory.length > 0) {
            popularSearchesContainer.style.display = 'none';
            previousSearchesContainer.style.display = 'block';

            searchHistory.forEach(item => {
                const itemElement = document.createElement('a');
                const itemTitle = item.title || item.name;
                const itemType = item.media_type === 'movie' ? 'film' : 'serie';
                itemElement.href = `${itemType}.html?id=${item.id}`;
                itemElement.classList.add('group', 'block');
                itemElement.innerHTML = `
                    <div class="relative aspect-w-2 aspect-h-3">
                        <img alt="${itemTitle}" class="w-full h-full object-cover rounded-lg group-hover:opacity-80 transition-opacity" src="${IMAGE_BASE_URL}${item.poster_path}"/>
                    </div>
                    <div class="mt-2 flex items-center justify-between text-sm">
                        <div class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-yellow-400 text-base">star</span>
                            <span class="font-semibold text-gray-800 dark:text-gray-200">${item.vote_average.toFixed(1)}</span>
                        </div>
                    </div>
                `;
                previousSearchesItemsContainer.appendChild(itemElement);
            });
        } else {
            popularSearchesContainer.style.display = 'block';
            previousSearchesContainer.style.display = 'none';
            fetchPopular();
        }
    }

    async function search(query) {
        if (query.trim() === '') {
            searchResultsContainer.innerHTML = '';
            displaySearchHistory();
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&watch_region=FR`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            displaySearchResults(data.results);
        } catch (error) {
            console.error('Error fetching search results:', error);
            searchResultsContainer.innerHTML = '<p class="text-red-500">Could not fetch search results.</p>';
        }
    }

    function displaySearchResults(results) {
        searchResultsContainer.innerHTML = '';
        popularSearchesContainer.style.display = 'none';
        previousSearchesContainer.style.display = 'none';

        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<p class="text-gray-500">No results found.</p>';
            return;
        }

        const listElement = document.createElement('div');
        listElement.className = 'space-y-4';

        results.forEach(item => {
            if (item.media_type === 'person' && item.profile_path === null) return;
            if ((item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path === null) return;

            const itemElement = document.createElement('a');
            const itemTitle = item.title || item.name;
            const itemType = item.media_type === 'movie' ? 'Movie' : (item.media_type === 'tv' ? 'TV Show' : 'Person');
            const pageType = item.media_type === 'movie' ? 'film' : (item.media_type === 'tv' ? 'serie' : 'person');

            itemElement.href = `${pageType}.html?id=${item.id}`;
            itemElement.classList.add('flex', 'items-center', 'gap-4', 'p-2', '-m-2', 'rounded-lg', 'hover:bg-gray-100', 'dark:hover:bg-white/10', 'transition-colors');
            itemElement.addEventListener('click', () => {
                addToSearchHistory(item);
            });

            let imageHtml;
            if (item.poster_path || item.profile_path) {
                imageHtml = `<img alt="${itemTitle}" class="w-12 h-16 object-cover rounded-md" src="${IMAGE_BASE_URL}${item.poster_path || item.profile_path}"/>`;
            } else {
                imageHtml = `
                    <div class="w-12 h-16 bg-gray-200 dark:bg-primary/10 rounded-md flex items-center justify-center">
                        <span class="material-symbols-outlined text-gray-500 dark:text-gray-400">${item.media_type === 'movie' ? 'theaters' : 'tv_gen'}</span>
                    </div>
                `;
            }

            itemElement.innerHTML = `
                ${imageHtml}
                <div class="flex-1">
                    <p class="font-semibold text-gray-900 dark:text-white">${itemTitle}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${itemType}</p>
                </div>
                <span class="material-symbols-outlined text-gray-400 dark:text-gray-500">north_west</span>
            `;
            listElement.appendChild(itemElement);
        });

        searchResultsContainer.appendChild(listElement);
    }

    function addToSearchHistory(item) {
        // Avoid duplicates
        if (!searchHistory.some(historyItem => historyItem.id === item.id)) {
            searchHistory.unshift(item);
            if (searchHistory.length > 10) {
                searchHistory.pop();
            }
            localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        }
    }

    searchInput.addEventListener('input', (e) => {
        search(e.target.value);
    });

    displaySearchHistory();
});
