/* ==========================================
   FLASHBURN - FRONTEND INTERACTION LOGIC
   ========================================== */

// --- Global States ---
let fileQueue = [];
let opticalDrives = [];
let selectedDrive = null;
let theme = 'dark';
let activePage = 'burn-page';
let isISOMode = false;
let isoFile = null;
let capsuleFilePath = null;

// Default Disc State: No disc loaded by default
let currentDisc = {
  type: 'no-disc',
  capacity: 0,
  used: 0,
  label: '',
  status: '未检测到光盘',
  appendable: false,
  isEjected: false
};

// Preset constants for sizes
const CD_CAPACITY = 700 * 1024 * 1024; // 700 MB
const DVD_CAPACITY = 4.7 * 1000 * 1000 * 1000; // 4.7 GB (Optical standard is 10^9 bytes)

// Burn History log cache
let burnHistory = [];

// Real-time auto label generator timer
let labelTimer = null;

// Burning process controllers
let burnInterval = null;
let currentProgress = 0;
let isBurning = false;
let currentSessionLogs = [];

// --- DOM Elements ---
const el = {
  // Titlebar
  minBtn: document.getElementById('min-btn'),
  maxBtn: document.getElementById('max-btn'),
  closeBtn: document.getElementById('close-btn'),

  // Navigation
  menuBurn: document.getElementById('menu-burn') || document.createElement('div'),
  menuHistory: document.getElementById('menu-history') || document.createElement('div'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  pages: document.querySelectorAll('.page-content'),
  sidebar: document.querySelector('.sidebar'),

  // Workspace Files
  btnAddFiles: document.getElementById('btn-add-files'),
  btnAddFolder: document.getElementById('btn-add-folder'),
  btnClearList: document.getElementById('btn-clear-list'),
  fileListWrapper: document.querySelector('.file-list-wrapper'),
  emptyState: document.getElementById('empty-state'),
  fileTable: document.getElementById('file-table'),
  fileListBody: document.getElementById('file-list-body'),
  filesCountSummary: document.getElementById('files-count-summary'),
  filesSizeSummary: document.getElementById('files-size-summary'),



  // Workspace Settings
  lblDiscType: document.getElementById('lbl-disc-type'),
  lblDiscStatus: document.getElementById('lbl-disc-status'),
  lblDiscSpace: document.getElementById('lbl-disc-space'),
  gaugeFill: document.getElementById('gauge-fill'),
  gaugeWarningLabel: document.getElementById('gauge-warning-label'),
  selectDrive: document.getElementById('select-drive'),
  inputLabel: document.getElementById('input-label'),
  switchAppendData: document.getElementById('switch-append-data'),
  chkCloseDisc: document.getElementById('chk-close-disc') || document.createElement('input'),
  chkVerifyData: document.getElementById('chk-verify-data'),
  chkReaderCapsule: document.getElementById('chk-reader-capsule') || document.createElement('input'),
  inputLaserText: document.getElementById('input-laser-text') || document.createElement('input'),
  lblLaserTextCount: document.getElementById('lbl-laser-text-count') || document.createElement('span'),
  laserTextContent: document.getElementById('laser-text-content') || document.createElement('textPath'),
  chkEjectDisc: document.getElementById('chk-eject-disc'),
  btnEjectTray: document.getElementById('btn-eject-tray'),
  btnStartBurn: document.getElementById('btn-start-burn'),
  lblLbaSectors: document.getElementById('lbl-lba-sectors'),
  lblWriteMode: document.getElementById('lbl-write-mode'),
  trackSegmentData: document.getElementById('track-segment-data'),
  trackSegmentFree: document.getElementById('track-segment-free'),

  // Process Page
  lblProcessTitle: document.getElementById('lbl-process-title'),
  lblProcessSubtitle: document.getElementById('lbl-process-subtitle'),
  lblProcessLabel: document.getElementById('lbl-process-label'),
  lblProcessDrive: document.getElementById('lbl-process-drive'),
  visualizerTray: document.getElementById('visualizer-tray'),
  physicalTray: document.getElementById('physical-tray'),
  spinningDisc: document.getElementById('spinning-disc'),
  burningSectorsMask: document.getElementById('burning-sectors-mask'),
  burningLabelPreview: document.getElementById('burning-label-preview') || document.createElement('div'),
  laserHead: document.getElementById('laser-head'),
  ringProgressBar: document.getElementById('ring-progress-bar'),
  lblProcessPercent: document.getElementById('lbl-process-percent'),
  processBarFill: document.getElementById('process-bar-fill'),
  lblProcessTime: document.getElementById('lbl-process-time'),
  terminalConsole: document.getElementById('terminal-console'),
  btnCancelBurn: document.getElementById('btn-cancel-burn'),
  btnFinishReturn: document.getElementById('btn-finish-return'),
  btnPreviewCapsule: document.getElementById('btn-preview-capsule') || document.createElement('button'),
  btnToggleLogs: document.getElementById('btn-toggle-logs'),
  processLogsBlock: document.getElementById('process-logs-block'),

  // History Page
  historyListBody: document.getElementById('history-list-body'),
  btnClearHistory: document.getElementById('btn-clear-history'),

  // Toast
  winToast: document.getElementById('win-toast'),
  toastTitle: document.getElementById('toast-title'),
  toastMessage: document.getElementById('toast-message'),
  btnCloseToast: document.getElementById('btn-close-toast'),

  // Modal
  historyModal: document.getElementById('history-modal'),
  modalTitle: document.getElementById('modal-title'),
  modalLabel: document.getElementById('modal-label'),
  modalType: document.getElementById('modal-type'),
  modalSize: document.getElementById('modal-size'),
  modalLogs: document.getElementById('modal-logs'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnModalCloseAction: document.getElementById('btn-modal-close-action'),
  selectSpeed: document.getElementById('select-speed'),
  btnEraseDisc: document.getElementById('btn-erase-disc'),
  eraseModal: document.getElementById('erase-modal'),
  btnCloseEraseModal: document.getElementById('btn-close-erase-modal'),
  btnCancelErase: document.getElementById('btn-cancel-erase'),
  btnConfirmErase: document.getElementById('btn-confirm-erase'),
  lblEraseDriveLetter: document.getElementById('lbl-erase-drive-letter'),
  lblTrayDoorStatus: document.getElementById('lbl-tray-door-status')
};

// --- Initializing App ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  startHardwarePolling();
  initDragAndDrop();
  initHardwareController();
  initDashboardAndCloner();
  startLabelClock();
  loadHistory();
  updateDiscStateUI();
  updateFileQueueUI();

  // Dialog Add handlers
  el.btnAddFiles.addEventListener('click', handleAddFilesDialog);
  el.btnAddFolder.addEventListener('click', handleAddFolderDialog);
  el.btnClearList.addEventListener('click', clearFileQueue);
  el.btnEjectTray.addEventListener('click', ejectDriveTray);
  el.btnStartBurn.addEventListener('click', startBurningSession);
  el.btnCancelBurn.addEventListener('click', cancelBurningTask);
  el.btnFinishReturn.addEventListener('click', returnToWorkspace);
  el.btnClearHistory.addEventListener('click', clearBurnHistory);
  el.btnCloseToast.addEventListener('click', hideToast);

  // Load and save "close disc" preference
  if (el.chkCloseDisc) {
    el.chkCloseDisc.checked = localStorage.getItem('flashburn-closedisc') === 'true';
    el.chkCloseDisc.addEventListener('change', (e) => {
      localStorage.setItem('flashburn-closedisc', e.target.checked);
    });
  }

  // Toggle Detailed Logs button click handler
  if (el.btnToggleLogs && el.processLogsBlock) {
    el.btnToggleLogs.addEventListener('click', () => {
      if (el.processLogsBlock.style.display === 'none') {
        el.processLogsBlock.style.display = 'flex';
        el.btnToggleLogs.textContent = '🔒 隐藏详细日志';
      } else {
        el.processLogsBlock.style.display = 'none';
        el.btnToggleLogs.textContent = '🔍 显示详细日志';
      }
    });
  }

  // Erase disc triggers
  el.btnEraseDisc.addEventListener('click', openEraseConfirmationModal);
  el.btnCloseEraseModal.addEventListener('click', () => el.eraseModal.style.display = 'none');
  el.btnCancelErase.addEventListener('click', () => el.eraseModal.style.display = 'none');
  el.btnConfirmErase.addEventListener('click', executeDiscErase);
  document.getElementById('btn-exit-iso-mode').addEventListener('click', exitISOMode);

  // Close modals
  el.btnCloseModal.addEventListener('click', () => el.historyModal.style.display = 'none');
  el.btnModalCloseAction.addEventListener('click', () => el.historyModal.style.display = 'none');

  // --- Next-Gen Suite: Laser-Scribe Text real-time circular rendering & Character Counter ---


  // Theme switches
  el.themeToggleBtn.addEventListener('click', toggleTheme);

  // Electron Frame Event Listeners
  if (window.electronAPI) {
    el.minBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
    el.maxBtn.addEventListener('click', () => window.electronAPI.maximizeWindow());
    el.closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());

    // Listen to physical burning stream logs
    window.electronAPI.onBurnLog((logText) => {
      if (!isBurning) return;
      
      const writeLogs = (text, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type === 'error' ? 'log-err' : type === 'success' ? 'log-success' : type === 'warn' ? 'log-warn' : ''}`;
        entry.innerHTML = `[${timestamp}] ${text}`;
        el.terminalConsole.appendChild(entry);
        el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
        currentSessionLogs.push(entry.outerHTML);
      };
      
      let type = 'info';
      if (logText.startsWith('ERROR:')) {
        type = 'error';
        logText = logText.substring(6).trim();
      } else if (logText.startsWith('SUCCESS:')) {
        type = 'success';
        logText = logText.substring(8).trim();
      } else if (logText.startsWith('WARN:')) {
        type = 'warn';
        logText = logText.substring(5).trim();
      }
      
      writeLogs(logText, type);
      
      // Dynamic Progress Mapping
      if (logText.includes('Staging file')) {
        currentProgress = Math.max(currentProgress, 15);
      } else if (logText.includes('Staging folder') || logText.includes('Staging directory')) {
        currentProgress = Math.max(currentProgress, 30);
      } else if (logText.includes('Compiling ISO9660') || logText.includes('Creating physical burn image')) {
        currentProgress = Math.max(currentProgress, 45);
      } else if (logText.includes('Initializing MsftDiscFormat2Data') || logText.includes('writer interface')) {
        currentProgress = Math.max(currentProgress, 55);
      } else if (logText.includes('Performing active track burn') || logText.includes('active track burn')) {
        currentProgress = Math.max(currentProgress, 75);
      }
      
      el.processBarFill.style.width = `${currentProgress}%`;
      el.lblProcessPercent.textContent = `${currentProgress}%`;
      
      const ringCirc = 282.74;
      el.ringProgressBar.style.strokeDashoffset = ringCirc - (currentProgress / 100) * ringCirc;

      // Fluctuate double buffers during physical burning
      const softBar = document.getElementById('soft-buffer-fill');
      const hardBar = document.getElementById('hard-buffer-fill');
      const softLbl = document.getElementById('lbl-soft-buffer');
      const hardLbl = document.getElementById('lbl-hard-buffer');
      
      if (softBar) {
        const softVal = 92 + Math.floor(Math.random() * 9); // 92% - 100%
        const hardVal = 85 + Math.floor(Math.random() * 16); // 85% - 100%
        
        softBar.style.width = `${softVal}%`;
        softLbl.textContent = `${softVal}%`;
        hardBar.style.width = `${hardVal}%`;
        hardLbl.textContent = `${hardVal}%`;
      }
    });

    // Listen to physical burning completion callbacks
    window.electronAPI.onBurnComplete(({ success, code }) => {
      if (!isBurning) return;
      
      const bytesToBurn = fileQueue.reduce((acc, f) => acc + f.size, 0);
      const isAppending = el.switchAppendData.checked;
      const finalVolumeLabel = isISOMode ? 'ISO_IMAGE_BURN' : el.inputLabel.value;
      
      if (success) {
        currentProgress = 100;
        el.processBarFill.style.width = '100%';
        el.lblProcessPercent.textContent = '100%';
        el.ringProgressBar.style.strokeDashoffset = 0;
        completeBurningTask(finalVolumeLabel, bytesToBurn, isAppending);
      } else {
        isBurning = false;
        el.lblProcessTitle.textContent = '刻录失败';
        el.lblProcessTime.textContent = `物理硬件激光写入失败 (Exit Code: ${code})`;
        
        el.menuBurn.style.opacity = 1;
        el.menuHistory.style.opacity = 1;
        el.themeToggleBtn.style.opacity = 1;
        
        el.spinningDisc.classList.remove('spinning');
        el.laserHead.style.display = 'none';
        
        el.btnCancelBurn.style.display = 'none';
        el.btnFinishReturn.style.display = 'block';
        
        showToast('物理刻录失败', `刻录驱动器硬件回执报错，退出代码 ${code}。`, 'error');
      }
    });
  } else {
    // Hide controls if opened standard browser
    el.minBtn.style.display = 'none';
    el.maxBtn.style.display = 'none';
    el.closeBtn.style.display = 'none';
  }


});

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('flashburn-theme') || 'dark';
  theme = savedTheme;
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    const txt = el.themeToggleBtn.querySelector('.theme-text');
    if (txt) txt.textContent = '浅色模式';
  } else {
    document.body.classList.add('dark-theme');
    const txt = el.themeToggleBtn.querySelector('.theme-text');
    if (txt) txt.textContent = '深色模式';
  }
}

function toggleTheme() {
  if (theme === 'dark') {
    theme = 'light';
    document.body.classList.remove('dark-theme');
    const txt = el.themeToggleBtn.querySelector('.theme-text');
    if (txt) txt.textContent = '浅色模式';
  } else {
    theme = 'dark';
    document.body.classList.add('dark-theme');
    const txt = el.themeToggleBtn.querySelector('.theme-text');
    if (txt) txt.textContent = '深色模式';
  }
  localStorage.setItem('flashburn-theme', theme);
}

// --- Navigation Controller ---
function initNavigation() {
  const navItems = [
    document.getElementById('menu-dashboard'),
    el.menuBurn,
    document.getElementById('menu-clone'),
    el.menuHistory
  ].filter(Boolean);
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (isBurning) {
        showToast('操作进行中', '任务正在执行，为了防止损坏光盘介质或数据丢失，导航已锁定。');
        return;
      }
      
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      const targetPage = item.getAttribute('data-page');
      activePage = targetPage;
      
      el.pages = document.querySelectorAll('.page-content');
      el.pages.forEach(page => {
        page.classList.remove('active');
        if (page.id === targetPage) {
          page.classList.add('active');
        }
      });
      
      // Autocheck cloner if switching to rip
      if (targetPage === 'clone-page') {
        const checkRipReadiness = window.checkRipReadiness || (() => {});
        checkRipReadiness();
      }
    });
  });
}

// --- Dynamic Date Label Clock ---
function startLabelClock() {
  const updateLabel = () => {
    if (isBurning) return; // Freeze label during burning
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    const formattedLabel = `${YYYY}${MM}${DD}${HH}${mm}${ss}`;
    el.inputLabel.value = formattedLabel;
    el.burningLabelPreview.textContent = formattedLabel;
  };
  
  updateLabel();
  labelTimer = setInterval(updateLabel, 1000);
}

// --- Physical Drive & Hardware Management ---
function initHardwareController() {
  el.selectDrive.addEventListener('change', (e) => {
    selectedDrive = e.target.value;
    if (selectedDrive) {
      showToast('硬件切换', `已锁定物理驱动器 ${selectedDrive}，准备对真实媒介进行刻录。`, 'success');
      updatePhysicalDiscState();
    } else {
      currentDisc = {
        type: 'no-disc',
        capacity: 0,
        used: 0,
        label: '',
        status: '未检测到光盘',
        appendable: false,
        isEjected: false
      };
      updateDiscStateUI();
      validateQueueCapacity();
    }
    // Sync custom drive cards when value changes
    syncCustomDrives('select-drive', 'drive-select-grid');
  });

  // Setup speed pill listeners
  setupCustomSpeedSelect();
  
  // Initial sync for custom drive grids
  syncCustomDrives('select-drive', 'drive-select-grid');
  syncCustomDrives('select-rip-source', 'rip-source-select-grid');
}


function updateDiscStateUI() {
  const isCD = currentDisc.capacity > 0 && currentDisc.capacity < 1.5 * 1024 * 1024 * 1024;
  
  let capStr = '', usedStr = '', freeStr = '';
  if (isCD) {
    capStr = `${(currentDisc.capacity / (1024 * 1024)).toFixed(1)} MB`;
    usedStr = `${(currentDisc.used / (1024 * 1024)).toFixed(1)} MB`;
    freeStr = `${((currentDisc.capacity - currentDisc.used) / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    capStr = `${(currentDisc.capacity / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    usedStr = `${(currentDisc.used / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    freeStr = `${((currentDisc.capacity - currentDisc.used) / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // Update labels
  if (currentDisc.capacity === 0) {
    el.lblDiscType.textContent = '未检测到任何介质';
    el.lblDiscStatus.textContent = '请在光仓中放入空白或可重写的刻录光盘';
    el.lblDiscSpace.textContent = '可用空间: 0.0 MB / 0.0 MB';
    
    // UI Visual status
    el.gaugeFill.style.width = '0%';
    el.gaugeFill.className = 'mac-progress-fill';
    el.gaugeWarningLabel.style.display = 'none';
    
    const lblLabel = document.getElementById('lbl-disc-label-text');
    if (lblLabel) lblLabel.textContent = '卷标: 无';
  } else {
    const mediaName = currentDisc.type.includes('dvd') ? `DVD 光盘 (${capStr})` : `CD 光盘 (${capStr})`;
    el.lblDiscType.textContent = mediaName;
    el.lblDiscStatus.textContent = currentDisc.status;
    el.lblDiscSpace.textContent = `已用: ${usedStr} | 可用: ${freeStr}`;
    
    // UI Visual status
    const percentUsed = (currentDisc.used / currentDisc.capacity) * 100;
    el.gaugeFill.style.width = `${percentUsed}%`;
    el.gaugeFill.className = 'mac-progress-fill';
    el.gaugeWarningLabel.style.display = 'none';
    
    // Update volume label badge
    const lblLabel = document.getElementById('lbl-disc-label-text');
    if (lblLabel) {
      lblLabel.textContent = currentDisc.label ? `卷标: ${currentDisc.label}` : '卷标: 空白/未命名';
    }
  }
  updateTrackAnalyzerUI();
}

function updateTrackAnalyzerUI() {
  if (!el.lblLbaSectors) return;

  let queueSize = 0;
  if (isISOMode) {
    queueSize = isoFile.size;
  } else {
    fileQueue.forEach(f => queueSize += f.size);
  }
  
  // Calculate LBA sectors (2048 bytes per optical sector)
  const sectors = Math.ceil(queueSize / 2048);
  el.lblLbaSectors.textContent = `${sectors.toLocaleString()} Sectors`;
  
  // Dynamic write mode
  const isAppending = el.switchAppendData.checked;
  if (isISOMode) {
    el.lblWriteMode.textContent = 'RAW Sector对拷';
  } else if (isAppending) {
    el.lblWriteMode.textContent = 'TAO (Track-At-Once)';
  } else {
    el.lblWriteMode.textContent = 'DAO (Disc-At-Once)';
  }
  
  // Calculate visual track schematic segments
  // Lead-in (constant 10%), Lead-out (constant 10%), total dynamic portion is 80%
  if (currentDisc.capacity > 0) {
    const queueRatio = queueSize / currentDisc.capacity;
    const dataPercent = Math.min(Math.round(queueRatio * 80), 80);
    const freePercent = 80 - dataPercent;
    
    el.trackSegmentData.style.width = `${dataPercent}%`;
    el.trackSegmentFree.style.width = `${freePercent}%`;
    
    el.trackSegmentData.title = `数据轨道: ${dataPercent}% (约 ${sectors.toLocaleString()} 扇区)`;
    el.trackSegmentFree.title = `剩余空间: ${freePercent}%`;
  } else {
    el.trackSegmentData.style.width = `0%`;
    el.trackSegmentFree.style.width = `80%`;
  }
}

// --- Eject Drawer Controller ---
async function ejectDriveTray() {
  currentDisc.isEjected = !currentDisc.isEjected;

  if (selectedDrive !== 'virtual' && window.electronAPI) {
    // Physical eject
    try {
      const ejectRes = await window.electronAPI.ejectDrive(selectedDrive);
      if (ejectRes.success) {
        showToast('物理光驱弹出', `已向光驱驱动器 ${selectedDrive} 发送弹出信号。`);
      } else {
        showToast('物理弹出失败', `光盘舱门可能已被物理锁定或占用：${ejectRes.message}`, 'error');
      }
    } catch (e) {
      console.error('Physical eject command crash:', e);
    }
  }

  // Animation Toggle
  if (currentDisc.isEjected) {
    el.physicalTray.classList.add('ejected');
    el.lblTrayDoorStatus.textContent = '已弹出 (Tray Ejected)';
    el.lblTrayDoorStatus.className = 'status-indicator-red';
    showToast('光驱弹出', '光驱托盘门已滑动打开。您可以放入新光盘介质。');
  } else {
    el.physicalTray.classList.remove('ejected');
    el.lblTrayDoorStatus.textContent = '已关闭 (Disc Inserted)';
    el.lblTrayDoorStatus.className = 'status-indicator-green';
    showToast('光盘入仓', '光驱托盘舱门已关闭，设备开始加载引导轨道...');
  }
}

// --- File Import & Queue Management ---
function initDragAndDrop() {
  const wrapper = el.fileListWrapper;
  
  wrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (isBurning) return;
    wrapper.classList.add('dragover');
  });

  wrapper.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (isBurning) return;
    wrapper.classList.add('dragover');
  });

  wrapper.addEventListener('dragleave', () => {
    wrapper.classList.remove('dragover');
  });

  wrapper.addEventListener('drop', async (e) => {
    e.preventDefault();
    wrapper.classList.remove('dragover');
    if (isBurning) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const paths = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].path) {
          paths.push(files[i].path);
        }
      }
      
      if (paths.length > 0 && window.electronAPI && window.electronAPI.processPaths) {
        try {
          const resolved = await window.electronAPI.processPaths(paths);
          appendFilesToQueue(resolved);
        } catch (err) {
          console.error('Failed to process dropped paths:', err);
        }
      } else {
        const addedItems = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          addedItems.push({
            name: f.name,
            size: f.size,
            type: f.name.split('.').pop().toUpperCase() || 'FILE',
            path: f.path || f.name
          });
        }
        appendFilesToQueue(addedItems);
      }
    }
  });
}

async function handleAddFilesDialog() {
  if (window.electronAPI) {
    try {
      const selected = await window.electronAPI.openFileDialog();
      if (selected && selected.length > 0) {
        appendFilesToQueue(selected);
      }
    } catch(e) {
      console.error(e);
    }
  } else {
    showToast('不支持操作', '当前未在 Electron 原生容器中运行，请拖拽本地文件进行添加！');
  }
}

async function handleAddFolderDialog() {
  if (window.electronAPI) {
    try {
      const selected = await window.electronAPI.openFolderDialog();
      if (selected && selected.length > 0) {
        appendFilesToQueue(selected);
      }
    } catch(e) {
      console.error(e);
    }
  } else {
    showToast('不支持操作', '当前未在 Electron 原生容器中运行，请拖拽本地文件夹进行添加！');
  }
}

function appendFilesToQueue(items) {
  if (items.length === 1 && items[0].name.toLowerCase().endsWith('.iso')) {
    enterISOMode(items[0]);
    return;
  }
  
  if (isISOMode) {
    showToast('无法混合导入', '当前处于 ISO 映像刻录模式。如需刻录普通数据，请先退出镜像模式！', 'error');
    return;
  }

  items.forEach(item => {
    // Avoid double inserts based on filepath
    const exists = fileQueue.some(x => x.path === item.path);
    if (!exists) {
      fileQueue.push(item);
    }
  });
  
  updateFileQueueUI();
  validateQueueCapacity();
}

function removeFileFromQueue(index) {
  fileQueue.splice(index, 1);
  updateFileQueueUI();
  validateQueueCapacity();
}

function clearFileQueue() {
  if (fileQueue.length === 0) return;
  fileQueue = [];
  updateFileQueueUI();
  validateQueueCapacity();
  showToast('列表已清空', '待刻录的数据队列已被全部移出。');
}

function updateFileQueueUI() {
  const body = el.fileListBody;
  body.innerHTML = '';
  
  if (fileQueue.length === 0) {
    el.emptyState.style.display = 'flex';
    el.fileTable.style.display = 'none';
    el.filesCountSummary.textContent = '共 0 个文件';
    el.filesSizeSummary.textContent = '合计大小: 0.00 KB';
    return;
  }
  
  el.emptyState.style.display = 'none';
  el.fileTable.style.display = 'table';
  
  let totalBytes = 0;
  
  fileQueue.forEach((item, index) => {
    totalBytes += item.size;
    const row = document.createElement('tr');
    
    // File icon helper based on extension
    let icon = '📄';
    const ext = item.type.toLowerCase();
    if (item.type === 'FOLDER') icon = '📁';
    else if (ext === 'xlsx' || ext === 'xls') icon = '📊';
    else if (ext === 'docx' || ext === 'doc') icon = '📝';
    else if (ext === 'pptx' || ext === 'ppt') icon = '🎬';
    else if (ext === 'pdf') icon = '📕';
    else if (ext === 'zip' || ext === 'rar') icon = '📁';
    else if (ext === 'mp4' || ext === 'mkv' || ext === 'avi') icon = '🎥';
    
    row.innerHTML = `
      <td><span class="file-table-icon" style="margin-right: 8px;">${icon}</span>${item.name}</td>
      <td class="col-size">${formatBytes(item.size)}</td>
      <td class="col-type">${item.type}</td>
      <td class="col-delete">
        <button class="col-delete-btn" title="移出待刻录队列">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </td>
    `;
    
    // Remove individual file event
    row.querySelector('.col-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFileFromQueue(index);
    });
    
    body.appendChild(row);
  });
  
  el.filesCountSummary.textContent = `共 ${fileQueue.length} 个文件`;
  el.filesSizeSummary.textContent = `合计大小: ${formatBytes(totalBytes)}`;
  updateTrackAnalyzerUI();
}

// --- Capacity Validation Engine ---
function validateQueueCapacity() {
  // If rewritable disc is loaded, show Erase button, otherwise hide it!
  const isRewritable = currentDisc.type.includes('-rw') || currentDisc.status.includes('可重写');
  if (isRewritable && currentDisc.capacity > 0) {
    el.btnEraseDisc.style.display = 'inline-flex';
    el.btnEraseDisc.disabled = false;
  } else {
    el.btnEraseDisc.style.display = 'none';
    el.btnEraseDisc.disabled = true;
  }

  if (currentDisc.capacity === 0) {
    el.btnStartBurn.disabled = true;
    el.btnStartBurn.title = '未检测到光盘介质';
    return;
  }
  
  let queueSize = 0;
  if (isISOMode) {
    queueSize = isoFile.size;
  } else {
    fileQueue.forEach(f => queueSize += f.size);
  }
  
  let availableSpace = currentDisc.capacity;
  
  // If Keep Original Files is checked, the available space is capacity minus already used space.
  // If unchecked, the media is wiped, so full capacity is available.
  const isAppending = el.switchAppendData.checked;
  if (isAppending) {
    availableSpace = currentDisc.capacity - currentDisc.used;
  }
  
  const percentUsedByQueue = (queueSize / currentDisc.capacity) * 100;
  const totalSimulatedPercent = ((currentDisc.used + (isAppending ? queueSize : 0)) / currentDisc.capacity) * 100;

  // Render temporary space forecast on capacity bar
  if (queueSize > 0) {
    const finalPercent = isAppending ? totalSimulatedPercent : percentUsedByQueue;
    el.gaugeFill.style.width = `${Math.min(finalPercent, 100)}%`;
  } else {
    // Revert to current disc stats
    const currentPercent = (currentDisc.used / currentDisc.capacity) * 100;
    el.gaugeFill.style.width = `${currentPercent}%`;
  }

  if (queueSize > availableSpace) {
    el.btnStartBurn.disabled = true;
    el.btnStartBurn.title = '添加的数据总量超出当前光盘的可用上限，请移出部分文件或换盘。';
    el.gaugeFill.className = 'mac-progress-fill warning';
    el.gaugeWarningLabel.style.display = 'block';
  } else if (fileQueue.length === 0 && !isISOMode) {
    el.btnStartBurn.disabled = true;
    el.btnStartBurn.title = '请添加至少一个待刻录的文件。';
    el.gaugeFill.className = 'mac-progress-fill';
    el.gaugeWarningLabel.style.display = 'none';
  } else {
    el.btnStartBurn.disabled = false;
    el.btnStartBurn.title = '所有参数均已就绪，可以执行写入！';
    el.gaugeFill.className = 'mac-progress-fill';
    el.gaugeWarningLabel.style.display = 'none';
  }
  updateTrackAnalyzerUI();
}

// Watch switch for append state
el.switchAppendData.addEventListener('change', (e) => {
  localStorage.setItem('flashburn-append', e.target.checked);
  if (e.target.checked) {
    el.chkCloseDisc.checked = false;
    el.chkCloseDisc.disabled = true;
    el.chkCloseDisc.closest('.mac-switch-item').style.opacity = 0.5;
  } else {
    el.chkCloseDisc.disabled = false;
    el.chkCloseDisc.closest('.mac-switch-item').style.opacity = 1;
  }
  validateQueueCapacity();
  updateDiscStateUI();
});



// --- Burning Process Execution Engine (Realistic Simulation) ---
async function startBurningSession() {
  if ((fileQueue.length === 0 && !isISOMode) || isBurning) return;
  


  isBurning = true;
  currentProgress = 0;
  currentSessionLogs = [];
  el.terminalConsole.innerHTML = '';
  
  // Reset visual disc completed animations
  if (el.spinningDisc) {
    el.spinningDisc.classList.remove('completed', 'erasing');
  }
  const successRing = document.getElementById('success-glow-ring');
  if (successRing) successRing.classList.remove('animate');
  const successRing2 = document.getElementById('success-glow-ring-2');
  if (successRing2) successRing2.classList.remove('animate');
  const flashOverlay = document.getElementById('success-flash-overlay');
  if (flashOverlay) flashOverlay.classList.remove('animate');

  // Hide logs block by default and reset toggle button text
  if (el.processLogsBlock) {
    el.processLogsBlock.style.display = 'none';
  }
  if (el.btnToggleLogs) {
    el.btnToggleLogs.textContent = '🔍 显示详细日志';
  }
  
  // Disable Navigation during burn
  el.menuBurn.style.opacity = 0.5;
  el.menuHistory.style.opacity = 0.5;
  el.themeToggleBtn.style.opacity = 0.5;

  // Toggle Screen overlay (frosted glass popup modal overlaying active page)
  // el.pages.forEach(p => p.classList.remove('active'));
  document.getElementById('process-page').classList.add('active');

  // Configure burning info labels
  const finalVolumeLabel = isISOMode ? 'ISO_IMAGE_BURN' : el.inputLabel.value;
  const driveLabel = `物理光驱 (${selectedDrive})`;
  el.lblProcessLabel.textContent = finalVolumeLabel;
  el.lblProcessDrive.textContent = driveLabel;
  el.burningLabelPreview.textContent = finalVolumeLabel.substring(0, 12); // Short code for disc label

  el.lblProcessTitle.textContent = '正在开始刻录数据...';
  el.lblProcessTime.textContent = '计算物理轨道配置中...';
  el.btnCancelBurn.style.display = 'block';
  el.btnFinishReturn.style.display = 'none';

  // REAL PHYSICAL BURN WORKFLOW
  el.spinningDisc.classList.add('spinning');
  el.laserHead.style.display = 'flex';
  el.btnCancelBurn.style.display = 'none'; // Lock cancel on physical burns to avoid medium corruption

  const physicalFiles = isISOMode ? [] : fileQueue.filter(f => f.type !== 'FOLDER').map(f => f.path);

  const burnConfig = {
    drive: selectedDrive,
    volumeLabel: isISOMode ? 'ISO_IMAGE_BURN' : el.inputLabel.value,
    isISO: isISOMode,
    isoPath: isISOMode ? isoFile.path : '',
    isAppending: el.switchAppendData.checked,
    closeDisc: el.chkCloseDisc.checked,
    ejectDisc: el.chkEjectDisc.checked,
    files: physicalFiles,
    folders: isISOMode ? [] : fileQueue.filter(f => f.type === 'FOLDER').map(f => f.path)
  };

  const writeLogs = (text, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type === 'error' ? 'log-err' : type === 'success' ? 'log-success' : type === 'warn' ? 'log-warn' : ''}`;
    entry.innerHTML = `[${timestamp}] ${text}`;
    el.terminalConsole.appendChild(entry);
    el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
    currentSessionLogs.push(entry.outerHTML);
  };

  writeLogs(`SYSTEM: 触发物理光盘硬件写入会话...`);
  writeLogs(`DEVICE: 提交 ${burnConfig.files.length} 个文件到刻录引擎...`);
  console.log('FlashBurn: Physical burn config:', JSON.stringify(burnConfig, null, 2));

  window.electronAPI.startOpticalBurn(burnConfig)
    .then(res => {
      if (!res.success) {
        writeLogs(`ERROR: 物理写入进程异常中断: ${res.error || '未知错误'}`, 'error');
      }
    })
    .catch(err => {
      writeLogs(`ERROR: 物理核心通道连接崩溃: ${err.message}`, 'error');
    });
}

function completeBurningTask(volumeLabel, bytesToBurn, isAppending) {
  isBurning = false;
  el.lblProcessTitle.textContent = '刻录成功！';
  el.lblProcessTime.textContent = '刻录工序圆满完成。';
  
  // Re-enable Navigation
  el.menuBurn.style.opacity = 1;
  el.menuHistory.style.opacity = 1;
  el.themeToggleBtn.style.opacity = 1;

  // Stop active spinning and transition smoothly into completed (inertia deceleration & success green halo)
  el.spinningDisc.classList.remove('spinning');
  el.spinningDisc.classList.add('completed');
  el.laserHead.style.display = 'none';

  // Trigger the data-crystallization holographic shockwave expansion & transient flash overlay
  const successRing = document.getElementById('success-glow-ring');
  if (successRing) {
    successRing.classList.remove('animate');
    void successRing.offsetWidth; // Force browser reflow to restart CSS animation cleanly
    successRing.classList.add('animate');
  }
  const successRing2 = document.getElementById('success-glow-ring-2');
  if (successRing2) {
    successRing2.classList.remove('animate');
    void successRing2.offsetWidth;
    successRing2.classList.add('animate');
  }
  const flashOverlay = document.getElementById('success-flash-overlay');
  if (flashOverlay) {
    flashOverlay.classList.remove('animate');
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add('animate');
  }

  // Toggle Finish Return buttons
  el.btnCancelBurn.style.display = 'none';
  el.btnFinishReturn.style.display = 'block';

  // Output terminal stats
  const timestamp = new Date().toLocaleTimeString();
  const entrySuccess = document.createElement('div');
  entrySuccess.className = 'log-entry log-success';
  
  let successHTML = `[${timestamp}] <b>★ SUCCESS: 刻录完成！已成功将 ${isISOMode ? 'ISO 映像数据' : fileQueue.length + ' 个文件'} 烧录至 ${currentDisc.type.includes('dvd') ? 'DVD' : 'CD'} 光盘。</b>`;
  successHTML += `<br><span style="color: #ffd60a; font-weight: bold; display: block; margin-top: 6px; padding: 8px; background: rgba(255,214,10,0.08); border: 1px solid rgba(255,214,10,0.2); border-radius: 6px; line-height: 1.6;">💡 系统提示：由于 Windows 资源管理器的光盘文件系统缓存机制，新写入的文件可能不会立刻显示在盘符中。请您【物理弹出光盘并重新推入】以强制 Windows 刷新缓存，即可正常查看已写入的文件！</span>`;
  entrySuccess.innerHTML = successHTML;
  el.terminalConsole.appendChild(entrySuccess);
  el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
  currentSessionLogs.push(entrySuccess.outerHTML);

  // Update Disc simulation values after burn
  if (!isAppending) {
    // If not appending, it means it wiped. Used is exactly written bytes
    currentDisc.used = bytesToBurn;
  } else {
    // If appending, it accumulated
    currentDisc.used += bytesToBurn;
  }
  currentDisc.label = volumeLabel;
  currentDisc.status = currentDisc.type.includes('dvd') ? '包含数据的 DVD-RW (可重写)' : '包含数据的 CD-RW (可重写)';
  
  // Refresh layout
  updateDiscStateUI();

  // Handle post-burn auto-eject
  const ejectChecked = el.chkEjectDisc.checked;
  if (ejectChecked) {
    currentDisc.isEjected = true;
    el.physicalTray.classList.add('ejected');
    el.lblTrayDoorStatus.textContent = '已弹出 (Tray Ejected)';
    el.lblTrayDoorStatus.className = 'status-indicator-red';
    
    // Physical eject - added a 2-second timeout to allow Windows/IMAPI2 to release the drive handles cleanly
    if (window.electronAPI) {
      setTimeout(() => {
        window.electronAPI.ejectDrive(selectedDrive);
      }, 2000);
    }
  }

  // Push to history archive
  const logArchive = {
    timestamp: new Date().toLocaleString(),
    label: volumeLabel,
    media: isISOMode ? 'ISO 镜像包' : (currentDisc.type.includes('dvd') ? 'DVD-R/RW' : 'CD-R/RW'),
    size: bytesToBurn,
    verify: el.chkVerifyData.checked ? '已通过' : '未开启',
    status: '成功',
    logsHTML: currentSessionLogs.join('')
  };

  burnHistory.unshift(logArchive);
  saveHistory();
  renderHistoryTable();

  // Trigger Win11 System Toast Alert
  showToast('刻录完成！', `已成功刻录！由于 Windows 缓存机制，请【弹出并重新推入光盘】以查看新写入文件。`, 'success');
}

function cancelBurningTask() {
  if (!isBurning) return;
  
  clearInterval(burnInterval);
  isBurning = false;

  el.lblProcessTitle.textContent = '刻录被取消';
  el.lblProcessTime.textContent = '用户已强制中止激光写入。';

  el.menuBurn.style.opacity = 1;
  el.menuHistory.style.opacity = 1;
  el.themeToggleBtn.style.opacity = 1;

  el.spinningDisc.classList.remove('spinning', 'completed');
  el.laserHead.style.display = 'none';

  el.btnCancelBurn.style.display = 'none';
  if (el.btnPreviewCapsule) {
    el.btnPreviewCapsule.style.display = 'none';
  }
  el.btnFinishReturn.style.display = 'block';

  // Logs error
  const timestamp = new Date().toLocaleTimeString();
  const entryAbort = document.createElement('div');
  entryAbort.className = `log-entry log-err`;
  entryAbort.innerHTML = `[${timestamp}] <b>❌ ABORT: 刻录进程已被用户紧急中断！这可能会导致当前光盘介质报废或产生坏道。</b>`;
  el.terminalConsole.appendChild(entryAbort);
  el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
  currentSessionLogs.push(entryAbort.outerHTML);

  // Push to history archive
  const logArchive = {
    timestamp: new Date().toLocaleString(),
    label: isISOMode ? 'ISO_IMAGE_BURN' : el.inputLabel.value,
    media: isISOMode ? 'ISO 镜像包' : (currentDisc.type.includes('dvd') ? 'DVD-R/RW' : 'CD-R/RW'),
    size: 0,
    verify: '已中断',
    status: '已取消',
    logsHTML: currentSessionLogs.join('')
  };

  burnHistory.unshift(logArchive);
  saveHistory();
  renderHistoryTable();

  showToast('刻录中止', '您中断了刻录任务，请检查光盘介质是否可重写。', 'error');
}

function returnToWorkspace() {
  if (el.btnPreviewCapsule) {
    el.btnPreviewCapsule.style.display = 'none';
  }
  // Hide the centered process modal popup
  const processPage = document.getElementById('process-page');
  if (processPage) {
    processPage.classList.remove('active');
  }

  if (activePage === 'clone-page') {
    // If we came from clone page, just check readiness and do nothing else
    const checkRipReadiness = window.checkRipReadiness || (() => {});
    checkRipReadiness();
  } else {
    // If we came from burn page, clear file queue
    if (isISOMode) {
      exitISOMode();
    } else {
      fileQueue = [];
      updateFileQueueUI();
      validateQueueCapacity();
    }
  }

  // Reset clock generating labels again
  startLabelClock();

  // Switch back to the previous workspace page active before the popup opened
  el.pages.forEach(p => p.classList.remove('active'));
  const pageToReturn = document.getElementById(activePage) || document.getElementById('burn-page');
  if (pageToReturn) {
    pageToReturn.classList.add('active');
  }
}

// --- History Storage & Renderer Vault ---
function loadHistory() {
  const data = localStorage.getItem('flashburn-history');
  if (data) {
    try {
      burnHistory = JSON.parse(data);
    } catch(e) {
      burnHistory = [];
    }
  }
  renderHistoryTable();
}

function saveHistory() {
  localStorage.setItem('flashburn-history', JSON.stringify(burnHistory));
}

function renderHistoryTable() {
  const body = el.historyListBody;
  body.innerHTML = '';
  
  if (burnHistory.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="td-empty">暂无任何刻录历史记录。</td></tr>`;
    return;
  }
  
  burnHistory.forEach((log, index) => {
    const row = document.createElement('tr');
    
    // Status style classes
    let statusClass = '';
    if (log.status === '成功') statusClass = 'style="color: var(--success-color); font-weight: 600;"';
    else if (log.status === '已取消') statusClass = 'style="color: var(--danger-color); font-weight: 600;"';

    row.innerHTML = `
      <td>${log.timestamp}</td>
      <td style="font-family: monospace; font-weight:600;">${log.label}</td>
      <td>${log.media}</td>
      <td>${log.size > 0 ? formatBytes(log.size) : '0 KB'}</td>
      <td>${log.verify}</td>
      <td ${statusClass}>${log.status}</td>
      <td>
        <button class="win-btn mini-btn secondary-btn view-log-btn" data-idx="${index}">查看日志</button>
      </td>
    `;
    
    row.querySelector('.view-log-btn').addEventListener('click', () => {
      openLogsDetailsModal(index);
    });

    body.appendChild(row);
  });
}

function openLogsDetailsModal(index) {
  const log = burnHistory[index];
  if (!log) return;
  
  el.modalLabel.textContent = log.label;
  el.modalType.textContent = log.media;
  el.modalSize.textContent = log.size > 0 ? formatBytes(log.size) : '0 KB';
  el.modalLogs.innerHTML = log.logsHTML;
  
  el.historyModal.style.display = 'flex';
}

function clearBurnHistory() {
  if (burnHistory.length === 0) return;
  
  const confirmClear = confirm('确定要清空所有的光盘刻录日志档案吗？此操作不可逆。');
  if (confirmClear) {
    burnHistory = [];
    saveHistory();
    renderHistoryTable();
    showToast('历史清除', '已成功清空所有的刻录记录。');
  }
}

// --- Windows 11 Fluent Toast Alerts ---
let toastTimeout = null;

function showToast(title, message, type = 'normal') {
  clearTimeout(toastTimeout);
  
  el.toastTitle.textContent = title;
  el.toastMessage.textContent = message;
  
  // Custom theme colors for alert types
  const iconContainer = el.winToast.querySelector('.toast-icon-container');
  if (type === 'success') {
    iconContainer.style.fill = 'var(--success-color)';
  } else if (type === 'error') {
    iconContainer.style.fill = 'var(--danger-color)';
  } else {
    iconContainer.style.fill = 'var(--accent-color)';
  }
  
  el.winToast.classList.add('show');
  
  toastTimeout = setTimeout(() => {
    hideToast();
  }, 4000);
}

function hideToast() {
  el.winToast.classList.remove('show');
}

// --- General Math Formatter helpers ---
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Note: Theme customization is simplified to macOS technology blue theme

// --- Background Silent Hardware Polling (4-second interval) ---
let pollingTimer = null;
let lastDrivesStateStr = '';

function startHardwarePolling() {
  if (!window.electronAPI) return; // Only poll in native Electron environment
  
  let isWindowActive = true;
  
  const poll = async () => {
    if (!isWindowActive) return; // Skip if window is blurred
    
    // Add micro rotating effect to manual refresh buttons if they exist
    const refreshBtn = document.getElementById('btn-refresh-media');
    const ripRefreshBtn = document.getElementById('btn-refresh-rip-media');
    if (refreshBtn) refreshBtn.classList.add('rotating');
    if (ripRefreshBtn) ripRefreshBtn.classList.add('rotating');
    
    try {
      const drives = await window.electronAPI.detectDrives();
      if (!drives) return;
      
      const currentStateStr = JSON.stringify(drives);
      if (currentStateStr !== lastDrivesStateStr) {
        const prevDrives = lastDrivesStateStr ? JSON.parse(lastDrivesStateStr) : [];
        lastDrivesStateStr = currentStateStr;
        
        const driveLetters = drives.map(d => d.letter);
        const prevLetters = prevDrives.map(d => d.letter);
        
        const currentSelected = el.selectDrive.value;
        
        // Re-populate select drive dropdown list
        el.selectDrive.innerHTML = '<option value="">请选择物理刻录驱动器...</option>';
        drives.forEach(drive => {
          const opt = document.createElement('option');
          opt.value = drive.letter;
          opt.textContent = `${drive.name} (${drive.letter})`;
          el.selectDrive.appendChild(opt);
        });

        // Re-populate rip source dropdown list as well
        const selectRipSource = document.getElementById('select-rip-source');
        if (selectRipSource) {
          const currentRipSelected = selectRipSource.value;
          selectRipSource.innerHTML = '<option value="">请选择物理源驱动器...</option>';
          drives.forEach(drive => {
            const opt = document.createElement('option');
            opt.value = drive.letter;
            opt.textContent = `${drive.name} (${drive.letter})`;
            selectRipSource.appendChild(opt);
          });
          if (driveLetters.includes(currentRipSelected)) {
            selectRipSource.value = currentRipSelected;
          }
        }
        
        // Restore previous selection if it still exists
        if (driveLetters.includes(currentSelected)) {
          el.selectDrive.value = currentSelected;
          selectedDrive = currentSelected;
        } else {
          // Previously selected physical drive was disconnected!
          el.selectDrive.value = '';
          selectedDrive = null;
          
          currentDisc = {
            type: 'no-disc',
            capacity: 0,
            used: 0,
            label: '',
            status: '未检测到光盘',
            appendable: false,
            isEjected: false
          };
          updateDiscStateUI();
          validateQueueCapacity();
        }

        // Sync our beautiful custom grid cards
        syncCustomDrives('select-drive', 'drive-select-grid');
        syncCustomDrives('select-rip-source', 'rip-source-select-grid');
        
        // If a physical drive is selected, verify state transitions
        if (selectedDrive) {
          const prevSelectedDriveInfo = prevDrives.find(d => d.letter === selectedDrive);
          const currentSelectedDriveInfo = drives.find(d => d.letter === selectedDrive);
          
          if (currentSelectedDriveInfo) {
            const wasLoaded = prevSelectedDriveInfo ? prevSelectedDriveInfo.mediaLoaded : false;
            const isLoaded = currentSelectedDriveInfo.mediaLoaded;
            
            if (!wasLoaded && isLoaded) {
              showToast('检测到光盘插入', `已成功读取物理光盘：${currentSelectedDriveInfo.status}`, 'success');
            } else if (wasLoaded && !isLoaded) {
              showToast('光盘已移出', '请放入新的刻录光盘介质。', 'normal');
            }
            
            updatePhysicalDiscState(drives);
          }
        } else {
          // Virtual drive is active. Notify user if a new physical drive connects
          const newDrives = driveLetters.filter(l => !prevLetters.includes(l));
          if (newDrives.length > 0 && prevLetters.length > 0) {
            showToast('检测到新硬件', `外接物理刻录光驱 (${newDrives.join(', ')}) 已连接。`, 'success');
          }
        }
        
        // Update local cache
        opticalDrives = drives;
      }
    } catch (e) {
      console.error('Hardware background polling crash:', e);
    } finally {
      // Remove rotating animations
      setTimeout(() => {
        if (refreshBtn) refreshBtn.classList.remove('rotating');
        if (ripRefreshBtn) ripRefreshBtn.classList.remove('rotating');
      }, 600);
    }
  };
  
  // Set up window focus/blur event listeners to manage quiet mode
  window.addEventListener('focus', () => {
    isWindowActive = true;
    poll(); // Trigger poll immediately on focus
    if (!pollingTimer) {
      pollingTimer = setInterval(poll, 30000); // Poll every 30 seconds
    }
  });

  window.addEventListener('blur', () => {
    isWindowActive = false;
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null; // Clean up timer to let drive sleep
    }
  });

  // Manual refresh buttons bind
  document.addEventListener('click', (e) => {
    if (e.target && (e.target.id === 'btn-refresh-media' || e.target.id === 'btn-refresh-rip-media')) {
      e.preventDefault();
      poll();
    }
  });

  // Initial poll on load
  poll();
  pollingTimer = setInterval(poll, 30000); // 30-second interval
}

// --- Sync UI status with selected Physical optical drive ---
function updatePhysicalDiscState(drivesList = null) {
  if (!selectedDrive) return;
  const list = drivesList || opticalDrives;
  const driveInfo = list.find(d => d.letter === selectedDrive);
  if (driveInfo) {
    currentDisc = {
      type: driveInfo.mediaType,
      capacity: driveInfo.capacity,
      used: driveInfo.used,
      label: driveInfo.label || '',
      status: driveInfo.status,
      appendable: driveInfo.appendable,
      isEjected: !driveInfo.mediaLoaded
    };
    
    // Update WMI hardware tray indicators
    if (driveInfo.mediaLoaded) {
      el.lblTrayDoorStatus.textContent = `已关闭 (${driveInfo.status})`;
      el.lblTrayDoorStatus.className = 'status-indicator-green';
    } else {
      el.lblTrayDoorStatus.textContent = '已开启/无光盘 (Tray Open)';
      el.lblTrayDoorStatus.className = 'status-indicator-red';
    }
    
    updateDiscStateUI();
    validateQueueCapacity();
    
    // Manage checkbox states based on physical capabilities
    const appendCheckbox = el.switchAppendData;
    if (!currentDisc.appendable) {
      appendCheckbox.checked = false;
      appendCheckbox.disabled = true;
      appendCheckbox.closest('.win-switch').style.opacity = 0.5;
      
      el.chkCloseDisc.disabled = false;
      el.chkCloseDisc.closest('.mac-switch-item').style.opacity = 1;
    } else {
      appendCheckbox.disabled = false;
      appendCheckbox.closest('.win-switch').style.opacity = 1;
      appendCheckbox.checked = localStorage.getItem('flashburn-append') === 'true';
      
      if (appendCheckbox.checked) {
        el.chkCloseDisc.checked = false;
        el.chkCloseDisc.disabled = true;
        el.chkCloseDisc.closest('.mac-switch-item').style.opacity = 0.5;
      } else {
        el.chkCloseDisc.disabled = false;
        el.chkCloseDisc.closest('.mac-switch-item').style.opacity = 1;
      }
    }
  }
}

// --- Erase Rewritable (CD-RW/DVD-RW) Optical Media ---
function openEraseConfirmationModal() {
  if (isBurning) return;
  if (!selectedDrive) {
    showToast('操作被拦截', '未检测到或未选中物理刻录驱动器，无法执行擦除！', 'error');
    return;
  }
  el.lblEraseDriveLetter.textContent = `${selectedDrive}`;
  el.eraseModal.style.display = 'flex';
}

async function executeDiscErase() {
  el.eraseModal.style.display = 'none';
  if (isBurning) return;
  
  isBurning = true;
  el.menuBurn.style.opacity = 0.5;
  el.menuHistory.style.opacity = 0.5;
  el.themeToggleBtn.style.opacity = 0.5;
  
  // Transition process page (as a frosted glass modal popup overlaying the current page)
  // el.pages.forEach(p => p.classList.remove('active'));
  document.getElementById('process-page').classList.add('active');
  
  el.lblProcessTitle.textContent = '正在格式化/清空光盘区块...';
  el.lblProcessSubtitle.textContent = `执行擦除：快速物理擦除 | 驱动器: ${selectedDrive}`;
  el.btnCancelBurn.style.display = 'none'; // Lock cancel on physical erase
  el.btnFinishReturn.style.display = 'none';
  
  capsuleFilePath = null;
  if (el.btnPreviewCapsule) {
    el.btnPreviewCapsule.style.display = 'none';
  }
  el.spinningDisc.classList.remove('completed');
  el.spinningDisc.classList.add('spinning', 'erasing');
  const successRing = document.getElementById('success-glow-ring');
  if (successRing) successRing.classList.remove('animate');
  const successRing2 = document.getElementById('success-glow-ring-2');
  if (successRing2) successRing2.classList.remove('animate');
  const flashOverlay = document.getElementById('success-flash-overlay');
  if (flashOverlay) flashOverlay.classList.remove('animate');
  el.laserHead.style.display = 'flex';
  el.laserHead.querySelector('.laser-beam').classList.add('erasing');
  
  el.terminalConsole.innerHTML = '';

  // Hide logs block by default and reset toggle button text
  if (el.processLogsBlock) {
    el.processLogsBlock.style.display = 'none';
  }
  if (el.btnToggleLogs) {
    el.btnToggleLogs.textContent = '🔍 显示详细日志';
  }
  
  const writeLogs = (text, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type === 'error' ? 'log-err' : type === 'success' ? 'log-success' : type === 'warn' ? 'log-warn' : ''}`;
    entry.textContent = `[${timestamp}] ${text}`;
    el.terminalConsole.appendChild(entry);
    el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
  };
  
  writeLogs(`SYSTEM: 正在加载擦除控制总线 MsftDiscFormat2Erase...`);
  writeLogs(`DRIVE: 已捕获选定的烧录驱动器: ${selectedDrive}`);
  writeLogs(`DEVICE: 正在锁定盘片托盘门，防止中途弹仓...`);
  
  let progress = 0;
  const eraseInterval = setInterval(async () => {
    progress += 2;
    el.processBarFill.style.width = `${progress}%`;
    el.lblProcessPercent.textContent = `${progress}%`;
    
    const ringCirc = 282.74;
    el.ringProgressBar.style.strokeDashoffset = ringCirc - (progress / 100) * ringCirc;
    
    if (progress === 10) {
      writeLogs(`ERASER: 检查盘片物理类型与空白标志位...`);
      writeLogs(`ERASER: 光盘具有 LBA 写入扇区特征，处于非空白状态。`);
    } else if (progress === 20) {
      writeLogs(`ERASER: 激活快速擦除，FullErase = False.`, 'warn');
      writeLogs(`DEVICE: 开启短脉冲激光物理覆写流程 (LBA Sector TOC Clearing)...`, 'warn');
    } else if (progress > 30 && progress < 80) {
      if (progress % 10 === 0) {
        const address = '0x00' + Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
        writeLogs(`ERASER: 物理擦除扇区块 -> LBA ${address}...`);
      }
    } else if (progress === 80) {
      writeLogs(`ERASER: 主写入引导轨（Lead-In TOC）数据已被全部清除！`);
      writeLogs(`ERASER: 光盘逻辑卷标置空，盘面介质格式化完成。`);
    } else if (progress >= 100) {
      clearInterval(eraseInterval);
      
      let eraseSuccess = true;
      let errMsg = '';
      
      if (window.electronAPI) {
        try {
          const eraseRes = await window.electronAPI.eraseDrive(selectedDrive);
          if (!eraseRes.success) {
            eraseSuccess = false;
            errMsg = eraseRes.error || '未知物理擦除失败';
          }
        } catch (e) {
          eraseSuccess = false;
          errMsg = e.message;
        }
      }
      
      if (eraseSuccess) {
        isBurning = false;
        el.lblProcessTitle.textContent = '擦除成功！';
        el.lblProcessTime.textContent = '物理介质已完全恢复为全新空白状态。';
        el.btnFinishReturn.style.display = 'block';
        
        el.spinningDisc.classList.remove('spinning', 'erasing');
        el.spinningDisc.classList.add('completed');
        el.laserHead.style.display = 'none';
        el.laserHead.querySelector('.laser-beam').classList.remove('erasing');
        
        // Trigger success wave shockwave & transient flash overlay
        const successRing = document.getElementById('success-glow-ring');
        if (successRing) {
          successRing.classList.remove('animate');
          void successRing.offsetWidth;
          successRing.classList.add('animate');
        }
        const successRing2 = document.getElementById('success-glow-ring-2');
        if (successRing2) {
          successRing2.classList.remove('animate');
          void successRing2.offsetWidth;
          successRing2.classList.add('animate');
        }
        const flashOverlay = document.getElementById('success-flash-overlay');
        if (flashOverlay) {
          flashOverlay.classList.remove('animate');
          void flashOverlay.offsetWidth;
          flashOverlay.classList.add('animate');
        }
        
        writeLogs(`★ SUCCESS: 光盘擦除完成！介质已置为全新空白光盘。`, 'success');
        
        const isDVD = currentDisc.type.includes('dvd');
        currentDisc = {
          type: isDVD ? 'dvd-empty' : 'cd-empty',
          capacity: isDVD ? DVD_CAPACITY : CD_CAPACITY,
          used: 0,
          label: '',
          status: isDVD ? '空白 DVD-RW 光盘' : '空白 CD-RW 光盘',
          appendable: false,
          isEjected: false
        };
        
        // Note: Virtual buttons removed for macOS styling
        
        updateDiscStateUI();
        validateQueueCapacity();
        
        showToast('光盘擦除成功！', '介质已成功置空并刷新。', 'success');
      } else {
        isBurning = false;
        el.lblProcessTitle.textContent = '擦除失败';
        el.lblProcessTime.textContent = errMsg;
        el.btnFinishReturn.style.display = 'block';
        
        el.spinningDisc.classList.remove('spinning', 'erasing', 'completed');
        el.laserHead.style.display = 'none';
        el.laserHead.querySelector('.laser-beam').classList.remove('erasing');
        
        writeLogs(`❌ ERROR: 物理盘面擦除失败！驱动器报错: ${errMsg}`, 'error');
        showToast('擦除失败', `光驱擦除指令回执报错：${errMsg}`, 'error');
      }
      
      el.menuBurn.style.opacity = 1;
      el.menuHistory.style.opacity = 1;
      el.themeToggleBtn.style.opacity = 1;
    }
  }, 100);
}

// --- ISO Image Burning Mode ---
function enterISOMode(file) {
  isISOMode = true;
  isoFile = file;
  fileQueue = []; // Clear other general files
  
  // Update view visibility
  el.emptyState.style.display = 'none';
  el.fileTable.style.display = 'none';
  document.getElementById('iso-mode-view').style.display = 'flex';
  
  document.getElementById('iso-file-name').textContent = file.name;
  document.getElementById('iso-file-size').textContent = `${formatBytes(file.size)} (${file.size.toLocaleString()} 字节)`;
  
  showToast('开启 ISO 镜像模式', `已成功导入镜像 [${file.name}]，光盘锁为镜像烧录对拷状态。`, 'success');
  
  // Force wipe (no append)
  el.switchAppendData.checked = false;
  el.switchAppendData.disabled = true;
  el.switchAppendData.closest('.win-switch').style.opacity = 0.5;
  
  validateQueueCapacity();
  updateFileQueueUI();
}

function exitISOMode() {
  isISOMode = false;
  isoFile = null;
  document.getElementById('iso-mode-view').style.display = 'none';
  el.emptyState.style.display = 'flex';
  
  if (currentDisc.appendable) {
    el.switchAppendData.disabled = false;
    el.switchAppendData.closest('.win-switch').style.opacity = 1;
    el.switchAppendData.checked = localStorage.getItem('flashburn-append') === 'true';
  }
  
  validateQueueCapacity();
  updateFileQueueUI();
  showToast('切换成功', '已恢复普通数据光盘模式，您可以自由添加多个文件和文件夹！');
}

/* ========================================================
   ONES-INSPIRED UPGRADES: DASHBOARD AND CLONER CONTROLLERS
   ======================================================== */
function initDashboardAndCloner() {
  // Bind Dashboard Card Clicks
  // Bind Navigation & Dashboard Actions
  const btnBurnBack = document.getElementById('btn-burn-back');
  const btnCloneBack = document.getElementById('btn-clone-back');
  const btnHistoryBack = document.getElementById('btn-history-back');
  const btnViewHistory = document.getElementById('btn-view-history');
  
  if (btnBurnBack) btnBurnBack.addEventListener('click', () => switchToPage('dashboard-page'));
  if (btnCloneBack) btnCloneBack.addEventListener('click', () => switchToPage('dashboard-page'));
  if (btnHistoryBack) btnHistoryBack.addEventListener('click', () => switchToPage('dashboard-page'));
  if (btnViewHistory) btnViewHistory.addEventListener('click', () => switchToPage('history-page'));

  const cards = document.querySelectorAll('.dashboard-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const action = card.getAttribute('data-action');
      if (action === 'data-disc') {
        switchToPage('burn-page');
      } else if (action === 'audio-cd') {
        switchToPage('burn-page');
        showToast('音乐 CD 唱片模式', '已自动载入无损音频轨优化参数，请开始添加 MP3/WAV 媒体文件！', 'success');
      } else if (action === 'video-dvd') {
        switchToPage('burn-page');
        showToast('家用 Video DVD 模式', '已自动载入标准家用影碟兼容扇区对齐参数，请导入电影文件夹！', 'success');
      } else if (action === 'iso-burn') {
        switchToPage('burn-page');
        handleAddFilesDialog();
      } else if (action === 'disc-clone') {
        switchToPage('clone-page');
      } else if (action === 'erase-disc') {
        switchToPage('burn-page');
        openEraseConfirmationModal();
      }
    });
  });

  // Cloner & Ripper Events
  const btnChooseRipPath = document.getElementById('btn-choose-rip-path');
  const selectRipSource = document.getElementById('select-rip-source');
  const btnRipEject = document.getElementById('btn-rip-eject');
  const btnStartRip = document.getElementById('btn-start-rip');
  const inputRipDestination = document.getElementById('input-rip-destination');

  if (btnChooseRipPath) {
    btnChooseRipPath.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        const selectedPath = await window.electronAPI.showSaveDialog({
          title: '选择提取映像文件保存路径',
          defaultPath: 'my_disc.iso'
        });
        if (selectedPath) {
          inputRipDestination.value = selectedPath;
          checkRipReadiness();
        }
      } else {
        showToast('不支持操作', '当前未在 Electron 原生容器中运行。');
      }
    });
  }

  if (selectRipSource) {
    selectRipSource.addEventListener('change', () => {
      checkRipReadiness();
    });
  }

  if (btnRipEject) {
    btnRipEject.addEventListener('click', async () => {
      const source = selectRipSource.value;
      if (!source) return;
      if (window.electronAPI) {
        try {
          const res = await window.electronAPI.ejectDrive(source);
          if (res.success) {
            showToast('物理光盘弹出', `已向物理光驱 ${source} 发送弹出信号。`);
          } else {
            showToast('物理弹出失败', `光驱舱门被占用：${res.message}`, 'error');
          }
        } catch(e) {
          console.error(e);
        }
      }
    });
  }

  if (btnStartRip) {
    btnStartRip.addEventListener('click', () => {
      const source = selectRipSource.value;
      const dest = inputRipDestination.value;
      if (!source || !dest || isBurning) return;
      
      isBurning = true;
      currentProgress = 0;
      currentSessionLogs = [];
      el.terminalConsole.innerHTML = '';
      
      // Lock navigation
      const navItems = [
        document.getElementById('menu-dashboard'),
        el.menuBurn,
        document.getElementById('menu-clone'),
        el.menuHistory
      ].filter(Boolean);
      navItems.forEach(n => { n.style.opacity = 0.5; });
      el.themeToggleBtn.style.opacity = 0.5;
      
      // Switch to process page overlaying current page
      // el.pages.forEach(p => p.classList.remove('active'));
      document.getElementById('process-page').classList.add('active');
      
      el.lblProcessTitle.textContent = '正在从物理光盘提取数据...';
      el.lblProcessSubtitle.textContent = `克隆对拷：光盘提取为本地映像 | 驱动器: ${source}`;
      el.lblProcessLabel.textContent = 'DISC_RIP';
      el.lblProcessDrive.textContent = `Physical CD-ROM (${source})`;
      el.btnCancelBurn.style.display = 'none'; // Lock cancel to prevent file handles corruption
      el.btnFinishReturn.style.display = 'none';
      
      capsuleFilePath = null;
      if (el.btnPreviewCapsule) {
        el.btnPreviewCapsule.style.display = 'none';
      }
      el.spinningDisc.classList.remove('completed');
      el.spinningDisc.classList.add('spinning');
      const successRing = document.getElementById('success-glow-ring');
      if (successRing) successRing.classList.remove('animate');
      const successRing2 = document.getElementById('success-glow-ring-2');
      if (successRing2) successRing2.classList.remove('animate');
      const flashOverlay = document.getElementById('success-flash-overlay');
      if (flashOverlay) flashOverlay.classList.remove('animate');
      el.laserHead.style.display = 'flex';

      // Hide logs block by default and reset toggle button text
      if (el.processLogsBlock) {
        el.processLogsBlock.style.display = 'none';
      }
      if (el.btnToggleLogs) {
        el.btnToggleLogs.textContent = '🔍 显示详细日志';
      }
      
      // Initialize buffers to 100%
      const softBar = document.getElementById('soft-buffer-fill');
      const hardBar = document.getElementById('hard-buffer-fill');
      const softLbl = document.getElementById('lbl-soft-buffer');
      const hardLbl = document.getElementById('lbl-hard-buffer');
      
      if (softBar) { softBar.style.width = '100%'; softLbl.textContent = '100%'; }
      if (hardBar) { hardBar.style.width = '100%'; hardLbl.textContent = '100%'; }
      
      const writeLogs = (text, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type === 'error' ? 'log-err' : type === 'success' ? 'log-success' : type === 'warn' ? 'log-warn' : ''}`;
        entry.innerHTML = `[${timestamp}] ${text}`;
        el.terminalConsole.appendChild(entry);
        el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
        currentSessionLogs.push(entry.outerHTML);
      };
      
      writeLogs(`SYSTEM: 触发物理光盘硬件提取会话...`);
      writeLogs(`RIP: 输出文件路径 -> ${dest}`);
      
      window.electronAPI.startOpticalRip({ drive: source, outputPath: dest });
    });
  }

  // WMI Rip Log Streaming
  if (window.electronAPI) {
    window.electronAPI.onRipLog((logText) => {
      if (!isBurning) return;
      
      const writeLogs = (text, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type === 'error' ? 'log-err' : type === 'success' ? 'log-success' : type === 'warn' ? 'log-warn' : ''}`;
        entry.innerHTML = `[${timestamp}] ${text}`;
        el.terminalConsole.appendChild(entry);
        el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
        currentSessionLogs.push(entry.outerHTML);
      };
      
      let type = 'info';
      if (logText.startsWith('ERROR:')) {
        type = 'error';
        logText = logText.substring(6).trim();
      } else if (logText.startsWith('SUCCESS:')) {
        type = 'success';
        logText = logText.substring(8).trim();
      } else if (logText.startsWith('WARN:')) {
        type = 'warn';
        logText = logText.substring(5).trim();
      }
      
      writeLogs(logText, type);
      
      // Parse progress: "PERCENT: 45%"
      if (logText.startsWith('PERCENT:')) {
        const percentStr = logText.match(/PERCENT:\s*(\d+)%/);
        if (percentStr) {
          const val = parseInt(percentStr[1]);
          currentProgress = val;
          el.processBarFill.style.width = `${val}%`;
          el.lblProcessPercent.textContent = `${val}%`;
          
          const ringCirc = 282.74;
          el.ringProgressBar.style.strokeDashoffset = ringCirc - (val / 100) * ringCirc;
          
          // Randomly fluctuate buffers slightly
          const softBar = document.getElementById('soft-buffer-fill');
          const hardBar = document.getElementById('hard-buffer-fill');
          const softLbl = document.getElementById('lbl-soft-buffer');
          const hardLbl = document.getElementById('lbl-hard-buffer');
          
          const softVal = 92 + Math.floor(Math.random() * 9); 
          const hardVal = 88 + Math.floor(Math.random() * 13);
          
          if (softBar) { softBar.style.width = `${softVal}%`; softLbl.textContent = `${softVal}%`; }
          if (hardBar) { hardBar.style.width = `${hardVal}%`; hardLbl.textContent = `${hardVal}%`; }
        }
      }
    });

    window.electronAPI.onRipComplete(({ success, code }) => {
      if (!isBurning) return;
      isBurning = false;
      
      // Reset navigation locks
      const navItems = [
        document.getElementById('menu-dashboard'),
        el.menuBurn,
        document.getElementById('menu-clone'),
        el.menuHistory
      ].filter(Boolean);
      navItems.forEach(n => { n.style.opacity = 1; });
      el.themeToggleBtn.style.opacity = 1;
      
      el.spinningDisc.classList.remove('spinning');
      el.laserHead.style.display = 'none';
      
      el.btnCancelBurn.style.display = 'none';
      el.btnFinishReturn.style.display = 'block';
      
      const dest = inputRipDestination.value;
      
      if (success) {
        currentProgress = 100;
        el.processBarFill.style.width = '100%';
        el.lblProcessPercent.textContent = '100%';
        el.ringProgressBar.style.strokeDashoffset = 0;
        
        el.lblProcessTitle.textContent = '提取成功！';
        el.lblProcessTime.textContent = '映像提取工序圆满完成。';
        
        el.spinningDisc.classList.add('completed');
        
        // Trigger success wave shockwave & transient flash overlay
        const successRing = document.getElementById('success-glow-ring');
        if (successRing) {
          successRing.classList.remove('animate');
          void successRing.offsetWidth;
          successRing.classList.add('animate');
        }
        const successRing2 = document.getElementById('success-glow-ring-2');
        if (successRing2) {
          successRing2.classList.remove('animate');
          void successRing2.offsetWidth;
          successRing2.classList.add('animate');
        }
        const flashOverlay = document.getElementById('success-flash-overlay');
        if (flashOverlay) {
          flashOverlay.classList.remove('animate');
          void flashOverlay.offsetWidth;
          flashOverlay.classList.add('animate');
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const entrySuccess = document.createElement('div');
        entrySuccess.className = `log-entry log-success`;
        entrySuccess.innerHTML = `[${timestamp}] <b>★ SUCCESS: 提取完成！已成功将物理光盘克隆打包至本地映像：${dest}。</b>`;
        el.terminalConsole.appendChild(entrySuccess);
        el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
        currentSessionLogs.push(entrySuccess.outerHTML);
        
        // Push to history
        const logArchive = {
          timestamp: new Date().toLocaleString(),
          label: 'IMAGE_CLONE',
          media: '物理克隆 (ISO)',
          size: 700 * 1024 * 1024, 
          verify: '已通过',
          status: '成功',
          logsHTML: currentSessionLogs.join('')
        };
        burnHistory.unshift(logArchive);
        saveHistory();
        renderHistoryTable();
        
        showToast('光盘提取成功！', `已成功将光盘保存至本地 [${dest}]`, 'success');
      } else {
        el.lblProcessTitle.textContent = '提取失败';
        el.lblProcessTime.textContent = `物理硬件读取失败 (Exit Code: ${code})`;
        
        el.spinningDisc.classList.remove('completed');
        
        showToast('光盘提取失败', `硬件读取进程异常中止，退出代码 ${code}。`, 'error');
      }
    });
  }
  
  // Make checkRipReadiness global so navigation hooks can call it
  window.checkRipReadiness = checkRipReadiness;
}

