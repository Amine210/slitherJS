document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const startButton = document.getElementById('startButton');
    
    // Configuration du jeu
    const gridSize = 20;
    const tileCount = 20;
    let foodAnimationFrame = 0;
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    tileCountX = Math.floor(canvas.width / gridSize);
    tileCountY = Math.floor(canvas.height / gridSize);
}

    let tileCountX, tileCountY;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // État du jeu
    let snake = [];
    let food = {};
    let mouseX = 0;
    let mouseY = 0;
    let gameLoop;
    let score = 0;
    let gameRunning = false;
    
    // Initialisation du jeu
    function initGame() {
        // Réinitialiser le serpent
        snake = [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10}
        ];
        
        // Positionner la nourriture
        placeFood();
        
        // Réinitialiser le score
        score = 0;
        scoreElement.textContent = score;
        gameRunning = true;
        
        // Positionner la souris au centre du canvas
        mouseX = canvas.width / 2;
        mouseY = canvas.height / 2;
    }
    
    // Placer la nourriture à une position aléatoire
    function placeFood() {
        food = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
        
        // Vérifier que la nourriture n'est pas sur le serpent
        for (let segment of snake) {
            console.log("segment.x : " + segment.x) 
            console.log("segment.y : " +segment.y)
            console.log("food.x : " +food.x)
            console.log("food.y : " +food.y)
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
        
        // Dessiner le serpent
        ctx.fillStyle = '#4CAF50';
        for (let i = 0; i < snake.length; i++) {
            const segment = snake[i];
            ctx.fillRect(
                segment.x * gridSize, 
                segment.y * gridSize, 
                gridSize - 1, 
                gridSize - 1
            );
        }
        
        // Dessiner une animation de pulsation pour la nourriture
        const foodCenterX = food.x * gridSize + gridSize / 2;
        const foodCenterY = food.y * gridSize + gridSize / 2;
        const pulseRadius = (gridSize / 2) * (1 + 0.3 * Math.sin(foodAnimationFrame / 5));

        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(foodCenterX, foodCenterY, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        foodAnimationFrame++;
    }
    
    // Mise à jour du jeu
    function update() {
        if (!gameRunning) return;
        
        // Calculer la direction vers la souris
        const head = {x: snake[0].x, y: snake[0].y};
        const headPixelX = head.x * gridSize + gridSize / 2;
        const headPixelY = head.y * gridSize + gridSize / 2;
        
        // Calculer l'angle vers la souris
        const dx = mouseX - headPixelX;
        const dy = mouseY - headPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Si la souris est assez proche, ne pas bouger
        if (distance < 5) return;
        
        // Normaliser la direction
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Déplacer la tête dans la direction de la souris
        head.x += dirX * 0.3; // Vitesse réduite pour un meilleur contrôle
        head.y += dirY * 0.3;
        
        // Arrondir aux coordonnées de la grille
        head.x = Math.round(head.x * 10) / 10;
        head.y = Math.round(head.y * 10) / 10;
        
        // Vérifier les collisions avec les murs
        if (
            head.x < 0 || 
            head.x >= tileCount || 
            head.y < 0 || 
            head.y >= tileCount
        ) {
            gameOver();
            return;
        }
        
        // Vérifier les collisions avec le serpent
        for (let i = 0; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                gameOver();
                return;
            }
        }
        
        // Ajouter la nouvelle tête
        snake.unshift(head);
        
        // Vérifier si le serpent mange la nourriture
        if (head.x === food.x && head.y === food.y) {
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
    
    // Suivre la position de la souris
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });
    
    // Gérer le toucher sur mobile
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        mouseX = e.touches[0].clientX - rect.left;
        mouseY = e.touches[0].clientY - rect.top;
    }, { passive: false });
    
    // Démarrer le jeu
    startButton.addEventListener('click', () => {
        if (gameRunning) {
            clearInterval(gameLoop);
        }
        initGame();
        gameLoop = setInterval(game, 50); // Vitesse augmentée pour un meilleur suivi
    });
    
    // Initialisation initiale
    initGame();
    draw();
});
