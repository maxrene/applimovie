// details.js - Version Hybride (Cache Local + Mise à jour dynamique)

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_BANNER = 'https://image.tmdb.org/t/p/original';
const IMG_BASE_PROFILE = 'https://image.tmdb.org/t/p/w185';

let currentCastData = [];
let isCastExpanded = false;

// Charger les préférences utilisateur
const userRegion = localStorage.getItem('userRegion') || 'FR';
const myPlatformIds = JSON.parse(localStorage.getItem('selectedPlatforms')) || [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mediaId = urlParams.get('id');
    
    const isMovie = window.location.pathname.includes('film.html');
    const type = isMovie ? 'movie' : 'tv';

    if (!mediaId) return console.error("Pas d'ID");

    initializeWatchlistButton(mediaId);

    const seeAllLink = document.querySelector('#cast-section a') || document.querySelector('a[href="#"][class*="text-primary"]');
    if (seeAllLink) {
        seeAllLink.addEventListener('click', (e) => {
            e.preventDefault();
            toggleCastExpansion(seeAllLink);
        });
    }

    let localData = (typeof mediaData !== 'undefined') ? mediaData.find(m => String(m.id) === mediaId) : null;

    if (localData) {
        console.log("✅ Film trouvé dans le cache local (data.js)");
        updateUI(localData, type, true); 
        fetchUpdates(mediaId, type);
    } else {
        console.log("🌍 Film inconnu localement, recherche sur TMDB...");
        fetchFullFromTMDB(mediaId, type);
    }
});

