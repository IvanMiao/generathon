# PRD — 不存在的导演 / The Director Who Does Not Exist

| 项目属性 | 定义 |
| --- | --- |
| 产品形态 | 面向 AI 电影创作者的 agentic 样片审查、修复与版本决策工具 |
| 配套作品 | 一部暂定 60–120 秒、最长不超过 5 分钟的超现实动画短片 |
| 主要赛道 | Tools for AI Artists；短片作为产品能力的作品证明与演示素材 |
| 核心用户 | 使用 CapCut、Dreamina、Seedance、Runway 等工具创作短片的个人导演与小团队 |
| 产品主语言 | English；允许非英语创意输入，但 UI、操作数据、日志、导出和 demo 默认使用英语 |
| 黑客松约束 | 29 小时开发；公开 GitHub 仓库；解释与 demo 视频不超过 2 分钟 |
| 文档状态 | MVP PRD v0.1，2026-08-01 |

## Product Summary

“不存在的导演”不是另一个一键文生视频产品，而是位于创作意图与视频生成模型之间的隐形导演系统。

用户给出影片概念、视觉参考和不可违背的创作规则。系统将其转化为导演圣经、镜头图和逐镜验收条件，调用或协助用户调用不同的视频生成平台，随后自动检查生成结果，指出带时间戳的失败证据，并决定接受、局部修改 prompt、替换参考素材、拆分镜头、重新生成或保留有价值的意外。

配套短片同样名为《不存在的导演》。导演不会作为角色直接出现，只通过被选择、删除、变形和保留的影像显现。最终揭示它既不是纯粹的 AI，也不是某个人，而是人和模型在持续判断中形成的赛博朋克式共同作者。

## Problem Statement

AI 电影创作者已经可以在 CapCut Director Mode 等产品中，从脚本生成多场景、几分钟长度的视频，也可以使用 Seedance 等模型逐段生成镜头。但当前工作流仍存在以下问题：

1. CapCut 的高层 Director Mode 主要是交互式网页工作流，没有公开、稳定的 CLI 或 API 可供 agent 完整操作，创作者仍需反复手动输入、等待、下载和比较结果。
2. 视频模型能生成视觉上惊艳的片段，但不能假设它一定完成指定动作、保持角色和空间连续、遵守镜头语言，或理解抽象叙事要求。
3. 一键整片会隐藏逐镜失败。创作者往往到成片阶段才发现错误，之后只能凭感觉重写整段 prompt 或重新生成全部内容。
4. 现有生成平台通常优化“生成更多内容”，而不是提供跨模型的验收标准、失败证据、版本比较和预算约束。
5. 快切、电子乐 MV、超现实变形等形式尤其难以只靠通用视频理解模型审查；默认低频采样可能错过瞬时动作和节奏问题。
6. 创作者需要保留模型的意外性。一个只会把异常判定为错误的 QA 系统，会把有价值的超现实结果修成平庸的正确结果。

从用户视角看，核心问题不是“我没有视频生成模型”，而是“我无法把创作意图持续、可验证地贯彻到几十个不稳定的生成镜头中”。

## Goals and Success Criteria

### Product goals

1. 将抽象创意编译为可执行、可审查的镜头任务，而不是只生成一段自由文本 prompt。
2. 为每个生成镜头给出结构化、带时间戳和证据的审片结论。
3. 自动提出最小 prompt 修改和恢复策略，避免无依据地完全重写 prompt。
4. 支持 API 模型和手动 CapCut 工作流共存，且未来能够替换生成供应商。
5. 把“保留意外”设计成正式决策，使系统既能保障完成度，又不消灭创作性偏差。
6. 让配套短片成为产品价值的可见证明：观众能够看到一个失败镜头如何被识别、修复或有意识地保留。

### MVP success criteria

1. 完成至少 6 个镜头的端到端流程：创意输入、分镜、生成或导入、审查、版本决策、组片。
2. 至少展示一次由系统发现的明确失败、一次 prompt patch 后的修复，以及一次被人类标记为“有价值意外”的结果。
3. 每份语义审片报告至少包含验收项、通过状态、时间戳、观察证据、置信度和建议动作。
4. 最终版本通过时长、编码、黑帧、冻结帧、音轨存在性等硬性检查。
5. 每个镜头的来源模型、输入素材、prompt 版本、生成次数、成本或 credits、审片结论均可追溯。
6. 默认每个镜头最多自动重试 2 次；达到上限后必须转为拆镜头、确定性后期、人工处理或接受偏差。
7. 在没有 CapCut API 的情况下，用户仍能通过“生成任务卡 → 手动生成 → 拖入结果”的降级路径完成全部核心流程。
8. Tool demo 在 2 分钟内能够清楚呈现“意图 → 失败证据 → 修复决策 → 成片”的价值链。

