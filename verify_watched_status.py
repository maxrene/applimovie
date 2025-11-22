
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen for console messages and errors
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        # Navigate to a movie page
        await page.goto('http://localhost:8080/film.html?id=693134')
        await page.wait_for_function("document.querySelector('#media-title').textContent.length > 0")

        # Add to watchlist and mark as watched
        await page.click('#watchlist-button')
        await page.click('#watched-button')

        # Navigate to a series page
        await page.goto('http://localhost:8080/serie.html?id=1396')
        await page.wait_for_function("document.querySelector('#media-title').textContent.length > 0")

        # Add to watchlist and mark as watched
        await page.click('#watchlist-button')
        await page.click('#watched-button')

        # Go to mylist page
        await page.goto('http://localhost:8080/mylist.html')
        await page.wait_for_selector('#media-list')

        # Switch to movies tab and check for the movie
        await page.click('text=Movies')
        await page.wait_for_selector('a[href="film.html?id=693134"]')
        await page.wait_for_selector('a[href="film.html?id=693134"] .bg-green-500')

        # Switch to TV shows tab and check for the series
        await page.click('text=TV Shows')
        await page.wait_for_selector('a[href="serie.html?id=1396"]')
        await page.wait_for_selector('a[href="serie.html?id=1396"] .bg-green-500')

        # Take a screenshot
        await page.screenshot(path='/home/jules/verification/watched_status_verification.png')

        await browser.close()

asyncio.run(main())
