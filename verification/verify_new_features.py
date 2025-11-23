
import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Setup: Add Breaking Bad to watchlist and mark first 3 episodes as watched
        watchlist = [{"id": 1396, "added_at": "2024-01-01T12:00:00Z"}]
        watched_episodes = {"1396": [62085, 62086, 62087]} # S01E01, S01E02, S01E03

        # Go to the page FIRST, then set up local storage
        await page.goto("http://localhost:8080/watchlist.html")
        await page.evaluate(f"localStorage.setItem('watchlist', '{json.dumps(watchlist)}')")
        await page.evaluate(f"localStorage.setItem('watchedEpisodes', '{json.dumps(watched_episodes)}')")

        # Reload the page for localStorage changes to take effect
        await page.reload()

        # Wait for the initial render of the in-progress item
        await page.wait_for_selector('h3:has-text("Breaking Bad")')
        await page.wait_for_selector('p:has-text("S01 E04")')
        print("Initial state verified: Next episode is S01 E04 for Breaking Bad.")

        # Find and click the "Mark episode as watched" button
        mark_watched_button = page.locator('button[aria-label="Mark episode as watched"]')
        await mark_watched_button.click()
        print("Clicked 'Mark as Watched' for S01 E04.")

        # Wait for the component to re-render with the next episode
        await page.wait_for_selector('p:has-text("S01 E05")')
        print("Verification successful: UI updated to show S01 E05 as the next episode.")

        await page.screenshot(path="verification/new_features_verification.png")
        print("Screenshot taken.")

        await browser.close()

asyncio.run(main())
