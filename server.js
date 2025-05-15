const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Configuration de l'application Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration du dossier static pour servir les fichiers du client
app.use(express.static(path.join(__dirname, 'public')));

// État global du jeu
const gameState = {
    players: {}, // Map des joueurs connectés
    foods: [],   // Liste des nourritures sur le terrain
    bonuses: [], // Liste des bonus sur le terrain
    leaderboard: [] // Tableau des meilleurs scores
};

// Configuration du jeu
const gridSize = 40;
let tileCountX = 40; // À ajuster selon vos besoins
let tileCountY = 30; // À ajuster selon vos besoins

// Types de bonus
const bonusTypes = [
    {
        type: 'speed',
        duration: 5000, // 5 secondes
        color: '#FFA500',
        effect: 'Augmente temporairement la vitesse'
    },
    {
        type: 'size',
        duration: 10000, // 10 secondes
        color: '#9C27B0',
        effect: 'Augmente la taille du serpent'
    },
    {
        type: 'points',
        duration: 0, // Effet instantané
        color: '#2196F3',
        effect: 'Bonus de points instantané'
    },
    {
        type: 'invincible',
        duration: 3000, // 3 secondes
        color: '#FFEB3B',
        effect: 'Invincibilité temporaire'
    }
];

// Fonction pour placer un bonus aléatoire sur le terrain
function placeBonus() {
    if (gameState.bonuses.length >= 3) return; // Limiter à 3 bonus à la fois

    const marginTiles = 2;
    const minX = marginTiles;
    const maxX = tileCountX - marginTiles - 1;
    const minY = marginTiles;
    const maxY = tileCountY - marginTiles - 1;

    // Sélectionner un type de bonus aléatoire
    const bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];

    const newBonus = {
        id: Date.now(), // ID unique pour le bonus
        x: Math.floor(Math.random() * (maxX - minX + 1)) + minX,
        y: Math.floor(Math.random() * (maxY - minY + 1)) + minY,
        type: bonusType.type,
        duration: bonusType.duration,
        color: bonusType.color,
        effect: bonusType.effect,
        expiresAt: Date.now() + 15000 // Le bonus disparaît après 15 secondes
    };

    // Vérifier que le bonus ne se superpose pas avec de la nourriture ou d'autres bonus
    for (const food of gameState.foods) {
        if (food.x === newBonus.x && food.y === newBonus.y) {
            return placeBonus(); // Recommencer si collision
        }
    }

    for (const bonus of gameState.bonuses) {
        if (bonus.x === newBonus.x && bonus.y === newBonus.y) {
            return placeBonus(); // Recommencer si collision
        }
    }

    gameState.bonuses.push(newBonus);
    return newBonus;
}

// Fonction pour placer la nourriture à une position aléatoire
function placeFood() {
    const marginTiles = 2;
    const minX = marginTiles;
    const maxX = tileCountX - marginTiles - 1;
    const minY = marginTiles;
    const maxY = tileCountY - marginTiles - 1;

    const newFood = {
        id: Date.now(), // ID unique pour la nourriture
        x: Math.floor(Math.random() * (maxX - minX + 1)) + minX,
        y: Math.floor(Math.random() * (maxY - minY + 1)) + minY
    };

    // Vérifier si la nourriture ne se superpose pas avec un joueur
    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        for (const segment of player.snake) {
            if (Math.round(segment.x) === newFood.x && Math.round(segment.y) === newFood.y) {
                return placeFood(); // Recommencer si la nourriture est sur un joueur
            }
        }
    }

    gameState.foods.push(newFood);
    return newFood;
}

// Initialiser quelques nourritures
for (let i = 0; i < 5; i++) {
    placeFood();
}

// Générer des bonus régulièrement
setInterval(() => {
    // 10% de chance de générer un bonus toutes les 5 secondes
    if (Math.random() < 0.1) {
        placeBonus();
    }
}, 5000);

