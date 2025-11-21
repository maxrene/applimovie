const fs = require('fs');
const path = require('path');

// Configuration
// REMPLACEZ CECI PAR VOTRE CLÉ API TMDB
const API_KEY = process.env.TMDB_API_KEY || 'f1b07b5d2ac7a9f55c5b49a93b18bd33'; 

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const IMG_BASE_BANNER = 'https://image.tmdb.org/t/p/original';
const IMG_BASE_PROFILE = 'https://image.tmdb.org/t/p/w185';
const PLACEHOLDER_IMG = 'https://placehold.co/64x64';

// User-Agent pour le scraping (IMDb/RT)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Helper to fetch data from API
async function fetchData(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', API_KEY);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return null;
    }
}

// Helper to scrape IMDb
async function getImdbRating(imdbId) {
    if (!imdbId) return "xx";

    const url = `https://www.imdb.com/title/${imdbId}/`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) return "xx";

        const text = await res.text();

        // Try to find JSON-LD
        const jsonLdMatch = text.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
        if (jsonLdMatch) {
            try {
                const json = JSON.parse(jsonLdMatch[1]);
                if (json.aggregateRating?.ratingValue) {
                    return String(json.aggregateRating.ratingValue);
                }
            } catch (e) {}
        }

        // Fallback regex
        const ratingMatch = text.match(/"ratingValue":\s*"([\d.]+)"/);
        if (ratingMatch) return ratingMatch[1];

        return "xx";
    } catch (e) {
        console.error(`Error scraping IMDb for ${imdbId}:`, e.message);
        return "xx";
    }
}

// Helper to scrape Rotten Tomatoes
async function getRtRating(title, type, year) {
    let slug = title.toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9\s]/g, '') 
        .trim()
        .replace(/\s+/g, '_');

    const prefix = type === 'movie' ? 'm' : 'tv';
    const url = `https://www.rottentomatoes.com/${prefix}/${slug}`;

    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) return "xx";

        const text = await res.text();
        const scoreMatch = text.match(/<rt-text[^>]*slot="tomatometerScore"[^>]*>(\d+)%<\/rt-text>/i);
        if (scoreMatch) return scoreMatch[1];

        const jsonMatch = text.match(/"tomatometerScore":\s*(\d+)/);
        if (jsonMatch) return jsonMatch[1];

        return "xx";
    } catch (e) {
        return "xx";
    }
}

// Fetch Genres
async function fetchGenres() {
    const movieGenres = await fetchData('/genre/movie/list');
    const tvGenres = await fetchData('/genre/tv/list');
    const genresMap = {};

    if (movieGenres?.genres) movieGenres.genres.forEach(g => genresMap[g.id] = g.name);
    if (tvGenres?.genres) tvGenres.genres.forEach(g => genresMap[g.id] = g.name);

    return genresMap;
}

// Fetch Movies
async function fetchMovies(genresMap) {
    // Récupère les films populaires
    const data = await fetchData('/movie/popular', { page: 1 });
    if (!data?.results) return [];

    const movies = data.results.slice(0, 12); // On prend les 12 premiers
    const processedMovies = [];

    for (const movie of movies) {
        console.log(`Processing movie: ${movie.title}`);
        
        // On demande plus d'infos : credits (cast/crew), external_ids (imdb), similar (films similaires), watch/providers (streaming)
        const details = await fetchData(`/movie/${movie.id}`, { 
            append_to_response: 'credits,external_ids,similar,watch/providers' 
        });

        // 1. DIRECTOR
        const director = details.credits?.crew?.find(c => c.job === 'Director');
        const directorName = director ? director.name : 'Unknown';
        const directorImage = director?.profile_path ? `${IMG_BASE_PROFILE}${director.profile_path}` : PLACEHOLDER_IMG;

        // 2. CAST (Top 4)
        const cast = details.credits?.cast?.slice(0, 4).map(actor => ({
            name: actor.name,
            character: actor.character,
            imageUrl: actor.profile_path ? `${IMG_BASE_PROFILE}${actor.profile_path}` : PLACEHOLDER_IMG
        })) || [];

        // 3. SIMILAR MOVIES (Top 4)
        const similarMovies = details.similar?.results?.slice(0, 4).map(sim => ({
            id: sim.id,
            title: sim.title,
            posterUrl: sim.poster_path ? `${IMG_BASE_POSTER}${sim.poster_path}` : PLACEHOLDER_IMG
        })) || [];

        // 4. STREAMING AVAILABILITY (Targeting IE region - Ireland)
        const countryCode = 'IE';
        const providersData = details['watch/providers']?.results?.[countryCode]?.flatrate || [];
        const availableOn = providersData.map(p => ({
            name: p.provider_name,
            logoUrl: p.logo_path ? `${IMG_BASE_PROFILE}${p.logo_path}` : PLACEHOLDER_IMG
        }));

        // Runtime formatting
        const hours = Math.floor(details.runtime / 60);
        const minutes = details.runtime % 60;
        const duration = `${hours}h ${minutes}m`;

        // Ratings
        const imdbId = details.external_ids?.imdb_id;
        const realImdb = await getImdbRating(imdbId);
        const realRt = await getRtRating(movie.title, 'movie', parseInt(movie.release_date?.split('-')[0]));

        processedMovies.push({
            id: movie.id,
            type: 'movie',
            title: movie.title,
            year: parseInt(movie.release_date?.split('-')[0] || 0),
            genres: movie.genre_ids.map(id => genresMap[id]).filter(Boolean),
            duration: duration,
            imdb: realImdb,
            rottenTomatoes: realRt,
            synopsis: movie.overview,
            posterUrl: movie.poster_path ? `${IMG_BASE_POSTER}${movie.poster_path}` : PLACEHOLDER_IMG,
            bannerUrl: movie.backdrop_path ? `${IMG_BASE_BANNER}${movie.backdrop_path}` : PLACEHOLDER_IMG,
            director: { name: directorName, imageUrl: directorImage },
            cast: cast,
            similarMovies: similarMovies,
            availableOn: availableOn
        });
    }
    return processedMovies;
}

