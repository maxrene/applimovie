from playwright.sync_api import sync_playwright

def verify_footers():
    pages = [
        {"url": "http://localhost:8080/watchlist.html", "name": "watchlist"},
        {"url": "http://localhost:8080/search.html", "name": "search"},
        {"url": "http://localhost:8080/popular.html", "name": "popular"},
        {"url": "http://localhost:8080/profile.html", "name": "profile"}
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 375, "height": 812}) # Mobile viewport

        for page_info in pages:
            page = context.new_page()
            page.goto(page_info["url"])

            # Wait for footer to be visible
            footer = page.locator("footer")
            footer.wait_for()

            # Take screenshot of the footer
            page.screenshot(path=f"verification/{page_info['name']}_footer.png")
            print(f"Captured screenshot for {page_info['name']}")

            page.close()

        browser.close()

if __name__ == "__main__":
    verify_footers()
