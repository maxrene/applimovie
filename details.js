// details.js - Version Hybride (Cache Local + Mise à jour dynamique)

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_BANNER = 'https://image.tmdb.org/t/p/original';
const IMG_BASE_PROFILE = 'https://image.tmdb.org/t/p/w185';

let currentCastData = [];
let isCastExpanded = false;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mediaId = urlParams.get('id'); // ID de l'URL (garder en string)
    
    // Vérifie si on est sur un film ou une série
    const isMovie = window.location.pathname.includes('film.html');
    const type = isMovie ? 'movie' : 'tv';

    if (!mediaId) return console.error("Pas d'ID");

    // Setup 'See All' listener
    const seeAllLink = document.querySelector('#cast-section a') || document.querySelector('a[href="#"][class*="text-primary"]');
    if (seeAllLink) {
        seeAllLink.addEventListener('click', (e) => {
            e.preventDefault();
            toggleCastExpansion(seeAllLink);
        });
    }

    // ÉTAPE 1 : Chercher dans le cache local (data.js)
    // On suppose que mediaData est chargé via <script src="data.js">
    let localData = (typeof mediaData !== 'undefined') ? mediaData.find(m => String(m.id) === mediaId) : null;

    if (localData) {
        console.log("✅ Film trouvé dans le cache local (data.js)");
        // Affiche immédiatement ce qu'on a (Titre, Notes IMDb/RT scrapées, etc.)
        updateUI(localData, type, true); 
        
        // ÉTAPE 2 : Aller chercher le Streaming ET le Casting frais en arrière-plan
        fetchUpdates(mediaId, type);
    } else {
        console.log("🌍 Film inconnu localement, recherche sur TMDB...");
        // Le film n'est pas dans data.js (nouveau film ?), on charge tout depuis TMDB
        fetchFullFromTMDB(mediaId, type);
    }
});

// Fonction pour tout récupérer si le film n'est pas en cache
async function fetchFullFromTMDB(id, type) {
    try {
        const url = `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,watch/providers,similar,external_ids`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur TMDB");
        const data = await res.json();
        
        // On transforme les données TMDB pour qu'elles ressemblent à notre format local
        const formattedData = formatTMDBData(data, type);
        updateUI(formattedData, type, false);

        // S'il s'agit d'une série, on doit aussi afficher les saisons
        if (type === 'tv' && data.seasons) {
            updateSeasonsUI(data.seasons, id);
        }
    } catch (e) {
        console.error(e);
    }
}

