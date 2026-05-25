const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

const playerImage = new Image();
playerImage.src = 'player.png';

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 64,
    speed: 3
};

let score = 0;
let health = 3;
let gameOver = false;
let lastShotTime = 0;
const shootCooldown = 1000;
let enemySpeed = 1.5;
let spawnRate = 1000;
let difficultyTimer = 0;
let level = 1;
let shakeAmount = 0;

// High scores
let highScores = JSON.parse(localStorage.getItem('retrostrikeScores')) || [];

// Audio setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShoot() {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function playExplosion() {
    const bufferSize = audioCtx.sampleRate * 0.2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    source.start(audioCtx.currentTime);
}

function playHit() {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.3);
}

function playGameOver() {
    const notes = [440, 370, 311, 277];
    notes.forEach(function(freq, i) {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.2);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.2 + 0.3);
        oscillator.start(audioCtx.currentTime + i * 0.2);
        oscillator.stop(audioCtx.currentTime + i * 0.2 + 0.3);
    });
}

function playPowerUp() {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
}

function playBossSpawn() {
    const notes = [150, 120, 100];
    notes.forEach(function(freq, i) {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime + i * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.3);
        oscillator.start(audioCtx.currentTime + i * 0.15);
        oscillator.stop(audioCtx.currentTime + i * 0.15 + 0.3);
    });
}

// Stars
const stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random()
    });
}

// Particles
const particles = [];

function spawnParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 / 12) * i;
        particles.push({
            x: x,
            y: y,
            dx: Math.cos(angle) * (Math.random() * 3 + 1),
            dy: Math.sin(angle) * (Math.random() * 3 + 1),
            size: Math.random() * 4 + 2,
            opacity: 1,
            color: color || '#ff0066'
        });
    }
}

const keys = {};
document.addEventListener('keydown', function(e) { keys[e.key] = true; });
document.addEventListener('keyup', function(e) { keys[e.key] = false; });

const bullets = [];

document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    if (enemies.length === 0) return;
    if (gameOver) return;

    const now = Date.now();
    if (now - lastShotTime < shootCooldown) return;
    lastShotTime = now;

    let nearest = null;
    let minDistance = Infinity;

    for (let i = 0; i < enemies.length; i++) {
        const dx = enemies[i].x - player.x;
        const dy = enemies[i].y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = enemies[i];
        }
    }

    const dx = nearest.x - player.x;
    const dy = nearest.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    playShoot();

    if (tripleShot) {
        const angles = [-0.2, 0, 0.2];
        angles.forEach(function(offset) {
            const angle = Math.atan2(dy, dx) + offset;
            bullets.push({
                x: player.x,
                y: player.y,
                dx: Math.cos(angle) * 7,
                dy: Math.sin(angle) * 7,
                size: 6,
                color: '#00ffff',
                trail: []
            });
        });
    } else {
        bullets.push({
            x: player.x,
            y: player.y,
            dx: (dx / distance) * 7,
            dy: (dy / distance) * 7,
            size: 6,
            color: '#00ffff',
            trail: []
        });
    }
});

const enemies = [];
let spawnInterval = setInterval(spawnEnemy, spawnRate);

function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * canvas.width; y = 0; }
    if (side === 1) { x = Math.random() * canvas.width; y = canvas.height; }
    if (side === 2) { x = 0; y = Math.random() * canvas.height; }
    if (side === 3) { x = canvas.width; y = Math.random() * canvas.height; }
    enemies.push({ x, y, size: 20, speed: enemySpeed, color: '#ff0066', isBoss: false });
}

// Power ups
const powerUps = [];
let speedBoost = false;
let speedBoostTimer = 0;
let tripleShot = false;
let tripleShotTimer = 0;
let shield = false;

