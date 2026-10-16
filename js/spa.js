// js/spa.js - Navigation iOS native sans rechargement (SPA Stack + Gestes Swipe-Back + Rendu 0ms)
(function () {
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
        netflix: [8],
        prime: [119],
        disney: [337],
        apple: [350],
        canal: [381, 392],
        paramount: [531],
        max: [1899],
        skygo: [29],
        now: [39],
        rakuten: [35],
        pluto: [300],
        crunchyroll: [283],
        arte: [234]
    };

    const spaStack = [];
    let isHandlingPopState = false;

    function getStackRoot() {
        let root = document.getElementById('spa-stack-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'spa-stack-root';
            document.body.appendChild(root);
        }
        return root;
    }

    function parseSpaTarget(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return null;
        if (rawUrl.startsWith('#') || rawUrl.startsWith('javascript:')) return null;
        try {
            const url = new URL(rawUrl, window.location.href);
            if (url.origin !== window.location.origin) return null;
            const path = url.pathname.split('/').pop() || 'index.html';
            const id = url.searchParams.get('id');

            if (path === 'film.html' && id) return { view: 'movie', id: String(id), url: `film.html?id=${id}` };
            if (path === 'serie.html' && id) return { view: 'tv', id: String(id), url: `serie.html?id=${id}` };
            if (path === 'person.html' && id) return { view: 'person', id: String(id), url: `person.html?id=${id}` };
            if (path === 'profile.html') return { view: 'profile', id: 'me', url: 'profile.html' };
            if (path === 'platforms.html') return { view: 'platforms', id: 'select', url: 'platforms.html' };
            if (path === 'favorite_actors.html') return { view: 'favorite_actors', id: 'list', url: 'favorite_actors.html' };
            return null;
        } catch (e) {
            return null;
        }
    }

    function escapeHTML(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isEpisodeReleased(episode, season = null) {
        const today = new Date().toISOString().split('T')[0];
        if (episode && episode.air_date) return episode.air_date <= today;
        if (season && season.air_date) return season.air_date <= today;
        return true;
    }

    function getReleasedEpisodeCount(data) {
        if (!data || !Array.isArray(data.seasons)) return data?.number_of_episodes || 0;
        if (data.last_episode_to_air) {
            let total = 0;
            const lastS = data.last_episode_to_air.season_number;
            const lastE = data.last_episode_to_air.episode_number;
            data.seasons.forEach(s => {
                if (s.season_number === 0) return;
                if (s.season_number < lastS) total += s.episode_count;
                else if (s.season_number === lastS) total += lastE;
            });
            return total;
        }
        const today = new Date().toISOString().split('T')[0];
        return data.seasons.reduce((acc, s) => {
            if (s.season_number === 0 || !s.air_date || s.air_date > today) return acc;
            return acc + (s.episode_count || 0);
        }, 0);
    }

    function determineNextEpisodeForSeries(seriesId, seriesData) {
        if (!seriesData) return null;
        const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
        const watchedSet = new Set(watchedEpisodes[String(seriesId)] || []);

        let totalReleasedEpisodes = 0;
        let watchedCount = 0;
        let watchedReleasedCount = 0;
        let nextEpisode = null;
        let hasSeasonDetails = false;

        const seasons = Array.isArray(seriesData.seasons)
            ? [...seriesData.seasons].sort((a, b) => a.season_number - b.season_number)
            : [];

        for (const season of seasons) {
            if (season.season_number === 0) continue;
            const seasonDetail = seriesData[`season/${season.season_number}`];
            const episodesList = Array.isArray(season.episodes)
                ? season.episodes
                : (seasonDetail && Array.isArray(seasonDetail.episodes) ? seasonDetail.episodes : null);
            if (!episodesList) continue;

            hasSeasonDetails = true;
            const sortedEps = [...episodesList].sort((a, b) => a.episode_number - b.episode_number);

            for (const ep of sortedEps) {
                const watched = watchedSet.has(ep.id);
                const released = isEpisodeReleased(ep, season);
                if (watched) {
                    watchedCount++;
                    if (released) watchedReleasedCount++;
                }
                if (released) {
                    totalReleasedEpisodes++;
                    if (!watched && !nextEpisode) {
                        nextEpisode = { ...ep, season_number: ep.season_number || season.season_number };
                    }
                }
            }
        }

        if (!hasSeasonDetails) {
            totalReleasedEpisodes = getReleasedEpisodeCount(seriesData) || 0;
            watchedCount = watchedSet.size;
            watchedReleasedCount = watchedCount;
        }

        return {
            nextEpisode,
            totalEpisodes: totalReleasedEpisodes,
            totalReleasedEpisodes,
            watchedCount,
            watchedReleasedCount,
            hasSeasonDetails
        };
    }

    function attachSwipeBackGesture(screenEl, onBack) {
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let dragging = false;
        let currentX = 0;

        screenEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            if (touch.clientX > 32) return; // Bord gauche style iOS
            startX = touch.clientX;
            startY = touch.clientY;
            startTime = Date.now();
            currentX = 0;
            dragging = true;
            screenEl.style.transition = 'none';
        }, { passive: true });

        screenEl.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = Math.abs(touch.clientY - startY);
            if (dx < 0 || (dy > dx && currentX === 0)) {
                dragging = false;
                screenEl.style.transition = '';
                screenEl.style.transform = 'translate3d(0, 0, 0)';
                return;
            }
            currentX = dx;
            screenEl.style.transform = `translate3d(${dx}px, 0, 0)`;
        }, { passive: true });

        screenEl.addEventListener('touchend', () => {
            if (!dragging) return;
            dragging = false;
            const elapsed = Math.max(1, Date.now() - startTime);
            const velocity = currentX / elapsed;
            screenEl.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)';
            if (currentX > 95 || velocity > 0.55) {
                onBack();
            } else {
                screenEl.style.transform = 'translate3d(0, 0, 0)';
            }
        });
    }

    function createScreenShell() {
        const root = getStackRoot();
        const depth = spaStack.length + 1;
        const screen = document.createElement('div');
        screen.className = 'ios-spa-screen fixed inset-0 bg-[#121212] text-gray-100 flex flex-col overflow-hidden shadow-2xl';
        screen.style.zIndex = String(60 + depth * 2);
        screen.style.transform = 'translate3d(100%, 0, 0)';
        screen.style.transition = 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)';
        screen.style.willChange = 'transform';

        root.appendChild(screen);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                screen.style.transform = 'translate3d(0, 0, 0)';
            });
        });

        return screen;
    }

    function closeTopScreen(fromPopState = false) {
        if (spaStack.length === 0) return false;
        const top = spaStack.pop();
        if (!top) return false;

        if (!fromPopState && history.state && history.state.spaDepth) {
            isHandlingPopState = true;
            history.back();
        }

        const el = top.el;
        el.style.transition = 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)';
        el.style.transform = 'translate3d(100%, 0, 0)';
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 260);

        // Rafraîchir les statuts (vu / ma liste / reprendre la lecture) de l'écran en dessous
        window.dispatchEvent(new CustomEvent('watchlist-updated'));
        if (spaStack.length === 0) {
            const activeTab = new URLSearchParams(window.location.search).get('tab') || 'home';
            window.dispatchEvent(new CustomEvent('view-changed', { detail: { tab: activeTab } }));
        }
        return true;
    }

    window.addEventListener('popstate', () => {
        if (isHandlingPopState) {
            isHandlingPopState = false;
            return;
        }
        if (spaStack.length > 0) {
            closeTopScreen(true);
        }
    });

    // --- RENDU FILM & SÉRIE (SCOPÉ PAR ÉCRAN) ---
    function renderMediaScreen(screenEl, type, mediaId) {
        const isMovie = type === 'movie';
        const cacheKey = isMovie ? `movie-details-${mediaId}` : `series-details-${mediaId}`;
        const cachedData = window.CineDB ? window.CineDB.getMediaSync(cacheKey, true) : null;
        let seriesRuntimeData = (!isMovie && cachedData) ? cachedData : null;
        let castList = [];
        let isCastExpanded = false;

        screenEl.innerHTML = `
            <header class="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4" style="padding-top: max(1rem, env(safe-area-inset-top));">
                <button type="button" data-action="back" class="rounded-full bg-black/55 p-2 text-white backdrop-blur-md hover:bg-black/75 active:scale-95 transition-all shadow-lg border border-white/10">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                </button>
            </header>
            <main class="flex-1 overflow-y-auto no-scrollbar pb-24" style="-webkit-overflow-scrolling: touch;">
                <div class="relative h-80 bg-gray-900">
                    <img data-el="banner" alt="" class="h-full w-full object-cover transition-opacity duration-300 opacity-0" onload="this.classList.remove('opacity-0')" />
                    <div class="absolute inset-0 bg-gradient-to-t from-[#121212] via-black/35 to-black/20"></div>
                </div>
                <div class="px-4 relative z-10">
                    <div class="relative -mt-28 mb-4 flex items-end gap-4">
                        <img data-el="poster" alt="" class="h-40 w-28 rounded-xl object-cover shadow-2xl border border-white/10 bg-gray-800 flex-shrink-0" />
                        <div class="flex-1 pb-1 min-w-0">
                            <h1 data-el="title" class="text-2xl font-bold text-white leading-tight drop-shadow-md">Chargement...</h1>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 text-sm text-gray-300 font-medium mb-3 flex-wrap">
                        <span data-el="year">--</span>
                        <span class="text-gray-500">•</span>
                        <span data-el="meta-extra">--</span>
                        <span class="text-gray-500">•</span>
                        <div data-el="ratings" class="flex items-center gap-2.5"></div>
                    </div>

                    <div data-el="genres" class="flex flex-wrap items-center gap-2 mb-5"></div>
                    <div data-el="awards" style="display: none;"></div>

                    <div class="flex items-center gap-3 mb-7">
                        <button type="button" data-el="watchlist-btn" class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white text-black py-3 font-bold transition-transform active:scale-95 shadow-md">
                            <span class="material-symbols-outlined filled">add</span>
                            <span data-el="watchlist-text">Ajouter à ma liste</span>
                        </button>
                        ${!isMovie ? `
                        <button type="button" data-el="next-ep-btn" class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gray-800 text-white border border-gray-700 py-3 font-bold transition-transform active:scale-95" style="display: none;">
                            <span class="material-symbols-outlined filled text-green-400">check</span>
                            <span data-el="next-ep-text">Épisode vu</span>
                        </button>` : ''}
                    </div>

                    <div data-el="streaming-section" class="mb-7" style="display: none;">
                        <h3 class="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">Disponible sur</h3>
                        <div data-el="streaming-list" class="flex items-center gap-3 min-h-[40px] flex-wrap"></div>
                    </div>

                    <div class="mb-7">
                        <h3 class="text-lg font-bold text-white mb-2">Synopsis</h3>
                        <p data-el="synopsis" class="text-gray-400 leading-relaxed text-sm"></p>
                    </div>

                    <div data-el="director-section" class="mb-7" style="display: none;">
                        <h3 data-el="director-label" class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">${isMovie ? 'Réalisateur' : 'Créateur'}</h3>
                        <div data-el="director-card" class="inline-flex items-center gap-3 p-1.5 -m-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                            <img data-el="director-img" class="h-10 w-10 rounded-full object-cover bg-gray-800" />
                            <span data-el="director-name" class="font-semibold text-white text-sm"></span>
                        </div>
                    </div>

                    <div data-el="cast-section" class="mb-7" style="display: none;">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-lg font-bold text-white">Têtes d'affiche</h3>
                            <button type="button" data-el="cast-toggle" class="text-sm text-primary font-semibold" style="display: none;">Voir tout</button>
                        </div>
                        <div data-el="cast-list" class="grid grid-cols-2 gap-3"></div>
                    </div>

                    <div data-el="trailers-section" class="mb-7" style="display: none;">
                        <h3 class="text-lg font-bold text-white mb-3">Bandes-annonces & Vidéos</h3>
                        <div data-el="trailers-list" class="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory"></div>
                    </div>

                    ${!isMovie ? `
                    <div data-el="seasons-section" class="mb-8" style="display: none;">
                        <h3 class="text-lg font-bold text-white mb-3">Saisons</h3>
                        <div data-el="seasons-list" class="space-y-3"></div>
                    </div>` : ''}

                    <div data-el="similar-section" class="mb-6" style="display: none;">
                        <h3 class="text-lg font-bold text-white mb-3">${isMovie ? 'Films similaires' : 'Séries similaires'}</h3>
                        <div data-el="similar-list" class="flex gap-3 overflow-x-auto pb-2 no-scrollbar"></div>
                    </div>
                </div>
            </main>
        `;

        const q = (sel) => screenEl.querySelector(sel);
        q('[data-action="back"]').onclick = () => closeTopScreen();

        function updateWatchlistBtnState() {
            const btn = q('[data-el="watchlist-btn"]');
            if (!btn) return;
            const icon = btn.querySelector('.material-symbols-outlined');
            const text = q('[data-el="watchlist-text"]');
            const idNum = Number(mediaId);
            const idStr = String(mediaId);
            const watchlist = getSafeLocalStorage('watchlist', []);
            const watchedKey = isMovie ? 'watchedMovies' : 'watchedSeries';
            const watchedList = getSafeLocalStorage(watchedKey, []);
            const isInWatchlist = watchlist.some(i => Number(i.id) === idNum);
            const isWatched = watchedList.includes(idNum);

            btn.className = 'flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-bold transition-transform active:scale-95 shadow-md';

            if (isMovie) {
                if (isWatched) {
                    btn.classList.add('bg-green-500', 'text-white');
                    icon.textContent = 'check_circle';
                    text.textContent = 'Vu';
                } else if (isInWatchlist) {
                    btn.classList.add('bg-primary', 'text-white');
                    icon.textContent = 'check';
                    text.textContent = 'Dans ma liste';
                } else {
                    btn.classList.add('bg-white', 'text-black');
                    icon.textContent = 'add';
                    text.textContent = 'Ajouter à ma liste';
                }
                return;
            }

            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const watchedCount = (watchedEpisodes[idStr] || []).length;
            const epInfo = seriesRuntimeData ? determineNextEpisodeForSeries(mediaId, seriesRuntimeData) : null;
            const isReturning = seriesRuntimeData && (seriesRuntimeData.status === 'Returning Series' || seriesRuntimeData.status === 'In Production');

            let allReleasedWatched = false;
            if (epInfo && epInfo.hasSeasonDetails) {
                allReleasedWatched = epInfo.totalReleasedEpisodes > 0 && epInfo.watchedReleasedCount >= epInfo.totalReleasedEpisodes && !epInfo.nextEpisode;
            } else if (epInfo && epInfo.totalReleasedEpisodes > 0) {
                allReleasedWatched = watchedCount >= epInfo.totalReleasedEpisodes;
            }
            const isCompleted = isWatched || allReleasedWatched;

            if (isCompleted) {
                btn.classList.add('bg-green-500', 'text-white');
                icon.textContent = 'check_circle';
                text.textContent = isReturning ? 'À jour' : 'Vu';
            } else if (watchedCount > 0) {
                btn.classList.add('bg-primary', 'text-white');
                icon.textContent = 'play_arrow';
                text.textContent = 'En cours';
            } else if (isInWatchlist) {
                btn.classList.add('bg-primary', 'text-white');
                icon.textContent = 'bookmark_added';
                text.textContent = 'Dans ma liste';
            } else {
                btn.classList.add('bg-white', 'text-black');
                icon.textContent = 'add';
                text.textContent = 'Ajouter à ma liste';
            }

            // Bouton "S01E02 vu"
            const nextBtn = q('[data-el="next-ep-btn"]');
            const nextTxt = q('[data-el="next-ep-text"]');
            if (nextBtn && nextTxt) {
                if ((isInWatchlist || watchedCount > 0) && epInfo && epInfo.nextEpisode && !(isWatched && watchedCount === 0)) {
                    const sCode = String(epInfo.nextEpisode.season_number).padStart(2, '0');
                    const eCode = String(epInfo.nextEpisode.episode_number).padStart(2, '0');
                    nextTxt.textContent = `S${sCode}E${eCode} vu`;
                    nextBtn.style.display = 'flex';
                    nextBtn.onclick = () => markSingleEpisodeWatched(epInfo.nextEpisode.id);
                } else {
                    nextBtn.style.display = 'none';
                }
            }
        }

        function syncSeriesStatusFromEpisodes(userAction = false) {
            if (isMovie) return;
            const idNum = Number(mediaId);
            const idStr = String(mediaId);
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const watchedCount = (watchedEpisodes[idStr] || []).length;
            let watchlist = getSafeLocalStorage('watchlist', []);
            let watchedSeries = getSafeLocalStorage('watchedSeries', []);
            const isInWatchlist = watchlist.some(i => Number(i.id) === idNum);
            const isMarkedWatched = watchedSeries.includes(idNum);

            const epInfo = seriesRuntimeData ? determineNextEpisodeForSeries(mediaId, seriesRuntimeData) : null;
            const allReleasedWatched = epInfo && epInfo.hasSeasonDetails
                ? (epInfo.totalReleasedEpisodes > 0 && epInfo.watchedReleasedCount >= epInfo.totalReleasedEpisodes && !epInfo.nextEpisode)
                : (epInfo && epInfo.totalReleasedEpisodes > 0 ? watchedCount >= epInfo.totalReleasedEpisodes : false);

            if ((watchedCount > 0 || isMarkedWatched) && !isInWatchlist) {
                watchlist.push({ id: idNum, type: 'serie', added_at: new Date().toISOString() });
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
            }

            if (allReleasedWatched) {
                if (!watchedSeries.includes(idNum)) {
                    watchedSeries.push(idNum);
                    localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
                }
            } else if (watchedCount > 0 || userAction) {
                if (watchedSeries.includes(idNum)) {
                    watchedSeries = watchedSeries.filter(id => id !== idNum);
                    localStorage.setItem('watchedSeries', JSON.stringify(watchedSeries));
                }
            }
            updateWatchlistBtnState();
            window.dispatchEvent(new CustomEvent('watchlist-updated'));
        }

        function markSingleEpisodeWatched(episodeId) {
            const idStr = String(mediaId);
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            if (!Array.isArray(watchedEpisodes[idStr])) watchedEpisodes[idStr] = [];
            if (!watchedEpisodes[idStr].includes(episodeId)) {
                watchedEpisodes[idStr].push(episodeId);
                localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));
                const dates = getSafeLocalStorage('seriesLastWatchedDate', {});
                dates[idStr] = Date.now();
                localStorage.setItem('seriesLastWatchedDate', JSON.stringify(dates));
            }
            const icon = screenEl.querySelector(`.episode-tick-icon[data-episode-id="${episodeId}"]`);
            if (icon) {
                icon.textContent = 'check_circle';
                icon.classList.remove('text-gray-500');
                icon.classList.add('text-green-400');
                const card = icon.closest('.season-card');
                if (card) refreshSeasonTickUI(card);
            } else {
                screenEl.querySelectorAll('.season-card').forEach(card => refreshSeasonTickFromData(card));
            }
            syncSeriesStatusFromEpisodes(true);
        }

        async function markAllReleasedWatched() {
            if (!seriesRuntimeData || !Array.isArray(seriesRuntimeData.seasons)) return;
            const idStr = String(mediaId);
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            if (!Array.isArray(watchedEpisodes[idStr])) watchedEpisodes[idStr] = [];

            const apiKey = window.TMDB_API_KEY || '';
            const seasonPromises = seriesRuntimeData.seasons
                .filter(s => s.season_number > 0)
                .map(async (s) => {
                    if (Array.isArray(s.episodes)) return s;
                    if (seriesRuntimeData[`season/${s.season_number}`]?.episodes) {
                        s.episodes = seriesRuntimeData[`season/${s.season_number}`].episodes;
                        return s;
                    }
                    try {
                        const r = await fetch(`${BASE_URL}/tv/${mediaId}/season/${s.season_number}?api_key=${apiKey}&language=fr-FR`);
                        if (r.ok) {
                            const d = await r.json();
                            s.episodes = d.episodes || [];
                            seriesRuntimeData[`season/${s.season_number}`] = d;
                        }
                    } catch (e) {}
                    return s;
                });

            const loadedSeasons = await Promise.all(seasonPromises);
            loadedSeasons.forEach(s => {
                (s.episodes || []).forEach(ep => {
                    if (isEpisodeReleased(ep, s) && !watchedEpisodes[idStr].includes(ep.id)) {
                        watchedEpisodes[idStr].push(ep.id);
                    }
                });
            });

            localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));
            const dates = getSafeLocalStorage('seriesLastWatchedDate', {});
            dates[idStr] = Date.now();
            localStorage.setItem('seriesLastWatchedDate', JSON.stringify(dates));

            screenEl.querySelectorAll('.season-card').forEach(card => {
                refreshSeasonTickFromData(card);
                card.querySelectorAll('.episode-tick-icon').forEach(icon => {
                    if (icon.dataset.released !== 'false') {
                        icon.textContent = 'check_circle';
                        icon.classList.remove('text-gray-500');
                        icon.classList.add('text-green-400');
                    }
                });
            });
        }

        q('[data-el="watchlist-btn"]').onclick = async () => {
            const idNum = Number(mediaId);
            const idStr = String(mediaId);
            const watchedKey = isMovie ? 'watchedMovies' : 'watchedSeries';
            let watchlist = getSafeLocalStorage('watchlist', []);
            let watchedList = getSafeLocalStorage(watchedKey, []);
            const isInWatchlist = watchlist.some(i => Number(i.id) === idNum);
            const isWatched = watchedList.includes(idNum);

            if (isMovie) {
                if (isWatched) {
                    watchlist = watchlist.filter(i => Number(i.id) !== idNum);
                    watchedList = watchedList.filter(id => id !== idNum);
                } else if (isInWatchlist) {
                    watchlist = watchlist.filter(i => Number(i.id) !== idNum);
                    watchedList.push(idNum);
                } else {
                    watchlist.push({ id: idNum, type: 'movie', added_at: new Date().toISOString() });
                    if (window.offlineManager) window.offlineManager.cacheMedia(idNum, 'movie');
                }
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                localStorage.setItem(watchedKey, JSON.stringify(watchedList));
                updateWatchlistBtnState();
                window.dispatchEvent(new CustomEvent('watchlist-updated'));
                return;
            }

            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const watchedCount = (watchedEpisodes[idStr] || []).length;
            const epInfo = seriesRuntimeData ? determineNextEpisodeForSeries(mediaId, seriesRuntimeData) : null;
            const allReleasedWatched = epInfo && epInfo.hasSeasonDetails
                ? (epInfo.totalReleasedEpisodes > 0 && epInfo.watchedReleasedCount >= epInfo.totalReleasedEpisodes && !epInfo.nextEpisode)
                : false;
            const isCompleted = isWatched || allReleasedWatched;

            if (isCompleted) {
                watchlist = watchlist.filter(i => Number(i.id) !== idNum);
                watchedList = watchedList.filter(id => id !== idNum);
                delete watchedEpisodes[idStr];
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                localStorage.setItem(watchedKey, JSON.stringify(watchedList));
                localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));
                screenEl.querySelectorAll('.season-tick-action, .episode-tick-icon').forEach(icon => {
                    icon.textContent = 'radio_button_unchecked';
                    icon.classList.remove('text-green-400');
                    icon.classList.add('text-gray-500');
                });
            } else if (isInWatchlist || watchedCount > 0) {
                if (!isInWatchlist) {
                    watchlist.push({ id: idNum, type: 'serie', added_at: new Date().toISOString() });
                    localStorage.setItem('watchlist', JSON.stringify(watchlist));
                }
                if (!watchedList.includes(idNum)) {
                    watchedList.push(idNum);
                    localStorage.setItem(watchedKey, JSON.stringify(watchedList));
                }
                await markAllReleasedWatched();
            } else {
                watchlist.push({ id: idNum, type: 'serie', added_at: new Date().toISOString() });
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                if (window.offlineManager) window.offlineManager.cacheMedia(idNum, 'serie');
            }
            updateWatchlistBtnState();
            window.dispatchEvent(new CustomEvent('watchlist-updated'));
        };

        function renderCast() {
            const section = q('[data-el="cast-section"]');
            const listEl = q('[data-el="cast-list"]');
            const toggleBtn = q('[data-el="cast-toggle"]');
            if (!section || !listEl) return;

            if (!castList || castList.length === 0) {
                section.style.display = 'none';
                return;
            }
            section.style.display = 'block';
            const visible = castList.slice(0, isCastExpanded ? 24 : 4);
            listEl.innerHTML = visible.map(m => `
                <a href="${m.id ? `person.html?id=${m.id}` : '#'}" class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/10 transition-colors">
                    <img src="${m.profile_path ? IMG_BASE_PROFILE + m.profile_path : (m.imageUrl || 'https://placehold.co/64x64')}" class="h-12 w-12 rounded-full object-cover bg-gray-800 flex-shrink-0" loading="lazy" />
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-white text-sm leading-tight truncate">${escapeHTML(m.name)}</p>
                        <p class="text-xs text-gray-400 truncate">${escapeHTML(m.character || '')}</p>
                    </div>
                </a>
            `).join('');

            if (toggleBtn) {
                if (castList.length > 4) {
                    toggleBtn.style.display = 'block';
                    toggleBtn.textContent = isCastExpanded ? 'Voir moins' : `Voir tout (${Math.min(castList.length, 24)})`;
                    toggleBtn.onclick = () => {
                        isCastExpanded = !isCastExpanded;
                        renderCast();
                    };
                } else {
                    toggleBtn.style.display = 'none';
                }
            }
        }

        function renderStreaming(providersObj) {
            const section = q('[data-el="streaming-section"]');
            const listEl = q('[data-el="streaming-list"]');
            if (!section || !listEl) return;

            const selectedPlatforms = getSafeLocalStorage('selectedPlatforms', []);
            if (selectedPlatforms.length === 0) {
                section.style.display = 'block';
                listEl.innerHTML = '<a href="platforms.html" class="text-primary hover:underline text-sm font-medium">Sélectionner mes plateformes →</a>';
                return;
            }

            const allowedIds = new Set();
            selectedPlatforms.forEach(id => {
                const mapped = PLATFORM_ID_MAP[id];
                if (Array.isArray(mapped)) mapped.forEach(n => allowedIds.add(n));
            });

            const region = localStorage.getItem('userRegion') || 'FR';
            const results = providersObj?.results || providersObj || {};
            let providers = [];
            if (results[region]?.flatrate) {
                providers = [...results[region].flatrate];
            }
            if (region !== 'FR' && selectedPlatforms.includes('canal') && results.FR?.flatrate) {
                const canal = results.FR.flatrate.find(p => p.provider_id === 381 || p.provider_id === 392);
                if (canal && !providers.some(p => p.provider_id === canal.provider_id)) {
                    providers.push(canal);
                }
            }

            const unique = [];
            const seen = new Set();
            providers.forEach(p => {
                const key = window.getInternalPlatformId ? window.getInternalPlatformId(p.provider_name, p.provider_id) : null;
                if (allowedIds.has(p.provider_id) || (key && selectedPlatforms.includes(key))) {
                    const dedup = key || p.provider_id;
                    if (!seen.has(dedup)) {
                        seen.add(dedup);
                        unique.push(p);
                    }
                }
            });

            section.style.display = 'block';
            if (unique.length > 0) {
                listEl.innerHTML = unique.map(p => {
                    const logo = CUSTOM_PLATFORMS[p.provider_id]?.url || (p.logo_path ? IMG_BASE_PROFILE + p.logo_path : '');
                    return `<img src="${logo}" alt="${escapeHTML(p.provider_name)}" title="${escapeHTML(p.provider_name)}" class="h-10 w-10 rounded-xl border border-white/15 object-cover bg-black shadow-md" />`;
                }).join('');
            } else {
                listEl.innerHTML = '<span class="text-gray-500 text-sm">Non disponible sur vos plateformes en abonnement</span>';
            }
        }

        function refreshSeasonTickUI(seasonCard) {
            const icons = Array.from(seasonCard.querySelectorAll('.episode-tick-icon'));
            if (icons.length === 0) return;
            const released = icons.filter(i => i.dataset.released !== 'false');
            const targets = released.length > 0 ? released : icons;
            const allWatched = targets.length > 0 && targets.every(i => i.textContent.trim() === 'check_circle');
            const rightTick = seasonCard.querySelector('.season-tick-action');
            if (rightTick) {
                rightTick.textContent = allWatched ? 'check_circle' : 'radio_button_unchecked';
                rightTick.classList.toggle('text-green-400', allWatched);
                rightTick.classList.toggle('text-gray-500', !allWatched);
            }
        }

        function refreshSeasonTickFromData(seasonCard) {
            const sNum = Number(seasonCard.dataset.seasonNumber);
            const rightTick = seasonCard.querySelector('.season-tick-action');
            if (!rightTick || !seriesRuntimeData) return;
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const watchedSet = new Set(watchedEpisodes[String(mediaId)] || []);
            if (watchedSet.size === 0) {
                rightTick.textContent = 'radio_button_unchecked';
                rightTick.classList.remove('text-green-400');
                rightTick.classList.add('text-gray-500');
                return;
            }
            const seasonObj = (seriesRuntimeData.seasons || []).find(s => s.season_number === sNum);
            const episodes = seasonObj?.episodes || seriesRuntimeData[`season/${sNum}`]?.episodes;
            if (!Array.isArray(episodes) || episodes.length === 0) return;
            const released = episodes.filter(ep => isEpisodeReleased(ep, seasonObj));
            const targets = released.length > 0 ? released : episodes;
            const allWatched = targets.length > 0 && targets.every(ep => watchedSet.has(ep.id));
            rightTick.textContent = allWatched ? 'check_circle' : 'radio_button_unchecked';
            rightTick.classList.toggle('text-green-400', allWatched);
            rightTick.classList.toggle('text-gray-500', !allWatched);
        }

        function renderSeasonEpisodes(episodesContainer, episodes, seasonObj, seasonCard) {
            const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
            const watchedSet = new Set(watchedEpisodes[String(mediaId)] || []);

            episodesContainer.innerHTML = episodes.map(ep => {
                const checked = watchedSet.has(ep.id);
                const released = isEpisodeReleased(ep, seasonObj);
                const dateStr = ep.air_date ? new Date(ep.air_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                const meta = [ep.runtime ? `${ep.runtime}m` : '', dateStr].filter(Boolean).join(' • ');
                const hasOverview = Boolean(ep.overview && ep.overview.trim());
                return `
                    <div class="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <div class="flex items-center gap-3 p-3">
                            <span class="text-xs font-mono text-gray-500 w-6 text-center">${ep.episode_number}</span>
                            <div class="flex-1 min-w-0 ${hasOverview ? 'cursor-pointer ep-info-toggle' : ''}">
                                <div class="flex items-center gap-2">
                                    <p class="text-sm font-medium ${released ? 'text-white' : 'text-gray-400'} truncate">${escapeHTML(ep.name || `Épisode ${ep.episode_number}`)}</p>
                                    ${!released ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase flex-shrink-0">À venir</span>' : ''}
                                </div>
                                <p class="text-[10px] text-gray-500 mt-0.5">${meta}${hasOverview ? ' • <span class="text-gray-400 underline">Synopsis</span>' : ''}</p>
                            </div>
                            <span class="material-symbols-outlined !text-xl cursor-pointer episode-tick-icon ${checked ? 'text-green-400' : 'text-gray-500'}" data-episode-id="${ep.id}" data-released="${released}">${checked ? 'check_circle' : 'radio_button_unchecked'}</span>
                        </div>
                        ${hasOverview ? `<div class="ep-overview hidden px-4 pb-3 pl-12 text-xs text-gray-400 leading-relaxed">${escapeHTML(ep.overview)}</div>` : ''}
                    </div>
                `;
            }).join('');

            episodesContainer.querySelectorAll('.ep-info-toggle').forEach(el => {
                el.onclick = () => {
                    const ov = el.closest('.border-t')?.querySelector('.ep-overview');
                    if (ov) ov.classList.toggle('hidden');
                };
            });

            episodesContainer.querySelectorAll('.episode-tick-icon').forEach(icon => {
                icon.onclick = (e) => {
                    e.stopPropagation();
                    const epId = Number(icon.dataset.episodeId);
                    const idStr = String(mediaId);
                    const store = getSafeLocalStorage('watchedEpisodes', {});
                    if (!Array.isArray(store[idStr])) store[idStr] = [];
                    const idx = store[idStr].indexOf(epId);
                    if (idx > -1) {
                        store[idStr].splice(idx, 1);
                        icon.textContent = 'radio_button_unchecked';
                        icon.classList.remove('text-green-400');
                        icon.classList.add('text-gray-500');
                    } else {
                        store[idStr].push(epId);
                        icon.textContent = 'check_circle';
                        icon.classList.remove('text-gray-500');
                        icon.classList.add('text-green-400');
                        const dates = getSafeLocalStorage('seriesLastWatchedDate', {});
                        dates[idStr] = Date.now();
                        localStorage.setItem('seriesLastWatchedDate', JSON.stringify(dates));
                    }
                    localStorage.setItem('watchedEpisodes', JSON.stringify(store));
                    refreshSeasonTickUI(seasonCard);
                    syncSeriesStatusFromEpisodes(true);
                };
            });
            episodesContainer.dataset.loaded = 'true';
        }

        function renderSeasons(seasons) {
            const section = q('[data-el="seasons-section"]');
            const listEl = q('[data-el="seasons-list"]');
            if (!section || !listEl || !Array.isArray(seasons)) return;

            const validSeasons = seasons.filter(s => s && s.season_number > 0);
            if (validSeasons.length === 0) {
                section.style.display = 'none';
                return;
            }
            section.style.display = 'block';
            listEl.innerHTML = validSeasons.map(s => {
                const y = s.air_date ? s.air_date.split('-')[0] : '';
                return `
                    <div class="season-card rounded-xl bg-gray-800/50 border border-white/5 overflow-hidden" data-season-number="${s.season_number}">
                        <div class="season-header flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
                            <div class="flex items-center gap-3">
                                <div class="h-8 w-8 rounded-lg bg-gray-700 flex items-center justify-center text-sm font-bold text-white">${s.season_number}</div>
                                <div>
                                    <h4 class="font-bold text-white text-sm">${escapeHTML(s.name)}</h4>
                                    <span class="text-xs text-gray-400">${y ? y + ' • ' : ''}${s.episode_count || 0} Épisodes</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="material-symbols-outlined text-2xl text-gray-500 hover:text-green-400 cursor-pointer season-tick-action z-10">radio_button_unchecked</span>
                                <span class="material-symbols-outlined text-gray-400 transition-transform duration-300 season-arrow">expand_more</span>
                            </div>
                        </div>
                        <div class="episodes-container hidden bg-black/20 border-t border-white/5"></div>
                    </div>
                `;
            }).join('');

            listEl.querySelectorAll('.season-card').forEach(card => {
                const sNum = Number(card.dataset.seasonNumber);
                const seasonObj = validSeasons.find(s => s.season_number === sNum);
                const header = card.querySelector('.season-header');
                const tickBtn = card.querySelector('.season-tick-action');
                const epContainer = card.querySelector('.episodes-container');
                const arrow = card.querySelector('.season-arrow');

                refreshSeasonTickFromData(card);

                async function ensureEpisodesLoaded() {
                    if (epContainer.dataset.loaded === 'true') return;
                    let episodes = seasonObj?.episodes || seriesRuntimeData?.[`season/${sNum}`]?.episodes;
                    if (!Array.isArray(episodes)) {
                        epContainer.innerHTML = '<div class="p-4 text-center"><div class="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div></div>';
                        try {
                            const apiKey = window.TMDB_API_KEY || '';
                            const r = await fetch(`${BASE_URL}/tv/${mediaId}/season/${sNum}?api_key=${apiKey}&language=fr-FR`);
                            if (r.ok) {
                                const d = await r.json();
                                episodes = d.episodes || [];
                                if (seasonObj) seasonObj.episodes = episodes;
                                if (seriesRuntimeData) seriesRuntimeData[`season/${sNum}`] = d;
                            }
                        } catch (e) {}
                    }
                    if (Array.isArray(episodes) && episodes.length > 0) {
                        renderSeasonEpisodes(epContainer, episodes, seasonObj, card);
                    } else {
                        epContainer.innerHTML = '<div class="p-4 text-gray-400 text-xs">Aucun épisode disponible.</div>';
                    }
                }

                header.onclick = async () => {
                    const isOpen = !epContainer.classList.contains('hidden');
                    if (isOpen) {
                        epContainer.classList.add('hidden');
                        if (arrow) arrow.style.transform = 'rotate(0deg)';
                    } else {
                        epContainer.classList.remove('hidden');
                        if (arrow) arrow.style.transform = 'rotate(180deg)';
                        await ensureEpisodesLoaded();
                        refreshSeasonTickUI(card);
                    }
                };

                tickBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await ensureEpisodesLoaded();
                    const icons = Array.from(epContainer.querySelectorAll('.episode-tick-icon'));
                    const released = icons.filter(i => i.dataset.released !== 'false');
                    const targets = released.length > 0 ? released : icons;
                    const allWatched = targets.length > 0 && targets.every(i => i.textContent.trim() === 'check_circle');
                    const shouldMark = !allWatched;
                    const idStr = String(mediaId);
                    const store = getSafeLocalStorage('watchedEpisodes', {});
                    if (!Array.isArray(store[idStr])) store[idStr] = [];

                    icons.forEach(icon => {
                        const epId = Number(icon.dataset.episodeId);
                        if (shouldMark && targets.includes(icon)) {
                            if (!store[idStr].includes(epId)) store[idStr].push(epId);
                            icon.textContent = 'check_circle';
                            icon.classList.remove('text-gray-500');
                            icon.classList.add('text-green-400');
                        } else if (!shouldMark) {
                            store[idStr] = store[idStr].filter(id => id !== epId);
                            icon.textContent = 'radio_button_unchecked';
                            icon.classList.remove('text-green-400');
                            icon.classList.add('text-gray-500');
                        }
                    });
                    if (shouldMark) {
                        const dates = getSafeLocalStorage('seriesLastWatchedDate', {});
                        dates[idStr] = Date.now();
                        localStorage.setItem('seriesLastWatchedDate', JSON.stringify(dates));
                    }
                    localStorage.setItem('watchedEpisodes', JSON.stringify(store));
                    refreshSeasonTickUI(card);
                    syncSeriesStatusFromEpisodes(true);
                };
            });
        }

        function populateScreenFromData(data) {
            if (!data) return;
            const title = isMovie ? (data.title || data.original_title) : (data.name || data.original_name);
            q('[data-el="title"]').textContent = title || 'Sans titre';

            const bannerEl = q('[data-el="banner"]');
            if (data.backdrop_path) {
                bannerEl.src = IMG_BASE_BANNER + data.backdrop_path;
            }
            const posterEl = q('[data-el="poster"]');
            if (data.poster_path) {
                posterEl.src = IMG_BASE_POSTER + data.poster_path;
            }

            let yearText = '';
            if (isMovie) {
                yearText = (data.release_date || '').split('-')[0] || '--';
                const mins = Number(data.runtime) || 0;
                q('[data-el="meta-extra"]').textContent = mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '--';
            } else {
                const start = (data.first_air_date || '').split('-')[0] || '';
                const end = (data.last_air_date || '').split('-')[0] || '';
                if (data.status === 'Returning Series') yearText = start ? `${start} - Présent` : '--';
                else if (data.status === 'Ended' && end && end !== start) yearText = `${start} - ${end}`;
                else yearText = start || '--';
                const sCount = data.number_of_seasons || (Array.isArray(data.seasons) ? data.seasons.filter(s => s.season_number > 0).length : 0);
                q('[data-el="meta-extra"]').textContent = sCount ? `${sCount} Saison${sCount > 1 ? 's' : ''}` : '--';
            }
            q('[data-el="year"]').textContent = yearText;
            q('[data-el="synopsis"]').textContent = data.overview || 'Aucun synopsis disponible.';

            // Ratings (IMDb + Rotten Tomatoes)
            const cachedRatings = window.getCachedMediaRatings ? window.getCachedMediaRatings(mediaId, isMovie ? 'movie' : 'tv') : null;
            const tmdbScore = data.vote_average ? Number(data.vote_average).toFixed(1) : '--';
            const imdbVal = cachedRatings?.imdb || tmdbScore;
            const rtVal = cachedRatings?.rt || '--';
            const rtIcon = window.getRTIconUrl ? window.getRTIconUrl(rtVal) : 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg';
            const rtUrl = cachedRatings?.rtUrl || `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title || '')}`;

            q('[data-el="ratings"]').innerHTML = `
                <div class="flex items-center gap-1">
                    <span class="bg-[#f5c518] text-black text-[10px] font-bold px-1 rounded-sm">IMDb</span>
                    <span data-el="score-imdb" class="text-gray-200 font-bold text-sm">${imdbVal}</span>
                </div>
                <span class="text-gray-500 text-sm">•</span>
                <a data-el="rt-link" href="${rtUrl}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 hover:opacity-80">
                    <img data-el="icon-rt" src="${rtIcon}" class="w-4 h-4 object-contain" alt="RT" />
                    <span data-el="score-rt" class="text-gray-200 font-bold text-sm">${rtVal}</span>
                </a>
            `;

            // Genres
            const genresEl = q('[data-el="genres"]');
            genresEl.innerHTML = (data.genres || []).map(g =>
                `<span class="bg-white/10 text-xs px-2.5 py-1 rounded-md text-gray-300 border border-white/10">${escapeHTML(g.name || g)}</span>`
            ).join('');

            // Director / Creator
            let dir = null;
            if (isMovie) {
                dir = (data.credits?.crew || []).find(c => c.job === 'Director');
            } else if (Array.isArray(data.created_by) && data.created_by.length > 0) {
                dir = data.created_by[0];
            } else {
                dir = (data.credits?.crew || []).find(c => c.job === 'Director');
            }
            const dirSection = q('[data-el="director-section"]');
            if (dir && dir.name) {
                dirSection.style.display = 'block';
                q('[data-el="director-name"]').textContent = dir.name;
                q('[data-el="director-img"]').src = dir.profile_path ? IMG_BASE_PROFILE + dir.profile_path : 'https://placehold.co/64x64';
                q('[data-el="director-card"]').onclick = () => {
                    if (dir.id) openSpaView(`person.html?id=${dir.id}`);
                };
            } else {
                dirSection.style.display = 'none';
            }

            // Cast
            castList = data.credits?.cast || [];
            renderCast();

            // Streaming
            if (data['watch/providers']) {
                renderStreaming(data['watch/providers']);
            }

            // Trailers
            const videos = (data.videos?.results || []).filter(v => v.site === 'YouTube' && ['Trailer', 'Teaser', 'Featurette', 'Clip'].includes(v.type));
            const trailersSec = q('[data-el="trailers-section"]');
            if (videos.length > 0) {
                trailersSec.style.display = 'block';
                q('[data-el="trailers-list"]').innerHTML = videos.slice(0, 5).map(v => `
                    <a href="https://www.youtube.com/watch?v=${v.key}" target="_blank" rel="noopener" class="flex-shrink-0 snap-start group w-40">
                        <div class="relative h-24 w-40 overflow-hidden rounded-xl bg-gray-800">
                            <img src="https://i.ytimg.com/vi/${v.key}/hqdefault.jpg" class="h-full w-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                            <div class="absolute inset-0 bg-black/35 flex items-center justify-center">
                                <span class="material-symbols-outlined text-4xl text-white">play_circle</span>
                            </div>
                        </div>
                        <p class="mt-1 text-xs font-semibold text-white truncate">${escapeHTML(v.name)}</p>
                    </a>
                `).join('');
            } else {
                trailersSec.style.display = 'none';
            }

            // Similar
            const similar = data.similar?.results || [];
            const simSec = q('[data-el="similar-section"]');
            if (similar.length > 0) {
                simSec.style.display = 'block';
                const targetPage = isMovie ? 'film.html' : 'serie.html';
                q('[data-el="similar-list"]').innerHTML = similar.slice(0, 10).map(s => `
                    <a href="${targetPage}?id=${s.id}" class="w-28 flex-shrink-0 group">
                        <div class="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 shadow-md">
                            <img src="${s.poster_path ? IMG_BASE_POSTER + s.poster_path : 'https://placehold.co/200x300'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                        </div>
                        <p class="mt-1.5 truncate text-xs font-medium text-white/85">${escapeHTML(s.title || s.name)}</p>
                    </a>
                `).join('');
            } else {
                simSec.style.display = 'none';
            }

            // Saisons (Série)
            if (!isMovie && Array.isArray(data.seasons)) {
                renderSeasons(data.seasons);
            }

            updateWatchlistBtnState();
        }

        // 1. Affichage 0ms depuis la mémoire RAM / IndexedDB si disponible !
        if (cachedData) {
            populateScreenFromData(cachedData);
        } else {
            updateWatchlistBtnState();
        }

        // 2. Rafraîchissement TMDB en arrière-plan
        (async () => {
            try {
                const apiKey = window.TMDB_API_KEY || '';
                let append = 'credits,watch/providers,similar,external_ids,videos';
                if (!isMovie) {
                    const seasonsAppend = Array.from({ length: 14 }, (_, i) => `season/${i + 1}`).join(',');
                    append += `,${seasonsAppend}`;
                }
                const res = await fetch(`${BASE_URL}/${isMovie ? 'movie' : 'tv'}/${mediaId}?api_key=${apiKey}&language=fr-FR&include_video_language=fr,en&append_to_response=${append}`);
                if (!res.ok) return;
                const fresh = await res.json();

                if (!fresh.overview) {
                    try {
                        const enRes = await fetch(`${BASE_URL}/${isMovie ? 'movie' : 'tv'}/${mediaId}?api_key=${apiKey}&language=en-US`);
                        if (enRes.ok) {
                            const enData = await enRes.json();
                            if (enData.overview) fresh.overview = enData.overview;
                        }
                    } catch (e) {}
                }

                if (!isMovie && Array.isArray(fresh.seasons)) {
                    fresh.seasons.forEach(s => {
                        if (s.season_number > 0 && fresh[`season/${s.season_number}`]?.episodes) {
                            s.episodes = fresh[`season/${s.season_number}`].episodes;
                        }
                    });
                    seriesRuntimeData = fresh;
                }

                const compacted = isMovie
                    ? (window.compactMovieForCache ? window.compactMovieForCache(fresh) : fresh)
                    : (window.compactSeriesForCache ? window.compactSeriesForCache(fresh) : fresh);

                if (window.CineDB) {
                    window.CineDB.setMedia(cacheKey, compacted);
                }

                if (!screenEl.isConnected) return;
                populateScreenFromData(fresh);

                // Rotten Tomatoes & OMDb
                if (window.fetchMediaRatings) {
                    const imdbId = fresh.external_ids?.imdb_id || fresh.imdb_id || null;
                    const r = await window.fetchMediaRatings({
                        tmdbId: mediaId,
                        type: isMovie ? 'movie' : 'tv',
                        imdbId,
                        wikidataId: fresh.external_ids?.wikidata_id || null,
                        title: fresh.title || fresh.name || '',
                        originalTitle: fresh.original_title || fresh.original_name || '',
                        year: (fresh.release_date || fresh.first_air_date || '').split('-')[0],
                        priority: true
                    });
                    if (screenEl.isConnected && r) {
                        const imdbEl = q('[data-el="score-imdb"]');
                        const rtEl = q('[data-el="score-rt"]');
                        const rtIconEl = q('[data-el="icon-rt"]');
                        const rtLinkEl = q('[data-el="rt-link"]');
                        if (imdbEl && r.imdb) imdbEl.textContent = r.imdb;
                        if (rtEl && r.rt) rtEl.textContent = r.rt;
                        if (rtIconEl && r.rt && window.getRTIconUrl) rtIconEl.src = window.getRTIconUrl(r.rt);
                        if (rtLinkEl && r.rtUrl) rtLinkEl.href = r.rtUrl;
                    }
                }
            } catch (e) {
                console.warn('[SPA] Erreur chargement détails:', e);
            }
        })();
    }

    // --- RENDU ACTEUR / PERSONNALITÉ ---
    function renderPersonScreen(screenEl, personId) {
        const cacheKey = `person-details-${personId}`;
        const cached = window.CineDB ? window.CineDB.getMediaSync(cacheKey, true) : null;
        let activeFilter = 'tout';
        let sortBy = 'popularity';
        let bioExpanded = false;
        let personData = cached || null;
        let allCredits = [];

        screenEl.innerHTML = `
            <header class="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4" style="padding-top: max(1rem, env(safe-area-inset-top));">
                <button type="button" data-action="back" class="rounded-full bg-black/55 p-2 text-white backdrop-blur-md hover:bg-black/75 active:scale-95 transition-all">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                </button>
                <button type="button" data-el="fav-btn" class="rounded-full bg-black/55 p-2 text-white backdrop-blur-md active:scale-95 transition-all flex items-center justify-center">
                    <span class="material-symbols-outlined text-2xl">bookmark</span>
                </button>
            </header>
            <main class="flex-1 overflow-y-auto no-scrollbar pb-24" style="-webkit-overflow-scrolling: touch;">
                <div class="flex flex-col items-center p-4 pt-20">
                    <img data-el="avatar" class="h-36 w-36 rounded-full object-cover shadow-xl bg-gray-800 border-2 border-white/10" src="https://placehold.co/160x160" />
                    <h1 data-el="name" class="mt-4 text-2xl font-bold text-white text-center">Chargement...</h1>
                    <div class="max-w-md text-center text-sm text-gray-400 mt-3">
                        <p data-el="bio" class="leading-relaxed"></p>
                        <button type="button" data-el="bio-toggle" class="text-primary font-semibold mt-1.5 hidden">Lire la suite</button>
                    </div>
                </div>
                <div class="px-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center space-x-1 rounded-full bg-white/5 p-1">
                            <button type="button" data-filter="tout" class="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary text-white">Tout</button>
                            <button type="button" data-filter="movie" class="px-3.5 py-1.5 rounded-full text-xs font-semibold text-gray-400">Films</button>
                            <button type="button" data-filter="tv" class="px-3.5 py-1.5 rounded-full text-xs font-semibold text-gray-400">Séries</button>
                        </div>
                        <button type="button" data-el="sort-btn" class="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs text-gray-300">
                            <span class="material-symbols-outlined text-sm">swap_vert</span>
                            <span data-el="sort-label">Popularité</span>
                        </button>
                    </div>
                    <div data-el="credits-list" class="space-y-2.5"></div>
                </div>
            </main>
        `;

        const q = (sel) => screenEl.querySelector(sel);
        q('[data-action="back"]').onclick = () => closeTopScreen();

        function updateFavBtn() {
            const favs = getSafeLocalStorage('favoriteActors', []);
            const isFav = favs.some(a => Number(a.id) === Number(personId));
            const btn = q('[data-el="fav-btn"]');
            const icon = btn.querySelector('.material-symbols-outlined');
            btn.classList.toggle('text-primary', isFav);
            icon.classList.toggle('filled', isFav);
        }

        q('[data-el="fav-btn"]').onclick = () => {
            if (!personData) return;
            const favs = getSafeLocalStorage('favoriteActors', []);
            const idx = favs.findIndex(a => Number(a.id) === Number(personId));
            if (idx > -1) favs.splice(idx, 1);
            else favs.push({ id: Number(personId), name: personData.name, profile_path: personData.profile_path });
            localStorage.setItem('favoriteActors', JSON.stringify(favs));
            updateFavBtn();
        };

        function renderBio() {
            const full = personData?.biography || 'Aucune biographie disponible.';
            const bioEl = q('[data-el="bio"]');
            const btn = q('[data-el="bio-toggle"]');
            if (full.length > 280) {
                btn.classList.remove('hidden');
                bioEl.textContent = bioExpanded ? full : full.slice(0, 280) + '...';
                btn.textContent = bioExpanded ? 'Voir moins' : 'Lire la suite';
                btn.onclick = () => {
                    bioExpanded = !bioExpanded;
                    renderBio();
                };
            } else {
                btn.classList.add('hidden');
                bioEl.textContent = full;
            }
        }

        function renderCredits() {
            let list = allCredits;
            if (activeFilter !== 'tout') {
                list = list.filter(i => i.type === activeFilter);
            }
            list = [...list].sort((a, b) => {
                if (sortBy === 'popularity') return (b.popularity || 0) - (a.popularity || 0);
                return new Date(b.date || '0000-01-01') - new Date(a.date || '0000-01-01');
            });

            const watchedMovies = getSafeLocalStorage('watchedMovies', []);
            const watchedSeries = getSafeLocalStorage('watchedSeries', []);
            const watchlist = getSafeLocalStorage('watchlist', []);

            q('[data-el="credits-list"]').innerHTML = list.map(m => {
                const href = m.type === 'movie' ? `film.html?id=${m.id}` : `serie.html?id=${m.id}`;
                const idNum = Number(m.id);
                const isWatched = (m.type === 'movie' && watchedMovies.includes(idNum)) || (m.type === 'tv' && watchedSeries.includes(idNum));
                const isWl = !isWatched && watchlist.some(w => Number(w.id) === idNum);
                const year = m.date ? m.date.split('-')[0] : 'N/A';
                return `
                    <a href="${href}" class="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/5 transition-colors">
                        <img src="${m.poster_path ? IMG_BASE_POSTER + m.poster_path : 'https://placehold.co/64x96'}" class="h-20 w-14 rounded-lg object-cover bg-gray-800 flex-shrink-0" loading="lazy" />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5">
                                <p class="font-semibold text-white text-sm truncate">${escapeHTML(m.title)}</p>
                                ${isWatched ? '<span class="material-symbols-outlined text-green-500 text-base">visibility</span>' : ''}
                                ${isWl ? '<span class="material-symbols-outlined text-primary text-base">bookmark</span>' : ''}
                            </div>
                            <p class="text-xs text-gray-400 mt-0.5 truncate">${year}${m.role ? ' • ' + escapeHTML(m.role) : ''}</p>
                        </div>
                        <span class="material-symbols-outlined text-gray-500 text-lg">chevron_right</span>
                    </a>
                `;
            }).join('');
        }

        screenEl.querySelectorAll('[data-filter]').forEach(btn => {
            btn.onclick = () => {
                activeFilter = btn.dataset.filter;
                screenEl.querySelectorAll('[data-filter]').forEach(b => {
                    const active = b.dataset.filter === activeFilter;
                    b.classList.toggle('bg-primary', active);
                    b.classList.toggle('text-white', active);
                    b.classList.toggle('text-gray-400', !active);
                });
                renderCredits();
            };
        });

        q('[data-el="sort-btn"]').onclick = () => {
            sortBy = sortBy === 'popularity' ? 'date' : 'popularity';
            q('[data-el="sort-label"]').textContent = sortBy === 'popularity' ? 'Popularité' : 'Année';
            renderCredits();
        };

        function applyPersonData(data) {
            personData = data;
            q('[data-el="name"]').textContent = data.name || '';
            if (data.profile_path) {
                q('[data-el="avatar"]').src = IMG_BASE_PROFILE + data.profile_path;
            }
            renderBio();
            updateFavBtn();

            const norm = (items, type) => {
                const map = new Map();
                (items || []).forEach(i => {
                    if (i.id && !map.has(i.id)) {
                        map.set(i.id, {
                            id: i.id,
                            title: type === 'movie' ? (i.title || i.original_title) : (i.name || i.original_name),
                            role: i.character || i.job || '',
                            poster_path: i.poster_path,
                            date: type === 'movie' ? i.release_date : i.first_air_date,
                            popularity: i.popularity || 0,
                            type
                        });
                    }
                });
                return Array.from(map.values());
            };

            const movies = norm([...(data.movie_credits?.cast || []), ...(data.movie_credits?.crew || [])], 'movie');
            const tv = norm([...(data.tv_credits?.cast || []), ...(data.tv_credits?.crew || [])], 'tv');
            allCredits = [...movies, ...tv];
            renderCredits();
        }

        if (cached) applyPersonData(cached);

        (async () => {
            try {
                const apiKey = window.TMDB_API_KEY || '';
                const res = await fetch(`${BASE_URL}/person/${personId}?api_key=${apiKey}&language=fr-FR&append_to_response=movie_credits,tv_credits`);
                if (!res.ok) return;
                const fresh = await res.json();
                if (!fresh.biography || !fresh.biography.trim()) {
                    try {
                        const enRes = await fetch(`${BASE_URL}/person/${personId}?api_key=${apiKey}&language=en-US`);
                        if (enRes.ok) {
                            const enData = await enRes.json();
                            if (enData.biography) fresh.biography = enData.biography;
                        }
                    } catch (e) {}
                }
                if (window.CineDB) window.CineDB.setMedia(cacheKey, fresh);
                if (screenEl.isConnected) applyPersonData(fresh);
            } catch (e) {}
        })();
    }

    // --- RENDU PROFIL & SOUS-ÉCRANS ---
    function renderProfileScreen(screenEl) {
        const watchlist = getSafeLocalStorage('watchlist', []);
        const watchedMovies = getSafeLocalStorage('watchedMovies', []);
        const watchedSeries = getSafeLocalStorage('watchedSeries', []);
        const watchedEpisodes = getSafeLocalStorage('watchedEpisodes', {});
        const selectedPlatforms = getSafeLocalStorage('selectedPlatforms', []);
        const favoriteActors = getSafeLocalStorage('favoriteActors', []);
        let epCount = 0;
        Object.values(watchedEpisodes).forEach(arr => { if (Array.isArray(arr)) epCount += arr.length; });
        const region = localStorage.getItem('userRegion') || 'FR';
        const user = window.firebaseUser || null;

        screenEl.innerHTML = `
            <header class="flex-shrink-0 flex items-center p-4 pb-2 justify-between bg-[#211111] border-b border-white/5" style="padding-top: max(0.75rem, env(safe-area-inset-top));">
                <button type="button" data-action="back" class="text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 class="text-lg font-bold flex-1 text-center">Mon Profil</h2>
                <div class="size-10"></div>
            </header>
            <main class="flex-1 overflow-y-auto px-4 pb-20 pt-3 space-y-6 bg-[#211111]" style="-webkit-overflow-scrolling: touch;">
                <div data-el="auth-card" class="flex flex-col items-center w-full max-w-sm mx-auto bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                    ${user ? `
                        <div class="relative">
                            <img src="${user.photoURL || 'icons/icon-192.png'}" referrerpolicy="no-referrer" class="rounded-full h-20 w-20 object-cover border-4 border-primary shadow-lg" />
                            <span class="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                        </div>
                        <p class="text-lg font-bold mt-3 text-center">${escapeHTML(user.displayName || 'Utilisateur Google')}</p>
                        <p class="text-xs text-slate-400">${escapeHTML(user.email || '')}</p>
                        <p class="text-green-400 text-xs font-medium flex items-center gap-1 mt-1.5">
                            <span class="material-symbols-outlined text-[15px]">cloud_done</span>
                            <span>Synchronisé dans le Cloud</span>
                        </p>
                        <div class="flex items-center gap-2 mt-4 w-full">
                            <button type="button" data-el="sync-btn" class="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-primary/15 text-primary rounded-xl text-xs font-semibold hover:bg-primary/25">
                                <span class="material-symbols-outlined text-base">sync</span>
                                <span>Synchroniser</span>
                            </button>
                            <button type="button" data-el="logout-btn" class="py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700">
                                Déconnexion
                            </button>
                        </div>
                    ` : `
                        <div class="rounded-full h-16 w-16 shadow-lg bg-slate-800 flex items-center justify-center">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-8 h-8" alt="Google" />
                        </div>
                        <p class="text-lg font-bold mt-3 text-center">Connexion Google Cloud</p>
                        <p class="text-slate-400 text-xs mt-1 text-center mb-3">Entrez votre adresse Google pour sauvegarder et retrouver vos listes sur tous vos appareils.</p>
                        <form data-el="email-form" class="w-full space-y-2">
                            <input type="email" data-el="email-input" required placeholder="votre.adresse@gmail.com" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary" />
                            <button type="submit" class="w-full bg-primary text-white font-semibold py-2.5 px-4 rounded-xl text-sm">Se connecter & retrouver mes listes</button>
                        </form>
                    `}
                </div>

                <div>
                    <h3 class="text-base font-bold mb-2">Mes Statistiques</h3>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div class="bg-slate-800/30 rounded-xl p-3 flex flex-col items-center border border-slate-700/30">
                            <span class="text-2xl font-bold text-primary">${watchlist.length}</span>
                            <span class="text-xs text-slate-400 mt-0.5">Dans ma liste</span>
                        </div>
                        <div class="bg-slate-800/30 rounded-xl p-3 flex flex-col items-center border border-slate-700/30">
                            <span class="text-2xl font-bold text-emerald-500">${watchedMovies.length}</span>
                            <span class="text-xs text-slate-400 mt-0.5">Films vus</span>
                        </div>
                        <div class="bg-slate-800/30 rounded-xl p-3 flex flex-col items-center border border-slate-700/30">
                            <span class="text-2xl font-bold text-blue-400">${watchedSeries.length}</span>
                            <span class="text-xs text-slate-400 mt-0.5">Séries terminées</span>
                        </div>
                        <div class="bg-slate-800/30 rounded-xl p-3 flex flex-col items-center border border-slate-700/30">
                            <span class="text-2xl font-bold text-purple-400">${epCount}</span>
                            <span class="text-xs text-slate-400 mt-0.5">Épisodes vus</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 class="text-base font-bold mb-2">Préférences</h3>
                    <div class="flex flex-col gap-1 bg-slate-800/20 rounded-xl p-2">
                        <button type="button" data-el="country-btn" class="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-700/30 w-full text-left">
                            <div class="flex items-center justify-center rounded-lg bg-slate-800 shrink-0 size-10 text-white"><span class="material-symbols-outlined">public</span></div>
                            <div class="flex flex-col flex-1">
                                <p class="text-base">Pays (Catalogue)</p>
                                <p data-el="country-label" class="text-slate-400 text-sm">${region === 'FR' ? 'France' : 'Irlande'}</p>
                            </div>
                            <img data-el="country-flag" src="https://flagcdn.com/w40/${region.toLowerCase()}.png" class="w-6 rounded-sm mr-1" />
                            <span class="material-symbols-outlined text-slate-400">chevron_right</span>
                        </button>
                        <a href="platforms.html" class="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-700/30 w-full text-left">
                            <div class="flex items-center justify-center rounded-lg bg-slate-800 shrink-0 size-10 text-white"><span class="material-symbols-outlined">filter_list</span></div>
                            <div class="flex flex-col flex-1">
                                <p class="text-base">Mes Plateformes</p>
                                <p class="text-slate-400 text-sm">${selectedPlatforms.length} sélectionnées</p>
                            </div>
                            <span class="material-symbols-outlined text-slate-400">chevron_right</span>
                        </a>
                        <a href="favorite_actors.html" class="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-700/30 w-full text-left">
                            <div class="flex items-center justify-center rounded-lg bg-slate-800 shrink-0 size-10 text-white"><span class="material-symbols-outlined">person</span></div>
                            <div class="flex flex-col flex-1">
                                <p class="text-base">Vos acteurs préférés</p>
                                <p class="text-slate-400 text-sm">${favoriteActors.length} ajoutés</p>
                            </div>
                            <span class="material-symbols-outlined text-slate-400">chevron_right</span>
                        </a>
                        <button type="button" data-el="clear-cache-btn" class="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-700/30 w-full text-left text-red-500">
                            <div class="flex items-center justify-center rounded-lg bg-red-500/10 shrink-0 size-10"><span class="material-symbols-outlined">delete</span></div>
                            <div class="flex flex-col flex-1">
                                <p class="text-base">Vider le cache</p>
                                <p class="text-slate-400 text-xs">Forcer la mise à jour des données et images</p>
                            </div>
                            <span class="material-symbols-outlined text-slate-400">chevron_right</span>
                        </button>
                    </div>
                </div>

                <!-- Sélecteur de pays rapide intégré -->
                <div data-el="country-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div class="bg-[#1a1a1a] w-full max-w-xs rounded-2xl shadow-2xl p-4 border border-white/10">
                        <h3 class="text-lg font-bold text-white mb-4 text-center">Choisir le pays</h3>
                        <div class="space-y-2">
                            <button type="button" data-country="FR" class="flex items-center w-full p-3 rounded-xl border border-gray-700 hover:bg-gray-800">
                                <img src="https://flagcdn.com/w40/fr.png" class="w-8 rounded shadow-sm mr-3" />
                                <span class="flex-1 text-left font-medium text-white">France</span>
                            </button>
                            <button type="button" data-country="IE" class="flex items-center w-full p-3 rounded-xl border border-gray-700 hover:bg-gray-800">
                                <img src="https://flagcdn.com/w40/ie.png" class="w-8 rounded shadow-sm mr-3" />
                                <span class="flex-1 text-left font-medium text-white">Irlande</span>
                            </button>
                        </div>
                        <button type="button" data-el="country-cancel" class="mt-4 w-full py-2.5 text-sm font-medium text-gray-400">Annuler</button>
                    </div>
                </div>
            </main>
        `;

        const q = (sel) => screenEl.querySelector(sel);
        q('[data-action="back"]').onclick = () => closeTopScreen();

        const emailForm = q('[data-el="email-form"]');
        if (emailForm) {
            emailForm.onsubmit = async (e) => {
                e.preventDefault();
                const email = q('[data-el="email-input"]').value.trim();
                if (!email || !window.signInWithCloudEmail) return;
                try {
                    await window.signInWithCloudEmail(email);
                    renderProfileScreen(screenEl);
                } catch (err) {
                    alert(err.message || 'Erreur de connexion');
                }
            };
        }

        const syncBtn = q('[data-el="sync-btn"]');
        if (syncBtn) {
            syncBtn.onclick = async () => {
                syncBtn.disabled = true;
                try {
                    if (window.forceCloudMerge) await window.forceCloudMerge();
                    renderProfileScreen(screenEl);
                } finally {
                    syncBtn.disabled = false;
                }
            };
        }

        const logoutBtn = q('[data-el="logout-btn"]');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                if (confirm('Voulez-vous vraiment vous déconnecter ?') && window.signOutGoogle) {
                    await window.signOutGoogle();
                    renderProfileScreen(screenEl);
                }
            };
        }

        const countryModal = q('[data-el="country-modal"]');
        q('[data-el="country-btn"]').onclick = () => countryModal.classList.remove('hidden');
        q('[data-el="country-cancel"]').onclick = () => countryModal.classList.add('hidden');

        screenEl.querySelectorAll('[data-country]').forEach(btn => {
            btn.onclick = () => {
                const code = btn.dataset.country;
                localStorage.setItem('userRegion', code);
                if (window.updateHeaderFlags) window.updateHeaderFlags();
                if (window.syncToCloud) window.syncToCloud();
                q('[data-el="country-label"]').textContent = code === 'FR' ? 'France' : 'Irlande';
                q('[data-el="country-flag"]').src = `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
                countryModal.classList.add('hidden');
            };
        });

        q('[data-el="clear-cache-btn"]').onclick = async () => {
            if (!confirm("Vider le cache des images et détails ? Vos listes et votre connexion seront conservées.")) return;
            const keysToKeep = [
                'watchlist', 'watchedMovies', 'watchedSeries', 'watchedEpisodes',
                'favoriteActors', 'selectedPlatforms', 'userRegion', 'userId',
                'anonymousId', 'seriesLastWatchedDate', 'previousSearches', 'lastCloudSync',
                'cloudUserProfile', 'localUpdatedAt'
            ];
            const toRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && !keysToKeep.includes(k)) toRemove.push(k);
            }
            toRemove.forEach(k => localStorage.removeItem(k));
            if (window.CineDB) await window.CineDB.clearAllMediaCache();
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(n => caches.delete(n)));
            }
            window.location.reload();
        };
    }

    function renderPlatformsScreen(screenEl) {
        const catalog = window.PLATFORMS_CATALOG || [];
        const selected = new Set(getSafeLocalStorage('selectedPlatforms', []));

        screenEl.innerHTML = `
            <header class="flex-shrink-0 flex items-center p-4 pb-2 justify-between bg-[#211111] border-b border-white/5" style="padding-top: max(0.75rem, env(safe-area-inset-top));">
                <button type="button" data-action="back" class="text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 class="text-lg font-bold flex-1 text-center">Mes Plateformes</h2>
                <div class="size-10"></div>
            </header>
            <main class="flex-1 overflow-y-auto p-4 pb-28 bg-[#211111]" style="-webkit-overflow-scrolling: touch;">
                <p class="text-slate-400 text-sm text-center mb-6">Sélectionnez vos plateformes de streaming pour personnaliser l'application.</p>
                <div class="grid grid-cols-3 gap-5">
                    ${catalog.map(p => `
                        <button type="button" data-plat="${p.id}" class="flex flex-col items-center gap-2 p-2 rounded-2xl border-2 transition-all ${selected.has(p.id) ? 'border-primary bg-primary/10' : 'border-white/10 opacity-60'}">
                            <img src="${p.logoUrl}" class="w-16 h-16 rounded-2xl object-cover bg-black shadow-md" />
                            <span class="text-xs font-semibold text-white text-center truncate w-full">${escapeHTML(p.name)}</span>
                        </button>
                    `).join('')}
                </div>
            </main>
            <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#211111] via-[#211111] to-transparent">
                <button type="button" data-el="save-btn" class="w-full rounded-xl bg-primary py-3.5 font-bold text-white shadow-lg">Enregistrer</button>
            </div>
        `;

        screenEl.querySelector('[data-action="back"]').onclick = () => closeTopScreen();
        screenEl.querySelectorAll('[data-plat]').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.plat;
                if (selected.has(id)) selected.delete(id);
                else selected.add(id);
                const active = selected.has(id);
                btn.classList.toggle('border-primary', active);
                btn.classList.toggle('bg-primary/10', active);
                btn.classList.toggle('border-white/10', !active);
                btn.classList.toggle('opacity-60', !active);
            };
        });

        screenEl.querySelector('[data-el="save-btn"]').onclick = () => {
            localStorage.setItem('selectedPlatforms', JSON.stringify(Array.from(selected)));
            window.dispatchEvent(new CustomEvent('watchlist-updated'));
            window.dispatchEvent(new CustomEvent('region-changed'));
            closeTopScreen();
        };
    }

    function renderFavoriteActorsScreen(screenEl) {
        const actors = getSafeLocalStorage('favoriteActors', []);
        screenEl.innerHTML = `
            <header class="flex-shrink-0 flex items-center p-4 pb-2 justify-between bg-[#211111] border-b border-white/5" style="padding-top: max(0.75rem, env(safe-area-inset-top));">
                <button type="button" data-action="back" class="text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 class="text-lg font-bold flex-1 text-center">Vos acteurs préférés</h2>
                <div class="size-10"></div>
            </header>
            <main class="flex-1 overflow-y-auto p-4 pb-24 bg-[#211111]" style="-webkit-overflow-scrolling: touch;">
                ${actors.length === 0 ? `
                    <div class="flex flex-col items-center justify-center h-64 text-gray-500">
                        <span class="material-symbols-outlined text-5xl mb-3">person_off</span>
                        <p>Aucun acteur favori.</p>
                    </div>
                ` : `
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        ${actors.map(a => `
                            <a href="person.html?id=${a.id}" class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5">
                                <img src="${a.profile_path ? IMG_BASE_PROFILE + a.profile_path : 'https://placehold.co/185x185'}" class="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-white/10" />
                                <p class="text-sm font-semibold text-white text-center truncate w-full">${escapeHTML(a.name)}</p>
                            </a>
                        `).join('')}
                    </div>
                `}
            </main>
        `;
        screenEl.querySelector('[data-action="back"]').onclick = () => closeTopScreen();
    }

    function openSpaView(rawUrl) {
        const target = parseSpaTarget(rawUrl);
        if (!target) return false;

        // Éviter d'empiler deux fois exactement la même fiche au sommet
        const currentTop = spaStack[spaStack.length - 1];
        if (currentTop && currentTop.view === target.view && currentTop.id === target.id) {
            return true;
        }

        const screenEl = createScreenShell();
        attachSwipeBackGesture(screenEl, () => closeTopScreen());

        spaStack.push({ view: target.view, id: target.id, url: target.url, el: screenEl });
        history.pushState({ spaDepth: spaStack.length, view: target.view, id: target.id }, '', window.location.href);

        if (target.view === 'movie' || target.view === 'tv') {
            renderMediaScreen(screenEl, target.view, target.id);
        } else if (target.view === 'person') {
            renderPersonScreen(screenEl, target.id);
        } else if (target.view === 'profile') {
            renderProfileScreen(screenEl);
        } else if (target.view === 'platforms') {
            renderPlatformsScreen(screenEl);
        } else if (target.view === 'favorite_actors') {
            renderFavoriteActorsScreen(screenEl);
        }

        return true;
    }

    // Intercepter tous les clics sur les liens internes (<a>) pour ouvrir en panneau iOS instantané
    document.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.target.closest('a[href]');
        if (!link) return;
        if (link.target === '_blank' || link.hasAttribute('download')) return;

        const href = link.getAttribute('href');
        const target = parseSpaTarget(href);
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            openSpaView(href);
        }
    }, true);

    window.openSpaView = openSpaView;
    window.closeSpaView = () => closeTopScreen();
    window.navigateTo = (url) => {
        if (!openSpaView(url)) {
            window.location.href = url;
        }
    };
})();
