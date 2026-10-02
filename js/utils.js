// js/utils.js

/**
 * Safely parses JSON from localStorage.
 * If the value is null, empty string, or invalid JSON, it returns the defaultValue.
 */
window.getSafeLocalStorage = function(key, defaultValue) {
    try {
        const item = localStorage.getItem(key);
        if (item === null || item === "undefined" || item === "") return defaultValue;
        return JSON.parse(item);
    } catch (e) {
        console.warn(`[Utils] Error parsing localStorage key "${key}". Resetting to default.`, e);
        return defaultValue;
    }
};

/**
 * Catalogue unifié des plateformes avec logos officiels haute disponibilité (TMDB CDN)
 * et correspondance des IDs TMDB (ex: Canal+ utilise 381 et 392 sur TMDB).
 */
window.PLATFORMS_CATALOG = [
    {
        id: 'netflix',
        apiId: 8,
        providerIds: [8, 1796],
        name: 'Netflix',
        logoUrl: 'https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456'
    },
    {
        id: 'prime',
        apiId: 119,
        providerIds: [119, 9, 2100],
        name: 'Prime Video',
        logoUrl: 'https://www.citypng.com/public/uploads/preview/amazon-prime-ios-app-icon-701751695133984u2yuon8nlu.png'
    },
    {
        id: 'disney',
        apiId: 337,
        providerIds: [337],
        name: 'Disney+',
        logoUrl: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/25357066/Disney__Logo_March_2024.png?quality=90&strip=all&crop=0,0,100,100'
    },
    {
        id: 'apple',
        apiId: 350,
        providerIds: [350, 2],
        name: 'Apple TV+',
        logoUrl: 'https://image.tmdb.org/t/p/original/9icYBfYFcwgCbky5VdGUIKJ4C5i.png'
    },
    {
        id: 'canal',
        apiId: '381|392',
        providerIds: [381, 392],
        name: 'Canal+',
        logoUrl: 'https://static1.purepeople.com/articles/0/46/23/10/@/6655765-logo-de-la-chaine-canal-1200x0-2.png'
    },
    {
        id: 'paramount',
        apiId: 531,
        providerIds: [531, 582, 1853, 2303],
        name: 'Paramount+',
        logoUrl: 'https://image.tmdb.org/t/p/original/pkx3klJlwW5JdtaulvDx6hDNtch.png'
    },
    {
        id: 'max',
        apiId: 1899,
        providerIds: [1899, 1825, 384],
        name: 'Max',
        logoUrl: 'https://image.tmdb.org/t/p/original/skypuy7SXuugIQeYg0IglmzoKaS.png'
    },
    {
        id: 'crunchyroll',
        apiId: 283,
        providerIds: [283, 1968],
        name: 'Crunchyroll',
        logoUrl: 'https://image.tmdb.org/t/p/original/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png'
    },
    {
        id: 'arte',
        apiId: 234,
        providerIds: [234],
        name: 'Arte',
        logoUrl: 'https://image.tmdb.org/t/p/original/ieo2l4zOaljYqJNGxWY8jWryld5.png'
    },
    {
        id: 'rakuten',
        apiId: 35,
        providerIds: [35],
        name: 'Rakuten TV',
        logoUrl: 'https://image.tmdb.org/t/p/original/872dfVu1biZISJ8rO143CZZutPR.png'
    },
    {
        id: 'pluto',
        apiId: 300,
        providerIds: [300],
        name: 'Pluto TV',
        logoUrl: 'https://image.tmdb.org/t/p/original/fN4czqaMQNLeF6sSSIjGbAWzvwK.png'
    },
    {
        id: 'skygo',
        apiId: 29,
        providerIds: [29, 130],
        name: 'Sky Go',
        logoUrl: 'https://image.tmdb.org/t/p/original/1Yvl9eP3pmktqChitnFhHJHcBtX.png'
    },
    {
        id: 'now',
        apiId: 39,
        providerIds: [39],
        name: 'Now',
        logoUrl: 'https://image.tmdb.org/t/p/original/oFAnvlaEW2KT6J7XM0DXjlWqKu9.png'
    }
];