function spawnPowerUp(x, y) {
    if (Math.random() > 0.3) return;
    const types = ['speed', 'triple', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    const colors = { speed: '#ffff00', triple: '#00ffff', shield: '#00ff00' };
    const icons = { speed: '⚡', triple: '💥', shield: '🛡️' };
    powerUps.push({
        x, y,
        type,
        color: colors[type],
        icon: icons[type],
        size: 20
    });
}

// Boss
let boss = null;
let bossSpawned = false;

function spawnBoss() {
    playBossSpawn();
    boss = {
        x: canvas.width / 2,
        y: -60,
        size: 60,
        speed: 1.2,
        health: 5,
        maxHealth: 5,
        color: '#ff6600',
        flashTimer: 0
    };
}

// Day/Night cycle
let timeOfDay = 0;
const skyPhases = [
    { r: 0, g: 0, b: 20 },       // deep space
    { r: 20, g: 5, b: 30 },      // purple night
    { r: 40, g: 10, b: 10 },     // blood moon
    { r: 10, g: 0, b: 20 },      // back to space
];

function getSkyColor() {
    const phase = timeOfDay / 30;
    const index = Math.floor(phase) % skyPhases.length;
    const next = (index + 1) % skyPhases.length;
    const t = phase - Math.floor(phase);
    const c = skyPhases[index];
    const n = skyPhases[next];
    const r = Math.floor(c.r + (n.r - c.r) * t);
    const g = Math.floor(c.g + (n.g - c.g) * t);
    const b = Math.floor(c.b + (n.b - c.b) * t);
    return `rgb(${r},${g},${b})`;
}

function removeWhiteBackground(image) {
    const offscreen = document.createElement('canvas');
    offscreen.width = image.width;
    offscreen.height = image.height;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(image, 0, 0);
    const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0;
        }
    }
    offCtx.putImageData(imageData, 0, 0);
    return offscreen;
}

function checkCollision(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < a.size / 2 + b.size / 2;
}

function drawStars() {
    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        ctx.globalAlpha = star.opacity;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    }
}

function drawScanlines() {
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#000000';
    for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 2);
    }
    ctx.globalAlpha = 1;
}

function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.globalAlpha = p.opacity;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        p.x += p.dx;
        p.y += p.dy;
        p.opacity -= 0.05;
        p.size -= 0.1;
        if (p.opacity <= 0) particles.splice(i, 1);
    }
}

