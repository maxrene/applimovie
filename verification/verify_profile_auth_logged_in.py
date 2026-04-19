from playwright.sync_api import sync_playwright, expect
import time

def test_profile_auth_logged_in(page):
    page.goto("http://localhost:3000/profile.html")
    time.sleep(1)

    # Mock firebase auth state
    page.evaluate('''
        window.firebaseUser = {
            uid: "google_xyz",
            displayName: "Test User",
            photoURL: "https://via.placeholder.com/150"
        };
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: window.firebaseUser } }));
    ''')

    time.sleep(1) # Give Alpine time to initialize

    # Assert logged in state is visible
    expect(page.locator("text=Test User")).to_be_visible()
    expect(page.locator("text=Données synchronisées")).to_be_visible()
    expect(page.locator("text=Se déconnecter")).to_be_visible()

    # Take screenshot of logged in state
    page.screenshot(path="/home/jules/verification/profile_logged_in.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_profile_auth_logged_in(page)
        finally:
            browser.close()
