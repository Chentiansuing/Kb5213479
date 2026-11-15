"""简洁版 i18n 补丁：
1. 在成品 <head> 末尾追加 .lang-switch CSS
2. 在 <body> 开头插入语言切换控件 HTML
3. 在 <script> 标签之后立即插入 LANGS + applyLang + switchLang（独立脚本块）
4. 给页面标题加 data-i18n 对应的 title
5. 给所有 .dlg-h / .dlg-sub / .fld__label / .btn / .link / .opt__t / .opt__d / .sub / .t 等加 data-i18n 标记
"""
import pathlib, re, sys

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
SRC = ROOT / "outputs" / "Windows11SetupSim.html"
DST = SRC.read_text(encoding="utf-8")

# ---------- 1. 样式 ----------
STYLE = """
/* ============ 语言切换 ============ */
.lang-switch{
  position:fixed; left:50%; top:14px; transform:translateX(-50%); z-index:70;
  display:flex; align-items:center; gap:6px; padding:4px; border-radius:20px;
  background:rgba(255,255,255,.70);
  -webkit-backdrop-filter:blur(24px) saturate(160%);
  backdrop-filter:blur(24px) saturate(160%);
  box-shadow:0 4px 18px rgba(30,50,90,.15), inset 0 0 0 1px rgba(255,255,255,.6);
}
.lang-switch button{
  min-width:34px; height:26px; border:0; padding:0 10px; font-size:12px;
  border-radius:16px; background:transparent; color:#2b3440; cursor:pointer;
  font-weight:500; letter-spacing:.3px;
}
.lang-switch button:hover{background:rgba(0,103,192,.08);}
.lang-switch button.on{background:var(--accent); color:#fff; box-shadow:0 2px 8px rgba(0,103,192,.35);}
.lang-switch .sep{width:1px;height:14px;background:rgba(0,0,0,.10);}
"""
DST = DST.replace("</style>", STYLE + "\n</style>", 1)

