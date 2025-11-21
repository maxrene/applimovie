
async function testSearch() {
    const query = "Inception";
    const url = `https://www.imdb.com/find/?q=${encodeURIComponent(query)}`;

    console.log(`Testing IMDb Search: ${url}`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const text = await res.text();

        // Look for /title/tt\d+
        // The new IMDb search page often loads results via JS or has specific classes.
        // Let's look for the first link containing /title/tt
        const match = text.match(/\/title\/(tt\d+)\//);
        if (match) {
            console.log(`Found IMDb ID: ${match[1]}`);
        } else {
            console.log("IMDb ID not found in search results.");
            // console.log(text.substring(0, 2000));
        }

    } catch (e) {
        console.error("Search Error:", e.message);
    }
}

testSearch();
