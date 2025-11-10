const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const feverButton = document.getElementById("fever-button");
const dashButton = document.getElementById("dash-button");

const GRAVITY = 0.35;
const FLAP = -6.5;
const PIPE_SPEED = 2.2;
const BASE_FRAME_TIME = 1000 / 60; // ms for a 60fps baseline
const SPAWN_INTERVAL = 110 * BASE_FRAME_TIME; // ms
const PIPE_GAP_MIN = 130;
const PIPE_GAP_MAX = 170;
const FEVER_DURATION = 5000; // ms
const DASH_DURATION = 2500; // ms
const DASH_SPEED_MULTIPLIER = 2.8;
const DASH_SCORE_INTERVAL = 3;
const MAX_LIVES = 3;
const COLLISION_COOLDOWN = 600; // ms

const STATE = {
  READY: "ready",
  RUNNING: "running",
  OVER: "over",
};

const bird = {
  x: 80,
  y: canvas.height / 2,
  radius: 12,
  velocity: 0,
  rotation: 0,
};

let pipes = [];
let score = 0;
let bestScore = Number(localStorage.getItem("fluffyBest")) || 0;
let gameState = STATE.READY;
let feverActive = false;
let feverAvailable = false;
let feverTimeoutId = null;
let feverEndTime = 0;
let nextFeverScore = 5;
let dashActive = false;
let dashAvailable = false;
let dashTimeoutId = null;
let dashEndTime = 0;
let nextDashScore = DASH_SCORE_INTERVAL;
let lastTime = null;
let spawnTimer = 0;
let lives = MAX_LIVES;
let collisionCooldown = 0;

function showFeverButton() {
  if (!feverButton) return;
  feverAvailable = true;
  feverButton.disabled = false;
  feverButton.textContent = "피버 발동!";
  feverButton.classList.add("is-visible");
}

function hideFeverButton() {
  if (!feverButton) return;
  feverAvailable = false;
  feverButton.disabled = true;
  feverButton.textContent = "피버 준비!";
  feverButton.classList.remove("is-visible");
}

function showDashButton() {
  if (!dashButton) return;
  dashAvailable = true;
  dashButton.disabled = false;
  dashButton.textContent = "대시 발동!";
  dashButton.classList.add("is-visible");
}

function hideDashButton() {
  if (!dashButton) return;
  dashAvailable = false;
  dashButton.disabled = true;
  dashButton.textContent = "대시 준비!";
  dashButton.classList.remove("is-visible");
}

function deactivateFever() {
  feverActive = false;
  feverEndTime = 0;
  if (feverTimeoutId) {
    clearTimeout(feverTimeoutId);
    feverTimeoutId = null;
  }
}

function activateFever() {
  if (!feverAvailable || feverActive) return;
  feverActive = true;
  feverAvailable = false;
  feverEndTime = performance.now() + FEVER_DURATION;
  if (feverTimeoutId) {
    clearTimeout(feverTimeoutId);
  }
  feverTimeoutId = setTimeout(() => {
    deactivateFever();
  }, FEVER_DURATION);
  hideFeverButton();
}

function checkFeverMilestone() {
  if (score >= nextFeverScore && !feverActive && !feverAvailable) {
    showFeverButton();
    nextFeverScore += 5;
  }
}

function deactivateDash() {
  dashActive = false;
  dashEndTime = 0;
  if (dashTimeoutId) {
    clearTimeout(dashTimeoutId);
    dashTimeoutId = null;
  }
}

function activateDash() {
  if (!dashAvailable || dashActive) return;
  dashActive = true;
  dashAvailable = false;
  dashEndTime = performance.now() + DASH_DURATION;
  if (dashTimeoutId) {
    clearTimeout(dashTimeoutId);
  }
  dashTimeoutId = setTimeout(() => {
    deactivateDash();
  }, DASH_DURATION);
  hideDashButton();
}

function checkDashMilestone() {
  if (score >= nextDashScore && !dashActive && !dashAvailable) {
    showDashButton();
    nextDashScore += DASH_SCORE_INTERVAL;
  }
}

function resetFeverState() {
  deactivateFever();
  hideFeverButton();
  nextFeverScore = 5;
}

function resetDashState() {
  deactivateDash();
  hideDashButton();
  nextDashScore = DASH_SCORE_INTERVAL;
}

function resetGame() {
  bird.y = canvas.height / 2;
  bird.velocity = 0;
  bird.rotation = 0;
  pipes = [];
  score = 0;
  gameState = STATE.READY;
  resetFeverState();
  resetDashState();
  spawnTimer = SPAWN_INTERVAL;
  lastTime = null;
  lives = MAX_LIVES;
  collisionCooldown = 0;
}

