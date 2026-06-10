(function() {
  const PLAYLIST_KEY = 'music_playlist';
  const PLAY_MODE_KEY = 'play_mode';
  const CURRENT_INDEX_KEY = 'current_index';

  const PlayMode = {
    SEQUENCE: 'sequence',
    SHUFFLE: 'shuffle',
    SINGLE: 'single'
  };

  let playlist = [];
  let currentIndex = 0;
  let playMode = PlayMode.SEQUENCE;
  let audio = null;
  let isPlaying = false;
  let currentMusic = null;
  let shuffledIndices = [];
  let isFetchingAudioUrl = false;

  function init() {
    loadState();
    injectStyles();
    injectPlayerUI();
    setupMessageListener();
    updateUI();
  }

  function loadState() {
    chrome.storage.local.get([PLAYLIST_KEY, PLAY_MODE_KEY, CURRENT_INDEX_KEY], (result) => {
      playlist = result[PLAYLIST_KEY] || [];
      if (result[PLAY_MODE_KEY]) {
        playMode = result[PLAY_MODE_KEY];
      }
      if (result[CURRENT_INDEX_KEY] !== undefined) {
        currentIndex = result[CURRENT_INDEX_KEY];
      }
      updateUI();
      updateModeButtons();
    });
  }

  function injectStyles() {
    if (document.querySelector('#mpo-styles')) return;
    const style = document.createElement('style');
    style.id = 'mpo-styles';
    style.textContent = `
      .mpo-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 12px;
        border: none;
        border-radius: 20px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        margin: 2px;
      }
      .mpo-btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      .mpo-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      .mpo-btn-secondary {
        background: #f0f0f0;
        color: #333;
      }
      .mpo-btn-secondary:hover {
        background: #e0e0e0;
      }
      .mpo-floating-bar {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        padding: 12px 16px;
        min-width: 320px;
        max-width: 400px;
      }
      .mpo-mini-player {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mpo-cover {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
        background: #f0f0f0;
      }
      .mpo-info {
        flex: 1;
        min-width: 0;
      }
      .mpo-title {
        font-weight: 600;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mpo-author {
        font-size: 12px;
        color: #888;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mpo-controls {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .mpo-control-btn {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 0.2s;
      }
      .mpo-control-btn:hover {
        background: rgba(102, 126, 234, 0.1);
      }
      .mpo-control-btn.play-btn {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 16px;
      }
      .mpo-control-btn.play-btn:hover {
        transform: scale(1.05);
      }
      .mpo-progress {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mpo-time {
        font-size: 11px;
        color: #888;
        min-width: 40px;
        font-family: monospace;
      }
      .mpo-progress-bar {
        flex: 1;
        height: 4px;
        background: #e0e0e0;
        border-radius: 2px;
        cursor: pointer;
        position: relative;
      }
      .mpo-progress-fill {
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 2px;
        width: 0%;
        transition: width 0.1s;
      }
      .mpo-playlist-panel {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 10px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        width: 300px;
        max-height: 400px;
        overflow: hidden;
        display: none;
        flex-direction: column;
      }
      .mpo-playlist-panel.show {
        display: flex;
      }
      .mpo-playlist-header {
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
      }
      .mpo-playlist-body {
        flex: 1;
        overflow-y: auto;
        max-height: 300px;
      }
      .mpo-playlist-item {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        gap: 10px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .mpo-playlist-item:hover {
        background: #f5f5f5;
      }
      .mpo-playlist-item.active {
        background: linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%);
      }
      .mpo-playlist-item-cover {
        width: 36px;
        height: 36px;
        border-radius: 4px;
        object-fit: cover;
        background: #eee;
        flex-shrink: 0;
      }
      .mpo-playlist-item-info {
        flex: 1;
        min-width: 0;
      }
      .mpo-playlist-item-title {
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mpo-playlist-item-author {
        font-size: 11px;
        color: #888;
      }
      .mpo-playlist-item-remove {
        opacity: 0;
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        padding: 4px;
        font-size: 14px;
        transition: all 0.2s;
      }
      .mpo-playlist-item:hover .mpo-playlist-item-remove {
        opacity: 1;
      }
      .mpo-playlist-item-remove:hover {
        color: #f5576c;
      }
      .mpo-empty {
        text-align: center;
        padding: 30px;
        color: #888;
      }
      .mpo-mode-btn {
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 10px;
        background: #f0f0f0;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
        color: #666;
      }
      .mpo-mode-btn.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      .mpo-add-btn {
        padding: 2px 6px !important;
        font-size: 11px !important;
        margin-left: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  function injectPlayerUI() {
    const existingBar = document.querySelector('.mpo-floating-bar');
    if (existingBar) return;

    const bar = document.createElement('div');
    bar.className = 'mpo-floating-bar';
    bar.innerHTML = `
      <div class="mpo-mini-player">
        <img class="mpo-cover" src="" alt="cover">
        <div class="mpo-info">
          <div class="mpo-title">未播放</div>
          <div class="mpo-author">-</div>
        </div>
        <div class="mpo-controls">
          <button class="mpo-control-btn prev-btn" title="上一首"><i class="fa fa-step-backward"></i></button>
          <button class="mpo-control-btn play-btn" title="播放/暂停"><i class="fa fa-play"></i></button>
          <button class="mpo-control-btn next-btn" title="下一首"><i class="fa fa-step-forward"></i></button>
          <button class="mpo-control-btn playlist-btn" title="播放列表"><i class="fa fa-list"></i></button>
        </div>
      </div>
      <div class="mpo-progress">
        <span class="mpo-time current">00:00</span>
        <div class="mpo-progress-bar">
          <div class="mpo-progress-fill"></div>
        </div>
        <span class="mpo-time total">00:00</span>
      </div>
      <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
        <button class="mpo-mode-btn active" data-mode="sequence">顺序</button>
        <button class="mpo-mode-btn" data-mode="shuffle">随机</button>
        <button class="mpo-mode-btn" data-mode="single">单曲</button>
      </div>
      <div class="mpo-playlist-panel">
        <div class="mpo-playlist-header">
          <span>播放列表 (<span class="mpo-count">0</span>)</span>
          <button class="mpo-btn mpo-btn-secondary mpo-clear-btn" style="margin:0; padding: 4px 10px; font-size: 12px;">清空</button>
        </div>
        <div class="mpo-playlist-body"></div>
      </div>
    `;

    document.body.appendChild(bar);

    audio = new Audio();
    audio.volume = 0.8;

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', () => {
      const totalEl = document.querySelector('.mpo-time.total');
      if (totalEl) totalEl.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('play', () => { isPlaying = true; updatePlayButton(); });
    audio.addEventListener('pause', () => { isPlaying = false; updatePlayButton(); });

    bar.querySelector('.play-btn').addEventListener('click', togglePlay);
    bar.querySelector('.prev-btn').addEventListener('click', playPrev);
    bar.querySelector('.next-btn').addEventListener('click', playNext);
    bar.querySelector('.playlist-btn').addEventListener('click', togglePlaylist);
    bar.querySelector('.mpo-progress-bar').addEventListener('click', seek);
    bar.querySelector('.mpo-clear-btn').addEventListener('click', clearPlaylist);

    document.querySelectorAll('.mpo-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setPlayMode(btn.dataset.mode));
    });

    setupPlaylistItemListeners();
  }

  function setupPlaylistItemListeners() {
    const body = document.querySelector('.mpo-playlist-body');
    if (!body) return;

    body.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.mpo-playlist-item-remove');
      if (removeBtn) {
        e.stopPropagation();
        const index = parseInt(removeBtn.dataset.index);
        removeFromPlaylist(index);
        return;
      }

      const item = e.target.closest('.mpo-playlist-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        playByIndex(index);
      }
    });
  }

  function togglePlay() {
    if (playlist.length === 0) return;

    if (!currentMusic || audio.src === '') {
      if (playlist.length > 0) {
        playByIndex(currentIndex);
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(e => console.log('Play failed:', e));
    }
  }

  function playPrev() {
    if (playlist.length === 0) return;
    let prevIndex;

    if (playMode === PlayMode.SHUFFLE) {
      if (shuffledIndices.length === 0) generateShuffledIndices();
      const currentShuffleIdx = shuffledIndices.indexOf(currentIndex);
      prevIndex = shuffledIndices[(currentShuffleIdx - 1 + shuffledIndices.length) % shuffledIndices.length];
    } else {
      prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    }
    playByIndex(prevIndex);
  }

  function playNext() {
    if (playlist.length === 0) return;

    if (isFetchingAudioUrl) {
      console.log('MPO: Still fetching audio URL, skip this playNext');
      return;
    }

    if (playMode === PlayMode.SINGLE) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log('Play failed:', e));
      return;
    }

    let nextIndex;
    if (playMode === PlayMode.SHUFFLE) {
      if (shuffledIndices.length === 0) generateShuffledIndices();
      const currentShuffleIdx = shuffledIndices.indexOf(currentIndex);
      nextIndex = shuffledIndices[(currentShuffleIdx + 1) % shuffledIndices.length];
    } else {
      nextIndex = (currentIndex + 1) % playlist.length;
    }
    playByIndex(nextIndex);
  }

  function playByIndex(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    currentMusic = playlist[index];

    updateCurrentDisplay();

    const pageAudioUrl = getAudioUrlFromPage();
    if (pageAudioUrl) {
      console.log('MPO: Using page audio URL:', pageAudioUrl);
      currentMusic.audioUrl = pageAudioUrl;
      audio.src = pageAudioUrl;
      audio.play().catch(e => console.error('MPO: Play failed:', e));
      saveState();
      updatePlaylistUI();
      return;
    }

    if (currentMusic.audioUrl) {
      audio.src = currentMusic.audioUrl;
      audio.play().catch(e => console.error('MPO: Play failed:', e));
      saveState();
      updatePlaylistUI();
      return;
    }

    const isTopicPage = window.location.pathname.startsWith('/topic/');
    if (isTopicPage) {
      console.log('MPO: Opening music page to get audio URL...');
      isFetchingAudioUrl = true;
      const musicPageUrl = `https://www.gequbao.com/music/${currentMusic.id}`;
      const newTab = window.open(musicPageUrl, '_blank');

      if (newTab) {
        const checkInterval = setInterval(() => {
          newTab.postMessage({ action: 'getAudioUrl' }, '*');
        }, 1000);

        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          clearTimeout(checkInterval);
          isFetchingAudioUrl = false;
        }, 10000);

        window.addEventListener('message', (e) => {
          if (e.data && e.data.audioUrl) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            isFetchingAudioUrl = false;
            console.log('MPO: Got audio URL from new tab:', e.data.audioUrl);
            currentMusic.audioUrl = e.data.audioUrl;
            audio.src = e.data.audioUrl;
            audio.play().catch(err => console.error('MPO: Play failed:', err));
            saveState();
            updatePlaylistUI();
            newTab.close();
          }
        }, { once: true });
      } else {
        isFetchingAudioUrl = false;
      }
      return;
    }

    console.log('MPO: Requesting audio URL from background for', currentMusic.id);
    chrome.runtime.sendMessage({
      action: 'getAudioUrl',
      musicId: currentMusic.id
    }, (url) => {
      console.log('MPO: Got audio URL from background:', url);
      if (url) {
        currentMusic.audioUrl = url;
        audio.src = url;
        audio.play().catch(e => console.error('MPO: Play failed:', e));
        saveState();
        updatePlaylistUI();
      } else {
        console.log('MPO: Could not get audio URL');
        alert('无法获取音频链接，请先打开该歌曲页面加载播放器');
      }
    });
  }

  function getAudioUrlFromPage() {
    const isMusicPage = window.location.pathname.startsWith('/music/');

    if (isMusicPage) {
      const pageAudio = document.querySelector('#custom-audio-player');
      if (pageAudio && pageAudio.src && pageAudio.src !== window.location.href) {
        console.log('MPO: Found audio on page:', pageAudio.src);
        return pageAudio.src;
      }

      const downloadBtn = document.querySelector('#btn-download-mp3');
      if (downloadBtn && downloadBtn.href && downloadBtn.href !== window.location.href) {
        console.log('MPO: Found download URL on page:', downloadBtn.href);
        return downloadBtn.href;
      }
    }
    return null;
  }

  function handleEnded() {
    if (isFetchingAudioUrl) {
      console.log('MPO: Still fetching audio URL, waiting...');
      return;
    }

    if (playMode === PlayMode.SINGLE) {
      audio.currentTime = 0;
      audio.play();
    } else {
      playNext();
    }
  }

  function updateProgress() {
    const current = audio.currentTime;
    const total = audio.duration || 0;
    const percent = total > 0 ? (current / total) * 100 : 0;
    const fill = document.querySelector('.mpo-progress-fill');
    const currentTimeEl = document.querySelector('.mpo-time.current');
    if (fill) fill.style.width = percent + '%';
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
  }

  function seek(e) {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    if (audio.duration) {
      audio.currentTime = percent * audio.duration;
    }
  }

  function togglePlaylist() {
    const panel = document.querySelector('.mpo-playlist-panel');
    if (panel) panel.classList.toggle('show');
  }

  function setPlayMode(mode) {
    playMode = mode;
    if (mode === PlayMode.SHUFFLE) {
      generateShuffledIndices();
    }
    updateModeButtons();
    chrome.storage.local.set({ [PLAY_MODE_KEY]: mode });
  }

  function generateShuffledIndices() {
    shuffledIndices = playlist.map((_, i) => i);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }
  }

  function updatePlayButton() {
    const btn = document.querySelector('.play-btn');
    if (btn) {
      const icon = btn.querySelector('i') || btn;
      icon.className = isPlaying ? 'fa fa-pause' : 'fa fa-play';
    }
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function updateCurrentDisplay() {
    const cover = document.querySelector('.mpo-cover');
    const title = document.querySelector('.mpo-title');
    const author = document.querySelector('.mpo-author');

    if (currentMusic) {
      if (cover) cover.src = currentMusic.cover || '';
      if (title) title.textContent = currentMusic.title || '未知歌曲';
      if (author) author.textContent = currentMusic.author || '未知艺术家';
    } else {
      if (cover) cover.src = '';
      if (title) title.textContent = '未播放';
      if (author) author.textContent = '-';
    }
  }

  function updatePlaylistUI() {
    const body = document.querySelector('.mpo-playlist-body');
    const count = document.querySelector('.mpo-count');

    if (!body) return;

    count.textContent = playlist.length;

    if (playlist.length === 0) {
      body.innerHTML = '<div class="mpo-empty">播放列表为空<br><small style="color:#aaa">点击歌曲旁的 + 添加</small></div>';
      return;
    }

    body.innerHTML = playlist.map((music, index) => `
      <div class="mpo-playlist-item ${index === currentIndex ? 'active' : ''}" data-index="${index}">
        <img class="mpo-playlist-item-cover" src="${music.cover || ''}" alt="">
        <div class="mpo-playlist-item-info">
          <div class="mpo-playlist-item-title">${music.title}</div>
          <div class="mpo-playlist-item-author">${music.author}</div>
        </div>
        <button class="mpo-playlist-item-remove" data-index="${index}" title="移除">✕</button>
      </div>
    `).join('');
  }

  function updateModeButtons() {
    document.querySelectorAll('.mpo-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === playMode);
    });
  }

  function updateUI() {
    if (playlist.length === 0) {
      currentMusic = null;
    } else if (currentIndex < playlist.length) {
      currentMusic = playlist[currentIndex];
    }
    updateCurrentDisplay();
    updatePlaylistUI();
  }

  function saveState() {
    console.log('MPO: saving state, playlist length:', playlist.length);
    chrome.storage.local.set({
      [PLAYLIST_KEY]: playlist,
      [CURRENT_INDEX_KEY]: currentIndex
    }, () => {
      console.log('MPO: state saved, checking storage...');
      chrome.storage.local.get(PLAYLIST_KEY, (result) => {
        console.log('MPO: storage contains', result[PLAYLIST_KEY]?.length, 'items');
      });
    });
  }

  function removeFromPlaylist(index) {
    if (index < 0 || index >= playlist.length) return;
    playlist.splice(index, 1);
    if (currentIndex >= playlist.length) {
      currentIndex = Math.max(0, playlist.length - 1);
    }
    if (playlist.length === 0) {
      currentMusic = null;
      audio.src = '';
    }
    if (playMode === PlayMode.SHUFFLE) {
      generateShuffledIndices();
    }
    saveState();
    updateUI();
  }

  function clearPlaylist() {
    playlist = [];
    currentIndex = 0;
    currentMusic = null;
    shuffledIndices = [];
    audio.src = '';
    saveState();
    updateUI();
  }

  function addToPlaylist(music) {
    if (!music || !music.id) {
      console.log('MPO: music or music.id is invalid', music);
      return false;
    }
    const exists = playlist.find(m => m.id === music.id);
    if (exists) {
      console.log('MPO: music already exists', music.id);
      return false;
    }
    playlist.push(music);
    console.log('MPO: added to playlist', music.title, 'total:', playlist.length);
    saveState();
    updateUI();
    return true;
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'getState':
          loadState();
          sendResponse({ playlist, currentIndex, playMode });
          break;
        case 'addMusic':
          const added = addToPlaylist(request.music);
          sendResponse({ success: added, playlist });
          break;
        case 'removeMusic':
          removeFromPlaylist(request.index);
          sendResponse({ success: true });
          break;
        case 'clearPlaylist':
          clearPlaylist();
          sendResponse({ success: true });
          break;
        case 'setCurrentIndex':
          currentIndex = request.index;
          if (playlist.length > 0 && currentIndex < playlist.length) {
            currentMusic = playlist[currentIndex];
          }
          saveState();
          updateUI();
          sendResponse({ success: true });
          break;
        case 'playMusic':
          playMusicFromMessage(request.music);
          sendResponse({ success: true });
          break;
      }
      return true;
    });
  }

  function playMusicFromMessage(music) {
    if (!music || !music.id) return;
    const existingIndex = playlist.findIndex(m => m.id === music.id);
    if (existingIndex !== -1) {
      playByIndex(existingIndex);
    } else {
      addToPlaylist(music);
      playByIndex(playlist.length - 1);
    }
  }

  function injectAddAllButton() {
    if (document.querySelector('.mpo-add-all-btn')) return;

    const headers = document.querySelectorAll('.card-body .row');
    let headerOpCol = null;

    for (const row of headers) {
      if (row.textContent.includes('歌曲') && row.textContent.includes('操作')) {
        const cols = row.querySelectorAll('[class*="col-"]');
        for (const col of cols) {
          if (col.classList.contains('text-right') || col.textContent.trim() === '操作') {
            headerOpCol = col;
            break;
          }
        }
        break;
      }
    }

    if (!headerOpCol) {
      console.log('MPO: Could not find header operation column');
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'mpo-btn mpo-btn-primary mpo-add-all-btn';
    btn.textContent = '＋ 一键添加本页';
    btn.title = '一键添加本页所有歌曲到播放列表';
    btn.style.marginRight = '8px';
    btn.style.padding = '4px 10px';
    btn.style.fontSize = '12px';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '添加中...';

      const songRows = document.querySelectorAll('.card-body .row.no-gutters');
      let addedCount = 0;

      for (const row of songRows) {
        const link = row.querySelector('a[href*="/music/"]');
        if (!link) continue;

        const match = link.href.match(/gequbao\.com\/music\/(\d+)/);
        if (!match) continue;

        const musicId = match[1];
        const music = await fetchMusicInfo(musicId);
        if (music && addToPlaylist(music)) {
          addedCount++;
        }
      }

      btn.textContent = `已添加 ${addedCount} 首`;
      setTimeout(() => {
        btn.textContent = '＋ 一键添加本页';
        btn.disabled = false;
      }, 2000);
    });

    headerOpCol.insertBefore(btn, headerOpCol.firstChild);
    console.log('MPO: Added "Add All" button to header');
  }

  function injectAddButton() {
    if (document.querySelector('.mpo-add-current-btn')) return;

    const isTopicPage = window.location.pathname.startsWith('/topic/');
    const isMusicPage = window.location.pathname.startsWith('/music/');

    if (!isTopicPage && !isMusicPage) return;

    if (isTopicPage && !document.querySelector('.mpo-add-all-btn')) {
      injectAddAllButton();
    }

    if (isMusicPage) {
      const titleEl = document.querySelector('.song-title-styled');
      const authorEl = document.querySelector('.song-author-styled');
      const coverEl = document.querySelector('.player-cover-img');

      if (titleEl && authorEl) {
        const music = {
          id: window.location.pathname.split('/').pop(),
          title: titleEl.textContent.trim(),
          author: authorEl.textContent.trim(),
          cover: coverEl ? coverEl.src : '',
          source: 'gequbao',
          sourceUrl: window.location.href
        };

        const btn = document.createElement('button');
        btn.className = 'mpo-btn mpo-btn-primary mpo-add-current-btn';
        btn.textContent = '＋ 添加到播放列表';
        btn.style.marginLeft = '10px';
        btn.addEventListener('click', () => {
          const added = addToPlaylist(music);
          btn.textContent = added ? '已添加 ✓' : '已在列表中';
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = '＋ 添加到播放列表';
            btn.disabled = false;
          }, 2000);
        });

        const playBtn = document.querySelector('#btn-main-play');
        if (playBtn && playBtn.parentNode && !playBtn.nextElementSibling?.classList.contains('mpo-add-current-btn')) {
          playBtn.parentNode.insertBefore(btn, playBtn.nextSibling);
        }
      }
    }

    if (isTopicPage) {
      injectAddAllButton();

      const containers = document.querySelectorAll('.col-4.col-md-3.text-right');
      containers.forEach((container) => {
        if (container.querySelector('.mpo-add-btn')) return;

        const link = container.querySelector('a');
        if (!link) return;

        const match = link.href.match(/gequbao\.com\/music\/(\d+)/);
        if (!match) return;

        const musicId = match[1];
        const btn = document.createElement('button');
        btn.className = 'mpo-btn mpo-btn-primary mpo-add-btn';
        btn.textContent = '＋';
        btn.title = '添加到播放列表';
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('MPO: clicking add button for musicId', musicId);
          const music = await fetchMusicInfo(musicId);
          console.log('MPO: fetched music info', music);
          if (music) {
            const added = addToPlaylist(music);
            console.log('MPO: add result', added);
            btn.textContent = added ? '✓' : '✓';
            btn.disabled = true;
            setTimeout(() => {
              btn.textContent = '＋';
              btn.disabled = false;
            }, 1500);
          } else {
            btn.textContent = '失败';
            setTimeout(() => {
              btn.textContent = '＋';
            }, 1500);
          }
        });
        container.appendChild(btn);
      });
    }
  }

  async function fetchMusicInfo(musicId) {
    try {
      const response = await fetch(`https://www.gequbao.com/music/${musicId}`);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const titleEl = doc.querySelector('.song-title-styled');
      const authorEl = doc.querySelector('.song-author-styled');
      const coverEl = doc.querySelector('.player-cover-img');
      const downloadBtn = doc.querySelector('#btn-download-mp3');

      return {
        id: musicId,
        title: titleEl ? titleEl.textContent.trim() : 'Unknown',
        author: authorEl ? authorEl.textContent.trim() : 'Unknown',
        cover: coverEl ? coverEl.src : '',
        audioUrl: downloadBtn ? downloadBtn.href : '',
        source: 'gequbao',
        sourceUrl: `https://www.gequbao.com/music/${musicId}`
      };
    } catch (error) {
      console.error('Failed to fetch music info:', error);
      return null;
    }
  }

  function startObserver() {
    setTimeout(() => {
      init();
      injectAddButton();
    }, 500);

    const observer = new MutationObserver(() => {
      setTimeout(injectAddButton, 500);
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[PLAYLIST_KEY]) {
      console.log('MPO: storage changed, old:', changes[PLAYLIST_KEY].oldValue?.length, 'new:', changes[PLAYLIST_KEY].newValue?.length);
      playlist = changes[PLAYLIST_KEY].newValue || [];
      if (currentIndex >= playlist.length) {
        currentIndex = Math.max(0, playlist.length - 1);
      }
      updateUI();
    }
  });

  window.addEventListener('message', (e) => {
    if (e.data && e.data.action === 'provideAudioUrl' && e.data.audioUrl) {
      console.log('MPO: Received audio URL from music page:', e.data.audioUrl);
      isFetchingAudioUrl = false;
      const currentMusicItem = playlist[currentIndex];
      if (currentMusicItem) {
        currentMusicItem.audioUrl = e.data.audioUrl;
        audio.src = e.data.audioUrl;
        audio.play().catch(err => console.error('MPO: Play failed:', err));
        saveState();
        updatePlaylistUI();
      }
    }

    if (e.data && e.data.action === 'getAudioUrl' && window.location.pathname.startsWith('/music/')) {
      const audioEl = document.querySelector('#custom-audio-player');
      if (audioEl && audioEl.src && audioEl.src !== window.location.href) {
        console.log('MPO: Music page sending audio URL:', audioEl.src);
        e.source.postMessage({ action: 'provideAudioUrl', audioUrl: audioEl.src }, e.origin);
      } else {
        const downloadBtn = document.querySelector('#btn-download-mp3');
        if (downloadBtn && downloadBtn.href) {
          console.log('MPO: Music page sending download URL:', downloadBtn.href);
          e.source.postMessage({ action: 'provideAudioUrl', audioUrl: downloadBtn.href }, e.origin);
        }
      }
    }
  });

  startObserver();
})();