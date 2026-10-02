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
        external_ids: data.external_ids ? { imdb_id: data.external_ids.imdb_id } : undefined,
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
        external_ids: data.external_ids ? { imdb_id: data.external_ids.imdb_id } : undefined
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
