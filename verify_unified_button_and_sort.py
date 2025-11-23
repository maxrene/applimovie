
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Clear local storage before starting
        await page.goto('http://localhost:8080/film.html?id=693134')
        await page.evaluate('localStorage.clear()')

        # --- Test Unified Button ---
        await page.goto('http://localhost:8080/film.html?id=693134')
        await page.wait_for_function("document.querySelector('#media-title').textContent.length > 0")

        # Initial state: "Watchlist"
        assert await page.inner_text('#watchlist-button') == 'add\nWatchlist'

        # Click 1: -> "On Watchlist"
        await page.click('#watchlist-button')
        await page.wait_for_selector('#watchlist-button.bg-primary')
        assert await page.inner_text('#watchlist-button') == 'check\nOn Watchlist'

        # Click 2: -> "Watched"
        await page.click('#watchlist-button')
        await page.wait_for_selector('#watchlist-button.bg-green-600')
        assert await page.inner_text('#watchlist-button') == 'visibility\nWatched'

        # Click 3: -> "Watchlist"
        await page.click('#watchlist-button')
        await page.wait_for_selector('#watchlist-button.bg-gray-700')
        assert await page.inner_text('#watchlist-button') == 'add\nWatchlist'

        # Add movies and a series to the list to test sorting and platform filters
        await page.goto('http://localhost:8080/film.html?id=693134') # Dune: Part Two (has platforms)
        await page.wait_for_function("document.querySelector('#media-title').textContent.length > 0")
        await page.click('#watchlist-button')

        await page.goto('http://localhost:8080/film.html?id=1062722') # Frankenstein (no platforms)
        await page.wait_for_function("document.querySelector('#media-title').textContent.length > 0")
        await page.click('#watchlist-button')

        await page.goto('http://localhost:8080/serie.html?id=1396') # Breaking Bad (no platforms)
        await page.wait_for_function("document.querySelector('#media-title').textContent.length > 0")
        await page.click('#watchlist-button')


        # --- Test Sorting Component ---
        await page.goto('http://localhost:8080/mylist.html')
        await page.wait_for_selector('#media-list')

        # Check that platform filters are visible
        await page.wait_for_selector('#platform-filter > button')

        # Default sort: Popularity
        sort_button_text = await page.inner_text('[data-testid="sort-button"]')
        assert 'Popularité' in sort_button_text

        # Click to change sort order
        await page.click('[data-testid="sort-button"]')
        await page.click('text=Date d\'ajout')
        await page.wait_for_function("document.querySelector('[data-testid=\"sort-button\"]').textContent.includes('Date d\\\'ajout')")

        # Take a screenshot
        await page.screenshot(path='verification/unified_button_and_sort_verification.png')

        await browser.close()

asyncio.run(main())
