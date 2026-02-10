import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL || "mysql://mysql:Saman6055@72.61.89.215:3306/default";

async function createSuperAdmin() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  const username = "admin";
  const password = "Admin@2026";
  const passwordHash = await bcrypt.hash(password, 10);
  
  const openId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Check if admin already exists
    const [existing] = await connection.execute(
      "SELECT id FROM users WHERE username = ? OR role = 'admin'",
      [username]
    );
    
    if (existing.length > 0) {
      // Update existing admin password
      await connection.execute(
        "UPDATE users SET passwordHash = ?, username = ? WHERE role = 'admin' LIMIT 1",
        [passwordHash, username]
      );
      console.log("Admin user updated!");
    } else {
      // Create new admin
      await connection.execute(
        `INSERT INTO users (openId, username, name, email, passwordHash, role, loginMethod, isActive, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [openId, username, "Super Admin", "admin@waznexpress.com", passwordHash, "admin", "username", true]
      );
      console.log("Super Admin created!");
    }
    
    console.log("\n=== Login Credentials ===");
    console.log("Username: admin");
    console.log("Password: Admin@2026");
    console.log("=========================\n");
    
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await connection.end();
  }
}

createSuperAdmin();
