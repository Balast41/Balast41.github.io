let ws, deadline = 0, timerId = null, lastQid = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let currentRoomCode = null;
const URL = "wss://ws.balast.tech";
let playerName = localStorage.getItem('playerName');
let playerId = localStorage.getItem('playerId');
let isBattleRoyale = false;
let isEliminated = false;
let currentLives = 0;
let sliderAnswered = false;
let pingInterval = null;

const categoryMapping = {
  "Préhistoire": "blindtest",
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
  "Girl Power": "blindtest",
  "Albums Cultes": "blindtest",

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
  "Informatique": "cg",

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
  localStorage.setItem('playerId', playerId);
}

document.getElementById("room").value =
  new URLSearchParams(location.search).get("room") || "";

function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- Gestion économe du Ping ---
function startPing() {
  if (!pingInterval) {
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }
}

function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

// Gérer le changement de visibilité de la page (mise en pause en arrière-plan)
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    console.log('Page cachée - Pause des temporisateurs');
    stopPing();
  } else {
    console.log('Page visible - Reprise');
    startPing();
    if (ws && ws.readyState !== WebSocket.OPEN && playerName) {
      console.log('Reconnexion nécessaire');
      connect(URL, playerName, currentRoomCode);
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
    startPing();

    if (roomCode) {
      ws.send(JSON.stringify({ 
        type: "join_room",
        code: roomCode.toUpperCase(),
        name: name,
        id: playerId
      }));
    } else {
      ws.send(JSON.stringify({
        type: "join",
        name: name,
        id: playerId
      }));
    }
    show("#game");
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    console.log("📩 Reçu :", msg);

    if (msg.type === "pong") return;

    if (msg.type === "choose_category") {
      handleCategoryChoice(msg);
    }
    else if (msg.type === "battle_royale") {
      isBattleRoyale = true;
      setFeedback("⚔️ Battle Royale activé !");
    }
    else if (msg.type === "battle_royale_setup") {
      isBattleRoyale = true;
      isEliminated = false;
      currentLives = msg.lives;
      updateLivesDisplay();
    }
    else if (msg.type === "question") {
      lastQid = msg.qid;
      deadline = Date.now() + (msg.duration * 1000);
      const wrap = document.getElementById("choices");
      
      if (msg.categorie) {
        wrap.className = "";
        const categoryType = categoryMapping[msg.categorie] || "default";
        const catClass = "cat-" + categoryType;
        wrap.classList.add(catClass);
      } else {
        wrap.className = "cat-default";
      }

      if (msg.answer_type === "slider") {
        renderSliderQuestion(msg.text || msg.question, msg.choices, msg.qid);
      } else {
        renderQuestion(msg.text || msg.question, msg.choices, msg.qid);
      }
      startTimer();
      setFeedback("");
    }
    else if (msg.type === "result") {
      const feedbackEl = document.getElementById("feedback");
      if (msg.correct) {
        feedbackEl.textContent = `✅ +${msg.gain} points !`;
        feedbackEl.style.color = "green";
      } else {
        feedbackEl.textContent = `❌ Mauvaise réponse`;
        feedbackEl.style.color = "red";
      }

      document.getElementById("score").textContent = `Score : ${msg.score}`;

      if (msg.lives_left !== undefined) {
        currentLives = msg.lives_left;
        updateLivesDisplay();
      }
    }
    else if (msg.type === "score_update") {
      document.getElementById("score").textContent = `Score : ${msg.score}`;
    }
    else if (msg.type === "round_update") {
      const round = msg.round;
      const total = msg.total;
      document.getElementById("round").textContent = total === "infinite" 
        ? `Tour : ${round} / ∞` 
        : `Tour : ${round} / ${total}`;
    }
    else if (msg.type === "show_ranking") {
      showRanking(msg.scores);
    }
    else if (msg.type === "eliminated") {
      setFeedback("💀 Vous êtes éliminé !");
      isEliminated = true;
      disableChoices();
    }
    else if (msg.type === "game_over" || msg.type === "end_battle royale") {
      setFeedback("🏁 Fin de partie !");
      stopTimer();
      showFinalRanking(msg.ranking);
    }
    else if (msg.type === "reload") {
      console.log('Reload demandé par le serveur');
      isBattleRoyale = false;
      currentLives = 0;
      try {
        window.location.reload();
      } catch (e) {
        window.location.href = window.location.href;
      }
    }
  };

  ws.onclose = () => {
    setStatus("🔌 Déconnecté du serveur");
    stopPing();
    if (reconnectAttempts < maxReconnectAttempts) {
      setTimeout(() => {
        reconnectAttempts++;
        setStatus(`🔄 Tentative de reconnexion ${reconnectAttempts}/${maxReconnectAttempts}...`);
        connect(url, playerName, currentRoomCode);
      }, 2000 * reconnectAttempts);
    } else {
      setStatus("❌ Impossible de se reconnecter");
    }
  };

  ws.onerror = () => {
    setStatus("⚠️ Erreur de connexion !");
  };
}

