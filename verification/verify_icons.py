from playwright.sync_api import sync_playwright

def verify_watchlist_and_watched_icons():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Inject local storage data for verification
        page.add_init_script("""
            localStorage.setItem('userRegion', 'FR');
            localStorage.setItem('watchlist', JSON.stringify([{ "id": 550, "type": "movie" }])); // Fight Club
            localStorage.setItem('watchedMovies', JSON.stringify([157336])); // Interstellar
            localStorage.setItem('watchedSeries', JSON.stringify([1399])); // Game of Thrones
        """)

        # 1. Verify Homepage
        print("Navigating to Homepage...")
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#popular-container")

        # Take screenshot of Homepage
        page.screenshot(path="verification/verification_homepage.png", full_page=True)
        print("Homepage screenshot taken.")

        # 2. Verify Popular Page
        print("Navigating to Popular Page...")
        page.goto("http://localhost:8080/popular.html")
        page.wait_for_selector("a[href*='film.html']")

        # Take screenshot of Popular Page
        page.screenshot(path="verification/verification_popular.png", full_page=True)
        print("Popular page screenshot taken.")

        # 3. Verify Search Page
        print("Navigating to Search Page...")
        page.goto("http://localhost:8080/search.html")

        # Inject search history
        page.add_init_script("""
             localStorage.setItem('previousSearches', JSON.stringify([
                {
                    "id": 550,
                    "title": "Fight Club",
                    "media_type": "movie",
                    "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
                },
                {
                    "id": 157336,
                    "title": "Interstellar",
                    "media_type": "movie",
                    "poster_path": "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
                }
             ]));
        """)
        page.reload() # Reload to pick up the injected history if init script was late (though add_init_script works for next navigation usually, reload ensures it)

        page.wait_for_selector("h2:has-text('Récents')")

        # Take screenshot of Search Page (Recent)
        page.screenshot(path="verification/verification_search_recent.png", full_page=True)
        print("Search page (Recent) screenshot taken.")

        # Perform search to verify active results
        page.fill("input[type='search']", "Batman")
        page.wait_for_selector("a[href*='film.html']")

        page.screenshot(path="verification/verification_search_active.png", full_page=True)
        print("Search page (Active) screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_watchlist_and_watched_icons()
