// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    getAuth,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCldfmyF2qg8_CzYURFvVm35u194-o89MU",
    authDomain: "cinemovie-56c80.firebaseapp.com",
    projectId: "cinemovie-56c80",
    storageBucket: "cinemovie-56c80.firebasestorage.app",
    messagingSenderId: "696343882738",
    appId: "1:696343882738:web:d692272c00a90828ed996b",
    measurementId: "G-BVTND3XNWS"
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const SYNC_KEYS = [
    'watchlist',
    'watchedMovies',
    'watchedSeries',
    'watchedEpisodes',
    'favoriteActors',
    'selectedPlatforms',
    'userRegion',
    'seriesLastWatchedDate'
];

// ID Tracking
let userId = localStorage.getItem('userId');
let anonymousId = localStorage.getItem('anonymousId');

if (!userId && !anonymousId) {
    const newAnonId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('userId', newAnonId);
    localStorage.setItem('anonymousId', newAnonId);
    userId = newAnonId;
    anonymousId = newAnonId;
} else if (!anonymousId && userId && userId.startsWith('user_')) {
    localStorage.setItem('anonymousId', userId);
    anonymousId = userId;
}

window.firebaseUser = null;
let isSigningInAndMerging = false;

function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try {
        const parsed = JSON.parse(str);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

function getLocalUserData() {
    return {
        watchlist: safeParseJSON(localStorage.getItem('watchlist'), []),
        watchedMovies: safeParseJSON(localStorage.getItem('watchedMovies'), []),
        watchedSeries: safeParseJSON(localStorage.getItem('watchedSeries'), []),
        watchedEpisodes: safeParseJSON(localStorage.getItem('watchedEpisodes'), {}),
        favoriteActors: safeParseJSON(localStorage.getItem('favoriteActors'), []),
        selectedPlatforms: safeParseJSON(localStorage.getItem('selectedPlatforms'), []),
        userRegion: localStorage.getItem('userRegion') || 'FR',
        seriesLastWatchedDate: safeParseJSON(localStorage.getItem('seriesLastWatchedDate'), {})
    };
}

function hasAnyUserData(data) {
    if (!data) return false;
    return (
        (Array.isArray(data.watchlist) && data.watchlist.length > 0) ||
        (Array.isArray(data.watchedMovies) && data.watchedMovies.length > 0) ||
        (Array.isArray(data.watchedSeries) && data.watchedSeries.length > 0) ||
        (data.watchedEpisodes && Object.keys(data.watchedEpisodes).length > 0) ||
        (Array.isArray(data.favoriteActors) && data.favoriteActors.length > 0) ||
        (Array.isArray(data.selectedPlatforms) && data.selectedPlatforms.length > 0)
    );
}

// Fusion intelligente sans perte entre données locales et données Cloud
function mergeUserData(localData, cloudData) {
    const local = localData || {};
    const cloud = cloudData || {};

    // 1. Watchlist (dédupliquée par type + id)
    const watchlistMap = new Map();
    [...(cloud.watchlist || []), ...(local.watchlist || [])].forEach(item => {
        if (item && item.id !== undefined) {
            const type = item.type || 'movie';
            const key = `${type}-${Number(item.id)}`;
            watchlistMap.set(key, { id: Number(item.id), type });
        }
    });

    // 2. Films et séries vus
    const watchedMovies = Array.from(new Set([
        ...(cloud.watchedMovies || []).map(Number),
        ...(local.watchedMovies || []).map(Number)
    ])).filter(Boolean);

    const watchedSeries = Array.from(new Set([
        ...(cloud.watchedSeries || []).map(Number),
        ...(local.watchedSeries || []).map(Number)
    ])).filter(Boolean);

    // 3. Épisodes vus (union par série)
    const watchedEpisodes = { ...(cloud.watchedEpisodes || {}) };
    Object.entries(local.watchedEpisodes || {}).forEach(([seriesId, eps]) => {
        if (!Array.isArray(eps)) return;
        const existing = Array.isArray(watchedEpisodes[seriesId]) ? watchedEpisodes[seriesId] : [];
        watchedEpisodes[seriesId] = Array.from(new Set([...existing, ...eps]));
    });

    // 4. Acteurs favoris (dédupliqués par id)
    const actorsMap = new Map();
    [...(cloud.favoriteActors || []), ...(local.favoriteActors || [])].forEach(actor => {
        if (actor && actor.id !== undefined) {
            actorsMap.set(Number(actor.id), actor);
        }
    });

    // 5. Plateformes sélectionnées
    const selectedPlatforms = Array.from(new Set([
        ...(cloud.selectedPlatforms || []),
        ...(local.selectedPlatforms || [])
    ]));

    // 6. Dates de dernier visionnage des séries
    const seriesLastWatchedDate = { ...(cloud.seriesLastWatchedDate || {}) };
    Object.entries(local.seriesLastWatchedDate || {}).forEach(([seriesId, ts]) => {
        const numTs = Number(ts) || 0;
        const cloudTs = Number(seriesLastWatchedDate[seriesId]) || 0;
        if (numTs > cloudTs) {
            seriesLastWatchedDate[seriesId] = numTs;
        }
    });

    // 7. Région
    const userRegion = local.userRegion || cloud.userRegion || 'FR';

    return {
        watchlist: Array.from(watchlistMap.values()),
        watchedMovies,
        watchedSeries,
        watchedEpisodes,
        favoriteActors: Array.from(actorsMap.values()),
        selectedPlatforms,
        seriesLastWatchedDate,
        userRegion,
        updatedAt: Date.now()
    };
}

function applyUserDataToLocalStorage(data) {
    if (!data) return;
    window.isFetchingFromCloud = true;
    try {
        if (Array.isArray(data.watchlist)) localStorage.setItem('watchlist', JSON.stringify(data.watchlist));
        if (Array.isArray(data.watchedMovies)) localStorage.setItem('watchedMovies', JSON.stringify(data.watchedMovies));
        if (Array.isArray(data.watchedSeries)) localStorage.setItem('watchedSeries', JSON.stringify(data.watchedSeries));
        if (data.watchedEpisodes && typeof data.watchedEpisodes === 'object') {
            localStorage.setItem('watchedEpisodes', JSON.stringify(data.watchedEpisodes));
        }
        if (Array.isArray(data.favoriteActors)) localStorage.setItem('favoriteActors', JSON.stringify(data.favoriteActors));
        if (Array.isArray(data.selectedPlatforms) && data.selectedPlatforms.length > 0) {
            localStorage.setItem('selectedPlatforms', JSON.stringify(data.selectedPlatforms));
        }
        if (data.seriesLastWatchedDate && typeof data.seriesLastWatchedDate === 'object') {
            localStorage.setItem('seriesLastWatchedDate', JSON.stringify(data.seriesLastWatchedDate));
        }
        if (data.userRegion) {
            localStorage.setItem('userRegion', data.userRegion);
        }
        localStorage.setItem('lastCloudSync', String(Date.now()));
    } finally {
        window.isFetchingFromCloud = false;
    }
}

// Met à jour l'avatar Google dans le header de toutes les pages
function updateHeaderProfileButtons(user) {
    const updateDOM = () => {
        const profileLinks = document.querySelectorAll('a[href="profile.html"]');
        profileLinks.forEach(link => {
            if (user && user.photoURL) {
                link.innerHTML = `
                    <div class="relative inline-flex items-center justify-center">
                        <img src="${user.photoURL}" alt="${user.displayName || 'Profil'}" referrerpolicy="no-referrer" class="w-8 h-8 rounded-full object-cover border-2 border-primary shadow-sm">
                        <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#121212] rounded-full"></span>
                    </div>
                `;
            } else if (user) {
                const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
                link.innerHTML = `
                    <div class="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold text-sm shadow-sm">
                        ${initial}
                        <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#121212] rounded-full"></span>
                    </div>
                `;
            } else {
                link.innerHTML = `<span class="material-symbols-outlined text-3xl">account_circle</span>`;
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateDOM, { once: true });
    } else {
        updateDOM();
    }
}

async function mergeAndSyncUserAccount(user) {
    if (!user) return;
    isSigningInAndMerging = true;
    try {
        const localData = getLocalUserData();
        const googleDocRef = doc(db, "utilisateurs", user.uid);
        const googleDocSnap = await getDoc(googleDocRef);
        const cloudData = googleDocSnap.exists() ? googleDocSnap.data() : {};

        const mergedData = mergeUserData(localData, cloudData);
        applyUserDataToLocalStorage(mergedData);
        await setDoc(googleDocRef, mergedData, { merge: true });

        window.dispatchEvent(new CustomEvent('cloud-data-synced', { detail: { merged: true } }));
        window.dispatchEvent(new CustomEvent('watchlist-updated'));
    } catch (error) {
        console.error("Erreur lors de la fusion des données Google :", error);
    } finally {
        isSigningInAndMerging = false;
    }
}

// Gestion du retour de connexion par redirection (mobile / PWA)
getRedirectResult(auth)
    .then(async (result) => {
        if (result && result.user) {
            await mergeAndSyncUserAccount(result.user);
        }
    })
    .catch((error) => {
        console.error("Erreur getRedirectResult :", error);
        window.lastFirebaseAuthError = error;
        window.dispatchEvent(new CustomEvent('auth-error', { detail: { error } }));
    });

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const previousUserId = localStorage.getItem('userId');
        window.firebaseUser = user;
        userId = user.uid;
        localStorage.setItem('userId', user.uid);
        updateHeaderProfileButtons(user);
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user } }));

        if (!isSigningInAndMerging) {
            // Si on vient de passer d'un compte anonyme à ce compte Google, on fusionne sans rien perdre
            if (previousUserId && previousUserId !== user.uid) {
                await mergeAndSyncUserAccount(user);
            } else {
                await fetchFromCloud();
            }
        }
    } else {
        window.firebaseUser = null;
        if (anonymousId) {
            userId = anonymousId;
            localStorage.setItem('userId', anonymousId);
        } else {
            userId = 'user_' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem('userId', userId);
            localStorage.setItem('anonymousId', userId);
            anonymousId = userId;
        }
        updateHeaderProfileButtons(null);
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: null } }));
        await fetchFromCloud();
    }
});

