// details.js
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mediaId = parseInt(urlParams.get('id'));
    const mediaItem = mediaData.find(m => m.id === mediaId);

    if (mediaItem) {
        // Common details
        document.getElementById('media-title').textContent = mediaItem.title;
        document.getElementById('media-banner').src = mediaItem.bannerUrl;
        document.getElementById('media-poster').src = mediaItem.posterUrl;
        document.getElementById('media-year').textContent = mediaItem.year;
        document.getElementById('media-duration').textContent = mediaItem.duration;
        document.getElementById('media-imdb').textContent = mediaItem.imdb;
        const rtScore = mediaItem.rottenTomatoes;
        document.getElementById('media-rt').textContent = (rtScore && rtScore !== 'xx') ? `${rtScore}%` : rtScore;
        document.getElementById('media-synopsis').textContent = mediaItem.synopsis;

        const genresContainer = document.getElementById('media-genres');
        genresContainer.innerHTML = '';
        mediaItem.genres.forEach((genre, index) => {
            const genreSpan = document.createElement('span');
            genreSpan.className = 'font-medium';
            genreSpan.textContent = genre;
            genresContainer.appendChild(genreSpan);
            if (index < mediaItem.genres.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'h-3 w-px bg-gray-600';
                genresContainer.appendChild(separator);
            }
        });

        const availableOnContainer = document.getElementById('available-on-container');
        if (mediaItem.availableOn) {
            availableOnContainer.innerHTML = '';
            mediaItem.availableOn.forEach(platform => {
                const img = document.createElement('img');
                img.alt = `${platform.name} logo`;
                img.className = 'h-6 w-6 rounded-md';
                img.src = platform.logoUrl;
                availableOnContainer.appendChild(img);
            });
        }

        const castContainer = document.getElementById('full-cast-container');
        if (mediaItem.cast && mediaItem.cast.length > 0) {
            document.getElementById('cast-section').style.display = 'block';
            castContainer.innerHTML = '';
            mediaItem.cast.forEach(member => {
                const castMemberDiv = document.createElement('div');
                castMemberDiv.className = 'flex items-center gap-3';
                castMemberDiv.innerHTML = `
                    <img alt="${member.name}" class="h-14 w-14 rounded-full object-cover flex-shrink-0" src="${member.imageUrl}"/>
                    <div>
                        <p class="font-semibold text-white">${member.name}</p>
                        <p class="text-xs text-gray-400">${member.character}</p>
                    </div>
                `;
                castContainer.appendChild(castMemberDiv);
            });
        } else {
            document.getElementById('cast-section').style.display = 'none';
        }

        if (mediaItem.type === 'movie') {
            document.getElementById('director-section').style.display = 'block';
            document.getElementById('similar-movies-section').style.display = 'block';
            document.getElementById('series-section').style.display = 'none';

            const directorInfo = mediaItem.director;
            if (directorInfo) {
                document.getElementById('director-image').src = directorInfo.imageUrl;
                document.getElementById('director-name').textContent = directorInfo.name;
                document.getElementById('director-role').textContent = 'Director';
            }

            const similarMoviesContainer = document.getElementById('similar-movies-container');
            if (mediaItem.similarMovies) {
                similarMoviesContainer.innerHTML = '';
                mediaItem.similarMovies.forEach(movie => {
                    const movieDiv = document.createElement('div');
                    movieDiv.className = 'w-32 flex-shrink-0';
                    movieDiv.innerHTML = `
                        <img alt="${movie.title} poster" class="w-full rounded-lg" src="${movie.posterUrl}"/>
                        <p class="mt-2 truncate text-sm font-semibold text-white">${movie.title}</p>
                    `;
                    similarMoviesContainer.appendChild(movieDiv);
                });
            }

        } else if (mediaItem.type === 'serie') {
            document.getElementById('director-section').style.display = 'block';
            document.getElementById('similar-movies-section').style.display = 'none';
            document.getElementById('series-section').style.display = 'block';

            const creatorInfo = mediaItem.creator;
            if (creatorInfo) {
                document.getElementById('director-image').src = creatorInfo.imageUrl;
                document.getElementById('director-name').textContent = creatorInfo.name;
                document.getElementById('director-title').textContent = 'Creator';
                document.getElementById('director-role').textContent = 'Creator';
            }

            const seasonSelect = document.getElementById('season-select');
            const episodesContainer = document.getElementById('episodes-container');

            if (typeof mediaItem.seasons === 'number' && mediaItem.episodes) {
                for (let i = 1; i <= mediaItem.seasons; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = `Season ${i}`;
                    seasonSelect.appendChild(option);
                }

                const displayEpisodes = (seasonNumber) => {
                    const seasonKey = `season${seasonNumber}`;
                    const season = mediaItem.episodes[seasonKey];
                    episodesContainer.innerHTML = '';
                    if (season) {
                        season.forEach(episode => {
                            const episodeElement = document.createElement('div');
                            episodeElement.className = 'flex items-center gap-4 rounded-lg bg-gray-800 p-3';
                            episodeElement.innerHTML = `
                                <img alt="Episode thumbnail" class="h-16 w-28 rounded-md object-cover" src="${episode.thumbnail || 'https://placehold.co/112x64'}"/>
                                <div class="flex-1">
                                    <p class="font-semibold text-white">${episode.episode} - ${episode.title}</p>
                                    <p class="text-sm text-gray-400">${episode.duration}</p>
                                </div>
                                <button class="text-white">
                                    <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 6h16M4 12h16m-7 6h7" stroke-linecap="round" stroke-linejoin="round"></path>
                                    </svg>
                                </button>
                            `;
                            episodesContainer.appendChild(episodeElement);
                        });
                    }
                };

                displayEpisodes(1);
                seasonSelect.addEventListener('change', (e) => {
                    displayEpisodes(e.target.value);
                });

            } else if (Array.isArray(mediaItem.seasons)) {
                mediaItem.seasons.forEach((season, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = `Season ${season.season}`;
                    seasonSelect.appendChild(option);
                });

                const displayEpisodes = (seasonIndex) => {
                    const season = mediaItem.seasons[seasonIndex];
                    episodesContainer.innerHTML = '';
                    if (season && season.episodes) {
                        season.episodes.forEach(episode => {
                            const episodeElement = document.createElement('div');
                            episodeElement.className = 'flex items-center gap-4 rounded-lg bg-gray-800 p-3';
                            episodeElement.innerHTML = `
                                <img alt="Episode thumbnail" class="h-16 w-28 rounded-md object-cover" src="${episode.thumbnail || 'https://placehold.co/112x64'}"/>
                                <div class="flex-1">
                                    <p class="font-semibold text-white">${episode.episode} - ${episode.title}</p>
                                    <p class="text-sm text-gray-400">${episode.duration}</p>
                                </div>
                                <button class="text-white">
                                    <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 6h16M4 12h16m-7 6h7" stroke-linecap="round" stroke-linejoin="round"></path>
                                    </svg>
                                </button>
                            `;
                            episodesContainer.appendChild(episodeElement);
                        });
                    }
                };

                displayEpisodes(0);
                seasonSelect.addEventListener('change', (e) => {
                    displayEpisodes(e.target.value);
                });
            }
        }
    } else {
        console.error('Media not found');
    }
});
