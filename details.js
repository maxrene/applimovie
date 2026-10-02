// details.js - Version Finale Corrigée

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_BANNER = 'https://image.tmdb.org/t/p/original';
const IMG_BASE_PROFILE = 'https://image.tmdb.org/t/p/w185';

const CUSTOM_PLATFORMS = {
    8: { name: 'Netflix', url: 'https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
    119: { name: 'Prime Video', url: 'https://image.tmdb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg' },
    337: { name: 'Disney+', url: 'https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg' },
    350: { name: 'Apple TV+', url: 'https://image.tmdb.org/t/p/original/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg' },
    381: { name: 'Canal+', url: 'https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg' },
    392: { name: 'Canal+', url: 'https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg' },
    531: { name: 'Paramount+', url: 'https://image.tmdb.org/t/p/original/h5DcR0J2EESLitnhR8xLG1QymTE.jpg' },
    1899: { name: 'Max', url: 'https://image.tmdb.org/t/p/original/jbe4gVSfRlbPTdESXhEKpornsfu.jpg' },
    29: { name: 'Sky Go', url: 'https://image.tmdb.org/t/p/original/1UrT2H9x6DuQ9ytNhsSCUFtTUwS.jpg' },
    39: { name: 'Now', url: 'https://image.tmdb.org/t/p/original/g0E9h3JAeIwmdvxlT73jiEuxdNj.jpg' },
    35: { name: 'Rakuten TV', url: 'https://image.tmdb.org/t/p/original/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg' },
    300: { name: 'Pluto TV', url: 'https://image.tmdb.org/t/p/original/dB8G41Q6tSL5NBisrIeqByfepBc.jpg' },
    283: { name: 'Crunchyroll', url: 'https://image.tmdb.org/t/p/original/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg' },
    234: { name: 'Arte', url: 'https://image.tmdb.org/t/p/original/vPZrjHe7wvALuwJEXT2kwYLi0gV.jpg' }
};

const PLATFORM_ID_MAP = {
    'netflix': [8],
    'prime': [119],
    'disney': [337],
    'apple': [350],
    'canal': [381, 392],
    'paramount': [531],
    'max': [1899],
    'skygo': [29],
    'now': [39],
    'rakuten': [35],
    'pluto': [300],
    'crunchyroll': [283],
    'arte': [234]
};

let currentCastData = [];
let isCastExpanded = false;
const userRegion = localStorage.getItem('userRegion') || 'FR';
const myPlatformIds = getSafeLocalStorage('selectedPlatforms', []);

// --- CHARGEMENT DES AWARDS VIA FIREBASE ---
async function loadAwardsData() {
  try {
    // On utilise la version 10.8.1 (identique à firebase-config.js)
    const { getFirestore, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    const db = getFirestore();
    const awardsCollection = collection(db, "awards");

    // On récupère tous les documents de la collection "awards"
    const snapshot = await getDocs(awardsCollection);
    const dictionnaireAwards = {};

    if (!snapshot.empty) {
      snapshot.forEach((document) => {
        const fiche = document.data();

        // On reconstruit le dictionnaire avec le format attendu par ton application
        const idKey = fiche.tmdb_id ? String(fiche.tmdb_id) : document.id;
        dictionnaireAwards[idKey] = {
          title: fiche.nom_oeuvre,
          year: fiche.annee,
          nominations: fiche.nominations,
          wins: fiche.victoires,
          type: fiche.type === "film" ? "movie" : "tv"
        };
      });

      window.awardsData = dictionnaireAwards;
      console.log("🏆 Données des Awards chargées depuis Firebase (Collection) !");
    } else {
      console.log("Aucune donnée d'awards trouvée en base.");
      window.awardsData = {};
    }
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des awards :", error);
    window.awardsData = {};
  }
}

// On stocke la promesse de chargement pour pouvoir l'attendre avant d'afficher
const awardsLoadedPromise = loadAwardsData();

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mediaId = urlParams.get('id');
    const bodyType = document.body.dataset.type;
    const isMovie = bodyType ? bodyType === 'movie' : window.location.pathname.includes('film.html');
    const type = isMovie ? 'movie' : 'tv';

    if (!mediaId) return console.error("Pas d'ID");

    initializeWatchlistButton(mediaId);

    const seeAllLink = document.querySelector('#cast-section a');
    if (seeAllLink) {
        seeAllLink.addEventListener('click', (e) => {
            e.preventDefault();
            toggleCastExpansion(seeAllLink);
        });
    }

    let localData = (typeof mediaData !== 'undefined') ? mediaData.find(m => String(m.id) === mediaId) : null;

    if (localData) {
        updateUI(localData, type, true); 
        fetchUpdates(mediaId, type);
    } else {
        fetchFullFromTMDB(mediaId, type);
    }
});

