const sizeInfoElement = document.getElementById("size-info");
const overlayElement = document.getElementById("overlay");
const scrambleTextElement = document.getElementById("scramble-text");

document.addEventListener("DOMContentLoaded", () => {
    const scores = JSON.parse(localStorage.getItem('scores')) || [];
    const tbody = document.getElementById('scores-tbody');
    let currentSize = 3; // 初始显示3阶成绩

    function displayScores(size) {
        // 修改表头
        sizeInfoElement.textContent = `${size}阶`;

        tbody.innerHTML = ''; // 清空现有内容

        scores.filter(score => score.size == size).reverse().forEach(score => {
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
        } else if (event.key === '.' || event.key === '>') {
            changeSize(1); // 显示高一阶成绩
        } else if (event.key === 'c' || event.key === 'C') {
            localStorage.removeItem("scores"); // 清空成绩
            // 刷新页面
            location.reload();
        } else if (event.key === 'Escape') {
            hideOverlay(); // 隐藏弹框
        }
    });

    displayScores(currentSize); // 初始显示3阶成绩
});

// 显示打乱
function showScramble(size, number) {
    const scores = JSON.parse(localStorage.getItem('scores')) || [];
    // 找到scores中对应的行
    const score = scores.find(s => s.size === size && s.number === number);
    // 获取打乱字符串
    const scrambleList = score.scramble.split(',');

    // 将数组转换为字符串，每size个元素后面加一个换行符
    let scrambleString = '';
    for (let i = 0; i < scrambleList.length; i += size) {
        scrambleString += scrambleList.slice(i, i + size).join(',') + ',<br>';
    }
    // 显示弹框
    showOverlay(scrambleString);
    console.log(scrambleString);
}


// 显示弹框
function showOverlay(text) {
    overlayElement.classList.remove('hidden');
    scrambleTextElement.innerHTML = text;
}

// 隐藏弹框
function hideOverlay() {
    overlayElement.classList.add('hidden');
}