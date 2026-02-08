// 引用拼图容器
const puzzle = document.getElementById("puzzle");
// 引用计时器
const timerElement = document.getElementById("timer");
// 引用步数
const stepElement = document.getElementById("step");
// 进度条input
const progressBar = document.getElementById("progress-bar-input");
// 播放暂停按钮
const playPauseButton = document.getElementById("play-pause-button");
// 上一步下一步按钮
const lastStepButton = document.getElementById("last-step");
const nextStepButton = document.getElementById("next-step");
// 倍速播放元素
const speedUpButton = document.getElementById("speed-up");
const speedDownButton = document.getElementById("speed-down");
const speedInfoElement = document.getElementById("playback-speed-info");


// 定义拼图的阶数（边长）
let size = 4;
// 用于存储拼图块的数组
let tiles = [];
// 用于存储拼图块本次打乱的数组
let scrambleTiles = [];
// 移动序列，记录本次还原的操作
let moveSequence = [];
// 当前模式纪录的时间（需要显示的时间）
let displayTime = 0;
// 基本数据
let step = 0;
let time = "0.00";
// 观察时间
let observeTime = 0;
// 游戏模式
let gameMode = "normal";
// 是否暂停
let isPaused = true;
// 当前播放到第几步
let currentStep = 0;
// 区分手动拖动和程序更新进度条
let isSeeking = false;
// 状态列表
let cases;
// 播放速度
let playbackSpeed = 1;
// 播放速度可选列表
let playbackSpeedList = [0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 10];

// 样式配置
// 颜色配置
let colorConfig = defaultColorConfig1;
// 字体比例（取值范围0 - 1.0）：字体大小 = 滑块的边长 * fontSizeRatio
let fontSizeRatio = defaultFontSizeRatio1;
// 间隙大小（取值范围0 - 0.1）
let gapWidthRatio = defaultGapWidthRatio1;
// 圆角大小系数（取值范围0 - 0.5），：圆角大小 = 滑块的边长 * borderRadiusRatio
let borderRadiusRatio = defaultBorderRadiusRatio1;

// 根据数字返回对应的颜色，默认为66ccff
// number为0至size*size -1，0为空白格，number和显示出来的数字是一样的
function getColor(number, size) {
    return colorConfig[getLayer(number, size)] || "#ffffff";
}

// 返回层数，一行一列这样，在颜色里使用
function getLayer(number, size) {
    number--;
    // 获取行列号（从0开始）
    row = Math.floor(number / size);
    line = number % size;
    // 以左上到右下的对角线分为上三角和下三角
    // 上三角或对角线
    if (line >= row) {
        return 2 * row + 1;
    }
    // 下三角
    else {
        return (line + 1) * 2;
    }
}

