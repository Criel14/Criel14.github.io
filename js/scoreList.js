// 读取成绩并显示
document.addEventListener("DOMContentLoaded", () => {
    const scores = JSON.parse(localStorage.getItem('scores')) || [];
    const tbody = document.getElementById('scores-tbody');

    scores.reverse().forEach(score => {
        let row = document.createElement('tr');
        let sizeTd = document.createElement("td");
        let timeTd = document.createElement("td");
        let stepTd = document.createElement("td");
        let tpsTd = document.createElement("td");
        sizeTd.textContent = score.size;
        timeTd.textContent = score.time;
        stepTd.textContent = score.step;
        tpsTd.textContent = score.tps;
        row.appendChild(sizeTd);
        row.appendChild(timeTd);
        row.appendChild(stepTd);
        row.appendChild(tpsTd);
        tbody.appendChild(row);
    });
});