function drawBulletTrails() {
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        bullet.trail.push({ x: bullet.x, y: bullet.y });
        if (bullet.trail.length > 8) bullet.trail.shift();
        for (let t = 0; t < bullet.trail.length; t++) {
            const opacity = t / bullet.trail.length;
            ctx.globalAlpha = opacity * 0.6;
            ctx.shadowBlur = 10;
            ctx.shadowColor = bullet.color;
            ctx.fillStyle = bullet.color;
            ctx.beginPath();
            ctx.arc(bullet.trail[t].x, bullet.trail[t].y, bullet.size * opacity, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
    }
}

function drawPowerUps() {
    for (let i = 0; i < powerUps.length; i++) {
        const p = powerUps[i];
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(p.icon, p.x, p.y + 6);
        ctx.textAlign = 'left';
    }
}

function drawBoss() {
    if (!boss) return;
    const flash = boss.flashTimer > 0;
    ctx.shadowBlur = 30;
    ctx.shadowColor = flash ? '#ffffff' : boss.color;
    ctx.fillStyle = flash ? '#ffffff' : boss.color;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Boss health bar
    const barWidth = 200;
    const barX = canvas.width / 2 - barWidth / 2;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, 20, barWidth, 12);
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(barX, 20, barWidth * (boss.health / boss.maxHealth), 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', canvas.width / 2, 18);
    ctx.textAlign = 'left';
}

function drawActiveEffects() {
    let effectY = 130;
    if (speedBoost) {
        ctx.fillStyle = '#ffff00';
        ctx.font = '8px "Press Start 2P"';
        ctx.fillText('⚡ SPEED ' + Math.ceil(speedBoostTimer) + 's', 20, effectY);
        effectY += 20;
    }
    if (tripleShot) {
        ctx.fillStyle = '#00ffff';
        ctx.font = '8px "Press Start 2P"';
        ctx.fillText('💥 TRIPLE ' + Math.ceil(tripleShotTimer) + 's', 20, effectY);
        effectY += 20;
    }
    if (shield) {
        ctx.fillStyle = '#00ff00';
        ctx.font = '8px "Press Start 2P"';
        ctx.fillText('🛡️ SHIELD', 20, effectY);
    }
}

function drawHUD() {
    ctx.fillStyle = '#00ffff';
    ctx.font = '16px "Press Start 2P"';
    ctx.fillText('SCORE: ' + score, 20, 40);

    ctx.fillStyle = '#ff0066';
    ctx.fillText('HP: ' + '♥'.repeat(health), 20, 70);

    const now = Date.now();
    const elapsed = now - lastShotTime;
    const cooldownPercent = Math.min(elapsed / shootCooldown, 1);

    ctx.fillStyle = '#333333';
    ctx.fillRect(20, 85, 150, 10);
    ctx.fillStyle = cooldownPercent === 1 ? '#00ff00' : '#ffff00';
    ctx.fillRect(20, 85, 150 * cooldownPercent, 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('SHOT READY', 20, 107);

    ctx.fillStyle = '#ff9900';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText('LVL: ' + level, canvas.width - 140, 40);

    drawActiveEffects();
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff0066';
    ctx.font = '48px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 120);

    ctx.fillStyle = '#00ffff';
    ctx.font = '20px "Press Start 2P"';
    ctx.fillText('SCORE: ' + score, canvas.width / 2, canvas.height / 2 - 60);

    ctx.fillStyle = '#ffff00';
    ctx.font = '14px "Press Start 2P"';
    ctx.fillText('🏆 HIGH SCORES', canvas.width / 2, canvas.height / 2 - 10);

    for (let i = 0; i < highScores.length; i++) {
        const rank = ['🥇', '🥈', '🥉', '4.', '5.'][i];
        ctx.fillStyle = i === 0 ? '#ffcc00' : '#ffffff';
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(rank + '  ' + String(highScores[i]).padStart(3, '0'), canvas.width / 2, canvas.height / 2 + 30 + (i * 30));
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText('PRESS R TO RESTART', canvas.width / 2, canvas.height / 2 + 210);
    ctx.textAlign = 'left';
}

function restartGame() {
    highScores = JSON.parse(localStorage.getItem('retrostrikeScores')) || [];
    score = 0;
    health = 3;
    gameOver = false;
    lastShotTime = 0;
    enemySpeed = 1.5;
    spawnRate = 1000;
    difficultyTimer = 0;
    level = 1;
    shakeAmount = 0;
    timeOfDay = 0;
    speedBoost = false;
    speedBoostTimer = 0;
    tripleShot = false;
    tripleShotTimer = 0;
    shield = false;
    boss = null;
    bossSpawned = false;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.speed = 3;
    bullets.length = 0;
    enemies.length = 0;
    particles.length = 0;
    powerUps.length = 0;
    clearInterval(spawnInterval);
    spawnInterval = setInterval(spawnEnemy, spawnRate);
}

document.addEventListener('keydown', function(e) {
    if ((e.key === 'r' || e.key === 'R') && gameOver) restartGame();
});

let lastTime = 0;

function update(timestamp) {
    if (gameOver) return;

    const delta = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Day/night cycle
    timeOfDay += delta;

    // Difficulty scaling
    difficultyTimer += delta;
    if (difficultyTimer >= 15) {
        difficultyTimer = 0;
        level++;
        enemySpeed += 0.3;
        spawnRate = Math.max(300, spawnRate - 150);
        clearInterval(spawnInterval);
        spawnInterval = setInterval(spawnEnemy, spawnRate);

        // Spawn boss every 3 levels
        if (level % 3 === 0 && !bossSpawned) {
            bossSpawned = true;
            spawnBoss();
        } else {
            bossSpawned = false;
        }
    }

    // Power up timers
    if (speedBoost) {
        speedBoostTimer -= delta;
        if (speedBoostTimer <= 0) {
            speedBoost = false;
            player.speed = 3;
        }
    }
    if (tripleShot) {
        tripleShotTimer -= delta;
        if (tripleShotTimer <= 0) tripleShot = false;
    }

    // Player movement
    if (keys['ArrowUp'] || keys['w']) player.y -= player.speed;
    if (keys['ArrowDown'] || keys['s']) player.y += player.speed;
    if (keys['ArrowLeft'] || keys['a']) player.x -= player.speed;
    if (keys['ArrowRight'] || keys['d']) player.x += player.speed;

    if (player.x < player.size / 2) player.x = player.size / 2;
    if (player.x > canvas.width - player.size / 2) player.x = canvas.width - player.size / 2;
    if (player.y < player.size / 2) player.y = player.size / 2;
    if (player.y > canvas.height - player.size / 2) player.y = canvas.height - player.size / 2;

    if (shakeAmount > 0) shakeAmount -= 0.5;

    // Move bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += bullets[i].dx;
        bullets[i].y += bullets[i].dy;

        if (bullets[i].x < 0 || bullets[i].x > canvas.width ||
            bullets[i].y < 0 || bullets[i].y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }

        // Bullet vs boss
        if (boss && checkCollision(bullets[i], boss)) {
            bullets.splice(i, 1);
            boss.health--;
            boss.flashTimer = 5;
            playExplosion();
            if (boss.health <= 0) {
                spawnParticles(boss.x, boss.y, '#ff6600');
                spawnParticles(boss.x, boss.y, '#ffff00');
                spawnPowerUp(boss.x, boss.y);
                score += 10;
                boss = null;
            }
            continue;
        }

        // Bullet vs enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (checkCollision(bullets[i], enemies[j])) {
                spawnParticles(enemies[j].x, enemies[j].y, '#ff0066');
                playExplosion();
                spawnPowerUp(enemies[j].x, enemies[j].y);
                bullets.splice(i, 1);
                enemies.splice(j, 1);
                score++;
                break;
            }
        }
    }

    // Move enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const dx = player.x - enemies[i].x;
        const dy = player.y - enemies[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        enemies[i].x += (dx / distance) * enemies[i].speed;
        enemies[i].y += (dy / distance) * enemies[i].speed;

        if (checkCollision(player, enemies[i])) {
            if (shield) {
                shield = false;
                enemies.splice(i, 1);
                spawnParticles(player.x, player.y, '#00ff00');
            } else {
                enemies.splice(i, 1);
                health--;
                shakeAmount = 10;
                playHit();
                if (health <= 0) {
                    gameOver = true;
                    clearInterval(spawnInterval);
                    playGameOver();
                    highScores.push(score);
                    highScores.sort(function(a, b) { return b - a; });
                    highScores = highScores.slice(0, 5);
                    localStorage.setItem('retrostrikeScores', JSON.stringify(highScores));
                }
            }
        }
    }

    // Move boss
    if (boss) {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        boss.x += (dx / distance) * boss.speed;
        boss.y += (dy / distance) * boss.speed;
        if (boss.flashTimer > 0) boss.flashTimer--;

        if (checkCollision(player, boss)) {
            if (shield) {
                shield = false;
                spawnParticles(player.x, player.y, '#00ff00');
            } else {
                health--;
                shakeAmount = 15;
                playHit();
                boss.x = canvas.width / 2;
                boss.y = -60;
                if (health <= 0) {
                    gameOver = true;
                    clearInterval(spawnInterval);
                    playGameOver();
                    highScores.push(score);
                    highScores.sort(function(a, b) { return b - a; });
                    highScores = highScores.slice(0, 5);
                    localStorage.setItem('retrostrikeScores', JSON.stringify(highScores));
                }
            }
        }
    }

    // Power up collection
    for (let i = powerUps.length - 1; i >= 0; i--) {
        if (checkCollision(player, powerUps[i])) {
            const type = powerUps[i].type;
            playPowerUp();
            if (type === 'speed') {
                speedBoost = true;
                speedBoostTimer = 5;
                player.speed = 6;
            } else if (type === 'triple') {
                tripleShot = true;
                tripleShotTimer = 5;
            } else if (type === 'shield') {
                shield = true;
            }
            spawnParticles(powerUps[i].x, powerUps[i].y, powerUps[i].color);
            powerUps.splice(i, 1);
        }
    }
}

