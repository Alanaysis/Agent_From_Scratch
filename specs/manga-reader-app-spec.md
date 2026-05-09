# 漫画阅读器 App - 产品规格文档 (Spec)

> 版本: 1.0 | 日期: 2026-05-05 | 状态: Draft

---

## 1. 项目概述

### 1.1 项目名称
**MangaReader**（暂定名）

### 1.2 项目目标
开发一款跨平台手机 App，支持从多个漫画数据源拉取资源，整合到本地进行在线/离线观看。核心设计理念是"一个 App 看所有"。

### 1.3 技术栈
| 层级 | 技术选型 |
|------|----------|
| 框架 | Flutter (Dart) |
| 状态管理 | Riverpod + Freezed |
| 本地存储 | Isar (NoSQL) |
| 网络请求 | Dio |
| 图片缓存 | cached_network_image |
| 插件系统 | 动态加载（Dart 库/包） |
| 构建 | flutter build (Android APK/IPA) |

---

## 2. 功能需求

### 2.1 核心功能 (MVP)

#### 2.1.1 源管理
- [ ] 内置 MangaDex 官方 API 对接
- [ ] 源列表管理（启用/禁用/排序）
- [ ] 源状态检测（在线/离线/延迟）
- [ ] 手动添加自定义源（可选，V2）

#### 2.1.2 漫画浏览
- [ ] 首页推荐（MangaDex 热门/最新）
- [ ] 搜索（标题、标签、作者、系列）
- [ ] 分类浏览（按类型、状态、语言筛选）
- [ ] 漫画详情页（封面、简介、章节列表、标签）
- [ ] 多源聚合搜索（同一作品合并展示）

#### 2.1.3 阅读器
- [ ] 图片加载与缓存
- [ ] 阅读方向：从左到右 / 从右到左 / 从上到下
- [ ] 滚动模式 / 分页模式
- [ ] 双页模式（仅横向）
- [ ] 图片缩放与平移
- [ ] 阅读进度记忆（按章节/每话）
- [ ] 全屏沉浸式阅读

#### 2.1.4 下载与离线
- [ ] 单话下载 / 批量下载
- [ ] 下载队列管理
- [ ] 离线阅读
- [ ] 下载空间管理（清理/查看占用）
- [ ] 下载进度显示

#### 2.1.5 用户数据
- [ ] 阅读历史记录
- [ ] 书架/收藏管理
- [ ] 本地书签

### 2.2 扩展功能 (V2)

- [ ] 通用爬虫插件系统（HTML 解析器）
- [ ] 自定义源添加（URL + 规则配置）
- [ ] 用户系统（MangaDex 登录）
- [ ] 多用户支持
- [ ] 云同步（可选后端）
- [ ] 评论/评分
- [ ] 通知（新章节更新提醒）
- [ ] 深色/浅色主题
- [ ] 字体大小调节（文本漫画）
- [ ] 屏幕旋转锁定
- [ ] 批量删除下载
- [ ] 分享功能

---

## 3. 技术架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────┐
│                  UI Layer                        │
│  (Flutter Widgets + Riverpod Providers)         │
├────────────┬────────────┬──────────┬────────────┤
│  Source    │  Reader    │  Download│  Library   │
│  Provider  │  Provider  │  Provider│  Provider  │
├────────────┼────────────┼──────────┼────────────┤
│            Repository Layer                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ MangaDex │ │ Plugin   │ │  DownloadManager │ │
│  │ Repo     │ │ Repo     │ │                  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────┤
│            Data Layer                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Remote   │ │ Local    │ │  ImageCache      │ │
│  │ (Dio)    │ │ (Isar)   │ │                  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 3.2 插件系统架构

```
┌─────────────────────────────────────┐
│         Plugin Interface            │
│  (抽象基类/接口)                     │
│  - fetchMangaList()                 │
│  - searchManga()                    │
│  - getMangaDetail()                 │
│  - getChapterList()                 │
│  - getChapterPages()                │
│  - parseImageUrls()                 │
└──────────────┬──────────────────────┘
               │
       ┌───────┼───────────┐
       ▼       ▼           ▼
  MangaDex  Plugin A   Plugin B
  Adapter   (HTML)    (API)
```

**插件接口定义：**

```dart
abstract class MangaSourcePlugin {
  String get id;
  String get name;
  String get baseUrl;
  SourceType get type; // api | html
  
  Future<List<Manga>> search(String query, {int page = 1});
  Future<MangaDetail> getDetail(String mangaId);
  Future<List<Chapter>> getChapters(String mangaId);
  Future<List<PageImage>> getPages(String chapterId);
  Future<SourceStatus> checkStatus();
}

enum SourceType { api, html }

class SourceStatus {
  bool isOnline;
  Duration latency;
  String? errorMessage;
}
```

