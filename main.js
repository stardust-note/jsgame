const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.35;
const FLAP = -6.5;
const PIPE_SPEED = 2.2;
const SPAWN_INTERVAL = 110; // frames
const PIPE_GAP_MIN = 130;
const PIPE_GAP_MAX = 170;

const STATE = {
  READY: "ready",
  RUNNING: "running",
  OVER: "over",
};

const bird = {
  x: 80,
  y: canvas.height / 2,
  radius: 16,
  velocity: 0,
  rotation: 0,
};

let pipes = [];
let frame = 0;
let score = 0;
let bestScore = Number(localStorage.getItem("fluffyBest")) || 0;
let gameState = STATE.READY;

function resetGame() {
  bird.y = canvas.height / 2;
  bird.velocity = 0;
  bird.rotation = 0;
  pipes = [];
  frame = 0;
  score = 0;
  gameState = STATE.READY;
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

function updateBird() {
  bird.velocity += GRAVITY;
  bird.y += bird.velocity;
  bird.rotation = Math.min((bird.velocity / 10) * Math.PI, Math.PI / 2);

  if (bird.y + bird.radius >= canvas.height) {
    bird.y = canvas.height - bird.radius;
    endGame();
  }

  if (bird.y - bird.radius <= 0) {
    bird.y = bird.radius;
    bird.velocity = 0;
  }
}

function updatePipes() {
  pipes.forEach((pipe) => {
    pipe.x -= PIPE_SPEED;

    if (!pipe.passed && pipe.x + pipe.width < bird.x - bird.radius) {
      pipe.passed = true;
      score += 1;
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("fluffyBest", bestScore);
      }
    }
  });

  pipes = pipes.filter((pipe) => pipe.x + pipe.width > 0);

  if (frame % SPAWN_INTERVAL === 0) {
    spawnPipe();
  }
}

function detectCollision() {
  return pipes.some((pipe) => {
    const withinX =
      bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + pipe.width;
    const hitTop = bird.y - bird.radius < pipe.topHeight;
    const hitBottom = bird.y + bird.radius > pipe.bottomY;
    return withinX && (hitTop || hitBottom);
  });
}

function endGame() {
  if (gameState !== STATE.RUNNING) return;
  gameState = STATE.OVER;
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.ellipse(0, 0, bird.radius + 4, bird.radius, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.arc(bird.radius / 2, -6, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(6, -4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(7, -4, 2, 0, Math.PI * 2);
  ctx.fill();

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
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.font = "28px 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`점수: ${score}`, canvas.width / 2, 60);
  ctx.font = "18px 'Noto Sans KR', sans-serif";
  ctx.fillText(`최고 점수: ${bestScore}`, canvas.width / 2, 90);
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

  ctx.fillStyle = "#ffb703";
  for (let i = 0; i < canvas.width; i += 80) {
    ctx.beginPath();
    ctx.arc(i + 20, 120, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#023047";
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
  ctx.fillStyle = "#06d6a0";
  ctx.fillRect(0, canvas.height - 70, canvas.width, 70);
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (gameState === STATE.RUNNING) {
    updateBird();
    updatePipes();
    if (detectCollision()) {
      endGame();
    }
  }

  if (gameState !== STATE.RUNNING) {
    bird.velocity *= 0.95;
    bird.y += bird.velocity;
  }

  drawPipes();
  drawBird();
  drawScore();
  drawMessage();

  frame = (frame + 1) % 1000000;
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    flap();
  }
});

canvas.addEventListener("pointerdown", flap);
resetGame();
loop();
