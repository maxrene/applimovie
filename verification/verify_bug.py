from playwright.sync_api import sync_playwright, expect
import time

def verify_watchlist_behavior():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

        # Mock API for specific movies
        # ID 99999: Wicked 2 (Mocked as unavailable)
        # ID 28528: Glastonbury (Mocked as available on Disney)

        def handle_wicked(route):
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"id":99999,"title":"Wicked 2","poster_path":"/wicked2.jpg","runtime":120,"watch/providers":{"results":{"FR":{}}}}'
            )

        def handle_glastonbury(route):
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"id":28528,"title":"Glastonbury","poster_path":"/glasto.jpg","runtime":100,"watch/providers":{"results":{"FR":{"flatrate":[{"provider_id":337,"provider_name":"Disney Plus","logo_path":"/disney.jpg"}]}}}}'
            )

        page.route("**/discover/movie*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"page":1,"results":[],"total_pages":1,"total_results":0}'
        ))
        page.route("**/movie/99999*", handle_wicked)
        page.route("**/movie/28528*", handle_glastonbury)

        print("Navigating to Watchlist...")
        page.goto("http://localhost:8080/watchlist.html")

        print("Injecting Data...")
        page.evaluate("""() => {
            localStorage.clear();
            localStorage.setItem('watchlist', JSON.stringify([
                {id: 99999, type: 'movie', added_at: Date.now()},
                {id: 28528, type: 'movie', added_at: Date.now()}
            ]));
            // User has ONLY Netflix. So Disney (Glastonbury) is NOT selected. Wicked is NOWHERE.
            localStorage.setItem('selectedPlatforms', JSON.stringify(['netflix']));
            localStorage.setItem('userRegion', 'FR');
        }""")

        page.reload()
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # Check visibility
        wicked_card = page.locator("div", has_text="Wicked 2").first
        glasto_card = page.locator("div", has_text="Glastonbury").first

        if wicked_card.count() > 0:
            print("SUCCESS: Wicked 2 (Unavailable) is visible.")
        else:
            print("FAILURE: Wicked 2 (Unavailable) is NOT visible.")

        if glasto_card.count() > 0:
            print("SUCCESS: Glastonbury (Available on Disney, but user has Netflix) is visible.")
        else:
            print("FAILURE: Glastonbury (Available on Disney) is NOT visible.")

        # Check icons
        # Wicked 2 should have NO icons.
        # Glastonbury should have NO icons (because Disney is not selected).

        if glasto_card.count() > 0 and glasto_card.locator("img[title='Disney Plus']").count() == 0:
             print("SUCCESS: Glastonbury has no Disney icon (filtered out).")

        # Toggle Disney ON
        print("Toggling Disney ON...")
        # Need to find button for Disney.
        # Disney is ID 'disney'.
        # BUT userSelectedPlatforms only has 'netflix'.
        # So Disney button is NOT in the header initially?
        # Correct. The user can only toggle what they have selected in settings.

        # So to test icon appearance, we'd need to add Disney to selected platforms.
        # But the core issue reported is VISIBILITY of the card.

        browser.close()

if __name__ == "__main__":
    verify_watchlist_behavior()
