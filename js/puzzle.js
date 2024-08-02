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
const colorConfigOverlayElement = document.getElementById("config-overlay");
// 关闭设置弹框按钮
const colorConfigCloseElement = document.getElementById("config-overlay-close-button");
// 保存配置按钮
const colorConfigSaveElement = document.getElementById("config-overlay-save-button");
// 改色界面的预览puzzle
const previewPuzzle = document.getElementById("preview-puzzle");
// 所有class为color-input的元素
const colorInputs = document.getElementsByClassName("color-input");
// 所有class为font-color-input的元素
const fontColorInputs = document.getElementsByClassName("font-color-input");
// 切换颜色预设按钮
const colorConfigPreset1Element = document.getElementById("config-overlay-preset1-button");
const colorConfigPreset2Element = document.getElementById("config-overlay-preset2-button");
// 调节size的滑块input
const sizeInputs = document.getElementsByClassName("size-input");
// 显示滑块的值
const sizeInfoElements = document.getElementsByClassName("size-info");
// 确认页面的按钮
const confirmButtonElement = document.getElementById("confirm-overlay-confirm-button");
const cancelButtonElement = document.getElementById("confirm-overlay-cancel-button");
// 底部开源说明
const footInfoElement = document.getElementById("foot-info");

// 配置界面
const configContentElement = document.getElementById("config-overlay-content");
// 颜色菜单
const colorMenu = document.getElementById("color-menu");
// 字体颜色菜单
const fontColorMenu = document.getElementById("font-color-menu");
// 大小菜单
const sizeMenu = document.getElementById("size-menu");
// 预设/保存菜单
const saveMenu = document.getElementById("save-menu");

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
// 纪录观察时间
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
// 是否允许操作，用于启用或禁用操作，在设置界面使用
let isAllowOperate = true;
// 移动序列，记录本次还原的操作
let moveSequence = [];
// 是否的重玩模式
let isRetry = false;
// 在配置页面是否做了修改
let isChangeConfig = false;

// 样式配置
// 颜色配置
let colorConfig = defaultColorConfig1;
// 字体颜色配置
let fontColorConfig = defaultFontColorConfig1;
// 字体比例（取值范围0 - 1.0）：字体大小 = 滑块的边长 * fontSizeRatio
let fontSizeRatio = defaultFontSizeRatio1;
// 间隙大小（取值范围0 - 0.1）
let gapWidthRatio = defaultGapWidthRatio1;
// 圆角大小系数（取值范围0 - 0.5），：圆角大小 = 滑块的边长 * borderRadiusRatio
let borderRadiusRatio = defaultBorderRadiusRatio1;
// 游玩时候的拼图快总边长
let edgeLength = 27; // vw
// 曼哈顿距离
let manhattanDistance = 0
// 背景色
let lightNormalBackgroundColor = "#e6f1eb";
let lightBlindBackgroundColor = "#e6e9f1";
let darkBackgroundColor = "#222222";
let lightLevelNormalFontColor = "#093009";
let lightLevelBlindFontColor = "#161b48";
let darkLevelFontColor = "#ffffff";


// 移动模式列表
let moveModeList = ["click", "slide", "keyboard"];

// 游戏模式列表
let gameModeList = ["normal", "blind"];


// 根据数字返回对应的方块颜色颜色，默认为#ffffff
// number为0至size*size -1，0为空白格，number和显示出来的数字是一样的
function getColor(number, size) {
    return colorConfig[getLayer(number, size)] || "#ffffff";
}