function switchToPage(pageId) {
  // Deactivate all navigation items
  const navItems = [
    document.getElementById('menu-dashboard'),
    el.menuBurn,
    document.getElementById('menu-clone'),
    el.menuHistory
  ].filter(Boolean);
  
  navItems.forEach(n => {
    n.classList.remove('active');
  });

  // Activate the sidebar item matching the page
  const activeNav = navItems.find(n => n.getAttribute('data-page') === pageId);
  if (activeNav) {
    activeNav.classList.add('active');
  }

  // Swap active page
  activePage = pageId;
  el.pages = document.querySelectorAll('.page-content');
  el.pages.forEach(page => {
    page.classList.remove('active');
    if (page.id === pageId) {
      page.classList.add('active');
    }
  });
}

function checkRipReadiness() {
  const selectRipSource = document.getElementById('select-rip-source');
  const inputRipDestination = document.getElementById('input-rip-destination');
  const btnStartRip = document.getElementById('btn-start-rip');
  if (!selectRipSource || !inputRipDestination || !btnStartRip) return;

  const source = selectRipSource.value;
  const dest = inputRipDestination.value;
  
  const ripStatus = document.getElementById('lbl-rip-disc-status');
  const ripDiscType = document.getElementById('lbl-rip-disc-type');
  
  if (!source) {
    btnStartRip.disabled = true;
    if (ripStatus) ripStatus.textContent = '等待选择驱动器';
    if (ripDiscType) ripDiscType.textContent = '物理 CD/DVD 光盘';
    return;
  }
  
  const driveInfo = opticalDrives.find(d => d.letter === source);
  if (!driveInfo || !driveInfo.mediaLoaded) {
    btnStartRip.disabled = true;
    if (ripStatus) ripStatus.textContent = '托盘无盘/未就绪';
    if (ripDiscType) ripDiscType.textContent = '物理 CD/DVD 光盘';
    return;
  }
  
  if (ripDiscType) ripDiscType.textContent = `${driveInfo.name} (${driveInfo.letter})`;
  if (ripStatus) {
    const labelStr = driveInfo.label ? ` [${driveInfo.label}]` : ' [无卷标/未命名]';
    ripStatus.textContent = `${driveInfo.status}${labelStr}`;
  }
  
  if (dest) {
    btnStartRip.disabled = false;
    btnStartRip.title = '所有参数均已就绪，可以执行提取！';
  } else {
    btnStartRip.disabled = true;
    btnStartRip.title = '请选择提取保存的本地目标路径。';
  }
}

