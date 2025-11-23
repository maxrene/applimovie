from playwright.sync_api import sync_playwright, expect
import time

def verify_watchlist_logic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.goto("http://localhost:8080/watchlist.html")

        mock_watchlist = [
            {"id": 550, "type": "movie", "added_at": "2023-01-01", "title": "Fight Club"},
            {"id": 299534, "type": "movie", "added_at": "2023-01-02", "title": "Avengers: Endgame"},
            {"id": 1399, "type": "serie", "added_at": "2023-01-03", "title": "Game of Thrones"}
        ]

        mock_selected_platforms = ["netflix", "disney", "max", "canal"]

        page.evaluate(f"""() => {{
            localStorage.setItem('watchlist', '{str(mock_watchlist).replace("'", '"')}');
            localStorage.setItem('selectedPlatforms', '{str(mock_selected_platforms).replace("'", '"')}');
            localStorage.setItem('userRegion', 'FR');
        }}""")

        page.reload()

        # Inject enriched data with apiDetails
        page.wait_for_timeout(1000)
        page.evaluate("""() => {
            const alpineData = Alpine.$data(document.querySelector('[x-data]'));
            alpineData.enrichedWatchlist = [
                {
                    id: 550, type: 'movie', title: 'Fight Club',
                    posterUrl: 'https://placehold.co/100x150', year: '1999', genres: ['Drama'],
                    apiDetails: {
                        'watch/providers': { results: { 'FR': { flatrate: [{provider_name: 'Netflix', provider_id: 8}] } } },
                        runtime: 139
                    }
                },
                {
                    id: 299534, type: 'movie', title: 'Avengers',
                    posterUrl: 'https://placehold.co/100x150', year: '2019', genres: ['Action'],
                    apiDetails: {
                        'watch/providers': { results: { 'FR': { flatrate: [{provider_name: 'Disney Plus', provider_id: 337}] } } },
                        runtime: 181
                    }
                },
                {
                    id: 1399, type: 'serie', title: 'Game of Thrones',
                    posterUrl: 'https://placehold.co/100x150', year: '2011', genres: ['Fantasy'],
                    apiDetails: {
                        'watch/providers': { results: { 'FR': { flatrate: [{provider_name: 'HBO Max', provider_id: 384}] } } },
                        number_of_seasons: 8
                    }
                }
            ];
            alpineData.renderMedia();
        }""")

        page.wait_for_timeout(500)

        page.get_by_text("expand_more").first.click()

        page.wait_for_timeout(500)
        page.screenshot(path="verification_step1_all.png")
        print("Screenshot 1 taken.")

        tout_btn = page.get_by_role("button", name="TOUT")
        if "bg-primary" in tout_btn.get_attribute("class"):
            print("PASS: 'TOUT' button is selected by default.")
        else:
            print("FAIL: 'TOUT' button is NOT selected.")

        page.evaluate("() => Alpine.$data(document.querySelector('[x-data]')).togglePlatformFilter('netflix')")
        page.evaluate("() => Alpine.$data(document.querySelector('[x-data]')).renderMedia()")

        page.wait_for_timeout(500)
        page.screenshot(path="verification_step2_netflix.png")

        visible_titles = page.locator("#media-list h3").all_text_contents()
        print(f"Visible titles after Netflix filter: {visible_titles}")
        if "Fight Club" in visible_titles and "Avengers" not in visible_titles:
            print("PASS: Filtering by Netflix worked.")
        else:
            print("FAIL: Filtering logic incorrect.")

        if "bg-gray-200" in tout_btn.get_attribute("class") or "bg-gray-800" in tout_btn.get_attribute("class"):
             print("PASS: 'TOUT' button is deselected.")
        else:
             print("FAIL: 'TOUT' button is still selected.")

        tout_btn.click()
        page.wait_for_timeout(500)
        visible_titles = page.locator("#media-list h3").all_text_contents()
        if "Fight Club" in visible_titles and "Avengers" in visible_titles:
            print("PASS: Clicking TOUT restored all items.")
        else:
            print(f"FAIL: Restore failed. Visible: {visible_titles}")

        browser.close()

if __name__ == "__main__":
    verify_watchlist_logic()
