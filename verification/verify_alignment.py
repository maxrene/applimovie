import re
from playwright.sync_api import sync_playwright, expect

def verify_homepage_alignment(page):
    page.goto("http://localhost:8080/index.html")
    page.wait_for_load_state("networkidle")

    # Wait for content to load
    page.wait_for_selector("#continue-watching-section", state="attached")

    # Take screenshot of the homepage
    page.set_viewport_size({"width": 375, "height": 1200})

    # Force display of Continue Watching
    page.evaluate("document.getElementById('continue-watching-section').style.display = 'block'")

    page.wait_for_timeout(1000)
    page.screenshot(path="verification/alignment_check.png")
    print("Screenshot saved to verification/alignment_check.png")

    # Verify padding programmatically - specific headers
    # The header is the FIRST container div in the section
    cw_header = page.locator("#continue-watching-section > div.container").first
    cw_track = page.locator("#continue-watching-container")

    pop_header = page.locator("#popular-section > div.container").first
    pop_track = page.locator("#popular-container")

    net_header = page.locator("#netflix-section > div.container").first
    net_track = page.locator("#netflix-container")

    # Check classes
    expect(cw_header).to_have_class(re.compile(r"px-8"))
    expect(cw_track).to_have_class(re.compile(r"px-8"))

    expect(pop_header).to_have_class(re.compile(r"px-8"))
    expect(pop_track).to_have_class(re.compile(r"px-8"))

    expect(net_header).to_have_class(re.compile(r"px-8"))
    expect(net_track).to_have_class(re.compile(r"px-8"))

    print("Class verification passed")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_homepage_alignment(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
