// 从localStorage获取成绩列表
const scores = JSON.parse(localStorage.getItem('scores')) || [];
// 表格的阶数表头
const sizeInfoElement = document.getElementById("size-info");
// 打乱文本
const scrambleTextElement = document.getElementById("scramble-text");
// puzzle样式
const puzzle = document.getElementById("puzzle");
// 本次还原的信息
const puzzleInfo = document.getElementById("info-container");
// 表格
const tbody = document.getElementById('scores-tbody');
// 表格上方的按钮
const levelUpElement = document.getElementById("level-up");
const levelDownElement = document.getElementById("level-down");
const backElement = document.getElementById("back-to-index");
const switchGameModeElement = document.getElementById("switch-game-mode");
// 引用换组按钮
const groupLastElement = document.getElementById("group-last");
const groupNextElement = document.getElementById("group-next");
// 显示组号
const groupNumberElement = document.getElementById("group-number");
// 整个组号大div，用于隐藏显示
const groupElement = document.getElementById("group");
// 成绩详细页弹框
const overlayElement = document.getElementById("overlay");
// 成绩详细弹框的三个按钮
const overlayCloseElement = document.getElementById("overlay-close-button");
const overlayDeleteElement = document.getElementById("overlay-delete-button");
const overlayReplayElement = document.getElementById("overlay-replay-button");
// 确定弹框
const confirmOverlayElement = document.getElementById("confirm-overlay");
// 清空本组和清空全部的按钮
const deleteGroupElement = document.getElementById("delete-group");
const deleteAllElement = document.getElementById("delete-all");
// 获取th元素
const thElements = document.getElementsByTagName("th");

// 当前显示阶数
let currentSize = 3;
// 当前详细页序号
let currentNumber = 1;
// 游戏模式列表
let gameModeList = ["normal", "blind"];
// 游戏模式
let gameMode = "normal";
// 当前分组
let groupNum = 1;

// 样式配置
// 颜色配置
let colorConfig = defaultColorConfig1;
// 字体比例（取值范围0 - 1.0）：字体大小 = 滑块的边长 * fontSizeRatio
let fontSizeRatio = defaultFontSizeRatio1;
// 间隙大小（取值范围0 - 0.1）
let gapWidthRatio = defaultGapWidthRatio1;
// 圆角大小系数（取值范围0 - 0.5），：圆角大小 = 滑块的边长 * borderRadiusRatio
let borderRadiusRatio = defaultBorderRadiusRatio1;

