const { getDoc } = require('./googleSheets');

// 1. Define Vendor Mappings
const VENDOR_RULES = [
    {
        keyword: 'Blanket',
        vendor: 'Printify',
        settingKey: 'AUTOPILOT_BLANKET'
    },
    {
        keyword: 'Stone',
        vendor: 'Printify',
        settingKey: 'AUTOPILOT_DEFAULT' // Assuming stone falls under default or similar
    },
    {
        keyword: 'Shirt',
        vendor: 'Printful',
        settingKey: 'AUTOPILOT_TSHIRT'
    },
    {
        keyword: 'Mug',
        vendor: 'Printful',
        settingKey: 'AUTOPILOT_MUG'
    },
    {
        keyword: 'Package',
        vendor: 'Gooten',
        settingKey: 'AUTOPILOT_COMFORT'
    }
];

// 2. Main Router Function
async function routeOrder(orderData) {
    try {
        console.log(`🤖 Autopilot: Inspecting Order ${orderData.token}`);

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

                    // --- MOCK API CALL TO VENDOR ---
                    // In a real app, you would import 'printful-client' here
                    // await sendToPrintful(orderData, item);

                    results.push({ item: itemName, vendor: rule.vendor, status: 'Sent' });
                } else {
                    console.log(`⏸️  Skipping "${itemName}" (Autopilot ${rule.settingKey} is OFF)`);
                    results.push({ item: itemName, vendor: rule.vendor, status: 'Skipped (Setting OFF)' });
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
