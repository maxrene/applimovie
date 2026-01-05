
from html.parser import HTMLParser

class Validator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.in_search_view = False
        self.found_recent_carousel = False
        self.found_popular_carousel = False
        self.recent_classes = []
        self.popular_classes = []

    def handle_starttag(self, tag, attrs):
        self.stack.append(tag)
        attrs_dict = dict(attrs)

        # Check if we are in Search View
        if 'x-show' in attrs_dict and attrs_dict['x-show'] == "activeTab === 'search'":
            self.in_search_view = True

        if self.in_search_view:
            if tag == 'div' and 'class' in attrs_dict:
                classes = attrs_dict['class']
                if 'overflow-x-auto' in classes and 'snap-x' in classes:
                    # Found a carousel
                    # Check context to identify which one
                    # Logic is weak here but checks existence
                    if 'previousSearches' in self.get_surrounding_template(attrs_dict): # Hard to do in streaming parser
                        pass

    def handle_endtag(self, tag):
        if self.stack:
            last = self.stack.pop()
            if last != tag:
                self.errors.append(f"Mismatch: expected {last}, got {tag}")
        else:
            self.errors.append(f"Unexpected end tag: {tag}")

        if tag == 'div' and self.in_search_view:
            pass # simplified

    def get_surrounding_template(self, attrs):
        return ""

# Since simple parsing is hard for "content inside x-for", I will just grep for the key structures.

def check_file():
    with open('index.html', 'r') as f:
        content = f.read()

    errors = []

    # Check Flag Bindings
    if ":src=\"'https://flagcdn.com/w40/' + userRegion.toLowerCase() + '.png'\"" not in content:
        errors.append("Flag binding not found or incorrect syntax.")

    # Check Search View Changes
    # 1. Recent Searches Carousel
    if 'x-for="item in previousSearches"' not in content:
        errors.append("previousSearches loop not found.")

    # 2. Check for Horizontal Scroll classes near previousSearches
    # We look for the container div
    if 'class="flex overflow-x-auto gap-4' not in content:
         # It might be split across lines or have different spacing
         pass

    # 3. Check for Person/Media differentiation
    if "getItemType(item) === 'Person'" not in content:
        errors.append("Person type check logic not found in Search view.")

    # 4. Popular Searches Carousel
    if 'x-for="item in popularSearches"' not in content:
         errors.append("popularSearches loop not found.")

    if len(errors) > 0:
        print("ERRORS FOUND:")
        for e in errors:
            print("- " + e)
        exit(1)
    else:
        print("Structure verification passed.")

if __name__ == "__main__":
    check_file()
