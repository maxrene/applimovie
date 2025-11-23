
from playwright.sync_api import sync_playwright
import time

def verify_cast_styling():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 1. Desktop Verification
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        page.goto("http://localhost:8080/film.html?id=27205") # Inception

        # Wait for cast to load
        page.wait_for_selector("#full-cast-container a", timeout=5000)

        # Verify grid columns (md:grid-cols-3 or lg:grid-cols-4 should be active)
        # We can check the computed style or just visually inspect via screenshot
        # But we can check class presence
        cast_container = page.locator("#full-cast-container")
        classes = cast_container.get_attribute("class")
        print(f"Desktop Classes: {classes}")

        # Check font sizes
        first_actor = page.locator("#full-cast-container a").first
        name_el = first_actor.locator("p").first
        char_el = first_actor.locator("p").nth(1)

        # text-sm is usually 14px (0.875rem), text-xs is 12px (0.75rem)
        # Tailwind applies classes, so we can check for class names 'text-sm' and 'text-xs'
        # We modified the JS to inject these classes

        # Screenshot Desktop
        page.screenshot(path="verification/cast_desktop.png")
        print("Desktop screenshot saved.")

        # 2. Mobile Verification
        page_mobile = browser.new_page(viewport={'width': 375, 'height': 667})
        page_mobile.goto("http://localhost:8080/film.html?id=27205") # Inception

        # Wait for cast to load
        page_mobile.wait_for_selector("#full-cast-container a", timeout=5000)

        # Screenshot Mobile
        page_mobile.screenshot(path="verification/cast_mobile.png")
        print("Mobile screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_cast_styling()
