let overlayContainer = null;
let originalVideo = null;
let overlayPlayer = null;
let resizeObserver = null;
let checkInterval = null;

// Immediately inject a style to hide the video player
const style = document.createElement('style');
style.textContent = `
  #movie_player video {
    display: none !important;
  }
  .html5-video-player .video-stream {
    display: none !important;
  }
`;
document.head.appendChild(style);

// Function to intercept play attempts
function interceptPlayAttempts() {
  const videoElement = document.querySelector('video');
  if (videoElement) {
    videoElement.pause();
    videoElement.currentTime = 0;
    videoElement.preload = 'none';
    videoElement.autoplay = false;
    videoElement.setAttribute('data-intercepted', 'true');
    
    // Prevent future play attempts
    videoElement.addEventListener('play', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.pause();
    }, true);
  }
}

// Run interception immediately and periodically
interceptPlayAttempts();
setInterval(interceptPlayAttempts, 100);

function createOverlay() {
  const videoPlayer = document.querySelector('#movie_player');
  if (videoPlayer && !overlayContainer) {
    originalVideo = videoPlayer.querySelector('video');
    
    const videoId = getVideoId();
    
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
    overlayPlayer.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${window.location.origin}&widgetid=1`;
    overlayPlayer.allow = "autoplay; fullscreen";
    overlayContainer.appendChild(overlayPlayer);

    updateOverlaySize();

    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    resizeObserver = new ResizeObserver(updateOverlaySize);
    resizeObserver.observe(videoPlayer);

    startVideoEndCheck();
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
  const nextVideoElement = findTopRecommendedVideo();
  if (nextVideoElement && nextVideoElement.href) {
    window.location.href = nextVideoElement.href;
  } else {
    removeOverlay();
  }
}

function findTopRecommendedVideo() {
  // Look for the first recommended video in the sidebar
  const recommendedVideos = document.querySelectorAll('ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer');
  if (recommendedVideos.length > 0) {
    return recommendedVideos[0].querySelector('a#thumbnail');
  }
  
  // Fallback to the "Up Next" video if available
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
  }
}

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
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

// Run createOverlay immediately when the script loads
if (location.href.includes('youtube.com/watch')) {
  waitForVideoPlayer().then(createOverlay);
}