const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const feverButton = document.getElementById("fever-button");

const BASE_CONFIG = {
  width: 400,
  height: 600,
  gravity: 0.35,
  flap: -6.5,
  pipeSpeed: 2.2,
  pipeGapMin: 130,
  pipeGapMax: 170,
  pipeWidth: 70,
  pipeMinHeight: 40,
  birdRadius: 12,
  birdStartX: 80,
  groundHeight: 70,
  groundShadow: 80,
};

let widthScale = 1;
let heightScale = 1;
let overallScale = 1;

let gravity = BASE_CONFIG.gravity;
let flapStrength = BASE_CONFIG.flap;
let pipeSpeed = BASE_CONFIG.pipeSpeed;
let pipeGapMin = BASE_CONFIG.pipeGapMin;
let pipeGapMax = BASE_CONFIG.pipeGapMax;
let pipeWidth = BASE_CONFIG.pipeWidth;
let pipeMinHeight = BASE_CONFIG.pipeMinHeight;
let groundHeight = BASE_CONFIG.groundHeight;
let groundShadowHeight = BASE_CONFIG.groundShadow;

const BASE_FRAME_TIME = 1000 / 60; // ms for a 60fps baseline
const SPAWN_INTERVAL = 110 * BASE_FRAME_TIME; // ms
const FEVER_DURATION = 5000; // ms
const MAX_LIVES = 3;
const COLLISION_COOLDOWN = 600; // ms

const STATE = {
  READY: "ready",
  RUNNING: "running",
  OVER: "over",
};

const bird = {
  x: BASE_CONFIG.birdStartX,
  y: BASE_CONFIG.height / 2,
  radius: BASE_CONFIG.birdRadius,
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
let lastTime = null;
let spawnTimer = 0;
let lives = MAX_LIVES;
let collisionCooldown = 0;

function resizeCanvas(maintainState = true) {
  const previousWidth = canvas.width || BASE_CONFIG.width;
  const previousHeight = canvas.height || BASE_CONFIG.height;

  const targetWidth = Math.max(window.innerWidth || BASE_CONFIG.width, 320);
  const targetHeight = Math.max(window.innerHeight || BASE_CONFIG.height, 320);

  canvas.style.width = `${targetWidth}px`;
  canvas.style.height = `${targetHeight}px`;
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  widthScale = canvas.width / BASE_CONFIG.width;
  heightScale = canvas.height / BASE_CONFIG.height;
  overallScale = Math.min(widthScale, heightScale);

  gravity = BASE_CONFIG.gravity * heightScale;
  flapStrength = BASE_CONFIG.flap * heightScale;
  pipeSpeed = BASE_CONFIG.pipeSpeed * widthScale;
  pipeGapMin = BASE_CONFIG.pipeGapMin * heightScale;
  pipeGapMax = BASE_CONFIG.pipeGapMax * heightScale;
  pipeWidth = BASE_CONFIG.pipeWidth * widthScale;
  pipeMinHeight = BASE_CONFIG.pipeMinHeight * heightScale;
  groundHeight = BASE_CONFIG.groundHeight * heightScale;
  groundShadowHeight = BASE_CONFIG.groundShadow * heightScale;
  bird.radius = BASE_CONFIG.birdRadius * overallScale;

  if (!maintainState) {
    return;
  }

  const widthRatio = previousWidth ? canvas.width / previousWidth : 1;
  const heightRatio = previousHeight ? canvas.height / previousHeight : 1;

  bird.x *= widthRatio;
  bird.y *= heightRatio;
  bird.velocity *= heightRatio;
  bird.x = Math.min(canvas.width - bird.radius, Math.max(bird.radius, bird.x));
  bird.y = Math.min(canvas.height - bird.radius, Math.max(bird.radius, bird.y));

  pipes.forEach((pipe) => {
    pipe.x *= widthRatio;
    pipe.width *= widthRatio;
    pipe.topHeight *= heightRatio;
    pipe.gap *= heightRatio;
    pipe.bottomY = pipe.topHeight + pipe.gap;
  });
}

function scaleX(value) {
  return value * widthScale;
}

function scaleY(value) {
  return value * heightScale;
}

function scaledFontSize(base) {
  const scaled = base * overallScale;
  const clamped = Math.min(Math.max(scaled, base * 0.7), base * 1.6);
  return Math.round(clamped);
}

function awardPipeClear(pipe) {
  if (!pipe || pipe.passed) {
    return;
  }
  pipe.passed = true;
  score += 1;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("fluffyBest", bestScore);
  }
  checkFeverMilestone();
}

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

function resetFeverState() {
  deactivateFever();
  hideFeverButton();
  nextFeverScore = 5;
}