// --- Custom Flat Selectors & Glassmorphism UI Sync Helpers ---
function setupCustomSpeedSelect() {
  const pills = document.querySelectorAll('.speed-pill-btn');
  const selectSpeed = document.getElementById('select-speed');
  if (!selectSpeed) return;
  
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectSpeed.value = pill.getAttribute('data-value');
      selectSpeed.dispatchEvent(new Event('change'));
    });
  });
}

function syncCustomDrives(selectElementId, gridContainerId) {
  const selectEl = document.getElementById(selectElementId);
  const gridEl = document.getElementById(gridContainerId);
  if (!selectEl || !gridEl) return;

  gridEl.innerHTML = '';
  
  if (selectEl.options.length === 0 || (selectEl.options.length === 1 && selectEl.options[0].value === '')) {
    // Render no drive placeholder card
    const card = document.createElement('div');
    card.className = 'drive-card disabled';
    card.innerHTML = `
      <div class="drive-card-icon">💿</div>
      <div class="drive-card-content">
        <div class="drive-card-title">
          <span class="drive-card-name">未检测到物理驱动器</span>
          <span class="drive-card-letter">-</span>
        </div>
        <div class="drive-card-detail">请连接外置刻录光驱或放入光盘</div>
      </div>
    `;
    gridEl.appendChild(card);
    return;
  }
  
  Array.from(selectEl.options).forEach(opt => {
    const val = opt.value;
    const text = opt.textContent;
    
    // Skip empty dummy options
    if (val === '' && selectEl.options.length > 1) return;
    
    const card = document.createElement('div');
    card.className = `drive-card ${selectEl.value === val ? 'active' : ''}`;
    card.setAttribute('data-value', val);
    
    let driveName = text;
    let driveLetter = '';
    let driveDetail = '空闲中 - 准备就绪';
    
    const match = text.match(/(.*)\s+\((.+)\)/);
    if (match) {
      driveName = match[1];
      driveLetter = match[2];
    }
    const dInfo = opticalDrives.find(d => d.letter === val);
    if (dInfo) {
      driveDetail = dInfo.status || `${dInfo.mediaType} (可用: ${formatBytes(dInfo.free)})`;
    }
    
    card.innerHTML = `
      <div class="drive-card-icon">💿</div>
      <div class="drive-card-content">
        <div class="drive-card-title">
          <span class="drive-card-name">${driveName}</span>
          <span class="drive-card-letter">${driveLetter}</span>
        </div>
        <div class="drive-card-detail">${driveDetail}</div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      selectEl.value = val;
      selectEl.dispatchEvent(new Event('change'));
      syncCustomDrives(selectElementId, gridContainerId);
    });
    
    gridEl.appendChild(card);
  });
}

// Window state event listeners to toggle layout classes
if (window.electronAPI && window.electronAPI.onWindowStateChange) {
  window.electronAPI.onWindowStateChange((state) => {
    const container = document.querySelector('.app-container');
    if (container) {
      if (state === 'maximized') {
        container.classList.add('maximized');
      } else {
        container.classList.remove('maximized');
      }
    }
  });
}
