from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    # Emulate a mobile device
    context = browser.new_context(
        viewport={'width': 375, 'height': 667},
        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1'
    )
    page = context.new_page()

    # Check index.html
    page.goto("http://localhost:8080/index.html")
    # Check for viewport meta tag
    viewport = page.locator('meta[name="viewport"]')
    if viewport.count() > 0:
        print("Viewport tag found in index.html")
    else:
        print("Viewport tag NOT found in index.html")

    page.screenshot(path="verification/mobile_index.png")

    # Check film.html (needs some mocking if it tries to fetch data, but structure should load)
    # We can just check the static part or a mocked page, but the meta tag is in the head
    page.goto("http://localhost:8080/film.html")
    viewport = page.locator('meta[name="viewport"]')
    if viewport.count() > 0:
        print("Viewport tag found in film.html")
    else:
        print("Viewport tag NOT found in film.html")
    page.screenshot(path="verification/mobile_film.png")

    # Check person.html
    page.goto("http://localhost:8080/person.html")
    viewport = page.locator('meta[name="viewport"]')
    if viewport.count() > 0:
        print("Viewport tag found in person.html")
    else:
        print("Viewport tag NOT found in person.html")
    page.screenshot(path="verification/mobile_person.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
