const boardEl = document.getElementById("board");
const scoreValueEl = document.getElementById("scoreValue");
const applesValueEl = document.getElementById("applesValue");
const ratioValueEl = document.getElementById("ratioValue");
const timeValueEl = document.getElementById("timeValue");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const endBtn = document.getElementById("endBtn");
const langToggleBtn = document.getElementById("langToggleBtn");
const speedRange = document.getElementById("speedRange");
const speedValueEl = document.getElementById("speedValue");
const modeInputs = Array.from(document.querySelectorAll("input[name='gameMode']"));
const bestValueEl = document.getElementById("bestValue");
const bestBadgeEl = document.getElementById("bestBadge");
const resultStatusEl = document.getElementById("resultStatus");
const graceWrapEl = document.getElementById("graceWrap");
const graceBarEl = document.getElementById("graceBar");
const i18nNodes = document.querySelectorAll("[data-i18n]");

// 场地边长
const GRID_SIZE = 19;

// 速度范围（毫秒越小越快）
const SPEED_MIN = 30;
const SPEED_MAX = 500;
const SPEED_STEP = 10;
const SPEED_STORAGE_KEY = "snake_speed_ms";

// 模式常量与本地存储键
const MODE_APPLES_40 = "apples40";
const MODE_TIME_LIMIT = "timeLimit";
const MODE_CUSTOM = "custom";
const MODE_STORAGE_KEY = "snake_mode";
const BEST_STORAGE_KEY_APPLES_40 = "snake_best_apples40_ms";
const BEST_STORAGE_KEY_TIME_LIMIT = "snake_best_time_limit_score";

// 40 Apples 的目标苹果数量
const APPLES_TARGET = 40;

// 容错时间配置
const GRACE_DURATION_MS = 800;
const TIME_LIMIT_MS = 120000;
const HARD_DROP_INTERVAL_MS = 30;

let timerId = null;
let timeTimerId = null;
let graceTimerId = null;
let hardDropTimerId = null;
let isRunning = false;
let isPaused = false;
let isGameOver = false;
let isInGrace = false;
let isHardDropping = false;
let direction = { x: 1, y: 0 };
let pendingDirection = { x: 1, y: 0 };
let snake = [];
let apple = { x: 0, y: 0 };
let score = 0;
let appleCount = 0;
let cells = [];
let elapsedMs = 0;
let remainingMs = 0;
let currentLang = "zh";
const LANG_STORAGE_KEY = "snake_lang";
let currentMode = MODE_APPLES_40;
let bestRecordMs = null;
let modeDisabledMap = new Map();
let graceStartMs = 0;
let isTargetCompleted = false;
let graceRemainingMs = 0;
let hardDropQueue = [];
let hardDropResult = null;

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
        scoreLabel: "分数",
        applesLabel: "苹果",
        scorePerAppleLabel: "分数/苹果",
        modeTitle: "游戏模式",
        mode40: "40 Apples（竞速）",
        modeTime: "限时打分（2分钟）",
        modeCustom: "自定义模式（暂定）",
        bestLabel: "最佳纪录",
        personalBest: "PERSONAL BEST",
        notFinished: "未完成",
        resume: "继续游戏"
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
        scoreLabel: "Score",
        applesLabel: "Apples",
        scorePerAppleLabel: "Score/Apple",
        modeTitle: "Game Mode",
        mode40: "40 Apples (Speedrun)",
        modeTime: "Time Attack (2 min)",
        modeCustom: "Custom (TBD)",
        bestLabel: "Best Record",
        personalBest: "PERSONAL BEST",
        notFinished: "Not Finished",
        resume: "Resume"
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
    initModeControl();
    loadMode();
    loadBestRecord();
    updateBestDisplay();
    updateModeStyling();
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
    modeInputs.forEach(input => {
        input.addEventListener("change", handleModeChange);
    });
    window.addEventListener("keydown", handleKey);
}