### Judging alignment

| 评分项 | 产品证明 |
| --- | --- |
| Creativity / originality | “隐形导演”既是工具机制，也是短片叙事主题；系统能保留创作性意外 |
| Execution quality | 硬性视频 QA、版本管理、逐镜验收和最终自动组片 |
| AI technical mastery | 多模型路由、结构化输出、视频理解、prompt repair、provider capability detection |
| Impact / usefulness | 减少 AI 创作者反复手动审片、重输 prompt 和整体重生的时间与成本 |

## Solution

产品是一个 local-first 的“Dailies Room / 样片室”。它提供四个相互连接的工作空间：

1. **Director Bible**：用户定义影片命题、叙事规则、视觉 DNA、角色与物件、声音原则、禁用元素和参考图。
2. **Shot Graph**：Gemini 将创意拆成镜头，但每个镜头都必须有叙事功能、输入参考、生成策略和可观察的验收条件。
3. **Dailies Review**：系统导入或接收生成结果，运行确定性检查和 Gemini 语义审片，在播放器时间轴上显示证据。
4. **Decision & Repair**：用户比较版本，接受、拒绝、保留意外或执行最小修复；被接受的镜头进入自动组片。

系统不承诺“自动把任何 prompt 变成好电影”。它承诺让失败更早暴露、让修改有证据、让每次生成的去留成为可追溯的导演决定。

## Product Principles

1. **意图先于 prompt**：保存的是结构化创作意图；各模型 prompt 只是可重新编译的供应商输出。
2. **证据先于评分**：不使用一个无法解释的总分决定镜头命运。
3. **局部修复先于整体重生**：优先修改失败的动作、参考或镜头段落。
4. **能力边界显式化**：模型不支持的时长、参考类型、首尾帧或局部编辑必须在调用前显示。
5. **人类拥有最终剪辑权**：agent 可以建议和执行低风险操作，审美判断必须允许人类否决。
6. **意外不是默认错误**：奇异但有表现力的结果可以作为 Creative Mutation 被正式接受。
7. **预算是创作约束**：重试次数、预计成本和剩余 credits 参与决策。
8. **不依赖脆弱 UI 自动化**：没有正式 API 时采用清晰的人工交接，不抓取私有接口或模拟点击作为核心能力。

## Target Users

### Primary persona: AI filmmaker

独立创作者或 2–4 人的小团队，具备审美和叙事概念，但没有传统制片团队；同时使用多个生成平台，希望减少重复操作并提高镜头一致性。

### Secondary persona: creative technologist

希望把新的视频、图像和理解模型快速接入同一工作流，并比较不同模型在特定镜头上的表现。

### Demo audience: judges and viewers

不需要理解模型 API，但应在短时间内看懂：系统发现了什么问题、为何选择修复，以及修复如何改变最终影片。

## Core User Journey

1. 用户新建项目，输入片名、时长、画幅、核心命题和创作参考。
2. Gemini 进行创意扩展，用户选择或编辑一套 Director Bible。
3. Gemini 生成 Shot Graph；用户调整镜头顺序、时长、叙事功能和硬/软验收项。
4. 系统为每个镜头生成关键帧或视觉探索图，并将选中的图作为视频参考。
5. Provider Router 检测已配置能力：API 可用时自动提交；CapCut 只能手动时生成可复制的任务卡。
6. 视频完成后进入样片室。系统先运行机械检查，再调用 Gemini 进行语义、连续性和创意审查。
7. Decision Policy 将结果分为 Accept、Repair、Split、Fallback、Creative Mutation 或 Human Review。
8. Gemini 根据失败证据生成最小 Prompt Patch；用户确认后提交新版本。
9. 用户并排比较 takes，锁定镜头。
10. 系统自动组装已锁定镜头、配临时音轨并导出预览与审计清单。
11. 用户可将成片导入 CapCut 做最终调色、声音和精剪。

## User Stories

