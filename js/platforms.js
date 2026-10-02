document.addEventListener('DOMContentLoaded', () => {
    const allPlatforms = window.PLATFORMS_CATALOG || [
        { id: 'netflix', apiId: 8, name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
        { id: 'prime', apiId: 119, name: 'Prime Video', logoUrl: 'https://image.tmdb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg' },
        { id: 'disney', apiId: 337, name: 'Disney+', logoUrl: 'https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg' },
        { id: 'apple', apiId: 350, name: 'Apple TV+', logoUrl: 'https://image.tmdb.org/t/p/original/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg' },
        { id: 'canal', apiId: 381, name: 'Canal+', logoUrl: 'https://image.tmdb.org/t/p/original/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg' },
        { id: 'paramount', apiId: 531, name: 'Paramount+', logoUrl: 'https://image.tmdb.org/t/p/original/h5DcR0J2EESLitnhR8xLG1QymTE.jpg' },
        { id: 'max', apiId: 1899, name: 'Max', logoUrl: 'https://image.tmdb.org/t/p/original/jbe4gVSfRlbPTdESXhEKpornsfu.jpg' },
        { id: 'skygo', apiId: 29, name: 'Sky Go', logoUrl: 'https://image.tmdb.org/t/p/original/1UrT2H9x6DuQ9ytNhsSCUFtTUwS.jpg' },
        { id: 'now', apiId: 39, name: 'Now', logoUrl: 'https://image.tmdb.org/t/p/original/g0E9h3JAeIwmdvxlT73jiEuxdNj.jpg' },
        { id: 'rakuten', apiId: 35, name: 'Rakuten TV', logoUrl: 'https://image.tmdb.org/t/p/original/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg' },
        { id: 'pluto', apiId: 300, name: 'Pluto TV', logoUrl: 'https://image.tmdb.org/t/p/original/dB8G41Q6tSL5NBisrIeqByfepBc.jpg' },
        { id: 'crunchyroll', apiId: 283, name: 'Crunchyroll', logoUrl: 'https://image.tmdb.org/t/p/original/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg' },
        { id: 'arte', apiId: 234, name: 'Arte', logoUrl: 'https://image.tmdb.org/t/p/original/vPZrjHe7wvALuwJEXT2kwYLi0gV.jpg' }
    ];

    const platformsContainer = document.getElementById('platforms-container');
    const saveButton = document.getElementById('save-platforms');

    function getSelectedPlatforms() {
        return getSafeLocalStorage('selectedPlatforms', []);
    }

    function renderPlatforms() {
        const selected = getSelectedPlatforms();
        let html = '';
        allPlatforms.forEach(platform => {
            const isChecked = selected.includes(platform.id);
            html += `
                <div class="platform-item relative flex flex-col items-center gap-2">
                    <input ${isChecked ? 'checked' : ''} class="hidden" id="${platform.id}" type="checkbox"/>
                    <label class="relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-all duration-200 hover:scale-105 overflow-hidden shadow-md" for="${platform.id}">
                        <img alt="${platform.name}" class="h-full w-full object-cover bg-black" src="${platform.logoUrl}" onerror="this.src='https://placehold.co/100x100?text=${platform.name[0]}'"/>
                        
                        <div class="check-icon absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background-light bg-primary text-white opacity-0 transition-all duration-200 dark:border-background-dark">
                            <span class="material-symbols-outlined" style="font-size: 16px;">check</span>
                        </div>
                    </label>
                    <p class="text-slate-800 dark:text-slate-200 text-xs font-medium text-center truncate w-full">${platform.name}</p>
                </div>
            `;
        });
        platformsContainer.innerHTML = html;
    }

    function saveSelectedPlatforms() {
        const selected = [];
        const checkboxes = document.querySelectorAll('#platforms-container input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.push(checkbox.id);
            }
        });
        localStorage.setItem('selectedPlatforms', JSON.stringify(selected));
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'profile.html';
        }
    }

    if (saveButton) saveButton.addEventListener('click', saveSelectedPlatforms);
    if (platformsContainer) renderPlatforms();

    window.addEventListener('cloud-data-synced', () => {
        if (platformsContainer) renderPlatforms();
    });
});
