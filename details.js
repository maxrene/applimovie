// details.js
document.addEventListener('DOMContentLoaded', () => {
    // Récupère les paramètres de l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const mediaId = parseInt(urlParams.get('id'));

    // Trouve le bon film/série dans notre base de données
    const mediaItem = mediaData.find(m => m.id === mediaId);

    if (mediaItem) {
        // Met à jour les éléments communs
        document.getElementById('media-title').textContent = mediaItem.title;
        document.getElementById('media-banner').src = mediaItem.bannerUrl;
        document.getElementById('media-poster').src = mediaItem.posterUrl;
        document.getElementById('media-year').textContent = mediaItem.year;
        const genresContainer = document.getElementById('media-genres');
        let genresHTML = '';
        mediaItem.genres.forEach((genre, index) => {
            genresHTML += `<span class="font-medium">${genre}</span>`;
            if (index < mediaItem.genres.length - 1) {
                genresHTML += `<span class="h-3 w-px bg-gray-600"></span>`;
            }
        });
        genresContainer.innerHTML = genresHTML;
        document.getElementById('media-imdb').textContent = mediaItem.imdb;
        document.getElementById('media-rt').textContent = mediaItem.rottenTomatoes === 'xx' ? 'xx' : mediaItem.rottenTomatoes + '%';
        document.getElementById('media-synopsis').textContent = mediaItem.synopsis;

        // Met à jour les éléments spécifiques au type (film ou série)
        if (mediaItem.type === 'movie') {
            document.getElementById('media-duration').textContent = mediaItem.duration;
            document.getElementById('director-name').textContent = mediaItem.director.name;
            document.getElementById('director-image').src = mediaItem.director.imageUrl;
        } else if (mediaItem.type === 'serie') {
            document.getElementById('media-seasons').textContent = `${mediaItem.seasons} Seasons`;
            document.getElementById('creator-name').textContent = mediaItem.creator.name;
            document.getElementById('creator-image').src = mediaItem.creator.imageUrl;

            // Populate Full Cast
            const castContainer = document.getElementById('full-cast-container');
            if (mediaItem.cast) {
                let castHTML = '';
                mediaItem.cast.forEach(member => {
                    castHTML += `
                        <div class="flex items-center gap-3">
                            <img alt="${member.name}" class="h-14 w-14 rounded-full object-cover" src="${member.imageUrl}">
                            <div>
                                <p class="font-semibold text-white">${member.name}</p>
                                <p class="text-xs text-gray-400">${member.character}</p>
                            </div>
                        </div>`;
                });
                castContainer.innerHTML = castHTML;
            }

            // Populate Seasons & Episodes
            const seasonsContainer = document.getElementById('seasons-episodes-container');
            if (mediaItem.episodes) {
                let seasonsHTML = '';
                for (const seasonKey in mediaItem.episodes) {
                    const season = mediaItem.episodes[seasonKey];
                    const seasonNum = seasonKey.replace('season', '');
                    let episodesHTML = '';
                    season.forEach(episode => {
                        episodesHTML += `
                            <div class="flex items-center gap-4">
                                <span class="text-sm font-medium text-gray-400">${episode.episode}</span>
                                <div class="flex-1">
                                    <p class="font-semibold text-white">${episode.title}</p>
                                    <p class="text-xs text-gray-500">${episode.duration}</p>
                                </div>
                                <span class="material-symbols-outlined !text-lg text-gray-500">radio_button_unchecked</span>
                            </div>`;
                    });

                    seasonsHTML += `
                        <div class="rounded-lg bg-gray-800">
                            <div class="flex flex-col gap-3 p-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <h3 class="font-semibold text-white">Season ${seasonNum}</h3>
                                        <span class="text-xs text-gray-400">${season.length} Episodes</span>
                                    </div>
                                    <span class="material-symbols-outlined !text-lg text-gray-400">expand_more</span>
                                </div>
                            </div>
                            <div class="border-t border-gray-700 p-4">
                                <div class="space-y-4">
                                    ${episodesHTML}
                                </div>
                            </div>
                        </div>`;
                }
                seasonsContainer.innerHTML = seasonsHTML;
            }
        }

    } else {
        document.body.innerHTML = '<h1 class="text-white text-center text-2xl mt-10">Contenu non trouvé</h1>';
    }
});