// --- Choix de catégorie ---
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
    const catClass = isMystery ? "cat-myst" : "cat-" + (categoryMapping[cat] || "default");
    btn.classList.add(catClass);

    if (chooser === playerName) {
      btn.disabled = false;
      btn.onclick = () => {
        ws.send(JSON.stringify({ type: "category_chosen", category: cat }));
        box.classList.add("hidden");
        document.getElementById("question").textContent = "⏳ En attente de la première question…";
        document.getElementById("game").classList.remove("hidden");
      };
    } else {
      btn.disabled = true;
      btn.style.opacity = 0.5;
    }

    buttons.appendChild(btn);
  });
}

// --- Affichage d'une question ---
function renderQuestion(text, choices, qid) {
  hideAll();
  window._submitCurrentSlider = null;
  const wrap = document.getElementById("choices");
  document.getElementById("question").textContent = text;
  document.getElementById("game").classList.remove("hidden");

  wrap.innerHTML = "";
  choices.forEach((c, i) => {
    const b = document.createElement("button");
    b.textContent = c;
    b.onclick = () => answer(i);
    b.disabled = isEliminated;
    wrap.appendChild(b);
  });
}

// --- Envoi de la réponse ---
function answer(choice) {
  if (isEliminated || !ws || ws.readyState !== WebSocket.OPEN || !lastQid) {
    return;
  }
  ws.send(JSON.stringify({
    type: isBattleRoyale ? "answer_battle_royale" : "answer",
    qid: lastQid, 
    choice 
  }));
  disableChoices();
}

// --- Timer ---
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    const left = Math.max(0, deadline - Date.now());
    document.getElementById("timer").textContent = `⏱️ ${Math.ceil(left / 1000)}s`;
    if (left <= 0) { 
      stopTimer();
      if (typeof window._submitCurrentSlider === "function") {
        window._submitCurrentSlider();
      }
      disableChoices();
    }
  }, 200);
}

function stopTimer() { 
  if (timerId) { 
    clearInterval(timerId); 
    timerId = null; 
  } 
}

function disableChoices() { 
  document.querySelectorAll("#choices button, #choices input").forEach(b => b.disabled = true); 
}

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

  const playerPosition = ranking.findIndex(player => player.name === playerName) + 1;
  let html = "<h2 style='color: gold; text-shadow: 0 0 10px gold;'>🏆 CLASSEMENT FINAL 🏆</h2>";

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
  connect(URL, name, room);
};

if (playerName) {
  document.getElementById("name").value = playerName;
}

function show(sel) {
  document.querySelectorAll("#join, #game, #category-choice").forEach(e => e.classList.add("hidden"));
  document.querySelector(sel).classList.remove("hidden");
}

function updateLivesDisplay() {
  const livesEl = document.getElementById("lives");
  if (!isBattleRoyale) {
    livesEl.textContent = "";
    livesEl.hidden = true;
    return;
  }
  livesEl.hidden = false;
  livesEl.textContent = "❤️".repeat(Math.max(0, currentLives)) + "🖤".repeat(Math.max(0, 3 - currentLives));
}

function renderSliderQuestion(text, choices, qid) {
  hideAll();
  window._submitCurrentSlider = null;
  sliderAnswered = false;
  const [min, max] = choices;
  const mid = Math.round((min + max) / 2);

  document.getElementById("question").textContent = text;
  document.getElementById("game").classList.remove("hidden");

  const wrap = document.getElementById("choices");
  wrap.innerHTML = "";

  const valueDisplay = document.createElement("div");
  valueDisplay.id = "sliderValue";
  valueDisplay.className = "slider-value";
  valueDisplay.textContent = mid;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = "sliderInput";
  slider.min = min;
  slider.max = max;
  slider.value = mid;
  slider.step = 1;
  slider.disabled = isEliminated;

  const bounds = document.createElement("div");
  bounds.className = "slider-bounds";
  bounds.innerHTML = `<span>${min}</span><span>${max}</span>`;

  const submitBtn = document.createElement("button");
  submitBtn.id = "sliderSubmit";
  submitBtn.className = "submit-btn";
  submitBtn.textContent = "Valider";
  submitBtn.disabled = isEliminated;

  wrap.append(valueDisplay, slider, bounds, submitBtn);

  slider.addEventListener("input", () => {
    valueDisplay.textContent = slider.value;
  });

  function submitAnswer() {
    if (sliderAnswered || qid !== lastQid) return;
    sliderAnswered = true;
    submitBtn.disabled = true;
    slider.disabled = true;

    ws.send(JSON.stringify({
      type: isBattleRoyale ? "answer_battle_royale" : "answer",
      qid: qid,
      choice: parseInt(slider.value, 10)
    }));

    setFeedback("Réponse envoyée : " + slider.value);
  }

  submitBtn.addEventListener("click", submitAnswer);
  window._submitCurrentSlider = submitAnswer;
}