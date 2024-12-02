// content.js
console.log("Content script loaded");

// Set up a listener for messages from the extension's background or popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Log the received message action for debugging purposes
  console.log("Message received in content script:", request.action);

  // Handle ping message to verify the content script is actively loaded and responsive
  if (request.action === "ping") {
    // Respond with an "ok" status to confirm script is running
    sendResponse({ status: "ok" });
    return true;
  }

  // Primary handler for form filling functionality
  if (request.action === "fillForm") {
    try {
      // Extract form data passed from the extension
      const formData = request.data;
      // Log the received form data for debugging
      console.log("Received form data:", formData);

      // Clear any existing data in the form to prevent data conflicts
      clearForm();

      // Create a map to track which fields have been successfully filled
      const filledFields = new Map();

      // Define selector mappings for different input fields
      const inputMappings = {
        "Full Name": 'input[placeholder="Enter Full name"]',
        "Mobile No": 'input[placeholder="Enter Mobile No."]',
        "Identity No": 'input[placeholder="Enter Identity No."]',
      };

      // Iterate through input mappings and fill corresponding fields
      Object.entries(inputMappings).forEach(([fieldName, selector]) => {
        // Find the input field using the defined selector
        const field = document.querySelector(selector);
        
        // Check if field exists and data is provided
        if (field && formData[fieldName]) {
          // Set the field's value
          field.value = formData[fieldName];
          
          // Trigger input events to simulate user interaction
          triggerEvents(field);
          
          // Mark this field as successfully filled
          filledFields.set(fieldName, true);
          
          // Log successful field filling
          console.log(`Filled field: ${fieldName}`);
        } else {
          // Log a warning if field is not found or no data is provided
          console.warn(`Field "${fieldName}" not found or no data provided.`);
        }
      });

      // Debugging function to log details about dropdown elements
      const debugDropdowns = () => {
        console.log("DEBUG: Dropdown Elements");
        // Find all elements with combobox role
        const dropdowns = document.querySelectorAll('[role="combobox"]');
        
        // Log total number of dropdowns found
        console.log(`Total dropdowns found: ${dropdowns.length}`);
        
        // Detailed logging for each dropdown
        dropdowns.forEach((dropdown, index) => {
          console.log(`Dropdown ${index}:`, {
            textContent: dropdown.textContent,
            innerHTML: dropdown.innerHTML,
            outerHTML: dropdown.outerHTML,
            attributes: Array.from(dropdown.attributes).map(
              (attr) => `${attr.name}="${attr.value}`
            ),
          });
        });
      };

      // Handle Tourist Type dropdown first in a promise chain
      if (formData["Tourist Type"]) {
        fillTouristTypeDropdown(formData["Tourist Type"])
          .then((result) => {
            // Log successful Tourist Type selection
            console.log(result);
            
            // Mark Tourist Type as filled
            filledFields.set("Tourist Type", true);

            // Debug dropdowns after Tourist Type selection
            debugDropdowns();

            // Delay to ensure DOM is updated before next action
            return new Promise((resolve) => {
              setTimeout(() => {
                console.log("Attempting to fill Identity Proof dropdown");
                resolve();
              }, 0);
            });
          })
          // Sequentially handle Identity Proof dropdown
          .then(() => {
            if (formData["Select Identity Proof"]) {
              return fillIdentityProofDropdown(
                formData["Select Identity Proof"]
              );
            }
          })
          .then((result) => {
            if (result) {
              // Log successful Identity Proof selection
              console.log(result);
              
              // Mark Identity Proof as filled
              filledFields.set("Select Identity Proof", true);

              // Debug dropdowns after Identity Proof selection
              debugDropdowns();

              // Delay before Gender dropdown
              return new Promise((resolve) => {
                setTimeout(() => {
                  console.log("Attempting to fill Gender dropdown");
                  resolve();
                }, 0);
              });
            }
          })
          // Handle Gender dropdown
          .then(() => {
            if (formData["Select Gender"]) {
              return fillGenderDropdown(formData["Select Gender"]);
            }
          })
          .then((result) => {
            if (result) {
              // Log successful Gender selection
              console.log(result);
              
              // Mark Gender as filled
              filledFields.set("Select Gender", true);

              // Send success response back to extension
              sendResponse({
                success: true,
                message: `Fields filled: ${filledFields.size}`,
                filledFields: Array.from(filledFields.keys()),
              });
            }
          })
          // Handle any errors in the dropdown filling process
          .catch((error) => {
            console.error("Dropdown filling error:", error);
            
            // Send error response back to extension
            sendResponse({
              success: false,
              error: error.message,
            });
          });
      } else {
        // Warn if Tourist Type data is not provided
        console.warn("Tourist Type data not provided.");
      }

      // Return true to indicate async response will be sent
      return true;
    } catch (error) {
      // Log any unexpected errors during form filling
      console.error("Error filling form:", error);
      
      // Send error response back to extension
      sendResponse({
        success: false,
        error: error.message,
      });
      
      // Return true to indicate async response
      return true;
    }
  }
});

