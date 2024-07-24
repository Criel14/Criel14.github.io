// 引用拼图容器
const puzzle = document.getElementById("puzzle");
// 引用打乱按钮
const shuffleButton = document.getElementById("shuffleButton");
// 引用计时器
const timerElement = document.getElementById("timer");
// 引用步数
const stepElement = document.getElementById("step");
// 引用TPS
const tpsElement = document.getElementById("tps");
// 引用切换数据显示按钮
const switchDataElement = document.getElementById("switch-data");
// 引用阶数显示
const levelShowElement = document.getElementById("level");
// 引用阶数增加和减少按钮
const levelUpElement = document.getElementById("level-up");
const levelDownElement = document.getElementById("level-down");
// 引用移动模式切换按钮
const moveModeElement = document.getElementById("move-mode");
// 引用游戏模式切换按钮
const gameModeElement = document.getElementById("game-mode");
// 引用光标切换按钮
const cursorModeElement = document.getElementById("cursor-mode");
// 引用成绩列表
const scoreListElement = document.getElementById("score-list");
// 引用换组按钮
const groupLastElement = document.getElementById("group-last");
const groupNextElement = document.getElementById("group-next");
// 显示组号
const groupNumberElement = document.getElementById("group-number");
// 整个组号大div，用于隐藏显示
const groupElement = document.getElementById("group");
// 引用关于按钮
const aboutElement = document.getElementById("about");
// 调色按钮
const colorModeElement = document.getElementById("color-mode");
// 引用设置弹框
const configOverlayElement = document.getElementById("config-overlay");
// 关闭设置弹框按钮
const configCloseElement = document.getElementById("config-overlay-close-button");
// 保存配置按钮
const configSaveElement = document.getElementById("config-overlay-save-button");
// 改色界面的预览puzzle
const previewPuzzle = document.getElementById("preview-puzzle");

// 定义拼图的阶数（边长）
let size = 4;
// 用于存储拼图块的数组
let tiles = [];
// 用于存储拼图块本次打乱的数组
let scrambleTiles = [];
// 计时
let timerInterval;
let timeEclapsed = 0;
let formattedTime = "0.00";
// 当前模式纪录的时间（需要显示的时间）
let displayTime = 0;
// 纪录盲拧模式下的观察时间
let observeTime = 0;
// 是否开始游戏
let isStart = false;
// 是否开始移动
let isMoving = false;
// 是否已经还原
let isFinish = false;
// 步数
let step = 0;
let tps = 0.00;
// 数据显示模式：是否显示提示信息：例如显示 ”Step：98“ 还是 ”98“
let showTip = true;
// 移动模式
let moveMode = "slide";
// 游戏模式
let gameMode = "normal";
// 当前组号
let groupNum = 1;
// 是否启用自定义光标样式
let isCustomCursor = false;

// 颜色字典，按层降阶，即从左上到右下
let colorConfig = {
    0: "#f0f0f0",
    1: "#e74c3c",
    2: "#e67e22",
    3: "#f1c40f",
    4: "#2ecc71",
    5: "#1abc9c",
    6: "#3498db",
    7: "#6810fa",
    8: "#8a5201",
    9: "#767676",
    10: "#5b2789",
    11: "#ff8685",
    12: "#ffc586",
    13: "#fcf080",
    14: "#c5ff98",
    15: "#93d3ff",
    16: "#c4925f",
    17: "#dc98ff"
};

// 默认配置
let defaultConfig = {
    "size": 4,
    "gameMode": "normal",
    "moveMode": "slide",
    "groupNumber": 1,
    "isCustomCursor": false,
    "colorConfig": colorConfig,
}

// 移动模式列表
let moveModeList = ["click", "slide", "keyboard"];

// 游戏模式列表
let gameModeList = ["normal", "blind"];


// 根据数字返回对应的颜色，默认为66ccff
// number为0-15，0为空白格，number和显示出来的数字是一样的
function getColor(number, size) {
    number--;
    // 获取行列号（从0开始）
    row = Math.floor(number / size);
    line = number % size;
    // 以左上到右下的对角线分为上三角和下三角
    // 上三角或对角线
    if (line >= row) {
        return colorConfig[2 * row + 1] || "#66ccff";
    }
    // 下三角
    else {
        return colorConfig[(line + 1) * 2] || "#66ccff";
    }
}

