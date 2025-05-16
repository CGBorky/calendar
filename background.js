chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "getAuthToken") {
    console.log("Auth request received.");

    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        console.warn("Silent Auth Failed:", chrome.runtime.lastError.message);
        chrome.identity.getAuthToken({ interactive: true }, (interactiveToken) => {
          if (chrome.runtime.lastError) {
            console.error("Interactive Auth Failed:", chrome.runtime.lastError.message);
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            console.log("Interactive Auth Success. Token:", interactiveToken);
            sendResponse({ token: interactiveToken });
          }
        });
      } else {
        console.log("Silent Auth Success. Token:", token);
        sendResponse({ token });
      }
    });

    return true; 
  }
});