// 返回字体颜色
function getFontColor(number, size) {
    return fontColorConfig[getLayer(number, size)] || "#ffffff";
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
    // 修改背景颜色
    if (gameMode == "normal") {
        document.body.style.backgroundColor = lightNormalBackgroundColor;
    }
    else if (gameMode == "blind") {
        document.body.style.backgroundColor = lightBlindBackgroundColor;
    }
    // document.body.style.backgroundColor = darkBackgroundColor;

    isFinish = false;
    isStart = false;
    isMoving = false;
    moveSequence = [];
    // 启用操作
    isAllowOperate = true;
    // 重置步数
    step = 0;
    // 清除计时
    resetTimer();
    // 生成数组并打乱
    scramble();
    // 渲染拼图块
    renderTiles(puzzle, tiles, edgeLength, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
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
    // 重玩模式下，打乱永远不变
    if (isRetry == true) {
        scrambleTiles = Array.from(JSON.parse(localStorage.getItem("currentScore")).scramble.split(",")).map(Number);
        tiles = Array.from(scrambleTiles);
        return;
    }

    // 当打乱符合条件的时候再退出循环
    while (true) {
        // 随机打乱
        tiles = Array.from({ length: size * size }, (_, i) => i);
        for (let i = tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }

        // 如果曼哈顿距离小于size * size就重新打乱
        manhattanDistance = calculateManhattanDistance(tiles, size);
        if (manhattanDistance < size * size) {
            continue;
        }
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
function renderTiles(puzzle, tiles, edgeLength, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio) {
    // 计算滑块边长
    let tileLength = edgeLength / size;
    // 清空拼图容器
    puzzle.innerHTML = '';
    puzzle.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
    puzzle.style.gap = tileLength * gapWidthRatio + "vw";
    puzzle.addEventListener("touchstart", touchMove, false);
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
            // 盲玩模式，开始移动，未完成，不是在配置状态，则渲染为蓝色
            if (gameMode == "blind" && isStart == true && isFinish == false && isAllowOperate == true) {
                tileElement.style.backgroundColor = "#66ccff"; // 设置拼图块的背景颜色
            }
            else {
                tileElement.textContent = tile; // 设置拼图块的文本
                tileElement.style.color = getFontColor(tile, size); // 设置拼图块的字体颜色
                tileElement.style.backgroundColor = getColor(tile, size); // 设置拼图块的背景颜色
            }
            // 为拼图块添加事件监听器
            if (moveMode == "click") {
                tileElement.addEventListener("click", (e) => moveTileMouse(e, index));
            }
            else if (moveMode == "slide") {
                tileElement.addEventListener("mouseover", (e) => moveTileMouse(e, index));
            }
            // 设置界面添加监听事件
            // 鼠标放在某一行/列，这一行的颜色调整input就突出显示
            // 点击则实现显示颜色选择器
            if (!isAllowOperate) {
                tileElement.addEventListener("mouseenter", () => {
                    colorInputs[getLayer(tile, size) - 1].style.borderColor = "#000000";
                    fontColorInputs[getLayer(tile, size) - 1].style.borderColor = "#000000";
                });
                tileElement.addEventListener("mouseleave", () => {
                    colorInputs[getLayer(tile, size) - 1].style.borderColor = "#e1e1e1";
                    fontColorInputs[getLayer(tile, size) - 1].style.borderColor = "#e1e1e1";
                });
                tileElement.addEventListener("click", () => {
                    colorInputs[getLayer(tile, size) - 1].jscolor.show();
                });
            }
        }
        // 所有块包括0，都要添加上这个监听
        if (moveMode == "slide") {
            tileElement.addEventListener("touchmove", touchMove, false);
        }
        // 添加胜利效果
        if (isFinish == true) {
            // 发光一定时间
            tileElement.style.boxShadow = "0 0 100px #ffff5d40";
            setTimeout(() => { tileElement.style.boxShadow = "none"; }, 500);
        }
        puzzle.appendChild(tileElement); // 将拼图块添加到拼图容器中
    });
}

// 触摸屏移动方法
function touchMove(e) {
    e.preventDefault();
    let touch = e.touches[0];
    let elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elementUnderFinger.dataset != null) {
        moveTileMouse(e, elementUnderFinger.dataset.index);
    }
}