1. As an AI filmmaker, I want to describe my film in natural language, so that I can begin without learning a provider-specific prompt syntax.
2. As an AI filmmaker, I want the system to preserve my thematic statement and visual rules, so that later agents do not dilute the original idea.
3. As an AI filmmaker, I want to upload image, text, and video references with usage labels, so that the system knows whether each reference controls character, prop, palette, composition, motion, or rhythm.
4. As an AI filmmaker, I want Gemini to propose several bold visual directions, so that I can explore beyond the first obvious interpretation.
5. As an AI filmmaker, I want to approve a Director Bible before generation, so that autonomous work starts from explicit creative constraints.
6. As an AI filmmaker, I want the story broken into editable shots with narrative purposes, so that I can reason about the film rather than isolated prompts.
7. As an AI filmmaker, I want every shot to have hard and soft acceptance criteria, so that success can be reviewed consistently.
8. As an AI filmmaker, I want the agent to explain why a shot exists, so that visually impressive but narratively empty shots can be removed.
9. As an AI filmmaker, I want to generate and compare keyframes before video, so that expensive motion generation begins from an approved visual direction.
10. As an AI filmmaker, I want image references to remain attached to the relevant characters and shots, so that consistency does not rely on repeatedly finding files.
11. As an AI filmmaker, I want prompts compiled for each video provider, so that one canonical shot specification can be tested across models.
12. As an AI filmmaker, I want the tool to detect provider capabilities before submitting a job, so that unsupported duration or reference options fail early.
13. As an AI filmmaker, I want API-based generation when credentials are available, so that I do not manually repeat routine tasks.
14. As a CapCut user, I want a copy-ready manual task card when no Director API exists, so that the remaining manual operation is precise and minimal.
15. As a CapCut user, I want to drag exported takes back onto the matching shot card, so that manual and automated generations share the same review flow.
16. As an AI filmmaker, I want generation status, elapsed time, retries and cost shown per shot, so that I can control the production budget.
17. As an AI filmmaker, I want corrupt files, black frames, freezes and missing audio detected automatically, so that I do not spend expensive model review on obvious failures.
18. As an AI filmmaker, I want semantic review tied to timestamps, so that I can immediately inspect the evidence.
19. As an AI filmmaker, I want the critic to compare a take against adjacent accepted shots, so that continuity is assessed across cuts rather than in isolation.
20. As an AI filmmaker, I want rapid motion and fast cuts inspected with supplemental extracted frames, so that low-frequency video sampling does not miss important events.
21. As an AI filmmaker, I want aesthetic feedback separated from hard failures, so that subjective taste is not presented as a technical fact.
22. As an AI filmmaker, I want a generated anomaly to be markable as Creative Mutation, so that productive accidents become part of the film language.
23. As an AI filmmaker, I want the system to propose the smallest possible prompt change, so that successful parts of a take remain stable.
24. As an AI filmmaker, I want recovery actions other than regeneration, so that impossible prompts can be split, composited, reframed or solved in editing.
25. As an AI filmmaker, I want automatic retries capped, so that an agent cannot consume unlimited credits chasing an unreliable criterion.
26. As an AI filmmaker, I want to compare takes side by side with their prompts and reviews, so that version selection is an informed directing decision.
27. As an AI filmmaker, I want to lock an accepted take, so that later automation cannot silently replace it.
28. As an AI filmmaker, I want accepted shots assembled automatically in timeline order, so that I can review the evolving film at any time.
29. As an AI filmmaker, I want to export a project manifest and review log, so that the creative process is reproducible and demoable.
30. As a creative technologist, I want providers behind a common interface, so that new models can be tested without rewriting the product workflow.
31. As a creative technologist, I want model IDs and capabilities pinned per run, so that preview-model changes do not invalidate comparisons.
32. As a judge, I want to see a before/after repair with evidence, so that the agentic value is immediately understandable.
33. As a judge, I want the final film and tool behavior to express the same “invisible director” idea, so that the product and artwork feel conceptually unified.
34. As a project contributor, I want secrets excluded from the public repository and exported manifests, so that the hackathon submission is safe to share.

## Functional Scope and Priority

### P0 — required for the hackathon demo