### 3.3 数据流

```
用户操作 → Provider → Repository → [Remote/Local] → 返回数据
                                      │
                                      ▼
                              缓存到 Isar → 返回缓存
```

---

## 4. 数据模型

### 4.1 核心模型

```dart
// 漫画
class Manga {
  String id;           // 来源唯一 ID
  String sourceId;     // 来源标识 (mangadx, plugin-x)
  String title;
  String? description;
  String? coverUrl;
  List<String> tags;
  String? author;
  String status;       // ongoing | completed | hiatus
  String? language;
  DateTime? updatedAt;
  
  // 聚合字段
  int getChapterCount;
  String? matchedFromOtherSource;
}

// 章节
class Chapter {
  String id;
  String mangaId;
  String title;
  int chapterNumber;
  String? volume;
  String language;
  int pageCount;
  DateTime? publishedAt;
}

// 页面图片
class PageImage {
  String imageUrl;
  int pageNumber;
  int width;
  int height;
  String? hash;       // 用于去重
}

// 阅读进度
class ReadingProgress {
  String mangaId;
  String chapterId;
  int currentPage;    // 当前页码（从 1 开始）
  DateTime lastRead;
  double scrollOffset; // 滚动位置
}

// 下载项
class DownloadItem {
  String id;
  String mangaId;
  String mangaTitle;
  String chapterId;
  Chapter chapter;
  DownloadStatus status; // pending | downloading | completed | failed
  String? localPath;
  int downloadedPages;
  int totalPages;
  DateTime createdAt;
  DateTime updatedAt;
}

// 源配置
class SourceConfig {
  String id;
  String name;
  String baseUrl;
  SourceType type;
  bool isEnabled;
  int sortOrder;
  SourceStatus? lastStatus;
  DateTime lastChecked;
}

// 收藏/书架
class LibraryEntry {
  String mangaId;
  String sourceId;
  String title;
  String? coverUrl;
  DateTime addedAt;
  LibraryPosition position; // 书架位置
}

enum LibraryPosition { favorite, reading, planned, dropped, reread }
```

### 4.2 Isar 数据模型

```dart
@Collection()
class MangaCollection {
  @Index()
  String get id;
  String get sourceId;
  String get title;
  String? get description;
  String? get coverUrl;
  List<String> get tags;
  String? get author;
  String get status;
  String? get language;
  DateTime? get updatedAt;
  int get chapterCount;
  String? get matchedFromOtherSource;
}

@Collection()
class ReadingProgressCollection {
  @AutoIncrement()
  int get id;
  
  @Index()
  String get mangaId;
  
  String get chapterId;
  int get currentPage;
  DateTime get lastRead;
  double get scrollOffset;
}

@Collection()
class DownloadItemCollection {
  @AutoIncrement()
  int get id;
  
  String get mangaId;
  String get mangaTitle;
  String get chapterId;
  String get status;
  String? get localPath;
  int get downloadedPages;
  int get totalPages;
  DateTime get createdAt;
  DateTime get updatedAt;
}

@Collection()
class LibraryEntryCollection {
  @AutoIncrement()
  int get id;
  
  @Index()
  String get mangaId;
  
  String get sourceId;
  String get title;
  String? get coverUrl;
  int get position;
  DateTime get addedAt;
}

@Collection()
class SourceConfigCollection {
  @AutoIncrement()
  int get id;
  
  @Index()
  String get sourceId;
  
  String get name;
  String get baseUrl;
  int get type;
  bool get isEnabled;
  int get sortOrder;
  bool get isOnline;
  DateTime? get lastChecked;
}
```

---

## 5. API 设计

### 5.1 MangaDex API 对接

MangaDex 官方 API 文档: https://api.mangadex.org/docs/

| 功能 | 端点 | 说明 |
|------|------|------|
| 搜索 | `GET /manga?title={query}&limit=20&offset={n}` | 标题搜索 |
| 详情 | `GET /manga/{id}` | 漫画详情 |
| 章节列表 | `GET /manga/{id}/feed?limit=100&offset={n}` | 章节列表 |
| 章节详情 | `GET /at-home/server/{chapterId}` | 获取图片服务器 URL |
| 图片 | `GET /data/{hash}/{file}` | 图片下载 |
| 热门 | `GET /manga?order[popularity]=desc` | 热门排行 |
| 标签 | `GET /manga?includes[]=tag&tagIds={id}` | 按标签筛选 |
| 封面 | `GET /manga/{id}/cover` | 获取封面 |

**关键实现细节：**
- 使用 `includes` 参数预加载关联数据（tags, authors, artists, covers）
- 图片 CDN: `https://mangaDex-cdn.net` 或 `https://media.mangadx.org`
- 需要处理分页（limit/offset 或 cursor-based）

