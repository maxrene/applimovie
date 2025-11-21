
from playwright.sync_api import Page, expect, sync_playwright

def verify_ratings(page: Page):
    # Check a movie with updated ratings
    # The Shadow's Edge has ID 1419406
    page.goto("http://localhost:8080/film.html?id=1419406")

    # Wait for details to load
    expect(page.locator("#media-title")).to_have_text("The Shadow's Edge")

    # Check IMDb
    # Should be 7.5 (updated from 6.4)
    expect(page.locator("#media-imdb")).to_have_text("7.5")

    # Check RT
    # Should be "xx" (updated from 64%)
    expect(page.locator("#media-rt")).to_have_text("xx")

    print("Verified 'The Shadow's Edge': IMDb=7.5, RT=xx")

    # Take screenshot
    page.screenshot(path="verification/shadow_edge_verification.png")

    # Check Breaking Bad (Series)
    # ID 1396
    page.goto("http://localhost:8080/serie.html?id=1396")
    expect(page.locator("#media-title")).to_have_text("Breaking Bad")

    # Check IMDb (9.5)
    expect(page.locator("#media-imdb")).to_have_text("9.5")

    # Check RT (xx)
    expect(page.locator("#media-rt")).to_have_text("xx")

    print("Verified 'Breaking Bad': IMDb=9.5, RT=xx")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_ratings(page)
        except Exception as e:
            print(f"Verification failed: {e}")
            exit(1)
        finally:
            browser.close()
