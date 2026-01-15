const { getDoc } = require('./utils/googleSheets');

exports.handler = async (event, context) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['Orders'] || doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        let totalRevenue = 0;
        let totalCost = 0;
        let totalProfit = 0;
        let orderCount = 0;
        let recentSales = [];

        // Iterate rows to calculate totals
        rows.forEach(row => {
            const rev = parseFloat(row.get('Revenue') || 0);
            const cost = parseFloat(row.get('Est. Cost') || 0);
            const profit = parseFloat(row.get('Profit') || 0);

            if (!isNaN(rev)) totalRevenue += rev;
            if (!isNaN(cost)) totalCost += cost;
            if (!isNaN(profit)) totalProfit += profit;

            orderCount++;

            // Grab last 5 sales for the widget
            if (rows.length - orderCount < 5) {
                recentSales.push({
                    id: row.get('Order ID'),
                    date: row.get('Date'),
                    customer: row.get('Customer Name'),
                    profit: profit.toFixed(2),
                    status: row.get('Status')
                });
            }
        });

        // Calculate margin
        const currentMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

        return {
            statusCode: 200,
            body: JSON.stringify({
                totalRevenue: totalRevenue.toFixed(2),
                totalCost: totalCost.toFixed(2),
                totalProfit: totalProfit.toFixed(2),
                margin: currentMargin,
                orderCount: orderCount,
                recentOrders: recentSales.reverse() // Show newest first
            }),
        };
    } catch (error) {
        console.error('Failed to fetch stats:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch financial stats' }),
        };
    }
};
