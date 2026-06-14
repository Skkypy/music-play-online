let savedPlaylists = [];
let currentPlaylist = null;

document.addEventListener('DOMContentLoaded', () => {
  loadPlaylists();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', showPlaylistView);
}

function loadPlaylists() {
  chrome.runtime.sendMessage({ action: 'getSavedPlaylists' }, (playlists) => {
    savedPlaylists = playlists || [];
    renderPlaylistList();
  });
}

function renderPlaylistList() {
  const body = document.getElementById('playlistListBody');
  if (savedPlaylists.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="icon"><i class="fa fa-bookmark-o"></i></div>
        <p>暂无保存的歌单<br><small style="color:#aaa">在页面浮动播放条中保存当前播放列表</small></p>
      </div>`;
    return;
  }
  body.innerHTML = savedPlaylists.map(pl => `
    <div class="playlist-item" data-id="${pl.id}">
      <div class="playlist-icon"><i class="fa fa-list"></i></div>
      <div class="playlist-info">
        <div class="playlist-name">${escapeHtml(pl.name)}</div>
        <div class="playlist-meta">${pl.songs.length} 首歌曲 · ${formatDate(pl.createdAt)}</div>
      </div>
      <button class="playlist-load-btn" data-id="${pl.id}" title="加载到播放列表"><i class="fa fa-play-circle"></i></button>
      <button class="playlist-del" data-id="${pl.id}" title="删除歌单"><i class="fa fa-trash-o"></i></button>
    </div>
  `).join('');

  body.querySelectorAll('.playlist-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.playlist-del')) return;
      if (e.target.closest('.playlist-load-btn')) return;
      const id = item.dataset.id;
      const pl = savedPlaylists.find(p => p.id === id);
      if (pl) showSongView(pl);
    });
  });

  body.querySelectorAll('.playlist-load-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const pl = savedPlaylists.find(p => p.id === id);
      if (pl) loadPlaylistToPlayer(pl);
    });
  });

  body.querySelectorAll('.playlist-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('确定删除此歌单？')) {
        chrome.runtime.sendMessage({ action: 'deletePlaylist', playlistId: id }, () => {
          loadPlaylists();
        });
      }
    });
  });
}

function showSongView(playlist) {
  currentPlaylist = playlist;
  document.getElementById('playlistListView').classList.add('hidden');
  document.getElementById('songListView').classList.remove('hidden');
  document.getElementById('backBtn').disabled = false;
  document.getElementById('songListTitle').textContent = '  ' + playlist.name + '（' + playlist.songs.length + '首）';

  const body = document.getElementById('songListBody');
  if (playlist.songs.length === 0) {
    body.innerHTML = '<div class="empty-state"><p>歌单为空</p></div>';
    return;
  }
  body.innerHTML = playlist.songs.map((song, index) => `
    <div class="song-item" data-index="${index}">
      <img class="song-cover" src="${song.cover || ''}" alt="">
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-author">${escapeHtml(song.author || '未知')}</div>
      </div>
      <i class="fa fa-play-circle-o song-play-icon"></i>
    </div>
  `).join('');

  body.querySelectorAll('.song-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      playSongFromPlaylist(playlist, index);
    });
  });
}

function showPlaylistView() {
  document.getElementById('songListView').classList.add('hidden');
  document.getElementById('playlistListView').classList.remove('hidden');
  document.getElementById('backBtn').disabled = true;
  currentPlaylist = null;
}

function loadPlaylistToPlayer(playlist) {
  chrome.runtime.sendMessage({
    action: 'loadPlaylist',
    songs: playlist.songs,
    playIndex: 0
  }, (response) => {
    if (!response?.success) {
      alert('无法加载：未找到活动页面，请先打开歌曲宝网页');
    }
  });
}

function playSongFromPlaylist(playlist, index) {
  chrome.runtime.sendMessage({
    action: 'loadPlaylist',
    songs: playlist.songs,
    playIndex: index
  }, (response) => {
    if (!response?.success) {
      alert('无法播放：未找到活动页面，请先打开歌曲宝网页');
    }
  });
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
