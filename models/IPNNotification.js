import mongoose from 'mongoose';

const IPNNotificationSchema = new mongoose.Schema({
    email: String,
    productId: String,
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' }
});

export default mongoose.model('IPNNotification', IPNNotificationSchema);
