document.addEventListener('DOMContentLoaded', () => {
    // Liste enrichie des plateformes européennes
    const allPlatforms = [
        { id: 'netflix', apiId: 8, name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjDaoV36ipKs6n.jpg' },
        { id: 'prime', apiId: 119, name: 'Prime Video', logoUrl: 'https://image.tmdb.org/t/p/original/emthp39XA2YScoU8t5t7TB3Vgnh.jpg' },
        { id: 'disney', apiId: 337, name: 'Disney+', logoUrl: 'https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
        { id: 'apple', apiId: 350, name: 'Apple TV+', logoUrl: 'https://image.tmdb.org/t/p/original/2E03IAfXddG5uqCtzsME3sRSfvi.jpg' },
        { id: 'canal', apiId: 392, name: 'Canal+', logoUrl: 'https://image.tmdb.org/t/p/original/9a1c28D5E3s5rY1s6t7Q8oJ8j8.jpg' },
        { id: 'paramount', apiId: 531, name: 'Paramount+', logoUrl: 'https://image.tmdb.org/t/p/original/h5t071f4q5l9t5h4nK5j1l8f3.jpg' },
        { id: 'max', apiId: 1899, name: 'Max', logoUrl: 'https://image.tmdb.org/t/p/original/61M6r4f6p2p4p2p4p2p4.jpg' }, // Max (ex-HBO)
        { id: 'skygo', apiId: 29, name: 'Sky Go', logoUrl: 'https://image.tmdb.org/t/p/original/1qm5l5r5l5r5l5.jpg' }, // Populaire en UK/IE
        { id: 'now', apiId: 39, name: 'Now', logoUrl: 'https://image.tmdb.org/t/p/original/p3Z1z1z1z1.jpg' }, // Populaire en UK/IE
        { id: 'rakuten', apiId: 35, name: 'Rakuten TV', logoUrl: 'https://image.tmdb.org/t/p/original/b8l8l8l8l8.jpg' },
        { id: 'pluto', apiId: 300, name: 'Pluto TV', logoUrl: 'https://image.tmdb.org/t/p/original/r1r1r1r1r1.jpg' },
        { id: 'crunchyroll', apiId: 283, name: 'Crunchyroll', logoUrl: 'https://image.tmdb.org/t/p/original/mXeC4TrcgdU6ltE9bCBCE.jpg' },
        { id: 'arte', apiId: 234, name: 'Arte', logoUrl: 'https://image.tmdb.org/t/p/original/3l3l3l3l3l.jpg' }
    ];

    const platformsContainer = document.getElementById('platforms-container');
    const saveButton = document.getElementById('save-platforms');

    // Récupère les plateformes (liste d'IDs string 'netflix', 'prime'...)
    function getSelectedPlatforms() {
        const saved = localStorage.getItem('selectedPlatforms');
        return saved ? JSON.parse(saved) : [];
    }

    function renderPlatforms() {
        const selected = getSelectedPlatforms();
        let html = '';
        allPlatforms.forEach(platform => {
            // On vérifie si l'ID (ex: 'netflix') est dans la liste sauvegardée
            const isChecked = selected.includes(platform.id);
            html += `
                <div class="platform-item relative flex flex-col items-center gap-2">
                    <input ${isChecked ? 'checked' : ''} class="hidden" id="${platform.id}" type="checkbox"/>
                    <label class="relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-all duration-200 hover:scale-105" for="${platform.id}">
                        <img alt="${platform.name}" class="h-full w-full rounded-full object-cover bg-gray-800" src="${platform.logoUrl}" onerror="this.src='https://placehold.co/100x100?text=${platform.name[0]}'"/>
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
        // Retourne au profil
        window.location.href = 'profile.html';
    }

    if(saveButton) saveButton.addEventListener('click', saveSelectedPlatforms);
    if(platformsContainer) renderPlatforms();
});
