const boardEl = document.getElementById("board");
const scoreValueEl = document.getElementById("scoreValue");
const timeValueEl = document.getElementById("timeValue");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const endBtn = document.getElementById("endBtn");
const langToggleBtn = document.getElementById("langToggleBtn");
const speedRange = document.getElementById("speedRange");
const speedValueEl = document.getElementById("speedValue");
const i18nNodes = document.querySelectorAll("[data-i18n]");

// 场地边长
const GRID_SIZE = 17;

// 速度范围（毫秒越小越快）
const SPEED_MIN = 30;
const SPEED_MAX = 500;
const SPEED_STEP = 10;
const SPEED_STORAGE_KEY = "snake_speed_ms";

let timerId = null;
let timeTimerId = null;
let isRunning = false;
let isPaused = false;
let isGameOver = false;
let direction = { x: 1, y: 0 };
let pendingDirection = { x: 1, y: 0 };
let snake = [];
let apple = { x: 0, y: 0 };
let score = 0;
let cells = [];
let elapsedMs = 0;
let currentLang = "zh";
const LANG_STORAGE_KEY = "snake_lang";

const I18N_MAP = {
    zh: {
        controlsTitle: "控制",
        start: "开始游戏",
        pause: "暂停游戏",
        end: "结束游戏",
        speedTitle: "移动间隔",
        speedHint: "范围 500ms - 30ms",
        language: "语言：中文",
        tipsTitle: "提示",
        tipsText: "W / A / S / D 移动",
        gameTitle: "Snake Game",
        statsTitle: "统计",
        timeLabel: "时间",
        scoreLabel: "分数"
    },
    en: {
        controlsTitle: "Controls",
        start: "Start",
        pause: "Pause",
        end: "End",
        speedTitle: "Interval",
        speedHint: "Range 500ms - 30ms",
        language: "Language: English",
        tipsTitle: "Tips",
        tipsText: "W / A / S / D to move",
        gameTitle: "Snake Game",
        statsTitle: "Stats",
        timeLabel: "Time",
        scoreLabel: "Score"
    }
};

function init() {
    // 初始化：创建格子、绑定事件、重置游戏数据
    createBoard();
    bindEvents();
    setControlLock(false);
    loadLanguage();
    applyI18n();
    initSpeedControl();
    resetGame();
}

function createBoard() {
    // 根据 GRID_SIZE 创建方格 DOM
    boardEl.style.setProperty("--grid-size", GRID_SIZE);
    boardEl.innerHTML = "";
    cells = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
        for (let x = 0; x < GRID_SIZE; x += 1) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            boardEl.appendChild(cell);
            cells.push(cell);
        }
    }
}

function bindEvents() {
    // 绑定按钮点击与键盘控制
    startBtn.addEventListener("click", startGame);
    pauseBtn.addEventListener("click", togglePause);
    endBtn.addEventListener("click", endGame);
    langToggleBtn.addEventListener("click", toggleLanguage);
    speedRange.addEventListener("input", handleSpeedChange);
    window.addEventListener("keydown", handleKey);
}

function resetGame() {
    // 重置游戏状态（分数、方向、蛇身、苹果）
    score = 0;
    updateScore();
    direction = { x: 1, y: 0 };
    pendingDirection = { x: 1, y: 0 };
    isGameOver = false;
    elapsedMs = 0;
    updateTime();
    snake = [
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 2, y: 5 }
    ];
    placeApple();
    render();
}

function startGame() {
    // 开始游戏：启动定时器
    if (isRunning) {
        return;
    }
    if (isGameOver) {
        resetGame();
    }
    isRunning = true;
    isPaused = false;
    setControlLock(true);
    runLoop();
    startTimer();
}

function togglePause() {
    // 暂停与继续
    if (!isRunning) {
        return;
    }
    if (isPaused) {
        isPaused = false;
        runLoop();
        startTimer();
        return;
    }
    isPaused = true;
    stopLoop();
    stopTimer();
}

function endGame() {
    // 结束游戏并提示最终分数
    stopLoop();
    stopTimer();
    isRunning = false;
    isPaused = false;
    isGameOver = true;
    setControlLock(false);
}