function startGame() {
  if (gameState === STATE.RUNNING) return;
  bird.velocity = FLAP;
  gameState = STATE.RUNNING;
}

function flap() {
  if (gameState === STATE.READY) {
    startGame();
  }
  if (gameState === STATE.RUNNING) {
    bird.velocity = FLAP;
  } else if (gameState === STATE.OVER) {
    resetGame();
  }
}

function spawnPipe() {
  const gap = Math.random() * (PIPE_GAP_MAX - PIPE_GAP_MIN) + PIPE_GAP_MIN;
  const minHeight = 40;
  const maxHeight = canvas.height - gap - minHeight;
  const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;

  pipes.push({
    x: canvas.width + 60,
    width: 70,
    topHeight,
    bottomY: topHeight + gap,
    passed: false,
  });
}

function updateBird(deltaFactor) {
  bird.velocity += GRAVITY * deltaFactor;
  bird.y += bird.velocity * deltaFactor;
  bird.rotation = Math.min((bird.velocity / 10) * Math.PI, Math.PI / 2);

  if (bird.y + bird.radius >= canvas.height) {
    bird.y = canvas.height - bird.radius;
    if (!feverActive) {
      endGame();
    } else {
      bird.velocity = 0;
    }
  }

  if (bird.y - bird.radius <= 0) {
    bird.y = bird.radius;
    bird.velocity = 0;
  }
}

function getCurrentPipeSpeed() {
  return dashActive ? PIPE_SPEED * DASH_SPEED_MULTIPLIER : PIPE_SPEED;
}

function updatePipes(deltaFactor, deltaTime) {
  const pipeSpeed = getCurrentPipeSpeed();
  pipes.forEach((pipe) => {
    pipe.x -= pipeSpeed * deltaFactor;

    if (!pipe.passed && pipe.x + pipe.width < bird.x - bird.radius) {
      pipe.passed = true;
      score += 1;
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("fluffyBest", bestScore);
      }
      checkFeverMilestone();
      checkDashMilestone();
    }
  });

  pipes = pipes.filter((pipe) => pipe.x + pipe.width > 0);

  spawnTimer += deltaTime;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnPipe();
    spawnTimer %= SPAWN_INTERVAL;
  }
}

function detectCollision() {
  if (feverActive) return null;
  return (
    pipes.find((pipe) => {
      const withinX =
        bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + pipe.width;
      const hitTop = bird.y - bird.radius < pipe.topHeight;
      const hitBottom = bird.y + bird.radius > pipe.bottomY;
      return withinX && (hitTop || hitBottom);
    }) || null
  );
}

function handlePipeCollision(collidedPipe) {
  if (collisionCooldown > 0) {
    return;
  }
  collisionCooldown = COLLISION_COOLDOWN;
  lives = Math.max(0, lives - 1);
  bird.velocity = Math.min(bird.velocity, -3);
  if (collidedPipe) {
    collidedPipe.passed = true;
    collidedPipe.x = Math.min(
      collidedPipe.x,
      bird.x - bird.radius - collidedPipe.width - 4
    );
  }
  if (lives === 0) {
    endGame();
  }
}

function endGame() {
  if (gameState !== STATE.RUNNING) return;
  gameState = STATE.OVER;
  deactivateFever();
  hideFeverButton();
  deactivateDash();
  hideDashButton();
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);

  const bodyWidth = bird.radius + 3;
  const bodyHeight = bird.radius;

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff6b6b";
  const cheekX = bird.radius * 0.45;
  const cheekY = -bird.radius * 0.35;
  const cheekRadius = bird.radius * 0.45;
  ctx.beginPath();
  ctx.arc(cheekX, cheekY, cheekRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  const eyeX = bird.radius * 0.5;
  const eyeY = -bird.radius * 0.3;
  const eyeRadius = bird.radius * 0.35;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(eyeX + eyeRadius * 0.25, eyeY, eyeRadius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  if (feverActive) {
    ctx.strokeStyle = "rgba(255, 215, 0, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, bird.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPipes() {
  ctx.fillStyle = "#06d6a0";
  pipes.forEach((pipe) => {
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
    ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);

    ctx.fillStyle = "#118ab2";
    ctx.fillRect(pipe.x - 3, pipe.topHeight - 12, pipe.width + 6, 12);
    ctx.fillRect(pipe.x - 3, pipe.bottomY, pipe.width + 6, 12);
    ctx.fillStyle = "#06d6a0";
  });
}

function drawScore() {
  drawLives();
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.font = "28px 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`점수: ${score}`, canvas.width / 2, 60);
  ctx.font = "18px 'Noto Sans KR', sans-serif";
  ctx.fillText(`최고 점수: ${bestScore}`, canvas.width / 2, 90);
  let statusY = 120;
  if (feverActive) {
    const remaining = Math.max(0, (feverEndTime - performance.now()) / 1000);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "22px 'Noto Sans KR', sans-serif";
    ctx.fillText(`무적 ${remaining.toFixed(1)}초`, canvas.width / 2, statusY);
    statusY += 30;
  } else if (feverAvailable) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "20px 'Noto Sans KR', sans-serif";
    ctx.fillText(`피버 준비 완료!`, canvas.width / 2, statusY);
    statusY += 28;
  }
  if (dashActive) {
    const remaining = Math.max(0, (dashEndTime - performance.now()) / 1000);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "22px 'Noto Sans KR', sans-serif";
    ctx.fillText(`대시 ${remaining.toFixed(1)}초`, canvas.width / 2, statusY);
  } else if (dashAvailable) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "20px 'Noto Sans KR', sans-serif";
    ctx.fillText(`대시 준비 완료!`, canvas.width / 2, statusY);
  }
}