function displayScores(size) {
    // 修改背景颜色
    if (gameMode == "normal") {
        document.body.style.backgroundColor = "#e6f1eb";
    }
    else if (gameMode == "blind") {
        document.body.style.backgroundColor = "#e6e9f1";
    }

    // 修改表头
    sizeInfoElement.innerHTML = `${size}阶`;

    tbody.innerHTML = ''; // 清空现有内容

    // 确定列表需要：阶数、 游戏模式、分组
    let currentScoreList = scores.filter(score => score != null && score.size == size && score.gameMode === gameMode && score.group == groupNum);

    if (currentScoreList != null) {
        // 找出最大最小值
        let maxTime = Math.max(...currentScoreList.map(score => score.time));
        let minTime = Math.min(...currentScoreList.map(score => score.time));
        let maxStep = Math.max(...currentScoreList.map(score => score.step));
        let minStep = Math.min(...currentScoreList.map(score => score.step));
        let maxTps = Math.max(...currentScoreList.map(score => score.tps));
        let minTps = Math.min(...currentScoreList.map(score => score.tps));
        let maxAo5 = Math.max(...(currentScoreList.map(score => score.ao5)).filter(item => item != "--"));
        let minAo5 = Math.min(...(currentScoreList.map(score => score.ao5)).filter(item => item != "--"));
        let maxAo12 = Math.max(...(currentScoreList.map(score => score.ao12)).filter(item => item != "--"));
        let minAo12 = Math.min(...(currentScoreList.map(score => score.ao12)).filter(item => item != "--"));
        // 在html绘制表格
        currentScoreList.slice().reverse().forEach(score => {
            let row = document.createElement('tr');
            let numberTd = document.createElement("td");
            let timeTd = document.createElement("td");
            let stepTd = document.createElement("td");
            let tpsTd = document.createElement("td");
            let ao5Td = document.createElement("td");
            let ao12Td = document.createElement("td");
            numberTd.textContent = score.number;
            timeTd.textContent = score.time;
            stepTd.textContent = score.step;
            tpsTd.textContent = score.tps;
            ao5Td.textContent = score.ao5;
            ao12Td.textContent = score.ao12;
            // 判断最值并修改颜色
            if (score.time == minTime) {
                timeTd.style.color = "#11a711";
                timeTd.style.fontWeight = "bold";
            } else if (score.time == maxTime) {
                timeTd.style.color = "#daa034";
                timeTd.style.fontWeight = "bold";
            }
            if (score.step == minStep) {
                stepTd.style.color = "#11a711";
                stepTd.style.fontWeight = "bold";
            } else if (score.step == maxStep) {
                stepTd.style.color = "#daa034";
                stepTd.style.fontWeight = "bold";
            }
            if (score.tps == maxTps) {
                tpsTd.style.color = "#11a711";
                tpsTd.style.fontWeight = "bold";
            } else if (score.tps == minTps) {
                tpsTd.style.color = "#daa034";
                tpsTd.style.fontWeight = "bold";
            }
            if (score.ao5 == minAo5) {
                ao5Td.style.color = "#11a711";
                ao5Td.style.fontWeight = "bold";
            } else if (score.ao5 == maxAo5) {
                ao5Td.style.color = "#daa034";
                ao5Td.style.fontWeight = "bold";
            }
            if (score.ao12 == minAo12) {
                ao12Td.style.color = "#11a711";
                ao12Td.style.fontWeight = "bold";
            } else if (score.ao12 == maxAo12) {
                ao12Td.style.color = "#daa034";
                ao12Td.style.fontWeight = "bold";
            }

            // 加入子元素
            row.appendChild(numberTd);
            row.appendChild(timeTd);
            row.appendChild(stepTd);
            row.appendChild(tpsTd);
            row.appendChild(ao5Td);
            row.appendChild(ao12Td);
            tbody.appendChild(row);
            // 添加鼠标监听
            row.addEventListener("click", function () {
                showScramble(size, score.number);
            });
        });
    }
    // 保存当前列表，用于绘制图表
    localStorage.setItem("currentScoreList", JSON.stringify(currentScoreList));
    // 末尾行
    let endRow = document.createElement('tr');
    let tip = document.createElement("td");
    tip.colSpan = document.querySelectorAll('thead th').length;; // 设置单元格跨越的列数

    // currentScoreList不会为null，至少有[]
    if (currentScoreList.length > 0) {
        tip.textContent = "下面没有了╮(╯▽╰)╭";
        tip.title = "No more down here ¯_(ツ)_/¯";
    } else {
        tip.textContent = "还没有成绩哦(｡•́︿•̀｡)";
        tip.title = "No scores yet (｡•́︿•̀｡)";
    }
    endRow.appendChild(tip);
    tbody.appendChild(endRow);
}

function changeSize(direction) {
    currentSize += direction;
    if (currentSize < 2) {
        currentSize = 2;
    } else if (currentSize > 10) {
        currentSize = 10;
    }
    displayScores(currentSize);
    saveConfig();
    renderChart();
}

// 快捷键
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case ',':
        case '<':
        case 'S':
        case 's':
            // 显示低一阶成绩
            changeSize(-1);
            // 隐藏弹框
            hideOverlay();
            break;
        case '.':
        case '>':
        case 'W':
        case 'w':
            // 显示高一阶成绩
            changeSize(1);
            // 隐藏弹框
            hideOverlay();
            break;
        case 'N':
        case 'n':
            switchGameMode();
            // 隐藏弹框
            hideOverlay();
            break;
        case 'L':
        case 'l':
            // 返回index页
            window.location.href = "puzzle.html";
            break;
        case 'Escape':
            // 隐藏弹框
            hideOverlay();
            hideConfirmOverlay();
            break;
        case "a":
        case "A":
            // 切换上一组
            switchGroup(-1);
            break;
        case "d":
        case "D":
            // 切换下一组
            switchGroup(1);
            break;
        default:
            break;
    }
});

