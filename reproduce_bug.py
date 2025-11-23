
import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 1. Setup LocalStorage
        await page.goto('http://localhost:8080/watchlist.html')

        watchlist = [{"id": 693134, "type": "movie"}] # Dune 2
        selected_platforms = ["canal"] # Dune 2 is NOT on Canal

        await page.evaluate(f"""() => {{
            localStorage.setItem('watchlist', '{json.dumps(watchlist)}');
            localStorage.setItem('selectedPlatforms', '{json.dumps(selected_platforms)}');
            localStorage.setItem('userRegion', 'FR');
        }}""")

        # 2. Reload to apply changes
        await page.reload()

        # 3. Wait for content
        try:
            await page.wait_for_selector('#media-list .relative', timeout=10000)
            print("✅ Media item found in DOM.")

            # Check text content
            content = await page.content()
            if "Dune" in content:
                print("✅ Dune is visible.")
            else:
                print("❌ Dune is NOT visible (text not found).")

            # Check if it's hidden via CSS?
            visible = await page.is_visible('#media-list .relative')
            if visible:
                print("✅ Dune element is visible.")
            else:
                print("❌ Dune element is hidden.")

        except Exception as e:
            print(f"❌ Media item NOT found: {e}")
            content = await page.content()
            print("Page content dump:")
            print(content)

        await browser.close()

asyncio.run(main())
