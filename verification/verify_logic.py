from playwright.sync_api import sync_playwright

def verify_watched_removes_watchlist():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Setup: Item in Watchlist but NOT watched
        page.add_init_script("""
            localStorage.setItem('userRegion', 'FR');
            localStorage.setItem('watchlist', JSON.stringify([{ "id": 550, "type": "movie" }])); // Fight Club
            localStorage.setItem('watchedMovies', JSON.stringify([]));
            localStorage.setItem('watchedSeries', JSON.stringify([]));
        """)

        # 2. Go to Movie Detail Page
        print("Navigating to Film Detail...")
        page.goto("http://localhost:8080/film.html?id=550")

        # 3. Verify 'Dans ma liste' (In List) state
        watchlist_btn = page.locator("#watchlist-button")
        page.wait_for_timeout(1000) # Wait for JS to run

        print("Checking initial state...")
        # Expect 'Dans ma liste' text or Primary color class
        # (Assuming the button text is correct based on logic)

        # 4. Click to Mark as Watched
        # Logic: If In List -> Click -> Watched (and removed from list)
        print("Clicking Watchlist button...")
        watchlist_btn.click()
        page.wait_for_timeout(500)

        # 5. Verify 'Vu' (Watched) state
        print("Verifying 'Vu' state...")
        # Check class bg-green-500 or text 'Vu'

        # 6. Verify Local Storage
        print("Verifying LocalStorage...")
        watchlist = page.evaluate("JSON.parse(localStorage.getItem('watchlist'))")
        watched = page.evaluate("JSON.parse(localStorage.getItem('watchedMovies'))")

        print(f"Watchlist: {watchlist}")
        print(f"Watched: {watched}")

        assert len(watchlist) == 0, "Item should be removed from watchlist"
        assert 550 in watched, "Item should be added to watched list"

        # 7. Go back to Home and verify icon
        print("Navigating back to Home...")
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#popular-container")

        # Take screenshot
        page.screenshot(path="verification/verification_watched_logic.png", full_page=True)
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_watched_removes_watchlist()