function drawLives() {
  ctx.save();
  ctx.textAlign = "left";
  const starSize = 28;
  const starGap = 12;
  const totalWidth = MAX_LIVES * starSize + (MAX_LIVES - 1) * starGap;
  const startX = canvas.width / 2 - totalWidth / 2;
  const y = 36;
  ctx.font = `${starSize}px 'Noto Sans KR', sans-serif`;
  for (let i = 0; i < MAX_LIVES; i++) {
    ctx.fillStyle = i < lives ? "#ffd166" : "rgba(255, 255, 255, 0.25)";
    ctx.fillText("★", startX + i * (starSize + starGap), y);
  }
  ctx.restore();
}

function drawMessage() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.textAlign = "center";
  if (gameState === STATE.READY) {
    ctx.font = "28px 'Noto Sans KR', sans-serif";
    ctx.fillText("스페이스 또는 클릭으로 시작!", canvas.width / 2, canvas.height / 2);
  } else if (gameState === STATE.OVER) {
    ctx.font = "36px 'Noto Sans KR', sans-serif";
    ctx.fillText("게임 오버", canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "24px 'Noto Sans KR', sans-serif";
    ctx.fillText("다시하려면 클릭 또는 스페이스", canvas.width / 2, canvas.height / 2);
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#8ecae6");
  gradient.addColorStop(1, "#219ebc");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (dashActive) {
    const now = performance.now();
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    const streakCount = 7;
    for (let i = 0; i < streakCount; i++) {
      const offset = ((now / 6 + i * (canvas.width / streakCount)) % canvas.width) - 20;
      ctx.fillRect(offset, 0, 8, canvas.height);
    }
    ctx.restore();
  }

  ctx.fillStyle = "#023047";
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
  ctx.fillStyle = "#06d6a0";
  ctx.fillRect(0, canvas.height - 70, canvas.width, 70);
}

function loop(timestamp) {
  if (lastTime === null) {
    lastTime = timestamp;
  }
  const deltaTime = Math.min(timestamp - lastTime, 1000);
  const deltaFactor = deltaTime / BASE_FRAME_TIME;
  lastTime = timestamp;
  collisionCooldown = Math.max(0, collisionCooldown - deltaTime);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (feverActive && performance.now() >= feverEndTime) {
    deactivateFever();
  }
  if (dashActive && performance.now() >= dashEndTime) {
    deactivateDash();
  }

  if (gameState === STATE.RUNNING) {
    updateBird(deltaFactor);
    updatePipes(deltaFactor, deltaTime);
    const collidedPipe = detectCollision();
    if (collidedPipe) {
      handlePipeCollision(collidedPipe);
    }
  }

  if (gameState !== STATE.RUNNING) {
    bird.velocity *= Math.pow(0.95, deltaFactor);
    bird.y += bird.velocity * deltaFactor;
  }

  drawPipes();
  drawBird();
  drawScore();
  drawMessage();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    flap();
  }
});

canvas.addEventListener("pointerdown", flap);
if (feverButton) {
  feverButton.addEventListener("click", () => {
    if (gameState === STATE.READY) {
      startGame();
    }
    activateFever();
  });
}
if (dashButton) {
  dashButton.addEventListener("click", () => {
    if (gameState === STATE.READY) {
      startGame();
    }
    activateDash();
  });
}
resetGame();
requestAnimationFrame(loop);
