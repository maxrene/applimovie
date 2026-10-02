// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try {
        const parsed = JSON.parse(str);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

// ID Tracking & Profil Cloud persistant
let userId = localStorage.getItem('userId');
let anonymousId = localStorage.getItem('anonymousId');
let savedCloudProfile = safeParseJSON(localStorage.getItem('cloudUserProfile'), null);

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

if (savedCloudProfile && savedCloudProfile.uid) {
    userId = savedCloudProfile.uid;
    localStorage.setItem('userId', savedCloudProfile.uid);
}

window.firebaseUser = savedCloudProfile || null;
let isSigningInAndMerging = false;

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

function countUserDataItems(data) {
    if (!data) return 0;
    const wl = Array.isArray(data.watchlist) ? data.watchlist.length : 0;
    const wm = Array.isArray(data.watchedMovies) ? data.watchedMovies.length : 0;
    const ws = Array.isArray(data.watchedSeries) ? data.watchedSeries.length : 0;
    const we = (data.watchedEpisodes && typeof data.watchedEpisodes === 'object')
        ? Object.values(data.watchedEpisodes).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0)
        : 0;
    return wl + wm + ws + we;
}

// Fusion intelligente sans perte entre données locales et données Cloud
function mergeUserData(localData, cloudData) {
    const local = localData || {};
    const cloud = cloudData || {};

    // 1. Watchlist (dédupliquée par type + id)
    const watchlistMap = new Map();
    [...(cloud.watchlist || []), ...(local.watchlist || [])].forEach(item => {
        if (item && item.id !== undefined) {
            const type = (item.type === 'tv') ? 'serie' : (item.type || 'movie');
            const key = `${type}-${Number(item.id)}`;
            const existing = watchlistMap.get(key);
            watchlistMap.set(key, {
                ...(existing || {}),
                ...item,
                id: Number(item.id),
                type
            });
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
        const syncTs = String(data.updatedAt || Date.now());
        localStorage.setItem('lastCloudSync', syncTs);
        localStorage.setItem('localUpdatedAt', syncTs);
    } finally {
        window.isFetchingFromCloud = false;
    }
}

// Met à jour l'avatar Google dans le header de toutes les pages
function updateHeaderProfileButtons(user) {
    const updateDOM = () => {
        const profileLinks = document.querySelectorAll('a[href="profile.html"]');
        profileLinks.forEach(link => {
            const flagImg = link.querySelector('img[src*="flagcdn.com"]');
            const flagHTML = flagImg ? flagImg.outerHTML : '';

            if (user && user.photoURL) {
                link.innerHTML = `
                    ${flagHTML}
                    <div class="relative inline-flex items-center justify-center">
                        <img src="${user.photoURL}" alt="${user.displayName || 'Profil'}" referrerpolicy="no-referrer" class="w-8 h-8 rounded-full object-cover border-2 border-primary shadow-sm">
                        <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#121212] rounded-full"></span>
                    </div>
                `;
            } else if (user) {
                const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
                link.innerHTML = `
                    ${flagHTML}
                    <div class="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold text-sm shadow-sm">
                        ${initial}
                        <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#121212] rounded-full"></span>
                    </div>
                `;
            } else {
                link.innerHTML = `
                    ${flagHTML}
                    <span class="material-symbols-outlined text-3xl text-gray-600 dark:text-gray-300">account_circle</span>
                `;
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateDOM, { once: true });
    } else {
        updateDOM();
    }
}

/**
 * Recherche dans la collection Firestore "utilisateurs" toutes les sauvegardes existantes
 * (y compris les anciens profils anonymes user_xxx créés avant connexion) pour ne rien perdre.
 */
async function findAndMergeExistingCloudDocs(targetUid, userEmail, baseData) {
    let accumulated = baseData || getLocalUserData();
    try {
        // 1. Lire le document cible principal
        const targetRef = doc(db, "utilisateurs", targetUid);
        const targetSnap = await getDoc(targetRef);
        if (targetSnap.exists()) {
            accumulated = mergeUserData(accumulated, targetSnap.data());
        }

        // 2. Lire l'éventuel document anonyme de cet appareil
        if (anonymousId && anonymousId !== targetUid) {
            const anonRef = doc(db, "utilisateurs", anonymousId);
            const anonSnap = await getDoc(anonRef);
            if (anonSnap.exists()) {
                accumulated = mergeUserData(accumulated, anonSnap.data());
            }
        }

        // 3. Parcourir la collection "utilisateurs" pour retrouver tout document ayant le même email
        //    ou les sauvegardes existantes du projet si le compte vient d'être lié
        const allDocsSnap = await getDocs(collection(db, "utilisateurs"));
        allDocsSnap.forEach(docItem => {
            if (docItem.id === targetUid) return;
            const d = docItem.data();
            if (!d) return;
            const sameEmail = userEmail && d.accountEmail && d.accountEmail.toLowerCase() === userEmail.toLowerCase();
            const isAnonBackup = docItem.id.startsWith('user_') && hasAnyUserData(d);
            if (sameEmail || isAnonBackup) {
                accumulated = mergeUserData(accumulated, d);
            }
        });
    } catch (e) {
        console.warn("Avertissement lors de la recherche des sauvegardes Cloud :", e);
    }
    return accumulated;
}

async function mergeAndSyncUserAccount(user) {
    if (!user) return;
    isSigningInAndMerging = true;
    try {
        const localData = getLocalUserData();
        const mergedData = await findAndMergeExistingCloudDocs(user.uid, user.email, localData);
        mergedData.accountEmail = user.email || null;
        mergedData.accountName = user.displayName || null;
        mergedData.updatedAt = Date.now();

        applyUserDataToLocalStorage(mergedData);
        const googleDocRef = doc(db, "utilisateurs", user.uid);
        await setDoc(googleDocRef, mergedData, { merge: true });

        // Si l'utilisateur a aussi un email, sauvegarder un miroir sous l'ID email normalisé
        // pour qu'il retrouve toujours ses données quel que soit le mode de connexion
        if (user.email) {
            const emailUid = 'google_' + user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (emailUid !== user.uid) {
                await setDoc(doc(db, "utilisateurs", emailUid), mergedData, { merge: true });
            }
        }

        window.dispatchEvent(new CustomEvent('cloud-data-synced', { detail: { merged: true, syncedAt: Date.now() } }));
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
            const profile = {
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName || (result.user.email ? result.user.email.split('@')[0] : 'Utilisateur Google'),
                photoURL: result.user.photoURL,
                provider: 'google-oauth'
            };
            localStorage.setItem('cloudUserProfile', JSON.stringify(profile));
            await mergeAndSyncUserAccount(profile);
        }
    })
    .catch((error) => {
        console.warn("Info getRedirectResult :", error?.code || error);
    });

onAuthStateChanged(auth, async (oauthUser) => {
    if (oauthUser) {
        const previousUserId = localStorage.getItem('userId');
        const profile = {
            uid: oauthUser.uid,
            email: oauthUser.email,
            displayName: oauthUser.displayName || (oauthUser.email ? oauthUser.email.split('@')[0] : 'Utilisateur Google'),
            photoURL: oauthUser.photoURL,
            provider: 'google-oauth'
        };
        savedCloudProfile = profile;
        window.firebaseUser = profile;
        userId = profile.uid;
        localStorage.setItem('userId', profile.uid);
        localStorage.setItem('cloudUserProfile', JSON.stringify(profile));
        updateHeaderProfileButtons(profile);
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: profile } }));

        if (!isSigningInAndMerging) {
            if (previousUserId && previousUserId !== profile.uid) {
                await mergeAndSyncUserAccount(profile);
            } else {
                await fetchFromCloud();
            }
        }
    } else {
        // Si l'utilisateur est connecté via son compte Cloud Email, maintenir sa session active !
        const storedProfile = safeParseJSON(localStorage.getItem('cloudUserProfile'), null);
        if (storedProfile && storedProfile.uid) {
            savedCloudProfile = storedProfile;
            window.firebaseUser = storedProfile;
            userId = storedProfile.uid;
            localStorage.setItem('userId', storedProfile.uid);
            updateHeaderProfileButtons(storedProfile);
            window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: storedProfile } }));
            if (!isSigningInAndMerging) {
                await fetchFromCloud();
            }
            return;
        }

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

