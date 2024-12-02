// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Log a message when the extension is successfully installed
  console.log("Excel to Form Auto-Fill extension installed.");

  // Initialize storage with default values for the extension's state
  chrome.storage.local.set({
    excelData: null, // No data initially loaded from Excel
    currentIndex: 0, // Start with index 0 for processing data
    settings: {
      autoAdvance: true, // Enable automatic advancing to the next field after filling
      fillDelay: 500, // Delay (in milliseconds) before filling the next field
      retryAttempts: 3, // Set the number of retry attempts if something fails
    },
  });
});

// Listener for incoming messages from other parts of the extension (e.g., content scripts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check if the message is requesting the status of the content script
  if (request.action === "checkContentScript") {
    // Respond with a 'ready' status to indicate that the content script is loaded and active
    sendResponse({ status: "ready" });
  }

  // Return 'true' to indicate that the response will be sent asynchronously
  return true;
});
