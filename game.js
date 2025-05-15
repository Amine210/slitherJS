document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const startButton = document.getElementById('startButton');
    const ui = document.getElementById("ui");
    const uiHeight = ui.offsetHeight;
    // Configuration du jeu
    const gridSize = 20;
    const tileCount = 20;
    let foodAnimationFrame = 0;
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight 
    tileCountX = Math.floor(canvas.width / gridSize);
    tileCountY = Math.floor(canvas.height / gridSize);
}

    let tileCountX, tileCountY;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // État du jeu
    let snake = [];
    let food = {};
    let targetX = 0;
    let targetY = 0;
    let direction = { x: 1, y: 0 }; // Direction initiale vers la droite
    let gameLoop;
    let score = 0;
    let gameRunning = false;
    const snakeSpeed = 3; // Vitesse de déplacement du serpent
    
    // Initialisation du jeu
    function initGame() {
        // Réinitialiser le serpent
        snake = [];
        // Créer un serpent droit au départ
        for (let i = 0; i < 15; i++) {
            snake.push({
                x: 10 - i * 0.1,  // Léger décalage pour la fluidité
                y: 10
            });
        }
        
        // Positionner la nourriture
        placeFood();
        
        // Réinitialiser le score
        score = 0;
        scoreElement.textContent = score;
        gameRunning = true;
        
        // Positionner la cible légèrement à droite du serpent au démarrage
        targetX = canvas.width * 0.7;
        targetY = canvas.height / 2;
    }
    
    // Placer la nourriture à une position aléatoire
function placeFood() {
    const marginPx = 50;
    const marginTiles = Math.ceil(marginPx / gridSize);

    const minX = marginTiles;
    const maxX = tileCountX - marginTiles - 1;

    const minY = marginTiles + 5;
    console.log(minY)
    const maxY = tileCountY - marginTiles - 1;

    food = {
        x: Math.floor(Math.random() * (maxX - minX + 1)) + minX,
        y: Math.floor(Math.random() * (maxY - minY + 1)) + minY
    };

    for (let segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            return placeFood();
        }
    }
}

        
    // Fonction de dessin
    function draw() {
        // Effacer le canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dessiner le serpent avec une traînée fluide
        ctx.fillStyle = '#4CAF50';
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
                ctx.strokeStyle = '#4CAF50';
                ctx.stroke();
            }
        }
        
        // Dessiner une animation de pulsation pour la nourriture
        const foodCenterX = food.x * gridSize + gridSize / 2;
        const foodCenterY = food.y * gridSize + gridSize / 2;
        const pulseRadius = (gridSize / 2) * (1 + 0.3 * Math.sin(foodAnimationFrame / 5));

        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(
            food.x * gridSize + gridSize/2, 
            food.y * gridSize + gridSize/2, 
            gridSize/2 - 1, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
    }
    
    // Mise à jour du jeu
    function update() {
        if (!gameRunning) return;
        
        // Calculer la direction vers la cible
        const head = {x: snake[0].x, y: snake[0].y};
        const headPixelX = head.x * gridSize + gridSize / 2;
        const headPixelY = head.y * gridSize + gridSize / 2;
        
        // Calculer la direction vers la cible
        const dx = targetX - headPixelX;
        const dy = targetY - headPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Mettre à jour la direction si on est pas trop proche
        if (distance > 5) {
            // Normaliser la direction
            direction = {
                x: dx / distance,
                y: dy / distance
            };
        }
        
        // Déplacer la tête dans la direction actuelle
        head.x += direction.x * (snakeSpeed / 10);
        head.y += direction.y * (snakeSpeed / 10);


        
        // Arrondir aux coordonnées de la grille pour la détection de collision
        const gridX = Math.round(head.x);
        const gridY = Math.round(head.y);
        
        // Vérifier les collisions avec les murs
        if (
            gridX < 0 || 
            gridX >= tileCount || 
            gridY < 0 || 
            gridY >= tileCount
        ) {
            gameOver();
            return;
        }
        
        // Vérifier les collisions avec le corps du serpent
        // On commence à l'index 10 pour éviter les fausses collisions avec les segments proches de la tête
        for (let i = 10; i < snake.length; i++) {
            const segment = snake[i];
            // Vérifier la collision uniquement sur la grille (comme dans un vrai Snake)
            if (Math.round(head.x) === Math.round(segment.x) && 
                Math.round(head.y) === Math.round(segment.y)) {
                gameOver();
                return;
            }
        }
        
        // Ajouter la nouvelle tête
        snake.unshift(head);
        
        // Vérifier si le serpent mange la nourriture (avec une marge de 0.3 pour une meilleure jouabilité)
        const foodDistance = Math.sqrt(
            Math.pow(head.x - food.x, 2) + 
            Math.pow(head.y - food.y, 2)
        );
        
        if (foodDistance < 1) {
            // Augmenter le score
            score += 10;
            scoreElement.textContent = score;
            
            // Placer une nouvelle nourriture
            placeFood();
        } else {
            // Retirer la queue du serpent s'il ne mange pas
            snake.pop();
        }
    }
    
    // Gestion de la fin de partie
    function gameOver() {
        gameRunning = false;
        clearInterval(gameLoop);
        alert(`Game Over! Votre score: ${score}`);
    }
    
    // Boucle de jeu
    function game() {
        update();
        draw();
    }
    
    // Mettre à jour la cible au clic ou au toucher
    function updateTarget(e) {
        const rect = canvas.getBoundingClientRect();
        targetX = (e.clientX || e.touches[0].clientX) - rect.left;
        targetY = (e.clientY || e.touches[0].clientY) - rect.top;
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
    
    // Démarrer le jeu
    startButton.addEventListener('click', () => {
        if (gameRunning) {
            clearInterval(gameLoop);
        }
        initGame();
        gameLoop = setInterval(game, 1000/15); // Environ 15 FPS
    });
    
    // Initialisation initiale
    initGame();
    // Afficher l'écran de démarrage
    draw();
});
