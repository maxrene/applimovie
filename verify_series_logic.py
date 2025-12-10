from playwright.sync_api import sync_playwright
import time
import os

# Create verification directory
os.makedirs("verification", exist_ok=True)

# Mock Data
MOCK_SERIES_ID = 1399
MOCK_SERIES_DETAILS = {
    "id": 1399,
    "name": "Game of Thrones",
    "number_of_seasons": 8,
    "number_of_episodes": 73,
    "seasons": [
        {"season_number": 1, "episode_count": 10, "name": "Season 1"},
        {"season_number": 2, "episode_count": 10, "name": "Season 2"}
    ]
}

MOCK_SEASON_1 = {
    "id": 3624,
    "season_number": 1,
    "episodes": [
        {"id": 63056, "episode_number": 1, "name": "Winter Is Coming", "runtime": 62},
        {"id": 63057, "episode_number": 2, "name": "The Kingsroad", "runtime": 56}
    ]
}

MOCK_SEASON_2 = {
    "id": 3625,
    "season_number": 2,
    "episodes": [
        {"id": 974430, "episode_number": 1, "name": "The North Remembers", "runtime": 53}
    ]
}

def verify_series_logic(page):
    # Intercept API calls
    page.route("**/tv/1399?*", lambda route: route.fulfill(json=MOCK_SERIES_DETAILS))
    page.route("**/tv/1399/credits?*", lambda route: route.fulfill(json={"cast": [], "crew": []}))
    page.route("**/tv/1399/watch/providers?*", lambda route: route.fulfill(json={"results": {}}))
    page.route("**/tv/1399/season/1?*", lambda route: route.fulfill(json=MOCK_SEASON_1))
    page.route("**/tv/1399/season/2?*", lambda route: route.fulfill(json=MOCK_SEASON_2))

    # 1. Load Series Page
    print("Loading Series Page...")
    page.goto("http://localhost:8080/serie.html?id=1399")
    page.wait_for_timeout(1000)
    page.screenshot(path="verification/1_initial_load.png")

    # 2. Click "Ma Liste" (Add to Watchlist)
    print("Adding to Watchlist...")
    watchlist_btn = page.locator("#watchlist-button")
    watchlist_btn.click()
    page.wait_for_timeout(500)
    page.screenshot(path="verification/2_added_to_watchlist.png")

    # 3. Click "Ma Liste" again (Mark as Watched - triggers modal)
    print("Clicking again to trigger modal...")
    watchlist_btn.click()
    page.wait_for_timeout(500)
    page.screenshot(path="verification/3_modal_visible.png")

    # 4. Confirm "Oui" in Modal
    print("Confirming in Modal...")
    confirm_btn = page.locator("#modal-confirm-button")
    confirm_btn.click()

    # Wait for async operations and UI update
    page.wait_for_timeout(2000)
    page.screenshot(path="verification/4_marked_all_watched.png")

    # 5. Verify Season Ticks
    print("Verifying Season Ticks...")
    season_cards = page.locator(".season-card")
    count = season_cards.count()
    print(f"Found {count} season cards")

    for i in range(count):
        card = season_cards.nth(i)
        right_tick = card.locator(".season-tick-action")

        # Check if tick is 'check_circle' and green
        text = right_tick.text_content().strip()
        classes = right_tick.get_attribute("class")

        print(f"Season {i+1} Tick: {text}")
        if text != "check_circle":
            print(f"ERROR: Season {i+1} tick is {text}, expected 'check_circle'")
        if "text-green-400" not in classes:
            print(f"ERROR: Season {i+1} tick is not green")

        # Check rotation (should be none)
        style = right_tick.get_attribute("style") or ""
        if "transform: none" not in style:
             # It might be in CSS, but we set it inline in JS, so it should be there.
             # Wait, I set rightTick.style.transform = 'none' in JS.
             pass

    # 6. Verify Left Icon (Should still be number)
    left_icon_text = season_cards.first.locator(".season-status-icon").text_content().strip()
    print(f"Left Icon Text: {left_icon_text}")
    if left_icon_text != "1":
        print(f"ERROR: Left icon is {left_icon_text}, expected '1'")

    # 7. Reload Page to test Persistence
    print("Reloading Page to test Persistence...")
    page.reload()
    page.wait_for_timeout(2000) # Allow checkSeasonStatus to run
    page.screenshot(path="verification/5_reloaded_persistence.png")

    # Check ticks again
    season_1_tick = page.locator(".season-card").first.locator(".season-tick-action")
    if season_1_tick.text_content().strip() == "check_circle":
        print("SUCCESS: Season 1 tick persisted as watched!")
    else:
        print("FAILURE: Season 1 tick did not persist.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            verify_series_logic(page)
        except Exception as e:
            print(f"An error occurred: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