// 创建并初始化拼图块
function createTiles() {
    // 修改背景颜色
    if (gameMode == "normal") {
        document.body.style.backgroundColor = "#e6f1eb";
    }
    else if (gameMode == "blind") {
        document.body.style.backgroundColor = "#e6e9f1";
    }
    isFinish = false;
    isStart = false;
    isMoving = false;
    // 重置步数
    step = 0;
    // 清除计时
    resetTimer();
    // 生成数组并打乱
    scramble();
    // 渲染拼图块
    renderTiles(puzzle, tiles, 500, size);
    // 开始计时
    startTimer();

    // 旋转动画
    shuffleButton.classList.add('spin-animation');
    // 在动画结束后移除动画类，以便下次点击时可以再次触发动画
    setTimeout(() => {
        shuffleButton.classList.remove('spin-animation');
    }, 300); // 这里的1000是动画持续时间，单位是毫秒
}

// 生成并打乱
// 数字华容道NxN数字随机排列的阵列有解的充要条件是：（行号列号从0开始）
// （总逆序数 + 0的行号 + 0的列号）与 N 不同奇偶
function scramble() {
    // 当打乱符合条件的时候再退出循环
    while (true) {
        // 随机打乱
        tiles = Array.from({ length: size * size }, (_, i) => i).sort(() => Math.random() - 0.5);
        // 计算0的行号和列号
        zeroIndex = tiles.indexOf(0);
        // 判断（总逆序数 + 0的行号 + 0的列号）与 N 是否不同奇偶 => 奇偶相加必为奇
        if ((countInversions(tiles) + Math.floor(zeroIndex / size) + zeroIndex % size + size) % 2 == 1) {
            break;
        }
    }
    scrambleTiles = Array.from(tiles);
}


// 渲染拼图块
function renderTiles(puzzle, tiles, edgeLength, size) {
    puzzle.innerHTML = ''; // 清空拼图容器
    puzzle.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
    // 遍历每个拼图块
    tiles.forEach((tile, index) => {
        const tileElement = document.createElement("div"); // 创建一个新的div元素
        tileElement.classList.add("tile"); // 添加样式类
        if (isFinish == true) {
            tileElement.style.boxShadow = "0 0 80px #ffff0046";
        }
        tileElement.style.width = edgeLength / size + "px";
        tileElement.style.height = edgeLength / size + "px";
        tileElement.style.fontSize = edgeLength / 2 / size + "px";

        if (tile !== 0) { // 如果拼图块不是空白块
            if (gameMode == "blind" && isStart == true && isFinish == false) {
                tileElement.style.backgroundColor = "#66ccff"; // 设置拼图块的背景颜色
            }
            else {
                tileElement.textContent = tile; // 设置拼图块的文本
                tileElement.style.backgroundColor = getColor(tile, size); // 设置拼图块的背景颜色
            }
            // 为拼图块添加事件监听器
            if (moveMode == "click") {
                tileElement.addEventListener("click", () => moveTileMouse(index));
            }
            else if (moveMode == "slide") {
                tileElement.addEventListener("mouseover", () => moveTileMouse(index));
            }
        }
        puzzle.appendChild(tileElement); // 将拼图块添加到拼图容器中
    });
}

// 鼠标移动方法
function moveTileMouse(index) {
    let zeroIndex = tiles.indexOf(0); // 找到空白块的位置
    const [line1, row1] = [index % size, Math.floor(index / size)]; // 计算当前拼图块的坐标
    const [line0, row0] = [zeroIndex % size, Math.floor(zeroIndex / size)]; // 计算空白块的坐标

    // 移动整行或整列，flag为移动一块后，空白快位置的偏移量
    function move(flag) {
        while (index != zeroIndex) {
            [tiles[zeroIndex], tiles[zeroIndex + flag]] = [tiles[zeroIndex + flag], tiles[zeroIndex]];
            step++;
            zeroIndex += flag;
        }
    }

    // 当前块与空白块在同一行
    if (row1 == row0 && line1 != line0) {
        move(line1 < line0 ? -1 : 1); // 左为-1，右为1
        isMoving = true;
    }
    // 当前块与空白块在同一列
    else if (line1 == line0 && row1 != row0) {
        move(row1 < row0 ? -size : size); // 上为-size，下为size
        isMoving = true;
    }

    // 重新渲染拼图块
    renderTiles(puzzle, tiles, 500, size);
    // 检查是否拼图成功
    checkWin();
}

