from bs4 import BeautifulSoup
import sys

with open('film.html', 'r') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

# Check for banner height
banner_container = soup.find('div', class_='relative h-64')
if not banner_container:
    print("Error: Banner container with height h-64 not found.")
    sys.exit(1)

# Check for poster overlapping
poster_container = soup.find('div', class_='relative -mt-28 mb-4')
if not poster_container:
    print("Error: Poster overlapping container (-mt-28) not found.")
    sys.exit(1)

# Check for rating element
rating_el = soup.find(id='media-rating')
if not rating_el:
    print("Error: media-rating element not found.")
    sys.exit(1)

# Check for genres element below metadata
genres_el = soup.find(id='media-genres')
if not genres_el:
    print("Error: media-genres element not found.")
    sys.exit(1)

# Check for watchlist button full width
watchlist_btn = soup.find(id='watchlist-button')
if not watchlist_btn or 'w-full' not in watchlist_btn.get('class', []):
    print("Error: watchlist-button not found or not full width.")
    sys.exit(1)

# Check for absence of play button (simplified check)
svgs = banner_container.find_all('svg')
if len(svgs) > 0:
    print("Error: Found SVG in banner container, might be the play button.")
    sys.exit(1)

# Check for IMDb badge absence
imdb_badge = soup.find(id='media-imdb')
if imdb_badge:
    print("Error: media-imdb element should not exist.")
    sys.exit(1)

print("Verification passed!")
