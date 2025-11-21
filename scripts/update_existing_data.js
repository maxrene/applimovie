
const fs = require('fs');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Helper to scrape IMDb ID from search
async function getImdbId(title, year) {
    const query = `${title} ${year}`;
    const url = `https://www.imdb.com/find/?q=${encodeURIComponent(query)}`;

    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) return null;
        const text = await res.text();

        // Find first tt ID
        const match = text.match(/\/title\/(tt\d+)\//);
        return match ? match[1] : null;
    } catch (e) {
        console.error(`Error searching IMDb for ${title}:`, e.message);
        return null;
    }
}

// Helper to scrape IMDb Rating
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
            } catch (e) {
                // ignore
            }
        }

        // Fallback regex
        const ratingMatch = text.match(/"ratingValue":\s*"([\d.]+)"/);
        if (ratingMatch) return ratingMatch[1];

        return "xx";
    } catch (e) {
        console.error(`Error scraping IMDb rating for ${imdbId}:`, e.message);
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
        if (!res.ok) return "xx"; // 404 or other

        const text = await res.text();

        // <rt-text slot="tomatometerScore">87%</rt-text>
        const scoreMatch = text.match(/<rt-text[^>]*slot="tomatometerScore"[^>]*>(\d+)%<\/rt-text>/i);
        if (scoreMatch) return scoreMatch[1];

        const jsonMatch = text.match(/"tomatometerScore":\s*(\d+)/);
        if (jsonMatch) return jsonMatch[1];

        return "xx";
    } catch (e) {
        console.error(`Error scraping RT for ${title}:`, e.message);
        return "xx";
    }
}

async function main() {
    // Read existing data.js
    // Since it's not a module, we read it as text and extract the JSON
    const dataPath = 'data.js';
    if (!fs.existsSync(dataPath)) {
        console.error("data.js not found!");
        return;
    }

    let content = fs.readFileSync(dataPath, 'utf8');
    const jsonMatch = content.match(/const mediaData = (\[[\s\S]*?\]);/);

    if (!jsonMatch) {
        console.error("Could not parse mediaData from data.js");
        return;
    }

    let mediaData;
    try {
        mediaData = JSON.parse(jsonMatch[1]);
    } catch (e) {
        console.error("JSON parse error:", e.message);
        return;
    }

    console.log(`Found ${mediaData.length} items to update.`);

    for (const item of mediaData) {
        console.log(`Updating ${item.title} (${item.year})...`);

        // 1. IMDb
        const imdbId = await getImdbId(item.title, item.year);
        if (imdbId) {
            const rating = await getImdbRating(imdbId);
            item.imdb = rating;
            console.log(`  IMDb (${imdbId}): ${rating}`);
        } else {
            item.imdb = "xx";
            console.log(`  IMDb: xx (ID not found)`);
        }

        // 2. Rotten Tomatoes
        const rtRating = await getRtRating(item.title, item.type, item.year);
        item.rottenTomatoes = rtRating;
        console.log(`  RT: ${rtRating}`);

        // Add a small delay to be nice
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Write back
    const newContent = `// data.js
// Generated from TMDB API
const mediaData = ${JSON.stringify(mediaData, null, 2)};
`;
    fs.writeFileSync(dataPath, newContent);
    console.log("data.js updated successfully.");
}

main();
