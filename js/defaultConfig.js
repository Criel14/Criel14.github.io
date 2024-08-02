// 默认颜色配置：预设1
let defaultColorConfig1 = {
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
    15: "#90fdde",
    16: "#93d3ff",
    17: "#c4925f",
    18: "#dc98ff",
};

// 默认颜色配置：预设2
let defaultColorConfig2 = {
    0: "#f0f0f0",
    1: "#fde5ff",
    2: "#ffceee",
    3: "#ffe1c9",
    4: "#fdcda9",
    5: "#98ffe1",
    6: "#81ffd0",
    7: "#a5e2ff",
    8: "#81cdfe",
    9: "#cfd0fe",
    10: "#bdbcfe",
    11: "#ff9798",
    12: "#ff494d",
    13: "#b0ffb0",
    14: "#81fd81",
    15: "#95a403",
    16: "#6d7600",
    17: "#ffd2cf",
    18: "#fdb7b6"
};

// 字体颜色预设1：全白
let defaultFontColorConfig1 = {
    1: "#ffffff",
    2: "#ffffff",
    3: "#ffffff",
    4: "#ffffff",
    5: "#ffffff",
    6: "#ffffff",
    7: "#ffffff",
    8: "#ffffff",
    9: "#ffffff",
    10: "#ffffff",
    11: "#ffffff",
    12: "#ffffff",
    13: "#ffffff",
    14: "#ffffff",
    15: "#ffffff",
    16: "#ffffff",
    17: "#ffffff",
    18: "#ffffff",
}

// 字体颜色预设2：全黑
let defaultFontColorConfig2 = {
    1: "#000000",
    2: "#000000",
    3: "#000000",
    4: "#000000",
    5: "#000000",
    6: "#000000",
    7: "#000000",
    8: "#000000",
    9: "#000000",
    10: "#000000",
    11: "#000000",
    12: "#000000",
    13: "#000000",
    14: "#000000",
    15: "#000000",
    16: "#000000",
    17: "#000000",
    18: "#000000",
}

// 样式配置
// 字体比例（取值范围0 - 1.0）：字体大小 = 滑块的边长 * fontSizeRatio
let defaultFontSizeRatio1 = 0.5;
let defaultFontSizeRatio2 = 0.5;
// 间隙大小（取值范围0 - 0.1）
let defaultGapWidthRatio1 = 0.03;
let defaultGapWidthRatio2 = 0;
// 圆角大小系数（取值范围0 - 0.5），：圆角大小 = 滑块的边长 * borderRadiusRatio
let defaultBorderRadiusRatio1 = 0.04;
let defaultBorderRadiusRatio2 = 0.01;

let defaultStyleConfig1 = {
    "colorConfig": defaultColorConfig1,
    "fontColorConfig": defaultFontColorConfig1,
    "fontSizeRatio": defaultFontSizeRatio1,
    "gapWidthRatio": defaultGapWidthRatio1,
    "borderRadiusRatio": defaultBorderRadiusRatio1,
};

let defaultStyleConfig2 = {
    "colorConfig": defaultColorConfig2,
    "fontColorConfig": defaultFontColorConfig1,
    "fontSizeRatio": defaultFontSizeRatio2,
    "gapWidthRatio": defaultGapWidthRatio2,
    "borderRadiusRatio": defaultBorderRadiusRatio2,
};

// 默认配置
let defaultConfig = {
    "size": 4,
    "gameMode": "normal",
    "moveMode": "slide",
    "groupNumber": 1,
    "isCustomCursor": false,
    "styleConfig": defaultStyleConfig1,
}