const { getDoc } = require('./googleSheets');

// 1. Define Vendor Mappings
// Priority order: More specific rules first, then general ones
const VENDOR_RULES = [
    // CustomCat - Fast overnight shipping for pillows and blankets
    {
        keyword: 'Keepsake Pillow',
        vendor: 'CustomCat',
        settingKey: 'AUTOPILOT_PILLOW',
        supportsOvernight: true
    },
    {
        keyword: 'Premium Woven Blanket',
        vendor: 'CustomCat',
        settingKey: 'AUTOPILOT_BLANKET',
        supportsOvernight: true
    },
    {
        keyword: 'Framed Portrait',
        vendor: 'CustomCat',
        settingKey: 'AUTOPILOT_PORTRAIT',
        supportsOvernight: true
    },
    // Celebrate Prints - Same-day cap panels
    {
        keyword: 'Cap Panel',
        vendor: 'CelebratePrints',
        settingKey: 'AUTOPILOT_CAPPANEL',
        supportsOvernight: true
    },
    // Trupoint Memorials - Urns
    {
        keyword: 'Urn',
        vendor: 'TrupointMemorials',
        settingKey: 'AUTOPILOT_URN',
        supportsOvernight: false
    },
    // Contrado - Premium textiles (1-2 day production)
    {
        keyword: 'Pillow',
        vendor: 'Contrado',
        settingKey: 'AUTOPILOT_CONTRADO',
        supportsOvernight: false,
        priority: 2 // Lower priority than CustomCat
    },
    {
        keyword: 'Woven',
        vendor: 'Contrado',
        settingKey: 'AUTOPILOT_CONTRADO',
        supportsOvernight: false,
        priority: 2
    },
    // SPOD (Spreadshirt) - Fast 48hr production
    {
        keyword: 'Shirt',
        vendor: 'SPOD',
        settingKey: 'AUTOPILOT_SPOD',
        supportsOvernight: false,
        priority: 2 // Alternative to Printful for shirts
    },
    {
        keyword: 'Hoodie',
        vendor: 'SPOD',
        settingKey: 'AUTOPILOT_SPOD',
        supportsOvernight: false
    },
    // Existing vendors
    {
        keyword: 'Blanket',
        vendor: 'Printify',
        settingKey: 'AUTOPILOT_BLANKET',
        supportsOvernight: false
    },
    {
        keyword: 'Stone',
        vendor: 'Printify',
        settingKey: 'AUTOPILOT_DEFAULT',
        supportsOvernight: false
    },
    {
        keyword: 'Shirt',
        vendor: 'Printful',
        settingKey: 'AUTOPILOT_TSHIRT',
        supportsOvernight: false
    },
    {
        keyword: 'Mug',
        vendor: 'Printful',
        settingKey: 'AUTOPILOT_MUG',
        supportsOvernight: false
    },
    {
        keyword: 'Candle',
        vendor: 'Printful',
        settingKey: 'AUTOPILOT_CANDLE',
        supportsOvernight: false
    },
    {
        keyword: 'Ornament',
        vendor: 'Printful',
        settingKey: 'AUTOPILOT_ORNAMENT',
        supportsOvernight: false
    },
    {
        keyword: 'Package',
        vendor: 'Gooten',
        settingKey: 'AUTOPILOT_COMFORT',
        supportsOvernight: false
    }
];

// 2. Main Router Function
async function routeOrder(orderData) {
    try {
        console.log(`🤖 Autopilot: Inspecting Order ${orderData.token}`);

        // Debug: Check if API keys are loaded (don't log the actual keys)
        console.log('🔑 API Checks:', {
            CustomCat: process.env.CUSTOMCAT_API_KEY ? 'OK' : 'MISSING',
            SPOD: process.env.SPOD_API_KEY ? 'OK' : 'MISSING',
            Printful: process.env.PRINTFUL_API_KEY ? 'OK' : 'MISSING',
            Printify: process.env.PRINTIFY_API_KEY ? 'OK' : 'MISSING',
            Contrado: process.env.CONTRADO_API_KEY ? 'OK' : 'MISSING',
            Trupoint: process.env.TRUPOINT_API_KEY ? 'OK' : 'MISSING'
        });

        // A. Fetch all settings first
        const doc = await getDoc();
        // Check if "Settings" sheet created
        const settingSheet = doc.sheetsByTitle['Settings'];
        let settings = {};

        if (settingSheet) {
            const rows = await settingSheet.getRows();
            rows.forEach(row => {
                settings[row.get('Key')] = row.get('Value');
            });
        }

        // Global Kill Switch
        if (settings['AUTOPILOT_GLOBAL'] !== 'ON') {
            console.log('🤖 Autopilot: Global Switch is OFF. Skipping.');
            return { action: 'skipped', reason: 'Global OFF' };
        }

        // B. Analyze Items
        const results = [];

        for (const item of orderData.items) {
            const itemName = item.name;

            // Find matching rule
            const rule = VENDOR_RULES.find(r => itemName.includes(r.keyword));

            if (rule) {
                const isEnabled = settings[rule.settingKey] === 'ON';

                if (isEnabled) {
                    console.log(`✅ Routing "${itemName}" to ${rule.vendor} (Autopilot ON)`);

                    // Check if we have the API key/capability for this vendor
                    const apiKeyMap = {
                        'CustomCat': process.env.CUSTOMCAT_API_KEY,
                        'SPOD': process.env.SPOD_API_KEY,
                        'Printify': process.env.PRINTIFY_API_KEY,
                        'Printful': process.env.PRINTFUL_API_KEY,
                        'Contrado': process.env.CONTRADO_API_KEY, // Likely missing
                        'TrupointMemorials': process.env.TRUPOINT_API_KEY, // Likely missing
                        'CelebratePrints': null // Always manual
                    };

                    const hasKey = apiKeyMap[rule.vendor];

                    if (hasKey) {
                        // --- READY FOR API ---
                        // await sendToVendor(rule.vendor, orderData, item);
                        results.push({ item: itemName, vendor: rule.vendor, status: 'Sent via API', type: 'API_SUCCESS' });
                    } else {
                        // --- MANUAL FALLBACK ---
                        console.log(`⚠️  No API Key for ${rule.vendor}. Flagging for Manual Order.`);
                        results.push({ item: itemName, vendor: rule.vendor, status: `⚠️ MANUAL ORDER: ${rule.vendor}`, type: 'MANUAL_REQUIRED' });
                    }

                } else {
                    console.log(`⏸️  Skipping "${itemName}" (Autopilot ${rule.settingKey} is OFF)`);
                    results.push({ item: itemName, vendor: rule.vendor, status: 'Skipped (Setting OFF)', type: 'SKIPPED' });
                }
            } else {
                // Default / Fallback
                const isDefaultEnabled = settings['AUTOPILOT_DEFAULT'] === 'ON';
                if (isDefaultEnabled) {
                    console.log(`✅ Routing "${itemName}" to Review/Default (Autopilot ON)`);
                    results.push({ item: itemName, vendor: 'Manual/Other', status: 'Sent (Default)' });
                } else {
                    console.log(`⏸️  Skipping "${itemName}" (Default Autopilot OFF)`);
                    results.push({ item: itemName, vendor: 'Manual', status: 'Skipped (Default OFF)' });
                }
            }
        }

        return { action: 'processed', details: results };

    } catch (e) {
        console.error('Autopilot Router Error:', e);
        return { action: 'error', error: e.message };
    }
}

module.exports = { routeOrder };
