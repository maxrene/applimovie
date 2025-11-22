const fs = require('fs');

// VOTRE LISTE (Format JSON fourni)
const rawData = {
  "movies": [
      { "title": "Oppenheimer", "year": 2023, "nominations": 13, "wins": 7 },
      { "title": "Poor Things", "year": 2023, "nominations": 11, "wins": 4 },
      { "title": "Killers of the Flower Moon", "year": 2023, "nominations": 10, "wins": 0 },
      { "title": "Barbie", "year": 2023, "nominations": 8, "wins": 1 },
      { "title": "Maestro", "year": 2023, "nominations": 7, "wins": 0 },
      { "title": "Anatomy of a Fall", "year": 2023, "nominations": 5, "wins": 1 },
      { "title": "The Zone of Interest", "year": 2023, "nominations": 5, "wins": 2 },
      { "title": "The Holdovers", "year": 2023, "nominations": 5, "wins": 1 },
      { "title": "American Fiction", "year": 2023, "nominations": 5, "wins": 1 },
      { "title": "Napoleon", "year": 2023, "nominations": 3, "wins": 0 },
      { "title": "Past Lives", "year": 2023, "nominations": 2, "wins": 0 },
      { "title": "Everything Everywhere All At Once", "year": 2022, "nominations": 11, "wins": 7 },
      { "title": "All Quiet on the Western Front", "year": 2022, "nominations": 9, "wins": 4 },
      { "title": "The Banshees of Inisherin", "year": 2022, "nominations": 9, "wins": 0 },
      { "title": "Elvis", "year": 2022, "nominations": 8, "wins": 0 },
      { "title": "The Fabelmans", "year": 2022, "nominations": 7, "wins": 0 },
      { "title": "Top Gun: Maverick", "year": 2022, "nominations": 6, "wins": 1 },
      { "title": "Tár", "year": 2022, "nominations": 6, "wins": 0 },
      { "title": "Black Panther: Wakanda Forever", "year": 2022, "nominations": 5, "wins": 1 },
      { "title": "Avatar: The Way of Water", "year": 2022, "nominations": 4, "wins": 1 },
      { "title": "Women Talking", "year": 2022, "nominations": 2, "wins": 1 },
      { "title": "Triangle of Sadness", "year": 2022, "nominations": 3, "wins": 0 },
      { "title": "The Power of the Dog", "year": 2021, "nominations": 12, "wins": 1 },
      { "title": "Dune: Part One", "year": 2021, "nominations": 10, "wins": 6 },
      { "title": "Belfast", "year": 2021, "nominations": 7, "wins": 1 },
      { "title": "West Side Story", "year": 2021, "nominations": 7, "wins": 1 },
      { "title": "King Richard", "year": 2021, "nominations": 6, "wins": 1 },
      { "title": "Don't Look Up", "year": 2021, "nominations": 4, "wins": 0 },
      { "title": "Drive My Car", "year": 2021, "nominations": 4, "wins": 1 },
      { "title": "CODA", "year": 2021, "nominations": 3, "wins": 3 },
      { "title": "Licorice Pizza", "year": 2021, "nominations": 3, "wins": 0 },
      { "title": "Mank", "year": 2020, "nominations": 10, "wins": 2 },
      { "title": "Nomadland", "year": 2020, "nominations": 6, "wins": 3 },
      { "title": "The Father", "year": 2020, "nominations": 6, "wins": 2 },
      { "title": "Sound of Metal", "year": 2020, "nominations": 6, "wins": 2 },
      { "title": "Judas and the Black Messiah", "year": 2020, "nominations": 6, "wins": 2 },
      { "title": "Minari", "year": 2020, "nominations": 6, "wins": 1 },
      { "title": "The Trial of the Chicago 7", "year": 2020, "nominations": 6, "wins": 0 },
      { "title": "Promising Young Woman", "year": 2020, "nominations": 5, "wins": 1 },
      { "title": "Joker", "year": 2019, "nominations": 11, "wins": 2 },
      { "title": "1917", "year": 2019, "nominations": 10, "wins": 3 },
      { "title": "Once Upon a Time... in Hollywood", "year": 2019, "nominations": 10, "wins": 2 },
      { "title": "The Irishman", "year": 2019, "nominations": 10, "wins": 0 },
      { "title": "Parasite", "year": 2019, "nominations": 6, "wins": 4 },
      { "title": "Jojo Rabbit", "year": 2019, "nominations": 6, "wins": 1 },
      { "title": "Marriage Story", "year": 2019, "nominations": 6, "wins": 1 },
      { "title": "Little Women", "year": 2019, "nominations": 6, "wins": 1 },
      { "title": "Roma", "year": 2018, "nominations": 10, "wins": 3 },
      { "title": "The Favourite", "year": 2018, "nominations": 10, "wins": 1 },
      { "title": "A Star Is Born", "year": 2018, "nominations": 8, "wins": 1 },
      { "title": "Vice", "year": 2018, "nominations": 8, "wins": 1 },
      { "title": "Black Panther", "year": 2018, "nominations": 7, "wins": 3 },
      { "title": "Green Book", "year": 2018, "nominations": 5, "wins": 3 },
      { "title": "Bohemian Rhapsody", "year": 2018, "nominations": 5, "wins": 4 },
      { "title": "The Shape of Water", "year": 2017, "nominations": 13, "wins": 4 },
      { "title": "Dunkirk", "year": 2017, "nominations": 8, "wins": 3 },
      { "title": "Three Billboards Outside Ebbing, Missouri", "year": 2017, "nominations": 7, "wins": 2 },
      { "title": "La La Land", "year": 2016, "nominations": 14, "wins": 6 },
      { "title": "Arrival", "year": 2016, "nominations": 8, "wins": 1 },
      { "title": "Moonlight", "year": 2016, "nominations": 8, "wins": 3 },
      { "title": "Manchester by the Sea", "year": 2016, "nominations": 6, "wins": 2 },
      { "title": "Hacksaw Ridge", "year": 2016, "nominations": 6, "wins": 2 },
      { "title": "The Revenant", "year": 2015, "nominations": 12, "wins": 3 },
      { "title": "Mad Max: Fury Road", "year": 2015, "nominations": 10, "wins": 6 },
      { "title": "The Martian", "year": 2015, "nominations": 7, "wins": 0 },
      { "title": "Spotlight", "year": 2015, "nominations": 6, "wins": 2 },
      { "title": "Bridge of Spies", "year": 2015, "nominations": 6, "wins": 1 },
      { "title": "Birdman", "year": 2014, "nominations": 9, "wins": 4 },
      { "title": "The Grand Budapest Hotel", "year": 2014, "nominations": 9, "wins": 4 },
      { "title": "The Imitation Game", "year": 2014, "nominations": 8, "wins": 1 },
      { "title": "American Sniper", "year": 2014, "nominations": 6, "wins": 1 },
      { "title": "Boyhood", "year": 2014, "nominations": 6, "wins": 1 },
      { "title": "Whiplash", "year": 2014, "nominations": 5, "wins": 3 },
      { "title": "Interstellar", "year": 2014, "nominations": 5, "wins": 1 },
      { "title": "Gravity", "year": 2013, "nominations": 10, "wins": 7 },
      { "title": "American Hustle", "year": 2013, "nominations": 10, "wins": 0 },
      { "title": "12 Years a Slave", "year": 2013, "nominations": 9, "wins": 3 },
      { "title": "Captain Phillips", "year": 2013, "nominations": 6, "wins": 0 },
      { "title": "Dallas Buyers Club", "year": 2013, "nominations": 6, "wins": 3 },
      { "title": "Her", "year": 2013, "nominations": 5, "wins": 1 },
      { "title": "The Wolf of Wall Street", "year": 2013, "nominations": 5, "wins": 0 },
      { "title": "Lincoln", "year": 2012, "nominations": 12, "wins": 2 },
      { "title": "Life of Pi", "year": 2012, "nominations": 11, "wins": 4 },
      { "title": "Les Misérables", "year": 2012, "nominations": 8, "wins": 3 },
      { "title": "Silver Linings Playbook", "year": 2012, "nominations": 8, "wins": 1 },
      { "title": "Argo", "year": 2012, "nominations": 7, "wins": 3 },
      { "title": "Skyfall", "year": 2012, "nominations": 5, "wins": 2 },
      { "title": "Django Unchained", "year": 2012, "nominations": 5, "wins": 2 },
      { "title": "Zero Dark Thirty", "year": 2012, "nominations": 5, "wins": 1 },
      { "title": "Hugo", "year": 2011, "nominations": 11, "wins": 5 },
      { "title": "The Artist", "year": 2011, "nominations": 10, "wins": 5 },
      { "title": "Moneyball", "year": 2011, "nominations": 6, "wins": 0 },
      { "title": "War Horse", "year": 2011, "nominations": 6, "wins": 0 },
      { "title": "The King's Speech", "year": 2010, "nominations": 12, "wins": 4 },
      { "title": "True Grit", "year": 2010, "nominations": 10, "wins": 0 },
      { "title": "Inception", "year": 2010, "nominations": 8, "wins": 4 },
      { "title": "The Social Network", "year": 2010, "nominations": 8, "wins": 3 },
      { "title": "The Fighter", "year": 2010, "nominations": 7, "wins": 2 },
      { "title": "127 Hours", "year": 2010, "nominations": 6, "wins": 0 },
      { "title": "Black Swan", "year": 2010, "nominations": 5, "wins": 1 },
      { "title": "Toy Story 3", "year": 2010, "nominations": 5, "wins": 2 },
      { "title": "Avatar", "year": 2009, "nominations": 9, "wins": 3 },
      { "title": "The Hurt Locker", "year": 2009, "nominations": 9, "wins": 6 },
      { "title": "Inglourious Basterds", "year": 2009, "nominations": 8, "wins": 1 },
      { "title": "Precious", "year": 2009, "nominations": 6, "wins": 2 },
      { "title": "Up in the Air", "year": 2009, "nominations": 6, "wins": 0 },
      { "title": "Up", "year": 2009, "nominations": 5, "wins": 2 },
      { "title": "The Curious Case of Benjamin Button", "year": 2008, "nominations": 13, "wins": 3 },
      { "title": "Slumdog Millionaire", "year": 2008, "nominations": 10, "wins": 8 },
      { "title": "The Dark Knight", "year": 2008, "nominations": 8, "wins": 2 },
      { "title": "Milk", "year": 2008, "nominations": 8, "wins": 2 },
      { "title": "Wall-E", "year": 2008, "nominations": 6, "wins": 1 },
      { "title": "No Country for Old Men", "year": 2007, "nominations": 8, "wins": 4 },
      { "title": "There Will Be Blood", "year": 2007, "nominations": 8, "wins": 2 },
      { "title": "Atonement", "year": 2007, "nominations": 7, "wins": 1 },
      { "title": "Michael Clayton", "year": 2007, "nominations": 7, "wins": 1 },
      { "title": "Ratatouille", "year": 2007, "nominations": 5, "wins": 1 },
      { "title": "Dreamgirls", "year": 2006, "nominations": 8, "wins": 2 },
      { "title": "Babel", "year": 2006, "nominations": 7, "wins": 1 },
      { "title": "Pan's Labyrinth", "year": 2006, "nominations": 6, "wins": 3 },
      { "title": "The Queen", "year": 2006, "nominations": 6, "wins": 1 },
      { "title": "The Departed", "year": 2006, "nominations": 5, "wins": 4 },
      { "title": "Blood Diamond", "year": 2006, "nominations": 5, "wins": 0 },
      { "title": "Brokeback Mountain", "year": 2005, "nominations": 8, "wins": 3 },
      { "title": "Crash", "year": 2005, "nominations": 6, "wins": 3 },
      { "title": "Memoirs of a Geisha", "year": 2005, "nominations": 6, "wins": 3 },
      { "title": "Good Night, and Good Luck", "year": 2005, "nominations": 6, "wins": 0 },
      { "title": "Walk the Line", "year": 2005, "nominations": 5, "wins": 1 },
      { "title": "The Aviator", "year": 2004, "nominations": 11, "wins": 5 },
      { "title": "Million Dollar Baby", "year": 2004, "nominations": 7, "wins": 4 },
      { "title": "Finding Neverland", "year": 2004, "nominations": 7, "wins": 1 },
      { "title": "Ray", "year": 2004, "nominations": 6, "wins": 2 },
      { "title": "Sideways", "year": 2004, "nominations": 5, "wins": 1 },
      { "title": "The Lord of the Rings: The Return of the King", "year": 2003, "nominations": 11, "wins": 11 },
      { "title": "Master and Commander", "year": 2003, "nominations": 10, "wins": 2 },
      { "title": "Cold Mountain", "year": 2003, "nominations": 7, "wins": 1 },
      { "title": "Seabiscuit", "year": 2003, "nominations": 7, "wins": 0 },
      { "title": "Mystic River", "year": 2003, "nominations": 6, "wins": 2 },
      { "title": "Pirates of the Caribbean: The Curse of the Black Pearl", "year": 2003, "nominations": 5, "wins": 0 },
      { "title": "Chicago", "year": 2002, "nominations": 13, "wins": 6 },
      { "title": "Gangs of New York", "year": 2002, "nominations": 10, "wins": 0 },
      { "title": "The Pianist", "year": 2002, "nominations": 7, "wins": 3 },
      { "title": "The Lord of the Rings: The Two Towers", "year": 2002, "nominations": 6, "wins": 2 },
      { "title": "Frida", "year": 2002, "nominations": 6, "wins": 2 },
      { "title": "Road to Perdition", "year": 2002, "nominations": 6, "wins": 1 },
      { "title": "The Lord of the Rings: The Fellowship of the Ring", "year": 2001, "nominations": 13, "wins": 4 },
      { "title": "A Beautiful Mind", "year": 2001, "nominations": 8, "wins": 4 },
      { "title": "Moulin Rouge!", "year": 2001, "nominations": 8, "wins": 2 },
      { "title": "Gosford Park", "year": 2001, "nominations": 7, "wins": 1 },
      { "title": "Amélie", "year": 2001, "nominations": 5, "wins": 0 },
      { "title": "Black Hawk Down", "year": 2001, "nominations": 4, "wins": 2 },
      { "title": "Gladiator", "year": 2000, "nominations": 12, "wins": 5 },
      { "title": "Crouching Tiger, Hidden Dragon", "year": 2000, "nominations": 10, "wins": 4 },
      { "title": "Traffic", "year": 2000, "nominations": 5, "wins": 4 },
      { "title": "Erin Brockovich", "year": 2000, "nominations": 5, "wins": 1 },
      { "title": "Chocolat", "year": 2000, "nominations": 5, "wins": 0 }
  ],
  "series": [
      { "title": "Shōgun", "year": "2024", "nominations": 25, "wins": 18 },
      { "title": "Baby Reindeer", "year": "2024", "nominations": 11, "wins": 6 },
      { "title": "True Detective", "year": "2024", "nominations": 19, "wins": 1 },
      { "title": "Fallout", "year": "2024", "nominations": 16, "wins": 2 },
      { "title": "Ripley", "year": "2024", "nominations": 13, "wins": 4 },
      { "title": "Mr. & Mrs. Smith", "year": "2024", "nominations": 16, "wins": 2 },
      { "title": "Palm Royale", "year": "2024", "nominations": 11, "wins": 0 },
      { "title": "The Bear", "year": "2022", "nominations": 23, "wins": 11 },
      { "title": "Slow Horses", "year": "2022", "nominations": 15, "wins": 1 },
      { "title": "Succession", "year": "2018", "nominations": 75, "wins": 19 },
      { "title": "The Last of Us", "year": "2023", "nominations": 24, "wins": 8 },
      { "title": "Hacks", "year": "2021", "nominations": 48, "wins": 9 },
      { "title": "Beef", "year": "2023", "nominations": 13, "wins": 8 },
      { "title": "The White Lotus", "year": "2021", "nominations": 43, "wins": 15 },
      { "title": "Abbott Elementary", "year": "2021", "nominations": 15, "wins": 4 },
      { "title": "Squid Game", "year": "2021", "nominations": 14, "wins": 6 },
      { "title": "Severance", "year": "2022", "nominations": 14, "wins": 2 },
      { "title": "Yellowjackets", "year": "2021", "nominations": 10, "wins": 0 },
      { "title": "Only Murders in the Building", "year": "2021", "nominations": 49, "wins": 7 },
      { "title": "Ted Lasso", "year": "2020", "nominations": 61, "wins": 13 },
      { "title": "The Queen's Gambit", "year": "2020", "nominations": 18, "wins": 11 },
      { "title": "Mare of Easttown", "year": "2021", "nominations": 16, "wins": 4 },
      { "title": "WandaVision", "year": "2021", "nominations": 23, "wins": 3 },
      { "title": "Schitt's Creek", "year": "2015", "nominations": 19, "wins": 9 },
      { "title": "Watchmen", "year": "2019", "nominations": 26, "wins": 11 },
      { "title": "Chernobyl", "year": "2019", "nominations": 19, "wins": 10 },
      { "title": "Fleabag", "year": "2016", "nominations": 11, "wins": 6 },
      { "title": "Ozark", "year": "2017", "nominations": 45, "wins": 4 },
      { "title": "The Marvelous Mrs. Maisel", "year": "2017", "nominations": 66, "wins": 20 },
      { "title": "The Handmaid's Tale", "year": "2017", "nominations": 76, "wins": 15 },
      { "title": "Big Little Lies", "year": "2017", "nominations": 21, "wins": 8 },
      { "title": "The Crown", "year": "2016", "nominations": 87, "wins": 21 },
      { "title": "Stranger Things", "year": "2016", "nominations": 51, "wins": 12 },
      { "title": "This Is Us", "year": "2016", "nominations": 40, "wins": 4 },
      { "title": "Atlanta", "year": "2016", "nominations": 25, "wins": 6 },
      { "title": "Westworld", "year": "2016", "nominations": 54, "wins": 7 },
      { "title": "Better Call Saul", "year": "2015", "nominations": 53, "wins": 0 },
      { "title": "Fargo", "year": "2014", "nominations": 70, "wins": 6 },
      { "title": "Veep", "year": "2012", "nominations": 68, "wins": 17 },
      { "title": "Game of Thrones", "year": "2011", "nominations": 160, "wins": 59 },
      { "title": "Homeland", "year": "2011", "nominations": 35, "wins": 8 },
      { "title": "Black Mirror", "year": "2011", "nominations": 14, "wins": 6 },
      { "title": "Downton Abbey", "year": "2010", "nominations": 69, "wins": 15 },
      { "title": "Sherlock", "year": "2010", "nominations": 39, "wins": 9 },
      { "title": "Boardwalk Empire", "year": "2010", "nominations": 57, "wins": 20 },
      { "title": "Modern Family", "year": "2009", "nominations": 85, "wins": 22 },
      { "title": "Glee", "year": "2009", "nominations": 40, "wins": 6 },
      { "title": "Breaking Bad", "year": "2008", "nominations": 58, "wins": 16 },
      { "title": "Mad Men", "year": "2007", "nominations": 116, "wins": 16 },
      { "title": "30 Rock", "year": "2006", "nominations": 103, "wins": 16 },
      { "title": "Dexter", "year": "2006", "nominations": 24, "wins": 4 },
      { "title": "The Office", "year": "2005", "nominations": 42, "wins": 5 },
      { "title": "Grey's Anatomy", "year": "2005", "nominations": 39, "wins": 5 },
      { "title": "Lost", "year": "2004", "nominations": 54, "wins": 10 },
      { "title": "House", "year": "2004", "nominations": 25, "wins": 5 },
      { "title": "Desperate Housewives", "year": "2004", "nominations": 33, "wins": 7 },
      { "title": "Arrested Development", "year": "2003", "nominations": 25, "wins": 6 },
      { "title": "The Wire", "year": "2002", "nominations": 2, "wins": 0 },
      { "title": "24", "year": "2001", "nominations": 68, "wins": 20 },
      { "title": "Six Feet Under", "year": "2001", "nominations": 53, "wins": 9 },
      { "title": "Curb Your Enthusiasm", "year": "2000", "nominations": 51, "wins": 2 },
      { "title": "The West Wing", "year": "1999", "nominations": 95, "wins": 26 },
      { "title": "The Sopranos", "year": "1999", "nominations": 112, "wins": 21 }
  ]
};

