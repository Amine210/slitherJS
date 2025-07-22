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
    players: {},
    foods: [],
    bonuses: [],
    sparkles: [], // Points scintillants
    leaderboard: []
};

// Configuration du jeu
const gridSize = 15; // Taille réduite pour permettre une plus grande map
const worldWidth = 3000; // Map beaucoup plus grande
const worldHeight = 3000;
const tileCountX = Math.floor(worldWidth / gridSize);
const tileCountY = Math.floor(worldHeight / gridSize);

// Configuration des spawns
const maxFoods = 200; // Plus de nourriture sur la grande map
const maxBonuses = 10;
const maxSparkles = 100; // Points scintillants

// Types de bonus
const bonusTypes = [
    {
        type: 'speed',
        duration: 5000,
        color: '#FFA500',
        effect: 'Augmente temporairement la vitesse'
    },
    {
        type: 'size',
        duration: 10000,
        color: '#9C27B0',
        effect: 'Augmente la taille du serpent'
    },
    {
        type: 'points',
        duration: 0,
        color: '#2196F3',
        effect: 'Bonus de points instantané'
    },
    {
        type: 'invincible',
        duration: 3000,
        color: '#FFEB3B',
        effect: 'Invincibilité temporaire'
    }
];

// Couleurs pour les points scintillants
const sparkleColors = [
    '#FFD700', // Or
    '#FF69B4', // Rose
    '#00CED1', // Turquoise
    '#FF6347', // Rouge tomate
    '#7FFF00', // Vert chartreuse
    '#FF1493', // Rose profond
    '#00FFFF', // Cyan
    '#FFB6C1', // Rose clair
    '#98FB98', // Vert pâle
    '#DDA0DD'  // Prune
];

// Fonction pour générer une couleur de serpent
function generatePlayerColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8C471', '#82E0AA',
        '#F1948A', '#85929E', '#5DADE2', '#48C9B0', '#F4D03F',
        '#EB984E', '#A569BD', '#5499C7', '#52BE80', '#F7DC6F'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Fonction pour placer un point scintillant
function placeSparkle() {
    if (gameState.sparkles.length >= maxSparkles) return;
    
    const sparkle = {
        id: Date.now() + Math.random(),
        x: Math.random() * tileCountX,
        y: Math.random() * tileCountY,
        color: sparkleColors[Math.floor(Math.random() * sparkleColors.length)],
        size: Math.random() * 3 + 2,
        value: Math.floor(Math.random() * 5) + 1 // Valeur en points
    };
    
    gameState.sparkles.push(sparkle);
}

// Fonction pour placer un bonus
function placeBonus() {
    if (gameState.bonuses.length >= maxBonuses) return;
    
    const marginTiles = 5;
    const bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
    
    const newBonus = {
        id: Date.now(),
        x: Math.floor(Math.random() * (tileCountX - marginTiles * 2)) + marginTiles,
        y: Math.floor(Math.random() * (tileCountY - marginTiles * 2)) + marginTiles,
        type: bonusType.type,
        duration: bonusType.duration,
        color: bonusType.color,
        effect: bonusType.effect,
        expiresAt: Date.now() + 20000 // Expire après 20 secondes
    };
    
    gameState.bonuses.push(newBonus);
}

// Fonction pour placer la nourriture
function placeFood() {
    if (gameState.foods.length >= maxFoods) return;
    
    const marginTiles = 5;
    const newFood = {
        id: Date.now() + Math.random(),
        x: Math.floor(Math.random() * (tileCountX - marginTiles * 2)) + marginTiles,
        y: Math.floor(Math.random() * (tileCountY - marginTiles * 2)) + marginTiles
    };
    
    gameState.foods.push(newFood);
}

// Initialiser le monde
function initializeWorld() {
    // Générer beaucoup de nourriture
    for (let i = 0; i < maxFoods; i++) {
        placeFood();
    }
    
    // Générer des points scintillants
    for (let i = 0; i < maxSparkles; i++) {
        placeSparkle();
    }
    
    // Quelques bonus au départ
    for (let i = 0; i < 5; i++) {
        placeBonus();
    }
}

initializeWorld();

// Générer régulièrement des éléments
setInterval(() => {
    // Nourriture
    while (gameState.foods.length < maxFoods) {
        placeFood();
    }
    
    // Points scintillants
    while (gameState.sparkles.length < maxSparkles) {
        placeSparkle();
    }
    
    // Bonus (moins fréquents)
    if (Math.random() < 0.1 && gameState.bonuses.length < maxBonuses) {
        placeBonus();
    }
}, 1000);

