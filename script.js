let ws, deadline = 0, timerId = null, lastQid = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const RAILWAY_URL="wss://web-production-ae26f.up.railway.app";
let playerName = localStorage.getItem('playerName');
let playerId = localStorage.getItem('playerId');
if (!playerId) {
    playerId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    localStorage.setItem('playerId', playerId);  // 👈 sauvegarde immédiate
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Envoyer un ping périodique pour maintenir la connexion
setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: 'ping'}));
    }
}, 30000); // Toutes les 30 secondes

// Gérer le changement de visibilité de la page
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page cachée - réduire l'activité
        console.log('Page cachée');
    } else {
        // Page visible - vérifier la connexion
        console.log('Page visible');
        if (ws && ws.readyState !== WebSocket.OPEN) {
            console.log('Reconnexion nécessaire');
            if (playerName) {
              connect(RAILWAY_URL, playerName);
            }
        }
    }
});


// --- Connexion au serveur ---
function connect(url, name) {
  ws = new WebSocket(url);
  playerName = name;
  localStorage.setItem('playerName', name);
  localStorage.setItem('playerId', playerId);

  ws.onopen = () => {
    setStatus("✅ Connecté au serveur !");
    reconnectAttempts = 0;
    ws.send(JSON.stringify({ 
      type: "join", 
      name: name,
      id: playerId
    }));
    show("#game");
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    console.log("📩 Reçu :", msg);

    // Répondre au ping
    if (msg.type === "pong") {
      return;
    }

    // --- Le serveur demande un choix de catégorie ---
    if (msg.type === "choose_category") {
      handleCategoryChoice(msg);
    }

    // --- Une question démarre ---
    else if (msg.type === "question") {
      lastQid = msg.qid;
      deadline = Date.now() + (msg.duration * 1000);
      if (msg.categorie) {
        const wrap = document.getElementById("choices");
        wrap.className = ""; // reset
        
        // Mapping des catégories vers les 6 types de couleurs
        const categoryMapping = {
          // Années/Musique -> Rose (blindtest)
          "1960-70s": "blindtest",
          "1980s": "blindtest", 
          "1990s": "blindtest",
          "2000s": "blindtest",
          "2010s": "blindtest",
          "2020s": "blindtest",
          "Variété-française": "blindtest",
          "Chansons Paillardes": "blindtest",
          "Musique Disney": "blindtest",
          "Comédies Musicales": "blindtest",
          "Répliques de Films": "blindtest",
          "Dessins Animés": "blindtest",
          "Musique Classique": "blindtest",
          "Animés Japonais": "blindtest",
          "Musique de Jeux Vidéos": "blindtest",
          "Films": "blindtest",
          "Séries": "blindtest",
          "Instrumental": "blindtest",
          "Historien Musical": "blindtest",
          "Mieux Que L'Original ?": "blindtest",
          "Duos Gagnants": "blindtest",


          
          // Divertissement/Films -> Violet (div)
          "Disney": "div",
          "Marvel": "div",
          "Jeux Vidéos": "div",
          "Tabarnak": "div",
          "Affiches": "div",
          
          // Géographie -> Bleu (geo)
          "Capitales": "geo",
          "Drapeaux": "geo",
          "Départements": "geo",
          
          // Culture générale -> Jaune (cg)
          "Dates Historiques": "cg",
          "Le Choix dans la Date": "cg",
          "Mathématiques": "cg",
          "Physique & Chimie": "cg",
          
          // Littérature/Arts -> Rouge (lit)
          "Bandes Dessinées & Mangas": "lit",
          "Mythologies": "lit",
          "Romans Célèbres": "lit",
          "Héros de Papier": "lit",
          "C'est un Cap !": "lit",
          "Livres → Films": "lit",
          
          // Sciences/Sports -> Vert (sport)
          "Football": "sport",
          "Formule 1": "sport",
        };
        
        const categoryType = categoryMapping[msg.categorie] || "default";
        const catClass = "cat-" + categoryType;
        wrap.classList.add(catClass);
        console.log("Catégorie:", msg.categorie, "-> Type:", categoryType, "-> Classe:", catClass);
      } else {
        // Catégorie par défaut si pas de catégorie spécifiée
        document.getElementById("choices").className = "cat-default";
      }
      renderQuestion(msg.text || msg.question, msg.choices, msg.qid);
      startTimer();
      setFeedback("");
    }

    // --- Résultat d'une réponse ---
    else if (msg.type === "result") {
      const feedbackEl = document.getElementById("feedback");
      if (msg.correct) {
        feedbackEl.textContent = `✅ +${msg.gain} points !`;
        feedbackEl.style.color = "green";
      } else {
        feedbackEl.textContent = `❌ Mauvaise réponse`;
        feedbackEl.style.color = "red";
      }

      // Met à jour le score global
      document.getElementById("score").textContent = `Score : ${msg.score}`;
    }


    // --- Score mis à jour ---
    else if (msg.type === "score_update") {
      document.getElementById("score").textContent = `Score : ${msg.score}`;
    }

    else if (msg.type === "round_update") {
      const round = msg.round;
      const total = msg.total;
      document.getElementById("round").textContent = `Tour : ${round} / ${total}`;
    }

    // --- Classement de fin de catégorie ---
    else if (msg.type === "show_ranking") {
      showRanking(msg.scores);
    }

    // --- Fin de partie ---
    else if (msg.type === "game_over") {
      setFeedback("🏁 Fin de partie !");
      stopTimer();
      showFinalRanking(msg.ranking);
    }
    // --- Demande de reload envoyée par le serveur ---
    else if (msg.type === "reload") {
      console.log('Reload demandé par le serveur');
      try {
        window.location.reload();
      } catch (e) {
        // en dernier recours, naviguer vers la même URL
        window.location.href = window.location.href;
      }
    }
  };

  ws.onclose = () => {
    setStatus("🔌 Déconnecté du serveur");
    if (reconnectAttempts < maxReconnectAttempts) {
      setTimeout(() => {
        reconnectAttempts++;
        setStatus(`🔄 Tentative de reconnexion ${reconnectAttempts}/${maxReconnectAttempts}...`);
        connect(url, playerName);
      }, 2000 * reconnectAttempts); // Délai croissant
    } else {
      setStatus("❌ Impossible de se reconnecter");
    }
  };
  
  ws.onerror = () => {
    setStatus("⚠️ Erreur de connexion !");
  };
}