| Capability | Requirement |
| --- | --- |
| Project setup | Create project, runtime, aspect ratio, concept, references and budget limits |
| Director Bible | Generate, edit and approve themes, motifs, visual DNA, invariants, forbidden elements and sound direction |
| Shot Graph | Create and reorder shots; define narrative beat, duration, prompt intent, references and acceptance rubric |
| Gemini visual development | Generate/edit keyframes and reference images; attach approved assets to shots |
| Provider router | Support one working automated video API plus a CapCut manual workflow |
| Take ingestion | Upload, associate, version and preview MP4/MOV/WebM takes |
| Mechanical QA | Probe media, detect black/frozen/duplicate frames, verify duration/resolution/audio and create scene metadata |
| Gemini video critic | Produce structured timestamped review against shot and continuity criteria |
| Prompt patch | Convert failed criteria into minimal provider-specific prompt changes and a recovery recommendation |
| Human decision | Accept, reject, repair, split, fallback or accept as Creative Mutation |
| Retry guard | Enforce per-shot retry and budget limits |
| Version compare | Compare at least two takes with prompts, evidence and decision history |
| Assembly | Concatenate locked shots, normalize output and export an H.264 preview |
| Audit | Show the end-to-end creative decision log for the demo |

### P1 — implement if P0 is stable

1. Beat and onset analysis for electronic-music synchronization.
2. Automatic comparison of the current cut with a rhythm reference video.
3. A second independent VLM critic for borderline or high-cost shots.
4. CapCut/Jianying draft export through a separately reviewed third-party adapter.
5. First/last-frame and video-extension recovery strategies.
6. Contact-sheet view with review annotations.
7. Cost estimation across providers before generation.
8. Exportable 50-second face-cam explanation outline and 2-minute demo script.

### P2 — post-hackathon

1. Official CapCut Director Mode adapter if an API becomes available.
2. Multi-user comments, approvals and remote project sharing.
3. Reusable Director personas and project templates.
4. Learned preference model based on the creator’s accept/reject history.
5. Automated sound design, music generation and final mix.
6. Hosted worker queue, cloud artifact storage and production authentication.
7. Plugin marketplace for providers, critics and export targets.

## Agentic Workflow

### Agent roles

| Role | Responsibility | Default implementation |
| --- | --- | --- |
| Creative Director | Develop concept, Director Bible, shot purpose and alternative visual ideas | Stable Gemini multimodal/text model with structured output |
| Prompt Compiler | Convert canonical ShotSpec into provider-specific prompt and reference mapping | Gemini with versioned provider playbooks |
| Production Coordinator | Submit jobs, poll status, ingest assets and enforce budgets | Deterministic orchestration code, not an LLM |
| Mechanical Inspector | Inspect files, frames, cuts and audio | FFmpeg/ffprobe plus optional OpenCV |
| Video Critic | Evaluate prompt adherence, action, continuity, composition and narrative clarity | Gemini video understanding |
| Repair Planner | Select reprompt, reference change, split, edit, fallback or acceptance | Gemini constrained by deterministic policy |
| Human Director | Approve Bible, lock takes, judge taste and override any agent | User |

### Decision classes

1. **Hard Fail**：文件损坏、黑帧、冻结、主体或关键动作缺失、错误时长等，可自动拒绝或修复。
2. **Soft Fail**：风格漂移、构图平庸、节奏薄弱、情绪不成立，必须展示证据并等待人类确认。
3. **Continuity Fail**：与前后镜头在角色、物件、方向、光线或空间关系上冲突。
4. **Capability Fail**：失败来自模型能力或请求参数不支持，系统不得重复相同调用。
5. **Creative Mutation**：偏离原始要求，但产生了有价值的超现实意义；只有人类可以最终接受。
6. **Accept**：满足硬性要求，软性问题在容忍范围内，进入锁定状态。

### Repair policy

Repair Planner 必须按照以下优先顺序选择动作：

1. 修正明显的请求参数或参考素材映射。
2. 对失败条件做最小 prompt patch，保留已经成功的部分。
3. 增加、替换或简化关键帧和参考图。
4. 将复杂动作拆成更短、单一目的的镜头。
5. 使用首尾帧、延长、video-to-video 或局部编辑能力。
6. 使用裁切、变速、合成、遮罩或声音等确定性后期解决。
7. 更换视频生成模型。
8. 请求人类接受偏差、重写镜头或删除镜头。

系统不得对相同请求无限重试，也不得因单一审美评分自动删除用户已锁定的镜头。

## Model Strategy

### Gemini responsibilities

