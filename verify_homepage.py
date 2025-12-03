from playwright.sync_api import sync_playwright

def verify_homepage():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 400, 'height': 800}) # Mobile view as per user context

        # Navigate to homepage
        page.goto('http://localhost:8080/index.html')

        # Wait for content to load
        page.wait_for_selector('#popular-container a')
        page.wait_for_timeout(2000) # wait for images to render

        # Take a screenshot of the top part of the page
        page.screenshot(path='homepage_verification.png', full_page=False)

        browser.close()

if __name__ == "__main__":
    verify_homepage()
