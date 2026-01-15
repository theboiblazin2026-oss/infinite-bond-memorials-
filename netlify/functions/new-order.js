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

        // --- 1. Autopilot Routing First ---
        // Run routing logic regarding API keys vs Manual vendors
        const { routeOrder } = require('./utils/orderRouter');
        const routerResult = await routeOrder(content);
        console.log('Autopilot Result:', JSON.stringify(routerResult));

        // Analyze Routing Results for Sheet Status
        let fulfillmentStatus = 'Processing';
        let routingNotes = [];
        let hasManualItems = false;
        let hasApiSuccess = false;

        if (routerResult && routerResult.details) {
            routerResult.details.forEach(res => {
                routingNotes.push(`[${res.item} -> ${res.vendor}: ${res.status}]`);
                if (res.type === 'MANUAL_REQUIRED') {
                    hasManualItems = true;
                }
                if (res.type === 'API_SUCCESS') {
                    hasApiSuccess = true;
                }
            });
        }

        // Check for Router Errors (System Error)
        if (routerResult && routerResult.action === 'error') {
            hasManualItems = true;
            fulfillmentStatus = '⚠️ ROUTING ERROR';
            routingNotes.push(`CRITICAL ERROR: ${routerResult.error}`);
        }

        // Determine Final Status for Sheet
        if (hasManualItems) {
            fulfillmentStatus = '⚠️ ACTION REQUIRED';
        } else if (hasApiSuccess) {
            fulfillmentStatus = 'Sent to Vendor';
        }

        // --- 3. CRITICAL: Send Email Alert if Action Required ---
        if (hasManualItems || fulfillmentStatus.includes('⚠️')) {
            console.log('🚨 sending alert for manual order/error...');
            try {
                // Generate SPECIFIC backup instructions based on the vendor/item
                let backupInstructions = "Please log in to the vendor dashboard and place this order manually.";

                if (itemsList.toLowerCase().includes('pillow') || itemsList.toLowerCase().includes('blanket')) {
                    backupInstructions = `
👉 BACKUP PROTOCOL (CustomCat Down?):
1. Log in to Printify (printify.com)
2. Select Provider: "Monster Digital" (Fastest alternative)
3. Create order with reference: ${orderId}
                    `;
                } else if (itemsList.toLowerCase().includes('rug') || itemsList.toLowerCase().includes('premium')) {
                    backupInstructions = `
👉 BACKUP PROTOCOL (Contrado Down?):
1. Log in to Prodigi (prodigi.com) OR Printful
2. Select closest matching premium product
3. Ship via "Expedited Traceable"
                    `;
                } else if (itemsList.toLowerCase().includes('urn')) {
                    backupInstructions = `
👉 BACKUP PROTOCOL (Trupoint Down?):
1. Go to FuneralHomeGifts.com (Manual Order)
2. Place order for similar SKU
3. Use customer shipping address and pay with business card
                    `;
                }

                const alertBody = {
                    email: "alerts@infinitebondmemorials.com",
                    message: `
🚨 ACTION REQUIRED: Order Alert

Order ID: ${orderId}
Customer: ${customerName}

STATUS: ${fulfillmentStatus}

REASON:
${routingNotes.join('\n')}

${backupInstructions}

Please check the Netlify logs or Google Sheet immediately.
                    `
                };

                await fetch('https://formspree.io/f/xwvvkgwa', {
                    method: 'POST',
                    body: JSON.stringify(alertBody),
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (alertErr) { console.error('Failed to send alert:', alertErr); }
        }

        // --- FINANCIAL CALCULATION ---
        const revenue = parseFloat(content.invoiceNumber ? (content.finalGrandTotal || 0) : 0);

        // Estimated Costs (Based on Business Plan)
        let estCost = 0;
        if (itemsList.toLowerCase().includes('pillow')) estCost += 23.50;
        else if (itemsList.toLowerCase().includes('blanket')) estCost += 44.00;
        else if (itemsList.toLowerCase().includes('shirt') || itemsList.toLowerCase().includes('tee')) estCost += 14.00;
        else if (itemsList.toLowerCase().includes('urn')) estCost += 80.00;
        else if (itemsList.toLowerCase().includes('rug')) estCost += 35.00;
        else if (itemsList.toLowerCase().includes('panel')) estCost += 35.00;
        else estCost += (revenue * 0.5); // Default 50% margin rule if unknown

        const profit = revenue - estCost;

        // --- 2. Log to Google Sheet ---
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['Orders'] || doc.sheetsByIndex[0];

        // AUTO-MIGRATION: Check and Add Headers if missing
        await sheet.loadHeaderRow(); // Ensure headers are loaded
        const currentHeaders = sheet.headerValues;
        const newHeaders = ['Revenue', 'Est. Cost', 'Profit'];
        const missingHeaders = newHeaders.filter(h => !currentHeaders.includes(h));

        if (missingHeaders.length > 0) {
            console.log('Migrating Sheet Headers: Adding Financial Columns...');
            await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
        }

        await sheet.addRow({
            'Order ID': orderId,
            'Date': date,
            'Customer Name': customerName,
            'Email': email,
            'Items': itemsList,
            'Rush Order?': isRush ? 'YES' : 'NO',
            'Status': isRush ? `${fulfillmentStatus} (RUSH)` : fulfillmentStatus,
            'Tracking Number': '',
            'Courier': '',
            'Revenue': revenue.toFixed(2),
            'Est. Cost': estCost.toFixed(2),
            'Profit': profit.toFixed(2),
            'Notes': routingNotes.join('\n')
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Order logged & routed', router: routerResult }),
        };
    } catch (error) {
        console.error('CRITICAL: Failed to log order:', error);

        // Emergency Alert for Crash
        try {
            await fetch('https://formspree.io/f/xwvvkgwa', {
                method: 'POST',
                body: JSON.stringify({
                    email: "emergency@infinitebondmemorials.com",
                    message: `CRITICAL SYSTEM FAILURE: Order processing crashed.\nError: ${error.message}`
                }),
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) { /* hopeless */ }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to log order', details: error.message }),
        };
    }
};
