const PLAYLIST_KEY = 'music_playlist';
const PLAY_MODE_KEY = 'play_mode';
const CURRENT_INDEX_KEY = 'current_index';
const VOLUME_KEY = 'volume';

const PlayMode = {
  SEQUENCE: 'sequence',
  SHUFFLE: 'shuffle',
  SINGLE: 'single'
};

let playlist = [];
let currentIndex = 0;
let playMode = PlayMode.SEQUENCE;
let volume = 0.8;

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  setupEventListeners();
  setupStorageListener();
});

function loadState() {
  chrome.storage.local.get([PLAYLIST_KEY, PLAY_MODE_KEY, CURRENT_INDEX_KEY, VOLUME_KEY], (result) => {
    playlist = result[PLAYLIST_KEY] || [];
    if (result[PLAY_MODE_KEY]) {
      playMode = result[PLAY_MODE_KEY];
    }
    if (result[CURRENT_INDEX_KEY] !== undefined) {
      currentIndex = result[CURRENT_INDEX_KEY];
    }
    if (result[VOLUME_KEY] !== undefined) {
      volume = result[VOLUME_KEY];
    }
    updateUI();
    updateModeButtons();
  });
}

function setupEventListeners() {
  document.getElementById('playBtn').addEventListener('click', togglePlay);
  document.getElementById('prevBtn').addEventListener('click', playPrev);
  document.getElementById('nextBtn').addEventListener('click', playNext);
  document.getElementById('clearBtn').addEventListener('click', clearPlaylist);
  document.getElementById('volumeSlider').addEventListener('click', handleVolumeClick);

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setPlayMode(btn.dataset.mode));
  });

  document.getElementById('playlistBody').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.playlist-item-remove');
    if (removeBtn) {
      e.stopPropagation();
      removeFromPlaylist(parseInt(removeBtn.dataset.index));
      return;
    }

    const item = e.target.closest('.playlist-item');
    if (item) {
      playByIndex(parseInt(item.dataset.index));
    }
  });
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes[PLAYLIST_KEY]) {
        playlist = changes[PLAYLIST_KEY].newValue || [];
      }
      if (changes[CURRENT_INDEX_KEY]) {
        currentIndex = changes[CURRENT_INDEX_KEY].newValue || 0;
      }
      if (changes[PLAY_MODE_KEY]) {
        playMode = changes[PLAY_MODE_KEY].newValue || PlayMode.SEQUENCE;
        updateModeButtons();
      }
      updateUI();
    }
  });
}

function togglePlay() {
  chrome.runtime.sendMessage({
    action: 'getState'
  }, (response) => {
    if (!response || response.playlist.length === 0) return;
    const music = response.playlist[response.currentIndex];
    if (music) {
      chrome.runtime.sendMessage({
        action: 'playMusic',
        music
      });
    }
  });
}

function playPrev() {
  chrome.runtime.sendMessage({
    action: 'getState'
  }, (response) => {
    if (!response || response.playlist.length === 0) return;

    let prevIndex;
    if (response.playMode === PlayMode.SHUFFLE) {
      const shuffled = generateShuffled(response.playlist.length);
      const currentShuffleIdx = shuffled.indexOf(response.currentIndex);
      prevIndex = shuffled[(currentShuffleIdx - 1 + shuffled.length) % shuffled.length];
    } else {
      prevIndex = (response.currentIndex - 1 + response.playlist.length) % response.playlist.length;
    }

    chrome.runtime.sendMessage({
      action: 'setCurrentIndex',
      index: prevIndex
    });
  });
}

function playNext() {
  chrome.runtime.sendMessage({
    action: 'getState'
  }, (response) => {
    if (!response || response.playlist.length === 0) return;

    if (response.playMode === PlayMode.SINGLE) {
      chrome.runtime.sendMessage({ action: 'getState' });
      return;
    }

    let nextIndex;
    if (response.playMode === PlayMode.SHUFFLE) {
      const shuffled = generateShuffled(response.playlist.length);
      const currentShuffleIdx = shuffled.indexOf(response.currentIndex);
      nextIndex = shuffled[(currentShuffleIdx + 1) % shuffled.length];
    } else {
      nextIndex = (response.currentIndex + 1) % response.playlist.length;
    }

    chrome.runtime.sendMessage({
      action: 'setCurrentIndex',
      index: nextIndex
    });
  });
}

function playByIndex(index) {
  chrome.runtime.sendMessage({
    action: 'setCurrentIndex',
    index
  });
}

function removeFromPlaylist(index) {
  chrome.runtime.sendMessage({
    action: 'removeMusic',
    index
  }, () => {
    loadState();
  });
}

function clearPlaylist() {
  chrome.runtime.sendMessage({
    action: 'clearPlaylist'
  }, () => {
    loadState();
  });
}

function setPlayMode(mode) {
  chrome.storage.local.set({ [PLAY_MODE_KEY]: mode }, () => {
    playMode = mode;
    updateModeButtons();
    chrome.runtime.sendMessage({
      action: 'setPlayMode',
      mode
    });
  });
}

function generateShuffled(length) {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function handleVolumeClick(e) {
  const slider = document.getElementById('volumeSlider');
  const rect = slider.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  volume = Math.max(0, Math.min(1, percent));
  updateVolumeFill();
  chrome.storage.local.set({ [VOLUME_KEY]: volume });
}

function updateModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === playMode);
  });
}

function updateVolumeFill() {
  document.getElementById('volumeFill').style.width = (volume * 100) + '%';
}

function updateUI() {
  const currentCover = document.getElementById('currentCover');
  const currentTitle = document.getElementById('currentTitle');
  const currentAuthor = document.getElementById('currentAuthor');
  const playlistCount = document.getElementById('playlistCount');
  const playlistBody = document.getElementById('playlistBody');

  updateVolumeFill();

  if (playlist.length === 0) {
    currentCover.src = '';
    currentTitle.textContent = '未播放';
    currentAuthor.textContent = '播放列表为空';
    playlistCount.textContent = '0';
    playlistBody.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 32px;">🎶</div>
        <p>播放列表为空</p>
      </div>
    `;
    return;
  }

  playlistCount.textContent = playlist.length;

  const currentMusic = playlist[currentIndex];
  if (currentMusic) {
    currentCover.src = currentMusic.cover || '';
    currentTitle.textContent = currentMusic.title || '未知歌曲';
    currentAuthor.textContent = currentMusic.author || '未知艺术家';
  }

  playlistBody.innerHTML = playlist.map((music, index) => `
    <div class="playlist-item ${index === currentIndex ? 'active' : ''}" data-index="${index}">
      <img class="playlist-item-cover" src="${music.cover || ''}" alt="">
      <div class="playlist-item-info">
        <div class="playlist-item-title">${music.title}</div>
        <div class="playlist-item-author">${music.author}</div>
      </div>
      <button class="playlist-item-remove" data-index="${index}" title="移除">✕</button>
    </div>
  `).join('');
}