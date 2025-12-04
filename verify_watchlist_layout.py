from playwright.sync_api import sync_playwright

def verify_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 375, "height": 667}, # Mobile viewport
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()

        # Add initial data for selected platforms to ensure the UI renders them
        page.add_init_script("""
            localStorage.setItem('selectedPlatforms', JSON.dumps([
                {'id': 'netflix', 'name': 'Netflix', 'logoUrl': 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg'},
                {'id': 'amazon', 'name': 'Amazon Prime Video', 'logoUrl': 'https://image.tmdb.org/t/p/original/emthp39XA2YScoU8vk5koveq7zh.jpg'}
            ]));
        """)

        page.goto("http://localhost:8080/watchlist.html")
        page.wait_for_load_state("networkidle")

        # Verify new layout elements
        # Tabs should be visible
        print("Checking Tabs...")
        page.locator("text=Films").wait_for(state="visible")
        page.locator("text=Séries").wait_for(state="visible")

        # Toggle should be visible
        print("Checking Toggle...")
        page.locator("text=Watchlist").first.wait_for(state="visible")
        page.locator("text=Vu").first.wait_for(state="visible")

        # Take screenshot
        page.screenshot(path="verification/watchlist_new_layout.png")
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_layout()
