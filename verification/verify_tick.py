from playwright.sync_api import sync_playwright, expect
import json
import time
import re

def verify_season_tick():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # Initialize localStorage
        init_data = {
            'watchedEpisodes': '{}',
            'watchlist': '[]',
            'watchedSeries': '[]',
            'userRegion': 'FR'
        }

        context.add_init_script(f"""
            window.localStorage.setItem('watchedEpisodes', '{init_data['watchedEpisodes']}');
            window.localStorage.setItem('watchlist', '{init_data['watchlist']}');
            window.localStorage.setItem('watchedSeries', '{init_data['watchedSeries']}');
            window.localStorage.setItem('userRegion', '{init_data['userRegion']}');
        """)

        page = context.new_page()

        # 1. Navigate to Breaking Bad (ID 1396)
        print("Navigating to series page...")
        page.goto("http://localhost:8080/serie.html?id=1396")

        # 2. Wait for seasons to load
        print("Waiting for seasons...")
        page.wait_for_selector(".season-card", timeout=10000)

        # Locate Season 1 card
        season_card = page.locator(".season-card").first
        tick = season_card.locator(".season-tick-action")

        # 3. Verify initial state
        print("Verifying initial state...")
        expect(tick).to_be_visible()
        expect(tick).to_have_text("radio_button_unchecked")
        page.screenshot(path="verification/step1_initial.png")

        # 4. Click the tick
        print("Clicking tick...")
        tick.click()

        # 5. Wait for it to turn green (check_circle)
        # It might take a moment to fetch if not loaded
        print("Waiting for check_circle...")
        expect(tick).to_have_text("check_circle", timeout=5000)
        # Check class presence using a regex for partial match or just expect the class string if exact
        # We can check if it contains the class
        expect(tick).to_have_class(re.compile(r"text-green-400"))
        page.screenshot(path="verification/step2_checked.png")

        # 6. Expand the season
        print("Expanding season...")
        header = season_card.locator(".cursor-pointer").first
        # We need to click the header, but NOT the tick (tick click is propagated handled? No, we stopped propagation).
        # To expand, click the text area or the arrow. We can select the title.
        season_card.locator("h3").click()

        # 7. Wait for episodes to load
        print("Waiting for episodes...")
        page.wait_for_selector(".episode-tick-icon", timeout=5000)

        # 8. Verify episodes are checked
        ep_ticks = season_card.locator(".episode-tick-icon")
        count = ep_ticks.count()
        print(f"Found {count} episodes.")
        if count > 0:
            expect(ep_ticks.first).to_have_text("check_circle")

        page.screenshot(path="verification/step3_expanded.png")

        # 9. Click tick again to uncheck
        print("Unchecking...")
        tick.click()
        expect(tick).to_have_text("radio_button_unchecked")
        expect(ep_ticks.first).to_have_text("radio_button_unchecked")

        page.screenshot(path="verification/step4_unchecked.png")

        browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    verify_season_tick()