// --- Quand le serveur envoie un choix de catégorie ---
function handleCategoryChoice(data) {
  hideAll();
  const chooser = data.chooser;
  const available = data.available;

  const info = document.getElementById("category-info");
  const buttons = document.getElementById("category-buttons");
  const box = document.getElementById("category-choice");

  info.textContent = `🎯 ${chooser} choisit une catégorie :`;
  buttons.innerHTML = "";
  box.classList.remove("hidden");

  available.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    const catClass = "cat-" + cat.replaceAll(" ", "_").replaceAll("&", "et").replaceAll("'", "").replaceAll("é", "e").toLowerCase();
    btn.classList.add(catClass);
    console.log("Classe:", catClass, "pour catégorie:", cat);

    // ✅ Si c’est TON tour de choisir :
    if (chooser === playerName) {
      btn.disabled = false;
      btn.onclick = () => {
        console.log("📤 Envoi du choix :", cat);
        ws.send(JSON.stringify({ type: "category_chosen", category: cat }));
        box.classList.add("hidden");
        document.getElementById("question").textContent = "⏳ En attente de la première question…";
        document.getElementById("game").classList.remove("hidden");
      };
    }
    // ❌ Si c’est le tour d’un autre joueur :
    else {
      btn.disabled = true;
      btn.style.opacity = 0.5;
    }

    buttons.appendChild(btn);
  });
}