window.getInternalPlatformId = function(tmdbName = '', providerId = null) {
    if (providerId) {
        const byId = window.PLATFORMS_CATALOG.find(p => p.providerIds.includes(Number(providerId)));
        if (byId) return byId.id;
    }
    const lower = String(tmdbName).toLowerCase();
    if (lower.includes('netflix')) return 'netflix';
    if (lower.includes('amazon') || lower.includes('prime')) return 'prime';
    if (lower.includes('disney')) return 'disney';
    if (lower.includes('apple')) return 'apple';
    if (lower.includes('canal')) return 'canal';
    if (lower.includes('paramount')) return 'paramount';
    if (lower.includes('max') || lower.includes('hbo')) return 'max';
    if (lower.includes('crunchyroll')) return 'crunchyroll';
    if (lower.includes('arte')) return 'arte';
    if (lower.includes('rakuten')) return 'rakuten';
    if (lower.includes('pluto')) return 'pluto';
    if (lower.includes('sky')) return 'skygo';
    if (lower.includes('now')) return 'now';
    return 'other';
};

/**
 * Réduit la taille d'un objet Film ou Série TMDB avant mise en cache dans localStorage
 * (divise la taille par ~30 à 50 pour éviter toute erreur QuotaExceededError).
 */
window.compactProviders = function(providersObj) {
    if (!providersObj || !providersObj.results) return { results: {} };
    const results = {};
    ['FR', 'IE', 'US', 'GB'].forEach(region => {
        if (providersObj.results[region]) {
            const r = providersObj.results[region];
            results[region] = {
                link: r.link,
                flatrate: (r.flatrate || []).map(p => ({
                    provider_id: p.provider_id,
                    provider_name: p.provider_name,
                    logo_path: p.logo_path
                })),
                rent: (r.rent || []).slice(0, 4).map(p => ({
                    provider_id: p.provider_id,
                    provider_name: p.provider_name,
                    logo_path: p.logo_path
                })),
                buy: (r.buy || []).slice(0, 4).map(p => ({
                    provider_id: p.provider_id,
                    provider_name: p.provider_name,
                    logo_path: p.logo_path
                }))
            };
        }
    });
    return { results };
};

window.compactMovieForCache = function(data) {
    if (!data || data.error) return data;
    return {
        id: data.id,
        title: data.title,
        original_title: data.original_title,
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path,
        release_date: data.release_date,
        runtime: data.runtime,
        vote_average: data.vote_average,
        overview: data.overview,
        genres: (data.genres || []).map(g => ({ id: g.id, name: g.name })),
        'watch/providers': window.compactProviders(data['watch/providers']),
        imdb_id: data.imdb_id || (data.external_ids ? data.external_ids.imdb_id : undefined),
        external_ids: data.external_ids ? {
            imdb_id: data.external_ids.imdb_id || data.imdb_id,
            wikidata_id: data.external_ids.wikidata_id
        } : undefined,
        credits: data.credits ? {
            crew: (data.credits.crew || []).filter(c => c.job === 'Director').slice(0, 2).map(c => ({
                id: c.id, name: c.name, job: c.job, profile_path: c.profile_path
            })),
            cast: (data.credits.cast || []).slice(0, 16).map(c => ({
                id: c.id, name: c.name, character: c.character, profile_path: c.profile_path
            }))
        } : undefined,
        videos: data.videos ? {
            results: (data.videos.results || []).filter(v => v.site === 'YouTube').slice(0, 5).map(v => ({
                key: v.key, name: v.name, site: v.site, type: v.type
            }))
        } : undefined,
        similar: data.similar ? {
            results: (data.similar.results || []).slice(0, 12).map(s => ({
                id: s.id, title: s.title, name: s.name, poster_path: s.poster_path
            }))
        } : undefined
    };
};

