// game.js - Logique du jeu modernisée
document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapCtx = minimapCanvas.getContext('2d');
    
    // Éléments UI
    const mainMenu = document.getElementById('mainMenu');
    const gameUI = document.getElementById('gameUI');
    const playButton = document.getElementById('playButton');
    const usernameInput = document.getElementById('usernameInputMenu');
    const myScoreElement = document.getElementById('myScore');
    const statusMessage = document.getElementById('statusMessage');
    const myColorIndicator = document.getElementById('myColorIndicator');
    const leaderboardList = document.getElementById('leaderboardList');
    const boostBar = document.getElementById('boostBar');
    const boostFill = document.getElementById('boostFill');
    const optionsButton = document.getElementById('optionsButton');
    const changeNameModal = document.getElementById('changeNameModal');
    const newUsernameInput = document.getElementById('newUsernameInput');
    const confirmNameChange = document.getElementById('confirmNameChange');
    const cancelNameChange = document.getElementById('cancelNameChange');
    
    // Stats
    const lengthStat = document.getElementById('lengthStat');
    const killsStat = document.getElementById('killsStat');
    const timeStat = document.getElementById('timeStat');

    // Configuration du jeu
    let gridSize = 15; // Taille réduite pour une map plus grande
    let worldWidth = 3000; // Largeur du monde en pixels
    let worldHeight = 3000; // Hauteur du monde en pixels
    let camera = { x: 0, y: 0 };
    let zoom = 1;
    
    // État du jeu
    let playerId;
    let gameState = {
        players: {},
        foods: [],
        bonuses: [],
        sparkles: [], // Nouveaux points scintillants
        leaderboard: []
    };
    let isPlaying = false;
    let currentUsername = '';
    let startTime = Date.now();
    let playerKills = 0;
    
    // Animation
    let animationId;
    let lastTime = 0;
    let sparkleAnimationFrame = 0;
    
    // Boost
    let isAccelerating = false;
    let boostEnergy = 100;
    const maxBoostEnergy = 100;
    const boostDrainRate = 2;
    const boostRechargeRate = 0.5;
    
    // Socket
    const socket = io();
    
    // Particules d'arrière-plan
    const backgroundParticles = [];
    const particleCount = 100;
    
    // Initialiser les particules
    function initBackgroundParticles() {
        for (let i = 0; i < particleCount; i++) {
            backgroundParticles.push({
                x: Math.random() * worldWidth,
                y: Math.random() * worldHeight,
                size: Math.random() * 3 + 1,
                opacity: Math.random() * 0.5 + 0.1,
                speed: Math.random() * 0.5 + 0.1
            });
        }
    }
    
    // Redimensionner le canvas
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        minimapCanvas.width = 200;
        minimapCanvas.height = 150;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Gestion du menu principal
    playButton.addEventListener('click', () => {
        const username = usernameInput.value.trim() || `Joueur_${Math.floor(Math.random() * 9999)}`;
        currentUsername = username;
        
        mainMenu.style.display = 'none';
        gameUI.style.display = 'block';
        
        // Se connecter au jeu
        socket.emit('joinGame', { username: username });
    });
    
    // Permettre de jouer avec Entrée
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            playButton.click();
        }
    });
    
    // Socket events
    socket.on('gameInit', (data) => {
        console.log("Jeu initialisé!", data);
        
        playerId = data.playerId;
        gameState = data.gameState;
        worldWidth = data.worldWidth || 3000;
        worldHeight = data.worldHeight || 3000;
        gridSize = data.gridSize;
        
        // Initialiser les particules
        initBackgroundParticles();
        
        // Afficher sa couleur
        myColorIndicator.style.backgroundColor = gameState.players[playerId].color;
        
        // Démarrer le jeu
        isPlaying = true;
        startTime = Date.now();
        
        // Démarrer l'animation
        requestAnimationFrame(gameLoop);
    });
    
    socket.on('gameUpdate', (newGameState) => {
        gameState = newGameState;
        updateLeaderboard();
        
        // Mettre à jour le score
        if (gameState.players[playerId]) {
            myScoreElement.textContent = gameState.players[playerId].score;
            lengthStat.textContent = gameState.players[playerId].snake.length;
        }
    });
    
    socket.on('playerKill', (data) => {
        if (data.killerId === playerId) {
            playerKills++;
            killsStat.textContent = playerKills;
            showStatus(`Vous avez éliminé ${data.killedUsername}! +50 points`);
        } else if (data.killedId === playerId) {
            showStatus(`Éliminé par ${data.killerUsername}!`);
        }
    });
    
    socket.on('playerReset', (data) => {
        myScoreElement.textContent = data.newScore;
        showStatus(data.message);
        playerKills = 0;
        killsStat.textContent = 0;
        startTime = Date.now();
    });
    
    socket.on('bonusCaught', (data) => {
        showStatus(`Bonus ${data.type} activé!`, 2000);
    });
    
    socket.on('disconnect', () => {
        isPlaying = false;
        showStatus("Déconnecté du serveur");
        setTimeout(() => {
            location.reload();
        }, 2000);
    });
    
    // Gestion de la souris
    function updateTarget(e) {
        if (!isPlaying || !gameState.players[playerId]) return;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Convertir en coordonnées du monde
        const worldX = camera.x + mouseX / zoom;
        const worldY = camera.y + mouseY / zoom;
        
        socket.emit('updateTarget', {
            targetX: worldX,
            targetY: worldY
        });
    }
    
    canvas.addEventListener('mousemove', updateTarget);
    canvas.addEventListener('click', updateTarget);
    
    // Gestion tactile
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        updateTarget({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    }, { passive: false });
    
    // Double tap pour boost sur mobile
    let lastTapTime = 0;
    canvas.addEventListener('touchstart', (e) => {
        const currentTime = Date.now();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0 && isPlaying && boostEnergy > 20) {
            startBoost();
            e.preventDefault();
        }
        lastTapTime = currentTime;
    });
    
    // Gestion du boost
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && isPlaying && boostEnergy > 20 && !isAccelerating) {
            startBoost();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && isAccelerating) {
            stopBoost();
        }
    });
    
    function startBoost() {
        if (boostEnergy > 20) {
            isAccelerating = true;
            boostBar.style.display = 'block';
            socket.emit('updateAcceleration', { isAccelerating: true });
        }
    }
    
    function stopBoost() {
        isAccelerating = false;
        socket.emit('updateAcceleration', { isAccelerating: false });
    }
    
    // Mettre à jour l'énergie du boost
    function updateBoostEnergy(deltaTime) {
        if (isAccelerating && boostEnergy > 0) {
            boostEnergy -= boostDrainRate;
            if (boostEnergy <= 0) {
                boostEnergy = 0;
                stopBoost();
            }
        } else if (!isAccelerating && boostEnergy < maxBoostEnergy) {
            boostEnergy += boostRechargeRate;
            if (boostEnergy > maxBoostEnergy) {
                boostEnergy = maxBoostEnergy;
            }
        }
        
        // Mettre à jour la barre visuelle
        boostFill.style.width = `${boostEnergy}%`;
        
        // Cacher la barre si pleine et pas en boost
        if (boostEnergy >= maxBoostEnergy && !isAccelerating) {
            boostBar.style.display = 'none';
        }
    }
    
    // Options
    optionsButton.addEventListener('click', () => {
        changeNameModal.style.display = 'block';
        newUsernameInput.value = currentUsername;
        newUsernameInput.focus();
    });
    
    confirmNameChange.addEventListener('click', () => {
        const newName = newUsernameInput.value.trim();
        if (newName && newName !== currentUsername) {
            currentUsername = newName;
            socket.emit('updateUsername', { username: newName });
        }
        changeNameModal.style.display = 'none';
    });
    
    cancelNameChange.addEventListener('click', () => {
        changeNameModal.style.display = 'none';
    });
    
    // Mettre à jour le leaderboard
    function updateLeaderboard() {
        leaderboardList.innerHTML = '';
        
        gameState.leaderboard.slice(0, 10).forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            if (player.id === playerId) {
                item.classList.add('current-player');
            }
            
            item.innerHTML = `
                <span class="leaderboard-rank">#${index + 1}</span>
                <div class="leaderboard-color" style="background-color: ${player.color}"></div>
                <span class="leaderboard-name">${player.username}</span>
                <span class="leaderboard-score">${player.score}</span>
            `;
            
            leaderboardList.appendChild(item);
        });
    }
    
    // Afficher un message de statut
    function showStatus(message, duration = 3000) {
        statusMessage.textContent = message;
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, duration);
    }
    
    // Mettre à jour le temps de jeu
    function updateGameTime() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        timeStat.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Calculer la caméra
    function updateCamera() {
        if (!gameState.players[playerId]) return;
        
        const player = gameState.players[playerId];
        const head = player.snake[0];
        
        // Centrer la caméra sur le joueur
        camera.x = head.x * gridSize - canvas.width / 2;
        camera.y = head.y * gridSize - canvas.height / 2;
        
        // Limiter la caméra aux bords du monde
        camera.x = Math.max(0, Math.min(worldWidth - canvas.width, camera.x));
        camera.y = Math.max(0, Math.min(worldHeight - canvas.height, camera.y));
    }
    
    // Dessiner la grille d'arrière-plan
    function drawGrid() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        const startX = Math.floor(camera.x / gridSize) * gridSize;
        const startY = Math.floor(camera.y / gridSize) * gridSize;
        const endX = startX + canvas.width + gridSize;
        const endY = startY + canvas.height + gridSize;
        
        // Lignes verticales
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x - camera.x, 0);
            ctx.lineTo(x - camera.x, canvas.height);
            ctx.stroke();
        }
        
        // Lignes horizontales
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y - camera.y);
            ctx.lineTo(canvas.width, y - camera.y);
            ctx.stroke();
        }
    }
    
    // Dessiner les particules d'arrière-plan
    function drawBackgroundParticles() {
        backgroundParticles.forEach(particle => {
            // Animation de défilement
            particle.y -= particle.speed;
            if (particle.y < 0) {
                particle.y = worldHeight;
                particle.x = Math.random() * worldWidth;
            }
            
            // Vérifier si visible
            const screenX = particle.x - camera.x;
            const screenY = particle.y - camera.y;
            
            if (screenX >= -10 && screenX <= canvas.width + 10 &&
                screenY >= -10 && screenY <= canvas.height + 10) {
                ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
                ctx.beginPath();
                ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    
    // Dessiner les points scintillants
    function drawSparkles() {
        sparkleAnimationFrame++;
        
        gameState.sparkles.forEach(sparkle => {
            const screenX = sparkle.x * gridSize - camera.x;
            const screenY = sparkle.y * gridSize - camera.y;
            
            if (screenX >= -20 && screenX <= canvas.width + 20 &&
                screenY >= -20 && screenY <= canvas.height + 20) {
                
                // Animation de scintillement
                const pulse = Math.sin(sparkleAnimationFrame * 0.1 + sparkle.id) * 0.3 + 0.7;
                const size = sparkle.size * pulse;
                
                // Dessiner le point scintillant avec un effet de halo
                ctx.shadowColor = sparkle.color;
                ctx.shadowBlur = 10;
                
                ctx.fillStyle = sparkle.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
                ctx.fill();
                
                // Ajouter un effet d'étoile
                ctx.strokeStyle = sparkle.color;
                ctx.lineWidth = 1;
                ctx.globalAlpha = pulse * 0.5;
                
                // Lignes en croix
                ctx.beginPath();
                ctx.moveTo(screenX - size * 2, screenY);
                ctx.lineTo(screenX + size * 2, screenY);
                ctx.moveTo(screenX, screenY - size * 2);
                ctx.lineTo(screenX, screenY + size * 2);
                ctx.stroke();
                
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
            }
        });
    }
    
    // Dessiner la nourriture
    function drawFood() {
        gameState.foods.forEach(food => {
            const screenX = food.x * gridSize - camera.x;
            const screenY = food.y * gridSize - camera.y;
            
            if (screenX >= -20 && screenX <= canvas.width + 20 &&
                screenY >= -20 && screenY <= canvas.height + 20) {
                
                // Animation de pulsation
                const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 1;
                const size = (gridSize / 3) * pulse;
                
                // Effet de lueur
                ctx.shadowColor = '#FF5252';
                ctx.shadowBlur = 8;
                
                ctx.fillStyle = '#FF5252';
                ctx.beginPath();
                ctx.arc(screenX + gridSize/2, screenY + gridSize/2, size, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.shadowBlur = 0;
            }
        });
    }
    
    // Dessiner les bonus
    function drawBonuses() {
        gameState.bonuses.forEach(bonus => {
            const screenX = bonus.x * gridSize - camera.x;
            const screenY = bonus.y * gridSize - camera.y;
            
            if (screenX >= -40 && screenX <= canvas.width + 40 &&
                screenY >= -40 && screenY <= canvas.height + 40) {
                
                // Animation de rotation
                const rotation = Date.now() * 0.002;
                
                ctx.save();
                ctx.translate(screenX + gridSize/2, screenY + gridSize/2);
                ctx.rotate(rotation);
                
                // Dessiner le bonus selon son type
                ctx.shadowColor = bonus.color;
                ctx.shadowBlur = 15;
                
                switch(bonus.type) {
                    case 'speed':
                        // Éclair
                        ctx.fillStyle = bonus.color;
                        ctx.beginPath();
                        ctx.moveTo(-10, -15);
                        ctx.lineTo(5, -5);
                        ctx.lineTo(-5, 5);
                        ctx.lineTo(10, 15);
                        ctx.lineTo(-5, 5);
                        ctx.lineTo(5, -5);
                        ctx.fill();
                        break;
                    
                    case 'size':
                        // Carré
                        ctx.fillStyle = bonus.color;
                        ctx.fillRect(-12, -12, 24, 24);
                        break;
                    
                    case 'points':
                        // Étoile
                        ctx.fillStyle = bonus.color;
                        drawStar(0, 0, 5, 15, 7);
                        break;
                    
                    case 'invincible':
                        // Bouclier
                        ctx.fillStyle = bonus.color;
                        ctx.beginPath();
                        ctx.moveTo(0, -15);
                        ctx.lineTo(12, -8);
                        ctx.lineTo(12, 8);
                        ctx.lineTo(0, 15);
                        ctx.lineTo(-12, 8);
                        ctx.lineTo(-12, -8);
                        ctx.closePath();
                        ctx.fill();
                        break;
                }
                
                ctx.restore();
                ctx.shadowBlur = 0;
            }
        });
    }
    
    // Fonction pour dessiner une étoile
    function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }
    
    // Dessiner les serpents
    function drawSnakes() {
        for (const id in gameState.players) {
            const player = gameState.players[id];
            const isCurrentPlayer = id === playerId;
            
            // Dessiner le corps du serpent
            ctx.strokeStyle = player.color;
            ctx.fillStyle = player.color;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Effet de lueur pour le joueur actuel
            if (isCurrentPlayer) {
                ctx.shadowColor = player.color;
                ctx.shadowBlur = 10;
            }
            
            // Dessiner le corps avec des segments fluides
            if (player.snake.length > 1) {
                ctx.beginPath();
                const firstSegment = player.snake[0];
                ctx.moveTo(
                    firstSegment.x * gridSize - camera.x + gridSize/2,
                    firstSegment.y * gridSize - camera.y + gridSize/2
                );
                
                // Utiliser des courbes de Bézier pour un mouvement fluide
                for (let i = 1; i < player.snake.length - 1; i++) {
                    const current = player.snake[i];
                    const next = player.snake[i + 1];
                    
                    const cpx = current.x * gridSize - camera.x + gridSize/2;
                    const cpy = current.y * gridSize - camera.y + gridSize/2;
                    const x = (current.x + next.x) / 2 * gridSize - camera.x + gridSize/2;
                    const y = (current.y + next.y) / 2 * gridSize - camera.y + gridSize/2;
                    
                    ctx.quadraticCurveTo(cpx, cpy, x, y);
                }
                
                // Dernier segment
                const lastSegment = player.snake[player.snake.length - 1];
                ctx.lineTo(
                    lastSegment.x * gridSize - camera.x + gridSize/2,
                    lastSegment.y * gridSize - camera.y + gridSize/2
                );
                
                // Largeur variable selon la position dans le corps
                ctx.lineWidth = gridSize;
                ctx.stroke();
            }
            
            // Dessiner la tête
            const head = player.snake[0];
            const headX = head.x * gridSize - camera.x + gridSize/2;
            const headY = head.y * gridSize - camera.y + gridSize/2;
            
            ctx.fillStyle = player.color;
            ctx.beginPath();
            ctx.arc(headX, headY, gridSize/2 + 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Yeux du serpent
            if (player.snake.length > 1) {
                const neck = player.snake[1];
                const angle = Math.atan2(head.y - neck.y, head.x - neck.x);
                
                ctx.fillStyle = 'white';
                const eyeDistance = gridSize * 0.3;
                const eyeSize = gridSize * 0.15;
                
                // Œil gauche
                ctx.beginPath();
                ctx.arc(
                    headX + Math.cos(angle - 0.5) * eyeDistance,
                    headY + Math.sin(angle - 0.5) * eyeDistance,
                    eyeSize,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                
                // Œil droit
                ctx.beginPath();
                ctx.arc(
                    headX + Math.cos(angle + 0.5) * eyeDistance,
                    headY + Math.sin(angle + 0.5) * eyeDistance,
                    eyeSize,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                
                // Pupilles
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(
                    headX + Math.cos(angle - 0.5) * eyeDistance,
                    headY + Math.sin(angle - 0.5) * eyeDistance,
                    eyeSize * 0.5,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(
                    headX + Math.cos(angle + 0.5) * eyeDistance,
                    headY + Math.sin(angle + 0.5) * eyeDistance,
                    eyeSize * 0.5,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
            
            // Nom du joueur
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Poppins';
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.strokeText(player.username, headX, headY - gridSize - 5);
            ctx.fillText(player.username, headX, headY - gridSize - 5);
            
            ctx.shadowBlur = 0;
        }
    }
    
    // Dessiner la minimap
    function drawMinimap() {
        // Fond de la minimap
        minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
        
        const scale = Math.min(
            minimapCanvas.width / worldWidth,
            minimapCanvas.height / worldHeight
        );
        
        // Dessiner tous les joueurs sur la minimap
        for (const id in gameState.players) {
            const player = gameState.players[id];
            const head = player.snake[0];
            
            const x = head.x * gridSize * scale;
            const y = head.y * gridSize * scale;
            
            minimapCtx.fillStyle = player.color;
            minimapCtx.beginPath();
            minimapCtx.arc(x, y, id === playerId ? 3 : 2, 0, Math.PI * 2);
            minimapCtx.fill();
        }
        
        // Indicateur de la zone visible
        if (gameState.players[playerId]) {
            minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            minimapCtx.strokeRect(
                camera.x * scale,
                camera.y * scale,
                canvas.width * scale,
                canvas.height * scale
            );
        }
    }
    
    // Boucle de jeu principale
    function gameLoop(currentTime) {
        if (!isPlaying) return;
        
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // Mettre à jour la caméra
        updateCamera();
        
        // Mettre à jour le boost
        updateBoostEnergy(deltaTime);
        
        // Mettre à jour le temps
        updateGameTime();
        
        // Effacer le canvas
        ctx.fillStyle = '#111922';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dessiner le jeu
        drawGrid();
        drawBackgroundParticles();
        drawSparkles();
        drawFood();
        drawBonuses();
        drawSnakes();
        
        // Dessiner la minimap
        drawMinimap();
        
        // Continuer l'animation
        animationId = requestAnimationFrame(gameLoop);
    }
});