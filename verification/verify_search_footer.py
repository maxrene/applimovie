
from playwright.sync_api import sync_playwright

def verify_footer_font():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to search.html
        page.goto("http://localhost:8080/search.html")

        # Wait for the footer to be visible
        page.wait_for_selector("footer")

        # Take a screenshot of the footer
        footer = page.locator("footer")
        footer.screenshot(path="verification/search_footer_final.png")

        print("Screenshots taken.")
        browser.close()

if __name__ == "__main__":
    verify_footer_font()
