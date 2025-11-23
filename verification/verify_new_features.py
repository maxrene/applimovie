
import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Local storage setup for watchlist
        watchlist = [
            {"id": 1396, "added_at": "2024-01-01T12:00:00Z"},  # Breaking Bad
        ]
        await page.goto("http://localhost:8080/watchlist.html")
        await page.evaluate(f"localStorage.setItem('watchlist', '{json.dumps(watchlist)}')")

        # Local storage for watched episodes
        watched_episodes = {
            "1396": [62085, 62086, 62087] # S01E01, S01E02, S01E03
        }
        await page.evaluate(f"localStorage.setItem('watchedEpisodes', '{json.dumps(watched_episodes)}')")

        await page.goto("http://localhost:8080/watchlist.html")

        # Wait for dynamic content to load
        await page.wait_for_selector('.flex-1 h3')

        await asyncio.sleep(2) # Extra wait for async rendering

        # Verification checks
        next_episode_text = await page.text_content('.text-\\[10px\\]')
        if "Next: S01E04" not in next_episode_text:
            print(f"Verification failed: 'Next Episode' text is incorrect. Found: {next_episode_text}")
            await browser.close()
            return

        logo = await page.query_selector('img[alt="Netflix"]')
        if not logo:
             print("Verification failed: Platform logo not found.")
             await browser.close()
             return

        print("Verification successful!")
        await page.screenshot(path="verification/new_features_verification.png")
        await browser.close()

asyncio.run(main())
