// 引用图表div
const dom = document.getElementById('chart');
// 引用数据显示div
const bestTimeElement = document.getElementById('best-time');
const bestStepElement = document.getElementById('best-step');
const bestTpsElement = document.getElementById('best-tps');
const avgTimeElement = document.getElementById('avg-time');
const avgStepElement = document.getElementById('avg-step');
const avgTpsElement = document.getElementById('avg-tps');
const avgObserveTimeElement = document.getElementById('avg-observe-time');
const bestAo5Element = document.getElementById('best-ao5');
const bestAo12Element = document.getElementById('best-ao12');

// 默认字体大小
const defaultFontSize = window.innerWidth / 112.5;

// 渲染图表
function renderChart() {
    // 获取当前成绩列表
    const currentScoreList = JSON.parse(localStorage.getItem('currentScoreList'));
    // 提取出对应的表
    let timeList = [];
    let stepList = [];
    let tpsList = [];
    let numberList = [];
    let observeTimeList = [];
    let ao5List = [];
    let ao12List = [];
    let currentScoreSize = 0;
    let currentScoreGameMode = "empty";
    let currentScoreGroupNumber = 0;
    if (currentScoreList != null && currentScoreList.length > 0) {
        timeList = currentScoreList.map(item => parseFloat(item.time));
        stepList = currentScoreList.map(item => item.step);
        tpsList = currentScoreList.map(item => parseFloat(item.tps));
        numberList = currentScoreList.map(item => item.number);
        observeTimeList = currentScoreList.map(item => item.observeTime);
        ao5List = currentScoreList.map(item => item.ao5).filter(item => item != "--").map(Number);
        ao12List = currentScoreList.map(item => item.ao12).filter(item => item != "--").map(Number);
        currentScoreSize = currentScoreList[0].size;
        currentScoreGameMode = currentScoreList[0].gameMode;
        currentScoreGroupNumber = currentScoreList[0].group;
    }
    // console.log(timeList, stepList, tpsList, numberList);

    // 绘制图表
    var myChart = echarts.init(dom);
    var option;
    var app = {};
    let xList = numberList;
    let seriesArr = [];
    let list = [{
        name: "时间",
        children: timeList
    },
    {
        name: "步数",
        children: stepList
    }
    ]
    let colorArr = ["70, 112, 236", "241, 182, 73"]
    list.forEach((val, index) => {
        seriesArr.push({
            name: val.name,
            type: 'line',
            symbolSize: 0,
            data: val.children,
            areaStyle: {
                normal: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
                        offset: 0,
                        color: `rgba(${colorArr[index]},.2)`
                    }, {
                        offset: 1,
                        color: 'rgba(255, 255, 255,0)'
                    }], false)
                }
            },
            itemStyle: {
                normal: {
                    color: `rgb(${colorArr[index]})`
                }
            },
            lineStyle: {
                normal: {
                    width: 2,
                    shadowColor: `rgba(${colorArr[index]}, .2)`,
                    shadowBlur: 4,
                    shadowOffsetY: 25
                }
            },
            yAxisIndex: index
        })
    })
    option = {
        backgroundColor: "#fff",
        title: {
            text: `${currentScoreSize}×${currentScoreSize} ${currentScoreGameMode} Group${currentScoreGroupNumber}`,
            left: 'center',
            top: '2%',
            textStyle: {
                color: '#000',
                fontSize: 1.25 * defaultFontSize,
                fontWeight: 600
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                lineStyle: {
                    color: '#ddd'
                },
                type: 'cross'
            },
            backgroundColor: 'rgba(255,255,255,1)',
            padding: [5, 10],
            textStyle: {
                color: '#000',
            }
        },
        legend: {
            right: "center",
            top: "12%",
            textStyle: {
                color: '#242424',
                fontSize: defaultFontSize,
                fontWeight: 600
            },
            data: list.map(val => {
                return val.name
            })
        },
        grid: {
            left: '2%',
            right: '5%',
            bottom: '6%',
            top: '22%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: xList,
            boundaryGap: false,
            splitLine: {
                show: true,
                interval: 'auto',
                lineStyle: {
                    type: "dashed",
                    color: ['#cfcfcf']
                }
            },
            axisTick: {
                show: false
            },
            axisLine: {
                lineStyle: {
                    color: '#cfcfcf'
                }
            },
            axisLabel: {
                textStyle: {
                    fontSize: 0.75 * defaultFontSize,
                    color: "#9e9d9f",
                    fontWeight: 600
                }
            }
        },
        yAxis: [
            {
                name: "(时间/秒)",
                type: 'value',
                splitLine: {
                    show: true,
                    lineStyle: {
                        type: "dashed",
                        color: ['#cfcfcf']
                    }
                },
                axisTick: {
                    show: false
                },
                axisLine: {
                    show: true,
                    lineStyle: {
                        fontSize: 0.75 * defaultFontSize,
                        color: '#466fec',
                    }
                },
                axisLabel: {
                    textStyle: {
                        fontSize: 0.75 * defaultFontSize,
                        color: "#466fec",
                        fontWeight: 600
                    }
                },
                position: 'left',
                max: Math.ceil(Math.max(...timeList)) // 向上取整
            },
            {
                name: "(步数/步)",
                type: 'value',
                splitLine: {
                    show: true,
                    lineStyle: {
                        type: "dashed",
                        color: ['#cfcfcf']
                    }
                },
                axisTick: {
                    show: false
                },
                axisLine: {
                    show: true,
                    lineStyle: {
                        fontSize: 0.75 * defaultFontSize,
                        color: '#f1b649',
                    }
                },
                axisLabel: {
                    textStyle: {
                        fontSize: 0.75 * defaultFontSize,
                        color: "#f1b649",
                        fontWeight: 600
                    }
                },
                position: 'right',
                max: Math.ceil(Math.max(...stepList) / 10) * 10 // 向上取10的倍数
            }],
        series: seriesArr
    };

    if (option && typeof option === 'object') {
        myChart.clear();
        // 应用配置项
        myChart.setOption(option);
    }

    // 实时调整图表大小
    window.addEventListener('resize', function () {
        myChart.resize();
    });

    // 更新显示数据
    showData(timeList, stepList, tpsList, observeTimeList, ao5List, ao12List);
}

// 显示数据
function showData(timeList, stepList, tpsList, observeTimeList, ao5List, ao12List) {
    bestTimeElement.textContent = Math.min(...timeList).toFixed(2) + "s";
    bestStepElement.textContent = Math.min(...stepList);
    bestTpsElement.textContent = Math.max(...tpsList).toFixed(2);
    bestAo5Element.textContent = Math.min(...ao5List).toFixed(2) + "s";
    bestAo12Element.textContent = Math.min(...ao12List).toFixed(2) + "s";
    avgTimeElement.textContent = averageOfList(timeList) + "s";
    avgStepElement.textContent = averageOfList(stepList);
    avgTpsElement.textContent = averageOfList(tpsList);
    avgObserveTimeElement.textContent = timeFormat(averageOfList(observeTimeList)) + "s";
}


// 加载完成后
window.onload = function () {
    renderChart();
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

// 格式化时间，保留2位小数，参数是毫秒
function timeFormat(originalTime) {
    const seconds = Math.floor(originalTime / 1000);
    const milliseconds = originalTime % 1000;
    return parseFloat(`${seconds}.${milliseconds}`).toFixed(2);
}