// 键盘移动方法
// 传入参数：up、down、left、right
function moveTileKeyboard(direction) {
    if (moveMode != "keyboard") {
        return;
    }
    // 获取空白快的坐标
    zeroIndex = tiles.indexOf(0);
    const [line0, row0] = [zeroIndex % size, Math.floor(zeroIndex / size)];
    switch (direction) {
        case "up":
            if (row0 <= size - 2) {
                [tiles[zeroIndex], tiles[zeroIndex + size]] = [tiles[zeroIndex + size], tiles[zeroIndex]];
                step++;
                isMoving = true;
            }
            break;
        case "down":
            if (row0 >= 1) {
                [tiles[zeroIndex], tiles[zeroIndex - size]] = [tiles[zeroIndex - size], tiles[zeroIndex]];
                step++;
                isMoving = true;
            }
            break;
        case "left":
            if (line0 <= size - 2) {
                [tiles[zeroIndex], tiles[zeroIndex + 1]] = [tiles[zeroIndex + 1], tiles[zeroIndex]];
                step++;
                isMoving = true;
            }
            break;
        case "right":
            if (line0 >= 1) {
                [tiles[zeroIndex], tiles[zeroIndex - 1]] = [tiles[zeroIndex - 1], tiles[zeroIndex]];
                step++;
                isMoving = true;
            }
            break;
        default:
            break;
    }
    // 重新渲染拼图块
    renderTiles(puzzle, tiles, 500, size);
    // 检查是否拼图成功
    checkWin();
}


// 检查是否拼图成功
function checkWin() {
    // 如果拼图块按顺序排列
    if (tiles.slice(0, -1).every((tile, i) => tile === i + 1)) {
        // 停止计时器
        clearInterval(timerInterval);
        if (isFinish == false) {
            // 重新显示数据
            updateTimerAndStep();
            // 记录成绩
            const score = {
                size: size,
                time: formattedTime,
                step: step,
                tps: tps,
                scramble: scrambleTiles.toString(),
                moveMode: moveMode,
                gameMode: gameMode,
                observeTime: timeFormat(observeTime),
                group: groupNum,
            };
            saveScore(score);
            // 标记完成
            isFinish = true;
        }
        // 重新渲染拼图块
        renderTiles(puzzle, tiles, 500, size);
    }
}

// 计算数组的逆序数
function countInversions(originalArr) {
    // 辅助函数，用于合并两个已排序的数组并计算逆序数
    function mergeAndCount(arr, tempArr, left, mid, right) {
        let i = left; // 左子数组的起始索引
        let j = mid + 1; // 右子数组的起始索引
        let k = left; // 要排序的起始索引
        let invCount = 0; // 逆序数计数器

        // 确保 i 不超过 mid 且 j 不超过 right
        while (i <= mid && j <= right) {
            if (arr[i] <= arr[j]) {
                tempArr[k++] = arr[i++];
            } else {
                // 存在 mid - i 个逆序，因为左子数组剩余的元素（arr[i], arr[i+1], ..., arr[mid]）都大于 arr[j]
                tempArr[k++] = arr[j++];
                invCount += (mid - i + 1);
            }
        }

        // 复制左子数组的剩余元素（如果有）
        while (i <= mid) {
            tempArr[k++] = arr[i++];
        }

        // 复制右子数组的剩余元素（如果有）
        while (j <= right) {
            tempArr[k++] = arr[j++];
        }

        // 将已排序的子数组复制回原数组
        for (i = left; i <= right; i++) {
            arr[i] = tempArr[i];
        }

        return invCount;
    }

    // 辅助函数，用于归并排序并计算逆序数
    function mergeSortAndCount(arr, tempArr, left, right) {
        let invCount = 0; // 逆序数计数器
        if (left < right) {
            let mid = Math.floor((left + right) / 2);

            // 计算左半部分的逆序数
            invCount += mergeSortAndCount(arr, tempArr, left, mid);

            // 计算右半部分的逆序数
            invCount += mergeSortAndCount(arr, tempArr, mid + 1, right);

            // 合并两半并计算逆序数
            invCount += mergeAndCount(arr, tempArr, left, mid, right);
        }
        return invCount;
    }

    // 创建一个临时数组以避免在合并过程中多次创建数组
    let arr = Array.from(originalArr);
    let tempArr = Array.from(arr);
    return mergeSortAndCount(arr, tempArr, 0, arr.length - 1);
}