// Async function to fill Tourist Type dropdown with robust selection mechanism
async function fillTouristTypeDropdown(touristTypeValue) {
  return new Promise((resolve, reject) => {
    try {
      // Array of strategies to find dropdown trigger
      const dropdownTriggers = [
        () => document.querySelector('div[role="combobox"][tabindex="0"]'),
        () => document.querySelector(".MuiSelect-select"),
        () => document.querySelector('[aria-haspopup="listbox"]'),
      ];

      // Find the first valid dropdown trigger
      let dropdownTrigger;
      for (let findTrigger of dropdownTriggers) {
        dropdownTrigger = findTrigger();
        if (dropdownTrigger) break;
      }

      // Detailed error handling if no dropdown trigger is found
      if (!dropdownTrigger) {
        console.error("NO DROPDOWN TRIGGER FOUND. Detailed DOM Analysis:");
        console.log(
          "All combobox elements:",
          Array.from(document.querySelectorAll('[role="combobox"]')).map(
            (el) => ({
              textContent: el.textContent,
              classes: el.className,
              attributes: Array.from(el.attributes).map(
                (a) => `${a.name}="${a.value}`
              ),
            })
          )
        );
        return reject("No dropdown trigger found");
      }

      // Advanced interaction to open dropdown
      dropdownTrigger.click();
      dropdownTrigger.dispatchEvent(
        new MouseEvent("mousedown", {
          view: window,
          bubbles: true,
          cancelable: true,
        })
      );

      // Multiple selectors to find dropdown options
      const optionSelectors = [
        '[role="option"]',
        ".MuiMenuItem-root",
        'li[role="option"]',
        'ul[role="listbox"] > li',
        ".MuiList-root > li",
      ];

      // Function to find options using multiple selectors
      const findOptions = () => {
        let foundOptions = [];
        for (let selector of optionSelectors) {
          foundOptions = Array.from(document.querySelectorAll(selector));
          if (foundOptions.length > 0) break;
        }
        return foundOptions;
      };

      // Recursive function to attempt finding and selecting options
      const attemptFindOptions = (attempt = 0) => {
        // Find available options
        const options = findOptions();

        // Log number of options found
        console.log(`Attempt ${attempt + 1}: Found ${options.length} options`);

        // If options are found
        if (options.length > 0) {
          // Log detailed options information
          console.log(
            "Option Details:",
            options.map((opt) => ({
              text: opt.textContent.trim(),
              classes: opt.className,
            }))
          );

          // Find option matching the desired value
          const matchingOption = options.find(
            (option) => option.textContent.trim() === touristTypeValue
          );

          // If matching option found
          if (matchingOption) {
            // Click the matching option
            matchingOption.click();

            // Verify selection after a short delay
            setTimeout(() => {
              const currentSelection = document.querySelector(
                'div[role="combobox"]'
              );
              console.log("Current Selection:", currentSelection.textContent);
              resolve("Tourist Type selected successfully");
            }, 300);
            return;
          } else {
            // Log warning if no exact match found
            console.warn(`No exact match for "${touristTypeValue}"`);
            console.warn(
              "Available options:",
              options.map((opt) => opt.textContent.trim())
            );
          }
        }

        // Retry mechanism with maximum 3 attempts
        if (attempt < 3) {
          setTimeout(() => attemptFindOptions(attempt + 1), 500);
        } else {
          reject(`Could not find option: ${touristTypeValue}`);
        }
      };

      // Start the option finding process
      attemptFindOptions();
    } catch (error) {
      // Handle any unexpected errors
      console.error("Dropdown Error:", error);
      reject(error.message);
    }
  });
}