// --- Affichage d'une question ---
function renderQuestion(text, choices, qid) {
  hideAll();
  const wrap = document.getElementById("choices");
  document.getElementById("question").textContent = text;
  document.getElementById("game").classList.remove("hidden");

  wrap.innerHTML = "";
  choices.forEach((c, i) => {
    const b = document.createElement("button");
    b.textContent = c;
    b.onclick = () => answer(i);
    wrap.appendChild(b);
  });
}

// --- Envoi de la réponse ---
function answer(choice) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !lastQid) {
    console.log('Impossible d\'envoyer la réponse: connexion fermée ou pas de question active');
    return;
  }
  ws.send(JSON.stringify({ type: "answer", qid: lastQid, choice }));
  disableChoices();
}

// --- Timer ---
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    const left = Math.max(0, deadline - Date.now());
    document.getElementById("timer").textContent = `⏱️ ${Math.ceil(left / 1000)}s`;
    if (left <= 0) stopTimer();
  }, 200);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
function disableChoices() { document.querySelectorAll("#choices button").forEach(b => b.disabled = true); }

// --- Feedback / UI utils ---
function hideAll() {
  document.querySelectorAll("#category-choice, #game").forEach(e => e.classList.add("hidden"));
}
function setStatus(t) { document.getElementById("status").textContent = t; }
function setFeedback(t) { document.getElementById("feedback").textContent = t; }


// --- Affichage du classement final ---
function showFinalRanking(ranking) {
  hideAll();
  const game = document.getElementById("game");
  game.classList.remove("hidden");
  
  // Trouver la position du joueur actuel
  const playerPosition = ranking.findIndex(player => player.name === playerName) + 1;
  
  let html = "<h2 style='color: gold; text-shadow: 0 0 10px gold;'>🏆 CLASSEMENT FINAL 🏆</h2>";
  
  // Afficher la position du joueur
  if (playerPosition === 1) {
    html += `<h2 style='color: #FFD700; text-shadow: 0 0 15px gold;'>🥇 FÉLICITATIONS ! VOUS ÊTES 1er ! 🥇</h2>`;
  } else if (playerPosition === 2) {
    html += `<h2 style='color: #C0C0C0; text-shadow: 0 0 15px silver;'>🥈 BRAVO ! VOUS ÊTES 2ème ! 🥈</h2>`;
  } else if (playerPosition === 3) {
    html += `<h2 style='color: #CD7F32; text-shadow: 0 0 15px #CD7F32;'>🥉 BIEN JOUÉ ! VOUS ÊTES 3ème ! 🥉</h2>`;
  } else {
    html += `<h2 style='color: #ffffff; text-shadow: 0 0 10px #ffffff;'>📊 VOUS ÊTES ${playerPosition}ème ! 📊</h2>`;
  }
  
  html += "<br>";
  
  ranking.forEach((player, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
    const isCurrentPlayer = player.name === playerName;
    const style = isCurrentPlayer ? "color: #FFD700; font-weight: bold; text-shadow: 0 0 10px gold;" : "";
    html += `<h3 style="${style}">${medal} ${player.name}: ${player.score} pts</h3>`;
  });
  
  document.getElementById("question").innerHTML = html;
  document.getElementById("choices").innerHTML = "";
  document.getElementById("score").innerHTML = "";
  document.getElementById("timer").innerHTML = "";
  document.getElementById("round").innerHTML = "";
}

// --- Démarrage ---
document.getElementById("btnJoin").onclick = () => {
  const name = document.getElementById("name").value.trim() || "Joueur";
  console.log("🔌 Connexion automatique à", RAILWAY_URL);
  connect(RAILWAY_URL, name);
};

// Pré-remplir le nom si déjà sauvegardé
if (playerName) {
  document.getElementById("name").value = playerName;
}
function show(sel) {
  document.querySelectorAll("#join, #game, #category-choice")
    .forEach(e => e.classList.add("hidden"));
  document.querySelector(sel).classList.remove("hidden");
}