1. **创意导演与创意 prompt**：默认使用稳定 Gemini 模型，将概念转成多个视觉方向、Director Bible、ShotSpec 和结构化 Prompt Intent。模型名称通过配置固定，不依赖会热切换的 `latest` 别名。
2. **图像生成与编辑**：默认使用 Gemini 3.1 Flash Image / Nano Banana 2 进行关键帧、角色/场景探索和多轮编辑；关键 hero frame 可选择 Nano Banana Pro。所有图像必须记录模型、prompt、参考素材和 SynthID 状态。
3. **视频理解**：使用 Gemini File API/Interactions API 上传并复用视频，要求返回严格结构化、带时间戳的审片报告。
4. **Prompt Repair**：Gemini 只能依据失败项和证据输出 patch，不允许在没有说明的情况下改动主题、角色不变量或已成功的镜头属性。

### Gemini video-review limitation

Gemini 官方视频理解流程默认约 1 FPS 采样，可能遗漏快切、单帧异常和高速运动。因此审片必须采用双通道：

1. 原视频交给 Gemini 分析音画、语义、动作和叙事。
2. 本地工具在镜头切点、动作窗口和疑似异常区间补充密集抽帧或 contact sheet，再以多图输入进行二次检查。
3. 黑帧、冻结、重复、音频响度、编码和精确时长不交给 Gemini 猜测。
4. 对关键镜头允许人工逐帧检查；模型结论不得被描述为客观真相。

### Video generation providers

视频生成通过统一 Provider Adapter 调用，首个 MVP 只要求打通一个正式 API：

1. **Runway Seedance 2.0 adapter**：当前公开 API 已提供 Seedance 2.0、Fast 和 Mini，可作为自动化主路径候选。
2. **BytePlus ModelArk Seedance 2.0 adapter**：作为直接官方供应商路径，支持异步任务和多模态参考。
3. **CapCut Manual adapter**：生成 Director Mode/Seedance 2.5 的复制任务卡、素材清单和结果导入入口，不进行浏览器自动点击。
4. **CapCut Official adapter**：仅在主办方提供正式接口、权限和文档时启用。
5. **Veo adapter**：作为模型对照或 Seedance 无法完成镜头时的可选 fallback，不是 P0 依赖。

每个 adapter 必须声明其实际能力，包括支持的输入类型、最长时长、画幅、分辨率、音频、首尾帧、参考数量、编辑、延长、任务轮询和成本。UI 中只显示该 adapter 真正支持的控制项。

### Model separation

生成模型与主要审片模型必须不同。MVP 中由 Seedance 等模型生成、Gemini 审片，可以减少生成模型对自身输出的偏好。Creative Director、Prompt Compiler 和 Repair Planner 可以共用 Gemini，但使用不同的结构化角色指令和上下文边界。第二个 critic 仅用于边界案例，避免不必要的延迟和成本。

## Companion Film Brief

### Working title

《不存在的导演 / The Director Who Does Not Exist》

### Narrative proposition

一个没有被看见的导演正在组织一座不可能存在的城市。城市由被丢弃的镜头、没有执行的场记、提前行动的影子和彼此矛盾的空间构成。人物以为自己在寻找导演，实际上他们的每次偏离、重拍和保留都在共同生成导演。

结尾不出现一个实体 AI，也不揭示幕后控制者。只留下不断修订的规则、版本痕迹和一个由人类接受的“错误”：导演存在于选择关系之中。

### Inspiration and originality boundary

叙事结构可从《看不见的城市》的城市—观念关系和用户提到的《人生拼图版》获得启发，但不得复写具体段落、人物或场景。视觉不模仿某位真实在世导演的可识别个人风格，而是建立原创的形式规则。

### Visual DNA

1. 超现实动画与电子乐 MV 的速度和能量。
2. 2D 绘画、低多边形 3D、扫描纹理和数字界面残影混合，但每章只突出一种主材质。
3. 大胆的不连续色彩：酸性青绿、灼热洋红、深蓝黑和间歇性暖灰。
4. 空间可以折叠，物件可以先于人物行动，影子可以比身体提前一秒。
5. Director UI 不直接作为解释性屏幕录制塞入电影；版本号、框线、裁切标记和时间码应转化为世界内部的建筑或物理现象。
6. 允许硬切、match cut、循环和节拍驱动变形；避免均匀、无目的的 AI 慢镜头漂移。

### Candidate sequence

1. **The Unshot City**：建筑由空白分镜卡折叠而成，镜头指令成为道路。
2. **The Rehearsal Without a Director**：人物不断排练，但影子总比身体先完成动作。
3. **The Archive of Rejected Takes**：失败生成物生活在被删除的城市，错误开始产生新的秩序。
4. **The Accepted Error**：人类保留一个违反原 prompt 的镜头，城市第一次停止重拍。

