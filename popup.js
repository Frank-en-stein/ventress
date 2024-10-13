document.addEventListener('DOMContentLoaded', function() {
  const enableSwitch = document.getElementById('enableSwitch');
  const statusText = document.getElementById('statusText');

  // Load the current state
  chrome.storage.sync.get('isEnabled', function(data) {
    enableSwitch.checked = data.isEnabled !== false; // Default to true if not set
    updateStatusText(enableSwitch.checked);
  });

  enableSwitch.addEventListener('change', function() {
    const isEnabled = this.checked;
    updateStatusText(isEnabled);

    // Save the new state
    chrome.storage.sync.set({isEnabled: isEnabled}, function() {
      // Send message to content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "setState", isEnabled: isEnabled}, function(response) {
          if (response && response.success) {
            // If the extension was enabled, reload the page
            if (isEnabled) {
              chrome.tabs.reload(tabs[0].id);
            }
          }
        });
      });
    });
  });

  function updateStatusText(isEnabled) {
    statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';
  }
});