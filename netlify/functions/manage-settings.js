const { getDoc } = require('./utils/googleSheets');

exports.handler = async (event, context) => {
    try {
        const doc = await getDoc();

        // Ensure "Settings" sheet exists
        let sheet = doc.sheetsByTitle['Settings'];
        if (!sheet) {
            sheet = await doc.addSheet({ title: 'Settings', headerValues: ['Key', 'Value'] });
        }

        const rows = await sheet.getRows();

        // Helper to get a setting
        const getSetting = (key) => {
            const row = rows.find(r => r.get('Key') === key);
            return row ? row.get('Value') : null;
        };

        // Helper to set a setting
        const setSetting = async (key, value) => {
            const row = rows.find(r => r.get('Key') === key);
            if (row) {
                row.set('Value', value);
                await row.save();
            } else {
                await sheet.addRow({ 'Key': key, 'Value': value });
            }
        };

        // GET: Return all settings as a JSON object
        if (event.httpMethod === 'GET') {
            const settings = {};
            rows.forEach(row => {
                settings[row.get('Key')] = row.get('Value');
            });
            // Defaults if not set
            if (!settings['AUTOPILOT_GLOBAL']) settings['AUTOPILOT_GLOBAL'] = 'OFF';

            return {
                statusCode: 200,
                body: JSON.stringify(settings)
            };
        }

        // POST: Update a specific setting
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { key, value } = body; // Expect { key: "AUTOPILOT_BLANKET", value: "ON" }

            if (key && value) {
                await setSetting(key, value);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Updated', key, value })
                };
            }
        }

        return { statusCode: 400, body: 'Bad Request' };

    } catch (error) {
        console.error('Settings Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
