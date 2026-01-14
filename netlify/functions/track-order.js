const { getDoc } = require('./utils/googleSheets');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { id, email } = event.queryStringParameters;

    if (!id || !email) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing Order ID or Email' }),
        };
    }

    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['Orders'] || doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        const targetId = id.trim().toLowerCase();
        const targetEmail = email.trim().toLowerCase();

        const orderRow = rows.find(row => {
            const rowId = (row.get('Order ID') || '').trim().toLowerCase();
            const rowEmail = (row.get('Email') || '').trim().toLowerCase();
            return rowId === targetId && rowEmail === targetEmail;
        });

        if (orderRow) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    found: true,
                    orderId: orderRow.get('Order ID'),
                    status: orderRow.get('Status'),
                    date: orderRow.get('Date'),
                    trackingNumber: orderRow.get('Tracking Number'),
                    courier: orderRow.get('Courier'),
                    isRush: (orderRow.get('Rush Order?') || '').toUpperCase() === 'YES'
                }),
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ found: false, error: 'Order not found' }),
            };
        }

    } catch (error) {
        console.error('Error fetching order:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch order', details: error.message }),
        };
    }
};