// 鼠标移动方法
function moveTileMouse(e, index) {
    if (!isAllowOperate) {
        return;
    }
    // 阻止事件的默认行为和事件的冒泡 => 事件不会触发任何默认的浏览器行为，也不会向上冒泡到父元素
    e.preventDefault();
    e.stopPropagation();

    let zeroIndex = tiles.indexOf(0); // 找到空白块的位置
    const [line1, row1] = [index % size, Math.floor(index / size)]; // 计算当前拼图块的坐标
    const [line0, row0] = [zeroIndex % size, Math.floor(zeroIndex / size)]; // 计算空白块的坐标

    // 移动整行或整列，flag为移动一块后，空白快位置的偏移量
    function move(flag, direction) {
        while (index != zeroIndex) {
            const newIndex = zeroIndex + flag;
            // 检查新的索引是否在范围内
            if (newIndex < 0 || newIndex >= tiles.length) {
                console.error("移动超出范围！");
                return;
            }
            [tiles[zeroIndex], tiles[newIndex]] = [tiles[newIndex], tiles[zeroIndex]];
            step++;
            zeroIndex = newIndex;
            // 记录移动方向和时间节点
            moveSequence.push({ direction, time: timeEclapsed });
        }
    }

    // 当前块与空白块在同一行
    if (row1 == row0 && line1 != line0) {
        move(line1 < line0 ? -1 : 1, line1 < line0 ? 'R' : 'L'); // 左为-1，右为1
        isMoving = true;
    }
    // 当前块与空白块在同一列
    else if (line1 == line0 && row1 != row0) {
        move(row1 < row0 ? -size : size, row1 < row0 ? 'D' : 'U'); // 上为-size，下为size
        isMoving = true;
    }

    // 重新渲染拼图块
    renderTiles(puzzle, tiles, edgeLength, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
    // 检查是否拼图成功
    checkWin();
}


// 键盘移动方法
// 传入参数：up、down、left、right
function moveTileKeyboard(direction) {
    if (!isAllowOperate || moveMode != "keyboard") {
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
                moveSequence.push("U"); // 记录移动方向
            }
            break;
        case "down":
            if (row0 >= 1) {
                [tiles[zeroIndex], tiles[zeroIndex - size]] = [tiles[zeroIndex - size], tiles[zeroIndex]];
                step++;
                isMoving = true;
                moveSequence.push("D"); // 记录移动方向
            }
            break;
        case "left":
            if (line0 <= size - 2) {
                [tiles[zeroIndex], tiles[zeroIndex + 1]] = [tiles[zeroIndex + 1], tiles[zeroIndex]];
                step++;
                isMoving = true;
                moveSequence.push("L"); // 记录移动方向
            }
            break;
        case "right":
            if (line0 >= 1) {
                [tiles[zeroIndex], tiles[zeroIndex - 1]] = [tiles[zeroIndex - 1], tiles[zeroIndex]];
                step++;
                isMoving = true;
                moveSequence.push("R"); // 记录移动方向
            }
            break;
        default:
            break;
    }
    // 重新渲染拼图块
    renderTiles(puzzle, tiles, edgeLength, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
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
                observeTime: observeTime,
                group: groupNum,
                moveSequence: moveSequence,
                dateTime: new Date().toLocaleString(),
                manhattanDistance: manhattanDistance,
                device: getDeviceType(),
            };
            // 重玩模式下不保存成绩
            if (!isRetry) {
                saveScore(score);
            }
            // 标记完成
            isFinish = true;
        }
        // 重新渲染拼图块
        renderTiles(puzzle, tiles, edgeLength, size, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
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
    // 设置整体字体大小和行高
    document.documentElement.style.fontSize = window.innerWidth / 112.5 + "px";
    document.documentElement.style.lineHeight = window.innerHeight / 112.5 + "px";
    // 隐藏确认框
    hideConfirmOverlay();

    // 获取url中的isRetry参数
    const isRetryParam = new URLSearchParams(window.location.search).get("isRetry");
    // 判断是否获取到参数
    if (isRetryParam === null || isRetryParam === undefined) {
        isRetry = false;
    } else {
        isRetry = (isRetryParam === "true");
    }

    // 读取配置文件
    loadConfig();
    // 显示信息
    gameModeElement.textContent = gameMode;
    moveModeElement.textContent = moveMode;
    levelShowElement.textContent = size + "×" + size;
    if (isRetry == true) {
        levelShowElement.textContent += "Re";
    }
    groupNumberElement.textContent = "G" + groupNum;
    // 更新滑块信息
    setSizeSliderValue();

    // 设置level文本颜色
    if (gameMode == "normal") {
        levelShowElement.style.color = lightLevelNormalFontColor;
    }
    else if (gameMode == "blind") {
        levelShowElement.style.color = lightLevelBlindFontColor;
    }
    // levelShowElement.style.color = darkLevelFontColor;

    // 设置光标样式
    setCursorStyle(isCustomCursor);
    // 启用操作
    isAllowOperate = true;
    // 设置滑块
    for (let index = 0; index < sizeInputs.length; index++) {
        let sizeInput = sizeInputs[index];
        sizeInput.addEventListener("input", () => {
            sizeInfoElements[index].textContent = sizeInput.value + "×";
            // index从0,1,2依次是间隙大小、字体大小、圆角大小
            // 从滑块赋值
            switch (index) {
                case 0:
                    gapWidthRatio = sizeInput.value;
                    isChangeConfig = true;
                    break;
                case 1:
                    fontSizeRatio = sizeInput.value;
                    isChangeConfig = true;
                    break;
                case 2:
                    borderRadiusRatio = sizeInput.value;
                    isChangeConfig = true;
                    break;
                default:
                    break;
            }
            // 重新绘制preview-puzzle
            let tempList = Array.from({ length: 100 }, (_, i) => i + 1);
            renderTiles(previewPuzzle, tempList, 20, 10, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
        });
    }
    // 为按钮添加点击事件监听器
    shuffleButton.addEventListener("click", createTiles);
    levelUpElement.addEventListener("click", increaseSize);
    levelDownElement.addEventListener("click", decreaseSize);
    switchDataElement.addEventListener("click", switswitchDataView);
    moveModeElement.addEventListener("click", switchMoveMode);
    gameModeElement.addEventListener("click", switchGameMode);
    cursorModeElement.addEventListener("click", switchCursorStyle);
    scoreListElement.addEventListener("click", redirectToScoreList);
    colorModeElement.addEventListener("click", showOverlay);
    groupLastElement.addEventListener("click", () => {
        switchGroup(-1);
    });
    groupNextElement.addEventListener("click", () => {
        switchGroup(1);
    });
    colorConfigCloseElement.addEventListener("click", () => {
        if (isChangeConfig) {
            showConfirmOverlay();
            document.getElementById("confirm-info").textContent = "配置未保存，确定退出吗？";
            document.getElementById("confirm-info").title = "Configuration has not been saved, are you sure you want to exit?";
            const oldElement = document.getElementById("confirm-overlay-confirm-button");
            const newElement = oldElement.cloneNode(true);
            oldElement.parentNode.replaceChild(newElement, oldElement);
            newElement.addEventListener("click", () => {
                hideOverlay();
                hideConfirmOverlay();
            });
        } else {
            hideOverlay();
        }
    });
    cancelButtonElement.addEventListener("click", hideConfirmOverlay);
    colorConfigPreset1Element.addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定要加载预设1吗？(将会覆盖当前配置)";
        document.getElementById("confirm-info").title = "Are you sure you want to load Preset 1? (This will overwrite the current configuration)";

        const oldElement = document.getElementById("confirm-overlay-confirm-button");
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);
        newElement.addEventListener("click", () => {
            resetConfig(defaultStyleConfig1);
            hideConfirmOverlay();
        });
    });
    colorConfigPreset2Element.addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定要加载预设2吗？(将会覆盖当前配置)";
        document.getElementById("confirm-info").title = "Are you sure you want to load Preset 2? (This will overwrite the current configuration)";
        const oldElement = document.getElementById("confirm-overlay-confirm-button");
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);
        newElement.addEventListener("click", () => {
            resetConfig(defaultStyleConfig2);
            hideConfirmOverlay();
        });
    })

    // 设置界面的三个按钮
    document.getElementById("config-overlay-color-button").addEventListener("click", () => {
        let originalWidth = configContentElement.style.width;
        configContentElement.style.width = "48vw";
        setTimeout(() => {
            colorMenu.classList.remove("hidden");
            fontColorMenu.classList.remove("hidden");
            sizeMenu.classList.add("hidden");
            saveMenu.classList.add("hidden");
        }, originalWidth == "48vw" ? 0 : 200);
    })
    document.getElementById("config-overlay-size-button").addEventListener("click", () => {
        colorMenu.classList.add("hidden");
        fontColorMenu.classList.add("hidden");
        sizeMenu.classList.remove("hidden");
        saveMenu.classList.add("hidden");
        configContentElement.style.width = "40vw";
    })
    document.getElementById("config-overlay-preset-button").addEventListener("click", () => {
        let originalWidth = configContentElement.style.width;
        configContentElement.style.width = "48vw";
        setTimeout(() => {
            colorMenu.classList.add("hidden");
            fontColorMenu.classList.add("hidden");
            sizeMenu.classList.add("hidden");
            saveMenu.classList.remove("hidden");
        }, originalWidth == "48vw" ? 0 : 200);
    })
    colorConfigSaveElement.addEventListener("click", () => {
        if (isChangeConfig) {
            // 显示提示
            new NoticeJs({
                title: '当前方案保存成功',
                text: 'The current scheme has been successfully saved.',
                type: 'success',
                position: 'topCenter',
                width: Math.floor(window.innerWidth / 112.5 * 35),
            }).show();
            saveConfig();
            hideOverlay();
        } else {
            // 显示提示
            new NoticeJs({
                title: '方案未修改',
                text: 'The scheme has not been modified.',
                type: 'info',
                position: 'topCenter',
                width: Math.floor(window.innerWidth / 112.5 * 35),
            }).show();
        }
    });

    // 预设保存按钮
    document.getElementById("save-config1").addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定要保存到方案1吗？";
        document.getElementById("confirm-info").title = "Are you sure you want to save to Custom Scheme 1?";
        const oldElement = document.getElementById("confirm-overlay-confirm-button");
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);
        newElement.addEventListener("click", () => {
            saveCustomConfig(1);
            hideConfirmOverlay();
        });
    });
    document.getElementById("save-config2").addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定要保存到方案2吗？";
        document.getElementById("confirm-info").title = "Are you sure you want to save to Custom Scheme 2?";
        const oldElement = document.getElementById("confirm-overlay-confirm-button");
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);
        newElement.addEventListener("click", () => {
            saveCustomConfig(2);
            hideConfirmOverlay();
        });
    });
    document.getElementById("save-config3").addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定要保存到方案3吗？";
        document.getElementById("confirm-info").title = "Are you sure you want to save to Custom Scheme 3?";
        const oldElement = document.getElementById("confirm-overlay-confirm-button");
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);
        newElement.addEventListener("click", () => {
            saveCustomConfig(3);
            hideConfirmOverlay();
        });
    })
    // 预设加载按钮
    document.getElementById("load-config1").addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定要加载方案1吗？(将会覆盖当前配置)";
        document.getElementById("confirm-info").title = "Are you sure you want to load Scheme 1? (This will overwrite the current configuration)";
        const oldElement = document.getElementById("confirm-overlay-confirm-button");
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);
        newElement.addEventListener("click", () => {
            loadCustomConfig(1);
            hideConfirmOverlay();
        });
    });
    document.getElementById("load-config2").addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定要加载方案2吗？(将会覆盖当前配置)";
        document.getElementById("confirm-info").title = "Are you sure you want to load Scheme 2? (This will overwrite the current configuration)";
        const oldElement = document.getElementById("confirm-overlay-confirm-button");
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);
        newElement.addEventListener("click", () => {
            loadCustomConfig(2);
            hideConfirmOverlay();
        });
    });
    document.getElementById("load-config3").addEventListener("click", () => {
        showConfirmOverlay();
        document.getElementById("confirm-info").textContent = "确定要加载方案3吗？(将会覆盖当前配置)";
        document.getElementById("confirm-info").title = "Are you sure you want to load Scheme 3? (This will overwrite the current configuration)";
        const oldElement = document.getElementById("confirm-overlay-confirm-button");
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);
        newElement.addEventListener("click", () => {
            loadCustomConfig(3);
            hideConfirmOverlay();
        });
    });

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
        case "Escape":
            hideOverlay();
            break;
        case "Control":
        case "ControlLeft":
        case "ControlRight":
            isAllowOperate = false;
            break;
        case "T":
        case "t":
            // 测试
            document.getElementById("size-menu").classList.add("hidden");
            break;
        case "Y":
        case "y":
            // 测试
            document.getElementById("size-menu").classList.remove("hidden");
            break;
        default:
            break;
    }
});

