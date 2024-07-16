const puzzle = document.getElementById("puzzle"); // 获取拼图容器的引用
const shuffleButton = document.getElementById("shuffleButton"); // 获取打乱按钮的引用
let size = 4; // 定义拼图的阶数（边长）
let tiles = []; // 用于存储拼图块的数组

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
    // 生成数组并打乱
    scramble();
    // 渲染拼图块
    renderTiles();

    // 旋转动画
    this.classList.add('spin-animation');
    // 在动画结束后移除动画类，以便下次点击时可以再次触发动画
    setTimeout(() => {
        this.classList.remove('spin-animation');
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
        zeroIndex = tiles.findIndex(i => i === 0);
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
            tileElement.addEventListener("mouseover", () => moveTile(index));
        }
        puzzle.appendChild(tileElement); // 将拼图块添加到拼图容器中
    });
}

// 移动拼图块
function moveTile(index) {
    const emptyIndex = tiles.indexOf(0); // 找到空白块的位置
    const [x1, y1] = [index % size, Math.floor(index / size)]; // 计算当前拼图块的坐标
    const [x2, y2] = [emptyIndex % size, Math.floor(emptyIndex / size)]; // 计算空白块的坐标

    // 如果当前拼图块与空白块相邻
    if (Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1) {
        // 交换当前拼图块与空白块的位置
        [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
        renderTiles(); // 重新渲染拼图块
        checkWin(); // 检查是否拼图成功
    }
}

// 检查是否拼图成功
function checkWin() {
    // 如果拼图块按顺序排列
    if (tiles.slice(0, -1).every((tile, i) => tile === i + 1)) {
        alert("You win!"); // 弹出胜利提示
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
    createTiles(); // 初始化拼图
});

// 为页面添加按键监听
document.addEventListener('keydown', function (event) {
    switch (event.key) {
        case 'ArrowUp':
            if (size < 10) {
                console.log("阶数增加");
                size++;
                createTiles();
            }
            break;
        case 'ArrowDown':
            if (size > 2) {
                console.log("阶数减少");
                size--;
                createTiles();
            }
            break;
        default:
            break;
    }
});
