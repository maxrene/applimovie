document.addEventListener('DOMContentLoaded', () => {
    const allPlatforms = [
        { 
            id: 'netflix', 
            apiId: 8, 
            name: 'Netflix', 
            logoUrl: 'https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456' 
        },
        { 
            id: 'prime', 
            apiId: 119, 
            name: 'Prime Video', 
            logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Amazon_Prime_Video_logo_%282024%29.svg/1024px-Amazon_Prime_Video_logo_%282024%29.svg.png' 
        },
        { 
            id: 'disney', 
            apiId: 337, 
            name: 'Disney+', 
            logoUrl: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/25357066/Disney__Logo_March_2024.png?quality=90&strip=all&crop=0,0,100,100' 
        },
        { 
            id: 'apple', 
            apiId: 350, 
            name: 'Apple TV+', 
            logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/AppleTVLogo.svg/768px-AppleTVLogo.svg.png' 
        },
        { 
            id: 'canal', 
            apiId: 392, 
            name: 'Canal+', 
            logoUrl: 'https://static1.purepeople.com/articles/0/46/23/10/@/6655765-logo-de-la-chaine-canal-1200x0-2.png' 
        },
        { 
            id: 'paramount', 
            apiId: 531, 
            name: 'Paramount+', 
            logoUrl: 'https://images.seeklogo.com/logo-png/39/1/paramount-logo-png_seeklogo-397501.png' 
        },
        { id: 'max', apiId: 1899, name: 'Max', logoUrl: 'https://logo.clearbit.com/max.com' },
        { id: 'skygo', apiId: 29, name: 'Sky Go', logoUrl: 'https://logo.clearbit.com/sky.com' },
        { id: 'now', apiId: 39, name: 'Now', logoUrl: 'https://logo.clearbit.com/nowtv.com' },
        { id: 'rakuten', apiId: 35, name: 'Rakuten TV', logoUrl: 'https://logo.clearbit.com/rakuten.tv' },
        { id: 'pluto', apiId: 300, name: 'Pluto TV', logoUrl: 'https://logo.clearbit.com/pluto.tv' },
        { id: 'crunchyroll', apiId: 283, name: 'Crunchyroll', logoUrl: 'https://logo.clearbit.com/crunchyroll.com' },
        { id: 'arte', apiId: 234, name: 'Arte', logoUrl: 'https://logo.clearbit.com/arte.tv' }
    ];

    const platformsContainer = document.getElementById('platforms-container');
    const saveButton = document.getElementById('save-platforms');

    function getSelectedPlatforms() {
        const saved = localStorage.getItem('selectedPlatforms');
        return saved ? JSON.parse(saved) : [];
    }

    function renderPlatforms() {
        const selected = getSelectedPlatforms();
        let html = '';
        allPlatforms.forEach(platform => {
            const isChecked = selected.includes(platform.id);
            html += `
                <div class="platform-item relative flex flex-col items-center gap-2">
                    <input ${isChecked ? 'checked' : ''} class="hidden" id="${platform.id}" type="checkbox"/>
                    <label class="relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-all duration-200 hover:scale-105 overflow-hidden" for="${platform.id}">
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
        window.location.href = 'profile.html';
    }

    if(saveButton) saveButton.addEventListener('click', saveSelectedPlatforms);
    if(platformsContainer) renderPlatforms();
});