// 加载完成后
document.addEventListener("DOMContentLoaded", () => {
    // 设置整体字体大小和行高
    document.documentElement.style.fontSize = window.innerWidth / 112.5 + "px";
    document.documentElement.style.lineHeight = window.innerHeight / 112.5 + "px";
    // 隐藏确认弹框
    hideConfirmOverlay();

    // 获取localStorage中的配置文件
    let config = JSON.parse(localStorage.getItem('config')) || [];
    // 判断空值
    if (config.length == 0) {
        config = defaultConfig;
    }
    // 从配置赋值
    gameMode = config.gameMode;
    currentSize = config.size;
    groupNum = config.groupNumber;
    colorConfig = config.styleConfig.colorConfig;
    fontSizeRatio = config.styleConfig.fontSizeRatio;
    borderRadiusRatio = config.styleConfig.borderRadiusRatio;
    gapWidthRatio = config.styleConfig.gapWidthRatio;
    // 更新显示内容
    groupNumberElement.textContent = "G" + groupNum;
    switchGameModeElement.textContent = gameMode;
    changeHeaderColor();
    // 显示图表
    renderChart();
    // 添加监听
    // 切换游戏模式按钮
    switchGameModeElement.addEventListener("click", switchGameMode);
    // 初始显示列表
    displayScores(currentSize);
    // 升阶和降阶按钮
    levelUpElement.addEventListener("click", () => {
        changeSize(1);
    })
    levelDownElement.addEventListener("click", () => {
        changeSize(-1);
    })
    // 换组按钮
    groupLastElement.addEventListener("click", () => {
        switchGroup(-1);
    });
    groupNextElement.addEventListener("click", () => {
        switchGroup(1);
    });
    // 返回按钮
    backElement.addEventListener("click", redirectToindex);
    // 关闭弹框按钮
    overlayCloseElement.addEventListener("click", hideOverlay);
    document.getElementById("confirm-overlay-cancel-button").addEventListener("click", hideConfirmOverlay);
    // 删除单次成绩按钮
    overlayDeleteElement.addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定删除本次成绩？";
        document.getElementById("confirm-info").title = "Confirm delete this score?";
        document.getElementById("confirm-overlay-confirm-button").addEventListener("click", deleteScore);
    });

    // 删除本组按钮
    deleteGroupElement.addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定删除本组成绩？";
        document.getElementById("confirm-info").title = "Confirm delete this group's scores?";
        document.getElementById("confirm-overlay-confirm-button").addEventListener("click", deleteGroupScores);
    });
    // 删除所有成绩
    deleteAllElement.addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定删除全部成绩？";
        document.getElementById("confirm-info").title = "Confirm delete all scores?";
        document.getElementById("confirm-overlay-confirm-button").addEventListener("click", deleteAllScores);
    });

    // 打开录像回放
    overlayReplayElement.addEventListener("click", () => {
        window.location.href = "replay.html";
    });
});

