from playwright.sync_api import sync_playwright, expect
import time

def test_profile_auth(page):
    page.goto("http://localhost:3000/profile.html")

    # Force UI rendering manually for Alpine/Firebase if needed
    page.evaluate('Alpine.$data(document.querySelector("body")).loading = false')
    time.sleep(2) # Give Alpine time to initialize

    # Assert guest state is visible
    expect(page.locator("text=Invité(e)")).to_be_visible()
    expect(page.locator("text=Se connecter pour synchroniser")).to_be_visible()

    # Take screenshot of guest state
    page.screenshot(path="/home/jules/verification/profile_guest.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_profile_auth(page)
        finally:
            browser.close()