window.compactSeriesForCache = function(data) {
    if (!data || data.error) return data;
    const compactSeason = (s) => {
        if (!s) return s;
        const rawEpisodes = Array.isArray(s.episodes)
            ? s.episodes
            : (data[`season/${s.season_number}`] && Array.isArray(data[`season/${s.season_number}`].episodes)
                ? data[`season/${s.season_number}`].episodes
                : undefined);
        return {
            id: s.id,
            season_number: s.season_number,
            name: s.name,
            air_date: s.air_date,
            episode_count: s.episode_count || (rawEpisodes ? rawEpisodes.length : 0),
            episodes: Array.isArray(rawEpisodes) ? rawEpisodes.map(e => ({
                id: e.id,
                name: e.name,
                episode_number: e.episode_number,
                season_number: e.season_number || s.season_number,
                air_date: e.air_date,
                runtime: e.runtime
            })) : undefined
        };
    };

    return {
        id: data.id,
        name: data.name,
        original_name: data.original_name,
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path,
        first_air_date: data.first_air_date,
        last_air_date: data.last_air_date,
        status: data.status,
        number_of_seasons: data.number_of_seasons,
        number_of_episodes: data.number_of_episodes,
        vote_average: data.vote_average,
        overview: data.overview ? data.overview.slice(0, 600) : '',
        genres: (data.genres || []).map(g => ({ id: g.id, name: g.name })),
        created_by: (data.created_by || []).slice(0, 2).map(c => ({
            id: c.id, name: c.name, profile_path: c.profile_path
        })),
        next_episode_to_air: data.next_episode_to_air ? {
            id: data.next_episode_to_air.id,
            name: data.next_episode_to_air.name,
            air_date: data.next_episode_to_air.air_date,
            episode_number: data.next_episode_to_air.episode_number,
            season_number: data.next_episode_to_air.season_number
        } : null,
        last_episode_to_air: data.last_episode_to_air ? {
            id: data.last_episode_to_air.id,
            name: data.last_episode_to_air.name,
            air_date: data.last_episode_to_air.air_date,
            episode_number: data.last_episode_to_air.episode_number,
            season_number: data.last_episode_to_air.season_number
        } : null,
        seasons: Array.isArray(data.seasons)
            ? data.seasons.filter(s => s && s.season_number > 0).map(compactSeason)
            : [],
        'watch/providers': window.compactProviders(data['watch/providers']),
        external_ids: data.external_ids ? {
            imdb_id: data.external_ids.imdb_id,
            wikidata_id: data.external_ids.wikidata_id
        } : undefined
    };
};

// --- GESTIONNAIRE INTELLIGENT DE QUOTA LOCALSTORAGE (LRU) ---
const originalSetItem = localStorage.setItem;

localStorage.setItem = function(key, value) {
    try {
        originalSetItem.call(localStorage, key, value);
    } catch (error) {
        console.warn("📦 Stockage saturé : nettoyage des entrées de cache les plus anciennes...");
        const cacheEntries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('movie-details-') || k.startsWith('series-details-'))) {
                let ts = 0;
                try {
                    const parsed = JSON.parse(localStorage.getItem(k));
                    ts = parsed && parsed.timestamp ? parsed.timestamp : 0;
                } catch (e) {}
                cacheEntries.push({ key: k, timestamp: ts });
            }
        }
        // Trier du plus ancien au plus récent et supprimer la moitié la plus ancienne
        cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = Math.max(5, Math.ceil(cacheEntries.length / 2));
        cacheEntries.slice(0, toDelete).forEach(entry => localStorage.removeItem(entry.key));

        try {
            originalSetItem.call(localStorage, key, value);
        } catch (e2) {
            // En dernier recours, vider tous les détails cachés
            cacheEntries.forEach(entry => localStorage.removeItem(entry.key));
            try {
                originalSetItem.call(localStorage, key, value);
            } catch (e3) {
                console.warn("⚠️ Stockage local plein, l'élément restera uniquement en mémoire vive pour cette session.", key);
            }
        }
    }
};

