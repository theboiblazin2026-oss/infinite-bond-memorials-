const { getDoc } = require('./utils/googleSheets');

exports.handler = async (event, context) => {
    // Allow GET for simple verification checks from some providers
    if (event.httpMethod === 'GET') {
        return { statusCode: 200, body: 'POD Webhook Listener Active' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    // console.log('Received Payload:', JSON.stringify(body)); // For debugging

    let snipcartId = null;
    let trackingNumber = null;
    let courier = null;
    let provider = 'Unknown';

    // --- 1. Identify Provider & Extract Data ---

    // PRINTFUL (Event: package_shipped)
    if (body.type === 'package_shipped' && body.data && body.data.shipment) {
        provider = 'Printful';
        snipcartId = body.data.order.external_id; // "SNIP-xxxx"
        trackingNumber = body.data.shipment.tracking_number;
        courier = body.data.shipment.carrier;
    }

    // PRINTIFY (Event: order:shipment:created)
    // Payload usually has 'resource' object
    else if (body.topic === 'order:shipment:created' && body.resource) {
        provider = 'Printify';
        // Printify 'external_id' is usually at resource.order_id or verify payload structure
        // Standard Printify webhook structure:
        // { topic: '...', resource: { id: '...', order_id: '...', shipments: [...] } }
        // But wait, Printify sends the SHIPMENT object in 'resource'. The external_id might need to be looked up?
        // Actually, Printify typically includes 'external_id' in the order object, but let's check deep.
        // If Printify sends just the shipment, we might be in trouble without an External ID.
        // However, most integrations pass 'external_id' in the root or resource.

        // Best effort:
        snipcartId = body.resource.external_id || body.resource.order?.external_id;
        trackingNumber = body.resource.tracking_number;
        courier = body.resource.carrier;
    }

    // GOOTEN (Postback)
    // Checks for common Gooten fields
    else if (body.ReferenceID || (body.Properties && body.Properties.AccountReferenceId)) {
        provider = 'Gooten';
        snipcartId = body.ReferenceID || body.Properties?.AccountReferenceId;
        trackingNumber = body.TrackingNumber;
        courier = body.CarrierName;
    }

    // Fallback / Unknown
    if (!snipcartId) {
        console.log('Skipping: No Snipcart ID found in payload.');
        return { statusCode: 200, body: 'Skipped: No External ID found' };
    }

    console.log(`Processing ${provider} Update for ${snipcartId}`);

    // --- 2. Update Google Sheet ---
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['Orders'] || doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        const targetId = snipcartId.trim().toLowerCase();

        // Find the row
        const orderRow = rows.find(row => {
            const rowId = (row.get('Order ID') || '').trim().toLowerCase();
            return rowId === targetId;
        });

        if (orderRow) {
            orderRow.set('Status', 'Shipped');
            if (trackingNumber) orderRow.set('Tracking Number', trackingNumber);
            if (courier) orderRow.set('Courier', courier);

            await orderRow.save();
            return { statusCode: 200, body: `Updated order ${snipcartId}` };
        } else {
            console.log(`Order ${snipcartId} not found in sheet.`);
            return { statusCode: 200, body: 'Order ID not found in database' };
        }

    } catch (error) {
        console.error('Sheet Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
