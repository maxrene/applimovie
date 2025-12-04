from playwright.sync_api import sync_playwright, expect
import re

def verify_interactions():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 375, "height": 667},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()

        # Init with some state
        page.add_init_script("""
            localStorage.setItem('selectedPlatforms', JSON.dumps([
                {'id': 'netflix', 'name': 'Netflix', 'logoUrl': 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg'}
            ]));
        """)

        page.goto("http://localhost:8080/watchlist.html")
        page.wait_for_load_state("networkidle")

        print("Checking initial state...")
        # The slider div is the one with absolute position inside the toggle
        slider = page.locator(".pb-2 .relative .absolute")

        # Check if class contains translate-x-0
        expect(slider).to_have_class(re.compile(r"translate-x-0"))

        # Tabs underline
        underline = page.locator(".border-b .absolute").first
        expect(underline).to_have_attribute("style", "left: 0%")

        print("Interacting: Click 'Vu'...")
        page.locator("text=Vu").first.click()

        # Verify slider moved
        expect(slider).to_have_class(re.compile(r"translate-x-\[100\%\]"))
        print("Slider moved to 'Vu'.")

        print("Interacting: Click 'Séries'...")
        page.locator("text=Séries").click()

        # Verify underline moved
        expect(underline).to_have_attribute("style", "left: 50%")
        print("Underline moved to 'Séries'.")

        # Take screenshot of final state
        page.screenshot(path="verification/watchlist_interaction.png")
        print("Interaction screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_interactions()
