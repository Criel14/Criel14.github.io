/** 拼图阶数：2×2 到 10×10。 */
export type PuzzleSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** 游戏模式：普通模式或盲玩模式。 */
export type GameMode = 'normal' | 'blind';

/** 操作模式：点击、滑动或键盘。 */
export type MoveMode = 'click' | 'slide' | 'keyboard';

/** 方块移动方向；不是空白块移动方向。 */
export type Direction = 'U' | 'D' | 'L' | 'R';

/**
 * 棋盘按行优先展开，长度必须等于 size²。
 * 元素是 0..size²-1 的完整排列；0 表示空白块，不参与曼哈顿距离。
 */
export type Board = readonly number[];

/**
 * 一次单块移动记录。
 * timeMs 是相对本局创建时刻的毫秒数，必须 >= 0，并按数组顺序单调不减。
 * 使用相对时间而非墙钟，避免系统时间调整破坏回放时间轴。
 */
export interface MoveRecord {
  readonly direction: Direction;
  readonly timeMs: number;
}

/** 事件内固定分组槽位：1–5；分组数量固定，不新增、不删除。 */
export type GroupId = 1 | 2 | 3 | 4 | 5;

/**
 * 某个事件（阶数 + 游戏模式）下的固定分组。
 * 分组身份由 size + gameMode + id 共同确定；改名不改变身份。
 */
export interface Group {
  readonly size: PuzzleSize;
  readonly gameMode: GameMode;
  /** 事件内槽位 1–5；改名不改变 ID。 */
  readonly id: GroupId;
  /** 用户可见名称；允许重名，trim 后不能为空，最长 30 字符。 */
  readonly name: string;
}

/** 游戏设置；只保存用户选择，不保存当前局进行状态。 */
export interface GameSettings {
  readonly size: PuzzleSize;
  readonly gameMode: GameMode;
  readonly moveMode: MoveMode;
  /** 当前选中的分组槽位 1–5，跨事件共享。 */
  readonly groupId: GroupId;
  /** 固定 90 个分组：18 个事件 × 5 个槽位；只允许修改 name。 */
  readonly groups: readonly Group[];
  readonly customCursor: boolean;
  readonly minimalUi: boolean;
}

/**
 * 已保存的一局成绩，只含无法重新计算的事实字段。
 * tps、number、ao5/ao12、格式化时间、device 等派生或展示信息都不落库。
 * groupId 是事件内槽位 1–5，事件由 size + gameMode 确定；分组不会新增或删除，
 * 因此不需要处理引用失效。
 */
export interface ScoreRecord {
  /** 全局唯一；新成绩使用 crypto.randomUUID()，无该 API 时用带随机后缀的回退实现。 */
  readonly id: string;
  readonly size: PuzzleSize;
  readonly gameMode: GameMode;
  readonly moveMode: MoveMode;
  /** 本局所属的事件内分组槽位 1–5。 */
  readonly groupId: GroupId;
  /** 有效用时，单位 ms，必须 >= 0；normal 不含观察时间，blind 含观察时间。 */
  readonly durationMs: number;
  /** 第一次有效移动前的观察时间，单位 ms，必须 >= 0。 */
  readonly observeMs: number;
  /** 步数摘要；必须与对应 ReplayRecord.moves.length 一致。 */
  readonly moveCount: number;
  /** 本局打乱，即开局盘面；完成盘面由回放推演，不重复存储。 */
  readonly scramble: Board;
  /** 完成时刻，epoch ms。开局时刻由 finishedAt - durationMs 派生，不落库。 */
  readonly finishedAt: number;
}

/** 与一条成绩对应的移动序列；与成绩摘要分开存储，统计页无需加载整条录像。 */
export interface ReplayRecord {
  readonly scoreId: string;
  readonly moves: readonly MoveRecord[];
}

/**
 * Session 状态机阶段。
 * observing：尚无有效移动；running：已开始计时；solved：已复原并锁定棋盘。
 * 无效移动不会改变阶段。
 */