// Gérer les connexions WebSocket
io.on('connection', (socket) => {
    console.log(`Joueur connecté: ${socket.id}`);
    
    // Gérer la demande de connexion avec pseudo
    socket.on('joinGame', (data) => {
        const username = data.username || `Joueur_${socket.id.substring(0, 4)}`;
        const playerColor = generatePlayerColor();
        
        // Initialiser le joueur
        gameState.players[socket.id] = {
            snake: [],
            direction: { x: 1, y: 0 },
            targetX: 0,
            targetY: 0,
            score: 0,
            color: playerColor,
            username: username,
            isAccelerating: false,
            normalSpeed: 3,
            accelerationSpeed: 6,
            bonusEffects: [],
            isInvincible: false,
            kills: 0
        };
        
        // Créer un serpent à une position aléatoire
        const startX = Math.floor(Math.random() * (tileCountX - 40)) + 20;
        const startY = Math.floor(Math.random() * (tileCountY - 40)) + 20;
        
        for (let i = 0; i < 5; i++) {
            gameState.players[socket.id].snake.push({
                x: startX - i * 0.5,
                y: startY
            });
        }
        
        // Définir la cible initiale
        gameState.players[socket.id].targetX = (startX + 10) * gridSize;
        gameState.players[socket.id].targetY = startY * gridSize;
        
        // Envoyer l'état initial du jeu au joueur
        socket.emit('gameInit', {
            playerId: socket.id,
            gameState: gameState,
            gridSize: gridSize,
            worldWidth: worldWidth,
            worldHeight: worldHeight
        });
        
        // Informer les autres joueurs
        socket.broadcast.emit('playerJoined', {
            playerId: socket.id,
            player: gameState.players[socket.id]
        });
    });
    
    // Recevoir les mises à jour de la cible
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
    
    // Mettre à jour le pseudonyme
    socket.on('updateUsername', (data) => {
        if (gameState.players[socket.id] && data.username) {
            const sanitizedUsername = data.username.substring(0, 15).replace(/[^\w\s\-]/gi, '');
            gameState.players[socket.id].username = sanitizedUsername || `Joueur_${socket.id.substring(0, 4)}`;
            
            io.emit('playerUpdated', {
                playerId: socket.id,
                username: gameState.players[socket.id].username
            });
        }
    });
    
    // Gérer la déconnexion
    socket.on('disconnect', () => {
        console.log(`Joueur déconnecté: ${socket.id}`);
        delete gameState.players[socket.id];
        io.emit('playerLeft', { playerId: socket.id });
    });
});

// Boucle de jeu côté serveur
const gameLoopInterval = setInterval(() => {
    const now = Date.now();
    
    // Mettre à jour chaque joueur
    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (player.snake.length === 0) continue;
        
        const head = { x: player.snake[0].x, y: player.snake[0].y };
        
        // Gérer les effets de bonus
        for (let i = player.bonusEffects.length - 1; i >= 0; i--) {
            const effect = player.bonusEffects[i];
            if (now > effect.expiresAt) {
                player.bonusEffects.splice(i, 1);
                
                if (effect.type === 'speed') {
                    player.normalSpeed = 3;
                } else if (effect.type === 'invincible') {
                    player.isInvincible = false;
                }
                
                io.to(playerId).emit('bonusExpired', {
                    type: effect.type,
                    message: `L'effet ${effect.type} est terminé!`
                });
            }
        }
        
        // Calculer la direction vers la cible
        const dx = player.targetX - (head.x * gridSize);
        const dy = player.targetY - (head.y * gridSize);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            player.direction = {
                x: dx / distance,
                y: dy / distance
            };
        }
        
        // Calculer la vitesse
        let currentSpeed = player.normalSpeed;
        
        if (player.isAccelerating) {
            currentSpeed = player.accelerationSpeed;
            
            // Réduire la taille pendant l'accélération
            if (player.snake.length > 3 && Math.random() < 0.15) {
                player.snake.pop();
            }
        }
        
        // Bonus de vitesse
        for (const effect of player.bonusEffects) {
            if (effect.type === 'speed') {
                currentSpeed *= 1.5;
            }
        }
        
        // Déplacer la tête
        head.x += player.direction.x * (currentSpeed / 10);
        head.y += player.direction.y * (currentSpeed / 10);
        
        // Vérifier les collisions avec les murs
        if (head.x < 0 || head.x >= tileCountX || head.y < 0 || head.y >= tileCountY) {
            if (!player.isInvincible) {
                resetPlayer(playerId, null);
                continue;
            }
        }
        
        // Vérifier les collisions avec son propre corps
        let selfCollision = false;
        for (let i = 10; i < player.snake.length; i++) {
            const segment = player.snake[i];
            if (Math.abs(head.x - segment.x) < 0.5 && Math.abs(head.y - segment.y) < 0.5) {
                if (!player.isInvincible) {
                    resetPlayer(playerId, null);
                    selfCollision = true;
                    break;
                }
            }
        }
        
        if (selfCollision) continue;
        
        // Vérifier les collisions avec les autres serpents
        for (const otherPlayerId in gameState.players) {
            if (otherPlayerId === playerId) continue;
            
            const otherPlayer = gameState.players[otherPlayerId];
            for (const segment of otherPlayer.snake) {
                if (Math.abs(head.x - segment.x) < 0.8 && Math.abs(head.y - segment.y) < 0.8) {
                    if (!player.isInvincible) {
                        otherPlayer.score += 50;
                        otherPlayer.kills++;
                        resetPlayer(playerId, otherPlayerId);
                        selfCollision = true;
                        break;
                    }
                }
            }
            if (selfCollision) break;
        }
        
        if (selfCollision) continue;
        
        // Ajouter la nouvelle tête
        player.snake.unshift(head);
        
        // Vérifier la collecte de nourriture
        let foodEaten = false;
        for (let i = 0; i < gameState.foods.length; i++) {
            const food = gameState.foods[i];
            if (Math.abs(head.x - food.x) < 1 && Math.abs(head.y - food.y) < 1) {
                player.score += 10;
                gameState.foods.splice(i, 1);
                placeFood();
                foodEaten = true;
                break;
            }
        }
        
        // Vérifier la collecte de points scintillants
        for (let i = 0; i < gameState.sparkles.length; i++) {
            const sparkle = gameState.sparkles[i];
            if (Math.abs(head.x - sparkle.x) < 1.5 && Math.abs(head.y - sparkle.y) < 1.5) {
                player.score += sparkle.value;
                gameState.sparkles.splice(i, 1);
                placeSparkle();
                break;
            }
        }
        
        // Vérifier la collecte de bonus
        for (let i = 0; i < gameState.bonuses.length; i++) {
            const bonus = gameState.bonuses[i];
            if (Math.abs(head.x - bonus.x) < 1.5 && Math.abs(head.y - bonus.y) < 1.5) {
                applyBonus(playerId, bonus);
                gameState.bonuses.splice(i, 1);
                break;
            }
        }
        
        // Retirer la queue si pas de nourriture mangée
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
    
    // Mettre à jour le leaderboard
    updateLeaderboard();
    
    // Envoyer l'état mis à jour
    io.emit('gameUpdate', gameState);
}, 1000/15); // 15 FPS

