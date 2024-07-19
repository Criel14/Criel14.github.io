const sizeInfoElement = document.getElementById("size-info");
const overlayElement = document.getElementById("overlay");
const scrambleTextElement = document.getElementById("scramble-text");
const puzzle = document.getElementById("puzzle");
const puzzleInfo = document.getElementById("info-container");
const tableHead = document.getElementById("scores-head");
const tbody = document.getElementById('scores-tbody');
const scores = JSON.parse(localStorage.getItem('scores')) || [];
const levelUpElement = document.getElementById("level-up");
const levelDownElement = document.getElementById("level-down");
// 当前显示阶数
let currentSize = 3;

// 游戏模式列表
let gameModeList = ["normal", "blind"];
// 游戏模式
let gameMode = "normal";

function displayScores(size) {
    // 修改背景颜色
    if (gameMode == "normal") {
        document.body.style.backgroundColor = "#f0f0f0";
    }
    else if (gameMode == "blind") {
        document.body.style.backgroundColor = "#e6e9f1";
    }

    // 修改表头
    sizeInfoElement.innerHTML = `${size}阶` + "-" + gameMode + "&nbsp;&nbsp;⇋";
    tableHead.addEventListener("click", switchGameMode);

    tbody.innerHTML = ''; // 清空现有内容

    scores.filter(score => score.size == size && score.gameMode === gameMode).reverse().forEach(score => {
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
    let endRow = document.createElement('tr');
    let tip = document.createElement("td");
    tip.colSpan = document.querySelectorAll('thead th').length;; // 设置单元格跨越的列数
    tip.textContent = "下面没有了╮(╯▽╰)╭"
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
}

document.addEventListener('keydown', (event) => {
    if (event.key === ',' || event.key === '<') {
        changeSize(-1); // 显示低一阶成绩
        hideOverlay(); // 隐藏弹框
    }
    else if (event.key === '.' || event.key === '>') {
        changeSize(1); // 显示高一阶成绩
        hideOverlay(); // 隐藏弹框
    }
    else if (event.key === 'N' || event.key === "n") {
        switchGameMode();
        hideOverlay(); // 隐藏弹框
    }
    else if (event.key === 'c' || event.key === 'C') {
        localStorage.removeItem("scores"); // 清空成绩
        // 刷新页面
        location.reload();
    }
    else if (event.key === 'l' || event.key === 'L') {
        // 返回index页
        window.location.href = "index.html";
    }
    else if (event.key === 'Escape') {
        hideOverlay(); // 隐藏弹框
    }
});

document.addEventListener("DOMContentLoaded", () => {
    displayScores(currentSize); // 初始显示3阶成绩
    // 升阶和降阶按钮
    levelUpElement.addEventListener("click", () => {
        changeSize(1);
    })
    levelDownElement.addEventListener("click", () => {
        changeSize(-1);
    })
});

// 显示打乱
function showScramble(size, number) {
    const scores = JSON.parse(localStorage.getItem('scores')) || [];
    // 找到scores中对应的行
    const score = scores.find(s => s.size === size && s.number === number && s.gameMode === gameMode);
    // 获取打乱数组
    const scrambleList = score.scramble.split(',');
    // 弹框中显示打乱
    renderTiles(size, scrambleList);
    // 弹框中显示当局信息
    showInfo(size, score);
    // 显示弹框
    showOverlay();
}


// 显示当局信息
function showInfo(size, score) {
    // 清空容器
    puzzleInfo.innerHTML = '';
    // 设置高度
    puzzleInfo.style.height = 300 + 5 * (size - 1) + "px";
    // 显示时间
    timeInfo = document.createElement("p");
    timeInfo.textContent = score.time + "s";
    timeInfo.classList.add("time-info");
    puzzleInfo.appendChild(timeInfo);
    // 显示模式
    modeInfo = document.createElement("p");
    modeInfo.textContent = score.gameMode + "-" + score.moveMode;
    modeInfo.classList.add("move-mode-info");
    puzzleInfo.appendChild(modeInfo);
    // 显示步数
    stepInfo = document.createElement("p");
    stepInfo.textContent = "Step: " + score.step;
    stepInfo.classList.add("other-info");
    puzzleInfo.appendChild(stepInfo);
    // 显示TPS
    tpsInfo = document.createElement("p");
    tpsInfo.textContent = "TPS: " + score.tps;
    tpsInfo.classList.add("other-info");
    puzzleInfo.appendChild(tpsInfo);
    // 显示ao5
    ao5Info = document.createElement("p");
    ao5Info.textContent = "ao5: " + score.ao5;
    ao5Info.classList.add("ao-info");
    puzzleInfo.appendChild(ao5Info);
    // 显示ao12
    ao12Info = document.createElement("p");
    ao12Info.textContent = "ao12: " + score.ao12;
    ao12Info.classList.add("ao-info");
    puzzleInfo.appendChild(ao12Info);
}

// 切换游戏模式
function switchGameMode() {
    let currentIndex = gameModeList.indexOf(gameMode);
    gameMode = gameModeList[(currentIndex + 1) % gameModeList.length];
    // 重新渲染表格
    displayScores(currentSize);
}

// 显示弹框
function showOverlay() {
    overlayElement.classList.remove('hidden');
}

// 隐藏弹框
function hideOverlay() {
    overlayElement.classList.add('hidden');
}

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
function getColor(size, number) {
    number--;
    // 获取行列号（从0开始）
    row = Math.floor(number / size);
    line = number % size;
    // 以左上到右下的对角线分为上三角和下三角
    // 上三角或对角线
    if (line >= row) {
        return colorMap[2 * row + 1] || "white";
    }
    // 下三角
    else {
        return colorMap[(line + 1) * 2] || "white";
    }
}

// 渲染拼图块
// 参数：阶数，打乱序列
function renderTiles(size, puzzleList) {
    puzzle.innerHTML = ''; // 清空拼图容器
    puzzle.style.gridTemplateColumns = "repeat(" + size + ", 1fr)"
    // 遍历每个拼图块
    puzzleList.forEach((tile) => {
        const tileElement = document.createElement("div"); // 创建一个新的div元素
        tileElement.classList.add("tile"); // 添加样式类
        tileElement.style.width = 300 / size + "px";
        tileElement.style.height = 300 / size + "px";
        tileElement.style.fontSize = 150 / size + "px";

        if (tile !== 0) { // 如果拼图块不是空白块
            tileElement.textContent = tile; // 设置拼图块的文本
            tileElement.style.backgroundColor = getColor(size, tile); // 设置拼图块的背景颜色
        }
        puzzle.appendChild(tileElement); // 将拼图块添加到拼图容器中
    });
}