/**
 * Connexion directe par adresse Google / Email sur Firestore (fonctionne sur tous les appareils
 * même sans configuration OAuth dans la console Firebase, et fusionne automatiquement les listes existantes).
 */
async function signInWithCloudEmail(emailInput, customName = '') {
    const cleanEmail = String(emailInput || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error("Veuillez saisir une adresse e-mail Google valide.");
    }

    isSigningInAndMerging = true;
    try {
        const emailUid = 'google_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
        const rawName = customName.trim() || cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
        const displayName = rawName.replace(/\b\w/g, l => l.toUpperCase());

        const profile = {
            uid: emailUid,
            email: cleanEmail,
            displayName,
            photoURL: null,
            provider: 'cloud-email'
        };

        savedCloudProfile = profile;
        window.firebaseUser = profile;
        userId = emailUid;
        localStorage.setItem('userId', emailUid);
        localStorage.setItem('cloudUserProfile', JSON.stringify(profile));

        updateHeaderProfileButtons(profile);
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: profile } }));

        await mergeAndSyncUserAccount(profile);
        return profile;
    } finally {
        isSigningInAndMerging = false;
    }
}

// Connexion Google OAuth avec fallback automatique
async function signInWithGoogle() {
    isSigningInAndMerging = true;
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const oauthUser = result.user;
        const profile = {
            uid: oauthUser.uid,
            email: oauthUser.email,
            displayName: oauthUser.displayName || (oauthUser.email ? oauthUser.email.split('@')[0] : 'Utilisateur Google'),
            photoURL: oauthUser.photoURL,
            provider: 'google-oauth'
        };

        savedCloudProfile = profile;
        window.firebaseUser = profile;
        userId = profile.uid;
        localStorage.setItem('userId', profile.uid);
        localStorage.setItem('cloudUserProfile', JSON.stringify(profile));

        updateHeaderProfileButtons(profile);
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: profile } }));

        await mergeAndSyncUserAccount(profile);
        return profile;
    } catch (error) {
        if (
            error.code === 'auth/popup-blocked' ||
            error.code === 'auth/operation-not-supported-in-this-environment'
        ) {
            await signInWithRedirect(auth, googleProvider);
            return null;
        }
        console.warn("Popup OAuth Firebase indisponible :", error?.code || error);
        window.lastFirebaseAuthError = error;
        throw error;
    } finally {
        isSigningInAndMerging = false;
    }
}