// Gérer les connexions WebSocket
io.on('connection', (socket) => {
    console.log(`Joueur connecté: ${socket.id}`);

    // Générer une couleur aléatoire pour le joueur
    const playerColor = '#' + Math.floor(Math.random()*16777215).toString(16);

    // Initialiser le joueur
    gameState.players[socket.id] = {
        snake: [],
        direction: { x: 1, y: 0 },
        targetX: 0,
        targetY: 0,
        score: 0,
        color: playerColor,
        username: `Joueur_${socket.id.substring(0, 4)}`, // Pseudo par défaut avec ID tronqué
        isAccelerating: false,
        normalSpeed: 3,
        accelerationSpeed: 6,
        bonusEffects: [], // Tableau pour stocker les effets de bonus actifs
        isInvincible: false
    };

    // Créer un serpent droit au départ à une position aléatoire
    const startX = Math.floor(Math.random() * (tileCountX - 10)) + 5;
    const startY = Math.floor(Math.random() * (tileCountY - 10)) + 5;

    for (let i = 0; i < 5; i++) {
        gameState.players[socket.id].snake.push({
            x: startX - i * 0.1,
            y: startY
        });
    }

    // Envoyer l'état initial du jeu au joueur
    socket.emit('gameInit', {
        playerId: socket.id,
        gameState: gameState,
        gridSize: gridSize,
        tileCountX: tileCountX,
        tileCountY: tileCountY
    });

    // Informer les autres joueurs du nouveau joueur
    socket.broadcast.emit('playerJoined', {
        playerId: socket.id,
        player: gameState.players[socket.id]
    });

    // Recevoir les mises à jour de la cible du joueur
    socket.on('updateTarget', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].targetX = data.targetX;
            gameState.players[socket.id].targetY = data.targetY;
        }
    });

    // Recevoir les mises à jour de l'accélération
    socket.on('updateAcceleration', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].isAccelerating = data.isAccelerating;
        }
    });
    
    // Mettre à jour le pseudonyme du joueur
    socket.on('updateUsername', (data) => {
        if (gameState.players[socket.id] && data.username) {
            // Limiter la longueur et retirer les caractères non appropriés
            const sanitizedUsername = data.username.substring(0, 15).replace(/[^\w\s\-]/gi, '');
            gameState.players[socket.id].username = sanitizedUsername || `Joueur_${socket.id.substring(0, 4)}`;
            console.log(`Joueur ${socket.id} a changé son nom en: ${gameState.players[socket.id].username}`);
            
            // Mettre à jour l'affichage pour tous les joueurs
            io.emit('playerUpdated', {
                playerId: socket.id,
                username: gameState.players[socket.id].username
            });
        }
    });

    // Gérer la déconnexion d'un joueur
    socket.on('disconnect', () => {
        console.log(`Joueur déconnecté: ${socket.id}`);
        delete gameState.players[socket.id];
        io.emit('playerLeft', { playerId: socket.id });
    });
});

