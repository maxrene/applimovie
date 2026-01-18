from playwright.sync_api import sync_playwright
import json
import time

def verify_sorting():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Navigate to init localStorage
        page.goto("http://localhost:8080/index.html")

        # 2. Inject Data
        # Series IDs:
        # 1399: Game of Thrones
        # 1396: Breaking Bad
        # 60059: Better Call Saul

        now = int(time.time() * 1000)
        yesterday = now - (24 * 60 * 60 * 1000)

        # Note: We need valid IDs so the API fetch matches them
        watched_episodes = {
            "1399": [63056], # S01E01 of GoT
            "1396": [62085], # S01E01 of BB
            "60059": [972879] # S01E01 of BCS
        }

        series_timestamps = {
            "1399": yesterday, # GoT: Older
            "1396": now        # BB: Newer -> Should be first
            # BCS: No timestamp -> Should be last
        }

        print("Injecting data...")
        # Inject
        page.evaluate(f"""() => {{
            localStorage.setItem('watchedEpisodes', '{json.dumps(watched_episodes)}');
            localStorage.setItem('seriesLastWatchedDate', '{json.dumps(series_timestamps)}');
            localStorage.setItem('userRegion', 'FR');
            localStorage.removeItem('lastHomeFetch'); // Force fetch
        }}""")

        # 3. Reload to apply
        print("Reloading page...")
        page.reload()

        # 4. Wait for content
        print("Waiting for content...")
        # Wait for continue watching section to appear (timeout increased as API might be slow)
        try:
            page.wait_for_selector("#continue-watching-section", state="visible", timeout=10000)
            page.wait_for_selector("#continue-watching-container .media-card-link", timeout=10000)
        except Exception as e:
            print(f"Timeout waiting for selectors: {e}")
            page.screenshot(path="verification/timeout_debug.png")
            browser.close()
            return

        # 5. Check Order
        # We need to get the data-id of the cards in order
        cards = page.locator("#continue-watching-container .media-card-link").all()
        ids = [card.get_attribute("data-id") for card in cards]
        titles = [card.locator("p.font-bold").first.inner_text() for card in cards]

        print(f"Order found (IDs): {ids}")
        print(f"Order found (Titles): {titles}")

        # Expected: 1396 (BB), 1399 (GoT), 60059 (BCS)
        if ids == ["1396", "1399", "60059"]:
            print("SUCCESS: Sorting is correct.")
        else:
            print("FAILURE: Sorting is incorrect.")

        # 6. Screenshot
        page.screenshot(path="verification/sorting_verification.png", full_page=True)
        print("Screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_sorting()