// Simplified Identity Proof dropdown function
async function fillIdentityProofDropdown(selectedValue) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Attempting to select Identity Proof: ${selectedValue}`);

      // Advanced dropdown trigger selection strategies
      const dropdownTriggers = [
        () => {
          // Try to find dropdown by index
          const dropdowns = document.querySelectorAll('[role="combobox"]');
          return dropdowns.length > 1 ? dropdowns[1] : null;
        },
        () => document.querySelector('div[role="combobox"]:nth-child(2)'),
        () => document.querySelectorAll(".MuiSelect-select")[1],
      ];

      let dropdownTrigger;
      for (let findTrigger of dropdownTriggers) {
        dropdownTrigger = findTrigger();
        if (dropdownTrigger) break;
      }

      if (!dropdownTrigger) {
        console.error(
          "NO DROPDOWN TRIGGER FOUND FOR IDENTITY PROOF. Detailed Analysis:"
        );
        const allDropdowns = document.querySelectorAll('[role="combobox"]');
        console.log(`Total dropdowns: ${allDropdowns.length}`);
        allDropdowns.forEach((dd, index) => {
          console.log(`Dropdown ${index}:`, dd.outerHTML);
        });
        return reject("No dropdown trigger found for Identity Proof");
      }

      console.log("Identity Proof Dropdown Trigger:", {
        textContent: dropdownTrigger.textContent,
        outerHTML: dropdownTrigger.outerHTML,
      });

      // Open dropdown
      dropdownTrigger.click();
      dropdownTrigger.dispatchEvent(
        new MouseEvent("mousedown", {
          view: window,
          bubbles: true,
          cancelable: true,
        })
      );

      // Wait for dropdown to populate
      setTimeout(() => {
        const optionSelectors = [
          '[role="option"]',
          ".MuiMenuItem-root",
          'li[role="option"]',
        ];

        // Log all available options
        let allOptions = [];
        optionSelectors.forEach((selector) => {
          const options = Array.from(document.querySelectorAll(selector));
          allOptions = allOptions.concat(options);
        });

        console.log(
          "All Available Options:",
          allOptions.map((opt) => opt.textContent.trim())
        );

        // Find matching option
        let matchingOption;
        for (let selector of optionSelectors) {
          const options = Array.from(document.querySelectorAll(selector));
          matchingOption = options.find(
            (el) =>
              el.textContent.trim().toLowerCase() ===
              selectedValue.toLowerCase()
          );
          if (matchingOption) break;
        }

        if (matchingOption) {
          matchingOption.click();
          resolve("Identity Proof selected successfully");
        } else {
          console.warn(`No matching option for "${selectedValue}"`);
          console.warn(
            "Available options:",
            allOptions.map((opt) => opt.textContent.trim())
          );
          reject(`Option for "${selectedValue}" not found`);
        }
      }, 1000);
    } catch (error) {
      console.error("Identity Proof Dropdown Error:", error);
      reject(error.message);
    }
  });
}

// Similar enhanced function for Gender dropdown (can be adapted from Identity Proof)
async function fillGenderDropdown(genderValue) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Attempting to select Gender: ${genderValue}`);

      // Advanced dropdown trigger selection strategies
      const dropdownTriggers = [
        () => {
          // Try to find dropdown by index
          const dropdowns = document.querySelectorAll('[role="combobox"]');
          return dropdowns.length > 2 ? dropdowns[2] : null;
        },
        () => document.querySelector('div[role="combobox"]:nth-child(3)'),
        () => document.querySelectorAll(".MuiSelect-select")[2],
      ];

      let dropdownTrigger;
      for (let findTrigger of dropdownTriggers) {
        dropdownTrigger = findTrigger();
        if (dropdownTrigger) break;
      }

      if (!dropdownTrigger) {
        console.error(
          "NO DROPDOWN TRIGGER FOUND FOR GENDER. Detailed Analysis:"
        );
        const allDropdowns = document.querySelectorAll('[role="combobox"]');
        console.log(`Total dropdowns: ${allDropdowns.length}`);
        allDropdowns.forEach((dd, index) => {
          console.log(`Dropdown ${index}:`, dd.outerHTML);
        });
        return reject("No dropdown trigger found for Gender");
      }

      console.log("Gender Dropdown Trigger:", {
        textContent: dropdownTrigger.textContent,
        outerHTML: dropdownTrigger.outerHTML,
      });

      // Open dropdown
      dropdownTrigger.click();
      dropdownTrigger.dispatchEvent(
        new MouseEvent("mousedown", {
          view: window,
          bubbles: true,
          cancelable: true,
        })
      );

      // Wait for dropdown to populate
      setTimeout(() => {
        const optionSelectors = [
          '[role="option"]',
          ".MuiMenuItem-root",
          'li[role="option"]',
        ];

        // Log all available options
        let allOptions = [];
        optionSelectors.forEach((selector) => {
          const options = Array.from(document.querySelectorAll(selector));
          allOptions = allOptions.concat(options);
        });

        console.log(
          "All Available Gender Options:",
          allOptions.map((opt) => opt.textContent.trim())
        );

        // Find matching option
        let matchingOption;
        for (let selector of optionSelectors) {
          const options = Array.from(document.querySelectorAll(selector));
          matchingOption = options.find(
            (el) =>
              el.textContent.trim().toLowerCase() === genderValue.toLowerCase()
          );
          if (matchingOption) break;
        }

        if (matchingOption) {
          matchingOption.click();
          resolve("Gender selected successfully");
        } else {
          console.warn(`No matching option for "${genderValue}"`);
          console.warn(
            "Available Gender options:",
            allOptions.map((opt) => opt.textContent.trim())
          );
          reject(`Option for "${genderValue}" not found`);
        }
      }, 1000);
    } catch (error) {
      console.error("Gender Dropdown Error:", error);
      reject(error.message);
    }
  });
}

function triggerEvents(element) {
  // Create a new input event that bubbles up the DOM
  const event = new Event("input", { bubbles: true });
  // Dispatch the event to simulate user input
  element.dispatchEvent(event);
}

// Helper function to clear all form fields
function clearForm() {
  // Select all input, textarea, and select elements
  const fields = document.querySelectorAll("input, textarea, select");

  // Iterate through fields and clear their values
  fields.forEach((field) => {
    // Skip submit and button type inputs
    if (field.type !== "submit" && field.type !== "button") {
      // Clear the field value
      field.value = "";
      // Trigger input events to notify any listeners
      triggerEvents(field);
    }
  });
}