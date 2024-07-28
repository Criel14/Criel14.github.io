const puzzleGameTitle = document.getElementById('puzzle-game-title');

window.onload = function () {
    puzzleGameTitle.addEventListener('click', () => window.location.href = 'puzzle.html');
    puzzleGameTitle.addEventListener('click', function () {
        window.location.href = 'puzzle.html';
    });
}

// 判断是否是移动端设备
function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}