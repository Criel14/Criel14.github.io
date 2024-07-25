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
// 观察时间
let observeTime = 0;
// 游戏模式
let gameMode = "normal";
// 是否暂停
let isPaused = true;
// 当前播放到第几步
let currentStep = 0;

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
    renderTiles(puzzle, tiles, 500, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
}

// 渲染拼图块
function renderTiles(puzzle, tiles, edgeLength, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio) {
    // 计算滑块边长
    let tileLength = edgeLength / size;
    // 清空拼图容器
    puzzle.innerHTML = '';
    puzzle.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
    puzzle.style.gap = tileLength * gapWidthRatio + "px";
    // 遍历每个拼图块
    tiles.forEach((tile, index) => {
        const tileElement = document.createElement("div"); // 创建一个新的div元素
        tileElement.classList.add("tile"); // 添加样式类
        tileElement.style.width = tileLength + "px";
        tileElement.style.height = tileLength + "px";
        tileElement.style.fontSize = tileLength * fontSizeRatio + "px";
        tileElement.style.borderRadius = tileLength * borderRadiusRatio + "px";

        if (tile !== 0) { // 如果拼图块不是空白块
            tileElement.textContent = tile; // 设置拼图块的文本
            tileElement.style.backgroundColor = getColor(tile, size); // 设置拼图块的背景颜色
        }

        puzzle.appendChild(tileElement); // 将拼图块添加到拼图容器中
    });
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
        tiles = currentScore.scramble.split(',').map(Number);
        scrambleTiles = currentScore.scramble.split(',').map(Number);
        moveSequence = currentScore.moveSequence;
        observeTime = currentScore.observeTime;
        gameMode = currentScore.gameMode;
        // 设置进度条最大值
        progressBar.max = currentScore.step;
    }

    // 初始化拼图快
    createTiles();
    // 获取状态列表
    let cases = getCases();

    // 添加监听
    playPauseButton.addEventListener("click", () => {
        if (isPaused) {
            console.log(`从第${currentStep}步开始播放`);
            playReplay(cases, currentStep);
            isPaused = false;
            // 改变图片
            playPauseButton.querySelector("img").src = "image/pause.png";
        } else {
            isPaused = true;
            playPauseButton.querySelector("img").src = "image/play.png";
        }
    });
};

// 根据moveSequence和scrambleTiles找出每一步完成后的状态
// 获得一个新的数组，包括了每一步的信息
function getCases() {
    let cases = [{
        "caseList": scrambleTiles,
        "time": observeTime,
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
        if (isPaused) {
            return; // 如果暂停，什么也不做
        }

        if (currentIndex >= cases.length) {
            clearInterval(replayInterval); // 回放完成，停止计时器
            return;
        }

        let currentData = cases[currentIndex];
        let elapsedTime = Date.now() - startTime;

        if (elapsedTime >= currentData.time - (gameMode == "normal" ? observeTime : 0)) {
            // 渲染当前状态
            renderTiles(puzzle, currentData.caseList, 500, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
            currentIndex++;
            currentStep = currentIndex;
            // 显示数据
            timerElement.textContent = timeFormat(elapsedTime);
            stepElement.textContent = currentData.step;
            // 改变进度条
            progressBar.value = currentData.step;
        }
    }

    let replayInterval = setInterval(playNextStep, 10); // 每10毫秒检查一次
}


// 格式化时间，保留2位小数，参数是毫秒
function timeFormat(originalTime) {
    const seconds = Math.floor(originalTime / 1000);
    const milliseconds = originalTime % 1000;
    return parseFloat(`${seconds}.${milliseconds}`).toFixed(2);
}