// --- MOTEUR MULTI-SOURCES ROTTEN TOMATOES & IMDB (AVEC CACHE 30 JOURS) ---
(function() {
    const RT_CACHE_KEY = 'rtRatingsCacheV1';
    const RT_FRESH_ICON = 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg';
    const RT_ROTTEN_ICON = 'https://upload.wikimedia.org/wikipedia/commons/5/52/Rotten_Tomatoes_rotten.svg';
    const OMDB_API_KEY = '9472c454';

    let ratingsMemoryCache = null;
    const inFlightRatings = new Map();

    function loadRatingsCache() {
        if (ratingsMemoryCache) return ratingsMemoryCache;
        ratingsMemoryCache = window.getSafeLocalStorage(RT_CACHE_KEY, {});
        // Pré-remplir avec les données statiques de data.js si disponibles
        if (typeof mediaData !== 'undefined' && Array.isArray(mediaData)) {
            mediaData.forEach(m => {
                if (!m || !m.id) return;
                const normType = (m.type === 'tv' || m.type === 'serie') ? 'tv' : 'movie';
                const key = `${normType}-${m.id}`;
                if (!ratingsMemoryCache[key] && m.rottenTomatoes && m.rottenTomatoes !== 'xx' && m.rottenTomatoes !== 'N/A') {
                    const rtVal = String(m.rottenTomatoes).includes('%') ? String(m.rottenTomatoes) : `${m.rottenTomatoes}%`;
                    ratingsMemoryCache[key] = {
                        imdb: (m.imdb && m.imdb !== 'xx') ? String(m.imdb) : null,
                        rt: rtVal,
                        rtUrl: null,
                        ts: Date.now()
                    };
                }
            });
        }
        return ratingsMemoryCache;
    }

    function saveRatingsCache() {
        if (!ratingsMemoryCache) return;
        try {
            localStorage.setItem(RT_CACHE_KEY, JSON.stringify(ratingsMemoryCache));
        } catch (e) {}
    }

    window.getRTIconUrl = function(rtScoreStr) {
        if (!rtScoreStr || rtScoreStr === '--') return RT_FRESH_ICON;
        const num = parseInt(String(rtScoreStr).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num < 60) return RT_ROTTEN_ICON;
        return RT_FRESH_ICON;
    };

    window.createRTBadgeHTML = function(rtScoreStr, size = 'xs') {
        if (!rtScoreStr || rtScoreStr === '--' || rtScoreStr === 'xx' || rtScoreStr === 'N/A') return '';
        const formatted = String(rtScoreStr).includes('%') ? rtScoreStr : `${rtScoreStr}%`;
        const iconUrl = window.getRTIconUrl(formatted);
        const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
        const textSize = size === 'sm' ? 'text-xs' : 'text-[10px]';
        return `<span class="inline-flex items-center gap-0.5 ${textSize} font-semibold text-gray-200" title="Rotten Tomatoes"><img src="${iconUrl}" onerror="this.onerror=null;this.src='${RT_FRESH_ICON}'" alt="RT" class="${iconSize} object-contain shrink-0">${formatted}</span>`;
    };

    window.getCachedMediaRatings = function(tmdbId, type = 'movie') {
        const cache = loadRatingsCache();
        const normType = (type === 'tv' || type === 'serie') ? 'tv' : 'movie';
        return cache[`${normType}-${tmdbId}`] || null;
    };

    function normalizeRTScore(raw) {
        if (!raw) return null;
        const str = String(raw).trim();
        const pctMatch = str.match(/(\d{1,3})\s*%/);
        if (pctMatch) {
            const val = parseInt(pctMatch[1], 10);
            if (val >= 0 && val <= 100) return `${val}%`;
        }
        const slash100 = str.match(/^(\d{1,3})(?:\.\d+)?\s*\/\s*100$/);
        if (slash100) {
            const val = Math.round(parseFloat(slash100[1]));
            if (val >= 0 && val <= 100) return `${val}%`;
        }
        return null;
    }

    function buildSlugCandidates(title, originalTitle, year, isTv) {
        const prefix = isTv ? 'tv' : 'm';
        const candidates = [];
        const addSlug = (rawTitle, includeYear) => {
            if (!rawTitle) return;
            const slug = String(rawTitle)
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/['’":!?,.\-&()]/g, ' ')
                .trim()
                .replace(/\s+/g, '_');
            if (!slug) return;
            if (includeYear && year) {
                candidates.push(`${prefix}/${slug}_${year}`);
            }
            candidates.push(`${prefix}/${slug}`);
        };
        addSlug(originalTitle, false);
        addSlug(originalTitle, true);
        if (title && title !== originalTitle) {
            addSlug(title, false);
        }
        return [...new Set(candidates)];
    }

    async function fetchFromWikidata({ imdbId, wikidataId, tmdbId, isTv }) {
        try {
            const clauses = [];
            if (wikidataId && /^Q\d+$/.test(wikidataId)) {
                clauses.push(`{ VALUES ?item { wd:${wikidataId} } }`);
            }
            if (imdbId && /^tt\d+$/.test(imdbId)) {
                clauses.push(`{ ?item wdt:P345 "${imdbId}" }`);
            }
            if (tmdbId) {
                const prop = isTv ? 'P4983' : 'P4947';
                clauses.push(`{ ?item wdt:${prop} "${tmdbId}" }`);
            }
            if (clauses.length === 0) return { rt: null, rtId: null };

            const sparql = `SELECT ?rtId ?score WHERE { ${clauses.join(' UNION ')} OPTIONAL { ?item wdt:P1258 ?rtId. } OPTIONAL { ?item p:P444 ?stat. ?stat ps:P444 ?score; pq:P447 wd:Q105584. } } LIMIT 5`;
            const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
            const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
            if (!res.ok) return { rt: null, rtId: null };

            const data = await res.json();
            const bindings = data?.results?.bindings || [];
            let rt = null;
            let rtId = null;
            for (const b of bindings) {
                if (!rtId && b.rtId?.value) {
                    rtId = b.rtId.value.replace(/^\/+/, '');
                }
                if (!rt && b.score?.value) {
                    rt = normalizeRTScore(b.score.value);
                }
            }
            return { rt, rtId };
        } catch (e) {
            return { rt: null, rtId: null };
        }
    }

    function extractRTScoreFromHTML(html) {
        if (!html || typeof html !== 'string') return null;
        const patterns = [
            /"criticsScore"\s*:\s*\{[^}]*?"score"\s*:\s*"(\d{1,3})"/i,
            /"tomatometerScore"\s*:\s*\{[^}]*?"score"\s*:\s*"(\d{1,3})"/i,
            /slot="criticsScore"[^>]*>\s*(\d{1,3})\s*%/i,
            /"aggregateRating"\s*:\s*\{[^}]*?"ratingValue"\s*:\s*"?(\d{1,3})(?:\.\d+)?"?/i,
            /tomatometerscore="(\d{1,3})"/i
        ];
        for (const regex of patterns) {
            const m = html.match(regex);
            if (m && m[1]) {
                const num = parseInt(m[1], 10);
                if (num >= 0 && num <= 100) return `${num}%`;
            }
        }
        return null;
    }

    async function fetchRTPageScore(rtSlug) {
        if (!rtSlug) return null;
        const cleanSlug = rtSlug.replace(/^\/+/, '');
        if (!cleanSlug.startsWith('m/') && !cleanSlug.startsWith('tv/')) return null;

        const targetUrl = `https://www.rottentomatoes.com/${cleanSlug}`;
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
        ];

        for (const proxyUrl of proxies) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 4500);
                const res = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timer);
                if (!res.ok) continue;

                let html = '';
                if (proxyUrl.includes('allorigins.win')) {
                    const json = await res.json();
                    html = json?.contents || '';
                } else {
                    html = await res.text();
                }

                const score = extractRTScoreFromHTML(html);
                if (score) return { rt: score, rtUrl: targetUrl };
            } catch (e) {}
        }
        return null;
    }

    // File d'attente légère pour les requêtes de notes en arrière-plan
    let activeRatingTasks = 0;
    const MAX_CONCURRENT_RATINGS = 3;
    const ratingQueue = [];

    function runNextRatingTask() {
        if (activeRatingTasks >= MAX_CONCURRENT_RATINGS || ratingQueue.length === 0) return;
        activeRatingTasks++;
        const next = ratingQueue.shift();
        next.fn()
            .then(next.resolve)
            .catch(next.reject)
            .finally(() => {
                activeRatingTasks--;
                setTimeout(runNextRatingTask, 60);
            });
    }

    function enqueueRatingTask(fn, priority = false) {
        return new Promise((resolve, reject) => {
            if (priority) {
                ratingQueue.unshift({ fn, resolve, reject });
            } else {
                ratingQueue.push({ fn, resolve, reject });
            }
            runNextRatingTask();
        });
    }

    window.fetchMediaRatings = async function(options = {}) {
        const {
            tmdbId = null,
            type = 'movie',
            imdbId: initialImdbId = null,
            wikidataId: initialWikidataId = null,
            title = '',
            originalTitle = '',
            year = '',
            priority = false
        } = options;

        const isTv = (type === 'tv' || type === 'serie');
        const normType = isTv ? 'tv' : 'movie';
        const cacheKey = tmdbId ? `${normType}-${tmdbId}` : (initialImdbId ? `imdb-${initialImdbId}` : null);
        if (!cacheKey) return { imdb: null, rt: null, rtUrl: null };

        const cache = loadRatingsCache();
        const existing = cache[cacheKey];
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (existing && existing.ts) {
            const age = Date.now() - existing.ts;
            if (existing.rt && age < THIRTY_DAYS) {
                return existing;
            }
            if (!existing.rt && existing.imdb && age < ONE_DAY && !priority) {
                return existing;
            }
        }

        if (inFlightRatings.has(cacheKey)) {
            return inFlightRatings.get(cacheKey);
        }

        const promise = enqueueRatingTask(async () => {
            let imdbId = initialImdbId;
            let wikidataId = initialWikidataId;
            let resolvedTitle = title;
            let resolvedOriginalTitle = originalTitle;
            let resolvedYear = String(year || '').split('-')[0].trim();

            // 0. Vérifier dans le cache local des détails TMDB si disponible
            if (tmdbId && (!imdbId || !resolvedOriginalTitle)) {
                const detailCacheKey = isTv ? `series-details-${tmdbId}` : `movie-details-${tmdbId}`;
                const cachedDetail = window.getSafeLocalStorage(detailCacheKey, null);
                const payload = cachedDetail?.data || cachedDetail;
                if (payload) {
                    imdbId = imdbId || payload.imdb_id || payload.external_ids?.imdb_id || null;
                    wikidataId = wikidataId || payload.external_ids?.wikidata_id || null;
                    resolvedTitle = resolvedTitle || payload.title || payload.name || '';
                    resolvedOriginalTitle = resolvedOriginalTitle || payload.original_title || payload.original_name || '';
                    const dateStr = payload.release_date || payload.first_air_date || '';
                    if (!resolvedYear && dateStr) resolvedYear = dateStr.split('-')[0];
                }
            }

            // Si imdbId est toujours inconnu et qu'on a tmdbId, interroger TMDB external_ids
            if (tmdbId && !imdbId && window.TMDB_API_KEY) {
                try {
                    const extRes = await fetch(`https://api.themoviedb.org/3/${normType}/${tmdbId}/external_ids?api_key=${window.TMDB_API_KEY}`);
                    if (extRes.ok) {
                        const extData = await extRes.json();
                        imdbId = extData.imdb_id || imdbId;
                        wikidataId = extData.wikidata_id || wikidataId;
                    }
                } catch (e) {}
            }

            let imdbScore = existing?.imdb || null;
            let rtScore = existing?.rt || null;
            let rtUrl = existing?.rtUrl || null;

            // 1. OMDb API (par IMDb ID puis par Titre original en fallback)
            const parseOMDb = (omdbData) => {
                if (!omdbData || omdbData.Response !== 'True') return;
                if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
                    imdbScore = omdbData.imdbRating;
                }
                if (Array.isArray(omdbData.Ratings)) {
                    const rtObj = omdbData.Ratings.find(r => r.Source === 'Rotten Tomatoes');
                    if (rtObj && rtObj.Value) {
                        rtScore = normalizeRTScore(rtObj.Value) || rtObj.Value;
                    }
                }
            };

            if (imdbId) {
                try {
                    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`);
                    if (res.ok) parseOMDb(await res.json());
                } catch (e) {}
            }

            if (!rtScore && (resolvedOriginalTitle || resolvedTitle)) {
                try {
                    const qTitle = encodeURIComponent(resolvedOriginalTitle || resolvedTitle);
                    const yParam = resolvedYear ? `&y=${resolvedYear}` : '';
                    const tParam = `&type=${isTv ? 'series' : 'movie'}`;
                    const res = await fetch(`https://www.omdbapi.com/?t=${qTitle}${yParam}${tParam}&apikey=${OMDB_API_KEY}`);
                    if (res.ok) parseOMDb(await res.json());
                } catch (e) {}
            }

            // 2. MDBList API (si l'utilisateur a configuré une clé MDBList)
            const mdblistKey = window.MDBLIST_API_KEY || localStorage.getItem('mdblistApiKey');
            if (!rtScore && mdblistKey && (tmdbId || imdbId)) {
                try {
                    const mParam = isTv ? 'show' : 'movie';
                    const idParam = imdbId ? `i=${imdbId}` : `tm=${tmdbId}`;
                    const res = await fetch(`https://mdblist.com/api/?apikey=${mdblistKey}&${idParam}&m=${mParam}`);
                    if (res.ok) {
                        const mdbData = await res.json();
                        if (Array.isArray(mdbData.ratings)) {
                            const rtItem = mdbData.ratings.find(r => r.source === 'tomatoes' && r.value);
                            if (rtItem) rtScore = `${rtItem.value}%`;
                            const imdbItem = mdbData.ratings.find(r => r.source === 'imdb' && r.value);
                            if (!imdbScore && imdbItem) imdbScore = String(imdbItem.value);
                        }
                    }
                } catch (e) {}
            }

            // 3. Wikidata SPARQL (récupère le score RT P444 ET le slug officiel RT P1258, indispensable pour les séries TV)
            let rtSlug = null;
            if (!rtScore || !rtUrl) {
                const wiki = await fetchFromWikidata({ imdbId, wikidataId, tmdbId, isTv });
                if (!rtScore && wiki.rt) rtScore = wiki.rt;
                if (wiki.rtId) {
                    rtSlug = wiki.rtId;
                    rtUrl = `https://www.rottentomatoes.com/${wiki.rtId}`;
                }
            }

            // 4. Si le score RT manque toujours (fréquent sur les séries TV où Wikidata a le lien P1258 mais pas le % P444),
            //    extraire le Tomatometer depuis la page Rotten Tomatoes correspondante
            if (!rtScore) {
                const slugsToTry = rtSlug
                    ? [rtSlug]
                    : buildSlugCandidates(resolvedTitle, resolvedOriginalTitle, resolvedYear, isTv).slice(0, 2);

                for (const candidateSlug of slugsToTry) {
                    const pageResult = await fetchRTPageScore(candidateSlug);
                    if (pageResult && pageResult.rt) {
                        rtScore = pageResult.rt;
                        rtUrl = pageResult.rtUrl;
                        break;
                    }
                }
            }

            const result = {
                imdb: imdbScore || null,
                rt: rtScore || null,
                rtUrl: rtUrl || null,
                ts: Date.now()
            };

            cache[cacheKey] = result;
            if (imdbId) cache[`imdb-${imdbId}`] = result;
            saveRatingsCache();

            window.dispatchEvent(new CustomEvent('rt-rating-loaded', {
                detail: { tmdbId: Number(tmdbId), type: normType, ...result }
            }));

            return result;
        }, priority).finally(() => {
            inFlightRatings.delete(cacheKey);
        });

        inFlightRatings.set(cacheKey, promise);
        return promise;
    };
})();

