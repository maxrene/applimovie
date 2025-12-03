function alignCarousels() {
    const headerContainer = document.getElementById('header-container');
    const carousels = document.querySelectorAll('.carousel-track');
    if (headerContainer && carousels.length > 0) {
        // Get the left position of the container
        // The container has mx-auto, so its left position varies.
        // It also has px-4 (16px).
        // We want the carousel content to start where the header content starts.
        // Header content start = rect.left + 16.
        const rect = headerContainer.getBoundingClientRect();
        // Since the carousel container is full width (starts at 0),
        // we set its padding-left to match the header content start.
        const paddingLeft = rect.left + 16;

        carousels.forEach(carousel => {
            carousel.style.paddingLeft = `${paddingLeft}px`;
        });
    }
}

// Run on load and resize
window.addEventListener('load', alignCarousels);
window.addEventListener('resize', alignCarousels);
// Also run immediately in case DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', alignCarousels);
} else {
    alignCarousels();
}
