from playwright.sync_api import sync_playwright, expect
import time

def verify_homepage_spacing():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Navigate to homepage
        print("Navigating to homepage...")
        page.goto("http://localhost:8080/index.html")

        # Wait for content to load
        try:
            page.wait_for_selector("#popular-container", timeout=5000)
            # wait a bit for styles to apply and any js layout
            time.sleep(1)
        except Exception as e:
            print(f"Error waiting for selector: {e}")

        # Verify Headers have px-8 (padding-left: 32px)
        headers = [
            ("#header-container", "Main Header"),
            ("#popular-section .container", "Popular Header"),
            ("#netflix-section .container", "Netflix Header"),
            ("#prime-video-section .container", "Prime Header")
        ]

        print("\nChecking headers for px-8 or 32px padding...")
        for selector, name in headers:
            try:
                element = page.locator(selector).first
                if not element.is_visible():
                     print(f"SKIP: {name} not visible")
                     continue

                # Check class
                class_attr = element.get_attribute("class") or ""
                if "px-8" in class_attr:
                    print(f"PASS: {name} ({selector}) has px-8 class")
                else:
                    print(f"FAIL: {name} ({selector}) missing px-8. Classes: {class_attr}")

                # Check computed style
                padding_left = element.evaluate("el => window.getComputedStyle(el).paddingLeft")
                if padding_left == "32px":
                    print(f"PASS: {name} computed padding-left is 32px")
                else:
                    print(f"FAIL: {name} computed padding-left is {padding_left}")
            except Exception as e:
                print(f"ERROR checking {name}: {e}")

        # Verify Carousels have pl-8 (padding-left: 32px)
        carousels = [
            ("#popular-container", "Popular Carousel"),
            ("#netflix-container", "Netflix Carousel"),
            ("#prime-video-container", "Prime Carousel")
        ]

        print("\nChecking carousels for pl-8 or 32px padding...")
        for selector, name in carousels:
            try:
                element = page.locator(selector).first

                # Check class
                class_attr = element.get_attribute("class") or ""
                if "pl-8" in class_attr:
                    print(f"PASS: {name} ({selector}) has pl-8 class")
                else:
                    print(f"FAIL: {name} ({selector}) missing pl-8. Classes: {class_attr}")

                # Check computed style
                padding_left = element.evaluate("el => window.getComputedStyle(el).paddingLeft")
                if padding_left == "32px":
                    print(f"PASS: {name} computed padding-left is 32px")
                else:
                    print(f"FAIL: {name} computed padding-left is {padding_left}")
            except Exception as e:
                print(f"ERROR checking {name}: {e}")

        # Screenshot
        page.screenshot(path="verification/homepage_spacing.png", full_page=True)
        print("\nScreenshot saved to verification/homepage_spacing.png")

        browser.close()

if __name__ == "__main__":
    verify_homepage_spacing()
