import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { fullPackageOrders } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function recalculateProfits() {
  console.log('Connecting to database...');
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log('Fetching all orders...');
  const orders = await db.select().from(fullPackageOrders);
  
  console.log(`Found ${orders.length} orders to recalculate`);
  
  let updated = 0;
  
  for (const order of orders) {
    const orderType = order.orderType;
    const shippingCost = parseFloat(order.shippingCostUsd || '0') || 0;
    const quantity = order.quantity || 1;
    
    let profit = 0;
    
    if (orderType === 'full_package') {
      // Full Package: (sellingPrice - purchasePrice) * quantity - shippingCost
      const purchasePrice = parseFloat(order.purchasePriceUsd || '0') || 0;
      const sellingPrice = parseFloat(order.sellingPriceUsd || '0') || 0;
      profit = ((sellingPrice - purchasePrice) * quantity) - shippingCost;
    } else if (orderType === 'purchase_request') {
      // Purchase Request: (sellingPrice - itemPrice) * quantity - shippingCost
      const itemPrice = parseFloat(order.itemPriceUsd || '0') || 0;
      const sellingPrice = parseFloat(order.sellingPriceUsd || '0') || 0;
      profit = ((sellingPrice - itemPrice) * quantity) - shippingCost;
    } else if (orderType === 'commission') {
      // Commission: commissionFee - shippingCost
      const commissionFee = parseFloat(order.commissionFeeUsd || '0') || 0;
      profit = commissionFee - shippingCost;
    }
    
    const newProfit = profit.toFixed(2);
    const oldProfit = order.profitUsd;
    
    if (newProfit !== oldProfit) {
      await db.update(fullPackageOrders)
        .set({ profitUsd: newProfit })
        .where(eq(fullPackageOrders.id, order.id));
      
      console.log(`Updated order ${order.orderCode}: ${oldProfit} -> ${newProfit}`);
      updated++;
    }
  }
  
  console.log(`\nRecalculation complete!`);
  console.log(`Total orders: ${orders.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${orders.length - updated}`);
  
  await connection.end();
}

recalculateProfits().catch(console.error);