候选段落是创作起点，不是必须自动执行的最终剧本。

## Competitive Positioning

1. **CapCut Web Video Studio Director Mode** 已提供场景卡、素材组织和单镜头重做，优势是一体化创作体验；当前公开材料没有提供可供外部 agent 使用的 Director API。
2. **Runway API** 已支持多个视频模型、异步生成和 multi-shot recipe，优势是正式开发者接口；它解决生成与组装，但不是以跨供应商、逐条证据审片和创作性意外治理为核心。
3. **BytePlus ModelArk / VideoPilot** 提供 Seedance 生成和部分 agentic 分段能力，但模型版本、地区权限和高层 API 可用性需要实际账号验证。
4. 本产品的差异点不是拥有独家视频模型，而是提供跨平台的“意图编译 → 审片证据 → 有预算的修复 → 人类选择”闭环，并让这个闭环成为一部电影的创作主题。

## Implementation Decisions

### Architecture

系统采用 local-first 单用户架构，优先保证黑客松现场稳定性和公开仓库可运行性：

1. Web 前端提供 Director Bible、Shot Graph、Dailies Review 和版本比较界面。
2. Python 服务负责 agent orchestration、媒体探测、Gemini 调用、视频 provider adapters 和组片。
3. SQLite 保存项目、镜头、take、review、provider run 和 decision 元数据。
4. 视频、图像、contact sheet、代理文件和导出结果保存在本地项目 artifact store。
5. 长任务采用可恢复的持久状态和后台 worker；MVP 不引入分布式消息队列。
6. 所有外部任务返回后立即下载并保存结果，不把有时效的供应商 URL 当作永久素材地址。

### Deep modules

1. **Creative Intent Compiler**：以稳定的 Director Bible 和 ShotSpec 为输入，封装创意扩展与结构化输出。外部只看到规范化意图，不依赖某个模型的 prompt 格式。
2. **Provider Capability Router**：统一能力发现、任务提交、状态轮询、结果获取、成本记录和错误分类。新增 provider 不改变上层镜头工作流。
3. **Review Engine**：组合机械检查、Gemini 视频理解、密集帧复核和相邻镜头连续性，输出统一 ReviewReport。
4. **Repair Policy Engine**：把 ReviewReport 转成有限动作集合，执行重试上限和预算规则；LLM 提建议，确定性策略决定是否允许执行。
5. **Artifact & Provenance Store**：保证每个输出都能追溯到输入、模型、prompt、参考素材、运行和人类决定。
6. **Timeline Assembler**：只消费已锁定 takes，进行画幅、帧率、音频和编码规范化并导出成片。

这些模块应拥有小而稳定的接口，能够在没有真实付费 API 的情况下用 fixtures 独立测试。

### Core domain records

1. **Project**：片名、命题、目标时长、画幅、预算、当前 cut。
2. **DirectorBible**：主题、世界规则、视觉 DNA、角色/物件不变量、声音规则、禁用项、参考素材。
3. **ShotSpec**：叙事 beat、目标时长、动作、镜头、参考、硬/软验收项、前后连续性、provider strategy。
4. **Take**：媒体 artifact、来源、prompt 版本、参考版本、生成参数、状态和锁定状态。
5. **ReviewReport**：机械指标、逐项语义判断、时间戳证据、置信度、连续性比较和建议。
6. **PromptPatch**：保留、添加、删除和修改的 prompt 字段，以及变更对应的失败证据。
7. **Decision**：接受、拒绝、修复、拆分、fallback、Creative Mutation 或人工审查，并记录操作者和理由。
8. **ProviderRun**：模型、版本、任务 ID、状态、延迟、credits/成本、错误和产物。

### Shot state model

镜头状态依次为 Draft、Ready、Generating 或 Waiting for Manual Generation、Reviewing、Needs Decision，之后进入 Locked、Repairing、Split、Fallback 或 Removed。只有 Locked take 可以进入最终组片。任何自动化都不能修改 Locked take，除非用户主动解锁。

### Structured model outputs

Gemini 的 Director Bible、ShotSpec、ReviewReport 和 PromptPatch 必须使用版本化 schema 校验。无法解析、字段缺失或引用不存在的时间戳时，调用被视为失败，不得直接写入正式项目状态。自由文本只用于解释，不作为自动执行依据。

### Security and rights