### 5.2 通用爬虫插件接口

```dart
class HtmlSourcePlugin extends MangaSourcePlugin {
  // HTML 解析规则（由源配置提供）
  final SourceRules rules;
  
  Future<List<Manga>> search(String query, {int page = 1}) {
    // 1. GET 搜索 URL
    // 2. 使用 html/parser 解析搜索结果
    // 3. 提取 mangaId, title, coverUrl
    // 4. 返回结果
  }
  
  Future<List<PageImage>> getPages(String chapterId) {
    // 1. GET 章节页面
    // 2. 解析图片 URL 列表
    // 3. 返回 PageImage 列表
  }
}

class SourceRules {
  String searchUrlTemplate;    // "{baseUrl}/search?q={query}&page={page}"
  String detailUrlTemplate;    // "{baseUrl}/manga/{id}"
  String chapterUrlTemplate;   // "{baseUrl}/chapter/{id}"
  
  // CSS 选择器 / XPath
  CssSelector mangaListSelector;
  CssSelector mangaTitleSelector;
  CssSelector mangaIdSelector;
  CssSelector coverUrlSelector;
  
  CssSelector chapterListSelector;
  CssSelector chapterTitleSelector;
  CssSelector chapterIdSelector;
  
  CssSelector pageCountSelector;
  CssSelector pageImageSelector;
  CssSelector pageImageUrlSelector;
  
  // 图片 URL 处理
  String Function(String rawUrl)? imageUrlTransformer;
}
```

---

## 6. 模块划分

### 6.1 项目结构

```
lib/
├── main.dart
├── app.dart                    # App 入口 + 路由
├── core/
│   ├── constants/             # 常量
│   ├── errors/                # 错误类型
│   ├── utils/                 # 工具函数
│   │   ├── date_utils.dart
│   │   ├── image_utils.dart
│   │   └── storage_utils.dart
│   └── theme/
│       ├── app_theme.dart
│       └── colors.dart
├── data/
│   ├── models/                # 数据模型
│   │   ├── manga.dart
│   │   ├── chapter.dart
│   │   ├── page_image.dart
│   │   ├── reading_progress.dart
│   │   ├── download_item.dart
│   │   └── source_config.dart
│   ├── repositories/          # 数据仓库
│   │   ├── manga_repository.dart
│   │   ├── chapter_repository.dart
│   │   ├── download_repository.dart
│   │   └── library_repository.dart
│   ├── sources/
│   │   ├── manga_dex/        # MangaDex 源实现
│   │   │   ├── mangadx_source.dart
│   │   │   └── mangadx_api.dart
│   │   └── plugins/          # 插件目录
│   │       ├── base_plugin.dart
│   │       └── html_plugin.dart
│   └── local/
│       ├── isar_service.dart  # Isar 初始化
│       └── migrations/        # 数据迁移
├── domain/
│   ├── services/
│   │   ├── source_manager.dart
│   │   ├── image_cache_service.dart
│   │   └── download_manager.dart
│   └── usecases/              # 业务逻辑
│       ├── search_manga.dart
│       ├── get_manga_detail.dart
│       └── read_chapter.dart
├── presentation/
│   ├── providers/             # Riverpod providers
│   │   ├── source_provider.dart
│   │   ├── search_provider.dart
│   │   ├── reader_provider.dart
│   │   ├── download_provider.dart
│   │   └── library_provider.dart
│   ├── pages/
│   │   ├── home/
│   │   │   ├── home_page.dart
│   │   │   └── widgets/
│   │   ├── search/
│   │   │   ├── search_page.dart
│   │   │   └── widgets/
│   │   ├── manga_detail/
│   │   │   ├── manga_detail_page.dart
│   │   │   └── widgets/
│   │   ├── reader/
│   │   │   ├── reader_page.dart
│   │   │   └── widgets/
│   │   ├── library/
│   │   │   ├── library_page.dart
│   │   │   └── widgets/
│   │   ├── download/
│   │   │   ├── download_page.dart
│   │   │   └── widgets/
│   │   └── settings/
│   │       ├── settings_page.dart
│   │       └── widgets/
│   ├── widgets/               # 可复用组件
│   │   ├── manga_card.dart
│   │   ├── chapter_card.dart
│   │   ├── image_viewer.dart
│   │   ├── loading_indicator.dart
│   │   └── error_view.dart
│   └── navigation/
│       └── app_router.dart
└── generated/
    └── assets.dart
```

### 6.2 关键 Provider 设计

