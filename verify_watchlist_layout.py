import asyncio
import json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Mock data for Stranger Things (ID 66732)
        series_id = 66732
        episode_id = 12345

        mock_series_details = {
            "id": series_id,
            "name": "Stranger Things",
            "poster_path": "/poster.jpg",
            "first_air_date": "2016-07-15",
            "number_of_seasons": 1,
            "number_of_episodes": 8,
            "seasons": [
                {"season_number": 1, "episode_count": 8, "name": "Season 1"}
            ],
            "genres": [{"name": "Sci-Fi"}]
        }

        mock_season_details = {
            "episodes": [
                {"id": episode_id, "episode_number": 1, "season_number": 1, "name": "Chapter One"},
                {"id": 12346, "episode_number": 2, "season_number": 1, "name": "Chapter Two"}
            ]
        }

        # Intercept TMDB API calls
        async def handle_tv_details(route):
            await route.fulfill(json=mock_series_details)

        async def handle_season_details(route):
            await route.fulfill(json=mock_season_details)

        # Route for series details (simplified pattern)
        await page.route(f"**/tv/{series_id}?*", handle_tv_details)

        # Route for season details
        await page.route(f"**/tv/{series_id}/season/1?*", handle_season_details)

        # Inject localStorage before navigation
        await page.goto('http://localhost:8080/watchlist.html')

        await page.evaluate(f"""
            localStorage.setItem('watchlist', JSON.stringify([{{'id': {series_id}, 'type': 'serie', 'added_at': '2023-01-01'}}]));
            localStorage.setItem('watchedEpisodes', JSON.stringify({{{series_id}: [{episode_id}]}}));
            localStorage.setItem('userRegion', 'FR');
        """)

        await page.reload()

        # Switch to 'Séries' tab
        await page.click("button:has-text('Séries')")

        # Wait for the card to appear
        card_selector = f"a[href='serie.html?id={series_id}']"
        await page.wait_for_selector(card_selector)

        # Take screenshot
        await page.screenshot(path='watchlist_layout_verification.png')
        print("📸 Screenshot saved as watchlist_layout_verification.png")

        # Verification Logic (Keep checking for programmatic confirmation)
        img_loc = page.locator(f"img[alt*='Stranger Things']")
        title_loc = page.locator("h3:has-text('Stranger Things')")

        img_box = await img_loc.bounding_box()
        title_box = await title_loc.bounding_box()

        print(f"Image Box: {img_box}")
        print(f"Title Box: {title_box}")

        is_below = title_box['y'] >= (img_box['y'] + img_box['height'] - 10)

        if is_below:
            print("❌ FAILURE: Title is displayed below the image.")
            exit(1)

        print("✅ SUCCESS: Title is displayed correctly next to the image.")

        await browser.close()

asyncio.run(main())