// 显示本局信息
function showScramble(size, number) {
    currentNumber = number;
    const scores = JSON.parse(localStorage.getItem('scores')) || [];
    // 找到scores中对应的行
    const score = scores.find(s => s.size === size && s.number === number && s.gameMode === gameMode && s.group === groupNum);
    // 存储当前查看的score
    localStorage.setItem('currentScore', JSON.stringify(score));
    // 获取打乱数组
    const scrambleList = score.scramble.split(',');
    // 弹框中显示打乱
    renderTiles(puzzle, scrambleList, 18, currentSize, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
    // 弹框中显示当局信息
    showInfo(score);
    // 显示弹框
    showOverlay();
}


// 显示当局信息
function showInfo(score) {
    document.getElementById("time-info").textContent = score.time + "s";
    document.getElementById("date-info").textContent = score.dateTime;
    document.getElementById("observe-time-info").textContent = timeFormat(score.observeTime) + "s";
    document.getElementById("manhattan-distance-info").textContent = score.manhattanDistance;
    document.getElementById("game-mode-info").textContent = score.gameMode;
    document.getElementById("move-mode-info").textContent = score.moveMode;
    document.getElementById("step-info").textContent = score.step;
    document.getElementById("TPS-info").textContent = score.tps;
    document.getElementById("ao5-info").textContent = score.ao5 == "--" ? "--" : score.ao5 + "s";
    document.getElementById("ao12-info").textContent = score.ao12 == "--" ? "--" : score.ao12 + "s";
}

// 切换游戏模式
function switchGameMode() {
    let currentIndex = gameModeList.indexOf(gameMode);
    gameMode = gameModeList[(currentIndex + 1) % gameModeList.length];
    switchGameModeElement.textContent = gameMode;
    // 更改表头颜色
    changeHeaderColor();
    // 重新渲染表格
    displayScores(currentSize);
    saveConfig();
    renderChart();
}

// 根据游戏模式更改表头颜色
function changeHeaderColor() {
    if (gameMode == "normal") {
        for (var i = 0; i < thElements.length; i++) {
            thElements[i].style.backgroundColor = "#103816";
        }
    }
    else if (gameMode == "blind") {
        for (var i = 0; i < thElements.length; i++) {
            thElements[i].style.backgroundColor = "#141845";
        }
    }
}

// 显示弹框
function showOverlay() {
    overlayElement.classList.add('visible');
    overlayElement.classList.remove('hidden');
}

// 隐藏弹框
function hideOverlay() {
    overlayElement.classList.remove('visible');
    setTimeout(() => {
        overlayElement.classList.add('hidden');
    }, 200); // Wait for the animation to finish
}

// 显示确认弹框
function showConfirmOverlay() {
    confirmOverlayElement.classList.remove('hidden');
}

// 隐藏确认弹框
function hideConfirmOverlay() {
    confirmOverlayElement.classList.add('hidden');
}

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

// 切换分组：next取1或-1
function switchGroup(next) {
    groupNum = (groupNum - 1 + next + 10) % 10 + 1;
    groupNumberElement.textContent = "G" + groupNum;
    displayScores(currentSize);
    saveConfig();
    renderChart();
}

// 切换到puzzle页
function redirectToindex() {
    const url = `puzzle.html`;
    window.location.href = url;
}

// 删除当前指定成绩并更新序号
function deleteScore() {
    // 获取特定成绩列表
    let filteredScores = scores.filter(score => score != null && score.size === currentSize && score.gameMode === gameMode && score.group === groupNum);

    // 找到需要删除的成绩索引
    const index = filteredScores.findIndex(score => score != null && score.number === currentNumber);

    if (index !== -1) {
        // 删除特定成绩
        filteredScores.splice(index, 1);

        // 更新剩余成绩的序号
        for (let i = index; i < filteredScores.length; i++) {
            filteredScores[i].number = i + 1; // 序号从1开始
        }

        // 更新原始 scores 列表
        const updatedScores = scores.map(score => {
            if (score != null && score.size === currentSize && score.gameMode === gameMode && score.group === groupNum) {
                return filteredScores.shift();
            }
            return score;
        });

        // 去除updatedScores里的null数据
        updatedScores.forEach((score, index) => { if (score == null) updatedScores.splice(index, 1); });

        // 保存更新后的成绩列表到 LocalStorage
        localStorage.setItem('scores', JSON.stringify(updatedScores));

        // 刷新页面
        window.location.reload();
        renderChart();
        console.log('成绩删除并更新成功');
    } else {
        console.log('未找到指定的成绩');
    }
}

// 删除当前指定组的所有成绩
function deleteGroupScores() {
    // 过滤出不属于当前组的成绩
    const updatedScores = scores.filter(score => {
        return !(score != null && score.size === currentSize && score.gameMode === gameMode && score.group === groupNum);
    });

    // 保存更新后的成绩列表到 LocalStorage
    localStorage.setItem('scores', JSON.stringify(updatedScores));

    renderChart();
    // 刷新页面
    window.location.reload();
    console.log('当前组的成绩删除并更新成功');
}

// 清空所有成绩
function deleteAllScores() {
    localStorage.removeItem('scores');
    renderChart();
    window.location.reload();
}

// 保存配置信息
// 在任意值被改变后调用
function saveConfig() {
    // 获取localStorage中的配置文件
    let config = JSON.parse(localStorage.getItem('config')) || [];
    // 保存当前阶数、游戏模式、移动模式、组号、当前鼠标样式
    config.size = currentSize;
    config.gameMode = gameMode;
    config.groupNumber = groupNum;
    // 保存到localStorage
    localStorage.setItem("config", JSON.stringify(config));
}

// 格式化时间，保留2位小数，参数是毫秒
function timeFormat(originalTime) {
    const seconds = Math.floor(originalTime / 1000);
    const milliseconds = originalTime % 1000;
    return parseFloat(`${seconds}.${milliseconds}`).toFixed(2);
}