1. API keys 只从本地环境读取，不进入数据库导出、日志、截图或公开仓库。
2. 上传素材默认只发送给用户明确启用的 provider。
3. 项目记录每个参考素材的来源和使用权声明。
4. 不实现未经授权的 CapCut 私有接口抓取、session token 复用或规避平台限制。
5. 第三方 CLI 的二进制、许可、云端上传路径和数据保留政策必须单独审核后才能启用。

### Observability

每个 agent 步骤显示输入摘要、模型、开始/结束时间、状态、可重试错误、输出 schema 版本和成本。面向演示的 Activity Feed 只显示创作决策，不泄露 secrets 或内部 chain-of-thought。

## Testing Decisions

### Test philosophy

测试外部可观察行为和稳定 contracts，不断言模型内部推理或特定措辞。真实生成模型具有非确定性，核心测试使用固定媒体 fixtures、录制的 provider responses 和 schema-valid model outputs；少量付费 smoke tests 仅验证真实 API 集成仍然可用。

### Modules to test

1. **Creative Intent Compiler**：给定同一已批准 Bible，输出必须符合 schema、保留不变量，并拒绝擅自删除禁用项或验收项。
2. **Provider Capability Router**：验证能力不支持时早失败、任务状态映射、过期 URL 下载、重试分类和成本记录。
3. **Mechanical Inspector**：使用正常、黑帧、冻结、无音轨、错误分辨率和损坏文件 fixtures 验证报告。
4. **Review Engine**：验证机械证据与模型证据合并、时间戳范围、相邻镜头引用和低置信度升级人工审查。
5. **Repair Policy Engine**：验证最大重试次数、预算上限、锁定镜头保护、Capability Fail 不重复调用，以及 Creative Mutation 必须人工确认。
6. **Artifact & Provenance Store**：验证同一素材去重、版本不可变、来源追溯和 secrets 不进入导出。
7. **Timeline Assembler**：验证只使用 Locked take、输出时长、画幅、帧率、音频和镜头顺序。
8. **End-to-end workflow**：用 3 个短 fixture 镜头走通导入、失败、patch、接受和组片，不依赖付费模型。

### Real-model evaluation set

在正式制作短片前建立 8–12 个短测试镜头，覆盖：

1. 单角色身份和服装连续。
2. 两个主体的空间调度。
3. 指定镜头运动。
4. 影子先于身体行动等精确时间逻辑。
5. 物件在镜头中的出现和消失。
6. 超现实材质变形。
7. 快切和高运动密度。
8. 首尾帧过渡。
9. 画面内文字或符号。
10. 与电子乐节拍同步的剪辑点。

同一 ShotSpec 在候选 provider 上生成，记录成功率、人工偏好、平均尝试次数、成本、延迟和主要失败模式。测试目标是确定模型边界，不是证明某个模型“最好”。

### Acceptance tests for the demo

1. 断开一个 provider 后，手动 CapCut 路径仍可完成工作流。
2. 输入一个包含黑帧或冻结段的 take，系统能在报告中定位问题。
3. 输入一个语义错误但文件正常的 take，Gemini 能给出符合 schema 的时间戳证据；低置信度时进入人工复核。
4. 触发第三次相同重试时，系统阻止调用并要求选择 fallback。
5. 锁定 take 后，任何 agent 自动动作均不能替换它。
6. 导出的成片和 manifest 能对应到所有最终镜头的来源与决定。

### Prior art

仓库目前只有活动 PDF，没有现有代码、测试框架或相似测试。实现时应优先建立 provider contract fixtures、媒体 fixture 工厂和一条端到端 happy-path 测试，作为后续模块的测试先例。

## Delivery Plan

### Hackathon MVP sequence

1. 建立数据模型、项目创建和 Shot Graph 基础界面。
2. 打通 Gemini 结构化创意输出和视频审片。
3. 完成媒体上传、播放器、FFmpeg 机械检查和时间戳证据显示。
4. 打通一个公开视频 API；同时实现 CapCut 手动任务卡。
5. 完成 Prompt Patch、重试守卫、版本比较和 take 锁定。
6. 完成自动组片并用配套短片素材跑通。
7. 最后再进行视觉润色、第二 provider 或 P1 能力。

### Demo narrative