// 当整个HTML文档加载完毕后执行以下代码
document.addEventListener("DOMContentLoaded", () => {
    // 读取配置文件
    loadConfig();
    // 显示信息
    gameModeElement.textContent = gameMode;
    moveModeElement.textContent = moveMode;
    levelShowElement.textContent = size + "×" + size;
    groupNumberElement.textContent = "G" + groupNum;
    // 设置level文本颜色
    if (gameMode == "normal") {
        levelShowElement.style.color = "#093009";
    }
    else if (gameMode == "blind") {
        levelShowElement.style.color = "##161b48";
    }
    // 设置光标样式
    setCursorStyle(isCustomCursor);
    // 为按钮添加点击事件监听器
    shuffleButton.addEventListener("click", createTiles);
    levelUpElement.addEventListener("click", increaseSize);
    levelDownElement.addEventListener("click", decreaseSize);
    switchDataElement.addEventListener("click", switswitchDataView);
    moveModeElement.addEventListener("click", switchMoveMode);
    gameModeElement.addEventListener("click", switchGameMode);
    cursorModeElement.addEventListener("click", switchCursorStyle);
    groupLastElement.addEventListener("click", () => {
        switchGroup(-1);
    });
    groupNextElement.addEventListener("click", () => {
        switchGroup(1);
    });
    scoreListElement.addEventListener("click", redirectToScoreList);
    configCloseElement.addEventListener("click", hideOverlay);
    colorModeElement.addEventListener("click", showOverlay);
    // 初始化拼图
    createTiles();
});

// 为页面添加按键监听
document.addEventListener('keydown', function (event) {
    switch (event.key) {
        case '.':
        case '>':
            // 升阶
            increaseSize();
            break;
        case ',':
        case '<':
            // 降阶
            decreaseSize();
            break;
        case '/':
        case '?':
            switswitchDataView();
            break;
        case ' ':
            // 打乱
            createTiles();
            break;
        case 'w':
        case 'W':
        case "ArrowUp":
            // 向上移动
            moveTileKeyboard("up");
            break;
        case 's':
        case 'S':
        case "ArrowDown":
            // 向下移动
            moveTileKeyboard("down");
            break;
        case 'a':
        case 'A':
        case "ArrowLeft":
            // 向左移动
            moveTileKeyboard("left");
            break;
        case 'd':
        case 'D':
        case "ArrowRight":
            // 向右移动
            moveTileKeyboard("right");
            break;
        case "l":
        case "L":
            // 跳转到成绩列表页
            window.location.href = "scoreList.html";
            break;
        case "M":
        case "m":
            // 切换移动模式
            switchMoveMode();
            break;
        case "N":
        case "n":
            // 切换游戏模式
            switchGameMode();
            break;
        case "c":
        case "C":
            // 切换鼠标指针样式
            switchCursorStyle();
            break;
        case "g":
        case "G":
            // 切换上一组
            switchGroup(-1);
            break;
        case "h":
        case "H":
            // 切换下一组
            switchGroup(1);
            break;

        default:
            break;
    }
});

// 打乱完成后开始计时
// 普通模式——时间 = 计时时间 - 观察时间
// 盲玩模式——时间 = 计时时间
function startTimer() {
    if (!isStart) {
        clearInterval(timerInterval);
        timeEclapsed = 0;
        updateTimerAndStep();
        timerInterval = setInterval(() => {
            timeEclapsed += 10;
            updateTimerAndStep();
        }, 10);
        isStart = true;
    }
}

// 更新计时器、步数、TPS显示
function updateTimerAndStep() {
    // 保存观察时间
    // 当isMoving为false时，表示当前没有移动，此时更新观察时间
    // 当isMoving为true时，表示当前正在移动，此时不更新观察时间
    if (!isMoving) {
        observeTime = timeEclapsed;
    }

    // 计算显示时间
    if (gameMode == "normal") {
        if (isMoving) {
            displayTime = timeEclapsed - observeTime;
        }
        else {
            displayTime = 0;
        }
    }
    else if (gameMode == "blind") {
        displayTime = timeEclapsed;
    }

    // 格式化时间，保留2位小数
    formattedTime = timeFormat(displayTime);
    // 计算tps，保留2位小数
    tps = 0;
    if (displayTime != 0) {
        tps = (step / (displayTime / 1000)).toFixed(2);
    }

    // 显示数据
    timerElement.textContent = ``;
    stepElement.textContent = ``;
    tpsElement.textContent = ``;
    if (showTip == true) {
        timerElement.textContent += `Time: `;
        stepElement.textContent += `Step: `;
        tpsElement.textContent += `TPS: `;
    }
    timerElement.textContent += `${formattedTime}`;
    stepElement.textContent += `${step}`;
    tpsElement.textContent += `${tps}`;
}

