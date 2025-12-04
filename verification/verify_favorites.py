from playwright.sync_api import sync_playwright, expect
import json
import time
import re

def verify_favorite_actors():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Define a favorite actor to inject into localStorage
        favorite_actor = [{
            "id": 1136406, # Tom Holland
            "name": "Tom Holland",
            "profile_path": "/2qhIDp44cAqP2clOgt2afQI0760.jpg"
        }]

        # Inject favorite actor into localStorage
        # We need to navigate to the domain first
        page.goto("http://localhost:8080/index.html")
        page.evaluate(f"localStorage.setItem('favoriteActors', '{json.dumps(favorite_actor)}')")

        # 1. Verify Homepage Section
        print("Verifying Homepage Section...")
        page.reload()
        page.wait_for_load_state("networkidle")

        # Wait for the section to appear (it's dynamically loaded)
        favorite_section = page.locator("#favorite-actors-section")
        expect(favorite_section).to_be_visible(timeout=10000)

        # Take screenshot of homepage with favorite actors
        page.screenshot(path="verification/homepage_favorites.png")
        print("Homepage verified.")

        # 2. Verify Profile Page Link
        print("Verifying Profile Page Link...")
        page.goto("http://localhost:8080/profile.html")

        # Check if the "Vos acteurs préférés" link exists and has correct count
        actors_link = page.locator("a[href='favorite_actors.html']")
        expect(actors_link).to_be_visible()
        expect(actors_link).to_contain_text("Vos acteurs préférés")
        expect(actors_link).to_contain_text("1 ajoutés")

        page.screenshot(path="verification/profile_link.png")
        print("Profile link verified.")

        # 3. Verify Favorite Actors Page
        print("Verifying Favorite Actors Page...")
        actors_link.click()
        page.wait_for_load_state("networkidle")

        # Check if actor is displayed
        actor_card = page.locator(f"a[href='person.html?id={favorite_actor[0]['id']}']")
        expect(actor_card).to_be_visible()
        expect(actor_card).to_contain_text("Tom Holland")

        page.screenshot(path="verification/favorite_actors_page.png")
        print("Favorite actors page verified.")

        # 4. Verify Person Page Toggle
        print("Verifying Person Page Toggle...")
        actor_card.click()
        page.wait_for_load_state("networkidle")

        # Check if bookmark icon is active (primary color)
        # The bookmark button is the second button in the header.
        bookmark_btn = page.locator("header button").nth(1)

        # Expect text-primary to be present in the class attribute
        expect(bookmark_btn).to_have_class(re.compile(r"text-primary"))

        # Click to toggle off
        bookmark_btn.click()

        # Should now be white
        expect(bookmark_btn).to_have_class(re.compile(r"text-white"))

        page.screenshot(path="verification/person_toggle.png")
        print("Person toggle verified.")

        browser.close()

if __name__ == "__main__":
    verify_favorite_actors()
