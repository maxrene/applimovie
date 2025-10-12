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
        document.getElementById('media-genres').textContent = mediaItem.genres.join(' - ');
        document.getElementById('media-imdb').textContent = mediaItem.imdb;
        document.getElementById('media-rt').textContent = mediaItem.rottenTomatoes + '%';
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
        }

    } else {
        document.body.innerHTML = '<h1 class="text-white text-center text-2xl mt-10">Contenu non trouvé</h1>';
    }
});