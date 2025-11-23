from playwright.sync_api import sync_playwright, expect
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

        # Mock TMDB API responses for providers
        def handle_dune(route):
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"id":693134,"runtime":166,"watch/providers":{"results":{"FR":{"flatrate":[{"provider_id":8,"provider_name":"Netflix","logo_path":"/netflix.jpg"}]}}}}'
            )

        def handle_frankenstein(route):
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"id":1062722,"runtime":150,"watch/providers":{"results":{"FR":{"flatrate":[{"provider_id":337,"provider_name":"Disney Plus","logo_path":"/disney.jpg"}]}}}}'
            )

        page.route("**/discover/movie*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"page":1,"results":[],"total_pages":1,"total_results":0}'
        ))
        page.route("**/movie/693134*", handle_dune)
        page.route("**/movie/1062722*", handle_frankenstein)

        print("Navigating to Watchlist...")
        page.goto("http://localhost:8080/watchlist.html")

        page.evaluate("""() => {
            localStorage.clear();
            localStorage.setItem('watchlist', JSON.stringify([
                {id: 693134, type: 'movie', added_at: Date.now()},
                {id: 1062722, type: 'movie', added_at: Date.now()}
            ]));
            localStorage.setItem('selectedPlatforms', JSON.stringify(['netflix']));
            localStorage.setItem('userRegion', 'FR');
        }""")

        page.reload()
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        dune_card = page.locator("div", has_text="Dune: Part Two").first

        # Verify initial state
        if dune_card.locator("img[title='Netflix']").count() > 0:
            print("SUCCESS: Netflix icon initially visible.")
        else:
            print("FAILURE: Netflix icon initially missing.")

        # Toggle Interaction
        print("Opening Service Bar...")
        # Click the top-left button that toggles the bar.
        # It contains the small icons.
        expand_btn = page.locator("header button").filter(has_text="expand_more").first
        expand_btn.click()
        time.sleep(0.5)

        print("Clicking Netflix filter button in bar...")
        # Find the button in the bar (div with x-show="showServiceBar")
        bar = page.locator("div[x-show='showServiceBar']")
        # inside bar, find button with Netflix image
        netflix_filter_btn = bar.locator("button img[src*='Netflix']").first
        netflix_filter_btn.click()

        time.sleep(2)

        if dune_card.locator("img[title='Netflix']").count() == 0:
            print("SUCCESS: Netflix icon disappeared after toggling filter off.")
        else:
            print("FAILURE: Netflix icon still visible after toggling filter off.")

        page.screenshot(path="verification/watchlist_final_corrected.png")
        browser.close()

if __name__ == "__main__":
    verify_changes()
