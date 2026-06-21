let ws, deadline = 0, timerId = null, lastQid = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let currentRoomCode = null;
const RAILWAY_URL="wss://web-production-ae26f.up.railway.app";
let playerName = localStorage.getItem('playerName');
let playerId = localStorage.getItem('playerId');
let isBattleRoyale = false;
let isEliminated = false;
let currentLives = 0;

const categoryMapping = {
  "1960-70s": "blindtest",
  "1980s": "blindtest", 
  "1990s": "blindtest",
  "2000s": "blindtest",
  "2010s": "blindtest",
  "2020s": "blindtest",
  "Variété Française": "blindtest",
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
  "Rap": "blindtest",
  "Tiktok Hits": "blindtest",
  "Eurovision": "blindtest",
  

  "Disney": "div",
  "Marvel": "div",
  "Jeux Vidéos": "div",
  "Tabarnak": "div",
  "Affiches": "div",
  "Oscars": "div",

  "Capitales": "geo",
  "Drapeaux": "geo",
  "Départements": "geo",
  "Etats": "geo",
  "Préfectures": "geo",

  "Dates Historiques": "cg",
  "Le Choix dans la Date": "cg",
  "Mathématiques": "cg",
  "Physique & Chimie": "cg",

  "Bandes Dessinées & Mangas": "lit",
  "Mythologies": "lit",
  "Romans Célèbres": "lit",
  "Héros de Papier": "lit",
  "C'est un Cap !": "lit",
  "Livres → Films": "lit",

  "Football": "sport",
  "Formule 1": "sport",
  "Rugby": "sport",
  "Jeux Olympiques": "sport",
  "Multi-Sport": "sport"
};

if (!playerId) {
    playerId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    localStorage.setItem('playerId', playerId);  // 👈 sauvegarde immédiate
}