// 按键松开监听
document.addEventListener('keyup', function (event) {
    switch (event.key) {
        case "Control":
        case "ControlLeft":
        case "ControlRight":
            isAllowOperate = true;
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
        footInfoElement.style.color = "#00000000";
        footInfoElement.getElementsByTagName('a')[0].style.color = "#00000000";
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
        footInfoElement.style.color = "#636363ba";
        footInfoElement.getElementsByTagName('a')[0].style.color = "#636363ba";
    }
    updateTimerAndStep();
}

// 增加阶数
function increaseSize() {
    // 试玩模式下不可调整
    if (isRetry) {
        return;
    }
    if (size < 10) {
        size++;
        levelShowElement.textContent = size + "×" + size;
        createTiles();
        saveConfig();
    }
}

// 减少阶数
function decreaseSize() {
    // 试玩模式下不可调整
    if (isRetry) {
        return;
    }
    if (size > 2) {
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

    // 计算平均
    let ao5Legal = true; // 计算得到的成绩是否合法（游玩间隔大于5分钟）
    let ao12Legal = true; // 计算得到的成绩是否合法（游玩间隔大于5分钟）
    // 计算5次平均
    if (currentSizeScores.length >= 4) {
        let tempList = [parseFloat(score.time)];
        // 判断 当前这把的游玩时间 与 列表最后一把的完成时间 的间隔是否大于5分钟
        let scoreDatetime = new Date(score.dateTime);
        let scoreGametime = parseFloat(score.time);
        let listLastDatetime = new Date(currentSizeScores[currentSizeScores.length - 1].dateTime);
        if (Math.abs((scoreDatetime - 1000 * scoreGametime) - listLastDatetime) > 300000) {
            ao5Legal = false;
        }
        // 加上最后4把
        for (i = 1; i <= 4; i++) {
            tempList.push(parseFloat(currentSizeScores[currentSizeScores.length - i].time));
            if (i >= 2) {
                // 判断间隔
                let thisDateTime = new Date(currentSizeScores[currentSizeScores.length - i].dateTime);
                let nextDateTime = new Date(currentSizeScores[currentSizeScores.length - i + 1].dateTime);
                let nextGameTime = parseFloat(currentSizeScores[currentSizeScores.length - i + 1].time);
                if (Math.abs((nextDateTime - 1000 * nextGameTime) - thisDateTime) > 300000) {
                    ao5Legal = false;
                }
            }
        }
        score.ao5 = averageOfList(tempList);
    }
    else {
        score.ao5 = "--";
    }
    if (!ao5Legal) {
        score.ao5 = "--";
    }

    // 计算12次平均
    if (currentSizeScores.length >= 11) {
        let tempList = [parseFloat(score.time)];
        // 判断 当前这把的游玩时间 与 列表最后一把的完成时间 的间隔是否大于5分钟
        let scoreDatetime = new Date(score.dateTime);
        let scoreGametime = parseFloat(score.time);
        let listLastDatetime = new Date(currentSizeScores[currentSizeScores.length - 1].dateTime);
        if (Math.abs((scoreDatetime - 1000 * scoreGametime) - listLastDatetime) > 300000) {
            ao12Legal = false;
        }
        // 加上最后11把
        for (i = 1; i <= 11; i++) {
            tempList.push(parseFloat(currentSizeScores[currentSizeScores.length - i].time));
            if (i >= 2) {
                // 判断间隔
                let thisDateTime = new Date(currentSizeScores[currentSizeScores.length - i].dateTime);
                let nextDateTime = new Date(currentSizeScores[currentSizeScores.length - i + 1].dateTime);
                let nextGameTime = parseFloat(currentSizeScores[currentSizeScores.length - i + 1].time);
                if (Math.abs((nextDateTime - 1000 * nextGameTime) - thisDateTime) > 300000) {
                    ao12Legal = false;
                }
            }
        }
        score.ao12 = averageOfList(tempList);
    }
    else {
        score.ao12 = "--";
    }
    if (!ao12Legal) {
        score.ao12 = "--";
    }

    // 添加新成绩（添加在列表的最后）
    scores.push(score);
    // 保存回 localStorage
    localStorage.setItem('scores', JSON.stringify(scores));
}

// 计算一个列表的去尾平均
function averageOfList(originalList) {
    let list = [...originalList]; // 创建一个原始列表的副本
    list.sort(function (a, b) {
        return a - b;
    });
    let sum = 0;
    if (list.length > 2) {
        for (i = 1; i <= list.length - 2; i++) {
            sum += list[i];
        }
        return (sum / (list.length - 2)).toFixed(2);
    } else {
        for (i = 0; i < list.length; i++) {
            sum += list[i];
        }
        return (sum / list.length).toFixed(2);
    }
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
    // 试玩模式下不可调整
    if (isRetry) {
        return;
    }
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
        colorConfigCloseElement.classList.add("custom-pointer");
        colorConfigSaveElement.classList.add("custom-pointer");
        colorConfigPreset1Element.classList.add("custom-pointer");
        colorConfigPreset2Element.classList.add("custom-pointer");
        confirmButtonElement.classList.add("custom-pointer");
        cancelButtonElement.classList.add("custom-pointer");
        for (let index = 0; index < colorInputs.length; index++) {
            colorInputs[index].classList.add("custom-pointer");
        }
        for (let index = 0; index < fontColorInputs.length; index++) {
            fontColorInputs[index].classList.add("custom-pointer");
        }
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
        colorConfigCloseElement.classList.remove("custom-pointer");
        colorConfigSaveElement.classList.remove("custom-pointer");
        colorConfigPreset1Element.classList.remove("custom-pointer");
        colorConfigPreset2Element.classList.remove("custom-pointer");
        confirmButtonElement.classList.remove("custom-pointer");
        cancelButtonElement.classList.remove("custom-pointer");
        for (let index = 0; index < colorInputs.length; index++) {
            colorInputs[index].classList.remove("custom-pointer");
        }
        for (let index = 0; index < fontColorInputs.length; index++) {
            fontColorInputs[index].classList.remove("custom-pointer");
        }
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
    config.styleConfig.colorConfig = colorConfig;
    config.styleConfig.fontColorConfig = fontColorConfig;
    config.styleConfig.fontSizeRatio = parseFloat(fontSizeRatio);
    config.styleConfig.borderRadiusRatio = parseFloat(borderRadiusRatio);
    config.styleConfig.gapWidthRatio = parseFloat(gapWidthRatio);
    // 保存到localStorage
    localStorage.setItem("config", JSON.stringify(config));
}

// 修改配置信息
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
    colorConfig = config.styleConfig.colorConfig;
    fontSizeRatio = config.styleConfig.fontSizeRatio;
    borderRadiusRatio = config.styleConfig.borderRadiusRatio;
    gapWidthRatio = config.styleConfig.gapWidthRatio;
    fontColorConfig = config.styleConfig.fontColorConfig || defaultFontColorConfig1; // 新增配置，需要适配旧版本
    saveConfig();
}

// 保存自定义方案（3个方案）
function saveCustomConfig(number) {
    console.log("保存" + number);
    // 保存当前配置
    saveConfig();
    // 获取localStorage中的配置文件
    let config = JSON.parse(localStorage.getItem('config')) || [];
    if (number == 1) {
        let customConfig1 = {
            "colorConfig": colorConfig,
            "fontColorConfig": fontColorConfig,
            "fontSizeRatio": fontSizeRatio,
            "borderRadiusRatio": borderRadiusRatio,
            "gapWidthRatio": gapWidthRatio
        }
        config.customConfig1 = customConfig1;
        // 显示提示
        new NoticeJs({
            title: '已将当前方案保存至自定义方案1',
            text: 'The current scheme has been saved to Custom Scheme 1',
            type: 'success',
            position: 'topCenter',
            width: Math.floor(window.innerWidth / 112.5 * 35),
        }).show();
    } else if (number == 2) {
        let customConfig2 = {
            "colorConfig": colorConfig,
            "fontColorConfig": fontColorConfig,
            "fontSizeRatio": fontSizeRatio,
            "borderRadiusRatio": borderRadiusRatio,
            "gapWidthRatio": gapWidthRatio
        }
        config.customConfig2 = customConfig2;
        // 显示提示
        new NoticeJs({
            title: '已将当前方案保存至自定义方案2',
            text: 'The current scheme has been saved to Custom Scheme 2',
            type: 'success',
            position: 'topCenter',
            width: Math.floor(window.innerWidth / 112.5 * 35),
        }).show();
    } else if (number == 3) {
        let customConfig3 = {
            "colorConfig": colorConfig,
            "fontColorConfig": fontColorConfig,
            "fontSizeRatio": fontSizeRatio,
            "borderRadiusRatio": borderRadiusRatio,
            "gapWidthRatio": gapWidthRatio
        }
        config.customConfig3 = customConfig3;
        // 显示提示
        new NoticeJs({
            title: '已将当前方案保存至自定义方案3',
            text: 'The current scheme has been saved to Custom Scheme 3',
            type: 'success',
            position: 'topCenter',
            width: Math.floor(window.innerWidth / 112.5 * 35),
        }).show();
    }
    // 保存到localStorage
    localStorage.setItem("config", JSON.stringify(config));
    // 修改标识
    isChangeConfig = false;
}

// 加载自定义方案
function loadCustomConfig(number) {
    isChangeConfig = true;
    // 获取localStorage中的配置文件
    let config = JSON.parse(localStorage.getItem('config')) || [];
    if (number == 1) {
        if (config.customConfig1 == null) {
            // 显示提示
            new NoticeJs({
                title: '自定义方案1不存在',
                text: 'Custom Scheme 1 does not exist',
                type: 'warning',
                position: 'topCenter',
                width: Math.floor(window.innerWidth / 112.5 * 35),
            }).show();
        } else {
            colorConfig = config.customConfig1.colorConfig;
            fontColorConfig = config.customConfig1.fontColorConfig;
            fontSizeRatio = config.customConfig1.fontSizeRatio;
            borderRadiusRatio = config.customConfig1.borderRadiusRatio;
            gapWidthRatio = config.customConfig1.gapWidthRatio;
        }
    } else if (number == 2) {
        if (config.customConfig2 == null) {
            // 显示提示
            new NoticeJs({
                title: '自定义方案2不存在',
                text: 'Custom Scheme 2 does not exist.',
                type: 'warning',
                position: 'topCenter',
                width: Math.floor(window.innerWidth / 112.5 * 35),
            }).show();
        } else {
            colorConfig = config.customConfig2.colorConfig;
            fontColorConfig = config.customConfig2.fontColorConfig;
            fontSizeRatio = config.customConfig2.fontSizeRatio;
            borderRadiusRatio = config.customConfig2.borderRadiusRatio;
            gapWidthRatio = config.customConfig2.gapWidthRatio;
        }
    } else if (number == 3) {
        if (config.customConfig3 == null) {
            // 显示提示
            new NoticeJs({
                title: '自定义方案3不存在',
                text: 'Custom Scheme 3 does not exist.',
                type: 'warning',
                position: 'topCenter',
                width: Math.floor(window.innerWidth / 112.5 * 35),
            }).show();
        } else {
            colorConfig = config.customConfig3.colorConfig;
            fontColorConfig = config.customConfig3.fontColorConfig;
            fontSizeRatio = config.customConfig3.fontSizeRatio;
            borderRadiusRatio = config.customConfig3.borderRadiusRatio;
            gapWidthRatio = config.customConfig3.gapWidthRatio;
        }
    }
    // 重新绘制preview-puzzle
    let tempList = Array.from({ length: 100 }, (_, i) => i + 1);
    renderTiles(previewPuzzle, tempList, 20, 10, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
    // 更新颜色选择器
    setColorPickerValue();
    // 更新滑块
    setSizeSliderValue();
}


// 应用默认/预设配置，未保存到config
function resetConfig(defaultStyleConfig) {
    isChangeConfig = true;
    colorConfig = defaultStyleConfig.colorConfig;
    fontColorConfig = defaultStyleConfig.fontColorConfig;
    gapWidthRatio = defaultStyleConfig.gapWidthRatio;
    fontSizeRatio = defaultStyleConfig.fontSizeRatio;
    borderRadiusRatio = defaultStyleConfig.borderRadiusRatio;
    // 重新绘制preview-puzzle
    let tempList = Array.from({ length: 100 }, (_, i) => i + 1);
    renderTiles(previewPuzzle, tempList, 20, 10, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
    // 更新颜色选择器
    setColorPickerValue();
    // 更新滑块
    setSizeSliderValue();
}

// 显示弹框
function showOverlay() {
    colorConfigOverlayElement.classList.add('visible');
    colorConfigOverlayElement.classList.remove('hidden');
    // 禁用鼠标样式
    setCursorStyle(false);
    // 暂时禁用操作
    isAllowOperate = false;
    // 初始化是否修改的值
    isChangeConfig = false;
    // 禁用胜利的效果
    isFinish = false;
    let tempList = Array.from({ length: 100 }, (_, i) => i + 1);
    renderTiles(previewPuzzle, tempList, 20, 10, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
    // 颜色选择器初始化
    setColorPickerValue();
    // 滑块初始化
    setSizeSliderValue();
}

// 隐藏弹框
function hideOverlay() {
    colorConfigOverlayElement.classList.remove('visible');
    setTimeout(() => {
        colorConfigOverlayElement.classList.add('hidden');
    }, 200); // Wait for the animation to finish

    // 恢复鼠标样式
    setCursorStyle(isCustomCursor);

    // 重新加载配置和渲染拼图快
    loadConfig();
    createTiles();
}

// 显示确认弹框
function showConfirmOverlay() {
    document.getElementById("confirm-overlay").classList.remove('hidden');
}

// 隐藏确认弹框
function hideConfirmOverlay() {
    document.getElementById("confirm-overlay").classList.add('hidden');
}

// 设置颜色选择器样式
jscolor.presets.default = {
    previewSize: 30,
    sliderSize: 10,
    shadow: false,
    borderRadius: 4,
};

// 颜色选择器初始化（更新内容）
function setColorPickerValue() {
    // 遍历colorInputs和fontColorInputs
    for (let index = 0; index < colorInputs.length; index++) {
        let colorInput = colorInputs[index];
        let fontColorInput = fontColorInputs[index];
        // 设置初始值
        colorInput.jscolor.fromString(colorConfig[index + 1]);
        fontColorInput.jscolor.fromString(fontColorConfig[index + 1]);
        // 添加事件监听器
        colorInput.addEventListener("input", function () {
            isChangeConfig = true;
            // 获取输入框的值
            const value = colorInput.value;
            // 将值赋给colorConfig对象
            colorConfig[index + 1] = value;
            // 重新绘制preview-puzzle
            let tempList = Array.from({ length: 100 }, (_, i) => i + 1);
            renderTiles(previewPuzzle, tempList, 20, 10, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
        });
        fontColorInput.addEventListener("input", function () {
            isChangeConfig = true;
            // 获取输入框的值
            const value = fontColorInput.value;
            // 将值赋给fontColorConfig对象
            fontColorConfig[index + 1] = value;
            // 重新绘制preview-puzzle
            let tempList = Array.from({ length: 100 }, (_, i) => i + 1);
            renderTiles(previewPuzzle, tempList, 20, 10, gapWidthRatio, fontSizeRatio, borderRadiusRatio);
        });

    }
}

// 滑块初始化（更新内容）
function setSizeSliderValue() {
    for (let index = 0; index < sizeInputs.length; index++) {
        let sizeInput = sizeInputs[index];
        // index从0,1,2依次是间隙大小、字体大小、圆角大小
        // 赋值给滑块
        switch (index) {
            case 0:
                sizeInput.value = gapWidthRatio;
                break;
            case 1:
                sizeInput.value = fontSizeRatio;
                break;
            case 2:
                sizeInput.value = borderRadiusRatio;
                break;
            default:
                break;
        }
        // 赋值给文本
        sizeInfoElements[index].textContent = sizeInput.value + "×";
    }
}

// 计算曼哈顿距离
function calculateManhattanDistance(scrambleArray, size) {
    // 生成目标序列，例如 size 为 3 时是 [1, 2, 3, 4, 5, 6, 7, 8, 0]
    let goal = Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size));

    // 创建目标位置的字典，键为拼图块值，值为目标位置坐标
    let goalPositions = {};
    goal.forEach((value, index) => {
        goalPositions[value] = [Math.floor(index / size), index % size];
    });

    // 计算总曼哈顿距离
    let totalManhattanDistance = 0;
    scrambleArray.forEach((value, index) => {
        if (value !== 0) {  // 忽略空白块
            let currentPos = [Math.floor(index / size), index % size];
            let goalPos = goalPositions[value];
            let manhattanDistance = Math.abs(currentPos[0] - goalPos[0]) + Math.abs(currentPos[1] - goalPos[1]);
            totalManhattanDistance += manhattanDistance;
        }
    });

    return totalManhattanDistance;
}

// 获取用户设备信息
function getDeviceType() {
    var userAgent = navigator.userAgent;

    if (/tablet|ipad|playbook|silk|mobile/i.test(userAgent)) {
        return 'mobile';
    } else {
        return 'desktop';
    }
}