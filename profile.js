import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// Assurez-vous que l'application Firebase est déjà initialisée dans firebase-config.js

const db = getFirestore();
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('award-search-input');
  const searchBtn = document.getElementById('award-search-btn');
  const resultsList = document.getElementById('award-search-results');
  const formContainer = document.getElementById('award-form-container');
  const saveBtn = document.getElementById('award-save-btn');
  const exportBtn = document.getElementById('award-export-btn');

  let currentSelectedItem = null;

  // 1. Recherche TMDb (Films et Séries)
  searchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) return;

    // Utilisation de votre clé API depuis config.js
    const apiKey = window.TMDB_API_KEY; 
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=fr-FR`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      displayResults(data.results);
    } catch (error) {
      console.error("Erreur lors de la recherche :", error);
    }
  });

  // 2. Affichage des résultats
  function displayResults(results) {
    resultsList.innerHTML = '';
    formContainer.style.display = 'none';

    // Filtrer pour ne garder que les films et séries
    const filteredResults = results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');

    filteredResults.forEach(item => {
      const li = document.createElement('li');
      const title = item.media_type === 'movie' ? item.title : item.name;
      const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
      const year = date ? date.split('-')[0] : 'Année inconnue';
      
      li.textContent = `${title} (${year}) - [${item.media_type.toUpperCase()}]`;
      li.style.cursor = 'pointer';
      
      li.addEventListener('click', () => selectItem(item, title, year));
      resultsList.appendChild(li);
    });
  }

  // 3. Sélection d'une œuvre
  function selectItem(item, title, year) {
    currentSelectedItem = {
      id: item.id.toString(),
      title: title,
      year: parseInt(year) || year,
      type: item.media_type
    };

    document.getElementById('award-selected-title').textContent = title;
    document.getElementById('award-selected-id').textContent = item.id;
    document.getElementById('award-selected-type').textContent = item.media_type;
    
    // Réinitialiser les inputs
    document.getElementById('award-noms').value = 0;
    document.getElementById('award-wins').value = 0;

    // Afficher les données existantes s'il y en a
    if (window.awardsData && window.awardsData[item.id]) {
      const existing = window.awardsData[item.id];
      alert(`Info : Cette œuvre existe déjà dans awards.js avec ${existing.nominations} nomination(s) et ${existing.wins} victoire(s). Vos saisies s'y ajouteront.`);
    }

    formContainer.style.display = 'block';
  }

  // 4. Enregistrement en mémoire (Logique d'addition)
 saveBtn.addEventListener('click', async () => {
  if (!currentSelectedItem) return;

  const newNoms = parseInt(document.getElementById('award-noms').value) || 0;
  const newWins = parseInt(document.getElementById('award-wins').value) || 0;
  const id = currentSelectedItem.id;

  try {
    saveBtn.textContent = "Enregistrement...";
    saveBtn.disabled = true;

    // 1. On récupère les données existantes pour ce film/série (s'il y en a)
    let existingNoms = 0;
    let existingWins = 0;
    if (window.awardsData && window.awardsData[id]) {
      existingNoms = window.awardsData[id].nominations || 0;
      existingWins = window.awardsData[id].wins || 0;
    }

    // 2. On prépare l'objet à mettre à jour
    const updateData = {
      [id]: {
        title: currentSelectedItem.title,
        year: currentSelectedItem.year,
        type: currentSelectedItem.type,
        nominations: existingNoms + newNoms,
        wins: existingWins + newWins
      }
    };

    // 3. On envoie sur Firebase (merge: true permet de ne modifier QUE cet ID sans écraser les autres films)
    const docRef = doc(db, "app_data", "awards");
    await setDoc(docRef, updateData, { merge: true });

    // 4. On met à jour la variable locale pour éviter de devoir recharger la page
    if (!window.awardsData) window.awardsData = {};
    window.awardsData[id] = updateData[id];

    alert(`Succès ! Les données pour "${currentSelectedItem.title}" sont sauvegardées dans Firebase.`);
    
    // Nettoyage de l'interface
    formContainer.style.display = 'none';
    searchInput.value = '';
    resultsList.innerHTML = '';

  } catch (error) {
    console.error("Erreur Firebase :", error);
    alert("Une erreur est survenue lors de l'enregistrement.");
  } finally {
    saveBtn.textContent = "Enregistrer en base de données";
    saveBtn.disabled = false;
  }
});

  // 5. Exportation du nouveau fichier awards.js
  exportBtn.addEventListener('click', () => {
    if (!window.awardsData) {
      alert("Aucune donnée à exporter.");
      return;
    }

    // Création du contenu texte du fichier
    const jsContent = `window.awardsData = ${JSON.stringify(window.awardsData, null, 2)};`;
    
    // Création du fichier téléchargeable (Blob)
    const blob = new Blob([jsContent], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'awards.js';
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});
