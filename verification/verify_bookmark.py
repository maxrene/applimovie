from playwright.sync_api import sync_playwright, expect
import time

def verify_bookmark_button():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock API response for person details
        page.route("**/person/123?**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='''{
                "id": 123,
                "name": "Test Actor",
                "biography": "This is a test biography.",
                "profile_path": null,
                "movie_credits": {"cast": [], "crew": []},
                "tv_credits": {"cast": [], "crew": []}
            }'''
        ))

        # 1. Test Empty State
        print("Testing Empty State...")
        # Clear local storage first
        page.goto("http://localhost:8080/person.html?id=123")
        page.evaluate("localStorage.clear()")
        page.reload()

        # Wait for button to appear
        bookmark_btn = page.locator("header button").nth(1) # Second button in header
        expect(bookmark_btn).to_be_visible()

        # Check if it has 'text-white' class (empty state)
        # Note: class names might be dynamic, but we expect 'text-white' and NOT 'text-primary' or 'filled'
        expect(bookmark_btn).to_have_class(re.compile(r"text-white"))
        expect(bookmark_btn).not_to_have_class(re.compile(r"text-primary"))
        expect(bookmark_btn).not_to_have_class(re.compile(r"filled"))

        # Check icon text content
        icon = bookmark_btn.locator("span.material-symbols-outlined")
        expect(icon).to_have_text("bookmark")

        page.screenshot(path="verification/bookmark_empty.png")
        print("Captured bookmark_empty.png")

        # 2. Test Filled State
        print("Testing Filled State...")
        bookmark_btn.click()

        # Wait for state change
        # Should have 'text-primary' and 'filled'
        expect(bookmark_btn).to_have_class(re.compile(r"text-primary"))
        expect(bookmark_btn).to_have_class(re.compile(r"filled"))
        expect(bookmark_btn).not_to_have_class(re.compile(r"text-white"))

        page.screenshot(path="verification/bookmark_filled.png")
        print("Captured bookmark_filled.png")

        browser.close()

if __name__ == "__main__":
    import re
    verify_bookmark_button()