export type SessionPhase = 'observing' | 'running' | 'solved';

/**
 * 创建一局所需的配置。
 * createdAtEpochMs 是创建时的墙钟时间（epoch ms），只在结算时用于映射 finishedAt；
 * 计时本身使用调用方注入的单调时钟（页面传 performance.now()）。
 */
export interface SessionConfig {
  readonly size: PuzzleSize;
  readonly gameMode: GameMode;
  readonly moveMode: MoveMode;
  /** 本局所属的事件内分组槽位 1–5。 */
  readonly groupId: GroupId;
  readonly scramble: Board;
  readonly isRetry: boolean;
  readonly retryOf?: string;
  readonly createdAtEpochMs: number;
}

/** 一局进行中的完整状态；时间字段均为调用方注入的单调时钟毫秒值。 */
export interface SessionState {
  readonly config: SessionConfig;
  readonly board: Board;
  readonly moves: readonly MoveRecord[];
  readonly phase: SessionPhase;
  readonly createdAtMs: number;
  readonly firstMoveAtMs: number | null;
  readonly solvedAtMs: number | null;
}

/** 供 HUD 使用的只读视图；elapsedMs 与 tps 随 nowMs 变化，solved 后冻结。 */
export interface SessionView {
  readonly phase: SessionPhase;
  /** 当前显示用时，单位 ms；normal 第一次移动前为 0。 */
  readonly elapsedMs: number;
  /** 第一次有效移动前的观察时间，单位 ms。 */
  readonly observeMs: number;
  /** 当前 TPS，使用 elapsedMs 派生。 */
  readonly tps: number;
  /** 仅 blind 模式 running 阶段为 true。 */
  readonly hideNumbers: boolean;
}

/**
 * 一局结束时的瞬时结果。
 * 可以带 startedAt、manhattanDistance 等派生便利字段；
 * 写入 ScoreRecord 时只保留事实字段，这些派生值不落库。
 */
export interface SessionResult {
  readonly size: PuzzleSize;
  readonly gameMode: GameMode;
  readonly moveMode: MoveMode;
  /** 本局所属的事件内分组槽位 1–5。 */
  readonly groupId: GroupId;
  /** 有效用时，单位 ms；normal 不含观察时间，blind 含观察时间。 */
  readonly durationMs: number;
  /** 第一次有效移动前的观察时间，单位 ms。 */
  readonly observeMs: number;
  readonly moveCount: number;
  readonly scramble: Board;
  readonly moves: readonly MoveRecord[];
  readonly manhattanDistance: number;
  /** 开局时刻，epoch ms；normal 为首次移动时刻，blind 为创建时刻。 */
  readonly startedAt: number;
  /** 完成时刻，epoch ms。 */
  readonly finishedAt: number;
  readonly isRetry: boolean;
  readonly retryOf?: string;
}

/** 着色模式对象共有的字段。 */
interface ColorModeFields {
  /**
   * 方块背景色。长度由 mode 决定：
   * - layer：18，索引 0–17 对应层 1–18；
   * - row：10，索引 0–9 对应数字块原本所属的第 1–10 行；
   * - fixed：99，索引 0–98 对应数字 1–99。
   *
   * 每项为 #rrggbb 或 #rrggbbaa；省略 alpha 表示完全不透明。
   */
  readonly palette: readonly string[];

  /**
   * 方块字体色。与 palette 等长，索引一一对应。
   * 每一项为 '#rrggbb' 或 '#rrggbbaa'。
   */
  readonly fontPalette: readonly string[];

  /** 空白格背景色；整盘统一。默认 transparent，也允许 #rrggbb / #rrggbbaa。 */
  readonly blankColor: string;
}

/** 降阶：现有 L 形分层，颜色绑定数字块。 */
export interface LayerColorMode extends ColorModeFields {
  readonly mode: 'layer';
}

/** 按行：按数字块原本所属行着色，颜色跟随数字块。 */
export interface RowColorMode extends ColorModeFields {
  readonly mode: 'row';
}

