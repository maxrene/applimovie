from playwright.sync_api import sync_playwright
import time

def verify_popular_filters():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate a mobile device
        context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()

        # Set user selected platforms in localStorage
        page.add_init_script("""
            localStorage.setItem('selectedPlatforms', JSON.stringify(['netflix', 'disney', 'prime']));
            localStorage.setItem('userRegion', 'FR');
        """)

        page.goto("http://localhost:8080")

        # Wait for app to load
        page.wait_for_timeout(2000)

        # Switch to Popular tab using the footer button
        print("Switching to Popular tab...")
        page.get_by_role("button", name="Populaire").click()
        page.wait_for_timeout(2000)

        # 1. Open Filter Modal
        print("Opening Filter modal...")
        page.get_by_role("button", name="Filtre").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/popular_filter_modal.png")
        print("Screenshot saved: verification/popular_filter_modal.png")

        # Interact with filters (visual check mostly)
        # Select Rating 7+
        page.get_by_role("button", name="7+").click()

        # Select a Genre (Assuming Action exists, but just clicking first one)
        # Close filter modal (click outside or apply)
        page.get_by_role("button", name="Appliquer les filtres").click()
        page.wait_for_timeout(2000)

        # 2. Open Appli Modal
        print("Opening Appli modal...")
        page.get_by_role("button", name="Appli").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/popular_platform_modal.png")
        print("Screenshot saved: verification/popular_platform_modal.png")

        # Close Appli modal
        page.mouse.click(10, 10) # Click outside

        browser.close()

if __name__ == "__main__":
    verify_popular_filters()
