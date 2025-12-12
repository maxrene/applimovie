from playwright.sync_api import sync_playwright, expect
import time

def verify_filters(page):
    # Navigate to the Popular page
    page.goto("http://localhost:8080/popular.html")

    # Wait for the page to load and check header
    expect(page.get_by_role("heading", name="Populaire")).to_be_visible()

    # Verify the 3 filter buttons exist
    # Note: text content might have newlines or spaces, so using text match
    # Button 1: Sort (initially "Popularité")
    sort_btn = page.get_by_role("button", name="Popularité")
    expect(sort_btn).to_be_visible()

    # Button 2: Year (initially "Année")
    year_btn = page.get_by_role("button", name="Année")
    expect(year_btn).to_be_visible()

    # Button 3: Genre (initially "Genres")
    genre_btn = page.get_by_role("button", name="Genres")
    expect(genre_btn).to_be_visible()

    # Take initial screenshot of the header layout
    page.screenshot(path="verification_step1_header.png")

    # --- Verify Year Filter ---
    year_btn.click()
    # Wait for modal
    expect(page.get_by_text("Année de sortie")).to_be_visible()

    # Select "Cette année"
    page.get_by_role("button", name="Cette année").click()

    # Click Apply
    page.get_by_role("button", name="Appliquer").click()

    # Verify the button text updated (e.g. "2024" or "2025" depending on system time)
    # Just checking it's not "Année" anymore or verifying part of it
    # Actually, if yearStart == yearEnd, it shows the single year.
    # Let's take a screenshot to verify
    time.sleep(1) # wait for animation/update
    page.screenshot(path="verification_step2_year_applied.png")

    # --- Verify Genre Filter ---
    genre_btn.click()
    # Wait for modal
    expect(page.get_by_text("Genres", exact=True).first).to_be_visible()

    # Select a genre (assuming data fetched correctly or mocking)
    # If API fetch fails, we might see empty list.
    # Let's check if we see any buttons in the genre list (checking for common genre names)
    # We'll wait a bit for the fetch
    time.sleep(2)

    # Try to find "Action" or "Comédie"
    # Note: Text depends on TMDB response language. User set 'fr-FR'.
    # We can try to click the first available genre button in the grid
    # Selector: inside the genre modal grid
    genre_buttons = page.locator(".grid-cols-2 button")
    if genre_buttons.count() > 0:
        genre_buttons.first.click()
        # Click Apply
        page.get_by_role("button", name="Appliquer").click()
        time.sleep(1)
        page.screenshot(path="verification_step3_genre_applied.png")
    else:
        print("No genres found. API might be failing or blocked.")
        page.screenshot(path="verification_step3_no_genres.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use mobile viewport to verify the "fits on one line" requirement
        context = browser.new_context(viewport={"width": 375, "height": 667})
        page = context.new_page()
        try:
            verify_filters(page)
        finally:
            browser.close()
