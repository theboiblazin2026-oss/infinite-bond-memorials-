const { getDoc } = require('./utils/googleSheets');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const payload = JSON.parse(event.body);
        const content = payload.content;

        if (!content || payload.eventName !== 'order.completed') {
            // Just return 200 to acknowledge other events if any
            return { statusCode: 200, body: 'Ignored event' };
        }

        const orderId = content.token; // Snipcart Order ID (e.g., SNIP-...)
        const date = new Date(content.completionDate).toISOString().split('T')[0];
        const customerName = content.items[0]?.shippable ? content.shippingAddress?.fullName : content.billingAddress?.fullName;
        const email = content.user.email;

        // Extract Items and Check for Rush Order
        let isRush = false;
        const itemsList = content.items.map(item => {
            // Check custom fields for Rush Order
            if (item.customFields) {
                item.customFields.forEach(field => {
                    if (field.name === 'Processing Time' && field.value.includes('Rush')) {
                        isRush = true;
                    }
                });
            }
            return `${item.quantity}x ${item.name}`;
        }).join(', ');

        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['Orders'] || doc.sheetsByIndex[0];

        await sheet.addRow({
            'Order ID': orderId,
            'Date': date,
            'Customer Name': customerName,
            'Email': email,
            'Items': itemsList,
            'Rush Order?': isRush ? 'YES' : 'NO',
            'Status': isRush ? 'Processing (Rush)' : 'Processing',
            'Tracking Number': '',
            'Courier': '',
            'Notes': ''
        });

        // --- 2. Autopilot Routing (New) ---
        const { routeOrder } = require('./utils/orderRouter');
        const routerResult = await routeOrder(payload.content);

        // Update sheet with routing status if needed, or just log result
        console.log('Autopilot Result:', JSON.stringify(routerResult));

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Order logged & routed', router: routerResult }),
        };
    } catch (error) {
        console.error('Error logging new order:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to log order', details: error.message }),
        };
    }
};