// Fonction pour récupérer les mises à jour (Streaming + Casting)
async function fetchUpdates(id, type) {
    try {
        // Fetch Streaming
        const streamingUrl = `${BASE_URL}/${type}/${id}/watch/providers?api_key=${TMDB_API_KEY}`;
        const streamingRes = await fetch(streamingUrl);
        const streamingData = await streamingRes.json();
        updateStreamingUI(streamingData.results?.FR?.flatrate || []);

        // Fetch Credits (Cast & Crew)
        const creditsUrl = `${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`;
        const creditsRes = await fetch(creditsUrl);
        const creditsData = await creditsRes.json();

        // Format and Update Cast
        const cast = creditsData.cast?.map(c => ({
            id: c.id,
            name: c.name,
            character: c.character,
            imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
        })) || [];
        
        updateCastUI(cast);

        // Fetch Similar Movies (only for movies)
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
            // Pour les séries, on va chercher plus de détails (créateur, saisons etc)
            const seriesDetailsUrl = `${BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
            const seriesDetailsRes = await fetch(seriesDetailsUrl);
            const seriesDetailsData = await seriesDetailsRes.json();

            // 1. Mettre à jour le créateur/directeur
            let creator = null;
            if (seriesDetailsData.created_by && seriesDetailsData.created_by.length > 0) {
                const c = seriesDetailsData.created_by[0];
                creator = {
                    name: c.name,
                    imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
                };
            } else {
                // Fallback: Chercher un directeur si pas de créateur
                const director = seriesDetailsData.credits?.crew?.find(c => c.job === 'Director');
                if (director) {
                    creator = {
                        name: director.name,
                        imageUrl: director.profile_path ? IMG_BASE_PROFILE + director.profile_path : 'https://placehold.co/64x64'
                    };
                }
            }
            updatePersonUI(creator, 'tv');

            // 2. Mettre à jour l'année de diffusion (cas où le statut a changé)
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

            // 3. Mettre à jour les saisons
            if (seriesDetailsData.seasons) {
                updateSeasonsUI(seriesDetailsData.seasons, id);
            }
        }

    } catch (e) {
        console.error("Erreur mise à jour", e);
    }
}

// Mise à jour de l'interface
function updateUI(data, type, isLocal) {
    // Images & Titres
    document.getElementById('media-banner').src = data.bannerUrl;
    document.getElementById('media-poster').src = data.posterUrl;
    document.getElementById('media-title').textContent = data.title;
    document.getElementById('media-year').textContent = data.year;
    document.getElementById('media-synopsis').textContent = data.synopsis;

    // Notes (Si c'est local, on a les vraies notes IMDb/RT scrapées !)
    document.getElementById('media-imdb').textContent = data.imdb;
    document.getElementById('media-rt').textContent = data.rottenTomatoes === 'xx' ? '' : (data.rottenTomatoes.includes('%') ? data.rottenTomatoes : data.rottenTomatoes + '%');

    // Durée / Saisons
    if (type === 'movie') {
        document.getElementById('media-duration').textContent = data.duration;
    } else {
        document.getElementById('media-seasons').textContent = typeof data.seasons === 'number' ? `${data.seasons} Seasons` : data.seasons;
    }

    // Genres
    const genresContainer = document.getElementById('media-genres');
    genresContainer.innerHTML = '';
    // Gère le format string (local) ou objet (TMDB)
    const genreList = data.genres.map(g => typeof g === 'string' ? g : g.name); 
    genreList.forEach((g, i) => {
        genresContainer.innerHTML += `<span class="font-medium">${g}</span>${i < genreList.length - 1 ? '<span class="h-3 w-px bg-gray-600 mx-2"></span>' : ''}`;
    });

    // Streaming (Si local, on affiche ce qu'on a, puis ça sera mis à jour par fetchUpdates)
    if (data.availableOn) updateStreamingUI(data.availableOn);

    // Casting
    if (data.cast && data.cast.length > 0) {
        updateCastUI(data.cast);
    }

    // Director / Creator
    updatePersonUI(data.director, type);

    // Awards
    updateAwardsUI(data);

    // Similar Movies
    if (type === 'movie' && data.similarMovies) {
        updateSimilarMoviesUI(data.similarMovies);
    }

    // Awards
    updateAwardsUI(data.id);
}

function updateAwardsUI(mediaId) {
    const awardsSection = document.getElementById('awards-section');
    if (!awardsSection) return;

    const awardInfo = window.awardsData && window.awardsData[mediaId];

    if (awardInfo) {
        document.getElementById('awards-wins').textContent = awardInfo.wins;
        document.getElementById('awards-nominations').textContent = awardInfo.nominations;
        awardsSection.style.display = 'block';
    } else {
        awardsSection.style.display = 'none';
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

function updateStreamingUI(providers) {
    const container = document.getElementById('available-on-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Standardisation : parfois TMDB renvoie raw, parfois notre cache a déjà traité
    let list = [];
    if (providers.length > 0 && providers[0].provider_name) {
        // Format Brut TMDB
        list = providers.map(p => ({ name: p.provider_name, logoUrl: IMG_BASE_PROFILE + p.logo_path }));
    } else {
        // Format Cache data.js
        list = providers;
    }

    if (list.length > 0) {
        list.forEach(p => {
            container.innerHTML += `<img src="${p.logoUrl}" alt="${p.name}" title="${p.name}" class="h-6 w-6 rounded-md"/>`;
        });
    } else {
        container.innerHTML = '<span class="text-gray-500 text-xs">Not available in FR</span>';
    }
}

function updateCastUI(cast) {
    currentCastData = cast;
    const castContainer = document.getElementById('full-cast-container');
    const castSection = document.getElementById('cast-section');

    // Try to find elements using alternate IDs if not found (for serie.html compatibility if not fixed yet)
    // But better to fix HTML. Assuming HTML is correct or being fixed.
    // Wait, plan step 3 is fixing HTML. So I will rely on IDs being 'cast-section' and 'full-cast-container'.
    // Wait, looking at serie.html content I read:
    // <div class="flex items-center justify-between"><h2 ...>Full Cast</h2>...</div>
    // <div id="full-cast-container" ...>
    // It does NOT have an ID on the parent div like 'cast-section'.
    // film.html HAS id="cast-section".
    // I should handle this gracefully.

    let container = castContainer;
    let section = castSection;

    // Fallback for serie.html structure if id is missing on parent
    if (!section && container) {
        section = container.parentElement.parentElement; // Assuming structure
    }

    if (currentCastData && currentCastData.length > 0) {
        if(section) section.style.display = 'block'; // Or remove hidden class
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
    // On vérifie si on a un ID, sinon on met un lien vide '#'
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

    // Toggle button visibility/text
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

function updateSeasonsUI(seasons, seriesId) {
    const container = document.getElementById('seasons-episodes-container');
    if (!container) return;

    container.innerHTML = ''; // Vide le contenu précédent

    seasons.forEach(season => {
        // Ignore "Season 0" or specials which often have episode_count: 0
        if (season.season_number === 0 || season.episode_count === 0) {
            return;
        }

        const seasonCardHTML = `
            <div class="season-card rounded-lg bg-gray-800" data-season-number="${season.season_number}">
                <div class="flex items-center justify-between p-3 cursor-pointer">
                    <h3 class="font-semibold text-white">${season.name}</h3>
                    <span class="text-xs text-gray-400">${season.episode_count} Episodes</span>
                </div>
        <div class="episodes-container">
                    <!-- Les épisodes seront chargés ici -->
                </div>
            </div>
        `;
        container.innerHTML += seasonCardHTML;
    });

    // Ajoute les écouteurs d'événements pour le clic
    document.querySelectorAll('.season-card .cursor-pointer').forEach(header => {
        header.addEventListener('click', async () => {
            const card = header.closest('.season-card');
            const episodesContainer = card.querySelector('.episodes-container');
            const seasonNumber = card.dataset.seasonNumber;

            // Toggle l'affichage
            const cardIsOpen = card.classList.contains('open');

            if (cardIsOpen) {
                card.classList.remove('open');
            } else {
                card.classList.add('open');
                // Fetch and render episodes if not already loaded
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
                            const episodesListHTML = episodes.map(episode => {
                                 const runtime = episode.runtime ? `${episode.runtime}m` : '';
                                 return `
                                    <div class="flex items-center gap-4">
                                        <span class="text-sm font-medium text-gray-400">${episode.episode_number}</span>
                                        <div class="flex-1">
                                            <p class="font-semibold text-white">${episode.name}</p>
                                            <p class="text-xs text-gray-500">${runtime}</p>
                                        </div>
                                    </div>`;
                            }).join('');

                            episodesContainer.innerHTML = `<div class="border-t border-gray-700 px-3 py-4 space-y-4">${episodesListHTML}</div>`;
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


// Utilitaire pour transformer les données brutes TMDB en format "data.js"
function formatTMDBData(data, type) {
    const isMovie = type === 'movie';
    
    // Director / Creator
    let dir = { name: 'Unknown', imageUrl: 'https://placehold.co/64x64' };
    if(isMovie) {
        const d = data.credits?.crew?.find(c => c.job === 'Director');
        if(d) dir = { name: d.name, imageUrl: d.profile_path ? IMG_BASE_PROFILE + d.profile_path : dir.imageUrl };
    } else if(data.created_by?.length > 0) {
        dir = { name: data.created_by[0].name, imageUrl: data.created_by[0].profile_path ? IMG_BASE_PROFILE + data.created_by[0].profile_path : dir.imageUrl };
    }

    // Cast
    const cast = data.credits?.cast?.map(c => ({
        id: c.id,
        name: c.name,
        character: c.character,
        imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
    })) || [];

    // Similar
    const similar = data.similar?.results?.map(s => ({
        id: s.id,
        title: s.title,
        posterUrl: s.poster_path ? IMG_BASE_POSTER + s.poster_path : 'https://placehold.co/200x300'
    })) || [];

    // Streaming IE
    const streaming = data['watch/providers']?.results?.IE?.flatrate?.map(p => ({
        name: p.provider_name,
        logoUrl: IMG_BASE_PROFILE + p.logo_path
    })) || [];

    return {
        id: data.id,
        title: isMovie ? data.title : data.name,
        year: (() => {
            if (isMovie) {
                return data.release_date?.split('-')[0] || 'N/A';
            }
            // TV Show Logic
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

            return `${startYear} - `; // For ongoing series
        })(),
        genres: data.genres || [], // Array of objects {id, name}
        duration: isMovie ? `${Math.floor(data.runtime/60)}h ${data.runtime%60}m` : '',
        seasons: !isMovie ? data.number_of_seasons : null,
        imdb: data.vote_average?.toFixed(1) || 'N/A', // Fallback TMDB
        rottenTomatoes: 'TMDB', // Indication
        synopsis: data.overview,
        posterUrl: data.poster_path ? IMG_BASE_POSTER + data.poster_path : '',
        bannerUrl: data.backdrop_path ? IMG_BASE_BANNER + data.backdrop_path : '',
        director: dir,
        cast: cast,
        similarMovies: similar,
        availableOn: streaming
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

    let awardsHTML = '';
    const isMovie = data.type === 'movie';
    const awardName = isMovie ? 'Oscar' : 'Emmy';
    const wins = isMovie ? data.oscarWins : data.emmyWins;
    const nominations = isMovie ? data.oscarNominations : data.emmyNominations;

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