async function fetchFullFromTMDB(id, type) {
    try {
        const url = `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,watch/providers,similar,external_ids`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur TMDB");
        const data = await res.json();
        
        const formattedData = formatTMDBData(data, type);
        updateUI(formattedData, type, false);

        // Mettre à jour le streaming avec les données complètes (sans filtrage précoce)
        if(data['watch/providers']?.results) {
            updateStreamingUI(data['watch/providers'].results);
        }

        if (type === 'tv' && data.seasons) {
            updateSeasonsUI(data.seasons, id, data.number_of_episodes);
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchUpdates(id, type) {
    try {
        // Récupérer les providers SANS filtrer directement
        const streamingUrl = `${BASE_URL}/${type}/${id}/watch/providers?api_key=${TMDB_API_KEY}`;
        const streamingRes = await fetch(streamingUrl);
        const streamingData = await streamingRes.json();
        // Passer tout l'objet results à la fonction d'update pour appliquer la logique Région + Canal
        updateStreamingUI(streamingData.results || {});

        const creditsUrl = `${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`;
        const creditsRes = await fetch(creditsUrl);
        const creditsData = await creditsRes.json();

        const cast = creditsData.cast?.map(c => ({
            id: c.id,
            name: c.name,
            character: c.character,
            imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
        })) || [];
        
        updateCastUI(cast);

        if (type === 'movie') {
            const similarUrl = `${BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}`;
            const similarRes = await fetch(similarUrl);
            const similarData = await similarRes.json();

            const similarMovies = similarData.results?.map(s => ({
                id: s.id,
                title: s.title,
                posterUrl: s.poster_path ? IMG_BASE_POSTER + s.poster_path : 'https://placehold.co/200x300'
            })) || [];

            updateSimilarMoviesUI(similarMovies);
        } else if (type === 'tv') {
            const seriesDetailsUrl = `${BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
            const seriesDetailsRes = await fetch(seriesDetailsUrl);
            const seriesDetailsData = await seriesDetailsRes.json();

            let creator = null;
            if (seriesDetailsData.created_by && seriesDetailsData.created_by.length > 0) {
                const c = seriesDetailsData.created_by[0];
                creator = {
                    name: c.name,
                    imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
                };
            } else {
                const director = seriesDetailsData.credits?.crew?.find(c => c.job === 'Director');
                if (director) {
                    creator = {
                        name: director.name,
                        imageUrl: director.profile_path ? IMG_BASE_PROFILE + director.profile_path : 'https://placehold.co/64x64'
                    };
                }
            }
            updatePersonUI(creator, 'tv');

            const firstAirDate = seriesDetailsData.first_air_date;
            const lastAirDate = seriesDetailsData.last_air_date;
            const status = seriesDetailsData.status;
            const startYear = firstAirDate?.split('-')[0] || '';

            if(startYear) {
                let yearText = startYear;
                if (status === 'Ended') {
                    const endYear = lastAirDate?.split('-')[0] || '';
                    if (endYear && startYear !== endYear) {
                        yearText = `${startYear} - ${endYear}`;
                    }
                } else {
                    yearText = `${startYear} - `;
                }
                document.getElementById('media-year').textContent = yearText;
            }

            if (seriesDetailsData.seasons) {
                updateSeasonsUI(seriesDetailsData.seasons, id, seriesDetailsData.number_of_episodes);
            }
        }

    } catch (e) {
        console.error("Erreur mise à jour", e);
    }
}

function updateUI(data, type, isLocal) {
    document.getElementById('media-banner').src = data.bannerUrl;
    document.getElementById('media-poster').src = data.posterUrl;
    document.getElementById('media-title').textContent = data.title;
    document.getElementById('media-year').textContent = data.year;
    document.getElementById('media-synopsis').textContent = data.synopsis;

    document.getElementById('media-imdb').textContent = data.imdb;
    document.getElementById('media-rt').textContent = data.rottenTomatoes === 'xx' ? '' : (data.rottenTomatoes.includes('%') ? data.rottenTomatoes : data.rottenTomatoes + '%');

    if (type === 'movie') {
        document.getElementById('media-duration').textContent = data.duration;
    } else {
        document.getElementById('media-seasons').textContent = typeof data.seasons === 'number' ? `${data.seasons} Seasons` : data.seasons;
    }

    const genresContainer = document.getElementById('media-genres');
    genresContainer.innerHTML = '';
    const genreList = data.genres.map(g => typeof g === 'string' ? g : g.name); 
    genreList.forEach((g, i) => {
        genresContainer.innerHTML += `<span class="font-medium">${g}</span>${i < genreList.length - 1 ? '<span class="h-3 w-px bg-gray-600 mx-2"></span>' : ''}`;
    });

    // Si les données sont locales, updateStreamingUI pourrait recevoir une liste déjà filtrée ou non
    // Pour simplifier, fetchUpdates s'occupera de rafraichir ça proprement
    if (data.cast && data.cast.length > 0) updateCastUI(data.cast);
    
    updatePersonUI(data.director, type);
    updateAwardsUI(data);

    if (type === 'movie' && data.similarMovies) {
        updateSimilarMoviesUI(data.similarMovies);
    }
}

function updateSimilarMoviesUI(similarMovies) {
    const simSection = document.getElementById('similar-movies-section');
    const simContainer = document.getElementById('similar-movies-container');

    if(simSection && similarMovies && similarMovies.length > 0) {
        simSection.style.display = 'block';
        simContainer.innerHTML = '';
        similarMovies.slice(0,4).forEach(sim => {
            simContainer.innerHTML += `
                <div class="w-32 flex-shrink-0 cursor-pointer" onclick="window.location.href='film.html?id=${sim.id}'">
                    <img class="w-full rounded-lg" src="${sim.posterUrl}"/>
                    <p class="mt-2 truncate text-sm font-semibold text-white">${sim.title}</p>
                </div>`;
        });
    } else if(simSection) {
        simSection.style.display = 'none';
    }
}

// --- LOGIQUE DE STREAMING MISE À JOUR ---
function updateStreamingUI(allProvidersData) {
    const container = document.getElementById('available-on-container');
    if (!container) return;
    container.innerHTML = '';

    // Si on a reçu un tableau directement (cas legacy), on assume que c'est pour la France
    // Sinon c'est l'objet complet { FR: {...}, IE: {...} }
    let providers = [];
    if (Array.isArray(allProvidersData)) {
        providers = allProvidersData; // Fallback
    } else {
        // 1. Récupérer providers pour le pays choisi
        if (allProvidersData[userRegion] && allProvidersData[userRegion].flatrate) {
            providers = [...allProvidersData[userRegion].flatrate];
        }
        // 2. Exception Canal+
        if (userRegion !== 'FR' && myPlatformIds.includes('canal')) {
            if (allProvidersData['FR'] && allProvidersData['FR'].flatrate) {
                const canal = allProvidersData['FR'].flatrate.find(p => p.provider_id === 392 || p.provider_name.includes('Canal'));
                if (canal && !providers.some(p => p.provider_id === canal.provider_id)) {
                    providers.push(canal);
                }
            }
        }
    }

    // Mapping rapide pour filtrer selon "Mes Plateformes"
    // Fonction utilitaire interne pour matcher les IDs
    const getInternalId = (name) => {
        const lower = name.toLowerCase();
        if (lower.includes('netflix')) return 'netflix';
        if (lower.includes('amazon') || lower.includes('prime')) return 'prime';
        if (lower.includes('disney')) return 'disney';
        if (lower.includes('apple')) return 'apple';
        if (lower.includes('canal')) return 'canal';
        if (lower.includes('paramount')) return 'paramount';
        if (lower.includes('max') || lower.includes('hbo')) return 'max';
        if (lower.includes('sky')) return 'skygo';
        if (lower.includes('now')) return 'now';
        return 'other';
    };

    // Filtrer pour n'afficher que les plateformes sélectionnées par l'utilisateur
    // Si l'utilisateur n'a rien configuré, on affiche tout par défaut (optionnel)
    let displayList = providers;
    if (myPlatformIds.length > 0) {
        displayList = providers.filter(p => myPlatformIds.includes(getInternalId(p.provider_name)));
    }

    if (displayList.length > 0) {
        displayList.forEach(p => {
            const logo = p.logo_path ? IMG_BASE_PROFILE + p.logo_path : 'https://placehold.co/64x64';
            container.innerHTML += `<img src="${logo}" alt="${p.provider_name}" title="${p.provider_name}" class="h-6 w-6 rounded-md"/>`;
        });
    } else {
        if(providers.length > 0 && myPlatformIds.length > 0) {
             container.innerHTML = '<span class="text-gray-500 text-xs">Non dispo sur vos plateformes</span>';
        } else {
            container.innerHTML = '<span class="text-gray-500 text-xs">Indisponible</span>';
        }
    }
}

function updateCastUI(cast) {
    currentCastData = cast;
    const castContainer = document.getElementById('full-cast-container');
    const castSection = document.getElementById('cast-section');

    let container = castContainer;
    let section = castSection;

    if (!section && container) {
        section = container.parentElement.parentElement;
    }

    if (currentCastData && currentCastData.length > 0) {
        if(section) section.style.display = 'block';
        renderCastList();
    } else if(section) {
        section.style.display = 'none';
    }
}

function renderCastList() {
    const castContainer = document.getElementById('full-cast-container');
    if (!castContainer) return;

    const seeAllLink = document.querySelector('#cast-section a') || castContainer.parentElement.querySelector('a');

    castContainer.innerHTML = '';

    const limit = isCastExpanded ? 20 : 4;
    const displayList = currentCastData.slice(0, limit);

    displayList.forEach(member => {
    const link = member.id ? `person.html?id=${member.id}` : '#';
    
    castContainer.innerHTML += `
        <a href="${link}" class="flex items-center gap-3 group hover:bg-white/10 p-2 rounded-lg transition-colors duration-200">
            <img class="h-14 w-14 rounded-full object-cover flex-shrink-0 group-hover:scale-105 transition-transform duration-200" src="${member.imageUrl}" onerror="this.src='https://placehold.co/64x64'"/>
            <div>
                <p class="font-semibold text-white text-sm group-hover:text-primary transition-colors">${member.name}</p>
                <p class="text-xs text-gray-400">${member.character}</p>
            </div>
        </a>`;
    });

    if (seeAllLink) {
        if (currentCastData.length <= 4) {
            seeAllLink.style.display = 'none';
        } else {
            seeAllLink.style.display = 'inline-block';
            seeAllLink.textContent = isCastExpanded ? 'Show Less' : 'See All';
        }
    }
}

function toggleCastExpansion(linkElement) {
    isCastExpanded = !isCastExpanded;
    renderCastList();
}

function updatePersonUI(person, type) {
    const section = document.getElementById('director-section');
    if (!section) return;

    if (!person || !person.name || person.name === 'Unknown') {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    document.getElementById('director-image').src = person.imageUrl;
    document.getElementById('director-name').textContent = person.name;

    const roleTitle = document.getElementById('director-title');
    const roleText = document.getElementById('director-role');

    const role = (type === 'tv') ? 'Creator' : 'Director';

    if (roleTitle) roleTitle.textContent = role;
    if (roleText) roleText.textContent = role;
}

function updateSeasonsUI(seasons, seriesId, totalEpisodes) {
    const container = document.getElementById('seasons-episodes-container');
    if (!container) return;

    container.innerHTML = '';

    seasons.forEach(season => {
        if (season.season_number === 0 || season.episode_count === 0) return;

        const seasonCardHTML = `
            <div class="season-card rounded-lg bg-gray-800" data-season-number="${season.season_number}">
                <div class="flex items-center justify-between p-3 cursor-pointer">
                    <h3 class="font-semibold text-white">${season.name}</h3>
                    <span class="text-xs text-gray-400">${season.episode_count} Episodes</span>
                </div>
        <div class="episodes-container"></div>
            </div>
        `;
        container.innerHTML += seasonCardHTML;
    });

    document.querySelectorAll('.season-card .cursor-pointer').forEach(header => {
        header.addEventListener('click', async () => {
            const card = header.closest('.season-card');
            const episodesContainer = card.querySelector('.episodes-container');
            const seasonNumber = card.dataset.seasonNumber;

            const cardIsOpen = card.classList.contains('open');

            if (cardIsOpen) {
                card.classList.remove('open');
            } else {
                card.classList.add('open');
                if (!episodesContainer.dataset.loaded) {
                    episodesContainer.innerHTML = '<div class="p-3 border-t border-gray-700"><p class="text-gray-400">Loading episodes...</p></div>';
                    try {
                        const url = `${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`;
                        const res = await fetch(url);
                        if (!res.ok) throw new Error('Failed to fetch season details');
                        const seasonDetails = await res.json();

                        const episodes = seasonDetails.episodes;
                        if (!episodes || episodes.length === 0) {
                            episodesContainer.innerHTML = '<div class="p-3 border-t border-gray-700"><p class="text-gray-400">No episode information available.</p></div>';
                        } else {
                            const watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
                            const seriesWatchedEpisodes = watchedEpisodes[seriesId] || [];

                            const episodesListHTML = episodes.map(episode => {
                                const runtime = episode.runtime ? `${episode.runtime}m` : '';
                                const isChecked = seriesWatchedEpisodes.includes(episode.id);
                                return `
                                    <div class="flex items-center gap-4 p-2 rounded-lg hover:bg-white/10">
                                        <span class="text-sm font-medium text-gray-400 w-6 text-center">${episode.episode_number}</span>
                                        <div class="flex-1">
                                            <p class="font-semibold text-white">${episode.name}</p>
                                            <p class="text-xs text-gray-500">${runtime}</p>
                                        </div>
                                        <input type="checkbox" data-episode-id="${episode.id}" class="h-6 w-6 rounded-md bg-gray-900/50 border-gray-700 text-primary focus:ring-primary focus:ring-2 cursor-pointer" ${isChecked ? 'checked' : ''}>
                                    </div>`;
                            }).join('');

                            episodesContainer.innerHTML = `<div class="border-t border-gray-700 px-3 py-4 space-y-2">${episodesListHTML}</div>`;

                            episodesContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                                checkbox.addEventListener('change', () => {
                                    const episodeId = parseInt(checkbox.dataset.episodeId, 10);
                                    toggleEpisodeWatchedStatus(seriesId, episodeId, totalEpisodes);
                                });
                            });
                        }

                        episodesContainer.dataset.loaded = 'true';
                    } catch (e) {
                        console.error('Error fetching episodes:', e);
                        episodesContainer.innerHTML = '<div class="p-3 border-t border-gray-700"><p class="text-red-500">Could not load episodes.</p></div>';
                    }
                }
            }
        });
    });
}

function toggleEpisodeWatchedStatus(seriesId, episodeId, totalEpisodes) {
    let watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
    if (!watchedEpisodes[seriesId]) {
        watchedEpisodes[seriesId] = [];
    }

    const seriesIdNum = parseInt(seriesId, 10);
    const episodeIndex = watchedEpisodes[seriesId].indexOf(episodeId);

    if (episodeIndex > -1) {
        watchedEpisodes[seriesId].splice(episodeIndex, 1);
    } else {
        watchedEpisodes[seriesId].push(episodeId);
    }

    let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    if (!watchlist.some(item => item.id === seriesIdNum)) {
        watchlist.push({ id: seriesIdNum, added_at: new Date().toISOString() });
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
    }

    localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

    const watchedCount = watchedEpisodes[seriesId].length;
    if (totalEpisodes && watchedCount === totalEpisodes) {
        let watchedList = JSON.parse(localStorage.getItem('watchedSeries')) || [];
        if (!watchedList.includes(seriesIdNum)) {
            watchedList.push(seriesIdNum);
            localStorage.setItem('watchedSeries', JSON.stringify(watchedList));
            updateWatchlistButton(seriesId);
        }
    } else {
        let watchedList = JSON.parse(localStorage.getItem('watchedSeries')) || [];
        if (watchedList.includes(seriesIdNum)) {
            watchedList = watchedList.filter(id => id !== seriesIdNum);
            localStorage.setItem('watchedSeries', JSON.stringify(watchedList));
            updateWatchlistButton(seriesId);
        }
    }
}

function formatTMDBData(data, type) {
    const isMovie = type === 'movie';
    
    let dir = { name: 'Unknown', imageUrl: 'https://placehold.co/64x64' };
    if(isMovie) {
        const d = data.credits?.crew?.find(c => c.job === 'Director');
        if(d) dir = { name: d.name, imageUrl: d.profile_path ? IMG_BASE_PROFILE + d.profile_path : dir.imageUrl };
    } else if(data.created_by?.length > 0) {
        dir = { name: data.created_by[0].name, imageUrl: data.created_by[0].profile_path ? IMG_BASE_PROFILE + data.created_by[0].profile_path : dir.imageUrl };
    }

    const cast = data.credits?.cast?.map(c => ({
        id: c.id,
        name: c.name,
        character: c.character,
        imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
    })) || [];

    const similar = data.similar?.results?.map(s => ({
        id: s.id,
        title: s.title,
        posterUrl: s.poster_path ? IMG_BASE_POSTER + s.poster_path : 'https://placehold.co/200x300'
    })) || [];

    return {
        id: data.id,
        title: isMovie ? data.title : data.name,
        year: (() => {
            if (isMovie) {
                return data.release_date?.split('-')[0] || 'N/A';
            }
            const firstAirDate = data.first_air_date;
            const lastAirDate = data.last_air_date;
            const status = data.status;
            const startYear = firstAirDate?.split('-')[0] || '';
            if (!startYear) return 'N/A';
            if (status === 'Ended') {
                const endYear = lastAirDate?.split('-')[0] || '';
                if (endYear && startYear !== endYear) {
                    return `${startYear} - ${endYear}`;
                }
                return startYear;
            }
            return `${startYear} - `;
        })(),
        genres: data.genres || [],
        duration: isMovie ? `${Math.floor(data.runtime/60)}h ${data.runtime%60}m` : '',
        seasons: !isMovie ? data.number_of_seasons : null,
        imdb: data.vote_average?.toFixed(1) || 'N/A',
        rottenTomatoes: 'TMDB',
        synopsis: data.overview,
        posterUrl: data.poster_path ? IMG_BASE_POSTER + data.poster_path : '',
        bannerUrl: data.backdrop_path ? IMG_BASE_BANNER + data.backdrop_path : '',
        director: dir,
        cast: cast,
        similarMovies: similar
    };
}

const awardIconSVG = `
    <svg class="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path clip-rule="evenodd" d="M15.11 4.414a.75.75 0 01.07 1.058l-1.95 2.438a.75.75 0 01-1.127.001l-1.95-2.437a.75.75 0 011.058-1.06l1.39 1.737 1.39-1.737a.75.75 0 011.058-.07zM10 2a1.5 1.5 0 011.5 1.5v1.25a.75.75 0 01-1.5 0V3.5A1.5 1.5 0 0110 2zM3.53 5.472a.75.75 0 011.06-.07l1.95 2.438a.75.75 0 01-.001 1.127l-1.95 2.437a.75.75 0 11-1.128-1.059l1.39-1.737-1.39-1.737a.75.75 0 01-.07-1.058zM10 18a1.5 1.5 0 01-1.5-1.5v-1.25a.75.75 0 011.5 0V16.5A1.5 1.5 0 0110 18zM16.47 5.472a.75.75 0 01.07 1.058l-1.95 2.438a.75.75 0 01-1.127-.001L11.52 6.53a.75.75 0 111.058-1.06l1.39 1.737 1.39-1.737a.75.75 0 011.104.07zM10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" fill-rule="evenodd"></path>
        <path d="M7.163 15.023a.75.75 0 01.623.834 3.5 3.5 0 006.428 0 .75.75 0 011.39.55 5 5 0 01-9.208 0 .75.75 0 01.768-.834z"></path>
    </svg>`;

function updateAwardsUI(data) {
    const awardsSection = document.getElementById('awards-section');
    if (!awardsSection) return;

    let wins = 0;
    let nominations = 0;
    let awardName = '';

    const externalAwardInfo = window.awardsData && window.awardsData[data.id];

    if (externalAwardInfo) {
        wins = externalAwardInfo.wins;
        nominations = externalAwardInfo.nominations;
        awardName = externalAwardInfo.type === 'movie' ? 'Oscar' : 'Emmy';
    } else {
        const isMovie = data.type === 'movie' || (data.title && !data.name); 
        awardName = isMovie ? 'Oscar' : 'Emmy';
        wins = isMovie ? (data.oscarWins || 0) : (data.emmyWins || 0);
        nominations = isMovie ? (data.oscarNominations || 0) : (data.emmyNominations || 0);
    }

    let awardsHTML = '';

    if (wins > 0) {
        awardsHTML += `
            <div class="flex items-center gap-2 text-sm">
                ${awardIconSVG}
                <span class="font-medium text-gray-300">${wins} ${awardName} win${wins > 1 ? 's' : ''}</span>
            </div>`;
    }

    if (nominations > 0) {
        awardsHTML += `
            <div class="flex items-center gap-2 text-sm">
                ${awardIconSVG}
                <span class="font-medium text-gray-300">${nominations} ${awardName} nomination${nominations > 1 ? 's' : ''}</span>
            </div>`;
    }

    if (awardsHTML) {
        awardsSection.innerHTML = awardsHTML;
        awardsSection.style.display = 'flex';
    } else {
        awardsSection.style.display = 'none';
    }
}

function initializeWatchlistButton(mediaId) {
    const watchlistButton = document.getElementById('watchlist-button');
    if (!watchlistButton) return;

    updateWatchlistButton(mediaId);

    watchlistButton.addEventListener('click', () => {
        toggleWatchlist(mediaId);
    });
}

async function toggleWatchlist(mediaId) {
    const mediaIdNum = parseInt(mediaId, 10);
    const isMovie = window.location.pathname.includes('film.html');
    const watchedListKey = isMovie ? 'watchedMovies' : 'watchedSeries';

    let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    let watchedList = JSON.parse(localStorage.getItem(watchedListKey)) || [];

    const isInWatchlist = watchlist.some(item => item.id === mediaIdNum);
    const isWatched = watchedList.includes(mediaIdNum);

    if (isWatched) {
        watchlist = watchlist.filter(item => item.id !== mediaIdNum);
        watchedList = watchedList.filter(id => id !== mediaIdNum);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        localStorage.setItem(watchedListKey, JSON.stringify(watchedList));
        updateWatchlistButton(mediaId);
    } else if (isInWatchlist) {
        if (!isMovie) {
            const seriesDetailsUrl = `${BASE_URL}/tv/${mediaId}?api_key=${TMDB_API_KEY}`;
            const seriesDetailsRes = await fetch(seriesDetailsUrl);
            const seriesDetailsData = await seriesDetailsRes.json();
            const totalEpisodes = seriesDetailsData.number_of_episodes;

            const watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
            const seriesWatchedEpisodes = watchedEpisodes[mediaId] || [];

            if (seriesWatchedEpisodes.length < totalEpisodes) {
                showConfirmationModal(mediaId, totalEpisodes);
                return;
            }
        }
        watchedList.push(mediaIdNum);
        localStorage.setItem(watchedListKey, JSON.stringify(watchedList));
        updateWatchlistButton(mediaId);
    } else {
        watchlist.push({ id: mediaIdNum, added_at: new Date().toISOString() });
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        updateWatchlistButton(mediaId);
    }
}

function showConfirmationModal(seriesId, totalEpisodes) {
    const modal = document.getElementById('confirmation-modal');
    modal.style.display = 'flex';

    document.getElementById('modal-cancel-button').onclick = () => {
        modal.style.display = 'none';
    };

    document.getElementById('modal-confirm-button').onclick = async () => {
        const seriesIdNum = parseInt(seriesId, 10);
        let watchedList = JSON.parse(localStorage.getItem('watchedSeries')) || [];
        if (!watchedList.includes(seriesIdNum)) {
            watchedList.push(seriesIdNum);
            localStorage.setItem('watchedSeries', JSON.stringify(watchedList));
        }

        const url = `${BASE_URL}/tv/${seriesId}?api_key=${TMDB_API_KEY}`;
        const res = await fetch(url);
        const seriesData = await res.json();

        const seasonPromises = seriesData.seasons
            .filter(season => season.season_number !== 0)
            .map(season =>
                fetch(`${BASE_URL}/tv/${seriesId}/season/${season.season_number}?api_key=${TMDB_API_KEY}`)
                    .then(res => res.json())
            );

        const seasonsData = await Promise.all(seasonPromises);

        const allEpisodeIds = seasonsData.flatMap(seasonData =>
            seasonData.episodes ? seasonData.episodes.map(e => e.id) : []
        );

        let watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
        watchedEpisodes[seriesId] = allEpisodeIds;
        localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

        document.querySelectorAll('.episodes-container input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });

        updateWatchlistButton(seriesId);
        modal.style.display = 'none';
    };
}

function updateWatchlistButton(mediaId) {
    const watchlistButton = document.getElementById('watchlist-button');
    if (!watchlistButton) return;

    const mediaIdNum = parseInt(mediaId, 10);
    const isMovie = window.location.pathname.includes('film.html');
    const watchedListKey = isMovie ? 'watchedMovies' : 'watchedSeries';

    const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    const watchedList = JSON.parse(localStorage.getItem(watchedListKey)) || [];

    const isInWatchlist = watchlist.some(item => item.id === mediaIdNum);
    const isWatched = watchedList.includes(mediaIdNum);

    const icon = watchlistButton.querySelector('.material-symbols-outlined');
    const text = watchlistButton.querySelector('span:last-child');

    watchlistButton.classList.remove('bg-gray-700', 'bg-primary', 'bg-green-600');

    if (isWatched) {
        watchlistButton.classList.add('bg-green-600');
        icon.textContent = 'visibility';
        text.textContent = 'Watched';
    } else if (isInWatchlist) {
        watchlistButton.classList.add('bg-primary');
        icon.textContent = 'check';
        text.textContent = 'On Watchlist';
    } else {
        watchlistButton.classList.add('bg-gray-700');
        icon.textContent = 'add';
        text.textContent = 'Watchlist';
    }
}
