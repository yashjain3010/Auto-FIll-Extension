class ExcelFormFiller {
  // Constructor initializes the class and sets up initial state
  constructor() {
    // Get references to key HTML elements
    this.fileInput = document.getElementById("fileInput");
    this.fillFormButton = document.getElementById("fillFormButton");
    this.statusElement = document.getElementById("status");
    this.currentUserDisplay = document.getElementById("currentUser");

    // Track current record index and store for Excel data
    this.currentIndex = 0;
    this.jsonData = null;

    // Set up event listeners and attempt to load previously stored data
    this.initializeEventListeners();
    this.loadStoredData();
  }

  // Attempt to load previously stored Excel data from Chrome's local storage
  async loadStoredData() {
    try {
      // Retrieve stored Excel data and current index
      const result = await chrome.storage.local.get([
        "excelData",
        "currentIndex",
      ]);

      // If data exists, restore application state
      if (result.excelData) {
        this.jsonData = result.excelData;
        this.currentIndex = result.currentIndex || 0;
        this.fillFormButton.disabled = false;
        this.displayCurrentUser();
        this.updateStatus(`Loaded ${this.jsonData.length} records`);
      }
    } catch (error) {
      // Log and display any errors during data loading
      console.error("Error loading stored data:", error);
      this.updateStatus("Error loading stored data");
    }
  }

  // Set up event listeners for file input and form fill button
  initializeEventListeners() {
    // Handle file selection event
    this.fileInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) {
        await this.handleFileUpload(file);
      }
    });

    // Handle form fill button click
    this.fillFormButton.addEventListener("click", () => {
      this.handleFormFill();
    });
  }

  // Process the uploaded Excel file
  async handleFileUpload(file) {
    try {
      // Update status and read file
      this.updateStatus("Reading file...");
      const arrayBuffer = await this.readFileAsArrayBuffer(file);

      // Parse Excel file using SheetJS library
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON
      this.jsonData = XLSX.utils.sheet_to_json(sheet);

      // Validate and store data
      if (this.jsonData && this.jsonData.length > 0) {
        // Store data in Chrome's local storage for persistence
        await chrome.storage.local.set({
          excelData: this.jsonData,
          currentIndex: 0,
        });

        // Reset index, enable form fill, and update UI
        this.currentIndex = 0;
        this.fillFormButton.disabled = false;
        this.displayCurrentUser();
        this.updateStatus(
          `Successfully loaded ${this.jsonData.length} records`
        );
      } else {
        throw new Error("No data found in Excel file");
      }
    } catch (error) {
      // Handle and display any errors during file processing
      console.error("Error processing file:", error);
      this.updateStatus(`Error: ${error.message}`);
      this.fillFormButton.disabled = true;
    }
  }

  // Read uploaded file as an ArrayBuffer (required for SheetJS)
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("File reading failed"));
      reader.readAsArrayBuffer(file);
    });
  }

  // Display details of the current record in the UI
  displayCurrentUser() {
    // Handle case of no data
    if (!this.jsonData || !this.jsonData[this.currentIndex]) {
      this.currentUserDisplay.innerHTML = "<p>No user data available</p>";
      return;
    }

    // Render current user details in a table format
    const user = this.jsonData[this.currentIndex];
    this.currentUserDisplay.innerHTML = `
      <div class="user-info">
        <h3>Current Record (${this.currentIndex + 1}/${
      this.jsonData.length
    })</h3>
        <table>
          <tr>
            <td><strong>Name:</strong></td>
            <td>${user["Full Name"] || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Mobile:</strong></td>
            <td>${user["Mobile No"] || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Identity:</strong></td>
            <td>${user["Identity No"] || "N/A"}</td>
          </tr>
           <tr>
            <td><strong>Tourist Type:</strong></td>
            <td>${user["Tourist Type"] || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Select Identity Proof:</strong></td>
            <td>${user["Select Identity Proof"] || "N/A"}</td>
          </tr>
           <tr>
            <td><strong>Select Gender:</strong></td>
            <td>${user["Select Gender"] || "N/A"}</td>
          </tr>
        </table>
      </div>
    `;
  }

  // Ensure content script is injected into the active tab
  async ensureContentScriptInjected(tabId) {
    try {
      // First, check if content script is already running
      try {
        await chrome.tabs.sendMessage(tabId, { action: "ping" });
        console.log("Content script is already running");
        return true;
      } catch (err) {
        console.log("Content script not detected, will inject");
      }

      // Inject content script if not already present
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      });

      // Wait briefly to allow script initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify script injection
      try {
        await chrome.tabs.sendMessage(tabId, { action: "ping" });
        console.log("Content script successfully injected");
        return true;
      } catch (err) {
        throw new Error("Content script injection verification failed");
      }
    } catch (error) {
      // Handle and log any injection errors
      console.error("Error in ensureContentScriptInjected:", error);
      throw new Error(`Content script injection failed: ${error.message}`);
    }
  }

  // Send a message to the content script with a timeout
  sendMessageWithTimeout(tabId, message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      // Set up a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, timeout);

      // Send message to content script
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);
        // Handle any Chrome runtime errors
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Main method to fill the form with current record's data
  async handleFormFill() {
    // Validate data availability
    if (!this.jsonData || !this.jsonData[this.currentIndex]) {
      this.updateStatus("No data available to fill");
      return;
    }

    try {
      // Get the active browser tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error("No active tab found");
      }

      // Update status to show progress
      this.updateStatus("Preparing to fill form...");

      // Ensure content script is injected into the tab
      await this.ensureContentScriptInjected(tab.id);

      // Get current record's data
      const userData = this.jsonData[this.currentIndex];

      // Send message to content script to fill the form
      const response = await new Promise((resolve, reject) => {
        // Set a timeout for form filling
        const timeout = setTimeout(() => {
          reject(new Error("Form filling timed out"));
        }, 5000);

        // Send fill form message
        chrome.tabs.sendMessage(
          tab.id,
          { action: "fillForm", data: userData },
          (response) => {
            clearTimeout(timeout);
            // Handle Chrome runtime errors
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      // Process form filling response
      if (response && response.success) {
        this.updateStatus(`Form filled for record ${this.currentIndex + 1}`);

        // Move to next record if available
        if (this.currentIndex < this.jsonData.length - 1) {
          this.currentIndex++;
          await chrome.storage.local.set({ currentIndex: this.currentIndex });
          this.displayCurrentUser();
        } else {
          this.updateStatus("All records processed!");
        }
      } else {
        throw new Error(response?.error || "Failed to fill form");
      }
    } catch (error) {
      // Handle and display any errors during form filling
      console.error("Error in handleFormFill:", error);
      this.updateStatus(`Error: ${error.message}`);
    }
  }

  // Update status message in the UI
  updateStatus(message) {
    if (this.statusElement) {
      this.statusElement.textContent = message;
    }
  }
}

// Initialize the ExcelFormFiller when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  new ExcelFormFiller();
});