// Connexion Google avec fallback automatique Redirect si Popup bloquée
async function signInWithGoogle() {
    isSigningInAndMerging = true;
    try {
        const localSnapshotBeforeLogin = getLocalUserData();
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        userId = user.uid;
        localStorage.setItem('userId', user.uid);

        const googleDocRef = doc(db, "utilisateurs", user.uid);
        const googleDocSnap = await getDoc(googleDocRef);
        const cloudData = googleDocSnap.exists() ? googleDocSnap.data() : {};

        const mergedData = mergeUserData(localSnapshotBeforeLogin, cloudData);
        applyUserDataToLocalStorage(mergedData);
        await setDoc(googleDocRef, mergedData, { merge: true });

        window.dispatchEvent(new CustomEvent('cloud-data-synced', { detail: { merged: true } }));
        window.dispatchEvent(new CustomEvent('watchlist-updated'));
        return user;
    } catch (error) {
        // Si les popups sont bloquées (fréquent sur mobile / PWA iOS), basculer en redirection
        if (
            error.code === 'auth/popup-blocked' ||
            error.code === 'auth/operation-not-supported-in-this-environment'
        ) {
            await signInWithRedirect(auth, googleProvider);
            return null;
        }
        console.error("Erreur de connexion Google :", error);
        window.lastFirebaseAuthError = error;
        throw error;
    } finally {
        isSigningInAndMerging = false;
    }
}

