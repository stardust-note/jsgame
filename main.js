const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const feverNotice = document.getElementById("fever-notice");
const skinChangeButton = document.getElementById("skin-change");
const skinSelector = document.getElementById("skin-selector");
const skinSelectorClose = document.getElementById("skin-selector-close");

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

const SKINS = [
  {
    id: "sunny",
    name: "햇살 플러피",
    description: "따뜻한 노란빛 털과 핑크 볼",
    colors: {
      body: "#ffd166",
      belly: "#ffe29a",
      wing: "#f4a261",
      cheek: "#ff6b6b",
      eye: "#ffffff",
      pupil: "#1f2933",
      sparkle: "#ffeab6",
    },
  },
  {
    id: "berry",
    name: "베리 플러피",
    description: "달콤한 보라빛 털과 민트 볼",
    colors: {
      body: "#a06bff",
      belly: "#cdb5ff",
      wing: "#7b2cbf",
      cheek: "#4cc9f0",
      eye: "#f7f7ff",
      pupil: "#24123f",
      sparkle: "#d3c0ff",
    },
  },
];

const SKIN_MAP = SKINS.reduce((map, skin) => {
  map[skin.id] = skin;
  return map;
}, {});

let appliedSkinId = SKINS[0].id;
let pendingSkinId = SKINS[0].id;
let currentSkin = SKINS[0];
let skinOptionButtons = [];
let skinSelectionLocked = false;

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
const COLLISION_FLASH_INTERVAL = 120; // ms
const PIPE_PHASE_DURATION = 900; // ms

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
let feverTimeoutId = null;
let feverEndTime = 0;
let pipesSinceLastFever = 0;
let feverNoticeTimeoutId = null;
let lastTime = null;
let spawnTimer = 0;
let lives = MAX_LIVES;
let collisionCooldown = 0;
let collisionFlashTimer = 0;

