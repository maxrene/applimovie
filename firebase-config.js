// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// ID Tracking
let userId = localStorage.getItem('userId');
let anonymousId = localStorage.getItem('anonymousId'); // We store the initial anonymous ID here

// Generate anonymous ID if neither exists
if (!userId && !anonymousId) {
    const newAnonId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', newAnonId);
    localStorage.setItem('anonymousId', newAnonId);
    userId = newAnonId;
    anonymousId = newAnonId;
} else if (!anonymousId && userId && userId.startsWith('user_')) {
    // If upgrading from older version without anonymousId
    localStorage.setItem('anonymousId', userId);
    anonymousId = userId;
}

// État d'authentification global
window.firebaseUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.firebaseUser = user;
        userId = user.uid;
        localStorage.setItem('userId', user.uid);
        // Dispatch event for UI
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: user } }));
        await fetchFromCloud(); // Fetch user data
    } else {
        window.firebaseUser = null;
        // Revert to anonymous ID
        if (anonymousId) {
            userId = anonymousId;
            localStorage.setItem('userId', anonymousId);
        } else {
            // Failsafe
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', userId);
            localStorage.setItem('anonymousId', userId);
        }
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: null } }));
        await fetchFromCloud(); // Fetch anonymous data
    }
});

// Instructions for Firebase Console setup (printed for developer convenience)
console.log("%c--- CONFIGURATION GOOGLE AUTH ---", "color: #4CAF50; font-weight: bold; font-size: 14px;");
console.log("%cPour que la connexion Google fonctionne, vous devez :", "color: #4CAF50;");
console.log("%c1. Aller sur https://console.firebase.google.com/", "color: #4CAF50;");
console.log("%c2. Sélectionner votre projet 'cinemovie-56c80'", "color: #4CAF50;");
console.log("%c3. Aller dans 'Authentication' > 'Sign-in method'", "color: #4CAF50;");
console.log("%c4. Cliquer sur 'Add new provider' et choisir 'Google'", "color: #4CAF50;");
console.log("%c5. L'activer, choisir l'email de support et sauvegarder.", "color: #4CAF50;");
console.log("%c---------------------------------", "color: #4CAF50; font-weight: bold; font-size: 14px;");

// Authentication functions
async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const newUserId = user.uid;

        // --- Merge Logic ---
        // Check if the new Google user has existing data
        const googleDocRef = doc(db, "utilisateurs", newUserId);
        const googleDocSnap = await getDoc(googleDocRef);

        // Check if local anonymous user has data to merge
        let hasLocalData = false;
        const localData = {
            watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
            watchedMovies: JSON.parse(localStorage.getItem('watchedMovies') || '[]'),
            watchedSeries: JSON.parse(localStorage.getItem('watchedSeries') || '[]'),
            watchedEpisodes: JSON.parse(localStorage.getItem('watchedEpisodes') || '{}'),
            favoriteActors: JSON.parse(localStorage.getItem('favoriteActors') || '[]')
        };

        if (localData.watchlist.length > 0 || localData.watchedMovies.length > 0 || localData.watchedSeries.length > 0 || Object.keys(localData.watchedEpisodes).length > 0 || localData.favoriteActors.length > 0) {
            hasLocalData = true;
        }

        if (!googleDocSnap.exists() && hasLocalData) {
            // New Google account, but we have local data -> Merge local to Google
            console.log("Migration des données locales vers le compte Google...");
            await setDoc(googleDocRef, localData, { merge: true });
        } else if (googleDocSnap.exists() && hasLocalData) {
            // Existing Google account AND local data.
            // A smarter merge could be done here, but for simplicity, we let the cloud data overwrite local,
            // OR we append local to cloud. Here we append local to cloud (simple array merge without deduplication for simplicity, but ideally deduplicate).
            // Actually, best approach is to push current local state to cloud with merge:true. setDoc merge:true overwrites existing keys at top level.
            // Let's just trust fetchFromCloud which will run via onAuthStateChanged.
            // If they want to force push local to cloud on login:
             console.log("Compte Google existant. Les listes locales vont être remplacées par celles du cloud.");
        }

        return user;
    } catch (error) {
        console.error("Erreur de connexion Google :", error);
        throw error;
    }
}