function stopLoop() {
    // 清理定时器
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

function runLoop() {
    // 启动游戏循环
    stopLoop();
    timerId = setInterval(() => {
        tick();
    }, getSpeedInterval());
}

function tick() {
    // 单次帧更新：确认方向、移动、渲染
    if (isPaused) {
        return;
    }
    direction = pendingDirection;
    move(1);
    render();
}

function move(distance) {
    // 按当前方向移动指定步长
    const head = snake[0];
    const newHead = {
        x: head.x + direction.x * distance,
        y: head.y + direction.y * distance
    };

    // 撞墙或撞到自己则结束游戏
    if (isHitWall(newHead) || isHitSelf(newHead)) {
        endGame();
        return;
    }

    // 将新头部放到蛇身前端
    snake.unshift(newHead);

    if (isApple(newHead)) {
        // 吃到苹果：加分并生成新苹果，不移除尾巴
        score += 1;
        updateScore();
        placeApple();
        return;
    }

    // 未吃到苹果：移除尾部，保持长度不变
    snake.pop();
}

function rotate(dir) {
    // 改变方向，避免直接反向
    const next = dir;
    if (direction.x + next.x === 0 && direction.y + next.y === 0) {
        return;
    }
    pendingDirection = next;
}

function placeApple() {
    // 随机生成苹果位置，避免生成在蛇身上
    let spot = null;
    do {
        spot = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } while (snake.some(segment => segment.x === spot.x && segment.y === spot.y));

    apple = spot;
}

function isApple(pos) {
    // 判断当前位置是否为苹果
    return pos.x === apple.x && pos.y === apple.y;
}

function isHitWall(pos) {
    // 判断是否越界
    return pos.x < 0 || pos.x >= GRID_SIZE || pos.y < 0 || pos.y >= GRID_SIZE;
}

function isHitSelf(pos) {
    // 判断是否撞到自己（排除头部）
    return snake.some((segment, index) => index !== 0 && segment.x === pos.x && segment.y === pos.y);
}

function updateScore() {
    // 更新分数显示
    scoreValueEl.textContent = score.toString();
    scoreValueEl.classList.remove("bump");
    void scoreValueEl.offsetWidth;
    scoreValueEl.classList.add("bump");
}

function handleKey(event) {
    // 键盘控制：W/A/S/D
    const key = event.key.toLowerCase();
    if (key === "w") {
        rotate({ x: 0, y: -1 });
    }
    if (key === "s") {
        rotate({ x: 0, y: 1 });
    }
    if (key === "a") {
        rotate({ x: -1, y: 0 });
    }
    if (key === "d") {
        rotate({ x: 1, y: 0 });
    }
}

function handleSpeedChange() {
    // 游戏运行中切换速度时，重启计时器
    updateSpeedValue();
    saveSpeed();
    if (isRunning && !isPaused) {
        runLoop();
    }
}

function getSpeedInterval() {
    // 获取当前选中的速度档位
    const value = Number(speedRange.value);
    if (Number.isNaN(value)) {
        return 220;
    }
    const reversed = SPEED_MAX + SPEED_MIN - value;
    return Math.min(SPEED_MAX, Math.max(SPEED_MIN, reversed));
}

function startTimer() {
    // 启动计时器，记录游戏时长
    stopTimer();
    const startAt = Date.now() - elapsedMs;
    timeTimerId = setInterval(() => {
        elapsedMs = Date.now() - startAt;
        updateTime();
    }, 200);
}

function stopTimer() {
    // 停止计时器
    if (timeTimerId) {
        clearInterval(timeTimerId);
        timeTimerId = null;
    }
}

function updateTime() {
    // 更新时间显示（m:ss.mmm）
    const totalMilliseconds = Math.max(0, elapsedMs);
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = totalMilliseconds % 1000;
    const ss = seconds.toString().padStart(2, "0");
    const mmm = milliseconds.toString().padStart(3, "0");
    timeValueEl.innerHTML = `<span class="time-main">${minutes}:${ss}</span><span class="time-ms">.${mmm}</span>`;
}

function render() {
    // 渲染蛇身与苹果
    cells.forEach(cell => {
        cell.classList.remove("snake", "apple", "head");
    });

    snake.forEach((segment, segmentIndex) => {
        const index = getIndex(segment);
        if (index !== null) {
            cells[index].classList.add("snake");
            if (segmentIndex === 0) {
                cells[index].classList.add("head");
            }
        }
    });

    const appleIndex = getIndex(apple);
    if (appleIndex !== null) {
        cells[appleIndex].classList.add("apple");
    }
}

function getIndex(pos) {
    // 将坐标转换为一维索引
    if (pos.x < 0 || pos.y < 0 || pos.x >= GRID_SIZE || pos.y >= GRID_SIZE) {
        return null;
    }
    return pos.y * GRID_SIZE + pos.x;
}

function setControlLock(isLocked) {
    // 游戏运行中禁用开始按钮与速度选择
    startBtn.disabled = isLocked;
    speedRange.disabled = isLocked;
}

function toggleLanguage() {
    currentLang = currentLang === "zh" ? "en" : "zh";
    localStorage.setItem(LANG_STORAGE_KEY, currentLang);
    applyI18n();
}

function loadLanguage() {
    const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
    if (savedLang && I18N_MAP[savedLang]) {
        currentLang = savedLang;
    }
}

function applyI18n() {
    const dict = I18N_MAP[currentLang];
    i18nNodes.forEach(node => {
        const key = node.dataset.i18n;
        if (dict[key]) {
            node.textContent = dict[key];
        }
    });
}

function updateSpeedValue() {
    const value = Number(speedRange.value);
    if (Number.isNaN(value)) {
        speedValueEl.textContent = "220";
        return;
    }
    const reversed = SPEED_MAX + SPEED_MIN - value;
    speedValueEl.textContent = Math.min(SPEED_MAX, Math.max(SPEED_MIN, reversed)).toString();
}

function initSpeedControl() {
    speedRange.min = SPEED_MIN.toString();
    speedRange.max = SPEED_MAX.toString();
    speedRange.step = SPEED_STEP.toString();
    loadSpeed();
    updateSpeedValue();
}

function saveSpeed() {
    localStorage.setItem(SPEED_STORAGE_KEY, speedRange.value);
}

function loadSpeed() {
    const saved = localStorage.getItem(SPEED_STORAGE_KEY);
    const value = Number(saved);
    if (!Number.isNaN(value)) {
        const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
        speedRange.value = clamped.toString();
    }
}

init();