// 清除计时
function resetTimer() {
    clearInterval(timerInterval);
    timeEclapsed = 0;
    updateTimerAndStep();
}

// 格式化时间，保留2位小数，参数是毫秒
function timeFormat(originalTime) {
    const seconds = Math.floor(originalTime / 1000);
    const milliseconds = originalTime % 1000;
    return parseFloat(`${seconds}.${milliseconds}`).toFixed(2);
}

// 数据显示模式
function switswitchDataView() {
    if (showTip == true) {
        showTip = false;
        gameModeElement.classList.add("hidden");
        moveModeElement.classList.add("hidden");
        levelUpElement.classList.add("hidden");
        levelDownElement.classList.add("hidden");
        scoreListElement.classList.add("hidden");
        cursorModeElement.classList.add("hidden");
        aboutElement.classList.add("hidden");
        levelShowElement.classList.add("hidden");
        groupElement.classList.add("hidden");
        colorModeElement.classList.add("hidden");
    }
    else {
        showTip = true;
        gameModeElement.classList.remove("hidden");
        moveModeElement.classList.remove("hidden");
        levelUpElement.classList.remove("hidden");
        levelDownElement.classList.remove("hidden");
        scoreListElement.classList.remove("hidden");
        cursorModeElement.classList.remove("hidden");
        aboutElement.classList.remove("hidden");
        levelShowElement.classList.remove("hidden");
        groupElement.classList.remove("hidden");
        colorModeElement.classList.remove("hidden");
    }
    updateTimerAndStep();
}

// 增加阶数
function increaseSize() {
    if (size < 10) {
        console.log("阶数增加");
        size++;
        levelShowElement.textContent = size + "×" + size;
        createTiles();
        saveConfig();
    }
}

// 减少阶数
function decreaseSize() {
    if (size > 2) {
        console.log("阶数减少");
        size--;
        levelShowElement.textContent = size + "×" + size;
        createTiles();
        saveConfig();
    }
}

// 保存成绩
function saveScore(score) {
    // 获取现有总成绩列表
    let scores = JSON.parse(localStorage.getItem('scores')) || [];
    // 确定列表需要：阶数、 游戏模式、分组
    let currentSizeScores = scores.filter(score => score.size == size && score.gameMode === gameMode && score.group === groupNum);
    // 计算序号
    if (currentSizeScores.length == 0) {
        score.number = 1;
    } else {
        score.number = currentSizeScores[currentSizeScores.length - 1].number + 1;
    }
    // 计算5次平均
    if (currentSizeScores.length >= 4) {
        let tempList = [parseFloat(score.time)];
        for (i = 1; i <= 4; i++) {
            tempList.push(parseFloat(currentSizeScores[currentSizeScores.length - i].time));
            score.ao5 = averageOfList(tempList);
        }
    }
    else {
        score.ao5 = "--";
    }
    // 计算12次平均
    if (currentSizeScores.length >= 11) {
        let tempList = [parseFloat(score.time)];
        for (i = 1; i <= 11; i++) {
            tempList.push(parseFloat(currentSizeScores[currentSizeScores.length - i].time));
            score.ao12 = averageOfList(tempList);
        }
    }
    else {
        score.ao12 = "--";
    }

    // 添加新成绩（添加在列表的最后）
    scores.push(score);
    // 保存回 localStorage
    localStorage.setItem('scores', JSON.stringify(scores));
}

// 计算一个列表的去尾平均
function averageOfList(list) {
    list.sort();
    let sum = 0
    for (i = 1; i <= list.length - 2; i++) {
        sum += list[i];
    }
    return (sum / (list.length - 2)).toFixed(2);
}

// 切换移动模式
function switchMoveMode() {
    let currentIndex = moveModeList.indexOf(moveMode);
    moveMode = moveModeList[(currentIndex + 1) % moveModeList.length];
    // 显示模式
    moveModeElement.textContent = moveMode;
    // 重新生成打乱
    createTiles();
    saveConfig();
}

