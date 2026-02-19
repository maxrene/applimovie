from playwright.sync_api import sync_playwright
import time

def verify_watchlist_interaction():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load a series page (e.g., Breaking Bad ID 1396 or Stranger Things 66732)
        # Using a known ID that works with the API key provided in config.js
        # Let's use 1396 (Breaking Bad)
        page.goto("http://localhost:8080/serie.html?id=1396")
        page.wait_for_load_state("networkidle")

        # Wait for the button to appear
        watchlist_button = page.locator("#watchlist-button")
        watchlist_button.wait_for()

        print(f"Initial button text: '{watchlist_button.inner_text()}'")

        # Check initial state
        if "Ajouter à ma liste" not in watchlist_button.inner_text():
             print(f"FAIL: Initial button text is unexpected. Got: '{watchlist_button.inner_text()}'")

        # Click the button to add to watchlist
        print("Clicking 'Add to Watchlist'...")
        watchlist_button.click()
        page.wait_for_timeout(1000) # Wait for UI update

        print(f"Button text after click 1: '{watchlist_button.inner_text()}'")
        if "Dans ma liste" not in watchlist_button.inner_text():
            print("FAIL: Button text did not change to 'Dans ma liste'.")

        # Click the button again to trigger modal
        print("Clicking 'In Watchlist' (should trigger modal)...")
        watchlist_button.click()
        page.wait_for_timeout(1000)

        modal = page.locator("#confirmation-modal")
        if modal.is_visible():
            print("Modal is visible.")
            modal_text = modal.locator("p").inner_text()
            print(f"Modal text: '{modal_text}'")

            if "Voulez-vous marquer tous les épisodes comme vus ?" not in modal_text:
                print(f"FAIL: Modal text mismatch. Got: '{modal_text}'")

            # Click confirm
            print("Clicking 'Oui'...")
            page.locator("#modal-confirm-button").click()

            # Wait for async operations (fetching seasons etc)
            # The button text changes to '...' then to final state
            # We need to wait enough time
            page.wait_for_timeout(5000)

            print(f"Button text after modal confirm: '{watchlist_button.inner_text()}'")
            if "Vu" not in watchlist_button.inner_text():
                print("FAIL: Button text did not change to 'Vu'.")
            else:
                print("SUCCESS: Flow completed correctly.")

        else:
            print("FAIL: Modal did not appear.")

        browser.close()

if __name__ == "__main__":
    verify_watchlist_interaction()