function resetGame() {
    // 重置游戏状态（分数、方向、蛇身、苹果）
    score = 0;
    appleCount = 0;
    updateScore();
    updateApples();
    updateScoreRatio();
    hideBestBadge();
    hideResultStatus();
    clearGrace();
    clearHardDrop();
    direction = { x: 1, y: 0 };
    pendingDirection = { x: 1, y: 0 };
    isGameOver = false;
    isTargetCompleted = false;
    elapsedMs = 0;
    remainingMs = currentMode === MODE_TIME_LIMIT ? TIME_LIMIT_MS : 0;
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
    hideBestBadge();
    clearGrace();
    clearHardDrop();
    updatePauseButton();
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
        resumeGrace();
        resumeHardDrop();
        updatePauseButton();
        return;
    }
    isPaused = true;
    stopLoop();
    stopTimer();
    pauseGrace();
    pauseHardDrop();
    updatePauseButton();
}

function endGame() {
    // 结束游戏并提示最终分数
    finishGame({
        reason: "manual"
    });
}

function finishGame(result) {
    // 统一收尾：停止计时器、清理状态、必要时更新纪录
    stopLoop();
    stopTimer();
    clearGrace();
    clearHardDrop();
    isRunning = false;
    isPaused = false;
    isGameOver = true;
    setControlLock(false);
    updatePauseButton();

    // 只有完成 40 Apples 目标时才记录最佳成绩
    if (currentMode === MODE_APPLES_40) {
        const isCompleted = result.reason === "apples40-complete" || isTargetCompleted;
        if (isCompleted) {
            updateBestRecordIfNeeded(elapsedMs);
            hideResultStatus();
        } else {
            showResultStatus();
        }
        return;
    }
    if (currentMode === MODE_TIME_LIMIT) {
        updateBestRecordIfNeeded(score);
        hideResultStatus();
    }
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
    const nextHead = getNextHead(1);
    if (isCollision(nextHead)) {
        handleGrace();
        return;
    }
    applyMove(nextHead);
    render();
}

function getNextHead(distance) {
    // 按当前方向计算下一步蛇头位置
    const head = snake[0];
    return {
        x: head.x + direction.x * distance,
        y: head.y + direction.y * distance
    };
}

function applyMove(newHead) {
    // 正常移动：写入蛇头、判断吃苹果
    if (isInGrace) {
        clearGrace();
    }

    snake.unshift(newHead);

    if (isApple(newHead)) {
        // 吃到苹果：加分并生成新苹果，不移除尾巴
        appleCount += 1;
        score += 1;
        updateScore();
        updateApples();
        updateScoreRatio();

        // 40 Apples 模式：达到目标即结束游戏
        if (currentMode === MODE_APPLES_40 && appleCount >= APPLES_TARGET) {
            isTargetCompleted = true;
            finishGame({
                reason: "apples40-complete"
            });
            return;
        }

        placeApple();
        return;
    }

    // 未吃到苹果：移除尾部，保持长度不变
    snake.pop();
}