function draw(processedImage) {
    // Sky color from day/night cycle
    ctx.fillStyle = getSkyColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (shakeAmount > 0) {
        ctx.translate(
            (Math.random() - 0.5) * shakeAmount,
            (Math.random() - 0.5) * shakeAmount
        );
    }

    drawStars();

    ctx.drawImage(
        processedImage,
        player.x - player.size / 2,
        player.y - player.size / 2,
        player.size,
        player.size
    );

    // Shield ring around player
    if (shield) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ff00';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size / 2 + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawBulletTrails();

    for (let i = 0; i < bullets.length; i++) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = bullets[i].color;
        ctx.fillStyle = bullets[i].color;
        ctx.beginPath();
        ctx.arc(bullets[i].x, bullets[i].y, bullets[i].size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    for (let i = 0; i < enemies.length; i++) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = enemies[i].color;
        ctx.fillStyle = enemies[i].color;
        ctx.fillRect(
            enemies[i].x - enemies[i].size / 2,
            enemies[i].y - enemies[i].size / 2,
            enemies[i].size,
            enemies[i].size
        );
        ctx.shadowBlur = 0;
    }

    drawBoss();
    drawPowerUps();
    drawParticles();
    drawScanlines();

    ctx.restore();

    drawHUD();
    if (gameOver) drawGameOver();
}

function gameLoop(timestamp, processedImage) {
    update(timestamp);
    draw(processedImage);
    requestAnimationFrame(function(ts) {
        gameLoop(ts, processedImage);
    });
}

playerImage.onload = function() {
    const processedImage = removeWhiteBackground(playerImage);
    requestAnimationFrame(function(ts) {
        gameLoop(ts, processedImage);
    });
}

// Fullscreen toggle
document.addEventListener('keydown', function(e) {
    if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
});