```dart
// 源管理
final sourcesProvider = StateNotifierProvider<SourcesNotifier, List<MangaSource>>((ref) {
  return SourcesNotifier();
});

// 搜索
final searchProvider = FutureProvider.family<List<Manga>, String>((ref, query) async {
  // 并行查询所有启用的源
  final enabledSources = ref.watch(sourcesProvider);
  final results = await Future.wait(
    enabledSources.map((source) => source.search(query)),
  );
  return results.expand((r) => r).toList();
});

// 阅读器
final readerProvider = StateNotifierProvider<ReaderNotifier, ReaderState>((ref) {
  return ReaderNotifier();
});

// 下载管理器
final downloadManagerProvider = Provider<DownloadManager>((ref) {
  return DownloadManager();
});
```

---

## 7. 开发阶段

### Phase 1: 基础设施 (Week 1-2)
- [ ] Flutter 项目初始化
- [ ] Isar 数据库配置 + 数据模型
- [ ] Riverpod 基础 Provider
- [ ] 路由配置
- [ ] 主题系统（深色/浅色）
- [ ] 网络层封装（Dio + 拦截器）
- [ ] 图片缓存层

### Phase 2: MangaDex 源 (Week 3-4)
- [ ] MangaDex API 对接
- [ ] 源管理 UI
- [ ] 首页（推荐/热门/最新）
- [ ] 搜索功能
- [ ] 分类浏览
- [ ] 漫画详情页
- [ ] 章节列表

### Phase 3: 阅读器 (Week 5-6)
- [ ] 图片加载与缓存
- [ ] 阅读器核心（滚动/分页模式）
- [ ] 阅读方向切换
- [ ] 阅读进度保存
- [ ] 图片缩放/平移

### Phase 4: 下载与离线 (Week 7-8)
- [ ] 下载管理器
- [ ] 下载队列
- [ ] 本地存储
- [ ] 离线阅读
- [ ] 下载管理 UI

### Phase 5: 插件系统 (Week 9-10)
- [ ] 插件接口定义
- [ ] HTML 解析器集成
- [ ] 通用爬虫插件
- [ ] 源配置管理
- [ ] 自定义源添加 UI

### Phase 6: 完善与发布 (Week 11-12)
- [ ] 书架/收藏
- [ ] 阅读历史
- [ ] 设置页面
- [ ] 性能优化
- [ ] Bug 修复
- [ ] 打包发布

---

## 8. 非功能需求

### 8.1 性能
- 图片懒加载，首屏 < 1s 加载完成
- 滚动帧率 ≥ 55fps
- 内存占用 < 200MB
- 图片压缩/缩放（根据屏幕 DPI）

### 8.2 兼容性
- Android: API 24+ (Android 7.0+)
- iOS: 13.0+
- 屏幕适配: 手机 + 平板

### 8.3 安全
- HTTP 请求使用 HTTPS
- 本地数据加密（可选）
- 不存储用户凭据明文

### 8.4 用户体验
- 加载状态清晰（骨架屏/Loading）
- 错误处理友好
- 网络异常降级
- 手势操作流畅

---

## 9. 依赖包清单

```yaml
dependencies:
  flutter:
    sdk: flutter
  # 状态管理
  flutter_riverpod: ^2.5.0
  # 本地存储
  isar: ^3.1.0
  isar_flutter_libs: ^3.1.0
  # 网络
  dio: ^5.4.0
  # 图片
  cached_network_image: ^3.3.0
  photo_view: ^0.15.0
  # UI
  flutter_slidable: ^3.0.1
  shimmer: ^3.0.0
  # 其他
  path_provider: ^2.1.0
  permission_handler: ^11.0.0
  share_plus: ^7.2.0
  html: ^0.15.0
  collection: ^1.18.0
  uuid: ^4.3.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
  # Isar 代码生成
  isar_generator: ^3.1.0
  build_runner: ^2.4.0
```

---

## 10. 风险与注意事项

### 10.1 法律风险
- 漫画版权问题：部分站点可能涉及版权争议
- 建议：仅对接合法授权的源（如 MangaDex），避免爬取付费内容
- 爬虫频率限制：避免对源站造成压力

### 10.2 技术风险
- MangaDex API 变更：需要适配机制
- 图片 CDN 防盗链：可能需要处理 Referer/Cookie
- 图片加载性能：大量图片需要优化
- 插件兼容性：不同站点结构差异大

### 10.3 数据源风险
- MangaDex 可能有反爬机制
- 自定义源可能失效（站点改版）
- 建议：源健康检查 + 自动失效机制

---

## 11. 后续演进方向

### V2 规划
- 用户系统（MangaDex 账号同步）
- 云同步（跨设备）
- 更多源对接
- 评论/评分/笔记
- 通知推送
- 多语言 UI
- Web 端（Flutter Web）

### V3 规划
- AI 推荐（基于阅读历史）
- 社区功能
- 漫画创作工具
- PWA 支持