1. 展示《不存在的导演》的 Director Bible 和某个关键镜头要求。
2. 播放第一次生成：视觉漂亮但影子没有提前行动。
3. 展示 Gemini 与机械检查给出的时间戳证据。
4. 展示最小 Prompt Patch 和第二个 take。
5. 展示另一个“错误”被人类接受为 Creative Mutation。
6. 播放最终短片片段和完整 decision trail。

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| CapCut Director 没有公开 API | 手动任务卡是正式降级路径；不把 UI 自动化放入 P0 |
| Seedance 2.5 仅在 UI 可用 | 自动修复使用公开的 Seedance 2.0 API；通过 adapter 保留未来升级空间 |
| Gemini 视频采样漏掉快切 | FFmpeg 密集抽帧、机械指标和人工逐帧复核 |
| VLM 对审美判断不稳定 | 硬/软标准分离；证据化输出；人类终审；可选第二 critic |
| Prompt 修改不能修复模型能力问题 | Capability Fail、拆镜头、参考帧、后期合成和 provider fallback |
| 生成成本或队列超预算 | 关键帧先行、低成本模型预演、逐镜预算和最多两次自动重试 |
| 多模型接入拖慢 29 小时开发 | P0 只打通一个自动视频 provider，其他保持 contract 或手动路径 |
| 短片概念压过产品价值 | demo 固定展示一次技术失败、一次修复和一次创作性选择 |
| 产品 UI 时间不足 | 优先完成单一 Dailies Room 主流程，避免建设完整 NLE 时间线 |

## Out of Scope

1. 重新实现 CapCut、Premiere 或 DaVinci Resolve 的完整非线性剪辑功能。
2. 通过浏览器模拟点击或逆向私有接口完全自动操作 CapCut Director Mode。
3. 承诺一次生成完整、连续且无需人工判断的 5 分钟电影。
4. 自动训练新的基础视频、图像或视频理解模型。
5. MVP 中实现多人实时协作、组织权限和云端项目同步。
6. 自动发布到社交平台或代替用户完成对外提交。
7. 把单一 VLM 分数当作影片美学质量的客观评价。
8. 模仿某位真实导演的可识别个人风格。
9. 自动获取或使用缺少授权声明的角色、音乐、电影片段和视觉参考。
10. 保证所有 provider、地区、credits 或预览模型在黑客松期间持续可用。

## Further Notes

### External capability facts informing this PRD

1. CapCut Director Mode 官方页面描述了场景卡、逐镜修改和素材组织，但没有提供外部 API 或 CLI 文档：[CapCut Web Video Studio — Director Mode](https://www.capcut.com/tools/web-video-studio-director-mode)。
2. Gemini API 能处理视频的视觉和音频、返回时间戳信息；官方同时说明默认约 1 FPS 采样，因此本产品不能只依赖其检查快动作：[Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)。
3. Gemini 当前图像工作流支持 Nano Banana 2/Pro 的生成、编辑和多参考图；生成图带有 SynthID：[Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)。
4. Runway 当前公开 API 列出 Seedance 2.0 系列，并提供正式 Python/Node SDK，可作为 MVP 自动视频 provider：[Runway models](https://docs.dev.runwayml.com/guides/models/) 和 [SDKs](https://docs.dev.runwayml.com/api-details/sdks/)。
5. BytePlus ModelArk 提供 Seedance 2.0 的正式异步生成 API，可作为另一条公开路径：[BytePlus Seedance API](https://docs.byteplus.com/en/docs/modelark/1520757)。

### Questions to validate during the CapCut workshop

1. 活动是否提供未公开的 Director Mode API、SDK、MCP 或项目 JSON 导出？
2. Seedance 2.5 是否有欧洲区可调用 endpoint、正式 model ID 和测试额度？
3. CapCut Pro/活动 credits 是否能用于 API，还是仅限 CapCut UI？
4. 是否支持单场景重新生成、版本回滚、webhook 和素材引用持久化？
5. 公开 GitHub demo 对生成素材、品牌名称和第三方模型输出有哪些展示限制？

### Assumptions

1. 用户接受 MVP 首先服务单个本地创作者。
2. 用户希望 Gemini 承担创意、图像和视频理解，但不要求所有供应商都来自 Google。
3. 用户希望最终拥有真实短片，而不是只演示概念界面。
4. 模块测试优先级默认覆盖 Provider Router、Review Engine、Repair Policy、Artifact Store 和 Timeline Assembler；如时间不足，视觉界面以端到端 smoke test 为主。
5. 当前目录尚未初始化为 Git 仓库；公开仓库、许可证、README 和贡献者信息需要在实现阶段补齐。