# ---------- 2. 语言包 JS ----------
LANGS_JS = r"""
<script>
(function(){
  var _langs = {
    'zh-CN': {
      setup_title: 'Windows 11 安装程序',
      btn_next: '下一步', btn_back: '上一步', btn_repair: '修复计算机',
      title_lang: 'Windows 11 安装程序', sub_lang: '选择要安装的语言和其他首选项。',
      lbl_lang: '要安装的语言', lbl_time: '时间和货币格式', lbl_kb: '键盘或输入方法',
      title_key: '激活 Windows',
      sub_key: '输入产品密钥可激活 Windows。如果你没有密钥，可以选择“我没有产品密钥”继续安装，稍后再激活。',
      lbl_key: '产品密钥', note_key: '密钥由 25 个字符组成，输入时会自动分组。',
      btn_no_key: '我没有产品密钥', ph_key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
      title_edition: '选择要安装的操作系统',
      sub_edition: '你可以安装以下任一版本。安装完成后，可在“设置”中升级版本。',
      ed_pro: 'Windows 11 专业版', ed_pro_d: '面向小型企业和高级用户的完整功能，支持 BitLocker、远程桌面和 Hyper-V。',
      ed_home: 'Windows 11 家庭版', ed_home_d: '面向家庭用户的日常体验，包含全新的开始菜单、窗口布局和 Microsoft Store。',
      ed_ent: 'Windows 11 企业版', ed_ent_d: '面向大型组织，提供高级安全性、设备管理和云端连接能力。',
      ed_edu: 'Windows 11 教育版', ed_edu_d: '为学校、教师和学生打造，包含教育机构常用的应用与管理工具。',
      title_license: '适用的通知与许可条款',
      sub_license: '请阅读以下条款。你需要接受这些条款才能继续安装。',
      chk_license: '我接受 Microsoft 软件许可条款和适用的通知。',
      title_type: '你想执行哪种类型的安装？',
      sub_type: '升级会保留文件、设置和应用；自定义安装会重新安装 Windows，你可以自行选择分区。',
      type_upgrade: '升级：安装 Windows 并保留文件、设置和应用',
      type_upgrade_d: '当前是从安装介质启动，无法执行升级安装。请移除介质并从 Windows 中运行安装程序。',
      type_custom: '自定义：仅安装 Windows（高级）',
      type_custom_d: '使用此选项全新安装 Windows。你可以选择要安装到的分区，已安装的程序和文件不会保留。',
      title_disk: '你想将 Windows 安装在哪里？',
      sub_disk: '你可以选择现有分区，或新建分区。安装前请确认重要数据已备份。',
      disk_col1: '名称', disk_col2: '总大小', disk_col3: '可用空间', disk_col4: '类型',
      disk_link1: '刷新', disk_link2: '删除', disk_link3: '格式化',
      disk_link4: '新建', disk_link5: '加载驱动程序',
      disk_tip: '提示：选择“主分区”后点击“下一步”即可开始安装；未分配的空间需要先点击“新建”。',
      disk_info_none: '请选择一个分区。',
      disk_info_unalloc: '已选择未分配的空间 · 请先点击“新建”创建分区。',
      inst_brand: 'Windows 11', inst_target_prefix: '正在安装到', inst_suffix: '请不要关闭你的计算机。',
      rst_title: 'Windows 需要重启才能继续',
      rst_body: '你的电脑将在 {n} 秒后自动重启。', rst_sub: '重启期间请不要关闭电脑或拔出电源。',
      rst_now: '立即重启', boot_prepare: '正在准备 Windows', boot_hint: '请不要关闭你的计算机',
      oobe_region_title: '让我们为你设置区域',
      oobe_region_sub: '选择你所在的国家或地区，以便 Windows 使用合适的日期、时间和内容设置。',
      oobe_country: '国家或地区', oobe_yes: '是',
      oobe_kb_title: '你想使用哪种键盘布局？', oobe_kb_sub: '我们会根据你的区域推荐一种布局。你也可以添加其他布局。',
      kb_pinyin: '微软拼音', kb_pinyin_d: '中文（简体）· 推荐', kb_wubi: '微软五笔', kb_wubi_d: '中文（简体）',
      kb_us: '美式键盘', kb_us_d: '英语（美国）', oobe_skip: '跳过',
      kb2_title: '是否要添加第二种键盘布局？',
      kb2_sub: '如果你经常使用多种语言输入，可以再添加一种键盘布局。你可以稍后在“设置”中添加。',
      kb2_skip_d: '暂时只使用当前键盘布局',
      oobe_net_title: '让我们将你连接到网络', oobe_net_sub: '连接后即可使用 Microsoft 账户、应用商店和云服务。选择一个可用的无线网络。',
      net_sec: '安全 · WPA2', net_open: '开放网络',
      net_str: '信号强', net_good: '信号良好', net_fair: '信号一般',
      oobe_no_net: '我没有 Internet 连接',
      limited_title: '受限设置',
      limited_sub: '你当前未连接到 Internet。你可以继续执行受限设置，稍后再连接网络。部分功能（如 Microsoft Store 和云同步）在联网前不可用。',
      limited_warn: '继续执行受限设置后，你需要使用本地账户登录此设备。',
      limited_continue: '继续执行受限设置',
      device_title: '为这台电脑命名', device_sub: '这个名称用于在网络中识别此设备。你可以稍后在“设置 > 系统 > 关于”中更改。',
      device_label: '电脑名称',
      acc_title: '谁将使用此设备？',
      acc_sub: '登录你的 Microsoft 账户，或创建一个本地账户。使用 Microsoft 账户可以同步设置、OneDrive 文件和 Microsoft Store 内容。',
      acc_personal: '设置供个人使用', acc_personal_d: '使用 Microsoft 账户或本地账户登录此设备',
      acc_work: '设置供工作或学校使用', acc_work_d: '使用组织提供的账户登录，由组织管理此设备',
      ms_title: '登录 Microsoft 账户', ms_sub: '输入你的电子邮件地址。如果还没有账户，可以创建一个，或改用本地账户继续。',
      ms_email: '电子邮件地址', ms_switch_local: '改为使用本地账户',
      local_title: '为这台电脑创建账户', local_sub: '设置用于登录此设备的本地账户。密码可以留空，跳过设置密码。',
      local_user: '用户名', local_user_ph: '例如：Administrator',
      local_pass: '密码（可选）', local_pass2: '确认密码',
      privacy_title: '为你的设备选择隐私设置', privacy_sub: '你的选择会影响 Windows 如何使用你的信息。你可以随时在“设置 > 隐私和安全性”中更改这些选项。',
      p_loc: '位置', p_loc_d: '允许应用使用你的精确位置',
      p_find: '查找我的设备', p_find_d: '允许 Windows 通过网络定位此设备',
      p_diag: '诊断数据', p_diag_d: '发送可选的诊断数据，帮助改进 Windows',
      p_ink: '改进墨迹书写和键入', p_ink_d: '发送书写和键入样本，用于改进语言模型',
      p_tailor: '量身定制的体验', p_tailor_d: '允许 Microsoft 使用诊断数据提供个性化提示',
      p_ad: '广告 ID', p_ad_d: '应用可以使用你的广告 ID 提供相关广告',
      p_local: '本地内容', p_local_d: '在搜索和提示中显示本地文件与应用内容',
      btn_accept: '接受',
      custom_title: '自定义你的体验', custom_sub: '选择你希望 Windows 如何为你提供建议和内容。之后可以随时在设置中关闭。',
      c_tips: '获取有关 Windows 的提示和建议', c_tips_d: '在开始菜单和设置中显示使用技巧',
      c_store: '获取 Microsoft Store 的应用推荐', c_store_d: '根据你的使用情况推荐应用和游戏',
      c_promo: '允许 Microsoft 向你发送促销信息', c_promo_d: '通过电子邮件接收产品更新和优惠',
      final_title: '这可能需要几分钟', final_sub: '请勿关闭你的电脑。我们正在为 {name} 准备好一切。',
      welcome_title: '欢迎使用 Windows 11',
      welcome_body: '安装已完成。双击桌面上的“重新安装 Windows”图标可以再次体验整个过程。',
      demo_title: '演示导航', demo_hint: '按 D 键切换 · 点击直接跳到该阶段',
      demo_g_setup: '安装程序', demo_g_proc: '安装过程',
      demo_g_oobe: '首次开机设置（OOBE）', demo_g_desk: '桌面',
      demo_reset: '重置并重新开始',
      icon_recycle: '回收站', icon_pc: '此电脑', icon_reinstall: '重新安装 Windows',
      start_all_apps: '所有应用', start_more: '更多', start_search_ph: '搜索应用、设置和文档',
      start_recent_hint: '安装完成后，你最近使用的应用和文件会显示在这里。',
      app_edge: 'Microsoft Edge', app_explorer: '文件资源管理器', app_settings: '设置',
      app_photos: '照片', app_calc: '计算器', app_notepad: '记事本',
      app_store: 'Microsoft Store', app_terminal: '终端', app_player: '媒体播放器',
      app_camera: '相机', app_mail: '邮件', app_weather: '天气',
      tray_net_vol: '网络、声音、电池', start_title: '开始',
      tb_search_title: '搜索', tb_widget_title: '小组件', tb_fe_title: '文件资源管理器',
      tb_edge_title: 'Microsoft Edge', tb_store_title: 'Microsoft Store',
      toast_close_title: '退出安装程序？',
      toast_close_body: '如果现在退出，Windows 将不会安装。你可以稍后重新启动安装程序。',
      btn_close_ok: '退出', btn_close_cancel: '继续安装'
    },
    'en-US': {
      setup_title: 'Windows 11 Setup',
      btn_next: 'Next', btn_back: 'Back', btn_repair: 'Repair your computer',
      title_lang: 'Windows 11 Setup', sub_lang: 'Select the language and other preferences to install.',
      lbl_lang: 'Language to install', lbl_time: 'Time and currency format', lbl_kb: 'Keyboard or input method',
      title_key: 'Activate Windows',
      sub_key: 'Enter a product key to activate Windows. If you don\'t have one, select "I don\'t have a product key" to continue and activate later.',
      lbl_key: 'Product key', note_key: 'A product key has 25 characters and is automatically grouped as you type.',
      btn_no_key: 'I don\'t have a product key', ph_key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
      title_edition: 'Select the operating system you want to install',
      sub_edition: 'You can install one of the following versions. You can upgrade from Settings later.',
      ed_pro: 'Windows 11 Pro', ed_pro_d: 'Full features for small businesses and power users, including BitLocker, Remote Desktop and Hyper-V.',
      ed_home: 'Windows 11 Home', ed_home_d: 'Everyday experience for home users with a new Start menu, window layouts and the Microsoft Store.',
      ed_ent: 'Windows 11 Enterprise', ed_ent_d: 'Advanced security, device management and cloud connectivity for large organizations.',
      ed_edu: 'Windows 11 Education', ed_edu_d: 'Built for schools, teachers and students, with tools commonly used in education.',
      title_license: 'Applicable notices and license terms',
      sub_license: 'Please read the following terms. You must accept them to continue.',
      chk_license: 'I accept the Microsoft Software License Terms and applicable notices.',
      title_type: 'Which type of installation do you want?',
      sub_type: 'Upgrade keeps files, settings and apps; Custom installs a fresh copy of Windows and lets you choose partitions.',
      type_upgrade: 'Upgrade: Install Windows and keep files, settings and applications',
      type_upgrade_d: 'You are starting from installation media, so an upgrade is not available. Remove the media and run setup from Windows.',
      type_custom: 'Custom: Install Windows only (advanced)',
      type_custom_d: 'Use this option for a clean install. You can select the partition to install on; your existing programs and files will not be kept.',
      title_disk: 'Where do you want to install Windows?',
      sub_disk: 'You can select an existing partition or create a new one. Make sure your important data is backed up.',
      disk_col1: 'Name', disk_col2: 'Total size', disk_col3: 'Free space', disk_col4: 'Type',
      disk_link1: 'Refresh', disk_link2: 'Delete', disk_link3: 'Format',
      disk_link4: 'New', disk_link5: 'Load driver',
      disk_tip: 'Tip: select a Primary partition and click Next to start. You must click New first for unallocated space.',
      disk_info_none: 'Select a partition to continue.',
      disk_info_unalloc: 'Unallocated space selected. Click "New" to create a partition first.',
      inst_brand: 'Windows 11', inst_target_prefix: 'Installing to', inst_suffix: 'Do not turn off your computer.',
      rst_title: 'Windows needs to restart to continue',
      rst_body: 'Your PC will restart automatically in {n} seconds.', rst_sub: 'Do not turn off your computer or unplug the power while restarting.',
      rst_now: 'Restart now', boot_prepare: 'Preparing Windows', boot_hint: 'Please do not turn off your computer',
      oobe_region_title: 'Let us set your region',
      oobe_region_sub: 'Select the country or region so Windows can use the right dates, times and content.',
      oobe_country: 'Country or region', oobe_yes: 'Yes',
      oobe_kb_title: 'Which keyboard layout do you want to use?', oobe_kb_sub: 'We recommend a layout based on your region. You can add more later.',
      kb_pinyin: 'Microsoft Pinyin', kb_pinyin_d: 'Chinese (Simplified) · Recommended', kb_wubi: 'Microsoft Wubi', kb_wubi_d: 'Chinese (Simplified)',
      kb_us: 'US Keyboard', kb_us_d: 'English (US)', oobe_skip: 'Skip',
      kb2_title: 'Add a second keyboard layout?',
      kb2_sub: 'Add another layout if you often type in other languages. You can change it later in Settings.',
      kb2_skip_d: 'Use only the current keyboard for now',
      oobe_net_title: 'Let us connect you to the network', oobe_net_sub: 'Connect to use your Microsoft account, Store and cloud services. Pick an available wireless network.',
      net_sec: 'Secure · WPA2', net_open: 'Open network',
      net_str: 'Strong signal', net_good: 'Good signal', net_fair: 'Fair signal',
      oobe_no_net: 'I don\'t have Internet',
      limited_title: 'Limited setup',
      limited_sub: 'You are not connected to the Internet. You can continue with limited setup and connect later. Some features (Microsoft Store, cloud sync) will not be available.',
      limited_warn: 'Continuing with limited setup means you will need to sign in with a local account.',
      limited_continue: 'Continue with limited setup',
      device_title: 'Name your PC', device_sub: 'This name identifies your device on the network. You can change it in Settings > System > About later.',
      device_label: 'PC name',
      acc_title: 'Who will use this device?',
      acc_sub: 'Sign in with your Microsoft account or create a local account. A Microsoft account lets you sync settings, OneDrive and Store content.',
      acc_personal: 'Set up for personal use', acc_personal_d: 'Sign in with a Microsoft account or a local account',
      acc_work: 'Set up for work or school', acc_work_d: 'Sign in with an organization account managed by your org',
      ms_title: 'Sign in to your Microsoft account', ms_sub: 'Enter your email address. If you don\'t have one, you can create one or continue with a local account.',
      ms_email: 'Email address', ms_switch_local: 'Sign in with a local account instead',
      local_title: 'Create an account for this PC', local_sub: 'Create a local account to sign in with. You can leave the password blank to skip this step.',
      local_user: 'User name', local_user_ph: 'e.g. Administrator',
      local_pass: 'Password (optional)', local_pass2: 'Reenter password',
      privacy_title: 'Choose privacy settings for your device', privacy_sub: 'Your selections affect how Windows uses your info. You can change them in Settings > Privacy & security at any time.',
      p_loc: 'Location', p_loc_d: 'Let apps use your precise location',
      p_find: 'Find my device', p_find_d: 'Let Windows locate this device over the network',
      p_diag: 'Diagnostic data', p_diag_d: 'Send optional diagnostic data to help improve Windows',
      p_ink: 'Improve inking and typing', p_ink_d: 'Send writing and typing samples to improve language models',
      p_tailor: 'Tailored experience', p_tailor_d: 'Let Microsoft use diagnostic data to provide personalized suggestions',
      p_ad: 'Advertising ID', p_ad_d: 'Let apps use your advertising ID to show relevant ads',
      p_local: 'Local content', p_local_d: 'Show local files and apps in search and tips',
      btn_accept: 'Accept',
      custom_title: 'Customize your experience', custom_sub: 'Choose how Windows can suggest and offer content. You can turn these off later in Settings.',
      c_tips: 'Get tips and suggestions about Windows', c_tips_d: 'Show usage tips in Start and Settings',
      c_store: 'Get app recommendations from Microsoft Store', c_store_d: 'Recommend apps and games based on usage',
      c_promo: 'Let Microsoft send you promotional messages', c_promo_d: 'Get product updates and offers by email',
      final_title: 'This might take a few minutes', final_sub: 'Do not turn off your PC. We\'re getting everything ready for {name}.',
      welcome_title: 'Welcome to Windows 11',
      welcome_body: 'Setup is complete. Double-click the "Reinstall Windows" icon on the desktop to go through the experience again.',
      demo_title: 'Demo navigator', demo_hint: 'Press D to toggle · click to jump',
      demo_g_setup: 'Setup wizard', demo_g_proc: 'Installation',
      demo_g_oobe: 'First-run setup (OOBE)', demo_g_desk: 'Desktop',
      demo_reset: 'Reset and start over',
      icon_recycle: 'Recycle Bin', icon_pc: 'This PC', icon_reinstall: 'Reinstall Windows',
      start_all_apps: 'All apps', start_more: 'More', start_search_ph: 'Search apps, settings, and documents',
      start_recent_hint: 'Recently used apps and files will appear here after setup.',
      app_edge: 'Microsoft Edge', app_explorer: 'File Explorer', app_settings: 'Settings',
      app_photos: 'Photos', app_calc: 'Calculator', app_notepad: 'Notepad',
      app_store: 'Microsoft Store', app_terminal: 'Terminal', app_player: 'Media Player',
      app_camera: 'Camera', app_mail: 'Mail', app_weather: 'Weather',
      tray_net_vol: 'Network, Sound, Power', start_title: 'Start',
      tb_search_title: 'Search', tb_widget_title: 'Widgets', tb_fe_title: 'File Explorer',
      tb_edge_title: 'Microsoft Edge', tb_store_title: 'Microsoft Store',
      toast_close_title: 'Exit setup?',
      toast_close_body: 'If you exit now, Windows will not be installed. You can run setup again later.',
      btn_close_ok: 'Exit', btn_close_cancel: 'Continue setup'
    },
    'ja-JP': {
      setup_title: 'Windows 11 セットアップ',
      btn_next: '次へ', btn_back: '前へ', btn_repair: 'コンピューターを修復する',
      title_lang: 'Windows 11 セットアップ', sub_lang: 'インストール言語とその他の設定を選択してください。',
      lbl_lang: 'インストールする言語', lbl_time: '時刻と通貨の形式', lbl_kb: 'キーボードまたは入力方式',
      title_key: 'Windows のライセンス認証',
      sub_key: 'プロダクト キーを入力して Windows をライセンス認証できます。キーがない場合は、「プロダクト キーがありません」を選んで後で認証することもできます。',
      lbl_key: 'プロダクト キー', note_key: 'キーは 25 文字で、入力時に自動的にグループ化されます。',
      btn_no_key: 'プロダクト キーがありません', ph_key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
      title_edition: 'インストールするオペレーティング システムを選択',
      sub_edition: '次のいずれかのバージョンをインストールできます。インストール後、「設定」からアップグレードできます。',
      ed_pro: 'Windows 11 Pro', ed_pro_d: '小規模ビジネスと上級ユーザー向けの完全機能。BitLocker、リモート デスクトップ、Hyper-V を含む。',
      ed_home: 'Windows 11 Home', ed_home_d: '家庭ユーザー向け。新しい [スタート] メニュー、ウィンドウ レイアウト、Microsoft Store。',
      ed_ent: 'Windows 11 Enterprise', ed_ent_d: '大規模組織向け。高度なセキュリティ、デバイス管理、クラス接続機能。',
      ed_edu: 'Windows 11 Education', ed_edu_d: '学校、教師、学生向け。教育現場でよく使われるアプリと管理ツール。',
      title_license: '適用される通知とライセンス条項',
      sub_license: '以下の条項をお読みください。続行するには同意が必要です。',
      chk_license: 'Microsoft ソフトウェアのライセンス条項と適用される通知に同意します。',
      title_type: 'どのような種類のインストールを行いますか？',
      sub_type: 'アップグレードはファイル、設定、アプリを保持します。カスタムは Windows を再インストールし、パーティションを選べます。',
      type_upgrade: 'アップグレード: Windows をインストールし、ファイル、設定、アプリを保持',
      type_upgrade_d: 'インストール メディアから起動しているため、アップグレードはできません。メディアを取り外して Windows から実行してください。',
      type_custom: 'カスタム: Windows のみをインストール（詳細）',
      type_custom_d: 'このオプションでクリーン インストールを行います。インストール先のパーティションを選べます。既存のプログラムとファイルは保持されません。',
      title_disk: 'Windows をどこにインストールしますか？',
      sub_disk: '既存のパーティションを選ぶか、新しく作成できます。インストール前に重要データのバックアップを確認してください。',
      disk_col1: '名前', disk_col2: '合計サイズ', disk_col3: '空き領域', disk_col4: '種類',
      disk_link1: '更新', disk_link2: '削除', disk_link3: 'フォーマット',
      disk_link4: '新規', disk_link5: 'ドライバーの読み込み',
      disk_tip: 'ヒント: プライマリ パーティションを選んで「次へ」をクリックすると開始できます。未割り当て領域は先に「新規」が必要です。',
      disk_info_none: 'パーティションを選択してください。',
      disk_info_unalloc: '未割り当て領域を選択中 · まず「新規」をクリックして作成してください。',
      inst_brand: 'Windows 11', inst_target_prefix: 'インストール先', inst_suffix: 'コンピューターの電源を切らないでください。',
      rst_title: '続行するには Windows の再起動が必要です',
      rst_body: 'お使いの PC は {n} 秒後に自動的に再起動します。', rst_sub: '再起動中は電源を切ったり、プラグを抜いたりしないでください。',
      rst_now: '今すぐ再起動', boot_prepare: 'Windows を準備中', boot_hint: 'コンピューターの電源を切らないでください',
      oobe_region_title: '地域を設定しましょう',
      oobe_region_sub: '日付、時刻、コンテンツの設定に合わせるため、お住まいの国または地域を選択してください。',
      oobe_country: '国または地域', oobe_yes: 'はい',
      oobe_kb_title: 'どのキーボード レイアウトを使いますか？', oobe_kb_sub: '地域に基づく推奨レイアウトを表示しています。後で追加できます。',
      kb_pinyin: 'Microsoft ピンイン', kb_pinyin_d: '中国語（簡体）・推奨', kb_wubi: 'Microsoft 五筆', kb_wubi_d: '中国語（簡体）',
      kb_us: 'US キーボード', kb_us_d: '英語（米国）', oobe_skip: 'スキップ',
      kb2_title: '第二のキーボード レイアウトを追加しますか？',
      kb2_sub: '複数言語を使う場合は追加できます。設定でいつでも変更できます。',
      kb2_skip_d: '現在のキーボードのみを使用',
      oobe_net_title: 'ネットワークに接続しましょう', oobe_net_sub: '接続すると Microsoft アカウント、ストア、クラウド サービスが使えます。利用可能なワイヤレス ネットワークを選んでください。',
      net_sec: 'セキュア · WPA2', net_open: 'オープン ネットワーク',
      net_str: '信号強', net_good: '信号良', net_fair: '信号普通',
      oobe_no_net: 'インターネットに接続していません',
      limited_title: '制限付きセットアップ',
      limited_sub: 'インターネットに接続していません。制限付きセットアップを続行し、後で接続できます。Microsoft Store やクラウド同期など一部機能は利用できません。',
      limited_warn: '制限付きセットアップを続行すると、ローカル アカウントでのサインインが必要になります。',
      limited_continue: '制限付きセットアップを続行',
      device_title: 'PC の名前を付けましょう', device_sub: 'ネットワーク上でデバイスを識別する名前です。設定 > システム > 詳細から後で変更できます。',
      device_label: 'PC 名',
      acc_title: 'このデバイスを使うのは誰ですか？',
      acc_sub: 'Microsoft アカウントでサインインするか、ローカル アカウントを作成してください。Microsoft アカウントで設定、OneDrive、Store コンテンツを同期できます。',
      acc_personal: '個人用に設定', acc_personal_d: 'Microsoft アカウントまたはローカル アカウントでサインイン',
      acc_work: '職場または学校用に設定', acc_work_d: '組織が管理する組織アカウントでサインイン',
      ms_title: 'Microsoft アカウントにサインイン', ms_sub: 'メール アドレスを入力してください。お持ちでない場合は作成するか、ローカル アカウントで続行できます。',
      ms_email: 'メール アドレス', ms_switch_local: '代わりにローカル アカウントでサインイン',
      local_title: 'この PC のアカウントを作成', local_sub: 'サインインに使うローカル アカウントを作成します。パスワードは空白にして、この手順をスキップできます。',
      local_user: 'ユーザー名', local_user_ph: '例: Administrator',
      local_pass: 'パスワード（省略可）', local_pass2: 'パスワードの再入力',
      privacy_title: 'デバイスのプライバシー設定を選択', privacy_sub: '選択内容によって、Windows が情報をどう使うかが変わります。設定 > プライバシーとセキュリティからいつでも変更できます。',
      p_loc: '位置情報', p_loc_d: 'アプリに正確な位置を使用させる',
      p_find: 'デバイスを探す', p_find_d: 'Windows がネットワーク経由でこのデバイスを探せるようにする',
      p_diag: '診断データ', p_diag_d: 'Windows 改善のために追加の診断データを送信する',
      p_ink: 'インキングと入力の改善', p_ink_d: '言語モデル改善のために記述と入力サンプルを送信する',
      p_tailor: 'カスタマイズされたエクスペリエンス', p_tailor_d: 'Microsoft が診断データを使ってパーソナライズされた候補を出せるようにする',
      p_ad: '広告 ID', p_ad_d: 'アプリが広告 ID を使って関連広告を表示できるようにする',
      p_local: 'ローカル コンテンツ', p_local_d: '検索と候補でローカル ファイルとアプリを表示する',
      btn_accept: '受け入れる',
      custom_title: 'エクスペリエンスをカスタマイズ', custom_sub: 'Windows がどのような候補とコンテンツを表示するかを選びます。設定でいつでも変更できます。',
      c_tips: 'Windows のヒントと候補を取得', c_tips_d: '[スタート] と設定で使用法のヒントを表示する',
      c_store: 'Microsoft Store のアプリ推奨を取得', c_store_d: '使用状況に基づいてアプリとゲームを推奨する',
      c_promo: 'Microsoft からプロモーション情報を受け取る', c_promo_d: 'メールで製品更新と特典を受け取る',
      final_title: '数分かかる場合があります', final_sub: 'PC の電源を切らないでください。{name} のために準備を進めています。',
      welcome_title: 'Windows 11 へようこそ',
      welcome_body: 'セットアップが完了しました。デスクトップの「Windows の再インストール」アイコンをダブルクリックすると、もう一度体験できます。',
      demo_title: 'デモ ナビゲーター', demo_hint: 'D キーで切り替え · クリックでジャンプ',
      demo_g_setup: 'セットアップ ウィザード', demo_g_proc: 'インストール中',
      demo_g_oobe: '初回セットアップ (OOBE)', demo_g_desk: 'デスクトップ',
      demo_reset: 'リセットして最初からやり直す',
      icon_recycle: 'ごみ箱', icon_pc: 'この PC', icon_reinstall: 'Windows の再インストール',
      start_all_apps: 'すべてのアプリ', start_more: '詳細', start_search_ph: 'アプリ、設定、ドキュメントの検索',
      start_recent_hint: 'セットアップ後、最近使用したアプリとファイルがここに表示されます。',
      app_edge: 'Microsoft Edge', app_explorer: 'ファイル エクスプローラー', app_settings: '設定',
      app_photos: 'フォト', app_calc: '電卓', app_notepad: 'メモ帳',
      app_store: 'Microsoft Store', app_terminal: 'ターミナル', app_player: 'メディア プレーヤー',
      app_camera: 'カメラ', app_mail: 'メール', app_weather: '天気',
      tray_net_vol: 'ネットワーク、サウンド、電源', start_title: 'スタート',
      tb_search_title: '検索', tb_widget_title: 'ウィジェット', tb_fe_title: 'ファイル エクスプローラー',
      tb_edge_title: 'Microsoft Edge', tb_store_title: 'Microsoft Store',
      toast_close_title: 'セットアップを終了しますか？',
      toast_close_body: '今終了すると Windows はインストールされません。後で再実行できます。',
      btn_close_ok: '終了', btn_close_cancel: 'セットアップを続ける'
    }
  };
  var _current = (function(){ try{return localStorage.getItem('windows11_setup_lang')||'zh-CN';}catch(e){return 'zh-CN';} })();
  if(!_langs[_current]) _current='zh-CN';

  function _t(k,ctx){var v=(_langs[_current]&&_langs[_current][k])||_langs['zh-CN'][k]||k;if(ctx){for(var m in ctx){v=v.replace('{'+m+'}',ctx[m]);}}return v;}
  function _apply(){
    var list=[['[data-i18n]','textContent'],['[data-i18n-html]','innerHTML'],['[data-i18n-ph]','placeholder'],['[data-i18n-title]','title']];
    for(var i=0;i<list.length;i++){
      var sel=list[i][0],prop=list[i][1];
      document.querySelectorAll(sel).forEach(function(el){
        var key=el.dataset.i18n||el.dataset.i18nHtml||el.dataset.i18nPh||el.dataset.i18nTitle;
        if(!key) return;
        el[prop]=_t(key);
      });
    }
    // 运行时 hook 重新填充的文本，通过触发一个自定义事件让主脚本接住
    try{ document.dispatchEvent(new CustomEvent('langchange',{detail:{lang:_current}})); }catch(e){}
    // 按钮状态
    document.querySelectorAll('.lang-switch button[data-lang]').forEach(function(b){
      b.classList.toggle('on', b.dataset.lang===_current);
    });
    // document.title
    try{ document.title = _t('setup_title'); }catch(e){}
  }
  function _switch(code){
    if(!_langs[code]) return;
    _current=code;
    try{ localStorage.setItem('windows11_setup_lang',code); }catch(e){}
    _apply();
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('.lang-switch button[data-lang]');
    if(b){ _switch(b.dataset.lang); return; }
  });
  // 导出到主 IIFE（通过 window 共享）
  window.__i18n = { t: _t, apply: _apply, switch: _switch, get current(){return _current;}, langs: _langs };
  document.addEventListener('DOMContentLoaded', _apply);
  // 立即尝试（如果 DOM 已就绪）
  if(document.body) _apply();
})();
</script>
"""

