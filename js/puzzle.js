// 引用拼图荣去
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
// 定义拼图的阶数（边长）
let size = 4;
// 用于存储拼图块的数组
let tiles = [];
// 计时
let timerInterval;
let timeEclapsed = 0;
// 是否开始还原
let isMoving = false;
// 步数
let step = 0;
// 数据显示模式：是否显示提示信息：例如显示 ”步数：98“ 还是 ”98“
let showTip = false;


// 颜色字典，按层降阶，即从左上到右下
const colorMap = {
    0: "#f0f0f0", // 同网页背景色
    1: "#e74c3c", // 红色
    2: "#e67e22", // 橙色
    3: "#f1c40f", // 黄色
    4: "#2ecc71", // 绿色
    5: "#1abc9c", // 青色
    6: "#3498db", // 蓝色
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

// 根据数字返回对应的颜色，默认为66ccff
// number为0-15，0为空白格，number和显示出来的数字是一样的
function getColor(number) {
    number--;
    // 获取行列号（从0开始）
    row = Math.floor(number / size);
    line = number % size;
    // 以左上到右下的对角线分为上三角和下三角
    // 上三角或对角线
    if (line >= row) {
        return colorMap[2 * row + 1] || "#66ccff";
    }
    // 下三角
    else {
        return colorMap[(line + 1) * 2] || "#66ccff";
    }
}

// 创建并初始化拼图块
function createTiles() {
    // 重置步数
    step = 0;
    // 清除计时
    resetTimer();
    // 生成数组并打乱
    scramble();
    // 渲染拼图块
    renderTiles();

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
}


// 渲染拼图块
function renderTiles() {
    puzzle.innerHTML = ''; // 清空拼图容器
    puzzle.style.gridTemplateColumns = "repeat(" + size + ", 1fr)"
    // 遍历每个拼图块
    tiles.forEach((tile, index) => {
        const tileElement = document.createElement("div"); // 创建一个新的div元素
        tileElement.classList.add("tile"); // 添加样式类
        tileElement.style.width = 500 / size + "px";
        tileElement.style.height = 500 / size + "px";
        tileElement.style.fontSize = 250 / size + "px";

        if (tile !== 0) { // 如果拼图块不是空白块
            tileElement.textContent = tile; // 设置拼图块的文本
            tileElement.style.backgroundColor = getColor(tile); // 设置拼图块的背景颜色
            // 为拼图块添加鼠标移入事件监听器
            tileElement.addEventListener("mouseover", () => moveTileMouse(index));
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
        // 首次移动启用计时器
        startTimer();
    }
    // 当前块与空白块在同一列
    else if (line1 == line0 && row1 != row0) {
        move(row1 < row0 ? -size : size); // 上为-size，下为size
        // 首次移动启用计时器
        startTimer();
    }

    // 重新渲染拼图块
    renderTiles();
    // 检查是否拼图成功
    checkWin();
}

// 键盘移动方法
// 传入参数：up、down、left、right
function moveTileKeyboard(direction) {
    // 获取空白快的坐标
    zeroIndex = tiles.indexOf(0);
    const [line0, row0] = [zeroIndex % size, Math.floor(zeroIndex / size)];
    switch (direction) {
        case "up":
            if (row0 <= size - 2) {
                [tiles[zeroIndex], tiles[zeroIndex + size]] = [tiles[zeroIndex + size], tiles[zeroIndex]];
                step++;
                // 首次移动启用计时器
                startTimer();
            }
            break;
        case "down":
            if (row0 >= 1) {
                [tiles[zeroIndex], tiles[zeroIndex - size]] = [tiles[zeroIndex - size], tiles[zeroIndex]];
                step++;
                // 首次移动启用计时器
                startTimer();
            }
            break;
        case "left":
            if (line0 <= size - 2) {
                [tiles[zeroIndex], tiles[zeroIndex + 1]] = [tiles[zeroIndex + 1], tiles[zeroIndex]];
                step++;
                // 首次移动启用计时器
                startTimer();
            }
            break;
        case "right":
            if (line0 >= 1) {
                [tiles[zeroIndex], tiles[zeroIndex - 1]] = [tiles[zeroIndex - 1], tiles[zeroIndex]];
                step++;
                // 首次移动启用计时器
                startTimer();
            }
            break;
        default:
            break;
    }
    // 重新渲染拼图块
    renderTiles();
    // 检查是否拼图成功
    checkWin();
}



// 检查是否拼图成功
function checkWin() {
    // 如果拼图块按顺序排列
    if (tiles.slice(0, -1).every((tile, i) => tile === i + 1)) {
        clearInterval(timerInterval); // 停止计时器
        // alert("You win!"); // 弹出胜利提示

        // 记录成绩
        const score = {
            size: size,
            time: parseFloat(timerElement.textContent),
            step: step,
            tps: parseFloat(tpsElement.textContent)
        };
        saveScore(score);
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
    // 为打乱按钮添加点击事件监听器
    shuffleButton.addEventListener("click", createTiles);
    // 为阶数按钮添加监听
    levelUpElement.addEventListener("click", increaseSize);
    levelDownElement.addEventListener("click", decreaseSize);
    // 为switchDataElement添加监听
    switchDataElement.addEventListener("click", switswitchDataView);
    createTiles(); // 初始化拼图
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
        default:
            break;
    }
});

// 开始计时
function startTimer() {
    // 首次移动后开始计时
    if (!isMoving) {
        clearInterval(timerInterval);
        timeEclapsed = 0;
        updateTimerAndStep();
        timerInterval = setInterval(() => {
            timeEclapsed += 10;
            updateTimerAndStep();
        }, 10);
        isMoving = true;
    }
}

// 更新计时器、步数、TPS显示
function updateTimerAndStep() {
    const seconds = Math.floor(timeEclapsed / 1000);
    const milliseconds = timeEclapsed % 1000;
    // 格式化时间，保留2位小数
    let time = `${seconds}.${milliseconds}`;
    let formattedTime = parseFloat(time).toFixed(2);
    // 计算tps，保留3位小数
    let tps = 0;
    if (timeEclapsed != 0) {
        tps = (step / (timeEclapsed / 1000)).toFixed(2);
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
    isMoving = false;
}

// 数据显示模式
function switswitchDataView() {
    if (showTip == true) {
        showTip = false;
    }
    else {
        showTip = true;
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
    }
}

// 减少阶数
function decreaseSize() {
    if (size > 2) {
        console.log("阶数减少");
        size--;
        levelShowElement.textContent = size + "×" + size;
        createTiles();
    }
}

// 保存成绩
function saveScore(score) {
    // 获取现有成绩列表
    let scores = JSON.parse(localStorage.getItem('scores')) || [];
    // 计算5次平均
    if (scores.length >= 4) {
        let sum5 = parseFloat(score.time);
        for (i = 1; i <= 4; i++) {
            sum5 += parseFloat(scores[scores.length - i].time);
            score.ao5 = (sum5 / 5).toFixed(2);
        }
    }
    else {
        score.ao5 = "--";
    }
    // 计算12次平均
    if (scores.length >= 11) {
        let sum12 = parseFloat(score.time);
        for (i = 1; i <= 11; i++) {
            sum12 += parseFloat(scores[scores.length - i].time);
        }
        score.ao12 = (sum12 / 12).toFixed(2);
    }
    else {
        score.ao12 = "--";
    }

    // 添加新成绩（添加在列表的最后）
    scores.push(score);
    // 保存回 localStorage
    localStorage.setItem('scores', JSON.stringify(scores));
}