async function signOutGoogle() {
    try {
        await signOut(auth);
        console.log("Déconnecté du compte Google.");
    } catch (error) {
        console.error("Erreur de déconnexion :", error);
        throw error;
    }
}

// Sauvegarde vers Firebase Cloud
async function syncToCloud() {
    if (!userId) return;
    try {
        const userData = {
            ...getLocalUserData(),
            updatedAt: Date.now()
        };
        const docRef = doc(db, "utilisateurs", userId);
        await setDoc(docRef, userData, { merge: true });
        window.isFetchingFromCloud = true;
        localStorage.setItem('lastCloudSync', String(Date.now()));
        window.isFetchingFromCloud = false;
        window.dispatchEvent(new CustomEvent('cloud-data-synced', { detail: { syncedAt: Date.now() } }));
        console.log("☁️ Sauvegarde Firebase réussie !");
    } catch (error) {
        console.error("Erreur de sauvegarde Firebase :", error);
    }
}

// Téléchargement depuis Firebase Cloud
async function fetchFromCloud() {
    if (!userId) return;
    try {
        const docRef = doc(db, "utilisateurs", userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            const localData = getLocalUserData();

            // Si des données locales existent mais que le cloud est plus ancien ou partiel,
            // on fusionne en douceur au premier chargement pour éviter toute perte
            if (!sessionStorage.getItem('initialCloudFetchDone') && hasAnyUserData(localData)) {
                const merged = mergeUserData(localData, cloudData);
                applyUserDataToLocalStorage(merged);
                sessionStorage.setItem('initialCloudFetchDone', 'true');
                await setDoc(docRef, merged, { merge: true });
            } else {
                applyUserDataToLocalStorage(cloudData);
                sessionStorage.setItem('initialCloudFetchDone', 'true');
            }

            console.log("☁️ Données Firebase chargées !");
            window.dispatchEvent(new CustomEvent('cloud-data-synced', { detail: { syncedAt: Date.now() } }));
            window.dispatchEvent(new CustomEvent('watchlist-updated'));
        } else if (hasAnyUserData(getLocalUserData())) {
            // Aucun document cloud existant mais on a des données locales : on les sauvegarde
            await syncToCloud();
        }
    } catch (error) {
        console.error("Erreur de récupération Firebase :", error);
    }
}

// Écoute automatique des modifications de localStorage (en complément de js/utils.js)
const previousSetItem = localStorage.setItem;
localStorage.setItem = function (key, value) {
    previousSetItem.call(localStorage, key, value);

    if (window.isFetchingFromCloud) return;

    if (SYNC_KEYS.includes(key)) {
        clearTimeout(window.firebaseSyncTimeout);
        window.firebaseSyncTimeout = setTimeout(() => {
            syncToCloud();
        }, 1200);
    }
};

// Exposition globale
window.signInWithGoogle = signInWithGoogle;
window.signOutGoogle = signOutGoogle;
window.syncToCloud = syncToCloud;
window.fetchFromCloud = fetchFromCloud;
window.forceCloudMerge = () => {
    if (window.firebaseUser) {
        return mergeAndSyncUserAccount(window.firebaseUser);
    }
    return syncToCloud();
};

export { app, db, auth, signInWithGoogle, signOutGoogle, syncToCloud, fetchFromCloud };
