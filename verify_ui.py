import json
from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock Data for LocalStorage
        user_region = "IE" # Test with Ireland

        previous_searches = [
            {
                "id": 287,
                "name": "Brad Pitt",
                "media_type": "person",
                "profile_path": "/cckcYc2v0yh1tc9QjRelptcOBko.jpg"
            },
            {
                "id": 550,
                "title": "Fight Club",
                "media_type": "movie",
                "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
                "release_date": "1999-10-15"
            },
             {
                "id": 1399,
                "name": "Game of Thrones",
                "media_type": "tv",
                "poster_path": "/1XS1oqL89opfnbGw83trZrcr5uk.jpg",
                "first_air_date": "2011-04-17"
            }
        ]

        # Inject LocalStorage before navigation
        page.add_init_script(f"""
            localStorage.setItem('userRegion', '{user_region}');
            localStorage.setItem('previousSearches', '{json.dumps(previous_searches)}');
            localStorage.setItem('selectedPlatforms', '[]');
        """)

        # Mock API calls
        page.route("**/trending/all/week*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "results": [
                    {
                        "id": 93405,
                        "media_type": "movie",
                        "title": "Squid Game 2",
                        "poster_path": "/d9D2dzxOW4tHish11Cux1xF50pM.jpg"
                    },
                    {
                        "id": 93406,
                        "media_type": "movie",
                        "title": "Mockbuster",
                        "poster_path": "/8xV47NDrjdZDpkVcCFqkdHa3T0C.jpg"
                    }
                ]
            })
        ))

        # 1. Verify Home Flag
        print("Navigating to Home...")
        page.goto("http://localhost:8080/index.html")
        page.wait_for_timeout(2000) # Wait for Alpine init

        # Check Home Flag
        print("Taking Home Screenshot...")
        page.screenshot(path="verification_step1_home_flag.png")

        flag_src = page.locator("header img").first.get_attribute("src")
        print(f"Home Flag Src: {flag_src}")
        if "ie.png" not in flag_src:
            print("ERROR: Home flag does not match userRegion 'IE'")

        # 2. Verify Popular Flag
        print("Switching to Popular...")
        # Interact with the UI instead of window.app to trigger events naturally
        page.get_by_role("button", name="Populaire").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="verification_step2_popular_flag.png")

        # We need to find the header inside popular view. The popular view header has "Populaire" text.
        # Find the header containing "Populaire" and then the img inside it.
        popular_header = page.locator("header").filter(has_text="Populaire")
        p_src = popular_header.locator("img").first.get_attribute("src")
        print(f"Popular Flag Src: {p_src}")
        if "ie.png" not in p_src:
             print("ERROR: Popular flag does not match userRegion 'IE'")

        # 3. Verify Watchlist Flag
        print("Switching to Watchlist...")
        page.get_by_role("button", name="Ma Liste").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="verification_step3_watchlist_flag.png")

        watchlist_header = page.locator("header").filter(has_text="Ma Liste")
        w_src = watchlist_header.locator("img").first.get_attribute("src")
        print(f"Watchlist Flag Src: {w_src}")
        if "ie.png" not in w_src:
             print("ERROR: Watchlist flag does not match userRegion 'IE'")

        # 4. Verify Search UI
        print("Switching to Search...")
        page.get_by_role("button", name="Recherche").click()
        page.wait_for_timeout(1000)

        page.fill("input[type='text']", "")
        page.wait_for_timeout(500)

        print("Taking Search UI Screenshot...")
        page.screenshot(path="verification_step4_search_ui.png")

        # Verify Recent Searches
        recents = page.locator("text=Récent").locator("xpath=following-sibling::div").locator("button")
        count = recents.count()
        print(f"Found {count} recent items")

        if count != 3:
             print(f"ERROR: Expected 3 recent items, found {count}")

        # First item: Brad Pitt (Person)
        item1 = recents.nth(0)
        classes1 = item1.get_attribute("class")
        if "w-20" not in classes1:
            print("ERROR: Person item (Brad Pitt) should have w-20 class")
        else:
            print("Verified: Person item has correct sizing class")

        # Second item: Fight Club (Movie)
        item2 = recents.nth(1)
        classes2 = item2.get_attribute("class")
        if "w-24" not in classes2:
            print("ERROR: Movie item (Fight Club) should have w-24 class")
        else:
             print("Verified: Movie item has correct sizing class")

        # Verify Popular Searches
        populars = page.locator("text=Tendances").locator("xpath=following-sibling::div").locator("button")
        if populars.count() > 0:
            text = populars.first.text_content()
            print(f"First Popular Item Text: '{text}'")
            if "1" in text and "Squid Game" not in text:
                print("WARNING: Ranking number might still be visible")
            else:
                 print("Verified: Ranking number seems absent")

        browser.close()

if __name__ == "__main__":
    verify_changes()