function resetGame() {
  bird.x = scaleX(BASE_CONFIG.birdStartX);
  bird.y = canvas.height / 2;
  bird.velocity = 0;
  bird.rotation = 0;
  pipes = [];
  score = 0;
  gameState = STATE.READY;
  resetFeverState();
  spawnTimer = SPAWN_INTERVAL;
  lastTime = null;
  lives = MAX_LIVES;
  collisionCooldown = 0;
}

function startGame() {
  if (gameState === STATE.RUNNING) return;
  bird.velocity = flapStrength;
  gameState = STATE.RUNNING;
}

function flap() {
  if (gameState === STATE.READY) {
    startGame();
  }
  if (gameState === STATE.RUNNING) {
    bird.velocity = flapStrength;
  } else if (gameState === STATE.OVER) {
    resetGame();
  }
}

function spawnPipe() {
  const gap = Math.random() * (pipeGapMax - pipeGapMin) + pipeGapMin;
  const minHeight = pipeMinHeight;
  const maxHeight = Math.max(minHeight, canvas.height - gap - minHeight);
  const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;

  pipes.push({
    x: canvas.width + pipeWidth,
    width: pipeWidth,
    topHeight,
    gap,
    bottomY: topHeight + gap,
    passed: false,
  });
}

function updateBird(deltaFactor) {
  bird.velocity += gravity * deltaFactor;
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

function updatePipes(deltaFactor, deltaTime) {
  pipes.forEach((pipe) => {
    pipe.x -= pipeSpeed * deltaFactor;

    if (!pipe.passed && pipe.x + pipe.width < bird.x - bird.radius) {
      awardPipeClear(pipe);
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
  if (collidedPipe) {
    awardPipeClear(collidedPipe);
    collidedPipe.x = Math.min(
      collidedPipe.x,
      bird.x - bird.radius - collidedPipe.width - 4 * widthScale
    );
  }
  lives = Math.max(0, lives - 1);
  bird.velocity = Math.min(bird.velocity, -3 * heightScale);
  if (lives === 0) {
    endGame();
  }
}

function endGame() {
  if (gameState !== STATE.RUNNING) return;
  gameState = STATE.OVER;
  deactivateFever();
  hideFeverButton();
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
  ctx.font = `${scaledFontSize(28)}px 'Noto Sans KR', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`점수: ${score}`, canvas.width / 2, scaleY(60));
  ctx.font = `${scaledFontSize(18)}px 'Noto Sans KR', sans-serif`;
  ctx.fillText(`최고 점수: ${bestScore}`, canvas.width / 2, scaleY(90));
  let statusY = scaleY(120);
  if (feverActive) {
    const remaining = Math.max(0, (feverEndTime - performance.now()) / 1000);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = `${scaledFontSize(22)}px 'Noto Sans KR', sans-serif`;
    ctx.fillText(`무적 ${remaining.toFixed(1)}초`, canvas.width / 2, statusY);
    statusY += scaleY(30);
  } else if (feverAvailable) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = `${scaledFontSize(20)}px 'Noto Sans KR', sans-serif`;
    ctx.fillText(`피버 준비 완료!`, canvas.width / 2, statusY);
    statusY += scaleY(28);
  }
}

function drawLives() {
  ctx.save();
  ctx.textAlign = "left";
  const starSize = Math.max(18, 28 * overallScale);
  const starGap = Math.max(8, 12 * overallScale);
  const totalWidth = MAX_LIVES * starSize + (MAX_LIVES - 1) * starGap;
  const startX = canvas.width / 2 - totalWidth / 2;
  const y = scaleY(36);
  ctx.font = `${Math.round(starSize)}px 'Noto Sans KR', sans-serif`;
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
    ctx.font = `${scaledFontSize(28)}px 'Noto Sans KR', sans-serif`;
    ctx.fillText("스페이스 또는 클릭으로 시작!", canvas.width / 2, canvas.height / 2);
  } else if (gameState === STATE.OVER) {
    ctx.font = `${scaledFontSize(36)}px 'Noto Sans KR', sans-serif`;
    ctx.fillText("게임 오버", canvas.width / 2, canvas.height / 2 - scaleY(40));
    ctx.font = `${scaledFontSize(24)}px 'Noto Sans KR', sans-serif`;
    ctx.fillText("다시하려면 클릭 또는 스페이스", canvas.width / 2, canvas.height / 2);
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#8ecae6");
  gradient.addColorStop(1, "#219ebc");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#023047";
  ctx.fillRect(0, canvas.height - groundShadowHeight, canvas.width, groundShadowHeight);
  ctx.fillStyle = "#06d6a0";
  ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
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
    if (event.repeat) {
      return;
    }
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
resizeCanvas(false);
resetGame();
window.addEventListener("resize", () => resizeCanvas());
requestAnimationFrame(loop);
