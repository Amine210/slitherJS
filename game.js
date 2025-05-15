// PARTIE 1 : Initialisation et fonctions principales
document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const myScoreElement = document.getElementById('myScore');
    const startButton = document.getElementById('startButton');
    const ui = document.getElementById("ui");
    const statusDiv = document.getElementById("status");
    const myColorDot = document.getElementById("myColorDot");
    const scoreboard = document.getElementById("scoreboard");
    const controlsInfo = document.getElementById("controls");
    const uiHeight = ui.offsetHeight;

    // Configuration du jeu
    let gridSize = 20;
    let tileCountX, tileCountY;
    let foodAnimationFrame = 0;
    let isAccelerating = false;
    let accelerationTimer = 0;
    const accelerationDuration = 30; // 2 secondes à environ 15 FPS
    const boostIndicatorColor = '#FF6F00';

    // État du jeu
    let playerId;
    let gameState = {
        players: {},
        foods: [],
        leaderboard: []
    };
    let isPlaying = false;
    let currentUsername = '';

    // Gestion des manettes
    let gamepads = {};
    let gamepadConnected = false;
    let lastGamepadTimestamp = 0;
    const gamepadDeadzone = 0.15; // Zone morte des joysticks
    let gamepadLoopRunning = false;

    // Référence pour le modal
    let usernameModal;

    // Connecter au serveur WebSocket
    const socket = io();

    // Créer le tableau des meilleurs scores et le bouton de changement de pseudo
    createLeaderboard();
    createUsernameButton();

    // Mise à jour des contrôles pour inclure les manettes
    updateControlsInfo();

    // Initialiser l'API Gamepad
    initGamepadAPI();

    // Redimensionner le canvas
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - uiHeight;

        if (isPlaying) {
            // Informer le serveur de la nouvelle taille du terrain
            socket.emit('canvasResize', {
                width: canvas.width,
                height: canvas.height
            });
        }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialisation du jeu - Réception des données initiales du serveur
    socket.on('gameInit', (data) => {
        console.log("Jeu initialisé!", data);

        playerId = data.playerId;
        gameState = data.gameState;
        gridSize = data.gridSize;
        tileCountX = data.tileCountX;
        tileCountY = data.tileCountY;

        // Stocker le nom d'utilisateur
        if (gameState.players[playerId]) {
            currentUsername = gameState.players[playerId].username;
        }

        // Afficher sa propre couleur
        myColorDot.style.backgroundColor = gameState.players[playerId].color;

        // Afficher son propre pseudo
        document.getElementById('myUsername').textContent = currentUsername;

        // Mettre à jour l'interface
        updateScoreboard();
        updateLeaderboardDisplay();

        // Afficher le message de bienvenue
        showStatus("Vous avez rejoint la partie!");
        setTimeout(() => {
            hideStatus();
        }, 2000);

        // Modifier le texte du bouton
        startButton.textContent = "Rejoindre à nouveau";

        isPlaying = true;
    });

    // Rejoindre le jeu en cliquant sur le bouton
    startButton.addEventListener('click', () => {
        if (!isPlaying) {
            socket.connect(); // Reconnexion au serveur si déconnecté
        } else {
            socket.emit('restartPlayer'); // Demande de réinitialisation du joueur
        }
    });

    // Réception des mises à jour du jeu
    socket.on('gameUpdate', (newGameState) => {
        gameState = newGameState;
        updateScoreboard();
        updateLeaderboardDisplay();

        // Mettre à jour son propre score
        if (gameState.players[playerId]) {
            myScoreElement.textContent = gameState.players[playerId].score;
        }
    });

    // Réception d'un nouvel joueur
    socket.on('playerJoined', (data) => {
        gameState.players[data.playerId] = data.player;
        updateScoreboard();
        showStatus(`Un nouveau joueur a rejoint la partie!`);
        setTimeout(() => {
            hideStatus();
        }, 2000);
    });

    // Réception du départ d'un joueur
    socket.on('playerLeft', (data) => {
        delete gameState.players[data.playerId];
        updateScoreboard();
        showStatus(`Un joueur a quitté la partie`);
        setTimeout(() => {
            hideStatus();
        }, 2000);
    });

    // Réception d'une mise à jour de joueur (ex: changement de pseudo)
    socket.on('playerUpdated', (data) => {
        if (gameState.players[data.playerId]) {
            // Mettre à jour le pseudo du joueur
            if (data.username) {
                gameState.players[data.playerId].username = data.username;

                // Si c'est notre propre pseudo qui a été mis à jour
                if (data.playerId === playerId) {
                    currentUsername = data.username;
                    document.getElementById('myUsername').textContent = data.username;
                }

                // Mettre à jour l'affichage
                updateScoreboard();
            }
        }
    });

    // Réception d'une réinitialisation de joueur (après une collision)
    socket.on('playerReset', (data) => {
        myScoreElement.textContent = data.newScore;
        showStatus(data.message);
        setTimeout(() => {
            hideStatus();
        }, 2000);
    });

    // Gestion de la déconnexion du serveur
    socket.on('disconnect', () => {
        isPlaying = false;
        isAccelerating = false; // Réinitialiser l'accélération en cas de déconnexion
        showStatus("Déconnecté du serveur");
        startButton.textContent = "Rejoindre à nouveau";
        // Masquer l'indicateur de boost
        const boostIndicator = document.getElementById('boostIndicator');
        if (boostIndicator) {
            boostIndicator.style.display = 'none';
        }
    });

    // PARTIE 2 : Fonctions de jeu, affichage et interactions utilisateur

    // Fonction pour mettre à jour le tableau des scores
    function updateScoreboard() {
        // Supprimer les scores existants sauf le premier (le vôtre)
        while (scoreboard.children.length > 1) {
            scoreboard.removeChild(scoreboard.lastChild);
        }

        // Limiter le nombre de joueurs affichés dans le scoreboard (hors le vôtre)
        const otherPlayers = Object.entries(gameState.players)
            .filter(([id]) => id !== playerId)
            .sort(([, playerA], [, playerB]) => playerB.score - playerA.score)
            .slice(0, 3); // Afficher seulement les 3 meilleurs autres joueurs

        // Ajouter les scores des autres joueurs
        for (const [id, player] of otherPlayers) {
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';

            const colorDot = document.createElement('div');
            colorDot.className = 'color-dot';
            colorDot.style.backgroundColor = player.color;

            const scoreText = document.createElement('span');
            scoreText.textContent = `${player.username}: ${player.score}`;

            scoreItem.appendChild(colorDot);
            scoreItem.appendChild(scoreText);
            scoreboard.appendChild(scoreItem);
        }
    }

    // Fonction pour mettre à jour les informations sur les contrôles
    function updateControlsInfo() {
        if (controlsInfo) {
            controlsInfo.innerHTML = '<strong>ESPACE</strong> = Accélérer pendant 2 secondes (réduit la taille) | <strong>Double Tap</strong> = Accélérer sur mobile | <strong>Souris</strong> = Diriger | <strong>Manette</strong> = Joysticks pour diriger, boutons pour accélérer';
        }
    }

    // Fonction pour afficher un message de statut
    function showStatus(message) {
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
    }

    // Fonction pour cacher le message de statut
    function hideStatus() {
        statusDiv.style.display = 'none';
    }

    // Créer le modal de configuration du pseudo
    function createUsernameModal() {
        // Créer l'élément modal
        const modal = document.createElement('div');
        modal.id = 'usernameModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Choisir un pseudo</h2>
                <input type="text" id="usernameInput" placeholder="Entrez votre pseudo" maxlength="15">
                <div class="modal-buttons">
                    <button id="saveUsername">Sauvegarder</button>
                    <button id="cancelUsername">Annuler</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Récupérer les références aux éléments du modal
        const usernameInput = document.getElementById('usernameInput');
        const saveButton = document.getElementById('saveUsername');
        const cancelButton = document.getElementById('cancelUsername');

        // Ajouter les événements
        saveButton.addEventListener('click', () => {
            const newUsername = usernameInput.value.trim();
            if (newUsername) {
                currentUsername = newUsername;
                updateUsername(newUsername);
            }
            closeUsernameModal();
        });

        cancelButton.addEventListener('click', closeUsernameModal);

        // Validation à l'appui de la touche Entrée
        usernameInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                saveButton.click();
            } else if (e.key === 'Escape') {
                cancelButton.click();
            }
        });

        return modal;
    }

    // Ouvrir le modal de configuration du pseudo
    function openUsernameModal() {
        if (!usernameModal) {
            usernameModal = createUsernameModal();
        }

        // Pré-remplir avec le pseudo actuel si disponible
        const usernameInput = document.getElementById('usernameInput');
        if (gameState.players[playerId]) {
            usernameInput.value = gameState.players[playerId].username || '';
        } else {
            usernameInput.value = currentUsername || '';
        }

        usernameModal.style.display = 'flex';
        usernameInput.focus();
    }

    // Fermer le modal de configuration du pseudo
    function closeUsernameModal() {
        if (usernameModal) {
            usernameModal.style.display = 'none';
        }
    }

    // Envoyer une mise à jour du pseudo au serveur
    function updateUsername(username) {
        socket.emit('updateUsername', { username: username });
    }

    // Créer le tableau des meilleurs scores
    function createLeaderboard() {
        const leaderboardContainer = document.createElement('div');
        leaderboardContainer.id = 'leaderboardContainer';
        leaderboardContainer.innerHTML = `
            <div class="leaderboard-header">
                <h3>Meilleurs Scores</h3>
            </div>
            <div id="leaderboardList" class="leaderboard-list"></div>
        `;
        document.body.appendChild(leaderboardContainer);
    }

    // Mettre à jour l'affichage du tableau des meilleurs scores
    function updateLeaderboardDisplay() {
        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList) return;

        // Vider la liste actuelle
        leaderboardList.innerHTML = '';

        // Créer des entrées pour chaque joueur dans le leaderboard
        gameState.leaderboard.forEach((player, index) => {
            const playerItem = document.createElement('div');
            playerItem.className = 'leaderboard-item';
            if (player.id === playerId) {
                playerItem.classList.add('current-player');
            }

            playerItem.innerHTML = `
                <div class="rank">${index + 1}</div>
                <div class="leaderboard-color-dot" style="background-color: ${player.color}"></div>
                <div class="username">${player.username}</div>
                <div class="score">${player.score}</div>
            `;

            leaderboardList.appendChild(playerItem);
        });
    }

    // Ajouter un bouton pour modifier le pseudo
    function createUsernameButton() {
        const usernameButton = document.createElement('button');
        usernameButton.id = 'changeUsernameButton';
        usernameButton.textContent = 'Changer de pseudo';
        usernameButton.addEventListener('click', openUsernameModal);

        // Ajouter le bouton au UI
        const uiContainer = document.getElementById('ui');
        uiContainer.appendChild(usernameButton);
    }

    // Fonction de dessin
    function draw() {
        // Effacer le canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Dessiner tous les joueurs
        for (const id in gameState.players) {
            const player = gameState.players[id];
            const snake = player.snake;
            const isCurrentPlayer = id === playerId;

            // Vérifier si c'est le joueur actuel et s'il est en accélération
            let playerColor = player.color;
            let shadowEffect = false;

            if (isCurrentPlayer && isAccelerating) {
                playerColor = boostIndicatorColor; // Couleur orange pendant l'accélération
                shadowEffect = true;

                // Ajouter un effet de traînée de boost
                if (snake.length > 0) {
                    const head = snake[0];
                    // Si on a une direction (au moins 2 segments)
                    if (snake.length > 1) {
                        const secondSegment = snake[1];
                        const dirX = head.x - secondSegment.x;
                        const dirY = head.y - secondSegment.y;

                        // Dessiner des particules de boost
                        ctx.fillStyle = '#FFCC80'; // Couleur claire pour les particules
                        for (let i = 0; i < 5; i++) {
                            const offsetX = -dirX * (i * 8 + Math.random() * 5);
                            const offsetY = -dirY * (i * 8 + Math.random() * 5);
                            const particleSize = (5 - i) * 2 + Math.random() * 2;

                            ctx.beginPath();
                            ctx.arc(
                                (head.x * gridSize + gridSize/2) + offsetX,
                                (head.y * gridSize + gridSize/2) + offsetY,
                                particleSize,
                                0,
                                Math.PI * 2
                            );
                            ctx.fill();
                        }
                    }
                }
            }

            // Effet de shadow si en accélération
            if (shadowEffect) {
                ctx.shadowColor = boostIndicatorColor;
                ctx.shadowBlur = 15;
            } else {
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            // Dessiner le serpent avec une traînée fluide
            ctx.fillStyle = playerColor;
            for (let i = 0; i < snake.length; i++) {
                const segment = snake[i];
                const nextSegment = snake[i + 1] || segment;

                // Dessiner un cercle à chaque segment
                ctx.beginPath();
                ctx.arc(
                    segment.x * gridSize + gridSize/2,
                    segment.y * gridSize + gridSize/2,
                    gridSize/2 - 1,
                    0,
                    Math.PI * 2
                );
                ctx.fill();

                // Dessiner une ligne entre les segments pour une apparence plus fluide
                if (i < snake.length - 1) {
                    ctx.beginPath();
                    ctx.moveTo(
                        segment.x * gridSize + gridSize/2,
                        segment.y * gridSize + gridSize/2
                    );
                    ctx.lineTo(
                        nextSegment.x * gridSize + gridSize/2,
                        nextSegment.y * gridSize + gridSize/2
                    );
                    ctx.lineWidth = gridSize - 2;
                    ctx.strokeStyle = playerColor;
                    ctx.stroke();
                }
            }

            // Ajouter une indication pour le joueur actuel (un contour lumineux)
            if (isCurrentPlayer && snake.length > 0) {
                const head = snake[0];
                ctx.beginPath();
                ctx.arc(
                    head.x * gridSize + gridSize/2,
                    head.y * gridSize + gridSize/2,
                    gridSize/2 + 2,
                    0,
                    Math.PI * 2
                );
                ctx.strokeStyle = 'gold';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Dessiner le pseudo au-dessus de la tête
                ctx.fillStyle = 'black';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(
                    player.username,
                    head.x * gridSize + gridSize/2,
                    head.y * gridSize - 10
                );
            } else if (snake.length > 0) {
                // Dessiner le pseudo pour les autres joueurs
                const head = snake[0];
                ctx.fillStyle = 'black';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(
                    player.username,
                    head.x * gridSize + gridSize/2,
                    head.y * gridSize - 10
                );
            }
        }

        // Dessiner toutes les nourritures
        foodAnimationFrame++;
        for (const food of gameState.foods) {
            const pulseRadius = (gridSize / 2) * (1 + 0.3 * Math.sin(foodAnimationFrame / 5));

            ctx.fillStyle = '#FF5252';
            ctx.beginPath();
            ctx.arc(
                food.x * gridSize + gridSize/2,
                food.y * gridSize + gridSize/2,
                pulseRadius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // Dessiner la grille pour plus de clarté
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (let x = 0; x <= tileCountX; x++) {
            ctx.beginPath();
            ctx.moveTo(x * gridSize, 0);
            ctx.lineTo(x * gridSize, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= tileCountY; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * gridSize);
            ctx.lineTo(canvas.width, y * gridSize);
            ctx.stroke();
        }

        // Continuer la boucle d'animation
        requestAnimationFrame(draw);
    }

    // PARTIE 3: Gestion des contrôles et de la manette

    // Mettre à jour la cible au clic ou au toucher
    function updateTarget(e) {
        if (!isPlaying || !gameState.players[playerId]) return;

        const rect = canvas.getBoundingClientRect();
        const targetX = (e.clientX || e.touches[0].clientX) - rect.left;
        const targetY = (e.clientY || e.touches[0].clientY) - rect.top;

        // Envoyer la nouvelle cible au serveur
        socket.emit('updateTarget', {
            targetX: targetX,
            targetY: targetY
        });
    }

    // Écouter les événements de souris
    canvas.addEventListener('mousemove', updateTarget);
    canvas.addEventListener('click', updateTarget);

    // Gérer le toucher sur mobile
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        updateTarget(e);
    }, { passive: false });
    canvas.addEventListener('touchstart', updateTarget, { passive: false });

    // Gestion de l'accélération avec la touche espace
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && isPlaying && !isAccelerating) {
            console.log('Espace pressé: activation de l\'accélération');
            startAcceleration();
        }
    });

    // Support tactile pour l'accélération (double tap)
    let lastTapTime = 0;
    canvas.addEventListener('touchstart', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0 && isPlaying && !isAccelerating) {
            // Double tap détecté, activer l'accélération
            startAcceleration();
            e.preventDefault();
        }
        lastTapTime = currentTime;
    });

    // Création et gestion de l'indicateur visuel de boost
    const boostIndicator = document.createElement('div');
    boostIndicator.id = 'boostIndicator';
    boostIndicator.innerHTML = `
        <div id="boostLabel">BOOST!</div>
        <div id="boostProgressContainer">
            <div id="boostProgress"></div>
        </div>
    `;
    document.body.appendChild(boostIndicator);

    // Ajouter les styles CSS pour l'interface
    const style = document.createElement('style');
    style.textContent = `
        #boostIndicator {
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 60, 0, 0.9);
            padding: 12px 30px;
            border-radius: 30px;
            text-align: center;
            z-index: 9999;
            display: none;
            box-shadow: 0 0 25px rgba(255, 100, 0, 0.9);
            animation: pulse 0.5s infinite alternate;
            pointer-events: none;
            font-family: Arial, sans-serif;
            border: 3px solid white;
        }
        
        #boostLabel {
            color: white;
            font-weight: bold;
            font-size: 24px;
            text-shadow: 0 0 8px rgba(0, 0, 0, 0.7);
            margin-bottom: 8px;
        }
        
        #boostProgressContainer {
            width: 150px;
            height: 12px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 6px;
            overflow: hidden;
            margin: 0 auto;
            border: 2px solid rgba(255, 255, 255, 0.8);
        }
        
        #boostProgress {
            height: 100%;
            width: 100%;
            background: white;
            border-radius: 4px;
            transition: width 0.1s linear;
        }
        
        @keyframes pulse {
            from { transform: translateX(-50%) scale(1); filter: brightness(0.9); }
            to { transform: translateX(-50%) scale(1.1); filter: brightness(1.1); }
        }
        
        /* Styles pour le Leaderboard */
        #leaderboardContainer {
            position: fixed;
            top: 70px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 10px;
            padding: 10px;
            width: 250px;
            z-index: 100;
        }
        
        .leaderboard-header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.3);
            padding-bottom: 5px;
        }
        
        .leaderboard-header h3 {
            margin: 0;
            font-size: 18px;
        }
        
        .leaderboard-list {
            max-height: 200px;
            overflow-y: auto;
        }
        
        .leaderboard-item {
            display: flex;
            align-items: center;
            padding: 5px 0;
            margin-bottom: 5px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .leaderboard-item.current-player {
            background: rgba(255, 215, 0, 0.2);
            border-radius: 5px;
            padding: 5px;
        }
        
        .rank {
            width: 30px;
            text-align: center;
            font-weight: bold;
        }
        
        .leaderboard-color-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin: 0 10px;
        }
        
        .username {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .score {
            width: 50px;
            text-align: right;
            font-weight: bold;
        }
        
        /* Style du bouton pour changer de pseudo */
        #changeUsernameButton {
            margin-left: 10px;
            padding: 5px 15px;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        
        #changeUsernameButton:hover {
            background-color: #0b7dda;
        }
        
        /* Styles pour le modal */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        
        .modal-content {
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            max-width: 400px;
            width: 100%;
        }
        
        .modal-content h2 {
            margin-top: 0;
            color: #333;
        }
        
        #usernameInput {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            box-sizing: border-box;
        }
        
        .modal-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 15px;
        }
        
        .modal-buttons button {
            padding: 8px 15px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        
        #saveUsername {
            background-color: #4CAF50;
            color: white;
        }
        
        #cancelUsername {
            background-color: #f44336;
            color: white;
        }
        
        /* Style pour la notification de manette */
        #gamepadNotification {
            position: fixed;
            top: 120px;
            left: 20px;
            background: rgba(0, 150, 255, 0.8);
            color: white;
            padding: 8px 15px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 100;
            display: none;
            animation: fadeIn 0.3s;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    // Fonction pour démarrer l'accélération
    function startAcceleration() {
        isAccelerating = true;
        accelerationTimer = accelerationDuration;

        // Envoyer l'état d'accélération au serveur
        socket.emit('updateAcceleration', { isAccelerating: true });

        // Afficher l'indicateur visuel
        boostIndicator.style.display = 'block';

        // Démarrer le timer pour l'accélération
        updateAccelerationTimer();
    }

    // Fonction pour mettre à jour le timer d'accélération
    function updateAccelerationTimer() {
        if (accelerationTimer > 0) {
            accelerationTimer--;

            // Mettre à jour la barre de progression
            const boostProgress = document.getElementById('boostProgress');
            if (boostProgress) {
                const percentage = (accelerationTimer / accelerationDuration) * 100;
                boostProgress.style.width = percentage + '%';
            }

            setTimeout(updateAccelerationTimer, 1000/15); // Environ 15 FPS
        } else {

            // Fin de l'accélération
            isAccelerating = false;

            // Informer le serveur
            socket.emit('updateAcceleration', { isAccelerating: false });

            // Masquer l'indicateur
            boostIndicator.style.display = 'none';
        }
    }

    // Initialiser l'API Gamepad
    function initGamepadAPI() {
        // Écouter les événements de connexion/déconnexion de manette
        window.addEventListener("gamepadconnected", handleGamepadConnected);
        window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

        // Créer la notification de manette
        createGamepadNotification();

        // Vérifier les manettes déjà connectées
        const existingGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < existingGamepads.length; i++) {
            if (existingGamepads[i]) {
                handleGamepadConnected({ gamepad: existingGamepads[i] });
            }
        }
    }

    // Créer la notification de manette
    function createGamepadNotification() {
        const notification = document.createElement('div');
        notification.id = 'gamepadNotification';
        document.body.appendChild(notification);
    }

    // Afficher la notification de manette
    function showGamepadNotification(message, duration = 3000) {
        const notification = document.getElementById('gamepadNotification');
        if (notification) {
            notification.textContent = message;
            notification.style.display = 'block';

            // Masquer après la durée spécifiée
            setTimeout(() => {
                notification.style.display = 'none';
            }, duration);
        }
    }

    // Gérer la connexion d'une manette
    function handleGamepadConnected(event) {
        const gamepad = event.gamepad || event;
        gamepads[gamepad.index] = gamepad;
        gamepadConnected = true;
        console.log(`Manette connectée: ${gamepad.id}`);

        // Afficher un message à l'utilisateur
        showGamepadNotification(`Manette connectée: ${gamepad.id.split('(')[0]}`);

        // Démarrer la boucle de mise à jour de la manette
        if (!gamepadLoopRunning) {
            gamepadLoopRunning = true;
            updateGamepadState();
        }
    }

    // Gérer la déconnexion d'une manette
    function handleGamepadDisconnected(event) {
        delete gamepads[event.gamepad.index];

        // Vérifier s'il reste des manettes connectées
        let stillConnected = false;
        for (const gamepadId in gamepads) {
            if (gamepads[gamepadId]) {
                stillConnected = true;
                break;
            }
        }

        gamepadConnected = stillConnected;
        console.log(`Manette déconnectée: ${event.gamepad.id}`);

        // Afficher un message à l'utilisateur
        showGamepadNotification(`Manette déconnectée: ${event.gamepad.id.split('(')[0]}`);
    }

    // Mise à jour de l'état de la manette
    function updateGamepadState() {
        // Mettre à jour la liste des manettes
        const currentGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < currentGamepads.length; i++) {
            if (currentGamepads[i]) {
                gamepads[currentGamepads[i].index] = currentGamepads[i];
            }
        }

        // Traiter toutes les manettes connectées
        for (const gamepadId in gamepads) {
            const gamepad = gamepads[gamepadId];
            if (!gamepad) continue;

            // Éviter les mises à jour redondantes
            if (gamepad.timestamp && gamepad.timestamp === lastGamepadTimestamp) {
                continue;
            }

            lastGamepadTimestamp = gamepad.timestamp;

            // Ne traiter les entrées que si le jeu est actif
            if (isPlaying && gameState.players[playerId]) {
                // Gérer les joysticks pour la direction
                const leftStickX = applyDeadzone(gamepad.axes[0]);
                const leftStickY = applyDeadzone(gamepad.axes[1]);
                const rightStickX = applyDeadzone(gamepad.axes[2]);
                const rightStickY = applyDeadzone(gamepad.axes[3]);

                // Utiliser le stick avec le plus grand déplacement
                let activeStickX = 0;
                let activeStickY = 0;

                if (Math.abs(leftStickX) > 0 || Math.abs(leftStickY) > 0) {
                    activeStickX = leftStickX;
                    activeStickY = leftStickY;
                } else if (Math.abs(rightStickX) > 0 || Math.abs(rightStickY) > 0) {
                    activeStickX = rightStickX;
                    activeStickY = rightStickY;
                }

                // Mise à jour de la cible si le joystick est utilisé
                if (activeStickX !== 0 || activeStickY !== 0) {
                    // Obtenir la position actuelle du serpent
                    const snake = gameState.players[playerId].snake;
                    if (snake && snake.length > 0) {
                        const head = snake[0];

                        // Calculer la nouvelle cible en fonction du joystick
                        // Le joystick donne une direction, nous devons la convertir en position
                        const distance = 300; // Distance fixe pour la cible
                        const targetX = (head.x * gridSize + gridSize/2) + (activeStickX * distance);
                        const targetY = (head.y * gridSize + gridSize/2) + (activeStickY * distance);

                        // Envoyer la nouvelle cible au serveur
                        socket.emit('updateTarget', {
                            targetX: targetX,
                            targetY: targetY
                        });
                    }
                }

                // Gérer les boutons pour l'accélération
                // Types de manettes courants :
                // - PS5/4: X = 0, Circle = 1, Square = 2, Triangle = 3, L1 = 4, R1 = 5, L2 = 6, R2 = 7
                // - Xbox: A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, LT = 6, RT = 7
                const accelerateButtons = [0, 1, 2, 5, 7]; // X/A, Circle/B, Square/X, R1/RB, R2/RT

                let shouldAccelerate = false;
                for (const buttonIndex of accelerateButtons) {
                    if (gamepad.buttons[buttonIndex] && gamepad.buttons[buttonIndex].pressed) {
                        shouldAccelerate = true;
                        break;
                    }
                }

                // Gérer l'accélération
                if (shouldAccelerate && !isAccelerating) {
                    console.log('Bouton d\'accélération pressé sur la manette');
                    startAcceleration();
                }
            }
        }

        // Continuer la boucle si des manettes sont connectées
        if (gamepadConnected) {
            requestAnimationFrame(updateGamepadState);
        } else {
            gamepadLoopRunning = false;
        }
    }

    // Appliquer une zone morte aux axes du joystick
    function applyDeadzone(value) {
        // Si la valeur est inférieure à la zone morte, retourner 0
        if (Math.abs(value) < gamepadDeadzone) {
            return 0;
        }

        // Sinon, normaliser la valeur après application de la zone morte
        const sign = value > 0 ? 1 : -1;
        return sign * (Math.abs(value) - gamepadDeadzone) / (1 - gamepadDeadzone);
    }

    // Démarrer la boucle de dessin
    draw();
});