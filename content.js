let overlayContainer = null;
let originalVideo = null;
let overlayPlayer = null;
let resizeObserver = null;
let checkInterval = null;
let isExtensionEnabled = true;
let isOverlayActive = false;
let currentVideoId = null;
let currentPlaylistId = null;
let isAutoplayEnabled = true;

// Load the extension state
chrome.storage.sync.get(['isEnabled', 'autoplay'], function(data) {
  isExtensionEnabled = data.isEnabled !== false; // Default to true if not set
  isAutoplayEnabled = data.autoplay !== false; // Default to true if not set
  if (isExtensionEnabled) {
    if (location.href.includes('youtube.com/watch')) {
      waitForVideoPlayer().then(createOverlay);
    }
  }
});

// Function to intercept play attempts
function interceptPlayAttempts() {
  if (!isExtensionEnabled || !isOverlayActive) return;

  const videoElement = document.querySelector('video');
  if (videoElement) {
    videoElement.pause();
    videoElement.currentTime = 0;
    videoElement.preload = 'none';
    videoElement.autoplay = false;
  }
}

// Run interception periodically
setInterval(interceptPlayAttempts, 100);

function createOverlay() {
  if (!isExtensionEnabled) return;

  const videoPlayer = document.querySelector('#movie_player');
  if (videoPlayer && !overlayContainer) {
    originalVideo = videoPlayer.querySelector('video');
    
    currentVideoId = getVideoId();
    currentPlaylistId = getPlaylistId();
    
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'custom-overlay-container';
    videoPlayer.appendChild(overlayContainer);
    
    const closeButton = document.createElement('button');
    closeButton.id = 'custom-overlay-close';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = removeOverlay;
    overlayContainer.appendChild(closeButton);
    
    overlayPlayer = document.createElement('iframe');
    overlayPlayer.id = 'custom-overlay-player';
    let src = `https://www.youtube-nocookie.com/embed/${currentVideoId}?autoplay=1&enablejsapi=1&origin=${window.location.origin}&widgetid=1`;
    if (currentPlaylistId) {
      src += `&list=${currentPlaylistId}`;
    }
    overlayPlayer.src = src;
    overlayPlayer.allow = "autoplay; fullscreen";
    overlayContainer.appendChild(overlayPlayer);

    updateOverlaySize();

    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    resizeObserver = new ResizeObserver(updateOverlaySize);
    resizeObserver.observe(videoPlayer);

    startVideoEndCheck();
    
    isOverlayActive = true;
    hideOriginalVideo(true);
  }
}

function updateOverlaySize() {
  const videoPlayer = document.querySelector('#movie_player');
  if (videoPlayer && overlayContainer) {
    overlayContainer.style.position = 'absolute';
    overlayContainer.style.top = '0';
    overlayContainer.style.left = '0';
    overlayContainer.style.width = '100%';
    overlayContainer.style.height = '100%';
  }
}

function startVideoEndCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  checkInterval = setInterval(checkVideoEnd, 1000);
}

function checkVideoEnd() {
  if (overlayPlayer && overlayPlayer.contentWindow) {
    overlayPlayer.contentWindow.postMessage('{"event":"listening"}', '*');
    overlayPlayer.contentWindow.postMessage('{"event":"command","func":"getCurrentTime","args":""}', '*');
    overlayPlayer.contentWindow.postMessage('{"event":"command","func":"getDuration","args":""}', '*');
  }
}

window.addEventListener('message', function(event) {
  if (event.origin === "https://www.youtube-nocookie.com") {
    try {
      const data = JSON.parse(event.data);
      if (data.event === "infoDelivery" && data.info) {
        if (data.info.currentTime !== undefined && data.info.duration !== undefined) {
          const currentTime = data.info.currentTime;
          const duration = data.info.duration;
          if (duration - currentTime <= 1 || currentTime >= duration) {
            playNextVideo();
          }
        }
      }
    } catch (e) {
      // Silently handle parsing errors
    }
  }
});

function playNextVideo() {
  if (!isAutoplayEnabled) {
    removeOverlay();
    return;
  }

  if (currentPlaylistId) {
    const nextVideoElement = findNextPlaylistVideo();
    if (nextVideoElement) {
      const nextVideoUrl = nextVideoElement.href;
      if (nextVideoUrl) {
        window.location.href = nextVideoUrl;
        return;
      }
    }
  }
  
  // If we're here, either there's no playlist, or the playlist has ended
  const nextVideoElement = findTopRecommendedVideo();
  if (nextVideoElement && nextVideoElement.href) {
    window.location.href = nextVideoElement.href;
  } else {
    removeOverlay();
  }
}

function findNextPlaylistVideo() {
  const playlistItems = document.querySelectorAll('ytd-playlist-panel-video-renderer');
  let currentFound = false;
  for (let item of playlistItems) {
    const videoIdElement = item.querySelector('#wc-endpoint');
    if (videoIdElement) {
      const videoId = new URLSearchParams(videoIdElement.href.split('?')[1]).get('v');
      if (currentFound) {
        return videoIdElement;
      }
      if (videoId === currentVideoId) {
        currentFound = true;
      }
    }
  }
  return null;
}

function findTopRecommendedVideo() {
  const recommendedVideos = document.querySelectorAll('ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer');
  if (recommendedVideos.length > 0) {
    return recommendedVideos[0].querySelector('a#thumbnail');
  }
  
  const upNext = document.querySelector('.ytp-upnext-url');
  if (upNext) {
    return upNext;
  }

  return null;
}

function removeOverlay() {
  if (overlayContainer) {
    overlayContainer.remove();
    overlayContainer = null;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    isOverlayActive = false;
    hideOriginalVideo(false);
  }
}

function hideOriginalVideo(hide) {
  const style = document.getElementById('youtube-overlay-style');
  if (hide && !style) {
    const newStyle = document.createElement('style');
    newStyle.id = 'youtube-overlay-style';
    newStyle.textContent = `
      #movie_player video {
        display: none !important;
      }
      .html5-video-player .video-stream {
        display: none !important;
      }
    `;
    document.head.appendChild(newStyle);
  } else if (!hide && style) {
    style.remove();
  }
}

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

function getPlaylistId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('list');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    removeOverlay();
  }
});

let lastUrl = location.href; 
const observer = new MutationObserver(() => {
  requestIdleCallback(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      removeOverlay();
      if (url.includes('youtube.com/watch')) {
        waitForVideoPlayer().then(createOverlay);
      }
    }
  });
});
observer.observe(document, {subtree: true, childList: true});

function waitForVideoPlayer() {
  return new Promise((resolve) => {
    const checkForVideoPlayer = () => {
      const videoPlayer = document.querySelector('#movie_player');
      if (videoPlayer) {
        resolve();
      } else {
        requestAnimationFrame(checkForVideoPlayer);
      }
    };
    checkForVideoPlayer();
  });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setState") {
    isExtensionEnabled = request.isEnabled;
    if (isExtensionEnabled) {
      if (location.href.includes('youtube.com/watch')) {
        waitForVideoPlayer().then(createOverlay);
      }
    } else {
      removeOverlay();
    }
    sendResponse({ success: true });
  } else if (request.action === "setAutoplay") {
    isAutoplayEnabled = request.autoplay;
    sendResponse({ success: true });
  }
});