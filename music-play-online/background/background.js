const PLAYLIST_KEY = 'music_playlist';
const PLAY_MODE_KEY = 'play_mode';
const CURRENT_INDEX_KEY = 'current_index';
const SAVED_PLAYLISTS_KEY = 'saved_playlists';

const PlayMode = {
  SEQUENCE: 'sequence',
  SHUFFLE: 'shuffle',
  SINGLE: 'single'
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([PLAY_MODE_KEY], (result) => {
    if (!result[PLAY_MODE_KEY]) {
      chrome.storage.local.set({ [PLAY_MODE_KEY]: PlayMode.SEQUENCE });
    }
  });

  chrome.contextMenus.create({
    id: 'addToPlaylist',
    title: '添加到音乐播放列表',
    contexts: ['link']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addToPlaylist' && info.linkUrl) {
    const match = info.linkUrl.match(/gequbao\.com\/music\/(\d+)/);
    if (match) {
      const musicId = match[1];
      fetchMusicInfo(musicId).then(music => {
        if (music) {
          chrome.storage.local.get([PLAYLIST_KEY], (result) => {
            const playlist = result[PLAYLIST_KEY] || [];
            if (!playlist.find(m => m.id === music.id)) {
              playlist.push(music);
              chrome.storage.local.set({ [PLAYLIST_KEY]: playlist });
            }
          });
        }
      });
    }
  }
});

function getActiveTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      resolve(tabs[0] || null);
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getState':
      chrome.storage.local.get([PLAYLIST_KEY, PLAY_MODE_KEY, CURRENT_INDEX_KEY], (result) => {
        sendResponse({
          playlist: result[PLAYLIST_KEY] || [],
          playMode: result[PLAY_MODE_KEY] || PlayMode.SEQUENCE,
          currentIndex: result[CURRENT_INDEX_KEY] || 0
        });
      });
      return true;

    case 'getSavedPlaylists':
      chrome.storage.local.get([SAVED_PLAYLISTS_KEY], (result) => {
        sendResponse(result[SAVED_PLAYLISTS_KEY] || []);
      });
      return true;

    case 'savePlaylist':
      chrome.storage.local.get([SAVED_PLAYLISTS_KEY], (result) => {
        const playlists = result[SAVED_PLAYLISTS_KEY] || [];
        const newPlaylist = {
          id: 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          name: request.name,
          songs: request.songs,
          createdAt: Date.now()
        };
        playlists.push(newPlaylist);
        chrome.storage.local.set({ [SAVED_PLAYLISTS_KEY]: playlists }, () => {
          sendResponse({ success: true, playlist: newPlaylist });
        });
      });
      return true;

    case 'deletePlaylist':
      chrome.storage.local.get([SAVED_PLAYLISTS_KEY], (result) => {
        const playlists = result[SAVED_PLAYLISTS_KEY] || [];
        const filtered = playlists.filter(p => p.id !== request.playlistId);
        chrome.storage.local.set({ [SAVED_PLAYLISTS_KEY]: filtered }, () => {
          sendResponse({ success: true });
        });
      });
      return true;

    case 'loadPlaylist':
      getActiveTab().then(tab => {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'loadPlaylist',
            songs: request.songs,
            playIndex: request.playIndex || 0
          });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      });
      return true;

    case 'setPlayMode':
      chrome.storage.local.set({ [PLAY_MODE_KEY]: request.mode });
      sendResponse({ success: true });
      break;

    case 'playlistUpdated':
      chrome.storage.local.set({ [PLAYLIST_KEY]: request.playlist });
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true;
});

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
