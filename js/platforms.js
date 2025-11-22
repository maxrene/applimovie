document.addEventListener('DOMContentLoaded', () => {
    const allPlatforms = [
        { id: 'netflix', name: 'FlixNet', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC0rIaugx3YyVBcESzwX2dFsnoHm5B0b0WDyWKNVUHquDGKPEb_CHN1yht5SLbKULWsYhjqBibOYAGD-BnmqVhj5aulPTi9Kd0gOaUU4fRZOq2R_B_SOikLDCnJS--3EZYe6HSmRgPsCVGTsZafBM5m3RTAShVZehiTXFlKtEevgoEj1FcX_fOwHTmobnQgwPqcpkX9kdXZZzRpvOkHmiMpQKrpAjXzhKomSoHF2Pas5Tx9tXJFxaetT7OQPi83B4fNaOIXIFtDNa8L' },
        { id: 'prime', name: 'Prime Video', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBT5h0V32YyOdVJXW5EjGwHOaQH4LSi9YpQLEMrTHOLiS0NtOBka7f810AsHBY0VZgbTxKPD7CURemU0Bo-kiMRwG49r6CDsD6sP202J7n39sDybcMU0XSmQd5Ua61cmq6I63hgstmk7Prbt3wEEkp_hPykKxOpsesfXTLMh8iwLTIjCahoRKkf4xhbbDG0QUU-oZrSfVS5AfdJFL4Hu6hT-WuvdHgDScDxwIt55-x3aqo20_SRAH4KrR3AB2AM0H_z0S9fRYOFXZJJ' },
        { id: 'max', name: 'Max', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIWPTKqt0FF83nx1vm37Lm26KzMKmA3TVMgTcTPBYhxjbrUuYyLZmw6xBQw1mc4iV9YMJKx88TxU_A5Gm07JIAYJZDghjX047keIA3tGXWqm5WMAOR75AwK_LLY-UhAnwVQBov7_zhYuzDTAi-Cp-j5G8m20HSGKsO_Jr6g6JzSiaqecf8TB4RPxHvDCHToblQU14-giltQ9shwZKSAnhChc9pLoYmXUHn50wa4hywJv_-zWE9E-rj9A8wX4pU1QPQcICnhUNWMcSK' },
        { id: 'disney', name: 'Disney+', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8PuXbrn6vbG7jvEzqcKNzTiJ_otn5zhGtFxc2O25nkP7Op_YCK0GzRkhmJQDGymI11CLc9mWz6UgRFh6PESgakbQ0l6eLehsD_K2U3pUK56eMqqm-NTmfON9rUt8VcLhdjReYqwcRZ6ZIYgtdp1YLTXGn7eQrIMK4Mjt4tGpRAjisGiYEOY2Wx0W4kGWoflYFTuSplsujUws9_OgDB01ojHIDV7gb88mHq72NqxnRhKMVU7uA_WVYyVW7V62oRuPqRUN1q2aUUXVz' },
        { id: 'hulu', name: 'Hulu', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxHQEbVOdpJ5aRGpDfjXLrkddaQJt-BAGxzhu5p1GaNi1Gnrza6i3ZzasgkHF6oPuiu3hp8VdIuwQYmEp9WK0aKbW-szvI2bTjXMPdymzvzi82SGeUpj88SoejcnBb11MDCV4qwBpPc1rgcxBi7wjZM66qjS_vjKy7pdzwAufVolCYDyk5bxzFxN3LfWiydnYXXwzygOviv_vnUlZFyZsN5kLTiaUBTQFgJ6j0nnnV1TFlKkLft2DU0I6wBeM2EnVAEwwWLKsP36Qp' },
        { id: 'apple', name: 'Apple TV+', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyk5bySVHPhnxCCgjtup-sOnBAoTktS5TQSwVXUF7IrhSAvRBRZorqaV9q32nUOXGZPdF9n8qbIae9P5HxAwaV6FdldIAxo9SuSOoIbqfNIgM9Qj18za8ZgL0KNTewFcfWXtSwi6DxhpbpdPKq7zTvDok7wI0A9nKYdzscquYNo4eAUg_cc3MLJB-eKcO6QgCn37Vix25I_ea0VsaC_pgyrYEFIfgbdZnKszvrq-NiotfJaDplPKLDbzcRxbZeCA7Mqazq4M2Xgz8q' },
        { id: 'paramount', name: 'Paramount+', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNbGu1y6tgb3BR8z_aRDhn3ssq2or1yMkpGsRCUEhM0CDAi4r0vHfmghWRAaKSpLCGO2COI5utUi3FKaTtv6Sv_I71DYyUg-FhbDYILB-AfjTH9zhj0UIY0-Q-nKcq-7IHk4JetD12vx1uJqH-1BhaXLpKCSJcFYC4usb_NT2sY2ABCy4wckRGl3UMSxaPyFNYlUDyoY0s0PEwB9SyJQfOaE_2dHTyF4dIehNVbQK4jUwcUGZoWHuzcnRZ2EqLjzhTxtdnG4dGF9yk' },
        { id: 'peacock', name: 'Peacock', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDeze1gDudH7YKSg3h996d6Q64ia9z3j4P8UrldUu3vGqKYBpXxmVAqtkMqqzsW0bMD1E1PCnsCnp-aXxQBqWFSYL6EkE0BThxEsevUUrPAKTrLAU1YD7OtRsxerCTLj0VkopEQddptYRDAQQRBjm-dZCb3ZLPXIWnei1wNp58bEcKGdWOwR-7V4wHe1xIxL2Fpm7p5F7_JkWWMxy-rddNRn0UuGZ2-etwrQx8Wbqv7VOrRWxzEU3aXjsShxL-6ebnQ6pkV_AVZlJve' },
        { id: 'canal', name: 'Canal+', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCwmDVp3KIvRQJINpqlB8rlH47plMN1JowJPjx7s8Zw4zwpfEXGKU1vGyDC9SRl58jBcJEVZZiSbN63J4nP8QyDjRyvmBSqEdyTrFYY4ko0xF9_PZSI1DPpePNuzNK8gYYOpVUA5wIvhHrXzrpYbdJGS9TolQR21PGy0Lr2sHaE56l2u6xMZnnmco-mfajtOSFddH5kmfmmGwmunN60TFW4nMPAW8-BiXmmPl-FFPOhWUEpKThnxn2gHw9U7NXZZAMFYUdhwckp5V6f' },
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
                    <label class="relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-all duration-200" for="${platform.id}">
                        <img alt="${platform.name} logo" class="h-full w-full rounded-full object-cover" src="${platform.logoUrl}"/>
                        <div class="check-icon absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background-light bg-primary text-white opacity-0 transition-all duration-200 dark:border-background-dark" style="transform: scale(0.5);">
                            <span class="material-symbols-outlined" style="font-size: 16px;">check</span>
                        </div>
                    </label>
                    <p class="text-slate-800 dark:text-slate-200 text-sm font-medium text-center truncate w-full">${platform.name}</p>
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

    saveButton.addEventListener('click', saveSelectedPlatforms);

    renderPlatforms();
});
