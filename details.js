// details.js - Version Finale Corrigée

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_BANNER = 'https://image.tmdb.org/t/p/original';
const IMG_BASE_PROFILE = 'https://image.tmdb.org/t/p/w185';

const CUSTOM_PLATFORMS = {
    8: { name: 'Netflix', url: 'https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456' },
    119: { name: 'Prime Video', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Amazon_Prime_Video_logo_%282024%29.svg/1024px-Amazon_Prime_Video_logo_%282024%29.svg.png' },
    337: { name: 'Disney+', url: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/25357066/Disney__Logo_March_2024.png?quality=90&strip=all&crop=0,0,100,100' },
    350: { name: 'Apple TV+', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/AppleTVLogo.svg/768px-AppleTVLogo.svg.png' },
    392: { name: 'Canal+', url: 'https://static1.purepeople.com/articles/0/46/23/10/@/6655765-logo-de-la-chaine-canal-1200x0-2.png' },
    531: { name: 'Paramount+', url: 'https://images.seeklogo.com/logo-png/39/1/paramount-logo-png_seeklogo-397501.png' },
    1899: { name: 'Max', url: 'https://logo.clearbit.com/max.com' },
    29: { name: 'Sky Go', url: 'https://logo.clearbit.com/sky.com' },
    39: { name: 'Now', url: 'https://logo.clearbit.com/nowtv.com' }
};

const PLATFORM_ID_MAP = {
    'netflix': 8,
    'prime': 119,
    'disney': 337,
    'apple': 350,
    'canal': 392,
    'paramount': 531,
    'max': 1899,
    'skygo': 29,
    'now': 39,
    'rakuten': 35,
    'pluto': 300,
    'crunchyroll': 283,
    'arte': 234
};

let currentCastData = [];
let isCastExpanded = false;
const userRegion = localStorage.getItem('userRegion') || 'FR';
const myPlatformIds = JSON.parse(localStorage.getItem('selectedPlatforms')) || [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mediaId = urlParams.get('id');
    const isMovie = window.location.pathname.includes('film.html');
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
        const url = `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,watch/providers,similar,external_ids,videos`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur TMDB");
        const data = await res.json();
        
        const formattedData = formatTMDBData(data, type);
        updateUI(formattedData, type, false);

        updateStreamingUI(data['watch/providers']?.results || {});

        if (type === 'tv' && data.seasons) {
            updateSeasonsUI(data.seasons, id, data.number_of_episodes);
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchUpdates(id, type) {
    try {
        // Fetch streaming, credits, and videos in parallel
        const urls = [
            `${BASE_URL}/${type}/${id}/watch/providers?api_key=${TMDB_API_KEY}`,
            `${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`
        ];
        const [streamingRes, creditsRes] = await Promise.all(urls.map(url => fetch(url)));

        const streamingData = await streamingRes.json();
        updateStreamingUI(streamingData.results || {});

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

            // Update Date & Status
            const firstAirDate = seriesDetailsData.first_air_date;
            const lastAirDate = seriesDetailsData.last_air_date;
            const status = seriesDetailsData.status;
            const startYear = firstAirDate?.split('-')[0] || '';
            
            const yearEl = document.getElementById('media-year');
            if(yearEl && startYear) {
                if (status === 'Returning Series') {
                    yearEl.textContent = `${startYear} - Présent`;
                } else if (status === 'Ended') {
                    const endYear = lastAirDate?.split('-')[0];
                    yearEl.textContent = (endYear && startYear !== endYear) ? `${startYear} - ${endYear}` : startYear;
                } else {
                    yearEl.textContent = startYear;
                }
            }

            // Update Creator
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

            if (seriesDetailsData.seasons) {
                updateSeasonsUI(seriesDetailsData.seasons, id, seriesDetailsData.number_of_episodes);
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

    // Gestion Note (Page Film: media-imdb, Page Série: media-rating)
    const imdbEl = document.getElementById('media-imdb');
    if(imdbEl) imdbEl.textContent = data.imdb;
    
    const ratingEl = document.getElementById('media-rating');
    if(ratingEl) ratingEl.textContent = data.imdb; // On affiche la même note (TMDB ou IMDb)

    const rtEl = document.getElementById('media-rt');
    if(rtEl && data.rottenTomatoes !== 'xx') {
        rtEl.textContent = data.rottenTomatoes.includes('%') ? data.rottenTomatoes : data.rottenTomatoes + '%';
    }

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
    updateAwardsUI(data);

    if (type === 'movie' && data.similarMovies) {
        updateSimilarMoviesUI(data.similarMovies);
    }

    if (data.videos) {
        updateVideosUI(data.videos);
    }
}

function updateSimilarMoviesUI(similarMovies) {
    const simSection = document.getElementById('similar-movies-section');
    const simContainer = document.getElementById('similar-movies-container');

    if(simSection && similarMovies && similarMovies.length > 0) {
        simSection.style.display = 'block';
        simContainer.innerHTML = '';
        similarMovies.slice(0,6).forEach(sim => {
            simContainer.innerHTML += `
                <div class="w-28 flex-shrink-0 cursor-pointer group" onclick="window.location.href='film.html?id=${sim.id}'">
                    <div class="relative aspect-[2/3] rounded-lg overflow-hidden">
                        <img class="w-full h-full object-cover transition-transform group-hover:scale-105" src="${sim.posterUrl}"/>
                    </div>
                    <p class="mt-1 truncate text-xs font-medium text-white/80 group-hover:text-white">${sim.title}</p>
                </div>`;
        });
    } else if(simSection) {
        simSection.style.display = 'none';
    }
}

function updateStreamingUI(allProvidersData) {
    const container = document.getElementById('available-on-container');
    const section = document.getElementById('streaming-section');
    if (!container || !section) return;
    container.innerHTML = '';

    const saved = localStorage.getItem('selectedPlatforms');
    const selectedPlatforms = saved ? JSON.parse(saved) : [];

    // If no platforms are selected, show nothing/message as per user request (strict filtering)
    if (selectedPlatforms.length === 0) {
        section.style.display = 'block';
        container.innerHTML = '<span class="text-gray-500 text-sm">Aucune plateforme sélectionnée</span>';
        return;
    }

    const allowedIds = new Set(selectedPlatforms.map(id => PLATFORM_ID_MAP[id]).filter(Boolean));

    let providers = [];
    if (Array.isArray(allProvidersData)) {
        providers = allProvidersData;
    } else {
        if (allProvidersData[userRegion] && allProvidersData[userRegion].flatrate) {
            providers = [...allProvidersData[userRegion].flatrate];
        }
        // Special case for Canal+ in non-FR regions if selected
        if (userRegion !== 'FR' && selectedPlatforms.includes('canal')) {
            if (allProvidersData['FR'] && allProvidersData['FR'].flatrate) {
                const canal = allProvidersData['FR'].flatrate.find(p => p.provider_id === 392 || p.provider_name.includes('Canal'));
                if (canal && !providers.some(p => p.provider_id === canal.provider_id)) {
                    providers.push(canal);
                }
            }
        }
    }

    // Filter by allowed IDs and Deduplicate
    const uniqueProviders = [];
    const seen = new Set();

    for (const p of providers) {
        // Strict filtering: only show if the provider ID is in the user's allowed list
        if (allowedIds.has(p.provider_id)) {
            if (!seen.has(p.provider_id)) {
                uniqueProviders.push(p);
                seen.add(p.provider_id);
            }
        }
    }

    if (uniqueProviders.length > 0) {
        section.style.display = 'block';
        uniqueProviders.forEach(p => {
            let logoUrl = p.logo_path ? IMG_BASE_PROFILE + p.logo_path : 'https://placehold.co/64x64';
            let cssClass = "object-cover"; 

            if (CUSTOM_PLATFORMS[p.provider_id]) {
                logoUrl = CUSTOM_PLATFORMS[p.provider_id].url;
                cssClass = "object-contain bg-black p-1";
            }

            container.innerHTML += `
                <img src="${logoUrl}" 
                     alt="${p.provider_name}" 
                     title="${p.provider_name}" 
                     class="h-10 w-10 rounded-lg border border-white/10 ${cssClass}"/>
            `;
        });
    } else {
        section.style.display = 'block';
        container.innerHTML = '<span class="text-gray-500 text-sm">Non disponible sur vos plateformes</span>';
    }
}

function updateCastUI(cast) {
    currentCastData = cast;
    const castContainer = document.getElementById('full-cast-container');
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

    const limit = isCastExpanded ? 20 : 4;
    const displayList = currentCastData.slice(0, limit);

    displayList.forEach(member => {
        const link = member.id ? `person.html?id=${member.id}` : '#';
        castContainer.innerHTML += `
            <a href="${link}" class="flex items-center gap-2 group hover:bg-white/10 p-2 rounded-lg transition-colors duration-200">
                <img class="h-12 w-12 rounded-full object-cover flex-shrink-0 group-hover:scale-105 transition-transform duration-200 bg-gray-800" src="${member.imageUrl}" onerror="this.src='https://placehold.co/64x64'"/>
                <div class="min-w-0 flex-1">
                    <p class="font-semibold text-white text-sm leading-tight group-hover:text-primary transition-colors">${member.name}</p>
                    <p class="text-xs text-gray-400">${member.character}</p>
                </div>
            </a>`;
    });

    if (seeAllLink) {
        if (currentCastData.length <= 4) {
            seeAllLink.style.display = 'none';
        } else {
            seeAllLink.style.display = 'block';
            seeAllLink.textContent = isCastExpanded ? 'Voir moins' : 'Voir tout';
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
    const role = (type === 'tv') ? 'Créateur' : 'Réalisateur';

    if (roleTitle) roleTitle.textContent = role;
    if (roleText) roleText.textContent = role;
}

function updateSeasonWatchedStatus(seasonCard) {
    if (!seasonCard) return;

    const iconContainer = seasonCard.querySelector('.season-status-icon');
    if (!iconContainer) return;

    const episodesContainer = seasonCard.querySelector('.episodes-container');
    const episodeIcons = episodesContainer.querySelectorAll('.episode-tick-icon');

    if (episodeIcons.length === 0) return;

    const allWatched = Array.from(episodeIcons).every(icon => icon.textContent.trim() === 'check_circle');

    if (allWatched) {
        iconContainer.innerHTML = `<span class="material-symbols-outlined !text-xl text-green-400">check_circle</span>`;
    } else {
        const seasonNumber = seasonCard.dataset.seasonNumber;
        iconContainer.innerHTML = `<div class="bg-gray-700 h-full w-full rounded-lg flex items-center justify-center text-sm font-bold text-white">${seasonNumber}</div>`;
    }
}

function updateSeasonsUI(seasons, seriesId, totalEpisodes) {
    const container = document.getElementById('seasons-episodes-container');
    if (!container) return;

    container.innerHTML = '';

    seasons.forEach(season => {
        if (season.season_number === 0) return;

        const seasonCardHTML = `
            <div class="season-card rounded-xl bg-gray-800/50 border border-white/5 overflow-hidden" data-season-number="${season.season_number}">
                <div class="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="season-status-icon h-8 w-8 rounded-lg">
                           <div class="bg-gray-700 h-full w-full rounded-lg flex items-center justify-center text-sm font-bold text-white">${season.season_number}</div>
                        </div>
                        <div>
                            <h3 class="font-bold text-white text-sm">${season.name}</h3>
                            <span class="text-xs text-gray-400">${season.episode_count} Épisodes</span>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-gray-400 transition-transform duration-300">expand_more</span>
                </div>
                <div class="episodes-container bg-black/20 border-t border-white/5"></div>
            </div>
        `;
        container.innerHTML += seasonCardHTML;
    });

    document.querySelectorAll('.season-card .cursor-pointer').forEach(header => {
        header.addEventListener('click', async () => {
            const card = header.closest('.season-card');
            const episodesContainer = card.querySelector('.episodes-container');
            const arrow = card.querySelector('.material-symbols-outlined');
            const seasonNumber = card.dataset.seasonNumber;

            const cardIsOpen = card.classList.contains('open');

            if (cardIsOpen) {
                card.classList.remove('open');
                arrow.style.transform = 'rotate(0deg)';
            } else {
                card.classList.add('open');
                arrow.style.transform = 'rotate(180deg)';
                
                if (!episodesContainer.dataset.loaded) {
                    episodesContainer.innerHTML = '<div class="p-4 text-center"><div class="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div></div>';
                    try {
                        const url = `${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`;
                        const res = await fetch(url);
                        if (!res.ok) throw new Error('Failed to fetch season details');
                        const seasonDetails = await res.json();

                        const episodes = seasonDetails.episodes;
                        if (!episodes || episodes.length === 0) {
                            episodesContainer.innerHTML = '<div class="p-4 text-gray-400 text-sm">Aucun épisode.</div>';
                        } else {
                            const watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
                            const seriesWatchedEpisodes = watchedEpisodes[seriesId] || [];

                            const episodesListHTML = episodes.map(episode => {
                                const isChecked = seriesWatchedEpisodes.includes(episode.id);
                                return `
                                    <div class="flex items-center gap-3 p-3 border-t border-white/5 hover:bg-white/5 transition-colors">
                                        <span class="text-xs font-mono text-gray-500 w-6 text-center">${episode.episode_number}</span>
                                        <div class="flex-1 min-w-0">
                                            <p class="text-sm font-medium text-white truncate">${episode.name}</p>
                                            <p class="text-[10px] text-gray-500">${episode.runtime ? episode.runtime + 'm' : ''}</p>
                                        </div>
                                        <span class="material-symbols-outlined !text-xl cursor-pointer episode-tick-icon ${isChecked ? 'text-green-400' : 'text-gray-500'}" data-episode-id="${episode.id}">${isChecked ? 'check_circle' : 'radio_button_unchecked'}</span>
                                    </div>`;
                            }).join('');

                            episodesContainer.innerHTML = `<div class="">${episodesListHTML}</div>`;

                            episodesContainer.querySelectorAll('.episode-tick-icon').forEach(icon => {
                                icon.addEventListener('click', () => {
                                    const episodeId = parseInt(icon.dataset.episodeId, 10);
                                    toggleEpisodeWatchedStatus(seriesId, episodeId, totalEpisodes, icon);
                                });
                            });
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
    let watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
    if (!watchedEpisodes[seriesId]) watchedEpisodes[seriesId] = [];

    const seriesIdNum = parseInt(seriesId, 10);
    const episodeIndex = watchedEpisodes[seriesId].indexOf(episodeId);

    if (episodeIndex > -1) {
        watchedEpisodes[seriesId].splice(episodeIndex, 1);
        icon.textContent = 'radio_button_unchecked';
        icon.classList.remove('text-green-400');
        icon.classList.add('text-gray-500');
    } else {
        watchedEpisodes[seriesId].push(episodeId);
        icon.textContent = 'check_circle';
        icon.classList.remove('text-gray-500');
        icon.classList.add('text-green-400');
    }

    let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    if (!watchlist.some(item => item.id === seriesIdNum)) {
        watchlist.push({ id: seriesIdNum, type: 'serie', added_at: new Date().toISOString() });
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        updateWatchlistButton(seriesId);
    }

    localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));

    const seasonCard = icon.closest('.season-card');
    updateSeasonWatchedStatus(seasonCard);

    const watchedCount = watchedEpisodes[seriesId].length;
    let watchedList = JSON.parse(localStorage.getItem('watchedSeries')) || [];
    
    if (totalEpisodes && watchedCount === totalEpisodes) {
        if (!watchedList.includes(seriesIdNum)) {
            watchedList.push(seriesIdNum);
            localStorage.setItem('watchedSeries', JSON.stringify(watchedList));
            updateWatchlistButton(seriesId);
        }
    } else {
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

    const videos = data.videos?.results || [];

    const similar = data.similar?.results?.map(s => ({
        id: s.id,
        title: s.title,
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
        updateWatchlistButton(mediaId);
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => toggleWatchlist(mediaId));
    }
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
             showConfirmationModal(mediaId, 99); 
             return;
        }
        watchedList.push(mediaIdNum);
        localStorage.setItem(watchedListKey, JSON.stringify(watchedList));
        updateWatchlistButton(mediaId);
    } else {
        // Fix: Save the type (movie/serie) to avoid missing metadata issues in Watchlist
        const type = isMovie ? 'movie' : 'serie';
        watchlist.push({ id: mediaIdNum, type: type, added_at: new Date().toISOString() });
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        updateWatchlistButton(mediaId);
    }
}

function showConfirmationModal(seriesId, total) {
    const modal = document.getElementById('confirmation-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-cancel-button').onclick = () => modal.style.display = 'none';
    document.getElementById('modal-confirm-button').onclick = () => {
        const seriesIdNum = parseInt(seriesId, 10);
        let watchedList = JSON.parse(localStorage.getItem('watchedSeries')) || [];
        if (!watchedList.includes(seriesIdNum)) {
            watchedList.push(seriesIdNum);
            localStorage.setItem('watchedSeries', JSON.stringify(watchedList));
        }
        modal.style.display = 'none';
        updateWatchlistButton(seriesId);
    };
}

function updateWatchlistButton(mediaId) {
    const btn = document.getElementById('watchlist-button');
    if(!btn) return;
    const mediaIdNum = parseInt(mediaId, 10);
    const isMovie = window.location.pathname.includes('film.html');
    const watchedListKey = isMovie ? 'watchedMovies' : 'watchedSeries';
    const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    const watchedList = JSON.parse(localStorage.getItem(watchedListKey)) || [];
    const isInWatchlist = watchlist.some(item => item.id === mediaIdNum);
    const isWatched = watchedList.includes(mediaIdNum);
    
    const icon = btn.querySelector('.material-symbols-outlined');
    const text = btn.querySelector('span:last-child');
    
    btn.className = "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-bold transition-transform active:scale-95 text-black";
    
    if(isWatched) {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-green-500', 'text-white');
        icon.textContent = 'check_circle';
        text.textContent = 'Vu';
    } else if(isInWatchlist) {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-primary', 'text-white');
        icon.textContent = 'check';
        text.textContent = 'Dans ma liste';
    } else {
        btn.classList.remove('bg-green-500', 'bg-primary', 'text-white');
        btn.classList.add('bg-white', 'text-black');
        icon.textContent = 'add';
        text.textContent = 'Ma Liste';
    }
}