/** 固定色：每个数字单独着色，与阶数和位置无关。 */
export interface FixedColorMode extends ColorModeFields {
  readonly mode: 'fixed';
}

/** 主题的着色模式；一个主题只对应一种模式。 */
export type ColorMode = LayerColorMode | RowColorMode | FixedColorMode;

/** 某个主题自带的尺寸比例；以实际格子边长为基准计算，不保存固定像素值。 */
export interface BoardMetrics {
  /** 字号 = 边框内边长 × fontSizeRatio，范围 0–1。 */
  readonly fontSizeRatio: number;
  /** 间隙 = 格子边长 × gapRatio，范围 0–0.1。 */
  readonly gapRatio: number;
  /** 圆角 = 格子边长 × radiusRatio，范围 0–0.5。 */
  readonly radiusRatio: number;
}

/** 方块内边框；整盘统一，不改变方块外尺寸。 */
export interface ThemeInnerBorder {
  /** 'transparent'、#rrggbb 或 #rrggbbaa。 */
  readonly color: string;
  /** 单边宽度 = 格子边长 × widthRatio；0–0.1，0 表示无边框。 */
  readonly widthRatio: number;
}

/** 统一外观入口：颜色、边框、盲玩色和尺寸比例都属于主题。 */
export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly builtin: boolean;
  /** 主题设计上支持的阶数；非空、升序、去重，默认全部 2–10。 */
  readonly supportedSizes: readonly PuzzleSize[];
  readonly color: ColorMode;
  /** 方块内边框；整盘统一。 */
  readonly innerBorder: ThemeInnerBorder;
  /**
   * 盲玩隐藏数字时，所有非空方块的背景色。
   * 必须为 #rrggbb 或 #rrggbbaa；默认 #3498db，用户可在自定义主题里调整。
   * 空白块仍使用 color.blankColor，不参与这个颜色。
   */
  readonly blindTileColor: string;
  readonly metrics: BoardMetrics;
}

/** 外观状态：每个阶数一个主题 ID + 主题列表。 */
export interface AppearanceState {
  /** 9 个键必须齐全；异常时允许指向 FALLBACK_THEME_ID。 */
  readonly themeIdBySize: Readonly<Record<PuzzleSize, string>>;
  readonly themes: readonly Theme[];
}

/** 统计页的成绩桶筛选；moveMode 不参与分桶。 */
export interface ScoreFilter {
  readonly size: PuzzleSize;
  readonly gameMode: GameMode;
  /** 事件内槽位 1–5，不是分组名称；事件由 size + gameMode 确定。 */
  readonly groupId: GroupId;
}

/** 统计聚合结果；空桶时 count 为 0，其余字段为 null。时间单位均为 ms。 */
export interface ScoreStats {
  readonly count: number;
  readonly bestTimeMs: number | null;
  readonly averageTimeMs: number | null;
  readonly bestStep: number | null;
  readonly averageStep: number | null;
  readonly bestTps: number | null;
  readonly averageTps: number | null;
  readonly bestAo5Ms: number | null;
  readonly bestAo12Ms: number | null;
  readonly averageObserveMs: number | null;
}

/** 单条成绩的高亮标记；并列时全部标记，null / 无效值不参与比较。 */
export interface ScoreHighlight {
  readonly scoreId: string;
  readonly bestTime: boolean;
  readonly worstTime: boolean;
  readonly bestStep: boolean;
  readonly worstStep: boolean;
  readonly bestTps: boolean;
  readonly worstTps: boolean;
  readonly bestAo5: boolean;
  readonly worstAo5: boolean;
  readonly bestAo12: boolean;
  readonly worstAo12: boolean;
}

/** 图表数据；labels 为派生编号，timeSeconds / steps 与 labels 一一对应。 */
export interface ChartSeries {
  readonly labels: readonly number[];
  readonly timeSeconds: readonly number[];
  readonly steps: readonly number[];
}
