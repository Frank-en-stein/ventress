document.addEventListener('DOMContentLoaded', function() {
  const enableSwitch = document.getElementById('enableSwitch');
  const autoplaySwitch = document.getElementById('autoplaySwitch');

  // Load the current state
  chrome.storage.sync.get(['isEnabled', 'autoplay'], function(data) {
    enableSwitch.checked = data.isEnabled !== false; // Default to true if not set
    autoplaySwitch.checked = data.autoplay !== false; // Default to true if not set
  });

  enableSwitch.addEventListener('change', function() {
    const isEnabled = this.checked;
    chrome.storage.sync.set({isEnabled: isEnabled}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "setState", isEnabled: isEnabled}, function(response) {
          if (response && response.success && isEnabled) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
    });
  });

  autoplaySwitch.addEventListener('change', function() {
    const autoplay = this.checked;
    chrome.storage.sync.set({autoplay: autoplay}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "setAutoplay", autoplay: autoplay});
      });
    });
  });
});