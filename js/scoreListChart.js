// 引用div
const dom = document.getElementById('chart');

// 渲染图表
function renderChart() {
    // 获取当前成绩列表
    const currentScoreList = JSON.parse(localStorage.getItem('currentScoreList'));
    // 提取出对应的表
    let timeList = [];
    let stepList = [];
    let numberList = [];
    if (currentScoreList != null) {
        timeList = currentScoreList.map(item => item.time);
        stepList = currentScoreList.map(item => item.step);
        tpsList = currentScoreList.map(item => item.tps);
        numberList = currentScoreList.map(item => item.number);
    }

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
    let colorArr = ["0, 62, 246", "0, 193, 142", "253, 148, 67"]
    list.forEach((val, index) => {
        seriesArr.push({
            name: val.name,
            type: 'line',
            symbolSize: 1,
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

    console.log(JSON.stringify(seriesArr));

    option = {
        backgroundColor: "#fff",
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
            top: "6%",
            textStyle: {
                color: '#000',
                fontSize: 16,
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
            top: '18%',
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
                    fontSize: 12,
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
                        fontSize: 12,
                        color: '#003ef6',
                    }
                },
                axisLabel: {
                    textStyle: {
                        fontSize: 12,
                        color: "#003ef6",
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
                        fontSize: 12,
                        color: '#00c18e',
                    }
                },
                axisLabel: {
                    textStyle: {
                        fontSize: 12,
                        color: "#00c18e",
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
}

// 实时调整图表大小
window.addEventListener('resize', function () {
    myChart.resize();
});

// 加载完成后
document.addEventListener("DOMContentLoaded", () => {
    renderChart();
});