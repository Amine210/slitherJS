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
    const uiHeight = ui.offsetHeight;

    // Configuration du jeu
    let gridSize = 20;
    let tileCountX, tileCountY;
    let foodAnimationFrame = 0;

    // État du jeu
    let playerId;
    let gameState = {
        players: {},
        foods: []
    };
    let isPlaying = false;

    // Connecter au serveur WebSocket
    const socket = io();

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

        // Afficher sa propre couleur
        myColorDot.style.backgroundColor = gameState.players[playerId].color;

        // Mettre à jour l'interface
        updateScoreboard();

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
        showStatus("Déconnecté du serveur");
        startButton.textContent = "Rejoindre à nouveau";
    });

    // Fonction pour mettre à jour le tableau des scores
    function updateScoreboard() {
        // Supprimer les scores existants sauf le premier (le vôtre)
        while (scoreboard.children.length > 1) {
            scoreboard.removeChild(scoreboard.lastChild);
        }

        // Ajouter les scores des autres joueurs
        for (const id in gameState.players) {
            if (id === playerId) continue; // Sauter votre propre score

            const player = gameState.players[id];
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';

            const colorDot = document.createElement('div');
            colorDot.className = 'color-dot';
            colorDot.style.backgroundColor = player.color;

            const scoreText = document.createElement('span');
            scoreText.textContent = `Joueur: ${player.score}`;

            scoreItem.appendChild(colorDot);
            scoreItem.appendChild(scoreText);
            scoreboard.appendChild(scoreItem);
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

            // Dessiner le serpent avec une traînée fluide
            ctx.fillStyle = player.color;
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
                    ctx.strokeStyle = player.color;
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

    // Démarrer la boucle de dessin
    draw();
});