function handleGrace() {
    // 碰撞时进入容错状态，允许短时间内脱离碰撞
    if (!isInGrace) {
        startGrace();
        render();
        return;
    }

    if (isGraceExpired()) {
        finishGame({
            reason: "collision"
        });
    }
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

function isCollision(pos) {
    // 判断是否碰撞墙壁或自身
    return isHitWall(pos) || isHitSelf(pos);
}

function updateScore() {
    // 更新分数显示
    scoreValueEl.textContent = score.toString();
    if (currentMode === MODE_TIME_LIMIT) {
        scoreValueEl.classList.remove("bump");
        void scoreValueEl.offsetWidth;
        scoreValueEl.classList.add("bump");
    }
}

function updateApples() {
    // 更新苹果数量显示
    applesValueEl.textContent = appleCount.toString();
    if (currentMode === MODE_APPLES_40) {
        applesValueEl.classList.remove("bump");
        void applesValueEl.offsetWidth;
        applesValueEl.classList.add("bump");
    }
}

function updateScoreRatio() {
    // 更新分数/苹果显示
    if (appleCount <= 0) {
        ratioValueEl.textContent = "0.00";
        return;
    }
    const ratio = score / appleCount;
    ratioValueEl.textContent = ratio.toFixed(2);
}

function handleKey(event) {
    // 键盘控制：W/A/S/D
    const key = event.key.toLowerCase();
    if (event.code === "Space" || key === " ") {
        event.preventDefault();
        if (!isRunning || isPaused || isGameOver) {
            return;
        }
        performHardDrop();
        return;
    }
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
    if (currentMode === MODE_TIME_LIMIT) {
        const startRemaining = remainingMs > 0 ? remainingMs : TIME_LIMIT_MS;
        const startAt = Date.now();
        remainingMs = startRemaining;
        timeTimerId = setInterval(() => {
            remainingMs = Math.max(0, startRemaining - (Date.now() - startAt));
            updateTime();
            if (remainingMs <= 0) {
                finishGame({
                    reason: "time-up"
                });
            }
        }, 120);
        return;
    }
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
    const baseMs = currentMode === MODE_TIME_LIMIT ? remainingMs : elapsedMs;
    const text = formatTime(baseMs);
    timeValueEl.innerHTML = `<span class="time-main">${text.main}</span><span class="time-ms">${text.ms}</span>`;
}

function formatTime(totalMs) {
    // 将毫秒格式化为 m:ss.mmm
    const totalMilliseconds = Math.max(0, totalMs);
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = totalMilliseconds % 1000;
    const ss = seconds.toString().padStart(2, "0");
    const mmm = milliseconds.toString().padStart(3, "0");
    return {
        main: `${minutes}:${ss}`,
        ms: `.${mmm}`
    };
}

function render() {
    // 渲染蛇身与苹果
    cells.forEach(cell => {
        cell.classList.remove("snake", "apple", "head", "ghost");
    });

    snake.forEach((segment, segmentIndex) => {
        const index = getIndex(segment);
        if (index !== null) {
            cells[index].classList.add("snake");
            if (segmentIndex === 0) {
                cells[index].classList.add("head");
                if (isInGrace) {
                    cells[index].classList.add("danger");
                }
            }
        }
    });

    const appleIndex = getIndex(apple);
    if (appleIndex !== null) {
        cells[appleIndex].classList.add("apple");
    }

    renderGhost();
}

function getIndex(pos) {
    // 将坐标转换为一维索引
    if (pos.x < 0 || pos.y < 0 || pos.x >= GRID_SIZE || pos.y >= GRID_SIZE) {
        return null;
    }
    return pos.y * GRID_SIZE + pos.x;
}

function renderGhost() {
    // 渲染落点提示（单点）
    if (!isRunning || isPaused || isGameOver || isHardDropping) {
        return;
    }
    const landing = getHardDropLanding();
    if (!landing) {
        return;
    }
    const index = getIndex(landing);
    if (index === null) {
        return;
    }
    const head = snake[0];
    if (head && head.x === landing.x && head.y === landing.y) {
        return;
    }
    cells[index].classList.add("ghost");
}

function getHardDropLanding() {
    // 计算硬降落点：遇到苹果则停在苹果，否则停在撞墙/撞身前一格
    if (!direction || (direction.x === 0 && direction.y === 0)) {
        return null;
    }

    let tempSnake = snake.map(segment => ({ ...segment }));
    let lastSafe = tempSnake[0];

    while (true) {
        const nextHead = {
            x: tempSnake[0].x + direction.x,
            y: tempSnake[0].y + direction.y
        };

        if (isHitWall(nextHead)) {
            return lastSafe;
        }

        const willEat = isApple(nextHead);
        const bodyToCheck = willEat ? tempSnake : tempSnake.slice(0, -1);
        const hitSelf = bodyToCheck.some(segment => segment.x === nextHead.x && segment.y === nextHead.y);

        if (hitSelf) {
            return lastSafe;
        }

        tempSnake.unshift(nextHead);
        if (!willEat) {
            tempSnake.pop();
        }

        lastSafe = nextHead;

        if (willEat) {
            return nextHead;
        }
    }
}

function setControlLock(isLocked) {
    // 游戏运行中禁用开始按钮与速度选择
    startBtn.disabled = isLocked;
    speedRange.disabled = isLocked;
    modeInputs.forEach(input => {
        const isPermanentlyDisabled = modeDisabledMap.get(input) === true;
        input.disabled = isLocked || isPermanentlyDisabled;
    });
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
    updatePauseButton();
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

function performHardDrop() {
    // 硬降：沿当前方向快速冲刺直到撞墙/撞身/吃到苹果
    if (direction.x === 0 && direction.y === 0) {
        return;
    }
    clearHardDrop();
    stopLoop();

    // 硬降期间不触发容错
    if (isInGrace) {
        clearGrace();
    }

    let steps = 0;
    let tempSnake = snake.map(segment => ({ ...segment }));
    let collisionType = null;
    let collisionPos = null;

    while (true) {
        const nextHead = {
            x: tempSnake[0].x + direction.x,
            y: tempSnake[0].y + direction.y
        };

        // 撞墙直接结束（无容错）
        if (isHitWall(nextHead)) {
            collisionType = "wall";
            collisionPos = nextHead;
            break;
        }

        const willEat = isApple(nextHead);
        const bodyToCheck = willEat ? tempSnake : tempSnake.slice(0, -1);
        const hitSelf = bodyToCheck.some(segment => segment.x === nextHead.x && segment.y === nextHead.y);

        if (hitSelf) {
            collisionType = "self";
            collisionPos = nextHead;
            break;
        }

        tempSnake.unshift(nextHead);
        if (!willEat) {
            tempSnake.pop();
        }
        steps += 1;

        if (willEat) {
            break;
        }
    }

    if (collisionType) {
        // 撞墙：停在边界格；撞身：显示重叠的撞击位置
        snake = tempSnake;
        if (collisionType === "self" && collisionPos) {
            snake.unshift(collisionPos);
            snake.pop();
        }
        render();
        finishGame({
            reason: "hard-drop-collision"
        });
        return;
    }

    // 硬降吃到苹果：基础分 + 冲刺距离奖励
    snake = tempSnake;
    appleCount += 1;
    score += 1 + steps;
    updateScore();
    updateApples();
    updateScoreRatio();

    if (currentMode === MODE_APPLES_40 && appleCount >= APPLES_TARGET) {
        isTargetCompleted = true;
        finishGame({
            reason: "apples40-complete"
        });
        return;
    }

    placeApple();
    render();
    if (isRunning && !isPaused && !isGameOver) {
        runLoop();
    }
}

function startHardDrop(queue, result) {
    // 启动硬降动画，逐步推进直到结果
    stopLoop();
    hardDropQueue = queue.slice();
    hardDropResult = result;
    isHardDropping = true;
    startHardDropTimer();
}

function startHardDropTimer() {
    stopHardDropTimer();
    hardDropTimerId = setInterval(() => {
        advanceHardDrop();
    }, HARD_DROP_INTERVAL_MS);
}

function stopHardDropTimer() {
    if (hardDropTimerId) {
        clearInterval(hardDropTimerId);
        hardDropTimerId = null;
    }
}

function advanceHardDrop() {
    if (!isHardDropping) {
        return;
    }

    if (hardDropQueue.length === 0) {
        // 队列耗尽，根据结果收尾
        const resultType = hardDropResult ? hardDropResult.type : "collision";
        endHardDrop();
        if (resultType === "collision") {
            finishGame({
                reason: "hard-drop-collision"
            });
        } else if (isRunning && !isPaused && !isGameOver) {
            runLoop();
        }
        return;
    }

    const nextHead = hardDropQueue.shift();
    const isLastStep = hardDropQueue.length === 0;
    const isAppleStep = hardDropResult && hardDropResult.type === "apple" && isLastStep;

    snake.unshift(nextHead);
    if (!isAppleStep) {
        snake.pop();
    }

    if (isAppleStep) {
        // 硬降吃到苹果：基础分 + 冲刺距离奖励
        appleCount += 1;
        score += 1 + hardDropResult.steps;
        updateScore();

        if (currentMode === MODE_APPLES_40 && appleCount >= APPLES_TARGET) {
            isTargetCompleted = true;
            endHardDrop();
            finishGame({
                reason: "apples40-complete"
            });
            return;
        }

        placeApple();
        endHardDrop();
        render();
        if (isRunning && !isPaused && !isGameOver) {
            runLoop();
        }
        return;
    }

    render();
}

function endHardDrop() {
    // 收尾硬降动画状态
    stopHardDropTimer();
    isHardDropping = false;
    hardDropQueue = [];
    hardDropResult = null;
}

function clearHardDrop() {
    // 强制清理硬降状态
    stopHardDropTimer();
    isHardDropping = false;
    hardDropQueue = [];
    hardDropResult = null;
}

function pauseHardDrop() {
    // 暂停硬降动画
    if (!isHardDropping) {
        return;
    }
    stopHardDropTimer();
}

function resumeHardDrop() {
    // 继续硬降动画
    if (!isHardDropping) {
        return;
    }
    startHardDropTimer();
}

function startGrace() {
    // 进入容错状态，显示进度条并开始倒计时
    isInGrace = true;
    graceStartMs = Date.now();
    graceRemainingMs = GRACE_DURATION_MS;
    showGraceBar();
    updateGraceBar(1);
    startGraceTimer();
}

function clearGrace() {
    // 退出容错状态，复位进度条
    isInGrace = false;
    graceRemainingMs = 0;
    stopGraceTimer();
    updateGraceBar(0);
    graceWrapEl.classList.remove("is-active");
}

function isGraceExpired() {
    return Date.now() - graceStartMs >= GRACE_DURATION_MS;
}

function startGraceTimer() {
    // 定时更新倒计时进度条
    stopGraceTimer();
    graceTimerId = setInterval(() => {
        if (!isInGrace) {
            return;
        }
        const remain = Math.max(0, graceRemainingMs - (Date.now() - graceStartMs));
        const ratio = remain / GRACE_DURATION_MS;
        updateGraceBar(ratio);
        if (remain <= 0) {
            finishGame({
                reason: "collision"
            });
        }
    }, 60);
}

function stopGraceTimer() {
    if (graceTimerId) {
        clearInterval(graceTimerId);
        graceTimerId = null;
    }
}

function updateGraceBar(ratio) {
    // 根据比例更新进度条（由满到空）
    const clamped = Math.max(0, Math.min(1, ratio));
    graceBarEl.style.width = `${(clamped * 100).toFixed(2)}%`;
}

function showGraceBar() {
    graceWrapEl.classList.add("is-active");
}

function pauseGrace() {
    // 暂停容错计时
    if (!isInGrace) {
        return;
    }
    const remain = Math.max(0, graceRemainingMs - (Date.now() - graceStartMs));
    graceRemainingMs = remain;
    stopGraceTimer();
    updateGraceBar(remain / GRACE_DURATION_MS);
}

function resumeGrace() {
    // 继续容错计时
    if (!isInGrace || graceRemainingMs <= 0) {
        return;
    }
    graceStartMs = Date.now();
    startGraceTimer();
}

function initModeControl() {
    // 记录模式按钮的初始禁用状态，避免误解锁暂未开放的模式
    modeDisabledMap = new Map();
    modeInputs.forEach(input => {
        // 仅禁用暂未开放的模式
        if (input.value === MODE_CUSTOM) {
            input.disabled = true;
        }
        modeDisabledMap.set(input, input.disabled);
    });
}

function handleModeChange(event) {
    // 选择模式后切换当前模式，并重置游戏状态
    const input = event.target;
    if (!input || !input.value) {
        return;
    }
    if (input.disabled) {
        // 被禁用的模式不允许切换，恢复当前模式选中
        modeInputs.forEach(item => {
            item.checked = item.value === currentMode;
        });
        return;
    }
    currentMode = input.value;
    localStorage.setItem(MODE_STORAGE_KEY, currentMode);
    loadBestRecord();
    updateBestDisplay();
    updateModeStyling();
    resetGame();
}

function loadMode() {
    // 读取已保存的模式选择（当前仅 40 Apples 可用）
    const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
    if (savedMode && [MODE_APPLES_40, MODE_TIME_LIMIT, MODE_CUSTOM].includes(savedMode)) {
        const matched = modeInputs.find(input => input.value === savedMode);
        if (matched && !matched.disabled) {
            currentMode = savedMode;
        }
    }
    modeInputs.forEach(input => {
        input.checked = input.value === currentMode;
    });
}

function loadBestRecord() {
    // 按模式读取最佳纪录
    const key = currentMode === MODE_TIME_LIMIT ? BEST_STORAGE_KEY_TIME_LIMIT : BEST_STORAGE_KEY_APPLES_40;
    const saved = localStorage.getItem(key);
    if (saved === null || saved === "") {
        bestRecordMs = null;
        return;
    }
    const value = Number(saved);
    bestRecordMs = Number.isFinite(value) && value > 0 ? value : null;
}

function updateBestRecordIfNeeded(currentMs) {
    // 只要成绩更好就更新
    if (currentMode === MODE_TIME_LIMIT) {
        if (bestRecordMs === null || currentMs > bestRecordMs) {
            bestRecordMs = currentMs;
            localStorage.setItem(BEST_STORAGE_KEY_TIME_LIMIT, bestRecordMs.toString());
            showBestBadge();
        }
        updateBestDisplay();
        return;
    }
    if (bestRecordMs === null || currentMs < bestRecordMs) {
        bestRecordMs = currentMs;
        localStorage.setItem(BEST_STORAGE_KEY_APPLES_40, bestRecordMs.toString());
        showBestBadge();
    }
    updateBestDisplay();
}

function updateBestDisplay() {
    // 更新最佳纪录显示
    if (bestRecordMs === null) {
        bestValueEl.textContent = "--";
        return;
    }
    if (currentMode === MODE_TIME_LIMIT) {
        bestValueEl.textContent = bestRecordMs.toString();
        return;
    }
    const text = formatTime(bestRecordMs);
    bestValueEl.textContent = `${text.main}${text.ms}`;
}

function showBestBadge() {
    // 展示破纪录提示
    bestBadgeEl.classList.add("is-visible");
}

function hideBestBadge() {
    // 隐藏破纪录提示
    bestBadgeEl.classList.remove("is-visible");
}

function showResultStatus() {
    // 显示未完成提示
    resultStatusEl.classList.add("is-visible");
}

function hideResultStatus() {
    // 隐藏未完成提示
    resultStatusEl.classList.remove("is-visible");
}

function updateModeStyling() {
    // 根据模式调整高亮与动效目标
    applesValueEl.classList.remove("is-highlight");
    scoreValueEl.classList.remove("is-highlight");
    if (currentMode === MODE_APPLES_40) {
        applesValueEl.classList.add("is-highlight");
        return;
    }
    if (currentMode === MODE_TIME_LIMIT) {
        scoreValueEl.classList.add("is-highlight");
    }
}

function updatePauseButton() {
    // 根据状态切换暂停按钮文案
    const dict = I18N_MAP[currentLang];
    if (!isRunning) {
        pauseBtn.textContent = dict.pause;
        pauseBtn.dataset.i18n = "pause";
        return;
    }
    if (isPaused) {
        pauseBtn.textContent = dict.resume;
        pauseBtn.dataset.i18n = "resume";
        return;
    }
    pauseBtn.textContent = dict.pause;
    pauseBtn.dataset.i18n = "pause";
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
