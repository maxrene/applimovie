// details.js - Version Finale Réparée

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
        const url = `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,watch/providers,similar,external_ids`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur TMDB");
        const data = await res.json();
        
        const formattedData = formatTMDBData(data, type);
        updateUI(formattedData, type, false);

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
        const streamingUrl = `${BASE_URL}/${type}/${id}/watch/providers?api_key=${TMDB_API_KEY}`;
        const streamingRes = await fetch(streamingUrl);
        const streamingData = await streamingRes.json();
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

            // Date & Status
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

            // Créateur
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
    const yearEl = document.getElementById('media-year');
    if(yearEl) yearEl.textContent = data.year;
    document.getElementById('media-synopsis').textContent = data.synopsis;

    // Note
    const imdbEl = document.getElementById('media-imdb');
    if(imdbEl) imdbEl.textContent = data.imdb;
    
    const ratingEl = document.getElementById('media-rating');
    if(ratingEl) ratingEl.textContent = data.imdb;

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

    let providers = [];
    if (Array.isArray(allProvidersData)) {
        providers = allProvidersData;
    } else {
        if (allProvidersData[userRegion] && allProvidersData[userRegion].flatrate) {
            providers = [...allProvidersData[userRegion].flatrate];
        }
        if (userRegion !== 'FR' && myPlatformIds.includes('canal')) {
            if (allProvidersData['FR'] && allProvidersData['FR'].flatrate) {
                const canal = allProvidersData['FR'].flatrate.find(p => p.provider_id === 392 || p.provider_name.includes('Canal'));
                if (canal && !providers.some(p => p.provider_id === canal.provider_id)) {
                    providers.push(canal);
                }
            }
        }
    }

    const uniqueProviders = [];
    const seenInternalIds = new Set();

    for(const p of providers) {
        const internalId = getInternalId(p.provider_name);
        if (myPlatformIds.includes(internalId)) {
            if (!seenInternalIds.has(internalId)) {
                uniqueProviders.push(p);
                seenInternalIds.add(internalId);
            }
        }
    }

    if (uniqueProviders.length > 0) {
        section.style.display = 'block';
        uniqueProviders.forEach(p => {
            let logoUrl = p.logo_path ? IMG_BASE_PROFILE + p.logo_path : 'https://placehold.co/64x64';
            let cssClass = "object-cover"; 
            const internalId = getInternalId(p.provider_name);

            if (CUSTOM_PLATFORMS[p.provider_id]) {
                logoUrl = CUSTOM_PLATFORMS[p.provider_id].url;
                cssClass = "object-contain bg-black p-1";
            } else {
                if(internalId === 'netflix') { logoUrl = CUSTOM_PLATFORMS[8].url; cssClass = "object-contain bg-black p-1"; }
                else if(internalId === 'prime') { logoUrl = CUSTOM_PLATFORMS[119].url; cssClass = "object-contain bg-black p-1"; }
                else if(internalId === 'disney') { logoUrl = CUSTOM_PLATFORMS[337].url; cssClass = "object-contain bg-black p-1"; }
                else if(internalId === 'apple') { logoUrl = CUSTOM_PLATFORMS[350].url; cssClass = "object-contain bg-black p-1"; }
            }

            container.innerHTML += `
                <img src="${logoUrl}" 
                     alt="${p.provider_name}" 
                     title="${p.provider_name}" 
                     class="h-10 w-10 rounded-lg border border-white/10 ${cssClass}"/>
            `;
        });
    } else {
        section.style.display = 'none';
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
                    <p class="font-semibold text-white text-xs leading-tight group-hover:text-primary transition-colors">${member.name}</p>
                    <p class="text-[10px] text-gray-400 truncate">${member.character}</p>
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
                        <div class="bg-gray-700 h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold text-white">${season.season_number}</div>
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
                                        <input type="checkbox" data-episode-id="${episode.id}" class="h-5 w-5 rounded border-gray-600 text-primary focus:ring-offset-0 focus:ring-0 bg-gray-700/50" ${isChecked ? 'checked' : ''}>
                                    </div>`;
                            }).join('');

                            episodesContainer.innerHTML = `<div class="">${episodesListHTML}</div>`;

                            episodesContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                                checkbox.addEventListener('change', () => {
                                    const episodeId = parseInt(checkbox.dataset.episodeId, 10);
                                    toggleEpisodeWatchedStatus(seriesId, episodeId, totalEpisodes);
                                });
                            });
                        }
                        episodesContainer.dataset.loaded = 'true';
                    } catch (e) {
                        episodesContainer.innerHTML = '<div class="p-4 text-red-500 text-sm">Erreur chargement.</div>';
                    }
                }
            }
        });
    });
}

function toggleEpisodeWatchedStatus(seriesId, episodeId, totalEpisodes) {
    let watchedEpisodes = JSON.parse(localStorage.getItem('watchedEpisodes')) || {};
    if (!watchedEpisodes[seriesId]) watchedEpisodes[seriesId] = [];

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

const awardIconSVG = `<svg class="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`;

function updateAwardsUI(data) {
    const awardsSection = document.getElementById('awards-section');
    if (!awardsSection) return;

    let wins = 0;
    let nominations = 0;
    let awardName = '';

    // On utilise une sécurité ici au cas où window.awardsData n'est pas chargé
    const externalAwardInfo = (window.awardsData && window.awardsData[data.id]) || null;

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
        awardsSection.className = "mt-4 flex flex-col gap-2 border-t border-gray-800 pt-4";
    } else {
        awardsSection.style.display = 'none';
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
        similarMovies: similar
    };
}
