const User = require('../models/User');
const bcrypt = require('bcryptjs');

module.exports = async () => {
  try {
    const adminEmail = 'admin@mail.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin555', 10);
      
      const admin = new User({
        email: adminEmail,
        password: hashedPassword,
        username: 'Administrator',
        isVerified: true,
        isAdmin: true,
        coins: 1000000 // Admin has unlimited but we set high amount
      });
      
      await admin.save();
      console.log('✅ Default admin created');
    } else {
      console.log('✅ Admin already exists');
    }
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  }
};