const PLAYLIST_KEY = 'music_playlist';
const PLAY_MODE_KEY = 'play_mode';
const CURRENT_INDEX_KEY = 'current_index';

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

    case 'getAudioUrl':
      fetchAudioUrlFromGequbao(request.musicId).then(url => {
        sendResponse(url);
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

async function fetchAudioUrlFromGequbao(musicId) {
  console.log('Background: Fetching audio URL for', musicId);
  try {
    const response = await fetch(`https://www.gequbao.com/music/${musicId}`);
    const html = await response.text();
    console.log('Background: Got HTML length', html.length);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const downloadBtn = doc.querySelector('#btn-download-mp3');
    console.log('Background: downloadBtn found:', downloadBtn ? 'yes' : 'no');
    console.log('Background: downloadBtn href:', downloadBtn?.href);

    if (downloadBtn && downloadBtn.href && downloadBtn.href !== window.location.href) {
      return downloadBtn.href;
    }

    const audioEl = doc.querySelector('audio');
    console.log('Background: audioEl found:', audioEl ? 'yes' : 'no');
    console.log('Background: audioEl src:', audioEl?.src);

    if (audioEl && audioEl.src) {
      return audioEl.src;
    }

    const pageAudio = doc.querySelector('#custom-audio-player');
    console.log('Background: pageAudio found:', pageAudio ? 'yes' : 'no');
    console.log('Background: pageAudio src:', pageAudio?.src);
    if (pageAudio && pageAudio.src) {
      return pageAudio.src;
    }
  } catch (error) {
    console.error('Background fetch error:', error);
  }
  return null;
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