// API Key (Utilise la même que votre projet)
const API_KEY = 'f1b07b5d2ac7a9f55c5b49a93b18bd33';
const BASE_URL = 'https://api.themoviedb.org/3';

async function searchTMDB(title, type, year) {
    let url = `${BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(title)}`;
    
    // Pour les films, on utilise l'année pour être précis
    if (type === 'movie' && year) {
        url += `&year=${year}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();
        // On prend le premier résultat
        if (data.results && data.results.length > 0) {
            return data.results[0].id;
        } else {
            console.warn(`⚠️ ID non trouvé pour : ${title}`);
            return null;
        }
    } catch (e) {
        console.error(`Erreur recherche pour ${title}:`, e);
        return null;
    }
}

async function main() {
    console.log("🚀 Démarrage de la mise à jour des Awards...");
    const output = {};

    // 1. Traitement des FILMS
    for (const movie of rawData.movies) {
        const id = await searchTMDB(movie.title, 'movie', movie.year);
        if (id) {
            output[id] = {
                title: movie.title,
                year: movie.year,
                nominations: movie.nominations,
                wins: movie.wins,
                type: 'movie'
            };
            console.log(`✅ Movie: ${movie.title} -> ID: ${id}`);
        }
        // Petite pause pour éviter de spammer l'API
        await new Promise(r => setTimeout(r, 100)); 
    }

    // 2. Traitement des SÉRIES
    for (const serie of rawData.series) {
        // Pour les séries, l'année est souvent une plage "2022-Present", on prend juste le début
        const year = typeof serie.year === 'string' ? serie.year.split('-')[0] : serie.year;
        const id = await searchTMDB(serie.title, 'tv', year);
        if (id) {
            output[id] = {
                title: serie.title,
                year: serie.year,
                nominations: serie.nominations,
                wins: serie.wins,
                type: 'tv'
            };
            console.log(`✅ Serie: ${serie.title} -> ID: ${id}`);
        }
        await new Promise(r => setTimeout(r, 100));
    }

    // 3. Écriture du fichier final
    const fileContent = `window.awardsData = ${JSON.stringify(output, null, 2)};`;
    
    // Ajustez le chemin selon où vous lancez le script (ici on suppose que vous êtes à la racine)
    // Si vous êtes dans le dossier scripts, utilisez '../js/awards.js'
    fs.writeFileSync('js/awards.js', fileContent);
    
    console.log("\n🎉 Terminé ! Le fichier js/awards.js a été mis à jour avec succès.");
}

main();
