const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_PROFILE = 'https://image.tmdb.org/t/p/w185';
const TMDB_API_KEY = 'f1b07b5d2ac7a9f55c5b49a93b18bd33';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const personId = urlParams.get('id');

    if (!personId) {
        console.error("Person ID is missing from the URL");
        return;
    }

    fetchPersonDetails(personId);
});

async function fetchPersonDetails(personId) {
    const url = `${BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=movie_credits,tv_credits`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch person details: ${response.statusText}`);
        }
        const data = await response.json();
        updateUI(data);
    } catch (error) {
        console.error(error);
    }
}

function updateUI(person) {
    document.title = `${person.name} | Actor Profile`;

    const personImage = document.getElementById('person-image');
    personImage.src = person.profile_path ? `${IMG_BASE_PROFILE}${person.profile_path}` : 'https://placehold.co/160x160';
    personImage.alt = person.name;

    document.getElementById('person-name').textContent = person.name;

    const bioElement = document.getElementById('person-bio');
    const readMoreBtn = document.getElementById('read-more-btn');
    const fullBio = person.biography || "No biography available.";
    const bioMaxLength = 300; // Character limit
    let isExpanded = false;

    bioElement.textContent = fullBio;

    if (fullBio.length > bioMaxLength) {
        bioElement.textContent = `${fullBio.substring(0, bioMaxLength)}...`;
        readMoreBtn.style.display = 'inline';
        readMoreBtn.textContent = 'Read More';

        readMoreBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;
            if (isExpanded) {
                bioElement.textContent = fullBio;
                readMoreBtn.textContent = 'Read Less';
            } else {
                bioElement.textContent = `${fullBio.substring(0, bioMaxLength)}...`;
                readMoreBtn.textContent = 'Read More';
            }
        });
    }

    const films = (person.movie_credits.cast || []).concat(person.movie_credits.crew || []);
    const series = (person.tv_credits.cast || []).concat(person.tv_credits.crew || []);

    // Remove duplicates and sort by popularity
    const uniqueFilms = Array.from(new Set(films.map(f => f.id))).map(id => films.find(f => f.id === id)).sort((a,b) => b.popularity - a.popularity);
    const uniqueSeries = Array.from(new Set(series.map(s => s.id))).map(id => series.find(s => s.id === id)).sort((a,b) => b.popularity - a.popularity);

    populateMediaList('films-container', uniqueFilms, 'movie');
    populateMediaList('series-container', uniqueSeries, 'tv');
}

function populateMediaList(containerId, mediaList, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!mediaList || mediaList.length === 0) {
        container.innerHTML = '<p class="text-gray-400">No information available.</p>';
        return;
    }

    mediaList.forEach(media => {
        const title = type === 'movie' ? media.title : media.name;
        const releaseDate = type === 'movie' ? media.release_date : media.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
        const posterPath = media.poster_path ? `${IMG_BASE_POSTER}${media.poster_path}` : 'https://placehold.co/64x96';
        const mediaLink = type === 'movie' ? `film.html?id=${media.id}` : `serie.html?id=${media.id}`;

        const mediaElement = document.createElement('a');
        mediaElement.href = mediaLink;
        mediaElement.classList.add('flex', 'items-center', 'gap-4');
        mediaElement.innerHTML = `
            <img alt="${title} poster" class="h-24 w-16 rounded-lg object-cover" src="${posterPath}"/>
            <div class="flex-1">
                <p class="font-semibold text-white">${title}</p>
                <p class="text-sm text-gray-400">${year}</p>
            </div>
            <span class="material-symbols-outlined text-gray-500">
              chevron_right
            </span>
        `;
        container.appendChild(mediaElement);
    });
}