// 创建并初始化拼图块
function createTiles() {
    // 渲染拼图块
    renderTiles(puzzle, tiles, 30, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
}

// 渲染拼图块
function renderTiles(puzzle, tiles, edgeLength, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio) {
    // 计算滑块边长
    let tileLength = edgeLength / size;
    // 清空拼图容器
    puzzle.innerHTML = '';
    puzzle.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
    puzzle.style.gap = tileLength * gapWidthRatio + "vw";
    // 遍历每个拼图块
    tiles.forEach((tile, index) => {
        const tileElement = document.createElement("div"); // 创建一个新的div元素
        tileElement.dataset.index = index; // 添加自定义属性，用于存储索引值
        tileElement.classList.add("tile"); // 添加样式类
        tileElement.style.width = "100%";
        tileElement.style.height = "100%";
        tileElement.style.fontSize = tileLength * fontSizeRatio + "vw";
        tileElement.style.borderRadius = tileLength * borderRadiusRatio + "vw";

        if (tile !== 0) { // 如果拼图块不是空白块
            tileElement.textContent = tile; // 设置拼图块的文本
            tileElement.style.backgroundColor = getColor(tile, size); // 设置拼图块的背景颜色
        }
        puzzle.appendChild(tileElement); // 将拼图块添加到拼图容器中
    });
}

// 恢复播放
function resumeReplay(cases) {
    // 播放完后，再次点击播放则从头开始播放
    if (currentStep >= step) {
        currentStep = 0;
    }

    playReplay(cases, currentStep);
    isPaused = false;
    // 改变图片
    playPauseButton.querySelector("img").src = "image/pause.png";
}

// 暂停
function pauseReplay() {
    isPaused = true;
    playPauseButton.querySelector("img").src = "image/play.png";
}

// 上一步或下一步
function changeStep(direction) {
    pauseReplay();
    if (direction == 1) {
        currentStep = Math.min(step, currentStep + direction);
    } else if (direction == -1) {
        currentStep = Math.max(0, currentStep + direction);
    }
    // 渲染拼图快
    renderTiles(puzzle, cases[currentStep].caseList, 30, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
    // 显示数据
    timerElement.textContent = "Time: " + timeFormat(cases[currentStep].time - (gameMode == "normal" ? observeTime : 0));
    stepElement.textContent = "Step: " + cases[currentStep].step;
    progressBar.value = currentStep;
}

// 页面加载后
window.onload = function () {
    // 读取当局信息
    let currentScore = JSON.parse(localStorage.getItem("currentScore")) || [];
    // 读取配置信息
    let config = JSON.parse(localStorage.getItem("config")) || [];
    if (currentScore == null || currentScore.length == 0) {
        console.error("没有找到当局信息");
    } else if (config == null || config.length == 0) {
        console.error("没有找到配置信息");
    } else {
        // 赋值
        colorConfig = config.styleConfig.colorConfig;
        fontSizeRatio = config.styleConfig.fontSizeRatio;
        borderRadiusRatio = config.styleConfig.borderRadiusRatio;
        gapWidthRatio = config.styleConfig.gapWidthRatio;
        size = currentScore.size;
        step = currentScore.step;
        time = currentScore.time;
        tiles = currentScore.scramble.split(',').map(Number);
        scrambleTiles = currentScore.scramble.split(',').map(Number);
        moveSequence = currentScore.moveSequence;
        observeTime = currentScore.observeTime;
        gameMode = currentScore.gameMode;
        // 设置进度条最大值
        progressBar.max = step;
    }

    // 修改背景颜色
    if (gameMode == "normal") {
        document.body.style.backgroundColor = "#e6f1eb";
    }
    else if (gameMode == "blind") {
        document.body.style.backgroundColor = "#e6e9f1";
    }

    // 初始化拼图快
    createTiles();
    // 获取状态列表
    cases = getCases();

    // 添加监听
    document.getElementById("retry").addEventListener("click", () => {
        window.location.href = "puzzle.html?isRetry=true";
    });
    playPauseButton.addEventListener("click", () => {
        if (isPaused) {
            resumeReplay(cases);
        } else {
            pauseReplay();
        }
    });
    lastStepButton.addEventListener("click", () => {
        changeStep(-1);
    })
    nextStepButton.addEventListener("click", () => {
        changeStep(1);
    })
    speedUpButton.addEventListener("click", () => {
        changeSpeed(1);
    })
    speedDownButton.addEventListener("click", () => {
        changeSpeed(-1);
    })
    // 处理进度条拖动
    progressBar.addEventListener('input', () => {
        if (!isSeeking) {
            console.log("手动调整进度条");
            isPaused = true;
            playPauseButton.querySelector("img").src = "image/play.png";
            currentStep = progressBar.value;
            // 渲染拼图快
            renderTiles(puzzle, cases[currentStep].caseList, 30, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
            // 显示数据
            timerElement.textContent = "Time: " + timeFormat(cases[currentStep].time - (gameMode == "normal" ? observeTime : 0));
            stepElement.textContent = "Step: " + cases[currentStep].step;
        }
    });
};

// 根据moveSequence和scrambleTiles找出每一步完成后的状态
// 获得一个新的数组，包括了每一步的信息
function getCases() {
    let cases = [{
        "caseList": scrambleTiles,
        "time": gameMode == "normal" ? observeTime : 0,
        "step": 0,
    }];
    // 遍历每一步
    for (let index = 0; index < moveSequence.length; index++) {
        const oneMove = moveSequence[index];
        moveTiles(tiles, oneMove.direction)
        cases.push({
            "caseList": tiles.slice(),
            "time": oneMove.time,
            "step": index + 1,
        })
    }
    return cases;
}

// 在当前tiles的基础上移动一步，注意tiles是引用数据类型，数据会被修改
function moveTiles(tiles, direction) {
    // 获取空白快的坐标
    zeroIndex = tiles.indexOf(0);
    const [line0, row0] = [zeroIndex % size, Math.floor(zeroIndex / size)];
    switch (direction) {
        case "U":
            if (row0 <= size - 2) {
                [tiles[zeroIndex], tiles[zeroIndex + size]] = [tiles[zeroIndex + size], tiles[zeroIndex]];
            }
            break;
        case "D":
            if (row0 >= 1) {
                [tiles[zeroIndex], tiles[zeroIndex - size]] = [tiles[zeroIndex - size], tiles[zeroIndex]];
            }
            break;
        case "L":
            if (line0 <= size - 2) {
                [tiles[zeroIndex], tiles[zeroIndex + 1]] = [tiles[zeroIndex + 1], tiles[zeroIndex]];
            }
            break;
        case "R":
            if (line0 >= 1) {
                [tiles[zeroIndex], tiles[zeroIndex - 1]] = [tiles[zeroIndex - 1], tiles[zeroIndex]];
            }
            break;
        default:
            break;
    }
}

// 播放录像方法
function playReplay(cases, startStep) {
    let currentIndex = startStep;
    let startTime = Date.now() - (cases[startStep].time - (gameMode == "normal" ? observeTime : 0));

    function playNextStep() {
        // 暂停或手动拖动进度条
        if (isPaused || isSeeking) {
            clearInterval(replayInterval);
            return;
        }

        // 回放完成
        if (currentIndex >= cases.length) {
            isPaused = true;
            playPauseButton.querySelector("img").src = "image/play.png";
            // 修正时间显示
            timerElement.textContent = "Time: " + time;
            clearInterval(replayInterval);
            return;
        }

        let currentData = cases[currentIndex];
        let elapsedTime = (Date.now() - startTime) * playbackSpeed;

        if (elapsedTime >= currentData.time - (gameMode == "normal" ? observeTime : 0)) {
            // 渲染当前状态
            renderTiles(puzzle, currentData.caseList, 30, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
            currentIndex++;
            currentStep = currentIndex;
            // 改变进度条
            isSeeking = true;
            progressBar.value = currentData.step;
            isSeeking = false;
        }
        // 显示数据
        timerElement.textContent = "Time: " + timeFormat(elapsedTime);
        stepElement.textContent = "Step: " + currentData.step;
    }

    let replayInterval = setInterval(playNextStep, 10); // 每10毫秒检查一次
}


// 格式化时间，保留2位小数，参数是毫秒
function timeFormat(originalTime) {
    const seconds = Math.floor(originalTime / 1000);
    const milliseconds = originalTime % 1000;
    return parseFloat(`${seconds}.${milliseconds}`).toFixed(2);
}

// 为页面添加按键监听
document.addEventListener('keydown', function (event) {
    switch (event.key) {
        case " ":
            if (isPaused) {
                resumeReplay(cases);
            } else {
                pauseReplay();
            }
            break;
        case "ArrowLeft":
            changeStep(-1);
            break;
        case "ArrowRight":
            changeStep(1);
            break;
        default:
            break;
    }
});

// 改变速度
function changeSpeed(direction) {
    let index = playbackSpeedList.indexOf(playbackSpeed);
    playbackSpeed = playbackSpeedList[(index + direction + playbackSpeedList.length) % playbackSpeedList.length];
    speedInfoElement.textContent = playbackSpeed;
}

document.addEventListener("DOMContentLoaded", () => {
    // 设置整体字体大小和行高
    document.documentElement.style.fontSize = window.innerWidth / 112.5 + "px";
    document.documentElement.style.lineHeight = window.innerHeight / 112.5 + "px";
});