async function fetchFullFromTMDB(id, type) {
    try {
        let appendOptions = 'credits,watch/providers,similar,external_ids,videos';
        if (type === 'tv') {
            const MAX_SEASONS_TO_APPEND = 14;
            const seasonsToAppend = Array.from({ length: MAX_SEASONS_TO_APPEND }, (_, i) => `season/${i + 1}`).join(',');
            appendOptions += `,${seasonsToAppend}`;
        }

        const url = `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR&include_video_language=fr,en&append_to_response=${appendOptions}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur TMDB");
        const data = await res.json();

        // Si le synopsis français est vide, récupérer le synopsis anglais en fallback
        if (!data.overview) {
            try {
                const enRes = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
                if (enRes.ok) {
                    const enData = await enRes.json();
                    if (enData.overview) data.overview = enData.overview;
                }
            } catch (e) {}
        }

        if (type === 'tv') {
            window.currentSeriesData = data;
            // Enrichir chaque saison avec ses épisodes pour le cache compacté
            if (Array.isArray(data.seasons)) {
                data.seasons.forEach(s => {
                    if (s.season_number > 0 && data[`season/${s.season_number}`]?.episodes) {
                        s.episodes = data[`season/${s.season_number}`].episodes;
                    }
                });
            }
            const compacted = window.compactSeriesForCache ? window.compactSeriesForCache(data) : data;
            try {
                localStorage.setItem(`series-details-${id}`, JSON.stringify({ timestamp: Date.now(), data: compacted }));
            } catch (e) {}
        } else {
            const compacted = window.compactMovieForCache ? window.compactMovieForCache(data) : data;
            try {
                localStorage.setItem(`movie-details-${id}`, JSON.stringify({ timestamp: Date.now(), data: compacted }));
            } catch (e) {}
        }

        const formattedData = formatTMDBData(data, type);
        updateUI(formattedData, type, false);

        const resolvedImdbId = (data.external_ids && data.external_ids.imdb_id) || data.imdb_id || null;
        fetchOMDbRatings(resolvedImdbId, {
            tmdbId: id,
            type,
            wikidataId: data.external_ids ? data.external_ids.wikidata_id : null,
            title: data.title || data.name || '',
            originalTitle: data.original_title || data.original_name || '',
            year: (data.release_date || data.first_air_date || '').split('-')[0]
        });

        updateStreamingUI(data['watch/providers']?.results || {});        

        if (type === 'tv' && data.seasons) {
            const releasedCount = getReleasedEpisodeCount(data);
            updateSeasonsUI(data.seasons, id, releasedCount);
            syncSeriesStateFromEpisodes(id);
        }

        // Caching for Home/Popular views
        if (type === 'tv') {
            const seriesDatesCache = getSafeLocalStorage('seriesDatesCache', {});
            const startYear = data.first_air_date ? data.first_air_date.split('-')[0] : '';
            const endYear = data.last_air_date ? data.last_air_date.split('-')[0] : '';
            if(startYear) {
                seriesDatesCache[id] = {
                    start: startYear,
                    end: endYear,
                    status: data.status
                };
                localStorage.setItem('seriesDatesCache', JSON.stringify(seriesDatesCache));
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchUpdates(id, type) {
    try {
        const urls = [
            `${BASE_URL}/${type}/${id}/watch/providers?api_key=${TMDB_API_KEY}`,
            `${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}&language=fr-FR`,
            `${BASE_URL}/${type}/${id}/external_ids?api_key=${TMDB_API_KEY}`
        ];
        const [streamingRes, creditsRes, extRes] = await Promise.all(urls.map(url => fetch(url)));

        const streamingData = await streamingRes.json();
        updateStreamingUI(streamingData.results || {});

        const extData = await extRes.json();
        fetchOMDbRatings(extData.imdb_id || null, {
            tmdbId: id,
            type,
            wikidataId: extData.wikidata_id || null
        });

        const creditsData = await creditsRes.json();

        const cast = creditsData.cast?.map(c => ({
            id: c.id,
            name: c.name,
            character: c.character,
            imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
        })) || [];
        
        updateCastUI(cast);

        const similarUrl = `${BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}&language=fr-FR`;
        fetch(similarUrl)
            .then(r => r.json())
            .then(similarData => {
                const similarItems = similarData.results?.map(s => ({
                    id: s.id,
                    title: s.title || s.name,
                    posterUrl: s.poster_path ? IMG_BASE_POSTER + s.poster_path : 'https://placehold.co/200x300'
                })) || [];
                updateSimilarMoviesUI(similarItems, type);
            })
            .catch(() => {});

        if (type === 'tv') {
            const MAX_SEASONS_TO_APPEND = 14;
            const seasonsToAppend = Array.from({ length: MAX_SEASONS_TO_APPEND }, (_, i) => `season/${i + 1}`).join(',');
            const seriesDetailsUrl = `${BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits,watch/providers,${seasonsToAppend}`;
            const seriesDetailsRes = await fetch(seriesDetailsUrl);
            const seriesDetailsData = await seriesDetailsRes.json();

            window.currentSeriesData = seriesDetailsData;

            if (Array.isArray(seriesDetailsData.seasons)) {
                seriesDetailsData.seasons.forEach(s => {
                    if (s.season_number > 0 && seriesDetailsData[`season/${s.season_number}`]?.episodes) {
                        s.episodes = seriesDetailsData[`season/${s.season_number}`].episodes;
                    }
                });
            }
            const compacted = window.compactSeriesForCache ? window.compactSeriesForCache(seriesDetailsData) : seriesDetailsData;
            try {
                localStorage.setItem(`series-details-${id}`, JSON.stringify({ timestamp: Date.now(), data: compacted }));
            } catch (e) {}

            // Update Date & Status
            const firstAirDate = seriesDetailsData.first_air_date;
            const lastAirDate = seriesDetailsData.last_air_date;
            const status = seriesDetailsData.status;
            const startYear = firstAirDate?.split('-')[0] || '';
            const endYear = lastAirDate?.split('-')[0];
            
            const yearEl = document.getElementById('media-year');
            if(yearEl && startYear) {
                if (status === 'Returning Series') {
                    yearEl.textContent = `${startYear} - Présent`;
                } else if (status === 'Ended') {
                    yearEl.textContent = (endYear && startYear !== endYear) ? `${startYear} - ${endYear}` : startYear;
                } else {
                    yearEl.textContent = startYear;
                }
            }

            // Cache for Home/Popular
            const seriesDatesCache = getSafeLocalStorage('seriesDatesCache', {});
            if(startYear) {
                seriesDatesCache[id] = {
                    start: startYear,
                    end: endYear || '',
                    status: status
                };
                localStorage.setItem('seriesDatesCache', JSON.stringify(seriesDatesCache));
            }

            // Update Creator
            let creator = null;
            if (seriesDetailsData.created_by && seriesDetailsData.created_by.length > 0) {
                const c = seriesDetailsData.created_by[0];
                creator = {
                    id: c.id,
                    name: c.name,
                    imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
                };
            } else {
                const director = seriesDetailsData.credits?.crew?.find(c => c.job === 'Director');
                if (director) {
                    creator = {
                        id: director.id,
                        name: director.name,
                        imageUrl: director.profile_path ? IMG_BASE_PROFILE + director.profile_path : 'https://placehold.co/64x64'
                    };
                }
            }
            updatePersonUI(creator, 'tv');

            if (seriesDetailsData.seasons) {
                const releasedCount = getReleasedEpisodeCount(seriesDetailsData);
                updateSeasonsUI(seriesDetailsData.seasons, id, releasedCount);
                syncSeriesStateFromEpisodes(id);
            }
        }

    } catch (e) {
        console.error("Erreur mise à jour", e);
    }
}

function updateUI(data, type, isLocal) {
    const banner = document.getElementById('media-banner');
    if(banner) banner.src = data.bannerUrl;
    
    const poster = document.getElementById('media-poster');
    if(poster) poster.src = data.posterUrl;

    document.getElementById('media-title').textContent = data.title;
    document.getElementById('media-year').textContent = data.year;
    document.getElementById('media-synopsis').textContent = data.synopsis;

    // --- GESTION DES NOTES (IMDb + Rotten Tomatoes multi-sources avec cache) ---
    const targetEl = document.getElementById('media-imdb') || document.getElementById('media-rating');
    if (targetEl) {
        const ratingContainer = targetEl.parentElement;
        ratingContainer.className = "flex items-center gap-3";

        const cachedRatings = window.getCachedMediaRatings ? window.getCachedMediaRatings(data.id, type) : null;
        const tempImdb = cachedRatings?.imdb || ((data.imdb && data.imdb !== 'xx' && data.imdb !== 'N/A') ? data.imdb : '--');
        const localRt = (data.rottenTomatoes && data.rottenTomatoes !== 'xx' && data.rottenTomatoes !== 'N/A')
            ? (String(data.rottenTomatoes).includes('%') ? data.rottenTomatoes : `${data.rottenTomatoes}%`)
            : null;
        const tempRt = cachedRatings?.rt || localRt || '--';
        const rtIcon = window.getRTIconUrl ? window.getRTIconUrl(tempRt) : 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg';
        const rtHref = cachedRatings?.rtUrl || `https://www.rottentomatoes.com/search?search=${encodeURIComponent(data.title || '')}`;

        ratingContainer.innerHTML = `
            <div class="flex items-center gap-1">
                <span class="bg-[#f5c518] text-black text-[10px] font-bold px-1 rounded-sm tracking-wide">IMDb</span>
                <span id="score-imdb" class="text-gray-200 font-bold text-sm">${tempImdb}</span>
            </div>
            <span class="text-gray-500 text-sm">•</span>
            <a id="rt-badge-link" href="${rtHref}" target="_blank" rel="noopener noreferrer" title="Voir sur Rotten Tomatoes" class="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <img id="icon-rt" src="${rtIcon}" onerror="this.onerror=null;this.src='https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg'" alt="Rotten Tomatoes" class="w-5 h-5 object-contain">
                <span id="score-rt" class="text-gray-200 font-bold text-sm">${tempRt}</span>
            </a>
        `;
    }
    // ------------------------------------------------------------------

    if (type === 'movie') {
        const dur = document.getElementById('media-duration');
        if(dur) dur.textContent = data.duration;
    } else {
        const sea = document.getElementById('media-seasons');
        if(sea) sea.textContent = typeof data.seasons === 'number' ? `${data.seasons} Saisons` : data.seasons;
    }

    const genresContainer = document.getElementById('media-genres');
    if(genresContainer) {
        genresContainer.innerHTML = '';
        const genreList = data.genres.map(g => typeof g === 'string' ? g : g.name); 
        genreList.forEach((g, i) => {
            genresContainer.innerHTML += `<span class="bg-white/10 text-xs px-2 py-1 rounded text-gray-300 border border-white/10 backdrop-blur-sm">${g}</span>`;
        });
    }

    if (data.cast && data.cast.length > 0) updateCastUI(data.cast);
    updatePersonUI(data.director, type);

    // Attendre le chargement des awards avant de mettre à jour l'UI
    awardsLoadedPromise.then(() => updateAwardsUI(data));

    if (data.similarMovies) {
        updateSimilarMoviesUI(data.similarMovies, type);
    }

    if (data.videos) {
        updateVideosUI(data.videos);
    }
}

function updateSimilarMoviesUI(similarItems, type = 'movie') {
    const simSection = document.getElementById('similar-movies-section');
    const simContainer = document.getElementById('similar-movies-container');
    const targetPage = type === 'tv' ? 'serie.html' : 'film.html';

    if (simSection && similarItems && similarItems.length > 0) {
        simSection.style.display = 'block';
        simContainer.innerHTML = '';
        similarItems.slice(0, 8).forEach(sim => {
            simContainer.innerHTML += `
                <div class="w-28 flex-shrink-0 cursor-pointer group" onclick="window.location.href='${targetPage}?id=${sim.id}'">
                    <div class="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-md">
                        <img class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src="${sim.posterUrl}" loading="lazy"/>
                    </div>
                    <p class="mt-1.5 truncate text-xs font-medium text-white/80 group-hover:text-white">${sim.title}</p>
                </div>`;
        });
    } else if (simSection) {
        simSection.style.display = 'none';
    }
}

function updateStreamingUI(allProvidersData) {
    const container = document.getElementById('available-on-container');
    const section = document.getElementById('streaming-section');
    if (!container || !section) return;
    container.innerHTML = '';

    const selectedPlatforms = getSafeLocalStorage('selectedPlatforms', []);

    if (selectedPlatforms.length === 0) {
        section.style.display = 'block';
        container.innerHTML = '<a href="platforms.html" class="text-primary hover:underline text-sm font-medium">Sélectionner mes plateformes →</a>';
        return;
    }

    const allowedIds = new Set();
    selectedPlatforms.forEach(id => {
        const mapped = PLATFORM_ID_MAP[id];
        if (Array.isArray(mapped)) mapped.forEach(n => allowedIds.add(n));
        else if (mapped) allowedIds.add(mapped);
    });

    let providers = [];
    if (Array.isArray(allProvidersData)) {
        providers = allProvidersData;
    } else {
        const currentRegion = localStorage.getItem('userRegion') || 'FR';
        if (allProvidersData[currentRegion] && allProvidersData[currentRegion].flatrate) {
            providers = [...allProvidersData[currentRegion].flatrate];
        }
        if (currentRegion !== 'FR' && selectedPlatforms.includes('canal')) {
            if (allProvidersData['FR'] && allProvidersData['FR'].flatrate) {
                const canal = allProvidersData['FR'].flatrate.find(
                    p => p.provider_id === 381 || p.provider_id === 392 || (p.provider_name && p.provider_name.includes('Canal'))
                );
                if (canal && !providers.some(p => p.provider_id === canal.provider_id)) {
                    providers.push(canal);
                }
            }
        }
    }

    const uniqueProviders = [];
    const seenInternalKeys = new Set();

    for (const p of providers) {
        const internalKey = window.getInternalPlatformId
            ? window.getInternalPlatformId(p.provider_name, p.provider_id)
            : null;
        const isAllowed = allowedIds.has(p.provider_id) || (internalKey && selectedPlatforms.includes(internalKey));
        if (isAllowed) {
            const dedupKey = internalKey || p.provider_id;
            if (!seenInternalKeys.has(dedupKey)) {
                uniqueProviders.push(p);
                seenInternalKeys.add(dedupKey);
            }
        }
    }

    if (uniqueProviders.length > 0) {
        section.style.display = 'block';
        uniqueProviders.forEach(p => {
            let logoUrl = p.logo_path ? IMG_BASE_PROFILE + p.logo_path : 'https://placehold.co/64x64';
            if (CUSTOM_PLATFORMS[p.provider_id]) {
                logoUrl = CUSTOM_PLATFORMS[p.provider_id].url;
            }

            container.innerHTML += `
                <img src="${logoUrl}" 
                     alt="${p.provider_name}" 
                     title="${p.provider_name}" 
                     class="h-10 w-10 rounded-xl border border-white/15 object-cover bg-black shadow-md"/>
            `;
        });
    } else {
        section.style.display = 'block';
        container.innerHTML = '<span class="text-gray-500 text-sm">Non disponible sur vos plateformes en abonnement</span>';
    }
}

function updateCastUI(cast) {
    currentCastData = cast;
    const castSection = document.getElementById('cast-section');

    if (currentCastData && currentCastData.length > 0) {
        if(castSection) castSection.style.display = 'block';
        renderCastList();
    } else if(castSection) {
        castSection.style.display = 'none';
    }
}

function renderCastList() {
    const castContainer = document.getElementById('full-cast-container');
    if (!castContainer) return;

    const seeAllLink = document.querySelector('#cast-section a');
    castContainer.innerHTML = '';

    const limit = isCastExpanded ? 24 : 4;
    const displayList = currentCastData.slice(0, limit);

    displayList.forEach(member => {
        const link = member.id ? `person.html?id=${member.id}` : '#';
        castContainer.innerHTML += `
            <a href="${link}" class="flex items-center gap-2 group hover:bg-white/10 p-2 rounded-lg transition-colors duration-200">
                <img class="h-12 w-12 rounded-full object-cover flex-shrink-0 group-hover:scale-105 transition-transform duration-200 bg-gray-800" src="${member.imageUrl}" onerror="this.src='https://placehold.co/64x64'"/>
                <div class="min-w-0 flex-1">
                    <p class="font-semibold text-white text-sm leading-tight group-hover:text-primary transition-colors">${member.name}</p>
                    <p class="text-xs text-gray-400 truncate">${member.character || ''}</p>
                </div>
            </a>`;
    });

    if (seeAllLink) {
        if (currentCastData.length <= 4) {
            seeAllLink.style.display = 'none';
        } else {
            seeAllLink.style.display = 'block';
            seeAllLink.textContent = isCastExpanded ? 'Voir moins' : `Voir tout (${Math.min(currentCastData.length, 24)})`;
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
    const imgEl = document.getElementById('director-image');
    const nameEl = document.getElementById('director-name');
    if (imgEl) imgEl.src = person.imageUrl;
    if (nameEl) nameEl.textContent = person.name;

    const roleTitle = document.getElementById('director-title');
    const roleText = document.getElementById('director-role');
    const role = (type === 'tv') ? 'Créateur' : 'Réalisateur';

    if (roleTitle) roleTitle.textContent = role;
    if (roleText) roleText.textContent = role;

    if (person.id && imgEl) {
        const wrapper = imgEl.parentElement;
        if (wrapper) {
            wrapper.classList.add('cursor-pointer', 'group', 'hover:bg-white/5', 'p-1.5', '-m-1.5', 'rounded-lg', 'transition-colors');
            if (nameEl) nameEl.classList.add('group-hover:text-primary', 'transition-colors');
            wrapper.onclick = () => {
                window.location.href = `person.html?id=${person.id}`;
            };
        }
    }
}

function isEpisodeReleased(episode, season = null) {
    const today = new Date().toISOString().split('T')[0];
    if (episode && episode.air_date) {
        return episode.air_date <= today;
    }
    if (season && season.air_date) {
        return season.air_date <= today;
    }
    return true;
}

function updateSeasonWatchedStatus(seasonCard) {
    if (!seasonCard) return;

    const iconContainer = seasonCard.querySelector('.season-status-icon');
    if (!iconContainer) return;

    const episodesContainer = seasonCard.querySelector('.episodes-container');
    const episodeIcons = episodesContainer.querySelectorAll('.episode-tick-icon');

    // Always show season number on the left (User Request)
    const seasonNumber = seasonCard.dataset.seasonNumber;
    iconContainer.innerHTML = `<div class="bg-gray-700 h-full w-full rounded-lg flex items-center justify-center text-sm font-bold text-white">${seasonNumber}</div>`;

    // Only update right tick logic
    if (episodeIcons.length > 0) {
        const releasedIcons = Array.from(episodeIcons).filter(icon => icon.dataset.released !== 'false');
        const targetIcons = releasedIcons.length > 0 ? releasedIcons : Array.from(episodeIcons);
        const allWatched = targetIcons.length > 0 && targetIcons.every(icon => icon.textContent.trim() === 'check_circle');
        const rightTick = seasonCard.querySelector('.season-tick-action');

        if (rightTick) {
            rightTick.style.transform = 'none'; // Ensure no rotation
            if (allWatched) {
                rightTick.textContent = 'check_circle';
                rightTick.classList.remove('text-gray-500');
                rightTick.classList.add('text-green-400');
            } else {
                rightTick.textContent = 'radio_button_unchecked';
                rightTick.classList.remove('text-green-400');
                rightTick.classList.add('text-gray-500');
            }
        }
    }
}

async function checkSeasonStatus(seriesId, seasonNumber, seasonCard) {
    try {
        const rightTick = seasonCard.querySelector('.season-tick-action');
        let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
        let seriesWatched = watchedEpisodes[String(seriesId)] || [];

        // If series has NO watched episodes, ensure tick is unchecked and skip fetch
        if (seriesWatched.length === 0) {
            if (rightTick) {
                rightTick.textContent = 'radio_button_unchecked';
                rightTick.classList.remove('text-green-400');
                rightTick.classList.add('text-gray-500');
                rightTick.style.transform = 'none';
            }
            return;
        }

        let data = window.currentSeriesData && window.currentSeriesData[`season/${seasonNumber}`];
        if (!data) {
            const url = `${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) return;
            data = await res.json();
            if (window.currentSeriesData) {
                window.currentSeriesData[`season/${seasonNumber}`] = data;
            }
        }

        const episodes = data.episodes || [];
        if (episodes.length === 0) return;

        const releasedEpisodes = episodes.filter(ep => isEpisodeReleased(ep, data));
        const targetEpisodes = releasedEpisodes.length > 0 ? releasedEpisodes : episodes;
        const allWatched = targetEpisodes.every(ep => seriesWatched.includes(ep.id));

        if (rightTick) {
            rightTick.style.transform = 'none';
            if (allWatched) {
                rightTick.textContent = 'check_circle';
                rightTick.classList.remove('text-gray-500');
                rightTick.classList.add('text-green-400');
            } else {
                rightTick.textContent = 'radio_button_unchecked';
                rightTick.classList.remove('text-green-400');
                rightTick.classList.add('text-gray-500');
            }
        }
    } catch (e) {
        console.error("Error checking season status", e);
    }
}

function formatEpisodeDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function populateEpisodesDOM(episodesContainer, episodes, seasonDetails, seriesId, totalEpisodes) {
    const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    const seriesWatchedEpisodes = watchedEpisodes[String(seriesId)] || [];

    const episodesListHTML = episodes.map(episode => {
        const isChecked = seriesWatchedEpisodes.includes(episode.id);
        const isReleased = isEpisodeReleased(episode, seasonDetails);
        const formattedDate = formatEpisodeDate(episode.air_date);
        const metaParts = [];
        if (episode.runtime) metaParts.push(`${episode.runtime}m`);
        if (formattedDate) metaParts.push(formattedDate);
        const hasOverview = Boolean(episode.overview && episode.overview.trim());

        return `
            <div class="border-t border-white/5 hover:bg-white/5 transition-colors">
                <div class="flex items-center gap-3 p-3">
                    <span class="text-xs font-mono text-gray-500 w-6 text-center">${episode.episode_number}</span>
                    <div class="flex-1 min-w-0 ${hasOverview ? 'cursor-pointer episode-info-toggle' : ''}">
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-medium ${isReleased ? 'text-white' : 'text-gray-400'} truncate">${episode.name || ('Épisode ' + episode.episode_number)}</p>
                            ${!isReleased ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase flex-shrink-0">À venir</span>' : ''}
                        </div>
                        <p class="text-[10px] text-gray-500 mt-0.5">${metaParts.join(' • ')}${hasOverview ? ' • <span class="text-gray-400 underline">Synopsis</span>' : ''}</p>
                    </div>
                    <span class="material-symbols-outlined !text-xl cursor-pointer episode-tick-icon ${isChecked ? 'text-green-400' : 'text-gray-500'}" data-episode-id="${episode.id}" data-released="${isReleased}">${isChecked ? 'check_circle' : 'radio_button_unchecked'}</span>
                </div>
                ${hasOverview ? `<div class="episode-overview hidden px-4 pb-3 pl-12 text-xs text-gray-400 leading-relaxed">${episode.overview}</div>` : ''}
            </div>`;
    }).join('');

    episodesContainer.innerHTML = `<div>${episodesListHTML}</div>`;

    episodesContainer.querySelectorAll('.episode-tick-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const episodeId = parseInt(icon.dataset.episodeId, 10);
            toggleEpisodeWatchedStatus(seriesId, episodeId, totalEpisodes, icon);
        });
    });

    episodesContainer.querySelectorAll('.episode-info-toggle').forEach(infoEl => {
        infoEl.addEventListener('click', () => {
            const wrapper = infoEl.closest('.border-t');
            const overviewEl = wrapper ? wrapper.querySelector('.episode-overview') : null;
            if (overviewEl) {
                overviewEl.classList.toggle('hidden');
            }
        });
    });
}

async function handleSeasonCheck(seriesId, seasonNumber, seasonCard, totalEpisodes) {
    const episodesContainer = seasonCard.querySelector('.episodes-container');
    const tick = seasonCard.querySelector('.season-tick-action');
    const seriesIdStr = String(seriesId);

    // 1. Ensure Episodes are Loaded (Fetch if needed)
    if (!episodesContainer.dataset.loaded) {
        tick.textContent = 'hourglass_empty';
        try {
            let seasonDetails = window.currentSeriesData && window.currentSeriesData[`season/${seasonNumber}`];
            if (!seasonDetails) {
                const url = `${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=fr-FR`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('Failed to fetch season details');
                seasonDetails = await res.json();
                if (window.currentSeriesData) {
                    window.currentSeriesData[`season/${seasonNumber}`] = seasonDetails;
                }
            }
            const episodes = seasonDetails.episodes || [];

            if (episodes.length > 0) {
                populateEpisodesDOM(episodesContainer, episodes, seasonDetails, seriesId, totalEpisodes);
            }
            episodesContainer.dataset.loaded = 'true';
        } catch (e) {
            console.error(e);
            tick.textContent = 'error';
            return;
        }
    }

    // 2. Determine Action: Mark All Released or Unmark All
    const episodeIcons = Array.from(episodesContainer.querySelectorAll('.episode-tick-icon'));
    const releasedIcons = episodeIcons.filter(icon => icon.dataset.released !== 'false');
    const targetIcons = releasedIcons.length > 0 ? releasedIcons : episodeIcons;
    const allCurrentlyWatched = targetIcons.length > 0 && targetIcons.every(icon => icon.textContent.trim() === 'check_circle');

    const shouldMarkWatched = !allCurrentlyWatched;

    let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    if (!watchedEpisodes[seriesIdStr]) watchedEpisodes[seriesIdStr] = [];

    episodeIcons.forEach(icon => {
        const epId = parseInt(icon.dataset.episodeId, 10);
        const isTarget = targetIcons.includes(icon);

        if (shouldMarkWatched && isTarget) {
            if (!watchedEpisodes[seriesIdStr].includes(epId)) {
                watchedEpisodes[seriesIdStr].push(epId);
            }
            icon.textContent = 'check_circle';
            icon.classList.remove('text-gray-500');
            icon.classList.add('text-green-400');
        } else if (!shouldMarkWatched) {
            const idx = watchedEpisodes[seriesIdStr].indexOf(epId);
            if (idx > -1) {
                watchedEpisodes[seriesIdStr].splice(idx, 1);
            }
            icon.textContent = 'radio_button_unchecked';
            icon.classList.remove('text-green-400');
            icon.classList.add('text-gray-500');
        }
    });

    // 3. Update Storage & Global State
    if (shouldMarkWatched) {
        let seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});
        seriesLastWatchedDate[seriesIdStr] = Date.now();
        localStorage.setItem('seriesLastWatchedDate', JSON.stringify(seriesLastWatchedDate));
    }

    localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

    updateSeasonWatchedStatus(seasonCard);
    syncSeriesStateFromEpisodes(seriesId, totalEpisodes, true);
}

function updateSeasonsUI(seasons, seriesId, totalEpisodes) {
    const container = document.getElementById('seasons-episodes-container');
    if (!container) return;

    container.innerHTML = '';

    seasons.forEach(season => {
        if (season.season_number === 0) return;

        const year = season.air_date ? season.air_date.split('-')[0] : '';
        const seasonCardHTML = `
            <div class="season-card rounded-xl bg-gray-800/50 border border-white/5 overflow-hidden" data-season-number="${season.season_number}">
                <div class="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="season-status-icon h-8 w-8 rounded-lg">
                           <div class="bg-gray-700 h-full w-full rounded-lg flex items-center justify-center text-sm font-bold text-white">${season.season_number}</div>
                        </div>
                        <div>
                            <h3 class="font-bold text-white text-sm">${season.name}</h3>
                            <span class="text-xs text-gray-400"><span class="mr-1">${year ? year + ' •' : ''}</span>${season.episode_count} Épisodes</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="material-symbols-outlined text-2xl text-gray-500 hover:text-green-400 cursor-pointer season-tick-action z-10">radio_button_unchecked</span>
                        <span class="material-symbols-outlined text-gray-400 transition-transform duration-300">expand_more</span>
                    </div>
                </div>
                <div class="episodes-container bg-black/20 border-t border-white/5"></div>
            </div>
        `;
        container.innerHTML += seasonCardHTML;
    });

    // Initial check for season status (persistence)
    const allSeasonCards = container.querySelectorAll('.season-card');
    allSeasonCards.forEach(card => {
        const sNum = card.dataset.seasonNumber;
        checkSeasonStatus(seriesId, sNum, card);
    });

    document.querySelectorAll('.season-tick-action').forEach(tick => {
        tick.addEventListener('click', (e) => {
             e.stopPropagation();
             const card = tick.closest('.season-card');
             const seasonNumber = card.dataset.seasonNumber;
             handleSeasonCheck(seriesId, seasonNumber, card, totalEpisodes);
        });
    });

    document.querySelectorAll('.season-card .cursor-pointer').forEach(header => {
        header.addEventListener('click', async () => {
            const card = header.closest('.season-card');
            const episodesContainer = card.querySelector('.episodes-container');
            const arrow = card.querySelector('.material-symbols-outlined:not(.season-tick-action)');
            const seasonNumber = card.dataset.seasonNumber;

            const cardIsOpen = card.classList.contains('open');

            if (cardIsOpen) {
                card.classList.remove('open');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            } else {
                card.classList.add('open');
                if (arrow) arrow.style.transform = 'rotate(180deg)';
                
                if (!episodesContainer.dataset.loaded) {
                    episodesContainer.innerHTML = '<div class="p-4 text-center"><div class="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div></div>';
                    try {
                        let seasonDetails = window.currentSeriesData && window.currentSeriesData[`season/${seasonNumber}`];
                        if (!seasonDetails) {
                            const url = `${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=fr-FR`;
                            const res = await fetch(url);
                            if (!res.ok) throw new Error('Failed to fetch season details');
                            seasonDetails = await res.json();
                            if (window.currentSeriesData) {
                                window.currentSeriesData[`season/${seasonNumber}`] = seasonDetails;
                            }
                        }

                        const episodes = seasonDetails.episodes;
                        if (!episodes || episodes.length === 0) {
                            episodesContainer.innerHTML = '<div class="p-4 text-gray-400 text-sm">Aucun épisode.</div>';
                        } else {
                            populateEpisodesDOM(episodesContainer, episodes, seasonDetails, seriesId, totalEpisodes);
                        }
                        episodesContainer.dataset.loaded = 'true';
                        updateSeasonWatchedStatus(card);
                    } catch (e) {
                        episodesContainer.innerHTML = '<div class="p-4 text-red-500 text-sm">Erreur chargement.</div>';
                    }
                }
            }
        });
    });
}

function updateVideosUI(videos) {
    const section = document.getElementById('trailers-section');
    const container = document.getElementById('trailers-container');
    if (!section || !container) return;

    const filteredVideos = videos.filter(v => v.site === 'YouTube' && ['Trailer', 'Teaser', 'Featurette', 'Clip'].includes(v.type));

    if (filteredVideos.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    filteredVideos.slice(0, 5).forEach(video => {
        const thumbnailUrl = `https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`;
        const videoUrl = `https://www.youtube.com/watch?v=${video.key}`;

        container.innerHTML += `
            <a href="${videoUrl}" target="_blank" class="flex-shrink-0 snap-start group">
                <div class="relative h-24 w-40 overflow-hidden rounded-lg">
                    <img alt="${video.name}" class="h-full w-full object-cover transition-transform group-hover:scale-105" src="${thumbnailUrl}"/>
                    <div class="absolute inset-0 bg-black/40"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <span class="material-symbols-outlined text-4xl text-white">play_circle</span>
                    </div>
                </div>
                <p class="mt-1 text-sm font-semibold text-white truncate w-40 group-hover:text-primary">${video.name}</p>
                <p class="text-xs text-gray-400">${video.type}</p>
            </a>
        `;
    });
}


function toggleEpisodeWatchedStatus(seriesId, episodeId, totalEpisodes, icon) {
    let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    const seriesIdStr = String(seriesId);
    if (!watchedEpisodes[seriesIdStr]) watchedEpisodes[seriesIdStr] = [];

    const episodeIndex = watchedEpisodes[seriesIdStr].indexOf(episodeId);

    if (episodeIndex > -1) {
        watchedEpisodes[seriesIdStr].splice(episodeIndex, 1);
        icon.textContent = 'radio_button_unchecked';
        icon.classList.remove('text-green-400');
        icon.classList.add('text-gray-500');
    } else {
        watchedEpisodes[seriesIdStr].push(episodeId);
        icon.textContent = 'check_circle';
        icon.classList.remove('text-gray-500');
        icon.classList.add('text-green-400');

        // Update last watched timestamp for sorting
        let seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});
        seriesLastWatchedDate[seriesIdStr] = Date.now();
        localStorage.setItem('seriesLastWatchedDate', JSON.stringify(seriesLastWatchedDate));
    }

    localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

    const seasonCard = icon.closest('.season-card');
    updateSeasonWatchedStatus(seasonCard);
    syncSeriesStateFromEpisodes(seriesId, totalEpisodes, true);
}

function syncSeriesStateFromEpisodes(seriesId, fallbackTotalEpisodes = null, userAction = false) {
    const seriesIdNum = parseInt(seriesId, 10);
    const seriesIdStr = String(seriesId);

    const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    const seriesWatchedList = watchedEpisodes[seriesIdStr] || [];
    const watchedCount = seriesWatchedList.length;

    let watchlist = getSafeLocalStorage('watchlist', []);
    let watchedSeries = getSafeLocalStorage('watchedSeries', []);

    const isInWatchlist = watchlist.some(item => item.id === seriesIdNum);
    const isMarkedWatched = watchedSeries.includes(seriesIdNum);

    const episodeInfo = window.currentSeriesData ? determineNextEpisode(seriesId) : null;
    const effectiveTotal = (episodeInfo && episodeInfo.totalReleasedEpisodes > 0)
        ? episodeInfo.totalReleasedEpisodes
        : (window.currentSeriesData ? getReleasedEpisodeCount(window.currentSeriesData) : fallbackTotalEpisodes);

    let allReleasedWatched = false;
    if (episodeInfo && episodeInfo.hasSeasonDetails) {
        allReleasedWatched = episodeInfo.totalReleasedEpisodes > 0 &&
            episodeInfo.watchedReleasedCount >= episodeInfo.totalReleasedEpisodes &&
            !episodeInfo.nextEpisode;
    } else if (effectiveTotal && effectiveTotal > 0) {
        allReleasedWatched = watchedCount >= effectiveTotal;
    }

    // Ensure any series with watched episodes or marked as watched stays in watchlist
    if ((watchedCount > 0 || isMarkedWatched) && !isInWatchlist) {
        watchlist.push({ id: seriesIdNum, type: 'serie', added_at: new Date().toISOString() });
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
    }

    if (allReleasedWatched) {
        if (!watchedSeries.includes(seriesIdNum)) {
            watchedSeries.push(seriesIdNum);
            localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
        }
    } else if (watchedCount > 0 || userAction) {
        if (watchedSeries.includes(seriesIdNum)) {
            watchedSeries = watchedSeries.filter(id => id !== seriesIdNum);
            localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
        }
    }

    updateWatchlistButton(seriesId);
    updateNextEpisodeButton(seriesId);
}

function formatTMDBData(data, type) {
    const isMovie = type === 'movie';
    let dir = { id: null, name: 'Unknown', imageUrl: 'https://placehold.co/64x64' };
    if (isMovie) {
        const d = data.credits?.crew?.find(c => c.job === 'Director');
        if (d) dir = { id: d.id, name: d.name, imageUrl: d.profile_path ? IMG_BASE_PROFILE + d.profile_path : dir.imageUrl };
    } else if (data.created_by?.length > 0) {
        dir = { id: data.created_by[0].id, name: data.created_by[0].name, imageUrl: data.created_by[0].profile_path ? IMG_BASE_PROFILE + data.created_by[0].profile_path : dir.imageUrl };
    } else {
        const d = data.credits?.crew?.find(c => c.job === 'Director');
        if (d) dir = { id: d.id, name: d.name, imageUrl: d.profile_path ? IMG_BASE_PROFILE + d.profile_path : dir.imageUrl };
    }

    const cast = data.credits?.cast?.map(c => ({
        id: c.id,
        name: c.name,
        character: c.character,
        imageUrl: c.profile_path ? IMG_BASE_PROFILE + c.profile_path : 'https://placehold.co/64x64'
    })) || [];

    const videos = data.videos?.results || [];

    const similar = data.similar?.results?.map(s => ({
        id: s.id,
        title: s.title || s.name,
        posterUrl: s.poster_path ? IMG_BASE_POSTER + s.poster_path : 'https://placehold.co/200x300'
    })) || [];

    let yearStr = 'N/A';
    if (isMovie) {
        yearStr = data.release_date?.split('-')[0] || 'N/A';
    } else {
        const start = data.first_air_date?.split('-')[0];
        const end = data.last_air_date?.split('-')[0];
        const status = data.status;
        if (start) {
            if (status === 'Ended' && end && start !== end) {
                yearStr = `${start} - ${end}`;
            } else if (status === 'Returning Series') {
                yearStr = `${start} - Présent`;
            } else {
                yearStr = start;
            }
        }
    }

    return {
        id: data.id,
        title: isMovie ? data.title : data.name,
        year: yearStr,
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
        similarMovies: similar,
        videos: videos
    };
}

const awardIconSVG = `<svg class="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`;

function updateAwardsUI(data) {
    const awardsSection = document.getElementById('awards-section');
    if (!awardsSection) return;

    let wins = 0;
    let nominations = 0;
    let awardName = '';

    const externalAwardInfo = window.awardsData && (window.awardsData[data.id] || window.awardsData[String(data.id)]);

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
        awardsHTML += `<div class="flex items-center gap-2 text-sm">${awardIconSVG}<span class="font-medium text-gray-300">${wins} ${awardName} win${wins > 1 ? 's' : ''}</span></div>`;
    }
    if (nominations > 0) {
        awardsHTML += `<div class="flex items-center gap-2 text-sm">${awardIconSVG}<span class="font-medium text-gray-300">${nominations} ${awardName} nomination${nominations > 1 ? 's' : ''}</span></div>`;
    }

    if (awardsHTML) {
        awardsSection.innerHTML = awardsHTML;
        awardsSection.style.display = 'flex';
        awardsSection.className = "mb-6 flex flex-col gap-2 border-t border-b border-gray-800 py-4";
    } else {
        awardsSection.style.display = 'none';
    }
}

function initializeWatchlistButton(mediaId) {
    const btn = document.getElementById('watchlist-button');
    if(btn) {
        // On met à jour l'apparence initiale du bouton
        updateWatchlistButton(mediaId);
        updateNextEpisodeButton(mediaId);
        
        // Correction : au lieu de cloner et détacher l'élément du DOM, 
        // on assigne directement l'événement au bouton existant.
        btn.onclick = function(e) {
            e.preventDefault(); // Empêche tout comportement par défaut
            toggleWatchlist(mediaId);
        };
    }
}

async function toggleWatchlist(mediaId) {
    const mediaIdNum = parseInt(mediaId, 10);
    const mediaIdStr = String(mediaId);
    const bodyType = document.body.dataset.type;
    const isMovie = bodyType ? bodyType === 'movie' : window.location.pathname.includes('film.html');
    const watchedListKey = isMovie ? 'watchedMovies' : 'watchedSeries';
    let watchlist = getSafeLocalStorage('watchlist', []);
    let watchedList = getSafeLocalStorage(watchedListKey, []);
    const isInWatchlist = watchlist.some(item => item.id === mediaIdNum);
    const isWatched = watchedList.includes(mediaIdNum);

    try {
        if (isMovie) {
            if (isWatched) {
                watchlist = watchlist.filter(item => item.id !== mediaIdNum);
                watchedList = watchedList.filter(id => id !== mediaIdNum);
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                localStorage.setItem(watchedListKey, JSON.stringify(watchedList));
            } else if (isInWatchlist) {
                watchlist = watchlist.filter(item => item.id !== mediaIdNum);
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                watchedList.push(mediaIdNum);
                localStorage.setItem(watchedListKey, JSON.stringify(watchedList));
            } else {
                watchlist.push({ id: mediaIdNum, type: 'movie', added_at: new Date().toISOString() });
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                if (window.offlineManager) {
                    window.offlineManager.cacheMedia(mediaIdNum, 'movie');
                }
            }
            updateWatchlistButton(mediaId);
            return;
        }

        // Logique Série TV :
        // - Si la série est déjà "Vu" ou "À jour" -> on réinitialise tout (retire de la liste, décoche tous les épisodes)
        // - Si la série est "Dans ma liste" ou "En cours" -> on marque tous les épisodes sortis comme vus ("Vu" / "À jour")
        // - Si la série n'est pas suivie -> on l'ajoute à "Dans ma liste"
        const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
        const watchedCount = (watchedEpisodes[mediaIdStr] || []).length;
        const episodeInfo = window.currentSeriesData ? determineNextEpisode(mediaId) : null;
        const allReleasedWatched = episodeInfo && episodeInfo.hasSeasonDetails
            ? (episodeInfo.totalReleasedEpisodes > 0 && episodeInfo.watchedReleasedCount >= episodeInfo.totalReleasedEpisodes && !episodeInfo.nextEpisode)
            : false;
        const isCompleted = isWatched || allReleasedWatched;

        if (isCompleted) {
            watchlist = watchlist.filter(item => item.id !== mediaIdNum);
            watchedList = watchedList.filter(id => id !== mediaIdNum);
            delete watchedEpisodes[mediaIdStr];

            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            localStorage.setItem(watchedListKey, JSON.stringify(watchedList));
            localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

            // Réinitialiser visuellement les coches des saisons et épisodes
            document.querySelectorAll('.season-card').forEach(card => {
                const rightTick = card.querySelector('.season-tick-action');
                if (rightTick) {
                    rightTick.textContent = 'radio_button_unchecked';
                    rightTick.classList.remove('text-green-400');
                    rightTick.classList.add('text-gray-500');
                    rightTick.style.transform = 'none';
                }
                card.querySelectorAll('.episode-tick-icon').forEach(icon => {
                    icon.textContent = 'radio_button_unchecked';
                    icon.classList.remove('text-green-400');
                    icon.classList.add('text-gray-500');
                });
            });
        } else if (isInWatchlist || watchedCount > 0) {
            if (!isInWatchlist) {
                watchlist.push({ id: mediaIdNum, type: 'serie', added_at: new Date().toISOString() });
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
            }
            if (!watchedList.includes(mediaIdNum)) {
                watchedList.push(mediaIdNum);
                localStorage.setItem(watchedListKey, JSON.stringify(watchedList));
            }
            await markAllEpisodesWatched(mediaId);
        } else {
            watchlist.push({ id: mediaIdNum, type: 'serie', added_at: new Date().toISOString() });
            localStorage.setItem('watchlist', JSON.stringify(watchlist));

            if (window.offlineManager) {
                window.offlineManager.cacheMedia(mediaIdNum, 'serie');
            }
        }

        updateWatchlistButton(mediaId);
        updateNextEpisodeButton(mediaId);
    } catch (error) {
        console.error("Erreur fatale bouton :", error);
        alert("Impossible d'ajouter le média, veuillez réessayer.");
    }
}

async function markAllEpisodesWatched(seriesId) {
    try {
        const seriesIdStr = String(seriesId);
        let seriesData = window.currentSeriesData;
        if (!seriesData || !seriesData.seasons) {
            const seriesUrl = `${BASE_URL}/tv/${seriesId}?api_key=${TMDB_API_KEY}`;
            const seriesRes = await fetch(seriesUrl);
            seriesData = await seriesRes.json();
        }
        const seasons = seriesData.seasons || [];

        let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
        if (!watchedEpisodes[seriesIdStr]) watchedEpisodes[seriesIdStr] = [];

        // Fetch all seasons in parallel (or reuse already loaded season data)
        const seasonPromises = seasons.map(season => {
            if (season.season_number === 0) return Promise.resolve(null);
            if (window.currentSeriesData && window.currentSeriesData[`season/${season.season_number}`]) {
                return Promise.resolve(window.currentSeriesData[`season/${season.season_number}`]);
            }
            return fetch(`${BASE_URL}/tv/${seriesId}/season/${season.season_number}?api_key=${TMDB_API_KEY}`)
                .then(r => r.json())
                .then(d => {
                    if (window.currentSeriesData) {
                        window.currentSeriesData[`season/${season.season_number}`] = d;
                    }
                    return d;
                });
        });

        const allSeasonsData = await Promise.all(seasonPromises);

        // Mark all released episodes as watched
        allSeasonsData.forEach(seasonData => {
            if (!seasonData || !seasonData.episodes) return;
            seasonData.episodes.forEach(ep => {
                if (isEpisodeReleased(ep, seasonData)) {
                    if (!watchedEpisodes[seriesIdStr].includes(ep.id)) {
                        watchedEpisodes[seriesIdStr].push(ep.id);
                    }
                }
            });
        });

        localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

        // Update last watched timestamp for sorting
        let seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});
        seriesLastWatchedDate[seriesIdStr] = Date.now();
        localStorage.setItem('seriesLastWatchedDate', JSON.stringify(seriesLastWatchedDate));

        // Update Rendered UI
        const seasonCards = document.querySelectorAll('.season-card');
        seasonCards.forEach(card => {
            const sNum = parseInt(card.dataset.seasonNumber, 10);
            const seasonObj = seasons.find(s => s.season_number === sNum);
            const seasonData = window.currentSeriesData && window.currentSeriesData[`season/${sNum}`];
            const seasonReleased = seasonData && seasonData.episodes
                ? seasonData.episodes.some(ep => isEpisodeReleased(ep, seasonData))
                : isEpisodeReleased(null, seasonObj);

            const rightTick = card.querySelector('.season-tick-action');
            if (rightTick && seasonReleased) {
                rightTick.textContent = 'check_circle';
                rightTick.classList.remove('text-gray-500');
                rightTick.classList.add('text-green-400');
                rightTick.style.transform = 'none';
            }

            const epIcons = card.querySelectorAll('.episode-tick-icon');
            epIcons.forEach(icon => {
                if (icon.dataset.released !== 'false') {
                    icon.textContent = 'check_circle';
                    icon.classList.remove('text-gray-500');
                    icon.classList.add('text-green-400');
                }
            });
        });

    } catch (e) {
        console.error("Error marking all watched", e);
    }
}

function getReleasedEpisodeCount(data) {
    if (!data.seasons) return data.number_of_episodes;

    // Use last_episode_to_air if available for accurate "currently released" count
    if (data.last_episode_to_air) {
        let total = 0;
        const lastS = data.last_episode_to_air.season_number;
        const lastE = data.last_episode_to_air.episode_number;

        data.seasons.forEach(season => {
            if (season.season_number === 0) return;
            if (season.season_number < lastS) {
                total += season.episode_count;
            } else if (season.season_number === lastS) {
                total += lastE;
            }
        });
        return total;
    }

    const today = new Date();
    let total = 0;

    data.seasons.forEach(season => {
        if (season.season_number === 0) return; // Skip specials
        if (!season.air_date) return; // Skip unreleased seasons without date

        const airDate = new Date(season.air_date);
        if (airDate > today) return; // Skip future seasons

        total += season.episode_count;
    });

    return total;
}

function determineNextEpisode(seriesId) {
    if (!window.currentSeriesData) return null;

    const seriesDetails = window.currentSeriesData;
    const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    const seriesIdStr = String(seriesId);
    const watchedSet = new Set(watchedEpisodes[seriesIdStr] || []);

    let totalEpisodes = 0;
    let totalReleasedEpisodes = 0;
    let watchedCount = 0;
    let watchedReleasedCount = 0;
    let nextEpisode = null;
    let hasSeasonDetails = false;

    const seasons = seriesDetails.seasons
        ? [...seriesDetails.seasons].sort((a, b) => a.season_number - b.season_number)
        : [];

    for (const season of seasons) {
        if (season.season_number === 0) continue;

        const seasonDetail = seriesDetails[`season/${season.season_number}`];
        const episodesList = Array.isArray(season.episodes)
            ? season.episodes
            : (seasonDetail && Array.isArray(seasonDetail.episodes) ? seasonDetail.episodes : null);
        if (!episodesList) continue;

        hasSeasonDetails = true;
        totalEpisodes += episodesList.length;

        const sortedEpisodes = [...episodesList].sort((a, b) => a.episode_number - b.episode_number);

        for (const episode of sortedEpisodes) {
            const isWatched = watchedSet.has(episode.id);
            const isReleased = isEpisodeReleased(episode, season);

            if (isWatched) {
                watchedCount++;
                if (isReleased) watchedReleasedCount++;
            }
            if (isReleased) {
                totalReleasedEpisodes++;
                if (!isWatched && !nextEpisode) {
                    nextEpisode = {
                        ...episode,
                        season_number: episode.season_number || season.season_number
                    };
                }
            }
        }
    }

    if (!hasSeasonDetails) {
        totalReleasedEpisodes = getReleasedEpisodeCount(seriesDetails) || 0;
        totalEpisodes = totalReleasedEpisodes;
        watchedCount = watchedSet.size;
        watchedReleasedCount = watchedCount;
    }

    return {
        nextEpisode,
        totalEpisodes: totalReleasedEpisodes || totalEpisodes,
        totalReleasedEpisodes,
        watchedCount,
        watchedReleasedCount,
        hasSeasonDetails
    };
}

function updateNextEpisodeButton(seriesId) {
    const btn = document.getElementById('next-episode-button');
    if (!btn) return;

    const mediaIdNum = parseInt(seriesId, 10);
    const seriesIdStr = String(seriesId);
    const watchlist = getSafeLocalStorage('watchlist', []);
    const watchedSeries = getSafeLocalStorage('watchedSeries', []);
    const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    const watchedCount = (watchedEpisodes[seriesIdStr] || []).length;

    const isInWatchlist = watchlist.some(item => item.id === mediaIdNum);
    const isWatched = watchedSeries.includes(mediaIdNum);

    if ((!isInWatchlist && watchedCount === 0) || !window.currentSeriesData) {
        btn.style.display = 'none';
        return;
    }

    const episodeInfo = determineNextEpisode(seriesId);
    if (!episodeInfo) {
        btn.style.display = 'none';
        return;
    }

    const { nextEpisode, totalEpisodes } = episodeInfo;

    // Hide next-episode button if series is marked as watched and no episodes were manually unchecked
    if (isWatched && watchedCount === 0) {
        btn.style.display = 'none';
        return;
    }

    if (nextEpisode) {
        btn.style.display = 'flex';

        const textSpan = btn.querySelector('#next-episode-text');
        if (textSpan) {
            const seasonNum = String(nextEpisode.season_number).padStart(2, '0');
            const epNum = String(nextEpisode.episode_number).padStart(2, '0');
            textSpan.textContent = `S${seasonNum}E${epNum} vu`;
        }

        btn.onclick = function(e) {
            e.preventDefault();
            markEpisodeAsWatched(seriesId, nextEpisode.id, totalEpisodes);
        };
    } else {
        btn.style.display = 'none';
    }
}

async function markEpisodeAsWatched(seriesId, episodeId, totalEpisodes) {
    let watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    const seriesIdStr = String(seriesId);
    if (!watchedEpisodes[seriesIdStr]) watchedEpisodes[seriesIdStr] = [];

    if (!watchedEpisodes[seriesIdStr].includes(episodeId)) {
        watchedEpisodes[seriesIdStr].push(episodeId);
        localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

        // Update last watched timestamp
        let seriesLastWatchedDate = getSafeLocalStorage('seriesLastWatchedDate', {});
        seriesLastWatchedDate[seriesIdStr] = Date.now();
        localStorage.setItem('seriesLastWatchedDate', JSON.stringify(seriesLastWatchedDate));

        // Trigger visually update on rendered UI elements
        const icon = document.querySelector(`.episode-tick-icon[data-episode-id="${episodeId}"]`);
        if (icon) {
            icon.textContent = 'check_circle';
            icon.classList.remove('text-gray-500');
            icon.classList.add('text-green-400');
            const seasonCard = icon.closest('.season-card');
            updateSeasonWatchedStatus(seasonCard);
        } else {
            // Even if not expanded, check if season ticks need update
            const seasonCards = document.querySelectorAll('.season-card');
            seasonCards.forEach(card => {
                checkSeasonStatus(seriesId, card.dataset.seasonNumber, card);
            });
        }

        syncSeriesStateFromEpisodes(seriesId, totalEpisodes, true);
    }
}


function updateWatchlistButton(mediaId) {
    const btn = document.getElementById('watchlist-button');
    if(!btn) return;
    const mediaIdNum = parseInt(mediaId, 10);
    const mediaIdStr = String(mediaId);
    const bodyType = document.body.dataset.type;
    const isMovie = bodyType ? bodyType === 'movie' : window.location.pathname.includes('film.html');
    const watchedListKey = isMovie ? 'watchedMovies' : 'watchedSeries';
    const watchlist = getSafeLocalStorage('watchlist', []);
    const watchedList = getSafeLocalStorage(watchedListKey, []);
    const isInWatchlist = watchlist.some(item => item.id === mediaIdNum);
    const isWatched = watchedList.includes(mediaIdNum);
    
    const icon = btn.querySelector('.material-symbols-outlined');
    const text = btn.querySelector('span:last-child');
    
    btn.className = "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-bold transition-transform active:scale-95 text-black";
    
    if (isMovie) {
        if (isWatched) {
            btn.classList.remove('bg-white', 'text-black');
            btn.classList.add('bg-green-500', 'text-white');
            icon.textContent = 'check_circle';
            text.textContent = 'Vu';
        } else if (isInWatchlist) {
            btn.classList.remove('bg-white', 'text-black');
            btn.classList.add('bg-primary', 'text-white');
            icon.textContent = 'check';
            text.textContent = 'Dans ma liste';
        } else {
            btn.classList.remove('bg-green-500', 'bg-primary', 'text-white');
            btn.classList.add('bg-white', 'text-black');
            icon.textContent = 'add';
            text.textContent = 'Ajouter à ma liste';
        }
        return;
    }

    // États cohérents pour une Série TV :
    // 1. "À jour" (vert) : tous les épisodes sortis sont vus et la série est toujours en production ('Returning Series' / 'In Production')
    // 2. "Vu" (vert) : tous les épisodes sont vus et la série est terminée
    // 3. "En cours" (rouge) : au moins 1 épisode vu et il reste des épisodes sortis à voir
    // 4. "Dans ma liste" (rouge) : dans la liste avec 0 épisode vu
    // 5. "Ajouter à ma liste" (blanc) : non suivie
    const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
    const watchedCount = (watchedEpisodes[mediaIdStr] || []).length;
    const episodeInfo = window.currentSeriesData ? determineNextEpisode(mediaId) : null;

    const isReturning = window.currentSeriesData &&
        (window.currentSeriesData.status === 'Returning Series' || window.currentSeriesData.status === 'In Production');

    let allReleasedWatched = false;
    if (episodeInfo && episodeInfo.hasSeasonDetails) {
        allReleasedWatched = episodeInfo.totalReleasedEpisodes > 0 &&
            episodeInfo.watchedReleasedCount >= episodeInfo.totalReleasedEpisodes &&
            !episodeInfo.nextEpisode;
    } else if (episodeInfo && episodeInfo.totalReleasedEpisodes > 0) {
        allReleasedWatched = watchedCount >= episodeInfo.totalReleasedEpisodes;
    }

    const isCompleted = isWatched || allReleasedWatched;

    if (isCompleted) {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-green-500', 'text-white');
        icon.textContent = 'check_circle';
        text.textContent = isReturning ? 'À jour' : 'Vu';
    } else if (watchedCount > 0) {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-primary', 'text-white');
        icon.textContent = 'play_arrow';
        text.textContent = 'En cours';
    } else if (isInWatchlist) {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-primary', 'text-white');
        icon.textContent = 'bookmark_added';
        text.textContent = 'Dans ma liste';
    } else {
        btn.classList.remove('bg-green-500', 'bg-primary', 'text-white');
        btn.classList.add('bg-white', 'text-black');
        icon.textContent = 'add';
        text.textContent = 'Ajouter à ma liste';
    }
}
// Fonction pour récupérer les notes (IMDb + Rotten Tomatoes multi-sources) et mettre à jour le HTML dynamiquement
async function fetchOMDbRatings(imdbId, meta = {}) {
    try {
        if (window.fetchMediaRatings) {
            const titleEl = document.getElementById('media-title');
            const yearEl = document.getElementById('media-year');
            const result = await window.fetchMediaRatings({
                tmdbId: meta.tmdbId || new URLSearchParams(window.location.search).get('id'),
                type: meta.type || (document.body.dataset.type === 'movie' ? 'movie' : 'tv'),
                imdbId,
                wikidataId: meta.wikidataId || null,
                title: meta.title || (titleEl ? titleEl.textContent : ''),
                originalTitle: meta.originalTitle || '',
                year: meta.year || (yearEl ? yearEl.textContent.split(' ')[0] : ''),
                priority: true
            });

            const imdbEl = document.getElementById('score-imdb');
            const rtEl = document.getElementById('score-rt');
            const rtIconEl = document.getElementById('icon-rt');
            const rtLinkEl = document.getElementById('rt-badge-link');

            if (imdbEl && result.imdb) imdbEl.textContent = result.imdb;
            if (rtEl && result.rt) rtEl.textContent = result.rt;
            if (rtIconEl && result.rt && window.getRTIconUrl) {
                rtIconEl.src = window.getRTIconUrl(result.rt);
            }
            if (rtLinkEl && result.rtUrl) {
                rtLinkEl.href = result.rtUrl;
            }
            return;
        }

        if (!imdbId) return;
        const omdbUrl = `https://www.omdbapi.com/?i=${imdbId}&apikey=9472c454`;
        const res = await fetch(omdbUrl);
        const data = await res.json();

        if (data.Response === "True") {
            const imdbScore = data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : '--';
            let rtScore = '--';

            if (data.Ratings) {
                const rt = data.Ratings.find(r => r.Source === 'Rotten Tomatoes');
                if (rt) rtScore = rt.Value;
            }

            const imdbEl = document.getElementById('score-imdb');
            const rtEl = document.getElementById('score-rt');

            if (imdbEl) imdbEl.textContent = imdbScore;
            if (rtEl) rtEl.textContent = rtScore;
        }
    } catch (e) {
        console.error("Erreur OMDb/RT:", e);
    }
}
