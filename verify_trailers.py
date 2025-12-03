from playwright.sync_api import sync_playwright, expect

def verify_trailers(page, url, screenshot_name):
    """Navigue vers une URL, vérifie la section des bandes-annonces et prend une capture d'écran."""
    page.goto(url)
    trailers_section = page.locator("#trailers-section")
    expect(trailers_section).to_be_visible(timeout=15000)

    first_trailer_link = page.locator("#trailers-container a").first
    expect(first_trailer_link).to_be_visible(timeout=15000)

    page.screenshot(path=screenshot_name, full_page=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Vérifier la page du film
        verify_trailers(page, "http://localhost:8080/film.html?id=872585", "film_trailers.png")

        # Vérifier la page de la série
        verify_trailers(page, "http://localhost:8080/serie.html?id=94605", "serie_trailers.png")

        browser.close()

if __name__ == "__main__":
    main()
