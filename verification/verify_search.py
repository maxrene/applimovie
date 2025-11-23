from playwright.sync_api import sync_playwright

def verify_search_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            device_scale_factor=2
        )
        page = context.new_page()

        # Mock TMDB API responses
        # Mock Popular
        page.route("**/trending/all/week*", lambda route: route.fulfill(
            status=200,
            body='{"results": [{"id": 1, "title": "Mock Popular Movie", "poster_path": "/path.jpg", "release_date": "2023-01-01", "vote_average": 8.5, "media_type": "movie"}]}'
        ))

        # Mock Search
        page.route("**/search/multi*", lambda route: route.fulfill(
            status=200,
            body='{"results": [{"id": 2, "title": "Mock Search Result", "poster_path": "/path2.jpg", "release_date": "2024-05-05", "vote_average": 7.2, "media_type": "movie"}]}'
        ))

        # 1. Verify Default State (Recent + Popular)
        # Pre-populate localStorage for Recent Searches
        page.goto("http://localhost:8080/search.html")
        page.evaluate("""() => {
            localStorage.setItem('previousSearches', JSON.stringify([
                {id: 99, title: 'Mock Recent Movie', poster_path: null, release_date: '2022-02-02', vote_average: 6.0, media_type: 'movie'}
            ]));
            localStorage.setItem('userRegion', 'FR');
            window.location.reload();
        }""")

        page.wait_for_timeout(500) # Wait for reload

        # Check if "Recherches récentes" is visible
        print("Checking Recent Searches...")
        page.wait_for_selector("text=Recherches récentes")
        page.screenshot(path="verification/search_default.png")
        print("Default state screenshot saved.")

        # 2. Verify Search Input (Text type)
        input_type = page.get_attribute("input", "type")
        if input_type == "text":
            print("Input type is correctly set to 'text'")
        else:
            print(f"Input type is '{input_type}' (expected 'text')")

        # 3. Verify Search Results State
        print("Typing search query...")
        page.fill("input", "Test")

        # Wait for results
        page.wait_for_selector("text=Mock Search Result")

        # Verify result item content (Year and Rating)
        content = page.text_content("body")
        if "2024" in content and "7.2" in content:
            print("Search result contains Year and Rating.")
        else:
            print("Search result missing Year or Rating.")

        page.screenshot(path="verification/search_results.png")
        print("Search results screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_search_ui()
