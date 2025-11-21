// details.js
document.addEventListener('DOMContentLoaded', () => {
    // Récupère les paramètres de l'URL
    const url = window.location.href;
    const mediaIdStr = url.split('?id=')[1];
    const mediaId = parseInt(mediaIdStr);

    // Trouve le bon film/série dans notre base de données
    const mediaItem = mediaData.find(m => m.id === mediaId);

    if (mediaItem) {
        // Met à jour les éléments communs
        document.getElementById('media-title').textContent = mediaItem.title;
        document.getElementById('media-banner').src = mediaItem.bannerUrl;
        document.getElementById('media-poster').src = mediaItem.posterUrl;
        document.getElementById('media-year').textContent = mediaItem.year;
        document.getElementById('media-duration').textContent = mediaItem.duration;
        document.getElementById('media-imdb').textContent = mediaItem.imdb;
        document.getElementById('media-rt').textContent = mediaItem.rottenTomatoes;
        document.getElementById('media-synopsis').textContent = mediaItem.synopsis;

        // Met à jour les genres
        const genresContainer = document.getElementById('media-genres');
        genresContainer.innerHTML = ''; // Vide les genres précédents
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

        // Met à jour le réalisateur ou le créateur
        const directorInfo = mediaItem.director || mediaItem.creator;
        if (directorInfo) {
            document.getElementById('director-image').src = directorInfo.imageUrl;
            document.getElementById('director-name').textContent = directorInfo.name;
        }

        // Met à jour les plateformes de streaming
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

        // Met à jour le casting
        const castContainer = document.getElementById('full-cast-container');
        if (mediaItem.cast) {
            castContainer.innerHTML = '';
            mediaItem.cast.forEach(member => {
                const castMemberDiv = document.createElement('div');
                castMemberDiv.className = 'flex items-center gap-3';
                castMemberDiv.innerHTML = `
                    <img alt="${member.name}" class="h-14 w-14 rounded-full object-cover" src="${member.imageUrl}"/>
                    <div>
                        <p class="font-semibold text-white">${member.name}</p>
                        <p class="text-xs text-gray-400">${member.character}</p>
                    </div>
                `;
                castContainer.appendChild(castMemberDiv);
            });
        }

        // Met à jour les films similaires
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
    }
});