function updateSkinOptionUI() {
  if (!skinOptionButtons.length) {
    return;
  }
  skinOptionButtons.forEach((button) => {
    const isSelected = button.dataset.skinOption === pendingSkinId;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function updateSkinChangeButtonLabel() {
  if (!skinChangeButton) return;
  const label = currentSkin ? currentSkin.name : "스킨 변경";
  skinChangeButton.textContent = currentSkin ? `스킨: ${label}` : "스킨 변경";
  skinChangeButton.setAttribute(
    "aria-label",
    currentSkin ? `스킨 변경 (현재 ${label})` : "스킨 변경"
  );
}

function updateSkinSelectorCloseLabel() {
  if (!skinSelectorClose) return;
  const pendingSkin = SKIN_MAP[pendingSkinId] || currentSkin;
  const label = pendingSkin ? pendingSkin.name : "플러피";
  skinSelectorClose.textContent = `${label}로 플레이`;
}

function updateSkinChangeButtonState() {
  if (!skinChangeButton) return;
  if (skinSelectionLocked) {
    skinChangeButton.disabled = true;
    skinChangeButton.setAttribute("aria-disabled", "true");
    skinChangeButton.classList.add("is-disabled");
  } else {
    skinChangeButton.disabled = false;
    skinChangeButton.removeAttribute("aria-disabled");
    skinChangeButton.classList.remove("is-disabled");
  }
}

function setPendingSkin(id) {
  if (!SKIN_MAP[id]) return;
  pendingSkinId = id;
  updateSkinOptionUI();
  updateSkinSelectorCloseLabel();
}

function setSkinSelectionLocked(locked) {
  if (skinSelectionLocked === locked) {
    return;
  }
  skinSelectionLocked = locked;
  if (skinSelectionLocked && skinSelector) {
    setPendingSkin(appliedSkinId);
    skinSelector.classList.remove("is-open");
    skinSelector.setAttribute("aria-hidden", "true");
  }
  updateSkinChangeButtonState();
}

function applySkin(id, { persist = true } = {}) {
  const skin = SKIN_MAP[id];
  if (!skin) return;
  appliedSkinId = skin.id;
  currentSkin = skin;
  pendingSkinId = skin.id;
  if (persist) {
    try {
      localStorage.setItem("fluffySkin", skin.id);
    } catch (error) {
      console.warn("스킨 정보를 저장하지 못했습니다.", error);
    }
  }
  updateSkinOptionUI();
  updateSkinChangeButtonLabel();
  updateSkinSelectorCloseLabel();
}

function openSkinSelector(initial = false) {
  if (!skinSelector || skinSelectionLocked) return;
  setPendingSkin(appliedSkinId);
  skinSelector.classList.add("is-open");
  skinSelector.setAttribute("aria-hidden", "false");
  if (initial) {
    requestAnimationFrame(() => {
      const targetButton =
        skinSelector.querySelector(".skin-option.is-selected") ||
        skinOptionButtons[0];
      targetButton?.focus();
    });
  }
}

function closeSkinSelector({ apply = false } = {}) {
  if (!skinSelector) return;
  if (apply) {
    applySkin(pendingSkinId);
  } else {
    setPendingSkin(appliedSkinId);
  }
  skinSelector.classList.remove("is-open");
  skinSelector.setAttribute("aria-hidden", "true");
  if (skinChangeButton && !skinChangeButton.disabled) {
    skinChangeButton.focus({ preventScroll: true });
  }
}

function isSkinSelectorOpen() {
  return Boolean(skinSelector && skinSelector.classList.contains("is-open"));
}

function initializeSkinSelection() {
  updateSkinChangeButtonState();
  if (!skinSelector) {
    const storedSkinId = localStorage.getItem("fluffySkin");
    if (storedSkinId && SKIN_MAP[storedSkinId]) {
      applySkin(storedSkinId);
    } else {
      applySkin(appliedSkinId, { persist: false });
    }
    return;
  }

  skinOptionButtons = Array.from(
    skinSelector.querySelectorAll("[data-skin-option]")
  );

  skinOptionButtons.forEach((button) => {
    const skinId = button.dataset.skinOption;
    const skin = SKIN_MAP[skinId];
    if (!skin) return;

    button.style.setProperty("--skin-body", skin.colors.body);
    button.style.setProperty(
      "--skin-belly",
      skin.colors.belly || skin.colors.body
    );
    button.style.setProperty(
      "--skin-cheek",
      skin.colors.cheek || skin.colors.body
    );

    const nameEl = button.querySelector("[data-skin-name]");
    if (nameEl) {
      nameEl.textContent = skin.name;
    }
    const descriptionEl = button.querySelector("[data-skin-description]");
    if (descriptionEl) {
      descriptionEl.textContent = skin.description;
    }

    button.addEventListener("click", () => {
      setPendingSkin(skinId);
    });
  });

  const storedSkinId = localStorage.getItem("fluffySkin");
  const hasStoredSkin = Boolean(storedSkinId && SKIN_MAP[storedSkinId]);
  const initialSkinId = hasStoredSkin ? storedSkinId : SKINS[0].id;

  applySkin(initialSkinId, { persist: hasStoredSkin });

  if (!hasStoredSkin) {
    skinSelector.setAttribute("aria-hidden", "false");
    openSkinSelector(true);
  } else {
    skinSelector.setAttribute("aria-hidden", "true");
  }

  if (skinChangeButton) {
    skinChangeButton.addEventListener("click", () => {
      if (skinSelectionLocked) {
        return;
      }
      openSkinSelector();
    });
  }

  if (skinSelectorClose) {
    skinSelectorClose.addEventListener("click", () => {
      closeSkinSelector({ apply: true });
    });
  }

  skinSelector.addEventListener("click", (event) => {
    if (event.target === skinSelector) {
      closeSkinSelector({ apply: false });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isSkinSelectorOpen()) {
      closeSkinSelector({ apply: false });
    }
  });
}

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

function deactivateFever() {
  feverActive = false;
  feverEndTime = 0;
  if (feverTimeoutId) {
    clearTimeout(feverTimeoutId);
    feverTimeoutId = null;
  }
  pipesSinceLastFever = 0;
}

function activateFever() {
  if (feverActive) return;
  feverActive = true;
  feverEndTime = performance.now() + FEVER_DURATION;
  if (feverTimeoutId) {
    clearTimeout(feverTimeoutId);
  }
  feverTimeoutId = setTimeout(() => {
    deactivateFever();
  }, FEVER_DURATION);
  pipesSinceLastFever = 0;
  showFeverNotice("5회 누적 무적 발생");
}

function checkFeverMilestone() {
  pipesSinceLastFever += 1;
  if (pipesSinceLastFever >= 5 && !feverActive) {
    activateFever();
  }
}

function resetFeverState() {
  deactivateFever();
  pipesSinceLastFever = 0;
  hideFeverNotice();
}

function resetGame() {
  bird.x = scaleX(BASE_CONFIG.birdStartX);
  bird.y = canvas.height / 2;
  bird.velocity = 0;
  bird.rotation = 0;
  pipes = [];
  score = 0;
  gameState = STATE.READY;
  setSkinSelectionLocked(false);
  resetFeverState();
  spawnTimer = SPAWN_INTERVAL;
  lastTime = null;
  lives = MAX_LIVES;
  collisionCooldown = 0;
  collisionFlashTimer = 0;
}

function startGame() {
  if (gameState === STATE.RUNNING) return;
  bird.velocity = flapStrength;
  setSkinSelectionLocked(true);
  gameState = STATE.RUNNING;
}

function flap() {
  if (isSkinSelectorOpen()) {
    return;
  }
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
    phaseThroughTimer: 0,
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
    if (pipe.phaseThroughTimer > 0) {
      pipe.phaseThroughTimer = Math.max(0, pipe.phaseThroughTimer - deltaTime);
    }
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
  if (feverActive || collisionCooldown > 0) return null;
  return (
    pipes.find((pipe) => {
      if (pipe.phaseThroughTimer > 0) {
        return false;
      }
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
  collisionCooldown = Math.max(COLLISION_COOLDOWN, PIPE_PHASE_DURATION);
  collisionFlashTimer = Math.max(collisionFlashTimer, PIPE_PHASE_DURATION);
  if (collidedPipe) {
    awardPipeClear(collidedPipe);
    collidedPipe.phaseThroughTimer = PIPE_PHASE_DURATION;
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
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);

  if (collisionFlashTimer > 0) {
    const flashPhase = Math.floor(collisionFlashTimer / COLLISION_FLASH_INTERVAL);
    if (flashPhase % 2 === 0) {
      ctx.restore();
      return;
    }
  }

  const skin = currentSkin || SKIN_MAP[selectedSkinId] || SKINS[0];
  const colors = skin.colors;
  const bodyWidth = bird.radius + 3;
  const bodyHeight = bird.radius;

  if (colors.wing) {
    ctx.fillStyle = colors.wing;
    ctx.beginPath();
    ctx.ellipse(
      -bird.radius * 0.35,
      bird.radius * 0.12,
      bodyWidth * 0.7,
      bodyHeight * 0.8,
      Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
  ctx.fill();

  if (colors.belly) {
    ctx.fillStyle = colors.belly;
    ctx.beginPath();
    ctx.ellipse(
      -bird.radius * 0.12,
      bird.radius * 0.18,
      bodyWidth * 0.65,
      bodyHeight * 0.7,
      Math.PI / 12,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.fillStyle = colors.cheek || colors.body;
  const cheekX = bird.radius * 0.45;
  const cheekY = -bird.radius * 0.35;
  const cheekRadius = bird.radius * 0.45;
  ctx.beginPath();
  ctx.arc(cheekX, cheekY, cheekRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.eye || "#fff";
  const eyeX = bird.radius * 0.5;
  const eyeY = -bird.radius * 0.3;
  const eyeRadius = bird.radius * 0.35;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.pupil || "#000";
  ctx.beginPath();
  ctx.arc(eyeX + eyeRadius * 0.25, eyeY, eyeRadius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  if (colors.sparkle) {
    ctx.fillStyle = colors.sparkle;
    ctx.beginPath();
    ctx.arc(eyeX + eyeRadius * 0.05, eyeY - eyeRadius * 0.35, eyeRadius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

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
  collisionFlashTimer = Math.max(0, collisionFlashTimer - deltaTime);

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
    if (isSkinSelectorOpen()) {
      return;
    }
    event.preventDefault();
    flap();
  }
});

canvas.addEventListener("pointerdown", (event) => {
  if (isSkinSelectorOpen()) {
    return;
  }
  flap(event);
});
function showFeverNotice(message) {
  if (!feverNotice) return;
  feverNotice.textContent = message;
  feverNotice.classList.add("is-visible");
  if (feverNoticeTimeoutId) {
    clearTimeout(feverNoticeTimeoutId);
  }
  feverNoticeTimeoutId = setTimeout(() => {
    feverNotice.classList.remove("is-visible");
    feverNoticeTimeoutId = null;
  }, 1000);
}

function hideFeverNotice() {
  if (!feverNotice) return;
  if (feverNoticeTimeoutId) {
    clearTimeout(feverNoticeTimeoutId);
    feverNoticeTimeoutId = null;
  }
  feverNotice.classList.remove("is-visible");
}
initializeSkinSelection();
resizeCanvas(false);
resetGame();
window.addEventListener("resize", () => resizeCanvas());
requestAnimationFrame(loop);
