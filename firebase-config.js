// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// On crée un ID unique pour cet appareil s'il n'existe pas encore
let userId = localStorage.getItem('userId');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);
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

// Exécution automatique au lancement
fetchFromCloud();