// Fetch Series
async function fetchSeries(genresMap) {
    const data = await fetchData('/tv/popular', { page: 1 });
    if (!data?.results) return [];

    const series = data.results.slice(0, 10);
    const processedSeries = [];

    for (const show of series) {
        console.log(`Processing serie: ${show.name}`);
        const details = await fetchData(`/tv/${show.id}`, { 
            append_to_response: 'credits,external_ids,watch/providers' 
        });

        // CREATOR
        let creatorName = 'Unknown';
        let creatorImage = PLACEHOLDER_IMG;
        if (details.created_by && details.created_by.length > 0) {
            creatorName = details.created_by[0].name;
            if (details.created_by[0].profile_path) {
                creatorImage = `${IMG_BASE_PROFILE}${details.created_by[0].profile_path}`;
            }
        }

        // CAST
        const cast = details.credits?.cast?.slice(0, 4).map(actor => ({
            name: actor.name,
            character: actor.character,
            imageUrl: actor.profile_path ? `${IMG_BASE_PROFILE}${actor.profile_path}` : PLACEHOLDER_IMG
        })) || [];

        // STREAMING (IE - Ireland)
        const countryCode = 'IE';
        const providersData = details['watch/providers']?.results?.[countryCode]?.flatrate || [];
        const availableOn = providersData.map(p => ({
            name: p.provider_name,
            logoUrl: p.logo_path ? `${IMG_BASE_PROFILE}${p.logo_path}` : PLACEHOLDER_IMG
        }));

        // Ratings
        const imdbId = details.external_ids?.imdb_id;
        const realImdb = await getImdbRating(imdbId);
        const realRt = await getRtRating(show.name, 'serie', parseInt(show.first_air_date?.split('-')[0]));

        processedSeries.push({
            id: show.id,
            type: 'serie',
            title: show.name,
            year: parseInt(show.first_air_date?.split('-')[0] || 0),
            genres: show.genre_ids.map(id => genresMap[id]).filter(Boolean),
            seasons: details.number_of_seasons,
            imdb: realImdb,
            rottenTomatoes: realRt,
            synopsis: show.overview,
            posterUrl: show.poster_path ? `${IMG_BASE_POSTER}${show.poster_path}` : PLACEHOLDER_IMG,
            bannerUrl: show.backdrop_path ? `${IMG_BASE_BANNER}${show.backdrop_path}` : PLACEHOLDER_IMG,
            creator: { name: creatorName, imageUrl: creatorImage },
            cast: cast,
            availableOn: availableOn
        });
    }
    return processedSeries;
}

async function main() {
    console.log("Fetching genres...");
    const genresMap = await fetchGenres();

    console.log("Fetching movies...");
    const movies = await fetchMovies(genresMap);

    console.log("Fetching series...");
    const series = await fetchSeries(genresMap);

    const mediaData = [...movies, ...series];

    const fileContent = `// data.js
// Generated from TMDB API and scraped from IMDb/RT
const mediaData = ${JSON.stringify(mediaData, null, 2)};
`;

    fs.writeFileSync('data.js', fileContent);
    console.log(`Successfully updated data.js with ${mediaData.length} items.`);
}

main();