async function signOutGoogle() {
    try {
        localStorage.removeItem('cloudUserProfile');
        savedCloudProfile = null;
        window.firebaseUser = null;
        if (anonymousId) {
            userId = anonymousId;
            localStorage.setItem('userId', anonymousId);
        }
        try {
            await signOut(auth);
        } catch (e) {}
        updateHeaderProfileButtons(null);
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: null } }));
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
        const now = Date.now();
        const userData = {
            ...getLocalUserData(),
            accountEmail: window.firebaseUser?.email || null,
            accountName: window.firebaseUser?.displayName || null,
            updatedAt: now
        };
        const docRef = doc(db, "utilisateurs", userId);
        await setDoc(docRef, userData, { merge: true });

        if (window.firebaseUser?.email) {
            const emailUid = 'google_' + window.firebaseUser.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (emailUid !== userId) {
                await setDoc(doc(db, "utilisateurs", emailUid), userData, { merge: true });
            }
        }

        window.isFetchingFromCloud = true;
        localStorage.setItem('lastCloudSync', String(now));
        localStorage.setItem('localUpdatedAt', String(now));
        window.isFetchingFromCloud = false;
        window.dispatchEvent(new CustomEvent('cloud-data-synced', { detail: { syncedAt: now } }));
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
        const localData = getLocalUserData();

        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            const cloudCount = countUserDataItems(cloudData);
            const localCount = countUserDataItems(localData);
            const localUpdatedAt = Number(localStorage.getItem('localUpdatedAt') || 0);
            const lastCloudSync = Number(localStorage.getItem('lastCloudSync') || 0);
            const hasUnsyncedLocalChanges = localUpdatedAt > lastCloudSync;

            if (!hasAnyUserData(localData) && cloudCount > 0) {
                // Nouvel appareil ou stockage local vide : restaurer directement les données du Cloud
                applyUserDataToLocalStorage(cloudData);
            } else if (hasUnsyncedLocalChanges || (!sessionStorage.getItem('initialCloudFetchDone') && localCount > cloudCount)) {
                const merged = mergeUserData(localData, cloudData);
                applyUserDataToLocalStorage(merged);
                await setDoc(docRef, merged, { merge: true });
            } else {
                // Appliquer l'état Cloud le plus récent (ou fusionner si le Cloud est vide)
                if ((cloudData.updatedAt || 0) >= localUpdatedAt || cloudCount >= localCount) {
                    applyUserDataToLocalStorage(cloudData);
                } else {
                    const merged = mergeUserData(localData, cloudData);
                    applyUserDataToLocalStorage(merged);
                    await setDoc(docRef, merged, { merge: true });
                }
            }
            sessionStorage.setItem('initialCloudFetchDone', 'true');
            console.log("☁️ Données Firebase chargées !");
            window.dispatchEvent(new CustomEvent('cloud-data-synced', { detail: { syncedAt: Date.now() } }));
            window.dispatchEvent(new CustomEvent('watchlist-updated'));
        } else {
            // Si le document de ce compte est vide/inexistant, vérifier s'il existe d'autres sauvegardes dans Firestore
            if (window.firebaseUser) {
                await mergeAndSyncUserAccount(window.firebaseUser);
            } else if (hasAnyUserData(localData)) {
                await syncToCloud();
            }
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
        previousSetItem.call(localStorage, 'localUpdatedAt', String(Date.now()));
        clearTimeout(window.firebaseSyncTimeout);
        window.firebaseSyncTimeout = setTimeout(() => {
            syncToCloud();
        }, 1000);
    }
};

// Exposition globale
window.signInWithGoogle = signInWithGoogle;
window.signInWithCloudEmail = signInWithCloudEmail;
window.signOutGoogle = signOutGoogle;
window.syncToCloud = syncToCloud;
window.fetchFromCloud = fetchFromCloud;
window.forceCloudMerge = () => {
    if (window.firebaseUser) {
        return mergeAndSyncUserAccount(window.firebaseUser);
    }
    return syncToCloud();
};

export { app, db, auth, signInWithGoogle, signInWithCloudEmail, signOutGoogle, syncToCloud, fetchFromCloud };