// Boucle de jeu côté serveur
const gameLoopInterval = setInterval(() => {
    const now = Date.now();

    // Mettre à jour la position de chaque joueur
    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        const head = { x: player.snake[0].x, y: player.snake[0].y };

        // Vérifier et mettre à jour les effets de bonus actifs
        for (let i = player.bonusEffects.length - 1; i >= 0; i--) {
            const effect = player.bonusEffects[i];
            if (now > effect.expiresAt) {
                // Supprimer l'effet expiré
                player.bonusEffects.splice(i, 1);

                // Réinitialiser les effets
                if (effect.type === 'speed') {
                    player.normalSpeed = 3; // Vitesse normale
                } else if (effect.type === 'invincible') {
                    player.isInvincible = false;
                }

                // Notifier le joueur que l'effet de bonus est terminé
                io.to(playerId).emit('bonusExpired', {
                    type: effect.type,
                    message: `L'effet ${effect.type} est terminé!`
                });
            }
        }

        // Calculer la direction vers la cible
        const headPixelX = head.x * gridSize + gridSize / 2;
        const headPixelY = head.y * gridSize + gridSize / 2;
        const dx = player.targetX - headPixelX;
        const dy = player.targetY - headPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Mettre à jour la direction si on n'est pas trop proche
        if (distance > 5) {
            player.direction = {
                x: dx / distance,
                y: dy / distance
            };
        }

        // Calculer la vitesse actuelle selon l'état d'accélération
        let currentSpeed = player.normalSpeed;

        // Appliquer l'accélération si active
        if (player.isAccelerating) {
            currentSpeed = player.accelerationSpeed;

            // Réduire la taille du serpent pendant l'accélération (tous les 5 cycles)
            if (player.snake.length > 5 && Math.random() < 0.2) {
                player.snake.pop();
            }
        }

        // Appliquer les effets de bonus de vitesse
        for (const effect of player.bonusEffects) {
            if (effect.type === 'speed') {
                currentSpeed *= 1.5; // Augmentation de 50%
            }
        }

        // Déplacer la tête dans la direction actuelle
        head.x += player.direction.x * (currentSpeed / 10);
        head.y += player.direction.y * (currentSpeed / 10);

        // Vérifier les collisions avec les murs
        const gridX = Math.round(head.x);
        const gridY = Math.round(head.y);

        if (gridX < 0 || gridX >= tileCountX || gridY < 0 || gridY >= tileCountY) {
            // Réinitialiser le serpent au lieu de terminer le jeu si pas invincible
            if (!player.isInvincible) {
                resetPlayer(playerId);
                continue;
            }
        }

        // Vérifier les collisions avec le corps du serpent
        let collision = false;
        // On commence à l'index 10 pour éviter les fausses collisions avec les segments proches de la tête
        for (let i = 10; i < player.snake.length; i++) {
            const segment = player.snake[i];
            if (Math.round(head.x) === Math.round(segment.x) &&
                Math.round(head.y) === Math.round(segment.y)) {
                // Réinitialiser le serpent au lieu de terminer le jeu si pas invincible
                if (!player.isInvincible) {
                    resetPlayer(playerId);
                    collision = true;
                    break;
                }
            }
        }

        if (collision) continue;

        // Vérifier les collisions avec les autres serpents
        for (const otherPlayerId in gameState.players) {
            if (otherPlayerId === playerId) continue;

            const otherPlayer = gameState.players[otherPlayerId];
            for (const segment of otherPlayer.snake) {
                if (Math.round(head.x) === Math.round(segment.x) &&
                    Math.round(head.y) === Math.round(segment.y)) {
                    // Réinitialiser le serpent au lieu de terminer le jeu si pas invincible
                    if (!player.isInvincible) {
                        resetPlayer(playerId);
                        otherPlayer.score += 50; // Bonus pour avoir "tué" un autre joueur
                        collision = true;
                        break;
                    }
                }
            }
            if (collision) break;
        }

        if (collision) continue;

        // Ajouter la nouvelle tête
        player.snake.unshift(head);

        // Vérifier si le serpent mange une nourriture
        let foodEaten = false;
        for (let i = 0; i < gameState.foods.length; i++) {
            const food = gameState.foods[i];
            const foodDistance = Math.sqrt(
                Math.pow(head.x - food.x, 2) +
                Math.pow(head.y - food.y, 2)
            );

            if (foodDistance < 1) {
                // Augmenter le score
                player.score += 10;

                // Supprimer la nourriture mangée
                gameState.foods.splice(i, 1);

                // Ajouter une nouvelle nourriture
                placeFood();

                foodEaten = true;
                break;
            }
        }

        // Vérifier si le serpent récupère un bonus
        for (let i = 0; i < gameState.bonuses.length; i++) {
            const bonus = gameState.bonuses[i];
            const bonusDistance = Math.sqrt(
                Math.pow(head.x - bonus.x, 2) +
                Math.pow(head.y - bonus.y, 2)
            );

            if (bonusDistance < 1) {
                // Appliquer l'effet du bonus
                switch (bonus.type) {
                    case 'speed':
                        player.normalSpeed = 4.5; // Augmenter la vitesse de base
                        player.bonusEffects.push({
                            type: 'speed',
                            expiresAt: now + bonus.duration
                        });
                        break;
                    case 'size':
                        // Ajouter des segments au serpent
                        for (let j = 0; j < 5; j++) {
                            const lastSegment = player.snake[player.snake.length - 1];
                            player.snake.push({ ...lastSegment });
                        }
                        break;
                    case 'points':
                        // Bonus de points instantané
                        player.score += 50;
                        break;
                    case 'invincible':
                        player.isInvincible = true;
                        player.bonusEffects.push({
                            type: 'invincible',
                            expiresAt: now + bonus.duration
                        });
                        break;
                }

                // Notifier le joueur de l'effet obtenu
                io.to(playerId).emit('bonusCaught', {
                    type: bonus.type,
                    message: `Bonus ${bonus.type} activé!`,
                    duration: bonus.duration
                });

                // Supprimer le bonus du jeu
                gameState.bonuses.splice(i, 1);
                break;
            }
        }

        // Retirer la queue du serpent s'il ne mange pas
        if (!foodEaten) {
            player.snake.pop();
        }
    }

    // Nettoyer les bonus expirés
    for (let i = gameState.bonuses.length - 1; i >= 0; i--) {
        if (Date.now() > gameState.bonuses[i].expiresAt) {
            gameState.bonuses.splice(i, 1);
        }
    }
    
    // Mettre à jour le tableau des meilleurs scores
    updateLeaderboard();

    // Envoyer l'état mis à jour à tous les joueurs
    io.emit('gameUpdate', gameState);
}, 1000/15); // Environ 15 FPS

// Fonction pour mettre à jour le tableau des meilleurs scores
function updateLeaderboard() {
    // Créer un tableau des joueurs triés par score
    const sortedPlayers = Object.values(gameState.players)
        .map(player => ({
            id: Object.keys(gameState.players).find(key => gameState.players[key] === player),
            username: player.username,
            score: player.score,
            color: player.color
        }))
        .sort((a, b) => b.score - a.score);
    
    // Garder seulement les 10 meilleurs joueurs
    gameState.leaderboard = sortedPlayers.slice(0, 10);
}

// Fonction pour réinitialiser un joueur
function resetPlayer(playerId) {
    const player = gameState.players[playerId];
    if (!player) return;

    // Sauvegarder la couleur et le score
    const color = player.color;
    const score = Math.floor(player.score / 2); // Perdre la moitié des points

    // Réinitialiser le serpent à une position aléatoire
    player.snake = [];
    const startX = Math.floor(Math.random() * (tileCountX - 10)) + 5;
    const startY = Math.floor(Math.random() * (tileCountY - 10)) + 5;

    for (let i = 0; i < 5; i++) {
        player.snake.push({
            x: startX - i * 0.1,
            y: startY
        });
    }

    player.direction = { x: 1, y: 0 };
    player.score = score;
    player.color = color;
    player.isAccelerating = false;
    player.normalSpeed = 3;
    player.bonusEffects = [];
    player.isInvincible = false;

    // Informer le joueur de sa réinitialisation
    io.to(playerId).emit('playerReset', {
        message: "Vous avez perdu! Votre serpent a été réinitialisé.",
        newScore: score
    });
}

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});