// Fonction pour appliquer un bonus
function applyBonus(playerId, bonus) {
    const player = gameState.players[playerId];
    const now = Date.now();
    
    switch (bonus.type) {
        case 'speed':
            player.normalSpeed = 4.5;
            player.bonusEffects.push({
                type: 'speed',
                expiresAt: now + bonus.duration
            });
            break;
            
        case 'size':
            // Ajouter 10 segments
            for (let j = 0; j < 10; j++) {
                const lastSegment = player.snake[player.snake.length - 1];
                player.snake.push({ ...lastSegment });
            }
            player.score += 20;
            break;
            
        case 'points':
            player.score += 100;
            break;
            
        case 'invincible':
            player.isInvincible = true;
            player.bonusEffects.push({
                type: 'invincible',
                expiresAt: now + bonus.duration
            });
            break;
    }
    
    io.to(playerId).emit('bonusCaught', {
        type: bonus.type,
        message: `Bonus ${bonus.type} activé!`,
        duration: bonus.duration
    });
}

// Fonction pour mettre à jour le leaderboard
function updateLeaderboard() {
    const sortedPlayers = Object.entries(gameState.players)
        .map(([id, player]) => ({
            id: id,
            username: player.username,
            score: player.score,
            color: player.color,
            length: player.snake.length,
            kills: player.kills
        }))
        .sort((a, b) => b.score - a.score);
    
    gameState.leaderboard = sortedPlayers.slice(0, 10);
}

// Fonction pour réinitialiser un joueur
function resetPlayer(playerId, killerId) {
    const player = gameState.players[playerId];
    if (!player) return;
    
    // Notification de kill si applicable
    if (killerId && gameState.players[killerId]) {
        io.emit('playerKill', {
            killerId: killerId,
            killedId: playerId,
            killerUsername: gameState.players[killerId].username,
            killedUsername: player.username
        });
    }
    
    // Sauvegarder les infos
    const color = player.color;
    const username = player.username;
    const score = Math.floor(player.score / 2); // Perdre la moitié des points
    
    // Réinitialiser le serpent
    player.snake = [];
    const startX = Math.floor(Math.random() * (tileCountX - 40)) + 20;
    const startY = Math.floor(Math.random() * (tileCountY - 40)) + 20;
    
    for (let i = 0; i < 5; i++) {
        player.snake.push({
            x: startX - i * 0.5,
            y: startY
        });
    }
    
    player.direction = { x: 1, y: 0 };
    player.targetX = (startX + 10) * gridSize;
    player.targetY = startY * gridSize;
    player.score = score;
    player.color = color;
    player.username = username;
    player.isAccelerating = false;
    player.normalSpeed = 3;
    player.bonusEffects = [];
    player.isInvincible = false;
    
    io.to(playerId).emit('playerReset', {
        message: killerId ? `Éliminé par ${gameState.players[killerId].username}!` : "Collision! Vous avez été réinitialisé.",
        newScore: score
    });
}

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur Snake.io en cours d'exécution sur le port ${PORT}`);
    console.log(`Map: ${worldWidth}x${worldHeight} pixels (${tileCountX}x${tileCountY} tuiles)`);
});