// 切换游戏模式
function switchGameMode() {
    let currentIndex = gameModeList.indexOf(gameMode);
    gameMode = gameModeList[(currentIndex + 1) % gameModeList.length];
    // 显示模式
    gameModeElement.textContent = gameMode;
    // 设置level文本颜色
    if (gameMode == "normal") {
        levelShowElement.style.color = "#482b16";
    }
    else if (gameMode == "blind") {
        levelShowElement.style.color = "#161b48";
    }
    // 重新生成打乱
    createTiles();
    saveConfig();
}

// 调整鼠标样式
function switchCursorStyle() {
    isCustomCursor = !isCustomCursor;
    setCursorStyle(isCustomCursor);
    saveConfig();
}

// 设置光标样式
function setCursorStyle(isCustomCursor) {
    // 显示自定义样式
    if (isCustomCursor) {
        // 添加样式
        document.body.classList.add("custom-cursor");
        moveModeElement.classList.add("custom-pointer");
        gameModeElement.classList.add("custom-pointer");
        levelUpElement.classList.add("custom-pointer");
        levelDownElement.classList.add("custom-pointer");
        shuffleButton.classList.add("custom-pointer");
        switchDataElement.classList.add("custom-pointer");
        scoreListElement.classList.add("custom-pointer");
        cursorModeElement.classList.add("custom-pointer");
        aboutElement.classList.add("custom-pointer");
        groupElement.classList.add("custom-pointer");
        colorModeElement.classList.add("custom-pointer");
        configCloseElement.classList.add("custom-pointer");
        configSaveElement.classList.add("custom-pointer");
    }
    else {
        // 去除样式
        document.body.classList.remove("custom-cursor");
        moveModeElement.classList.remove("custom-pointer");
        gameModeElement.classList.remove("custom-pointer");
        levelUpElement.classList.remove("custom-pointer");
        levelDownElement.classList.remove("custom-pointer");
        shuffleButton.classList.remove("custom-pointer");
        switchDataElement.classList.remove("custom-pointer");
        scoreListElement.classList.remove("custom-pointer");
        cursorModeElement.classList.remove("custom-pointer");
        aboutElement.classList.remove("custom-pointer");
        groupElement.classList.remove("custom-pointer");
        colorModeElement.classList.remove("custom-pointer");
        configCloseElement.classList.remove("custom-pointer");
        configSaveElement.classList.remove("custom-pointer");
    }
}

// 切换分组：next取1或-1
function switchGroup(next) {
    groupNum = (groupNum - 1 + next + 10) % 10 + 1;
    groupNumberElement.textContent = "G" + groupNum;
    saveConfig();
}

// 切换到成绩列表页
function redirectToScoreList() {
    const url = `scoreList.html`;
    window.location.href = url;
}

// 保存配置信息
// 在任意值被改变后调用
function saveConfig() {
    // 获取localStorage中的配置文件
    let config = JSON.parse(localStorage.getItem('config')) || [];
    // 保存当前阶数、游戏模式、移动模式、组号、当前鼠标样式
    config.size = size;
    config.gameMode = gameMode;
    config.moveMode = moveMode;
    config.groupNumber = groupNum;
    config.isCustomCursor = isCustomCursor;
    // 保存到localStorage
    localStorage.setItem("config", JSON.stringify(config));
}

function loadConfig() {
    // 获取localStorage中的配置文件
    let config = JSON.parse(localStorage.getItem('config')) || [];
    // 判断空值
    if (config.length == 0) {
        config = defaultConfig;
        // 保存到localStorage
        localStorage.setItem("config", JSON.stringify(config));
    }
    // 从配置赋值
    gameMode = config.gameMode;
    moveMode = config.moveMode;
    size = config.size;
    isCustomCursor = config.isCustomCursor;
    groupNum = config.groupNumber;
    colorConfig = config.colorConfig;
    saveConfig();
}

// 显示弹框
function showOverlay() {
    configOverlayElement.classList.add('visible');
    configOverlayElement.classList.remove('hidden');
    let tempList = Array.from({ length: 100 }, (_, i) => i + 1);
    renderTiles(previewPuzzle, tempList, 400, 10);
}

// 隐藏弹框
function hideOverlay() {
    configOverlayElement.classList.remove('visible');
    setTimeout(() => {
        configOverlayElement.classList.add('hidden');
    }, 200); // Wait for the animation to finish
    // 重新加载配置和渲染拼图快
    loadConfig();
    createTiles();
}