async function signOutGoogle() {
    try {
        await signOut(auth);
        console.log("Déconnecté.");
    } catch (error) {
        console.error("Erreur de déconnexion :", error);
        throw error;
    }
}

// Fonction pour uploader vos listes vers le Cloud
async function syncToCloud() {
    try {
        const userData = {
            watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
            watchedMovies: JSON.parse(localStorage.getItem('watchedMovies') || '[]'),
            watchedSeries: JSON.parse(localStorage.getItem('watchedSeries') || '[]'),
            watchedEpisodes: JSON.parse(localStorage.getItem('watchedEpisodes') || '{}'),
            favoriteActors: JSON.parse(localStorage.getItem('favoriteActors') || '[]')
        };
        const docRef = doc(db, "utilisateurs", userId);
        await setDoc(docRef, userData, { merge: true });
        console.log("☁️ Sauvegarde Firebase réussie !");
    } catch (error) {
        console.error("Erreur de sauvegarde Firebase :", error);
    }
}

// Fonction pour télécharger vos listes depuis le Cloud au démarrage
async function fetchFromCloud() {
    try {
        const docRef = doc(db, "utilisateurs", userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // On désactive temporairement le "Snoop" pour ne pas créer de boucle
            window.isFetchingFromCloud = true;
            if (data.watchlist) localStorage.setItem('watchlist', JSON.stringify(data.watchlist));
            if (data.watchedMovies) localStorage.setItem('watchedMovies', JSON.stringify(data.watchedMovies));
            if (data.watchedSeries) localStorage.setItem('watchedSeries', JSON.stringify(data.watchedSeries));
            if (data.watchedEpisodes) localStorage.setItem('watchedEpisodes', JSON.stringify(data.watchedEpisodes));
            if (data.favoriteActors) localStorage.setItem('favoriteActors', JSON.stringify(data.favoriteActors));
            window.isFetchingFromCloud = false;

            console.log("☁️ Données Firebase chargées !");
            // On ordonne à l'application de s'actualiser avec les nouvelles données
            window.dispatchEvent(new CustomEvent('view-changed', { detail: { tab: 'home' } }));
        }
    } catch (error) {
        console.error("Erreur de récupération Firebase :", error);
    }
}

// --- LA MAGIE : Le "Snoop" (Mise sur écoute du LocalStorage) ---
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    
    // 1. On tente de sauvegarder normalement (en forçant le contexte avec .call)
    try {
        originalSetItem.call(localStorage, key, value);
    } catch (error) {
        // Si la mémoire est pleine, on supprime tout le cache lourd pour faire de la place
        if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
            console.warn("📦 Mémoire saturée : Nettoyage automatique du cache en cours...");
            
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('movie-details-') || k.startsWith('series-details-'))) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            
            // On retente la sauvegarde
            try {
                originalSetItem.call(localStorage, key, value);
            } catch (e2) {
                console.error("❌ Échec critique de la sauvegarde locale.", e2);
            }
        } else {
            console.error("Erreur inattendue :", error);
        }
    }
    
    // 2. Si on télécharge depuis le cloud, on s'arrête là
    if (window.isFetchingFromCloud) return;

    // 3. On synchronise avec Firebase !
    const syncKeys = ['watchlist', 'watchedMovies', 'watchedSeries', 'watchedEpisodes', 'favoriteActors'];
    if (syncKeys.includes(key)) {
        clearTimeout(window.firebaseSyncTimeout);
        window.firebaseSyncTimeout = setTimeout(() => {
            if (typeof syncToCloud === 'function') syncToCloud();
        }, 1500);
    }
};

// Exposer les fonctions pour pouvoir les utiliser depuis profile.html ou ailleurs
window.signInWithGoogle = signInWithGoogle;
window.signOutGoogle = signOutGoogle;

// Exécution automatique au lancement (handled by onAuthStateChanged primarily, but good to run initially if auth takes time)
// fetchFromCloud(); // Removing direct call to avoid double fetch, onAuthStateChanged will handle it.