# 把语言脚本插到第一个 <script> 之前
DST = DST.replace('<script>', LANGS_JS + '\n<script>', 1)

# ---------- 3. 语言切换 HTML 按钮，插到 </body> 之前 ----------
SWITCH_HTML = '''<div class="lang-switch" id="langSwitch">
  <button data-lang="zh-CN" class="on">简体中文</button><div class="sep"></div>
  <button data-lang="en-US">English</button><div class="sep"></div>
  <button data-lang="ja-JP">日本語</button>
</div>'''
DST = DST.replace('</body>', SWITCH_HTML + '\n</body>', 1)

# ---------- 4. 给关键 DOM 节点打 data-i18n 标记 ----------
# 分批次做替换，每个都要有足够唯一的上下文避免误伤
# 标题栏 "Windows 11 安装程序"（第一次出现，在 lang 页）
DST = DST.replace(
    '<h1 class="dlg-h">Windows 11 安装程序</h1>\n      <p class="dlg-sub">选择要安装的语言和其他首选项。</p>',
    '<h1 class="dlg-h" data-i18n="title_lang">Windows 11 安装程序</h1>\n      <p class="dlg-sub" data-i18n="sub_lang">选择要安装的语言和其他首选项。</p>'
)

# 直接字符串替换表（精确匹配，一次性替换）
pairs = [
    # 表单 label 里的文本（完整 label 标签）
    ('<label class="fld__label" for="selLang">要安装的语言</label>',
     '<label class="fld__label" for="selLang" data-i18n="lbl_lang">要安装的语言</label>'),
    ('<label class="fld__label" for="selTime">时间和货币格式</label>',
     '<label class="fld__label" for="selTime" data-i18n="lbl_time">时间和货币格式</label>'),
    ('<label class="fld__label" for="selKb">键盘或输入方法</label>',
     '<label class="fld__label" for="selKb" data-i18n="lbl_kb">键盘或输入方法</label>'),
    ('<label class="fld__label" for="keyInput">产品密钥</label>',
     '<label class="fld__label" for="keyInput" data-i18n="lbl_key">产品密钥</label>'),
    ('<p class="dlg-note">密钥由 25 个字符组成，输入时会自动分组。</p>',
     '<p class="dlg-note" data-i18n="note_key">密钥由 25 个字符组成，输入时会自动分组。</p>'),
    ('<input class="inp mono" id="keyInput" maxlength="29" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" spellcheck="false">',
     '<input class="inp mono" id="keyInput" maxlength="29" data-i18n-ph="ph_key" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" spellcheck="false">'),
    # 密钥页标题 + sub
    ('<h1 class="dlg-h">激活 Windows</h1>', '<h1 class="dlg-h" data-i18n="title_key">激活 Windows</h1>'),
    # 密钥页 sub —— 长文本，用 data-i18n-html 更好（内部有引号）
    ('<p class="dlg-sub">输入产品密钥可激活 Windows。如果你没有密钥，可以选择“我没有产品密钥”继续安装，稍后再激活。</p>',
     '<p class="dlg-sub" data-i18n="sub_key">输入产品密钥可激活 Windows。如果你没有密钥，可以选择"我没有产品密钥"继续安装，稍后再激活。</p>'),
    # 版本页
    ('<h1 class="dlg-h">选择要安装的操作系统</h1>', '<h1 class="dlg-h" data-i18n="title_edition">选择要安装的操作系统</h1>'),
    ('<p class="dlg-sub">你可以安装以下任一版本。安装完成后，可在“设置”中升级版本。</p>',
     '<p class="dlg-sub" data-i18n="sub_edition">你可以安装以下任一版本。安装完成后，可在"设置"中升级版本。</p>'),
    # 版本项
    ('<div class="opt__t">Windows 11 专业版</div><div class="opt__d">面向小型企业和高级用户的完整功能，支持 BitLocker、远程桌面和 Hyper-V。</div>',
     '<div class="opt__t" data-i18n="ed_pro">Windows 11 专业版</div><div class="opt__d" data-i18n="ed_pro_d">面向小型企业和高级用户的完整功能，支持 BitLocker、远程桌面和 Hyper-V。</div>'),
    ('<div class="opt__t">Windows 11 家庭版</div><div class="opt__d">面向家庭用户的日常体验，包含全新的开始菜单、窗口布局和 Microsoft Store。</div>',
     '<div class="opt__t" data-i18n="ed_home">Windows 11 家庭版</div><div class="opt__d" data-i18n="ed_home_d">面向家庭用户的日常体验，包含全新的开始菜单、窗口布局和 Microsoft Store。</div>'),
    ('<div class="opt__t">Windows 11 企业版</div><div class="opt__d">面向大型组织，提供高级安全性、设备管理和云端连接能力。</div>',
     '<div class="opt__t" data-i18n="ed_ent">Windows 11 企业版</div><div class="opt__d" data-i18n="ed_ent_d">面向大型组织，提供高级安全性、设备管理和云端连接能力。</div>'),
    ('<div class="opt__t">Windows 11 教育版</div><div class="opt__d">为学校、教师和学生打造，包含教育机构常用的应用与管理工具。</div>',
     '<div class="opt__t" data-i18n="ed_edu">Windows 11 教育版</div><div class="opt__d" data-i18n="ed_edu_d">为学校、教师和学生打造，包含教育机构常用的应用与管理工具。</div>'),
    # 许可页标题
    ('<h1 class="dlg-h" style="font-size:21px;">适用的通知与许可条款</h1>',
     '<h1 class="dlg-h" style="font-size:21px;" data-i18n="title_license">适用的通知与许可条款</h1>'),
    ('<p class="dlg-sub" style="margin-bottom:14px;">请阅读以下条款。你需要接受这些条款才能继续安装。</p>',
     '<p class="dlg-sub" style="margin-bottom:14px;" data-i18n="sub_license">请阅读以下条款。你需要接受这些条款才能继续安装。</p>'),
    ('<span>我接受 Microsoft 软件许可条款和适用的通知。</span>',
     '<span data-i18n="chk_license">我接受 Microsoft 软件许可条款和适用的通知。</span>'),
    # 安装类型
    ('<h1 class="dlg-h">你想执行哪种类型的安装？</h1>',
     '<h1 class="dlg-h" data-i18n="title_type">你想执行哪种类型的安装？</h1>'),
    ('<p class="dlg-sub">升级会保留文件、设置和应用；自定义安装会重新安装 Windows，你可以自行选择分区。</p>',
     '<p class="dlg-sub" data-i18n="sub_type">升级会保留文件、设置和应用；自定义安装会重新安装 Windows，你可以自行选择分区。</p>'),
    ('<div class="opt__t">升级：安装 Windows 并保留文件、设置和应用</div>', '<div class="opt__t" data-i18n="type_upgrade">升级：安装 Windows 并保留文件、设置和应用</div>'),
    ('<div class="opt__d">当前是从安装介质启动，无法执行升级安装。请移除介质并从 Windows 中运行安装程序。</div>',
     '<div class="opt__d" data-i18n="type_upgrade_d">当前是从安装介质启动，无法执行升级安装。请移除介质并从 Windows 中运行安装程序。</div>'),
    ('<div class="opt__t">自定义：仅安装 Windows（高级）</div>', '<div class="opt__t" data-i18n="type_custom">自定义：仅安装 Windows（高级）</div>'),
    ('<div class="opt__d">使用此选项全新安装 Windows。你可以选择要安装到的分区，已安装的程序和文件不会保留。</div>',
     '<div class="opt__d" data-i18n="type_custom_d">使用此选项全新安装 Windows。你可以选择要安装到的分区，已安装的程序和文件不会保留。</div>'),
    # 磁盘页
    ('<h1 class="dlg-h" style="font-size:22px;">你想将 Windows 安装在哪里？</h1>',
     '<h1 class="dlg-h" style="font-size:22px;" data-i18n="title_disk">你想将 Windows 安装在哪里？</h1>'),
    ('<p class="dlg-sub" style="margin-bottom:16px;">你可以选择现有分区，或新建分区。安装前请确认重要数据已备份。</p>',
     '<p class="dlg-sub" style="margin-bottom:16px;" data-i18n="sub_disk">你可以选择现有分区，或新建分区。安装前请确认重要数据已备份。</p>'),
    ('<div class="disk-row head">\n          <div>名称</div><div>总大小</div><div>可用空间</div><div>类型</div>',
     '<div class="disk-row head">\n          <div data-i18n="disk_col1">名称</div><div data-i18n="disk_col2">总大小</div><div data-i18n="disk_col3">可用空间</div><div data-i18n="disk_col4">类型</div>'),
    ('<div class="disk-tip">提示：选择“主分区”后点击“下一步”即可开始安装；未分配的空间需要先点击“新建”。</div>',
     '<div class="disk-tip" data-i18n="disk_tip">提示：选择"主分区"后点击"下一步"即可开始安装；未分配的空间需要先点击"新建"。</div>'),
    ('<button class="link" id="btnRefresh">刷新</button>', '<button class="link" id="btnRefresh" data-i18n="disk_link1">刷新</button>'),
    ('<button class="link" id="btnDelete">删除</button>', '<button class="link" id="btnDelete" data-i18n="disk_link2">删除</button>'),
    ('<button class="link" id="btnFormat">格式化</button>', '<button class="link" id="btnFormat" data-i18n="disk_link3">格式化</button>'),
    ('<button class="link" id="btnNew">新建</button>', '<button class="link" id="btnNew" data-i18n="disk_link4">新建</button>'),
    ('<button class="link" id="btnDriver">加载驱动程序</button>', '<button class="link" id="btnDriver" data-i18n="disk_link5">加载驱动程序</button>'),
    # 下一步/上一步/立即重启/下一步按钮（逐个精准）
    ('<button class="btn primary" data-go="key" data-enter="1">下一步</button>', '<button class="btn primary" data-go="key" data-enter="1" data-i18n="btn_next">下一步</button>'),
    ('<button class="link" data-go="type">上一步</button>', '<button class="link" data-go="type" data-i18n="btn_back">上一步</button>'),
    ('<button class="btn primary" id="btnRestartNow">立即重启</button>', '<button class="btn primary" id="btnRestartNow" data-i18n="rst_now">立即重启</button>'),
    ('<button class="link" id="btnRepair">修复计算机</button>', '<button class="link" id="btnRepair" data-i18n="btn_repair">修复计算机</button>'),
    ('<button class="link" id="btnNoKey">我没有产品密钥</button>', '<button class="link" id="btnNoKey" data-i18n="btn_no_key">我没有产品密钥</button>'),
    ('<h2>Windows 需要重启才能继续</h2>', '<h2 data-i18n="rst_title">Windows 需要重启才能继续</h2>'),
    # OOBE
    ('<h1>让我们为你设置区域</h1>', '<h1 data-i18n="oobe_region_title">让我们为你设置区域</h1>'),
    ('<p class="sub">选择你所在的国家或地区，以便 Windows 使用合适的日期、时间和内容设置。</p>',
     '<p class="sub" data-i18n="oobe_region_sub">选择你所在的国家或地区，以便 Windows 使用合适的日期、时间和内容设置。</p>'),
    ('<label class="fld__label" for="regionSel">国家或地区</label>',
     '<label class="fld__label" for="regionSel" data-i18n="oobe_country">国家或地区</label>'),
    ('<button class="btn primary" data-go="keyboard" data-enter="1">是</button>',
     '<button class="btn primary" data-go="keyboard" data-enter="1" data-i18n="oobe_yes">是</button>'),
    # 重启提示
    ('<p>你的电脑将在 <span id="restartCount">10</span> 秒后自动重启。</p>',
     '<p>你的电脑将在 <span id="restartCount">10</span> 秒后自动重启。</p>'),  # 保留原结构
    ('<p style="color:#8b8b8b;">重启期间请不要关闭电脑或拔出电源。</p>',
     '<p style="color:#8b8b8b;" data-i18n="rst_sub">重启期间请不要关闭电脑或拔出电源。</p>'),
    # 桌面欢迎
    ('<div class="t">欢迎使用 Windows 11</div>', '<div class="t" data-i18n="welcome_title">欢迎使用 Windows 11</div>'),
    ('<div class="d">安装已完成。双击桌面上的“重新安装 Windows”图标可以再次体验整个过程。</div>',
     '<div class="d" data-i18n="welcome_body">安装已完成。双击桌面上的"重新安装 Windows"图标可以再次体验整个过程。</div>'),
    # 图标
    ('<span>回收站</span>', '<span data-i18n="icon_recycle">回收站</span>'),
    ('<span>此电脑</span>', '<span data-i18n="icon_pc">此电脑</span>'),
    ('<span>重新安装<br>Windows</span>', '<span data-i18n="icon_reinstall">重新安装 Windows</span>'),
]

for old, new in pairs:
    if old in DST:
        DST = DST.replace(old, new, 1)
    else:
        print("MISSING:", repr(old[:60]))

SRC.write_text(DST, encoding="utf-8")
print("DONE", len(DST), "bytes")