document.getElementById("room").value =
  new URLSearchParams(location.search).get("room") || "";


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
function connect(url, name, roomCode = null) {
  ws = new WebSocket(url);
  playerName = name;
  localStorage.setItem('playerName', name);
  localStorage.setItem('playerId', playerId);
   if (roomCode) currentRoomCode = roomCode.toUpperCase();

  ws.onopen = () => {
    setStatus("✅ Connecté au serveur !");
    reconnectAttempts = 0;
    if (roomCode) {
    ws.send(JSON.stringify({ 
      type: "join_room",
      code: roomCode.toUpperCase(),
      name: name,
      id: playerId,
      
    }));
    } else {
      ws.send(JSON.stringify({
        type: "join",
        name: name,
        id: playerId,
      }));
    }
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

    else if (msg.type === "battle_royale"){
      isBattleRoyale = true;
      setFeedback("⚔️ Battle Royale activé !");
    }

    else if (msg.type === "battle_royale_setup"){
      isBattleRoyale = true;
      isEliminated = false;
      currentLives = msg.lives;
      updateLivesDisplay();
    }


    // --- Une question démarre ---
    else if (msg.type === "question") {
      lastQid = msg.qid;
      deadline = Date.now() + (msg.duration * 1000);
      if (msg.categorie) {
        const wrap = document.getElementById("choices");
        wrap.className = ""; // reset
        
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

      if (msg.lives_left !== undefined) {
        currentLives = msg.lives_left;
        updateLivesDisplay();
      }
    }


    // --- Score mis à jour ---
    else if (msg.type === "score_update") {
      document.getElementById("score").textContent = `Score : ${msg.score}`;
    }

    else if (msg.type === "round_update") {
      const round = msg.round;
      const total = msg.total;
      if (total == "infinite") {
        document.getElementById("round").textContent = `Tour : ${round} / ∞`;
      } else {
        document.getElementById("round").textContent = `Tour : ${round} / ${total}`;
      }
    }

    // --- Classement de fin de catégorie ---
    else if (msg.type === "show_ranking") {
      showRanking(msg.scores);
    }

    else if (msg.type === "eliminated") {
      setFeedback("💀 Vous êtes éliminé !");
      isEliminated = true;
      disableChoices();
    }

    // --- Fin de partie ---
    else if (msg.type === "game_over") {
      setFeedback("🏁 Fin de partie !");
      stopTimer();
      showFinalRanking(msg.ranking);
    }
    else if (msg.type === "end_battle royale"){
      setFeedback("🏁 Fin de partie !");
      stopTimer();
      showFinalRanking(msg.ranking);
    }
    // --- Demande de reload envoyée par le serveur ---
    else if (msg.type === "reload") {
      console.log('Reload demandé par le serveur');
      isBattleRoyale = false;
      currentLives = 0;
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
        connect(url, playerName,currentRoomCode);
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

  available.forEach((cat, index) => {
    const isMystery = index === 2;
    const btn = document.createElement("button");
    btn.textContent = isMystery ? "Thème Mystère" : cat;
    const catClass = isMystery
      ? "cat-myst"
      : "cat-" + (categoryMapping[cat] || "default");
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
    b.disabled = isEliminated; // Désactiver si le joueur est éliminé
    wrap.appendChild(b);
  });
}

// --- Envoi de la réponse ---
function answer(choice) {
  if (isEliminated || !ws || ws.readyState !== WebSocket.OPEN || !lastQid) {
    console.log('Impossible d\'envoyer la réponse: connexion fermée ou pas de question active');
    return;
  }
  ws.send(JSON.stringify({
     type: isBattleRoyale ? "answer_battle_royale" : "answer",
     qid: lastQid, choice 
    }));
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
  const room = document.getElementById("room").value.trim();
  const name = document.getElementById("name").value.trim() || "Joueur";

  if (!room) {
    alert("Veuillez entrer le code de la partie.");
    return;
  }

  if (!name) {
    alert("Veuillez entrer votre pseudo.");
    return;
  }
  connect(RAILWAY_URL, name,room);
}


// Pré-remplir le nom si déjà sauvegardé
if (playerName) {
  document.getElementById("name").value = playerName;
}
function show(sel) {
  document.querySelectorAll("#join, #game, #category-choice")
    .forEach(e => e.classList.add("hidden"));
  document.querySelector(sel).classList.remove("hidden");
}


const midEl = document.getElementById('layer-mid');
for(let i = 0; i < 45; i++){
  const s = document.createElement('img');
  s.src = 'img/star.svg';
  const sz = Math.random() * 12 + 6;
  s.style.cssText = `
    position: absolute;
    width: ${sz}px;
    height: ${sz}px;
    top: ${Math.random()*100}%;
    left: ${Math.random()*100}%;
    opacity: ${0.4 + Math.random()*0.5};
    animation: twinkle ${1.5+Math.random()*3}s ease-in-out infinite ${-Math.random()*4}s;
    --max-op: ${0.4+Math.random()*0.6};
    filter: drop-shadow(0 0 3px white);
  `;
  midEl.appendChild(s);
}

const closeEl = document.getElementById('layer-close');
for(let i = 0; i < 45; i++){
  const s = document.createElement('img');
  s.src = 'img/star.svg';
  const sz = Math.random() * 12 + 6;
  s.style.cssText = `
    position: absolute;
    width: ${sz}px;
    height: ${sz}px;
    top: ${Math.random()*100}%;
    left: ${Math.random()*100}%;
    opacity: ${0.4 + Math.random()*0.5};
    animation: twinkle ${1.5+Math.random()*3}s ease-in-out infinite ${-Math.random()*4}s;
    --max-op: ${0.4+Math.random()*0.6};
    filter: drop-shadow(0 0 3px white);
  `;
  midEl.appendChild(s);
}

function updateLivesDisplay() {
  const livesEl = document.getElementById("lives");
  if (!isBattleRoyale) {
    livesEl.textContent = "";
    livesEl.hidden = true;
    return;
  }
  else {
    livesEl.hidden = false;
  }
  livesEl.textContent = "❤️".repeat(Math.max(0, currentLives)) + "🖤".repeat(Math.max(0, 3 - currentLives));
}