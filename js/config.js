const CONFIG = {
    // Snipcart Public API Key
    // REPLACE THIS with your live key from Snipcart Dashboard -> Account -> API Keys
    SNIPCART_API_KEY: "NDc4N2JjYmEtNzlmMi00YmIxLWEyMDAtN2I4NmIwZTRkZDEzNjM5MDM5MjkyMDY0MTMxMDYw",

    // Live Domain URL (No trailing slash)
    // Update this after you purchase your custom domain (e.g., "https://infinitebondmemorials.com")
    LIVE_DOMAIN: "https://infinitebondmemorials.com",

    // Google Analytics ID
    GA_MEASUREMENT_ID: "G-XXXXXXXXXX",

    // Formspree Form IDs (For Contact & Partnership Forms)
    // Create new forms at https://formspree.io/ and paste the 8-character codes here (e.g., "xjgdwkqz")
    FORMSPREE_CONTACT_ID: "xwvvkgwa",
    FORMSPREE_PARTNER_ID: "xnjjqeoy",

    // ============================================
    // FULFILLMENT VENDOR CONFIGURATION
    // ============================================
    // CRITICAL: DO NOT PUT API KEYS HERE!
    // API keys must be stored in Netlify Environment Variables for security.
    // Go to: Netlify Dashboard -> Site Settings -> Environment Variables
    // Keys required:
    // - CUSTOMCAT_API_KEY
    // - SPOD_API_KEY
    // - PRINTFUL_API_KEY
    // - PRINTIFY_API_KEY
    // - CONTRADO_API_KEY
    // - TRUPOINT_API_KEY

    // Manual Order Accounts (Reference only)
    CELEBRATE_PRINTS_ACCOUNT: "theboiblazin2026@gmail.com"
};

// Auto-inject Snipcart Key if the placeholder exists
document.addEventListener("DOMContentLoaded", () => {
    const snipcartDiv = document.querySelector("#snipcart");
    if (snipcartDiv) {
        snipcartDiv.setAttribute("data-api-key", CONFIG.SNIPCART_API_KEY);
    }

    // Dual Submission Logic (Netlify + Formspree)
    const forms = [
        { id: "contact-form", endpoint: CONFIG.FORMSPREE_CONTACT_ID },
        { id: "partner-form", endpoint: CONFIG.FORMSPREE_PARTNER_ID }
    ];

    forms.forEach(({ id, endpoint }) => {
        const form = document.getElementById(id);
        if (form) {
            form.addEventListener("submit", (e) => {
                // Determine if we should prevent default (only if we want AJAX only, but for Netlify we need default)
                // However, Netlify Forms handles the POST request. 
                // We will fire and forget the Formspree request.

                const formData = new FormData(form);

                // Send to Formspree in background
                fetch(`https://formspree.io/f/${endpoint}`, {
                    method: "POST",
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    },
                    keepalive: true // Ensures request completes even if page navigates
                }).catch(err => console.error("Formspree backup submission failed:", err));

                // Allow default submission to proceed to Netlify
            });
        }
    });
});
